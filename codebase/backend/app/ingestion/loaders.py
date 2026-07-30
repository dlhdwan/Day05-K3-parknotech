import fitz
import json
from typing import List

def load_pdf(pdf_path: str) -> str:
    text = ""
    doc = fitz.open(pdf_path)
    for page in doc:
        text += page.get_text() + "\n"
    return text

def load_transcripts(json_path: str) -> List[dict]:
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)
