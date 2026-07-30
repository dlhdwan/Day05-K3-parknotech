import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuizResult } from './quizUtils.js';

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
