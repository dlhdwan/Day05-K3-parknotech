from typing import List, Tuple


def check_option_length_ratio(questions: List[dict], threshold: float = 2.2) -> Tuple[bool, List[str]]:
    """
    Kiểm tra Option Length Ratio cho từng câu hỏi.
    Length Ratio = max(len) / min(len)
    Trả về (passed, warnings)
    """
    warnings = []
    passed = True

    for q in questions:
        options = q.get("options", [])
        if len(options) != 4:
            warnings.append(f"Q{q.get('id', '?')}: Số lượng options != 4")
            passed = False
            continue

        lengths = [len(opt) for opt in options]
        min_len = min(lengths)
        max_len = max(lengths)

        if min_len == 0:
            warnings.append(f"Q{q.get('id', '?')}: Có option rỗng")
            passed = False
            continue

        ratio = max_len / min_len
        if ratio > threshold:
            warnings.append(
                f"Q{q.get('id', '?')}: Option Length Ratio = {ratio:.2f} > {threshold} "
                f"(lengths: {lengths})"
            )
            passed = False

    return passed, warnings


def validate_quiz_schema(quiz_data: dict, num_questions: int = 3) -> Tuple[bool, List[str]]:
    """
    Kiểm tra quiz JSON có đúng schema không.
    Nếu JSON trả về là một thông báo từ chối (có trường "error"), coi như PASS.
    """
    if "error" in quiz_data and len(quiz_data) == 1:
        return True, []

    warnings = []

    if "kc_id" not in quiz_data:
        warnings.append("Missing 'kc_id'")
    if "kc_title" not in quiz_data:
        warnings.append("Missing 'kc_title'")

    questions = quiz_data.get("questions", [])
    if not questions or len(questions) == 0:
        warnings.append("Expected at least 1 question, got 0")
    elif len(questions) != num_questions:
        warnings.append(f"Expected exactly {num_questions} questions, got {len(questions)}")

    for q in questions:
        required_fields = ["id", "prompt", "options", "correct_index", "explanation", "citation"]
        for field in required_fields:
            if field not in q:
                warnings.append(f"Q{q.get('id', '?')}: Missing field '{field}'")

        correct_idx = q.get("correct_index")
        if correct_idx is not None and (correct_idx < 0 or correct_idx > 3):
            warnings.append(f"Q{q.get('id', '?')}: correct_index {correct_idx} out of range 0-3")

    passed = len(warnings) == 0
    return passed, warnings


import re

def check_citation_format(quiz_data: dict) -> Tuple[bool, List[str]]:
    """
    Kiểm tra xem citation có sử dụng đúng định dạng [Txx-NNN] hay không (tránh dùng KC_...).
    """
    if "error" in quiz_data:
        return True, []
        
    warnings = []
    questions = quiz_data.get("questions", [])
    for q in questions:
        citation = str(q.get("citation", ""))
        explanation = str(q.get("explanation", ""))
        
        if citation.startswith("KC_") or "KC_" in citation:
            warnings.append(f"Q{q.get('id', '?')}: Citation field relies on KC ID '{citation}' instead of transcript ID [Txx-NNN]")
            
        if not re.search(r'T\d{2}-\d{3}', citation) and not re.search(r'T\d{2}-\d{3}', explanation):
            warnings.append(f"Q{q.get('id', '?')}: Missing valid transcript citation format [Txx-NNN]")
            
    passed = len(warnings) == 0
    return passed, warnings


def check_forbidden_keywords(text: str, forbidden_words: List[str]) -> Tuple[bool, List[str]]:
    warnings = []
    text_lower = text.lower()
    for word in forbidden_words:
        if word.lower() in text_lower:
            warnings.append(f"Found forbidden keyword: '{word}'")
    passed = len(warnings) == 0
    return passed, warnings
