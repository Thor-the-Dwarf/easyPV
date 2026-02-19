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
const configPath = path.join(gameDir, '_data/_gg01_false_friend_falle.json');

describe('False-Friend-Falle Config', () => {
  it('contains sentences with one error word and correction options', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 10, 'expected at least 10 rounds');

    cfg.rounds.forEach((round, index) => {
      assert.ok(typeof round.sentence === 'string' && round.sentence.length > 0, `round ${index + 1}: missing sentence`);
      assert.ok(typeof round.errorWord === 'string' && round.errorWord.length > 0, `round ${index + 1}: missing errorWord`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: expected >=3 options`);
      assert.ok(typeof round.correctOptionId === 'string' && round.correctOptionId.length > 0, `round ${index + 1}: missing correctOptionId`);

      const ids = new Set(round.options.map((opt) => opt.id));
      assert.ok(ids.has(round.correctOptionId), `round ${index + 1}: correctOptionId missing in options`);
    });
  });
});
