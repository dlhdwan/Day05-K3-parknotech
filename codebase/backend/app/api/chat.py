import os
import re
import fitz
from fastapi import APIRouter
from app.models.schemas import ChatRequest, ChatResponse
from app.agent.workflow import process_chat_workflow
from app.ingestion.loaders import load_transcripts

router = APIRouter()

def find_slide_text(pdf_filename: str, page_num: int) -> str:
    possible_dirs = [
        "../data/vlearn-pack/slides",
        "../../data/vlearn-pack/slides",
        "app/data/vlearn-pack/slides",
        "data/vlearn-pack/slides",
        "/app/data/vlearn-pack/slides"
    ]
    pdf_path = None
    clean_name = pdf_filename.lower().strip()
    for d in possible_dirs:
        if os.path.exists(d):
            for fname in os.listdir(d):
                if fname.lower() == clean_name or clean_name in fname.lower():
                    pdf_path = os.path.join(d, fname)
                    break
        if pdf_path:
            break

    if not pdf_path or not os.path.exists(pdf_path):
        return None

    try:
        doc = fitz.open(pdf_path)
        if 1 <= page_num <= len(doc):
            page_text = doc[page_num - 1].get_text().strip()
            return page_text if page_text else f"Trang {page_num} của file {os.path.basename(pdf_path)} không chứa văn bản (có thể là sơ đồ/hình ảnh)."
    except Exception:
        pass
    return None

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    result = process_chat_workflow(
        request.query,
        history=[message.model_dump() for message in request.history],
        file_id=request.file_id,
        slide_page=request.slide_page,
    )
    return ChatResponse(
        answer=result["answer"],
        context_retrieved=result["context_retrieved"]
    )

@router.get("/transcript/{transcript_id}")
def get_transcript_endpoint(transcript_id: str):
    raw_id = transcript_id.strip("[]").strip()

    # 1. Check if citation is a Slide reference (e.g. d1-slide-hackathon.pdf - Page 3)
    slide_match = re.search(r'([\w\.-]+\.pdf)\s*(?:-\s*(?:Page\s*)?(\d+))?', raw_id, re.IGNORECASE)
    if slide_match:
        pdf_name = slide_match.group(1)
        page_num = int(slide_match.group(2)) if slide_match.group(2) else 1
        slide_text = find_slide_text(pdf_name, page_num)
        if slide_text:
            return {
                "status": "success",
                "transcript_id": f"[{pdf_name} - Trang {page_num}]",
                "text": slide_text
            }

    # 2. Check transcripts.json for transcript chunk ID (e.g. T04-031)
    json_path = "app/data/transcripts.json"
    transcripts = load_transcripts(json_path)
    clean_id = raw_id.upper()
    for t in transcripts:
        if t.get("transcript_id", "").upper() == clean_id:
            return {"status": "success", "transcript_id": t["transcript_id"], "text": t["text"]}

    return {"status": "not_found", "transcript_id": raw_id, "text": f"Không tìm thấy dữ liệu trích dẫn {raw_id} trong kho bài giảng."}


