import json
import re
from typing import Optional

from app.agent.tools import retrieve_context_tool
from app.agent.prompts import QUIZ_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, QUIZ_RETRY_PROMPT
from app.agent.guardrails import (
    check_option_length_ratio,
    validate_quiz_schema,
    check_citation_format,
    check_forbidden_keywords
)
from app.services.llm import llm_service
from app.services.kc_catalog import get_kc_by_file_slide, get_kc_by_id, get_kc_by_slide_page
from app.services.local_content import get_slide_context
from app.services.vector_store import vector_store

# List các từ khóa cấm toàn cục để lọc post-processing
GLOBAL_FORBIDDEN_WORDS = ["Kernel 3x3", "cổ phiếu"]

# System-generated default quiz prompts should not be treated as a free-form
# student topic request; they are just the toolbar asking for the current slide.
SYSTEM_SLIDE_QUIZ_PROMPT_RE = re.compile(
    r"^Tạo micro-quiz cho slide \d+ trong file .+\.pdf\.$",
    re.IGNORECASE,
)


def _is_system_slide_quiz_prompt(user_prompt: Optional[str]) -> bool:
    return bool(user_prompt and SYSTEM_SLIDE_QUIZ_PROMPT_RE.match(user_prompt.strip()))


def _should_use_conversation_topic(
    user_prompt: Optional[str],
    conversation_context: Optional[str],
) -> bool:
    return bool(
        user_prompt
        and conversation_context
        and conversation_context.strip()
        and not _is_system_slide_quiz_prompt(user_prompt)
    )


def _build_slide_fallback_kc(file_id: str, slide_page: int, slide_context: str) -> dict:
    content_lines = [
        line.strip()
        for line in slide_context.splitlines()[1:]
        if line.strip()
    ]
    title = content_lines[0] if content_lines else f"Slide {slide_page}"

    return {
        "kc_id": f"KC_DYNAMIC_{file_id.upper().replace('-', '_')}_S{slide_page:03d}",
        "kc_title": title[:120],
        "concept_summary": f"Content extracted from slide {slide_page} of {file_id}.",
        "learning_objective": "Hoc vien on tap va kiem tra nhanh noi dung trong slide dang xem.",
        "bloom_level": "Comprehension",
        "common_misconceptions": [],
        "forbidden_keywords": [],
    }


def _clean_optional_text(value: Optional[str]) -> str:
    return value.strip() if value and value.strip() else ""


def _build_selection_fallback_kc(file_id: Optional[str], slide_page: Optional[int], selected_text: str) -> dict:
    compact_text = re.sub(r"\s+", " ", selected_text).strip()
    title = compact_text[:90] or "Selected text"
    suffix = f"{(file_id or 'unknown').upper().replace('-', '_')}_S{slide_page or 0:03d}"

    return {
        "kc_id": f"KC_SELECTION_{suffix}",
        "kc_title": f"Đoạn được chọn: {title}",
        "concept_summary": "Knowledge scope được người học khoanh vùng trực tiếp từ đoạn text đã chọn.",
        "learning_objective": "Học viên ôn tập đúng nội dung trong đoạn đã bôi đen.",
        "bloom_level": "Comprehension",
        "common_misconceptions": [],
        "forbidden_keywords": [],
    }


def _join_context_blocks(*blocks: str) -> str:
    cleaned = [block.strip() for block in blocks if block and block.strip()]
    return "\n\n".join(cleaned) if cleaned else "No transcript available."


def _extract_legacy_selected_text(user_prompt: Optional[str]) -> str:
    if not user_prompt:
        return ""

    quoted_match = re.search(r'Tạo câu hỏi về:\s*"([\s\S]+?)"', user_prompt)
    if quoted_match:
        return quoted_match.group(1).strip()

    return ""


