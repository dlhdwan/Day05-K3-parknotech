import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

FILE_TITLE_BY_ID = {
    "d1-slide-hackathon": "d1-slide-hackathon.pdf",
    "d2-slide-hackathon": "d2-slide-hackathon.pdf",
    "day03-tu-chatbot": "day03-tu-chatbot-den-agentic-agent-react-v7.pdf",
    "day04-prompt-engineering": "day04-prompt-engineering-tool-calling.pdf",
}


def _candidate_data_roots() -> list[Path]:
    parents = list(Path(__file__).resolve().parents)
    candidates = [Path("/app/data/vlearn-pack")]
    if len(parents) > 3:
        candidates.append(parents[3] / "data" / "vlearn-pack")
    if len(parents) > 4:
        candidates.append(parents[4] / "data" / "vlearn-pack")
    return candidates


def _find_vlearn_pack_dir() -> Optional[Path]:
    for candidate in _candidate_data_roots():
        if candidate.is_dir():
            return candidate
    return None


def _day_number_for_file(file_id: Optional[str], file_title: Optional[str] = None) -> str:
    value = f"{file_id or ''} {file_title or ''}".lower()
    if value.startswith("d1") or "day 01" in value:
        return "01"
    if value.startswith("d2") or "day 02" in value:
        return "02"
    if "day03" in value or "day 03" in value:
        return "03"
    if "day04" in value or "day 04" in value:
        return "04"
    return "00"


@lru_cache(maxsize=128)
def get_slide_context(file_id: str, slide_page: int) -> str:
    file_title = FILE_TITLE_BY_ID.get(file_id)
    if not file_title or not slide_page:
        return ""

    data_root = _find_vlearn_pack_dir()
    if not data_root:
        return ""

    slide_path = data_root / "slides" / file_title
    if not slide_path.is_file():
        return ""

    try:
        import fitz

        with fitz.open(slide_path) as doc:
            page_index = int(slide_page) - 1
            if page_index < 0 or page_index >= len(doc):
                return ""
            text = doc[page_index].get_text().strip()
    except Exception:
        return ""

    if not text:
        return ""

    day_number = _day_number_for_file(file_id, file_title)
    citation = f"[T{day_number}-{int(slide_page):03d}]"
    return f"{citation} Slide {slide_page} from {file_title}:\n{text}"


@lru_cache(maxsize=1)
def _load_transcripts() -> list[dict]:
    candidates = [
        Path(__file__).resolve().parents[1] / "data" / "transcripts.json",
    ]
    data_root = _find_vlearn_pack_dir()
    if data_root:
        candidates.append(data_root / "transcript")

    json_path = candidates[0]
    if json_path.is_file():
        try:
            return json.loads(json_path.read_text(encoding="utf-8"))
        except Exception:
            return []

    return []


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[\wÀ-ỹ]+", value.lower())
        if len(token) >= 4
    }


def search_local_transcripts(query: str, file_id: Optional[str] = None, limit: int = 4) -> list[str]:
    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    day_prefix = f"T{_day_number_for_file(file_id)}-"
    scored = []
    for item in _load_transcripts():
        transcript_id = item.get("transcript_id", "")
        if file_id and day_prefix != "T00-" and not transcript_id.startswith(day_prefix):
            continue
        text = item.get("text", "")
        score = len(query_tokens & _tokens(text))
        if score > 0:
            scored.append((score, transcript_id, text))

    scored.sort(key=lambda row: (-row[0], row[1]))
    return [f"[{tid}] {text}" for _, tid, text in scored[:limit]]


def get_local_transcripts_by_ids(transcript_ids: list[str]) -> list[str]:
    if not transcript_ids:
        return []

    transcript_map = {
        item.get("transcript_id"): item.get("text", "")
        for item in _load_transcripts()
    }
    return [
        f"[{transcript_id}] {transcript_map[transcript_id]}"
        for transcript_id in transcript_ids
        if transcript_id in transcript_map
    ]
