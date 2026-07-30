export function calculateQuizResult(questions, answers) {
  const total = questions.length;
  const score = questions.reduce((count, question, index) => {
    return count + (answers[index] === question.correct_index ? 1 : 0);
  }, 0);

  return {
    score,
    total,
    percent: total === 0 ? 0 : Math.round((score / total) * 100),
  };
}

export function extractRequestedQuestionCount(text, fallback = 3) {
  if (!text) return fallback;

  const match = text.match(/(?:tạo|tao|làm|lam|cho|muốn|muon)?\s*(\d{1,2})\s*(?:câu|cau|questions?)/i)
    || text.match(/(?:câu|cau|questions?)\s*(?:hỏi|hoi)?\s*(\d{1,2})/i);
  if (!match) return fallback;

  return Math.min(15, Math.max(1, Number(match[1])));
}

export function shouldAppendCitation(explanation, citation) {
  if (!citation?.trim()) return false;
  return !String(explanation || '').includes(citation.trim());
}

export function normalizeQuizPackage(payload) {
  const quiz = payload?.quiz;
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error('Backend không trả về gói quiz hợp lệ.');
  }

  return {
    quiz,
    guardrailWarnings: payload.guardrail_warnings || [],
  };
}
