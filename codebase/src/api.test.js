import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from './api.js';

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
  });

  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.history[0].role, 'assistant');
  assert.equal(body.file_id, 'day-1');
  assert.equal(body.slide_page, 8);
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
            questions: [{ id: 1, prompt: 'Q?', options: ['A', 'B', 'C', 'D'], correct_index: 0, explanation: 'E', citation: '[T04-089]' }],
          },
          guardrail_warnings: ['length warning'],
        }),
      };
    },
  });

  const data = await client.generateQuiz({
    slidePage: 14,
    numQuestions: 10,
    conversationContext: 'VLearn Tutor: Agenda của buổi học.',
  });

  assert.equal(calls[0].url, 'http://backend.test/api/quiz/generate');
  assert.equal(JSON.parse(calls[0].options.body).slide_page, 14);
  assert.equal(JSON.parse(calls[0].options.body).num_questions, 10);
  assert.match(JSON.parse(calls[0].options.body).conversation_context, /Agenda/);
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
