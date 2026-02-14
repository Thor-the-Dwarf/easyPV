import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testingDir = path.resolve(unitDir, '..');
const topicDir = path.dirname(testingDir);
const doingDir = path.join(topicDir, '__02_doing_Change Management');
const configPath = path.join(doingDir, '_g01_widerstands_baendiger.json');

describe('Widerstands-Baendiger Config', () => {
  it('contains rounds with exactly one correct option', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 4, 'expected at least 4 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: expected >= 3 options`);
      const correct = round.options.filter((o) => o.correct === true);
      assert.equal(correct.length, 1, `round ${index + 1}: expected exactly one correct option`);
    }
  });
});
