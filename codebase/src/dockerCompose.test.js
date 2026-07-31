import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('frontend compose startup syncs dependencies before Vite dev server', () => {
  const compose = readFileSync(new URL('../../docker-compose.yml', import.meta.url), 'utf8');
  const frontendBlock = compose.match(/^\s{2}frontend:\n(?<body>(?:^\s{4}.*\n?)*)/m)?.groups?.body || '';

  assert.match(frontendBlock, /-\s+\/app\/node_modules/);
  assert.match(frontendBlock, /command:\s+.*npm ci.*npm run dev/s);
});
