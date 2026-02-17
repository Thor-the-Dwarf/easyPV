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
const configPath = path.join(gameDir, 'data/_gg01_kommunikations_kaskade.json');

describe('Kommunikations-Kaskade Config', () => {
  it('contains rounds with exactly one correct communication choice', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 4, 'expected at least 4 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.choices) && round.choices.length >= 3, `round ${index + 1}: expected >= 3 choices`);
      const correct = round.choices.filter((choice) => choice.correct === true);
      assert.equal(correct.length, 1, `round ${index + 1}: expected exactly one correct choice`);
    }
  });
});
