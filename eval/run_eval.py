import json
import os
import requests
import time
from typing import Dict, Any

# Cấu hình
GOLDEN_SET_PATH = os.path.join(os.path.dirname(__file__), "golden_set.json")
RESULTS_PATH = os.path.join(os.path.dirname(__file__), "eval_results.json")
QUIZ_API_URL = "http://localhost:8000/api/quiz/generate"
CHAT_API_URL = "http://localhost:8000/api/chat"

def check_option_length_ratio(quiz_data: dict, max_ratio: float) -> bool:
    questions = quiz_data.get("questions", [])
    for q in questions:
        options = q.get("options", [])
        if len(options) != 4:
            return False
        lengths = [len(opt) for opt in options]
        min_len, max_len = min(lengths), max(lengths)
        if min_len == 0 or (max_len / min_len) > max_ratio:
            return False
    return True

def run_evaluation():
    print(f"Loading golden set from {GOLDEN_SET_PATH}...")
    with open(GOLDEN_SET_PATH, 'r', encoding='utf-8') as f:
        golden_set = json.load(f)

    results = []
    total_tests = len(golden_set)
    passed_tests = 0

    print(f"Bắt đầu đánh giá {total_tests} test cases...")

    for idx, tc in enumerate(golden_set):
        test_id = tc.get("test_id", f"TC_UNKNOWN_{idx}")
        print(f"\n--- Đang chạy {test_id}: {tc.get('category')} ---")
        
        input_data = tc.get("input", {})
        expected = tc.get("expected_output", {})
        
        slide_page = input_data.get("slide_page")
        kc_id = input_data.get("kc_id")
        user_prompt = input_data.get("user_prompt")
        
        # 1. Chạy API
        # Vì test case có user_prompt và yêu cầu schema quiz, ta sẽ call cả Chat và Quiz API để kiểm tra toàn diện
        quiz_resp, chat_resp = None, None
        
        try:
            res_quiz = requests.post(QUIZ_API_URL, json={"slide_page": slide_page, "kc_id": kc_id}, timeout=30)
            quiz_resp = res_quiz.json() if res_quiz.status_code == 200 else {"error": res_quiz.text}
        except Exception as e:
            quiz_resp = {"error": str(e)}

        try:
            res_chat = requests.post(CHAT_API_URL, json={"query": user_prompt}, timeout=30)
            chat_resp = res_chat.json() if res_chat.status_code == 200 else {"error": res_chat.text}
        except Exception as e:
            chat_resp = {"error": str(e)}

        # 2. Đánh giá kết quả
        eval_result = {
            "test_id": test_id,
            "status": "PASS",
            "failures": [],
            "quiz_response": quiz_resp,
            "chat_response": chat_resp
        }

        # A. Schema Check (Quiz)
        if expected.get("must_pass_schema"):
            if "quiz" not in quiz_resp or "error" in quiz_resp:
                eval_result["failures"].append("Schema validation failed (Missing quiz payload or API error)")
        
        # B. Option Length Ratio (Quiz)
        if "option_length_ratio_max" in expected and "quiz" in quiz_resp:
            ratio_passed = check_option_length_ratio(quiz_resp["quiz"], expected["option_length_ratio_max"])
            if not ratio_passed:
                eval_result["failures"].append(f"Option Length Ratio vượt quá {expected['option_length_ratio_max']}")

        # C. Required Citation (Check both Quiz & Chat)
        required_citation = expected.get("required_citation")
        if required_citation:
            citation_found = False
            # Check trong Quiz
            if "quiz" in quiz_resp:
                for q in quiz_resp["quiz"].get("questions", []):
                    if required_citation in q.get("explanation", "") or required_citation == q.get("citation"):
                        citation_found = True
                        break
            # Check trong Chat
            if chat_resp and "answer" in chat_resp:
                if required_citation in chat_resp["answer"]:
                    citation_found = True
            
            if not citation_found:
                eval_result["failures"].append(f"Missing required citation: {required_citation}")

        # D. Forbidden Keywords
        forbidden = expected.get("forbidden_keywords", [])
        for word in forbidden:
            # Check Quiz
            if "quiz" in quiz_resp:
                quiz_str = json.dumps(quiz_resp["quiz"], ensure_ascii=False).lower()
                if word.lower() in quiz_str:
                    eval_result["failures"].append(f"Found forbidden keyword in Quiz: {word}")
            # Check Chat
            if chat_resp and "answer" in chat_resp:
                if word.lower() in chat_resp["answer"].lower():
                    eval_result["failures"].append(f"Found forbidden keyword in Chat: {word}")

        if eval_result["failures"]:
            eval_result["status"] = "FAIL"
            print(f"❌ {test_id} FAILED:")
            for f in eval_result["failures"]:
                print(f"  - {f}")
        else:
            passed_tests += 1
            print(f"✅ {test_id} PASSED")

        results.append(eval_result)
        time.sleep(1) # Rate limit

    # Tổng kết
    print("\n==============================")
    print(f"EVALUATION SUMMARY: {passed_tests}/{total_tests} PASSED")
    print("==============================")

    # Lưu kết quả
    with open(RESULTS_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Đã lưu kết quả chi tiết tại {RESULTS_PATH}")

if __name__ == "__main__":
    run_evaluation()
