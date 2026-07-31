import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, getSlideUrl } from './api.js';

test('getSlideUrl resolves slide assets from backend static base URL', () => {
  assert.equal(
    getSlideUrl('day04-prompt-engineering-tool-calling.pdf', 'http://backend.test/slides/'),
    'http://backend.test/slides/day04-prompt-engineering-tool-calling.pdf',
  );
});

test('postChat sends short-term history and learning context', async () => {
  const calls = [];
  const client = createApiClient({
    baseUrl: 'http://backend.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ answer: 'OK' }) };
    },
  });

  await client.postChat('Giải thích thêm', {
    history: [{ role: 'assistant', content: 'Transformer dùng attention.' }],
    fileId: 'day-1',
    slidePage: 8,
    selectedText: 'Attention maps tokens to context.',
  });

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.history[0].role, 'assistant');
  assert.equal(body.file_id, 'day-1');
  assert.equal(body.slide_page, 8);
  assert.equal(body.selected_text, 'Attention maps tokens to context.');
});

test('generateQuiz posts selected slide page and returns quiz package', async () => {
  const calls = [];
  const client = createApiClient({
    baseUrl: 'http://backend.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          quiz: {
            kc_id: 'KC_FEW_SHOT_01',
            kc_title: 'Few-shot Prompting',
            questions: [
              { id: 1, prompt: 'Q1?', options: ['A', 'B', 'C', 'D'], correct_index: 0, explanation: 'E1', citation: '[T04-089]' },
              { id: 2, prompt: 'Q2?', options: ['A', 'B', 'C', 'D'], correct_index: 1, explanation: 'E2', citation: '[T04-089]' },
              { id: 3, prompt: 'Q3?', options: ['A', 'B', 'C', 'D'], correct_index: 2, explanation: 'E3', citation: '[T04-089]' },
            ],
          },
          guardrail_warnings: ['length warning'],
        }),
      };
    },
  });

  const data = await client.generateQuiz({
    fileId: 'd1-slide-hackathon',
    slidePage: 14,
    selectedText: 'Few-shot prompting provides examples in the prompt.',
    numQuestions: 10,
    conversationContext: 'VLearn Tutor: Agenda của buổi học.',
  });

  assert.equal(calls[0].url, 'http://backend.test/api/quiz/generate');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.file_id, 'd1-slide-hackathon');
  assert.equal(body.slide_page, 14);
  assert.equal(body.selected_text, 'Few-shot prompting provides examples in the prompt.');
  assert.equal(body.num_questions, 10);
  assert.match(body.conversation_context, /Agenda/);
  assert.equal(data.quiz.kc_id, 'KC_FEW_SHOT_01');
  assert.deepEqual(data.guardrailWarnings, ['length warning']);
});

test('generateQuiz surfaces backend detail on HTTP errors', async () => {
  const client = createApiClient({
    baseUrl: 'http://backend.test',
    fetchImpl: async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Không tìm thấy KC phù hợp' }),
    }),
  });

  await assert.rejects(
    () => client.generateQuiz({ slidePage: 999 }),
    /Không tìm thấy KC phù hợp/,
  );
});

test('generateQuiz surfaces structured backend error details and warnings', async () => {
  const client = createApiClient({
    baseUrl: 'http://backend.test',
    fetchImpl: async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        detail: {
          message: 'Error from LLM: API key not valid.',
          guardrail_warnings: ['Attempt 1: LLM provider error'],
        },
      }),
    }),
  });

  await assert.rejects(
    () => client.generateQuiz({ slidePage: 14 }),
    /API key not valid.*Attempt 1: LLM provider error/s,
  );
});
