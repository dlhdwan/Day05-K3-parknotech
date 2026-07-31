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

  if (quiz.questions.length !== 3) {
    throw new Error('Quiz package must contain exactly 3 questions.');
  }

  quiz.questions.forEach((question, index) => {
    const questionNumber = index + 1;
    if (!question || typeof question.prompt !== 'string' || !question.prompt.trim()) {
      throw new Error(`Question ${questionNumber} is missing a prompt.`);
    }
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`Question ${questionNumber} must include exactly 4 options.`);
    }
    if (!Number.isInteger(question.correct_index) || question.correct_index < 0 || question.correct_index > 3) {
      throw new Error(`Question ${questionNumber} has an invalid correct_index.`);
    }
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) {
      throw new Error(`Question ${questionNumber} is missing an explanation.`);
    }
    if (typeof question.citation !== 'string' || !question.citation.trim()) {
      throw new Error(`Question ${questionNumber} is missing a citation.`);
    }
  });

  return {
    quiz,
    guardrailWarnings: payload.guardrail_warnings || [],
  };
}

export function describeQuizError(message = '') {
  const normalized = String(message).toLowerCase();

  if (
    normalized.includes('api key')
    || normalized.includes('api_key_invalid')
    || normalized.includes('gemini_api_key')
    || normalized.includes('openai_api_key')
    || normalized.includes('llm')
  ) {
    return {
      kind: 'provider',
      title: 'LLM provider configuration error',
      action: 'Check the backend API key/model env, then restart or rebuild the backend service.',
    };
  }

  if (
    normalized.includes('knowledge component')
    || normalized.includes('slide_page')
    || normalized.includes('transcript')
    || normalized.includes('no transcript')
    || normalized.includes('không tìm thấy')
    || normalized.includes('chưa có dữ liệu')
  ) {
    return {
      kind: 'context',
      title: 'Missing learning context',
      action: 'Choose another slide/KC with transcript data, then create the quiz again.',
    };
  }

  return {
    kind: 'unknown',
    title: 'Quiz generation failed',
    action: 'Retry once. If it still fails, review backend diagnostics and model output.',
  };
}
