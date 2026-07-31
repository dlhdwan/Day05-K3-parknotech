import json
import os
from typing import Optional, List

KC_INDEX_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "kc_index.json")

KC_RANGES_BY_FILE = {
    "day04-prompt-engineering": {
        "KC_PROMPT_STRUCTURE_01": [(10, 10)],
        "KC_ZERO_SHOT_01": [(12, 13)],
        "KC_FEW_SHOT_01": [(14, 15)],
        "KC_COT_01": [(16, 17)],
        "KC_TEMPERATURE_01": [(19, 19)],
        "KC_RAG_01": [(20, 22), (45, 45)],
        "KC_EVALUATION_METRICS_01": [(50, 50)],
    },
    "d2-slide-hackathon": {
        "KC_ATTENTION_01": [(28, 28)],
        "KC_TRANSFORMER_ENCODER_01": [(32, 32)],
    },
}

def _normalize_file_id(file_id: Optional[str]) -> str:
    return (file_id or "").lower().replace(".pdf", "").strip()

def _matches_file_id(requested_file_id: Optional[str], kc_file_id: Optional[str]) -> bool:
    requested = _normalize_file_id(requested_file_id)
    catalog_file = _normalize_file_id(kc_file_id)
    return bool(requested and catalog_file and (requested in catalog_file or catalog_file in requested))

def _load_catalog() -> List[dict]:
    with open(KC_INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_kc_by_id(kc_id: str) -> Optional[dict]:
    for kc in _load_catalog():
        if kc["kc_id"] == kc_id:
            return kc
    return None

def get_kc_by_slide_page(slide_page: int, file_id: Optional[str] = None) -> Optional[dict]:
    catalog = _load_catalog()
    if file_id:
        for kc in catalog:
            if _matches_file_id(file_id, kc.get("file_id")) and slide_page in kc.get("slide_pages", []):
                return kc

    for kc in catalog:
        if slide_page in kc.get("slide_pages", []):
            return kc
    return None

def get_kc_by_file_slide(file_id: Optional[str], slide_page: int) -> Optional[dict]:
    if not file_id:
        return get_kc_by_slide_page(slide_page)

    catalog_match = get_kc_by_slide_page(slide_page, file_id=file_id)
    if catalog_match:
        return catalog_match

    kc_ranges = KC_RANGES_BY_FILE.get(file_id)
    if not kc_ranges:
        return None

    catalog_by_id = {kc["kc_id"]: kc for kc in _load_catalog()}
    for kc_id, ranges in kc_ranges.items():
        if any(start <= slide_page <= end for start, end in ranges):
            return catalog_by_id.get(kc_id)

    return None

def list_all_kcs() -> List[dict]:
    return _load_catalog()
