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
