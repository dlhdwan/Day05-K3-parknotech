import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('backend does not instantiate embedding models during app import', () => {
  const embeddingSource = readFileSync(
    new URL('../backend/app/services/embedding.py', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(embeddingSource, /^embedding_service\s*=\s*EmbeddingService\(\)/m);
  assert.match(embeddingSource, /def get_embedding_service\(\):/);
});

test('backend LLM client initializes lazily when generation is requested', () => {
  const llmSource = readFileSync(
    new URL('../backend/app/services/llm.py', import.meta.url),
    'utf8',
  );
  const initBody = llmSource.match(/def __init__\(self\):(?<body>[\s\S]*?)\n    def /)?.groups?.body || '';

  assert.doesNotMatch(initBody, /self\._init_(gemini|openai)\(\)/);
  assert.match(llmSource, /def _ensure_client\(self\) -> None:/);
});
