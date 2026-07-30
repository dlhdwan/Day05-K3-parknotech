import fitz
import json
import os
import re
import glob
from typing import List

def load_pdf_slides(pdf_path: str) -> List[dict]:
    doc = fitz.open(pdf_path)
    slides = []
    source_name = os.path.basename(pdf_path)
    for idx, page in enumerate(doc):
        text = page.get_text().strip()
        if text:
            slides.append({
                "page_number": idx + 1,
                "source": source_name,
                "text": text
            })
    return slides

def load_pdf(pdf_path: str) -> str:
    slides = load_pdf_slides(pdf_path)
    return "\n".join(s["text"] for s in slides)

def load_transcripts(json_path: str) -> List[dict]:
    # Nếu file json tồn tại và có nội dung, load từ json
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if data:
                    return data
        except Exception:
            pass

    # Nếu file json trống hoặc không có, tự động quét các file .md trong data/vlearn-pack/transcript
    base_dirs = [
        "../data/vlearn-pack/transcript",
        "../../data/vlearn-pack/transcript",
        "/app/data/vlearn-pack/transcript"
    ]
    
    transcript_dir = None
    for d in base_dirs:
        if os.path.exists(d):
            transcript_dir = d
            break
            
    if not transcript_dir:
        return []

    md_files = sorted(glob.glob(os.path.join(transcript_dir, "transcript-*-clean.md")))
    transcripts = []
    pattern = re.compile(r'\*\*\[(T\d{2}-\d{3})\]\*\*\s*(.+)')

    for md_path in md_files:
        with open(md_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                match = pattern.match(line)
                if match:
                    t_id = match.group(1)
                    text = match.group(2).strip()
                    transcripts.append({
                        "transcript_id": t_id,
                        "text": text
                    })

    # Ghi đè tự động lại vào json_path để lưu cache
    if transcripts and json_path:
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(transcripts, f, ensure_ascii=False, indent=2)

    return transcripts
