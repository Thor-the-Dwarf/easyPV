import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testsDir = path.resolve(unitDir, '..');
const docsDir = path.resolve(testsDir, '..');
const gameDir = path.resolve(docsDir, '..');
const configPath = path.join(gameDir, '_data/_gg01_it_vocab_sprint.json');

describe('IT-Vocab-Sprint Config', () => {
  it('contains 20 rounds, 4 options per round and a 120s timer', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length === 20, 'expected exactly 20 rounds');
    assert.equal(Number(cfg.timing && cfg.timing.total_ms), 120000, 'expected 120000ms total timer');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');

    cfg.rounds.forEach((round, index) => {
      assert.ok(typeof round.en === 'string' && round.en.length > 0, `round ${index + 1}: missing en term`);
      assert.ok(Array.isArray(round.options) && round.options.length === 4, `round ${index + 1}: expected exactly 4 options`);
      assert.ok(typeof round.correctOptionId === 'string' && round.correctOptionId.length > 0, `round ${index + 1}: missing correctOptionId`);

      const ids = new Set(round.options.map((opt) => opt.id));
      assert.ok(ids.has(round.correctOptionId), `round ${index + 1}: correctOptionId missing in options`);
    });
  });
});
