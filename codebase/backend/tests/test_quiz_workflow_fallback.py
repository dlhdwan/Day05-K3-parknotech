import unittest

from app.agent.workflow import (
    _build_slide_fallback_kc,
    _should_use_conversation_topic,
)
from app.services.local_content import get_slide_context
from app.services.vector_store import vector_store


class QuizWorkflowFallbackTest(unittest.TestCase):
    def test_system_slide_quiz_prompt_does_not_switch_to_conversation_topic(self):
        self.assertFalse(
            _should_use_conversation_topic(
                "Tạo micro-quiz cho slide 5 trong file d1-slide-hackathon.pdf.",
                "Current file_id: d1-slide-hackathon",
            )
        )

    def test_local_slide_context_builds_dynamic_kc_for_unmapped_day_one_slide(self):
        slide_context = get_slide_context("d1-slide-hackathon", 5)
        self.assertIn("[T01-005]", slide_context)
        self.assertIn("Slide 5", slide_context)

        kc = _build_slide_fallback_kc("d1-slide-hackathon", 5, slide_context)

        self.assertEqual(kc["kc_id"], "KC_DYNAMIC_D1_SLIDE_HACKATHON_S005")
        self.assertTrue(kc["kc_title"])

    def test_transcript_lookup_falls_back_to_local_json_when_qdrant_is_empty(self):
        transcripts = vector_store.get_transcripts_by_ids(["T04-089"])

        self.assertEqual(len(transcripts), 1)
        self.assertIn("[T04-089]", transcripts[0])


if __name__ == "__main__":
    unittest.main()
