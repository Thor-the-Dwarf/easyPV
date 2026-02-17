import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testsDir = path.resolve(unitDir, '..');
const docsDir = path.resolve(testsDir, '..');
const topicDir = path.resolve(docsDir, '..');
const gameDir = topicDir;
const configPath = path.join(gameDir, 'data/_gg01_kultur_gaertner.json');

describe('Kultur-Gaertner Config', () => {
  it('contains valid rounds with one positive and one negative decision', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 4, 'expected at least 4 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.choices), `round ${index + 1}: missing choices array`);
      assert.equal(round.choices.length, 2, `round ${index + 1}: expected exactly 2 choices`);
      const positives = round.choices.filter((c) => Number(c.health_delta) > 0);
      const negatives = round.choices.filter((c) => Number(c.health_delta) < 0);
      assert.equal(positives.length, 1, `round ${index + 1}: expected exactly 1 positive choice`);
      assert.equal(negatives.length, 1, `round ${index + 1}: expected exactly 1 negative choice`);
    }
  });
});