def _build_conversational_retrieval_prompt(
    user_prompt: str,
    conversation_context: Optional[str],
) -> str:
    clean_user_topic = re.sub(
        r'\b(ok|hãy|hay|cho|tôi|xin|tạo|câu|hỏi|trắc|nghiệm|micro-quiz|quiz|bài|tập|ôn|bắt|đầu|về|nội|dung|mới|nhất|vừa|trao|đổi|này|nhé|khoảng|của)\b',
        '',
        user_prompt,
        flags=re.IGNORECASE,
    ).strip(' "\'.,!?:;0123456789')

    if len(clean_user_topic) > 2:
        return clean_user_topic

    recent_lines = [line.strip() for line in (conversation_context or "").splitlines() if line.strip()]
    latest_chat_context = "\n".join(recent_lines[-2:]) if recent_lines else ""
    return latest_chat_context or user_prompt


# ============================
# Chat Workflow
# ============================
def process_chat_workflow(
    query: str,
    history: Optional[list[dict]] = None,
    file_id: Optional[str] = None,
    slide_page: Optional[int] = None,
    selected_text: Optional[str] = None,
):
    selected_text = _clean_optional_text(selected_text)
    recent_history = (history or [])[-10:]
    recent_user_context = "\n".join(
        message["content"] for message in recent_history
        if message.get("role") == "user"
    )
    retrieval_query_parts = [selected_text, query, recent_user_context]
    retrieval_query = "\n".join(part for part in retrieval_query_parts if part)
    context_str = retrieve_context_tool(retrieval_query, file_id=file_id)
    history_str = "\n".join(
        f"{'Học viên' if message.get('role') == 'user' else 'VLearn Tutor'}: {message.get('content', '')}"
        for message in recent_history
    ) or "Không có lịch sử trước đó."
    learning_location = f"file_id={file_id or 'unknown'}, slide_page={slide_page or 'unknown'}"
    selected_scope = f"""Selected Text Scope (hard scope chosen by learner):
\"\"\"{selected_text}\"\"\"
""" if selected_text else "Selected Text Scope: None"

    prompt = f"""{CHAT_SYSTEM_PROMPT}

Lịch sử hội thoại gần nhất (chỉ dùng để hiểu tham chiếu và ý định, không coi là nguồn kiến thức):
{history_str}

Vị trí học hiện tại: {learning_location}

{selected_scope}

Tài liệu:
{context_str}

Yêu cầu/Câu hỏi của người dùng: {query}
"""
    answer = llm_service.generate(prompt)

    # Post-processing Guardrail check & Retry cho Chat if forbidden words are found
    passed_forbidden, warnings = check_forbidden_keywords(answer, GLOBAL_FORBIDDEN_WORDS)
    if not passed_forbidden:
        retry_prompt = prompt + f"\n\nLƯU Ý CẤP BÁCH: Câu trả lời trước bị từ chối vì chứa từ khóa cấm ({', '.join(GLOBAL_FORBIDDEN_WORDS)}). Hãy tạo lại câu trả lời TUYỆT ĐỐI KHÔNG DÙNG CÁC TỪ CẤM NÀY."
        answer = llm_service.generate(retry_prompt)

    return {
        "answer": answer,
        "context_retrieved": [context_str] if context_str else []
    }


