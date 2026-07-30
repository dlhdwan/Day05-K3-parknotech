from fastapi import APIRouter
from app.models.schemas import ChatRequest, ChatResponse
from app.agent.workflow import process_chat_workflow

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    result = process_chat_workflow(request.query)
    return ChatResponse(
        answer=result["answer"],
        context_retrieved=result["context_retrieved"]
    )
