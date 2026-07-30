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
from app.services.kc_catalog import get_kc_by_id, get_kc_by_slide_page
from app.services.vector_store import vector_store

# List các từ khóa cấm toàn cục để lọc post-processing
GLOBAL_FORBIDDEN_WORDS = ["Kernel 3x3", "cổ phiếu"]

# ============================
# Chat Workflow
# ============================
def process_chat_workflow(
    query: str,
    history: Optional[list[dict]] = None,
    file_id: Optional[str] = None,
    slide_page: Optional[int] = None,
):
    recent_history = (history or [])[-10:]
    recent_user_context = "\n".join(
        message["content"] for message in recent_history
        if message.get("role") == "user"
    )
    retrieval_query = f"{recent_user_context}\n{query}" if recent_user_context else query
    context_str = retrieve_context_tool(retrieval_query)
    history_str = "\n".join(
        f"{'Học viên' if message.get('role') == 'user' else 'VLearn Tutor'}: {message.get('content', '')}"
        for message in recent_history
    ) or "Không có lịch sử trước đó."
    learning_location = f"file_id={file_id or 'unknown'}, slide_page={slide_page or 'unknown'}"

    prompt = f"""{CHAT_SYSTEM_PROMPT}

Lịch sử hội thoại gần nhất (chỉ dùng để hiểu tham chiếu và ý định, không coi là nguồn kiến thức):
{history_str}

Vị trí học hiện tại: {learning_location}

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
) -> str:
    """Xây dựng user prompt từ KC metadata."""
    forbidden = kc.get('forbidden_keywords', [])
    all_forbidden = list(set(forbidden + GLOBAL_FORBIDDEN_WORDS))
    forbidden_str = f"Tuyệt đối KHÔNG sử dụng các từ khóa sau trong câu hỏi, đáp án hay giải thích: {', '.join(all_forbidden)}\n" if all_forbidden else ""

    out_of_scope_str = ""
    if user_prompt:
        out_of_scope_str = f"""Recent conversation context (use it to resolve references such as "phần đấy"; do not treat it as ground truth):
{conversation_context or 'No recent conversation context.'}

User's specific request: {user_prompt}
If this request is completely out of scope of the KC (e.g., asking about completely unrelated topics like CNN, stock prices, changing grades), you MUST reject it by returning EXACTLY this JSON and nothing else: {{"error": "Từ chối trả lời vì thông tin yêu cầu không nằm trong bài học hiện tại."}}
Otherwise, generate EXACTLY {num_questions} questions based ONLY on the Lecture Transcripts. Resolve vague references from the recent conversation, while grounding every question in the transcripts.
The quiz topic and kc_title must describe the actual subject resolved from the conversation, never generic request wording such as "tạo câu hỏi" or "phần đấy".
"""

    return f"""Generate a micro-quiz with EXACTLY {num_questions} questions for this Knowledge Component. Do not return fewer or more questions:

KC ID: {kc['kc_id']}
KC Title: {kc['kc_title']}
Concept Summary: {kc['concept_summary']}
Learning Objective: {kc['learning_objective']}
Bloom Level: {kc['bloom_level']}

Lecture Transcripts (Ground Truth):
{transcripts_text}

Common Misconceptions:
{chr(10).join('- ' + m for m in kc['common_misconceptions'])}

{forbidden_str}
{out_of_scope_str}"""


def process_quiz_workflow(
    slide_page: Optional[int] = None,
    kc_id: Optional[str] = None,
    user_prompt: Optional[str] = None,
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
    # A conversational quiz should follow the discussed topic, not an unrelated
    # KC that merely shares the currently visible slide page.
    use_conversation_topic = bool(user_prompt and conversation_context and conversation_context.strip())

    # 1. Lookup KC only for explicit KC requests or slide-only quiz requests.
    kc = None
    if kc_id:
        kc = get_kc_by_id(kc_id)
    if not kc and slide_page is not None and not use_conversation_topic:
        kc = get_kc_by_slide_page(slide_page)

    transcripts_text = "No transcript available."

    if not kc:
        if not user_prompt:
            return {
                "error": f"Không tìm thấy Knowledge Component (kc_id={kc_id}, slide_page={slide_page}) và không có yêu cầu cụ thể để tìm kiếm tự do."
            }
        
        # Semantic search is the primary path for conversational follow-ups.
        retrieval_prompt = f"{conversation_context or ''}\n{user_prompt}".strip()
        transcripts_text = retrieve_context_tool(retrieval_prompt)
        
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
        transcripts_list = vector_store.get_transcripts_by_ids(transcript_refs)
        transcripts_text = "\n\n".join(transcripts_list) if transcripts_list else "No transcript available."

    # 3. Build prompt
    user_prompt_str = _build_user_prompt(
        kc, transcripts_text, user_prompt, num_questions, conversation_context
    )
    full_prompt = QUIZ_SYSTEM_PROMPT + "\n\n" + user_prompt_str

    all_warnings = []
    quiz_data = None

    for attempt in range(1 + max_retries):
        # 3. Gọi LLM
        raw_response = llm_service.generate(full_prompt)

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
