from pydantic import BaseModel
from typing import List, Optional


# === Chat (giữ nguyên) ===
class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    context_retrieved: Optional[List[str]] = []


# === Quiz Generation ===
class QuizGenerateRequest(BaseModel):
    slide_page: Optional[int] = None
    kc_id: Optional[str] = None
    user_prompt: Optional[str] = None

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
    guardrail_warnings: Optional[List[str]] = []


# === Ingestion ===
class IngestResponse(BaseModel):
    status: str
    filename: str
    count: int
    message: str