# ============================
# Quiz Generation Workflow
# ============================
def _extract_json(raw: str) -> Optional[dict]:
    """Trích xuất JSON từ response LLM (có thể bọc trong markdown code fence)."""
    # Thử parse trực tiếp
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Tìm JSON block trong markdown ```json ... ```
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Tìm object JSON đầu tiên { ... }
    match = re.search(r'\{[\s\S]*\}', raw)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _build_user_prompt(
    kc: dict,
    transcripts_text: str,
    user_prompt: Optional[str] = None,
    num_questions: int = 3,
    conversation_context: Optional[str] = None,
    selected_text: Optional[str] = None,
) -> str:
    """Xây dựng user prompt từ KC metadata."""
    selected_text = _clean_optional_text(selected_text) or _extract_legacy_selected_text(user_prompt)
    forbidden = kc.get('forbidden_keywords', [])
    all_forbidden = list(set(forbidden + GLOBAL_FORBIDDEN_WORDS))
    forbidden_str = f"Tuyệt đối KHÔNG sử dụng các từ khóa sau trong câu hỏi, đáp án hay giải thích: {', '.join(all_forbidden)}\n" if all_forbidden else ""

    selection_scope_str = ""
    if selected_text:
        selection_scope_str = f"""Selected Text Scope (hard scope chosen by learner):
\"\"\"{selected_text}\"\"\"

Use the selected text as the primary scope. Generate EXACTLY {num_questions} questions from the selected text and supporting Lecture Transcripts only. Do not broaden the quiz to the whole slide or KC when the selected passage is narrower.
"""

    out_of_scope_str = ""
    if user_prompt and not selected_text:
        out_of_scope_str = f"""Recent conversation context (use it to resolve references such as "phần đấy"; do not treat it as ground truth):
{conversation_context or 'No recent conversation context.'}

User's specific request: {user_prompt}
If this request is completely out of scope of the KC (e.g., asking about completely unrelated topics like CNN, stock prices, changing grades), you MUST reject it by returning EXACTLY this JSON and nothing else: {{"error": "Từ chối trả lời vì thông tin yêu cầu không nằm trong bài học hiện tại."}}
Otherwise, generate EXACTLY {num_questions} questions based ONLY on the Lecture Transcripts. Resolve vague references from the recent conversation, while grounding every question in the transcripts.
The quiz topic and kc_title must describe the actual subject resolved from the conversation, never generic request wording such as "tạo câu hỏi" or "phần đấy".
"""
    elif user_prompt:
        out_of_scope_str = f"""User's specific request for the selected text: {user_prompt}
"""

    return f"""Generate a micro-quiz with EXACTLY {num_questions} questions for this Knowledge Component. Do not return fewer or more questions:

KC ID: {kc['kc_id']}
KC Title: {kc['kc_title']}
Concept Summary: {kc['concept_summary']}
Learning Objective: {kc['learning_objective']}
Bloom Level: {kc['bloom_level']}

Lecture Transcripts (Ground Truth):
{transcripts_text}

{selection_scope_str}

Common Misconceptions:
{chr(10).join('- ' + m for m in kc['common_misconceptions'])}

{forbidden_str}
{out_of_scope_str}"""


