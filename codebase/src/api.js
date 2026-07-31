import { normalizeQuizPackage } from './quizUtils.js';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function toErrorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.error === 'string') return data.error;
  return fallback;
}

export function createApiClient({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiBaseUrl = trimTrailingSlash(baseUrl || DEFAULT_API_BASE_URL);

  async function postJson(path, body) {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(toErrorMessage(data, `Backend trả lỗi HTTP ${response.status}`));
    }

    return data;
  }

  return {
    async postChat(query, { history = [], fileId, slidePage } = {}) {
      return postJson('/api/chat', {
        query,
        history,
        file_id: fileId,
        slide_page: slidePage,
      });
    },

    async generateQuiz({ slidePage, fileId, kcId, userPrompt, numQuestions, conversationContext } = {}) {
      const body = {};
      if (slidePage) body.slide_page = slidePage;
      if (fileId) body.file_id = fileId;
      if (kcId) body.kc_id = kcId;
      if (userPrompt) body.user_prompt = userPrompt;
      if (numQuestions) body.num_questions = numQuestions;
      if (conversationContext) body.conversation_context = conversationContext;

      if (!body.slide_page && !body.kc_id) {
        throw new Error('Cần chọn slide hoặc KC trước khi tạo quiz.');
      }

      return normalizeQuizPackage(await postJson('/api/quiz/generate', body));
    },
  };
}

export const apiClient = createApiClient({
  baseUrl: import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
});
