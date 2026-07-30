import json
import re
from typing import Optional

from app.agent.tools import retrieve_context_tool
from app.agent.prompts import QUIZ_SYSTEM_PROMPT, QUIZ_RETRY_PROMPT
from app.agent.guardrails import check_option_length_ratio, validate_quiz_schema
from app.services.llm import llm_service
from app.services.kc_catalog import get_kc_by_id, get_kc_by_slide_page
from app.services.vector_store import vector_store

# ============================
# Chat Workflow (giữ nguyên)
# ============================
def process_chat_workflow(query: str):
    context_str = retrieve_context_tool(query)

    prompt = f"""Dựa vào các đoạn tài liệu sau đây, hãy đóng vai là VLearn Tutor để trả lời câu hỏi của người dùng hoặc tạo bài kiểm tra nhanh theo yêu cầu.
Nếu thông tin không có trong tài liệu, hãy nói rõ là bạn không biết.

Tài liệu:
{context_str}

Yêu cầu/Câu hỏi của người dùng: {query}
"""
    answer = llm_service.generate(prompt)

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


from app.services.vector_store import vector_store

def _build_user_prompt(kc: dict, transcripts_text: str, user_prompt: Optional[str] = None) -> str:
    """Xây dựng user prompt từ KC metadata."""
    forbidden = kc.get('forbidden_keywords', [])
    forbidden_str = f"Tuyệt đối KHÔNG sử dụng các từ khóa sau trong câu hỏi, đáp án hay giải thích: {', '.join(forbidden)}\n" if forbidden else ""

    out_of_scope_str = ""
    if user_prompt:
        out_of_scope_str = f"""User's specific request: {user_prompt}
If this request is completely out of scope of the KC (e.g., asking about completely unrelated topics like CNN, stock prices, changing grades), you MUST reject it by returning EXACTLY this JSON and nothing else: {{"error": "Từ chối trả lời vì thông tin yêu cầu không nằm trong bài học hiện tại."}}
Otherwise, if it's related or a generic quiz request, generate a 3-question micro-quiz for this Knowledge Component based ONLY on the Lecture Transcripts.
"""

    return f"""Generate a 3-question micro-quiz for this Knowledge Component:

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
    max_retries: int = 1
) -> dict:
    """
    Quiz Generation Agent Workflow:
    1. Lookup KC từ catalog (theo kc_id hoặc slide_page)
    2. Build prompt với System Prompt + KC context
    3. Gọi LLM sinh JSON
    4. Chạy Guardrails (Schema + Option Length Ratio)
    5. Nếu fail → Retry với stricter prompt (tối đa 1 lần)
    6. Trả về quiz payload + warnings
    """
    # 1. Lookup KC
    kc = None
    if kc_id:
        kc = get_kc_by_id(kc_id)
    if not kc and slide_page is not None:
        kc = get_kc_by_slide_page(slide_page)

    transcripts_text = "No transcript available."

    if not kc:
        if not user_prompt:
            return {
                "error": f"Không tìm thấy Knowledge Component (kc_id={kc_id}, slide_page={slide_page}) và không có yêu cầu cụ thể để tìm kiếm tự do."
            }
        
        # Fallback Semantic Search: Gom RAG phân loại để tạo KC động
        transcripts_text = retrieve_context_tool(user_prompt)
        
        # Tạo KC "ảo" (Ad-hoc)
        kc = {
            "kc_id": "KC_DYNAMIC_FALLBACK",
            "kc_title": f"Chủ đề tự chọn: {user_prompt[:30]}...",
            "concept_summary": "Nội dung được tổng hợp động từ tài liệu (Fallback RAG).",
            "learning_objective": "Học viên nắm bắt được thông tin liên quan tới câu hỏi tự do.",
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
    user_prompt_str = _build_user_prompt(kc, transcripts_text, user_prompt)
    full_prompt = QUIZ_SYSTEM_PROMPT + "\n\n" + user_prompt_str

    all_warnings = []

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
        schema_ok, schema_warnings = validate_quiz_schema(quiz_data)
        ratio_ok, ratio_warnings = check_option_length_ratio(quiz_data.get("questions", []))

        current_warnings = schema_warnings + ratio_warnings

        if schema_ok and ratio_ok:
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
