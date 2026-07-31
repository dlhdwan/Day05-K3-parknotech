import unittest
from unittest.mock import patch

from app.api.chat import chat_endpoint
from app.api.quiz import quiz_generate_endpoint
from app.models.schemas import ChatRequest, QuizGenerateRequest


class SelectionScopeApiTest(unittest.TestCase):
    def test_chat_endpoint_forwards_selected_text(self):
        with patch("app.api.chat.process_chat_workflow") as workflow_mock:
            workflow_mock.return_value = {
                "answer": "OK",
                "context_retrieved": ["[T01-005] Selected context"],
            }

            response = chat_endpoint(
                ChatRequest(
                    query="Giải thích đoạn được chọn.",
                    history=[],
                    file_id="d1-slide-hackathon",
                    slide_page=5,
                    selected_text="AI agents use tool calling.",
                )
            )

        self.assertEqual(response.answer, "OK")
        self.assertEqual(
            workflow_mock.call_args.kwargs["selected_text"],
            "AI agents use tool calling.",
        )

    def test_quiz_endpoint_forwards_selected_text(self):
        with patch("app.api.quiz.process_quiz_workflow") as workflow_mock:
            workflow_mock.return_value = {
                "quiz": {
                    "kc_id": "KC_SELECTION_D1_SLIDE_HACKATHON_S005",
                    "kc_title": "Selected quiz",
                    "questions": [
                        {
                            "id": 1,
                            "prompt": "Q?",
                            "options": ["A", "B", "C", "D"],
                            "correct_index": 0,
                            "explanation": "E",
                            "citation": "[T01-005]",
                        }
                    ],
                },
                "guardrail_warnings": [],
            }

            response = quiz_generate_endpoint(
                QuizGenerateRequest(
                    file_id="d1-slide-hackathon",
                    slide_page=5,
                    selected_text="AI agents use tool calling.",
                    user_prompt="Tạo quiz từ đoạn được chọn.",
                    num_questions=1,
                )
            )

        self.assertEqual(response.quiz.kc_id, "KC_SELECTION_D1_SLIDE_HACKATHON_S005")
        self.assertEqual(
            workflow_mock.call_args.kwargs["selected_text"],
            "AI agents use tool calling.",
        )


if __name__ == "__main__":
    unittest.main()
