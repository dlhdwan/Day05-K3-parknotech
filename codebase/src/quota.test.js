import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryStorage,
  getQuotaState,
  recordQuizGeneration,
} from './quota.js';

test('getQuotaState initializes daily quiz quota with defaults', () => {
  const storage = createMemoryStorage();

  assert.deepEqual(getQuotaState(storage, '2026-07-30'), {
    date: '2026-07-30',
    used: 0,
    limit: 15,
    remaining: 15,
    exhausted: false,
  });
});

test('recordQuizGeneration increments used quota and reports exhausted', () => {
  const storage = createMemoryStorage({
    'vlearn.quizQuota.date': '2026-07-30',
    'vlearn.quizQuota.used': '14',
    'vlearn.quizQuota.limit': '15',
  });

  assert.deepEqual(recordQuizGeneration(storage, '2026-07-30'), {
    date: '2026-07-30',
    used: 15,
    limit: 15,
    remaining: 0,
    exhausted: true,
  });
});

test('getQuotaState resets used count on a new day', () => {
  const storage = createMemoryStorage({
    'vlearn.quizQuota.date': '2026-07-29',
    'vlearn.quizQuota.used': '9',
    'vlearn.quizQuota.limit': '15',
  });

  assert.equal(getQuotaState(storage, '2026-07-30').used, 0);
});
