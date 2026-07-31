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
    history_str = "\n".join(
        f"{'Học viên' if message.get('role') == 'user' else 'VLearn Tutor'}: {message.get('content', '')}"
        for message in recent_history
    ) or "Không có lịch sử trước đó."
    
    # Priority for retrieval: query itself is primary to prevent past conversation topics from polluting RAG search
    retrieval_query = query.strip() if query else ""
    context_str = retrieve_context_tool(retrieval_query)
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

    clean_target = ""
    if user_prompt:
        clean_target = user_prompt.replace("Tạo câu hỏi về:", "").replace("Tạo micro-quiz về:", "").strip(' "\'')

    focus_instruction = ""
    if clean_target:
        focus_instruction = f"""YÊU CẦU TRỌNG TÂM CỤ THỂ:
"{clean_target}"
Hãy tạo TẤT CẢ {num_questions} câu hỏi tập trung kiểm tra trực tiếp nội dung trên dựa trên thông tin bài giảng bên dưới.
"""

    ctx_info = ""
    if conversation_context and conversation_context.strip():
        ctx_info = f"Tóm tắt ngữ cảnh trao đổi gần nhất:\n{conversation_context}\n"

    return f"""Generate a micro-quiz with EXACTLY {num_questions} questions for this Knowledge Component. Do not return fewer or more questions:

KC Title: {kc['kc_title']}
Concept Summary: {kc['concept_summary']}
Learning Objective: {kc['learning_objective']}

{focus_instruction}
{ctx_info}
Lecture Transcripts & Material (Ground Truth):
{transcripts_text}

Common Misconceptions:
{chr(10).join('- ' + m for m in kc.get('common_misconceptions', []))}

{forbidden_str}"""


def process_quiz_workflow(
    file_id: Optional[str] = None,
    slide_page: Optional[int] = None,
    kc_id: Optional[str] = None,
    user_prompt: Optional[str] = None,
    num_questions: int = 3,
    conversation_context: Optional[str] = None,
    max_retries: int = 1
) -> dict:
    """
    Quiz Generation Agent Workflow:
    1. Phân loại loại yêu cầu (Bôi đen PDF / Yêu cầu trong Chat / Chọn Slide)
    2. Tra cứu RAG ngữ cảnh tương ứng chính xác
    3. Build prompt với System Prompt + Context
    4. Gọi LLM sinh JSON + Chạy Guardrails
    """
    # 1. Trích xuất đoạn văn bản bôi đen từ Document Viewer (nếu có dạng `Tạo câu hỏi về: "..."`)
    quoted_match = re.search(r'Tạo câu hỏi về:\s*"([\s\S]+?)"', user_prompt or '')
    explicit_selected_text = quoted_match.group(1).strip() if quoted_match else None

    # Biến kiểm tra người dùng có yêu cầu sinh quiz trong khung chat (như "tạo câu hỏi của nội dung này")
    is_conversational_quiz = bool(user_prompt and not explicit_selected_text)

    kc = None
    if kc_id:
        kc = get_kc_by_id(kc_id)
    # Chỉ tìm KC catalog theo trang nếu không phải conversational chat quiz hay bôi đen văn bản cụ thể
    if not kc and slide_page is not None and not is_conversational_quiz and not explicit_selected_text:
        kc = get_kc_by_slide_page(slide_page, file_id=file_id)

    transcripts_text = ""

    if explicit_selected_text:
        # Trường hợp 1: Người dùng bôi đen văn bản trực tiếp từ tài liệu PDF
        transcripts_text = retrieve_context_tool(explicit_selected_text)
        topic_title = explicit_selected_text[:50]
        kc = {
            "kc_id": "KC_DYNAMIC_SELECTION",
            "kc_title": f"Ôn tập: {topic_title}",
            "concept_summary": f"Nội dung được học viên bôi đen trực tiếp từ tài liệu: {explicit_selected_text}",
            "learning_objective": "Học viên nắm vững nội dung vừa bôi đen.",
            "bloom_level": "Comprehension",
            "common_misconceptions": [],
            "forbidden_keywords": []
        }
    elif is_conversational_quiz:
        # Trường hợp 2: Người dùng gõ yêu cầu tạo quiz trong Chat
        # Kiểm tra xem người dùng có chỉ định chủ đề cụ thể trong câu lệnh không (VD: "tạo quiz về ChatGPT và Gemini")
        clean_user_topic = re.sub(
            r'\b(ok|hãy|cho|tôi|xin|tạo|câu|hỏi|trắc|nghiệm|micro-quiz|quiz|bài|tập|ôn|bắt|đầu|về|nội|dung|mới|nhất|vừa|trao|đổi|này|nhé|khoảng|của)\b',
            '',
            user_prompt,
            flags=re.IGNORECASE
        ).strip(' "\'.,!?:;0123456789')

        if len(clean_user_topic) > 2:
            # Người dùng có nêu tên chủ đề cụ thể -> ƯU TIÊN CAO NHẤT cho chủ đề mới này, không bị kéo bởi short memo cũ
            search_query = clean_user_topic
            topic_summary = clean_user_topic
        else:
            # Người dùng gõ câu lệnh chung ("tạo câu hỏi nội dung mới nhất", "tạo quiz") -> Lấy tin nhắn MỚI NHẤT từ khung chat
            recent_lines = [l.strip() for l in (conversation_context or '').split('\n') if l.strip()]
            latest_chat_context = "\n".join(recent_lines[-2:]) if recent_lines else ""
            search_query = latest_chat_context if latest_chat_context else user_prompt
            topic_summary = "Nội dung vừa thảo luận mới nhất"

        transcripts_text = retrieve_context_tool(search_query)

        kc = {
            "kc_id": "KC_DYNAMIC_CONVERSATION",
            "kc_title": f"Ôn tập: {topic_summary}",
            "concept_summary": f"Nội dung kiến thức tập trung vào: {topic_summary}.",
            "learning_objective": "Học viên ôn tập đúng nội dung yêu cầu.",
            "bloom_level": "Comprehension",
            "common_misconceptions": [],
            "forbidden_keywords": []
        }
    elif kc:
        # Trường hợp 3: Khớp KC tĩnh từ catalog
        transcript_refs = kc.get('transcript_refs', [])
        transcripts_list = vector_store.get_transcripts_by_ids(transcript_refs)
        transcripts_text = "\n\n".join(transcripts_list) if transcripts_list else ""
    elif slide_page is not None:
        # Trường hợp 4: Fallback cho slide chưa đánh chỉ mục
        transcripts_text = retrieve_context_tool(f"Slide {slide_page} {file_id or ''}")
        kc = {
            "kc_id": "KC_DYNAMIC_SLIDE",
            "kc_title": f"Ôn tập Slide {slide_page}",
            "concept_summary": f"Nội dung trọng tâm bài giảng thuộc Slide {slide_page}.",
            "learning_objective": f"Học viên nắm vững kiến thức thuộc Slide {slide_page}.",
            "bloom_level": "Comprehension",
            "common_misconceptions": [],
            "forbidden_keywords": []
        }

    if not transcripts_text or "Không tìm thấy ngữ cảnh nào" in transcripts_text:
        return {
            "error": "Không tìm thấy nội dung bài học liên quan. Vui lòng chọn slide hoặc bôi đen văn bản cụ thể."
        }

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
