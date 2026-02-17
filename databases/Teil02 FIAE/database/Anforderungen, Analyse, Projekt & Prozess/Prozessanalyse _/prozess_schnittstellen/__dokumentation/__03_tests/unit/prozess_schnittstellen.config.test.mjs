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
const configPath = path.join(gameDir, 'data/_gg01_prozess_schnittstellen.json');

describe('Prozess-Schnittstellen Config', () => {
  it('contains rounds with valid options and correct mappings', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.process_step === 'string' && round.process_step.length > 0, `round ${index + 1}: missing process_step`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: missing options`);
      assert.ok(typeof round.correct_option === 'string' && round.correct_option.length > 0, `round ${index + 1}: missing correct_option`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);

      const optionIds = new Set(round.options.map((option) => option.id));
      assert.ok(optionIds.has(round.correct_option), `round ${index + 1}: correct_option not part of options`);
    }
  });
});
