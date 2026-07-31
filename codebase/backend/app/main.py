from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.chat import router as chat_router
from app.api.quiz import router as quiz_router
from app.api.ingest import router as ingest_router
from app.core.config import settings

app = FastAPI(title="VLearn RAG Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(ingest_router, prefix="/api")


def _resolve_slides_dir() -> Path | None:
    candidates = []
    if settings.SLIDES_DIR:
        candidates.append(Path(settings.SLIDES_DIR))

    parents = list(Path(__file__).resolve().parents)
    if len(parents) > 1:
        candidates.append(parents[1] / "data" / "vlearn-pack" / "slides")
    if len(parents) > 3:
        candidates.append(parents[3] / "data" / "vlearn-pack" / "slides")
    candidates.append(Path("/app/data/vlearn-pack/slides"))

    for candidate in candidates:
        if candidate.is_dir():
            return candidate

    return None


slides_dir = _resolve_slides_dir()
if slides_dir:
    app.mount("/slides", StaticFiles(directory=str(slides_dir)), name="slides")