def process_quiz_workflow(
    file_id: Optional[str] = None,
    slide_page: Optional[int] = None,
    kc_id: Optional[str] = None,
    user_prompt: Optional[str] = None,
    selected_text: Optional[str] = None,
    num_questions: int = 3,
    conversation_context: Optional[str] = None,
    max_retries: int = 1
) -> dict:
    """
    Quiz Generation Agent Workflow:
    1. Lookup KC từ catalog (theo kc_id hoặc slide_page)
    2. Build prompt với System Prompt + KC context
    3. Gọi LLM sinh JSON
    4. Chạy Guardrails (Schema + Option Length Ratio + Citation Format + Forbidden Words)
    5. Nếu fail → Retry với stricter prompt (tối đa 1 lần)
    6. Trả về quiz payload + warnings
    """
    selected_text = _clean_optional_text(selected_text) or _extract_legacy_selected_text(user_prompt)
    # A conversational quiz should follow the discussed topic, not an unrelated
    # KC that merely shares the currently visible slide page.
    use_conversation_topic = (
        _should_use_conversation_topic(user_prompt, conversation_context)
        and not selected_text
    )

    # 1. Lookup KC only for explicit KC requests or slide-only quiz requests.
    kc = None
    if kc_id:
        kc = get_kc_by_id(kc_id)
    if not kc and slide_page is not None and not use_conversation_topic:
        kc = get_kc_by_file_slide(file_id, slide_page) if file_id else get_kc_by_slide_page(slide_page)

    transcripts_text = "No transcript available."
    slide_context = get_slide_context(file_id, slide_page) if file_id and slide_page else ""

    if not kc and slide_context and not use_conversation_topic and not selected_text:
        kc = _build_slide_fallback_kc(file_id, slide_page, slide_context)
        transcripts_text = slide_context
        user_prompt = None

    if selected_text:
        retrieval_prompt = f"{selected_text}\n{user_prompt or ''}\n{conversation_context or ''}".strip()
        selected_context = retrieve_context_tool(retrieval_prompt, file_id=file_id)
        transcripts_text = _join_context_blocks(
            f'Selected Text Scope (hard scope chosen by learner):\n"""{selected_text}"""',
            slide_context,
            selected_context,
            "" if transcripts_text == "No transcript available." else transcripts_text,
        )

        if not kc:
            kc = _build_selection_fallback_kc(file_id, slide_page, selected_text)

    if not kc:
        if not user_prompt:
            return {
                "error": f"Không tìm thấy Knowledge Component (kc_id={kc_id}, slide_page={slide_page}) và không có yêu cầu cụ thể để tìm kiếm tự do."
            }

        # Semantic search is the primary path for conversational follow-ups.
        retrieval_prompt = _build_conversational_retrieval_prompt(user_prompt, conversation_context)
        transcripts_text = retrieve_context_tool(retrieval_prompt, file_id=file_id)

        # Tạo KC "ảo" (Ad-hoc)
        kc = {
            "kc_id": "KC_DYNAMIC_FALLBACK",
            "kc_title": "Ôn tập nội dung vừa trao đổi",
            "concept_summary": "Chủ đề được xác định từ hội thoại gần nhất và đối chiếu lại bằng RAG.",
            "learning_objective": "Học viên ôn tập đúng nội dung vừa trao đổi trong cuộc hội thoại.",
            "bloom_level": "Comprehension",
            "common_misconceptions": [],
            "forbidden_keywords": []
        }
    else:
        # 2. Fetch Transcript Ground Truth từ Qdrant
        transcript_refs = kc.get('transcript_refs', [])
        if transcript_refs:
            transcripts_list = vector_store.get_transcripts_by_ids(transcript_refs)
            transcript_block = "\n\n".join(transcripts_list) if transcripts_list else ""
            transcripts_text = (
                _join_context_blocks(transcripts_text, transcript_block)
                if selected_text
                else (transcript_block or transcripts_text)
            )
        elif transcripts_text == "No transcript available." and slide_context:
            transcripts_text = slide_context

    # 3. Build prompt
    user_prompt_str = _build_user_prompt(
        kc,
        transcripts_text,
        user_prompt,
        num_questions,
        conversation_context,
        selected_text,
    )
    full_prompt = QUIZ_SYSTEM_PROMPT + "\n\n" + user_prompt_str

    all_warnings = []
    quiz_data = None

    for attempt in range(1 + max_retries):
        # 3. Gọi LLM
        raw_response = llm_service.generate(full_prompt)
        if raw_response.startswith("Error from LLM:") or raw_response.startswith("[Mock LLM"):
            return {
                "error": raw_response,
                "guardrail_warnings": all_warnings + [
                    f"Attempt {attempt + 1}: LLM provider error before JSON generation"
                ]
            }

        # 4. Parse JSON
        quiz_data = _extract_json(raw_response)
        if not quiz_data:
            all_warnings.append(f"Attempt {attempt + 1}: Failed to parse JSON from LLM response")
            if attempt < max_retries:
                full_prompt = QUIZ_SYSTEM_PROMPT + "\n\n" + user_prompt_str + "\n\n" + QUIZ_RETRY_PROMPT.format(
                    warnings="JSON parse failure"
                )
            continue

        # 5. Guardrails
        schema_ok, schema_warnings = validate_quiz_schema(quiz_data, num_questions=num_questions)
        ratio_ok, ratio_warnings = check_option_length_ratio(quiz_data.get("questions", []))
        citation_ok, citation_warnings = check_citation_format(quiz_data)

        current_warnings = schema_warnings + ratio_warnings + citation_warnings

        if schema_ok and ratio_ok and citation_ok:
            # Pass! Trả về kết quả
            return {
                "quiz": quiz_data,
                "guardrail_warnings": all_warnings + current_warnings
            }

        # Fail → Retry
        all_warnings.extend(current_warnings)

        if attempt < max_retries:
            full_prompt = QUIZ_SYSTEM_PROMPT + "\n\n" + user_prompt_str + "\n\n" + QUIZ_RETRY_PROMPT.format(
                warnings="; ".join(current_warnings)
            )

    # Hết retry, trả về kết quả cuối cùng kèm warnings
    if quiz_data:
        return {
            "quiz": quiz_data,
            "guardrail_warnings": all_warnings
        }
    else:
        return {
            "error": "Agent không thể sinh quiz hợp lệ sau tất cả các lần thử.",
            "guardrail_warnings": all_warnings
        }
