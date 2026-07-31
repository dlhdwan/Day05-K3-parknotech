import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateQuizResult,
  describeQuizError,
  extractRequestedQuestionCount,
  normalizeQuizPackage,
  shouldAppendCitation,
} from './quizUtils.js';

test('extractRequestedQuestionCount understands Vietnamese quiz requests', () => {
  assert.equal(extractRequestedQuestionCount('tạo 10 câu hỏi về phần đấy đi'), 10);
  assert.equal(extractRequestedQuestionCount('cho tôi 20 câu'), 15);
  assert.equal(extractRequestedQuestionCount('tạo quiz ôn tập'), 3);
});

test('shouldAppendCitation avoids duplicate references in explanations', () => {
  assert.equal(
    shouldAppendCitation('Level 1 có thể gọi tools [T04-071].', '[T04-071]'),
    false,
  );
  assert.equal(
    shouldAppendCitation('Level 1 có thể gọi tools.', '[T04-071]'),
    true,
  );
  assert.equal(shouldAppendCitation('Nội dung.', ''), false);
});
test('calculateQuizResult counts correct answers and percent locally', () => {
  const questions = [
    { correct_index: 1 },
    { correct_index: 0 },
    { correct_index: 2 },
  ];
  const answers = { 0: 1, 1: 3, 2: 2 };

  assert.deepEqual(calculateQuizResult(questions, answers), {
    score: 2,
    total: 3,
    percent: 67,
  });
});

test('calculateQuizResult treats unanswered questions as incorrect', () => {
  const questions = [{ correct_index: 0 }, { correct_index: 2 }];

  assert.deepEqual(calculateQuizResult(questions, { 0: 0 }), {
    score: 1,
    total: 2,
    percent: 50,
  });
});

test('normalizeQuizPackage rejects quiz packages with invalid question options', () => {
  assert.throws(
    () => normalizeQuizPackage({
      quiz: {
        kc_id: 'KC_FEW_SHOT_01',
        kc_title: 'Few-shot Prompting',
        questions: [
          { id: 1, prompt: 'Q?', options: ['A', 'B'], correct_index: 0, explanation: 'E', citation: '[T04-089]' },
          { id: 2, prompt: 'Q?', options: ['A', 'B', 'C', 'D'], correct_index: 1, explanation: 'E', citation: '[T04-089]' },
          { id: 3, prompt: 'Q?', options: ['A', 'B', 'C', 'D'], correct_index: 2, explanation: 'E', citation: '[T04-089]' },
        ],
      },
    }),
    /4 options/,
  );
});

test('describeQuizError classifies provider configuration errors', () => {
  const result = describeQuizError('Error from LLM: API key not valid.');

  assert.equal(result.kind, 'provider');
  assert.match(result.title, /provider/i);
});

test('describeQuizError classifies missing learning context errors', () => {
  const result = describeQuizError('Không tìm thấy Knowledge Component cho slide_page=999');

  assert.equal(result.kind, 'context');
  assert.match(result.action, /slide/i);
});
