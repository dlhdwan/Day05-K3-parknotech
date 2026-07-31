import { normalizeQuizPackage } from './quizUtils.js';

const DEFAULT_API_BASE_URL = '';
const DEFAULT_SLIDES_BASE_URL = 'http://localhost:8000/slides';

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
  if (data?.detail && typeof data.detail === 'object') {
    const messages = [];
    if (typeof data.detail.message === 'string') messages.push(data.detail.message);
    if (typeof data.detail.error === 'string') messages.push(data.detail.error);

    const warnings = data.detail.guardrail_warnings || data.detail.warnings;
    if (Array.isArray(warnings) && warnings.length > 0) {
      messages.push(`Diagnostics: ${warnings.join('; ')}`);
    }

    if (messages.length > 0) return messages.join('\n');
  }
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
    async postChat(query, { history = [], fileId, slidePage, selectedText } = {}) {
      return postJson('/api/chat', {
        query,
        history,
        file_id: fileId,
        slide_page: slidePage,
        selected_text: selectedText,
      });
    },

    async generateQuiz({ fileId, slidePage, kcId, userPrompt, selectedText, numQuestions, conversationContext } = {}) {
      const body = {};
      if (fileId) body.file_id = fileId;
      if (slidePage) body.slide_page = slidePage;
      if (kcId) body.kc_id = kcId;
      if (userPrompt) body.user_prompt = userPrompt;
      if (selectedText) body.selected_text = selectedText;
      if (numQuestions) body.num_questions = numQuestions;
      if (conversationContext) body.conversation_context = conversationContext;

      if (!body.slide_page && !body.kc_id) {
        throw new Error('Cần chọn slide hoặc KC trước khi tạo quiz.');
      }

      return normalizeQuizPackage(await postJson('/api/quiz/generate', body));
    },

    async getTranscript(transcriptId) {
      const cleanId = encodeURIComponent(String(transcriptId).replace(/[\[\]]/g, ''));
      const response = await fetchImpl(`${apiBaseUrl}/api/transcript/${cleanId}`);
      return await readJson(response);
    },
  };
}

export function getSlideUrl(fileTitle, slidesBaseUrl = import.meta.env?.VITE_SLIDES_BASE_URL || DEFAULT_SLIDES_BASE_URL) {
  return `${trimTrailingSlash(slidesBaseUrl)}/${encodeURIComponent(fileTitle)}`;
}

export const apiClient = createApiClient({
  baseUrl: import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
});
