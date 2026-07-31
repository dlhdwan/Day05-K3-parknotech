import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSelectionAskPrompt,
  buildSelectionQuizPrompt,
  createSelectionToolbarState,
  selectionToolbarActions,
} from './selectionToolbar.js';

test('createSelectionToolbarState positions toolbar above non-empty selected text', () => {
  const state = createSelectionToolbarState({
    text: 'Few-shot prompting',
    rect: { top: 120, left: 40, width: 160 },
    isInsideViewer: true,
  });

  assert.deepEqual(state, {
    text: 'Few-shot prompting',
    top: 75,
    left: 120,
  });
});

test('createSelectionToolbarState ignores empty or outside selections', () => {
  assert.equal(createSelectionToolbarState({ text: ' ', rect: { top: 0, left: 0, width: 0 }, isInsideViewer: true }), null);
  assert.equal(createSelectionToolbarState({ text: 'Prompt', rect: { top: 0, left: 0, width: 0 }, isInsideViewer: false }), null);
});

test('selectionToolbarActions exposes actionable toolbar metadata', () => {
  assert.deepEqual(
    selectionToolbarActions.map((action) => action.id),
    ['ask-ai', 'generate-quiz'],
  );
  assert.ok(selectionToolbarActions.every((action) => !action.uiOnly));
});

test('buildSelectionQuizPrompt scopes quiz generation to selected text', () => {
  const prompt = buildSelectionQuizPrompt('AI agent uses tool calling to act.');

  assert.match(prompt, /đoạn được chọn/i);
  assert.match(prompt, /AI agent uses tool calling to act\./);
  assert.match(prompt, /không mở rộng/i);
});

test('buildSelectionAskPrompt asks AI to explain selected text in current lesson', () => {
  const prompt = buildSelectionAskPrompt('Retrieval augmented generation grounds answers.');

  assert.match(prompt, /giải thích/i);
  assert.match(prompt, /Retrieval augmented generation grounds answers\./);
  assert.match(prompt, /bài học hiện tại/i);
});
