from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizPayload,
    QuizQuestion,
)
from app.agent.workflow import process_quiz_workflow

router = APIRouter()


@router.post("/quiz/generate", response_model=QuizGenerateResponse)
def quiz_generate_endpoint(request: QuizGenerateRequest):
    """
    POST /api/quiz/generate
    Body: { "slide_page": 14 } hoặc { "kc_id": "KC_FEW_SHOT_01" }
    """
    if not request.slide_page and not request.kc_id:
        raise HTTPException(status_code=400, detail="Cần cung cấp slide_page hoặc kc_id")

    result = process_quiz_workflow(
        slide_page=request.slide_page,
        kc_id=request.kc_id,
        user_prompt=request.user_prompt,
        num_questions=request.num_questions
    )

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    quiz_raw = result["quiz"]

    # Parse vào Pydantic models
    questions = [
        QuizQuestion(
            id=q["id"],
            prompt=q["prompt"],
            options=q["options"],
            correct_index=q["correct_index"],
            explanation=q["explanation"],
            citation=q.get("citation", "")
        )
        for q in quiz_raw.get("questions", [])
    ]

    quiz_payload = QuizPayload(
        kc_id=quiz_raw.get("kc_id", ""),
        kc_title=quiz_raw.get("kc_title", ""),
        questions=questions
    )

    return QuizGenerateResponse(
        quiz=quiz_payload,
        guardrail_warnings=result.get("guardrail_warnings", [])
    )
