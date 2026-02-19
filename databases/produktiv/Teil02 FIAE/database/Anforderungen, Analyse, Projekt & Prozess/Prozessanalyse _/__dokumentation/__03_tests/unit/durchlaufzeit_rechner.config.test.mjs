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
const configPath = path.join(gameDir, '_data/_gg01_durchlaufzeit_rechner.json');

describe('Durchlaufzeit-Rechner Config', () => {
  it('contains rounds with valid options and totals', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.scenario === 'string' && round.scenario.length > 0, `round ${index + 1}: missing scenario`);
      assert.ok(Array.isArray(round.steps) && round.steps.length >= 2, `round ${index + 1}: missing steps`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: missing options`);
      assert.ok(typeof round.correct_total === 'string' && round.correct_total.length > 0, `round ${index + 1}: missing correct_total`);
      assert.ok(round.options.includes(round.correct_total), `round ${index + 1}: correct_total not part of options`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);

      for (const [stepIndex, step] of round.steps.entries()) {
        assert.ok(typeof step.label === 'string' && step.label.length > 0, `round ${index + 1}, step ${stepIndex + 1}: missing label`);
        assert.ok(typeof step.hours === 'number' && step.hours > 0, `round ${index + 1}, step ${stepIndex + 1}: invalid hours`);
      }
    }
  });
});
