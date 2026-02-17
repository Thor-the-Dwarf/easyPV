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
const configPath = path.join(gameDir, 'data/_gg01_promoter_suche.json');

describe('Promoter-Suche Config', () => {
  it('contains valid rounds with exactly one Machtpromoter and one Fachpromoter', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 1, 'expected at least one round');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.profiles), `round ${index + 1}: expected profiles array`);
      assert.ok(round.profiles.length >= 4, `round ${index + 1}: expected at least 4 profiles`);

      const power = round.profiles.filter((p) => p.role === 'macht');
      const expert = round.profiles.filter((p) => p.role === 'fach');
      const ids = new Set(round.profiles.map((p) => p.id));

      assert.equal(power.length, 1, `round ${index + 1}: expected exactly 1 macht profile`);
      assert.equal(expert.length, 1, `round ${index + 1}: expected exactly 1 fach profile`);
      assert.equal(ids.size, round.profiles.length, `round ${index + 1}: profile ids must be unique`);
    }
  });
});
