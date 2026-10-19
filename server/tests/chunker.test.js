import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkPages } from '../src/services/chunker.js';

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

test('short page becomes a single chunk with the right page number', () => {
  const chunks = chunkPages(['hello '.repeat(50)]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].page, 1);
});

test('long page is split, no chunk exceeds the size, and chunks overlap', () => {
  const chunks = chunkPages([words(400)], { size: 100, overlap: 20 });
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.text.split(' ').length <= 100);
  const firstTail = chunks[0].text.split(' ').slice(-20).join(' ');
  assert.ok(chunks[1].text.startsWith(firstTail));
});

test('page numbers follow page order and empty pages are skipped', () => {
  const chunks = chunkPages(['', words(50), words(50)]);
  assert.deepEqual(chunks.map((c) => c.page), [2, 3]);
});

test('every word appears in at least one chunk', () => {
  const chunks = chunkPages([words(333)], { size: 100, overlap: 20 });
  const all = new Set(chunks.flatMap((c) => c.text.split(' ')));
  for (let i = 0; i < 333; i++) assert.ok(all.has(`w${i}`), `missing w${i}`);
});

test('rejects overlap >= size', () => {
  assert.throws(() => chunkPages(['a b c'], { size: 10, overlap: 10 }));
});
