from pydantic import BaseModel, Field
from typing import List, Literal, Optional


# === Chat (giữ nguyên) ===
class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    query: str
    history: List[ChatHistoryMessage] = Field(default_factory=list)
    file_id: Optional[str] = None
    slide_page: Optional[int] = None
    selected_text: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    context_retrieved: Optional[List[str]] = Field(default_factory=list)


# === Quiz Generation ===
class QuizGenerateRequest(BaseModel):
    file_id: Optional[str] = None
    slide_page: Optional[int] = None
    kc_id: Optional[str] = None
    user_prompt: Optional[str] = None
    selected_text: Optional[str] = None
    num_questions: Optional[int] = 3
    conversation_context: Optional[str] = None

class QuizQuestion(BaseModel):
    id: int
    prompt: str
    options: List[str]
    correct_index: int
    explanation: str
    citation: str

class QuizPayload(BaseModel):
    kc_id: str
    kc_title: str
    questions: List[QuizQuestion]

class QuizGenerateResponse(BaseModel):
    quiz: QuizPayload
    guardrail_warnings: Optional[List[str]] = Field(default_factory=list)


# === Ingestion ===
class IngestResponse(BaseModel):
    status: str
    filename: str
    count: int
    message: str
