import json
import unittest
from unittest.mock import patch

from app.agent import workflow


def _quiz_json(kc_id="KC_SELECTION_SCOPE"):
    return json.dumps(
        {
            "kc_id": kc_id,
            "kc_title": "Selected scope quiz",
            "questions": [
                {
                    "id": 1,
                    "prompt": "What does the selected passage describe?",
                    "options": ["A", "B", "C", "D"],
                    "correct_index": 0,
                    "explanation": "Grounded in the selected passage.",
                    "citation": "[T01-005]",
                }
            ],
        }
    )


class SelectionScopeWorkflowTest(unittest.TestCase):
    def test_selected_text_quiz_scope_is_added_to_prompt_without_reject_guard(self):
        selected_text = "AI agents use tool calling to interact with external systems."
        captured_prompts = []

        def fake_generate(prompt):
            captured_prompts.append(prompt)
            return _quiz_json()

        with (
            patch.object(workflow.llm_service, "generate", side_effect=fake_generate),
            patch.object(
                workflow,
                "retrieve_context_tool",
                return_value="[T01-005] AI agents use tool calling to interact with external systems.",
            ) as retrieve_mock,
        ):
            result = workflow.process_quiz_workflow(
                file_id="d1-slide-hackathon",
                slide_page=5,
                selected_text=selected_text,
                user_prompt="Tạo quiz từ đoạn được chọn.",
                num_questions=1,
                max_retries=0,
            )

        self.assertIn("quiz", result)
        self.assertEqual(result["quiz"]["questions"][0]["citation"], "[T01-005]")
        self.assertIn(selected_text, retrieve_mock.call_args.args[0])
        self.assertIn("Selected Text Scope", captured_prompts[0])
        self.assertIn(selected_text, captured_prompts[0])
        self.assertNotIn("completely out of scope", captured_prompts[0])

    def test_selected_text_chat_scope_is_sent_to_retrieval_and_prompt(self):
        selected_text = "RAG retrieves evidence before answering."
        captured_prompts = []

        def fake_generate(prompt):
            captured_prompts.append(prompt)
            return "RAG trả lời dựa trên bằng chứng được truy xuất."

        with (
            patch.object(workflow.llm_service, "generate", side_effect=fake_generate),
            patch.object(
                workflow,
                "retrieve_context_tool",
                return_value="[T04-089] RAG retrieves evidence before answering.",
            ) as retrieve_mock,
        ):
            result = workflow.process_chat_workflow(
                "Giải thích đoạn được chọn.",
                history=[],
                file_id="day04-prompt-engineering",
                slide_page=89,
                selected_text=selected_text,
            )

        self.assertIn("RAG", result["answer"])
        self.assertIn(selected_text, retrieve_mock.call_args.args[0])
        self.assertIn("Selected Text Scope", captured_prompts[0])
        self.assertIn(selected_text, captured_prompts[0])


if __name__ == "__main__":
    unittest.main()
