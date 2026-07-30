import fitz
import json
import re
import os
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import IngestResponse
from app.services.vector_store import vector_store

router = APIRouter()

@router.post("/ingest/slide", response_model=IngestResponse)
async def ingest_slide_endpoint(file: UploadFile = File(...)):
    """
    POST /api/ingest/slide
    Upload 1 file PDF Slide mới, trích xuất từng trang và nạp vào Qdrant.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File tải lên phải có định dạng PDF (.pdf)")

    contents = await file.read()
    try:
        doc = fitz.open(stream=contents, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể đọc file PDF: {str(e)}")

    slides = []
    source_name = file.filename
    for idx, page in enumerate(doc):
        text = page.get_text().strip()
        if text:
            slides.append({
                "page_number": idx + 1,
                "source": source_name,
                "text": text
            })

    if not slides:
        raise HTTPException(status_code=400, detail="File PDF không chứa văn bản nào.")

    vector_store.upsert_slides(slides)

    return IngestResponse(
        status="success",
        filename=source_name,
        count=len(slides),
        message=f"Đã nạp thành công {len(slides)} trang Slide từ {source_name} vào Vector DB."
    )


@router.post("/ingest/transcript", response_model=IngestResponse)
async def ingest_transcript_endpoint(file: UploadFile = File(...)):
    """
    POST /api/ingest/transcript
    Upload 1 file Markdown (.md) hoặc JSON chứa trích đoạn Transcript giảng viên và nạp vào Qdrant.
    """
    contents = await file.read()
    filename = file.filename
    transcripts = []

    if filename.endswith(".md"):
        content_str = contents.decode("utf-8", errors="ignore")
        pattern = re.compile(r'\*\*\[(T\d{2}-\d{3})\]\*\*\s*(.+)')
        for line in content_str.splitlines():
            line = line.strip()
            match = pattern.match(line)
            if match:
                transcripts.append({
                    "transcript_id": match.group(1),
                    "text": match.group(2).strip()
                })
    elif filename.endswith(".json"):
        try:
            data = json.loads(contents.decode("utf-8", errors="ignore"))
            if isinstance(data, list):
                for item in data:
                    if "transcript_id" in item and "text" in item:
                        transcripts.append({
                            "transcript_id": item["transcript_id"],
                            "text": item["text"]
                        })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"File JSON không hợp lệ: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="File tải lên phải có định dạng .md hoặc .json")

    if not transcripts:
        raise HTTPException(status_code=400, detail="Không tìm thấy trích đoạn Transcript hợp lệ (cần định dạng **[Txx-NNN]** hoặc JSON list).")

    vector_store.upsert_transcripts(transcripts)

    # Cập nhật cache local app/data/transcripts.json
    cache_path = "app/data/transcripts.json"
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
            existing_map = {t["transcript_id"]: t["text"] for t in existing}
            for t in transcripts:
                existing_map[t["transcript_id"]] = t["text"]
            merged = [{"transcript_id": tid, "text": txt} for tid, txt in existing_map.items()]
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(merged, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    return IngestResponse(
        status="success",
        filename=filename,
        count=len(transcripts),
        message=f"Đã nạp thành công {len(transcripts)} đoạn Transcript từ {filename} vào Vector DB."
    )
