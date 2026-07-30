#!/usr/bin/env python3
"""Reproducible CP1 mining for the anonymized VLearn tutor chatlog."""

import csv
import json
import re
from collections import Counter
from pathlib import Path
from statistics import median


DATA = Path(__file__).parents[1] / "data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv"
PAGE_RE = re.compile(r"\(Trang\s+(\d+)", re.IGNORECASE)
SPACE_RE = re.compile(r"\s+")
RETRIEVAL_FAILURE_RE = re.compile(
    r"không (?:thể )?(?:tìm thấy|truy cập|truy xuất)|không có dữ liệu|"
    r"không bao gồm trang|không hiển thị|chưa tìm thấy",
    re.IGNORECASE,
)


def compact(text: str) -> str:
    return SPACE_RE.sub(" ", text).strip()


with DATA.open(encoding="utf-8", newline="") as source:
    rows = list(csv.DictReader(source))

turns = {}
for row in rows:
    turns.setdefault(row["turn_id"], {})[row["role"]] = row

pairs = [
    (turn_id, messages["student"], messages["tutor"])
    for turn_id, messages in turns.items()
    if "student" in messages and "tutor" in messages
]

page_anchored = []
for turn_id, student, tutor in pairs:
    page_match = PAGE_RE.search(student["content"])
    if not page_match:
        continue
    selected_page = int(page_match.group(1))
    citations = json.loads(tutor["citations"] or "[]")
    page_anchored.append((turn_id, student, tutor, selected_page, citations))

no_citation = [item for item in page_anchored if not item[4]]
wrong_page_only = [
    item for item in page_anchored if item[4] and item[3] not in item[4]
]
exact_page = [item for item in page_anchored if item[3] in item[4]]
unverifiable = no_citation + wrong_page_only
retrieval_failures = [
    item for item in page_anchored if RETRIEVAL_FAILURE_RE.search(item[2]["content"])
]

short_prompts = [
    (turn_id, student, tutor)
    for turn_id, student, tutor in pairs
    if len(compact(student["content"])) <= 80
]

print("CP1 VLearn mining summary")
print(f"All turns: {len(pairs)}; users: {len({s['user_id'] for _, s, _ in pairs})}")
print(
    f"Page-anchored turns: {len(page_anchored)}; "
    f"users: {len({s['user_id'] for _, s, _, _, _ in page_anchored})}"
)
print(
    f"No citation: {len(no_citation)} "
    f"({len(no_citation) / len(page_anchored):.1%})"
)
print(
    f"Cites other page(s), not selected page: {len(wrong_page_only)} "
    f"({len(wrong_page_only) / len(page_anchored):.1%})"
)
print(
    f"No verifiable citation to selected page: {len(unverifiable)} "
    f"({len(unverifiable) / len(page_anchored):.1%}); "
    f"users: {len({s['user_id'] for _, s, _, _, _ in unverifiable})}"
)
print(
    f"Exact selected-page citation present: {len(exact_page)} "
    f"({len(exact_page) / len(page_anchored):.1%})"
)
print(
    f"Retrieval-failure wording in page-anchored turns: {len(retrieval_failures)} "
    f"({len(retrieval_failures) / len(page_anchored):.1%})"
)
print(
    f"Tutor asked a check question: "
    f"{sum(t['asked_check_question'].lower() == 'true' for _, _, t in pairs)}/{len(pairs)}"
)
print(
    f"Short prompts (<=80 chars): {len(short_prompts)}; "
    f"median tutor response: {median(len(compact(t['content'])) for _, _, t in short_prompts):.0f} chars; "
    f">500-char response: {sum(len(compact(t['content'])) > 500 for _, _, t in short_prompts)}"
)
print("Moves:", dict(Counter(t["move_used"] or "(blank)" for _, _, t in pairs)))

print("\nExamples: no verifiable citation to selected page")
preferred_ids = ["T0397", "T1084", "T1211", "T1023", "T1258", "T0157"]
by_id = {item[0]: item for item in unverifiable}
for turn_id in preferred_ids:
    if turn_id not in by_id:
        continue
    _, student, tutor, selected_page, citations = by_id[turn_id]
    print(f"\n{turn_id} / {student['conversation_id']} / selected={selected_page} / citations={citations}")
    print("Student:", compact(student["content"])[:260])
    print("Tutor:", compact(tutor["content"])[:420])
