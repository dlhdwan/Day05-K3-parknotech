import test from 'node:test';
import assert from 'node:assert/strict';
import { getKnowledgeComponentForPage } from './courseContent.js';

test('getKnowledgeComponentForPage resolves KC within the selected file page range', () => {
  const kc = getKnowledgeComponentForPage('day04-prompt-engineering', 14);

  assert.equal(kc.kcId, 'KC_FEW_SHOT_01');
  assert.equal(kc.title, 'Few-shot Prompting');
});

test('getKnowledgeComponentForPage keeps same slide number scoped by file', () => {
  const kc = getKnowledgeComponentForPage('d1-slide-hackathon', 14);

  assert.equal(kc, null);
});

test('getKnowledgeComponentForPage returns null for unmapped files or pages', () => {
  assert.equal(getKnowledgeComponentForPage('unknown-file', 14), null);
  assert.equal(getKnowledgeComponentForPage('d1-slide-hackathon', 5), null);
});
