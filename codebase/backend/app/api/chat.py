from fastapi import APIRouter
from app.models.schemas import ChatRequest, ChatResponse
from app.agent.workflow import process_chat_workflow

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    result = process_chat_workflow(
        request.query,
        history=[message.model_dump() for message in request.history],
        file_id=request.file_id,
        slide_page=request.slide_page,
        selected_text=request.selected_text,
    )
    return ChatResponse(
        answer=result["answer"],
        context_retrieved=result["context_retrieved"]
    )
