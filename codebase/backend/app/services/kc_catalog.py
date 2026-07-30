import json
import os
from typing import Optional, List

KC_INDEX_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "kc_index.json")

def _load_catalog() -> List[dict]:
    with open(KC_INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_kc_by_id(kc_id: str) -> Optional[dict]:
    for kc in _load_catalog():
        if kc["kc_id"] == kc_id:
            return kc
    return None

def get_kc_by_slide_page(slide_page: int) -> Optional[dict]:
    for kc in _load_catalog():
        if slide_page in kc.get("slide_pages", []):
            return kc
    return None

def list_all_kcs() -> List[dict]:
    return _load_catalog()
