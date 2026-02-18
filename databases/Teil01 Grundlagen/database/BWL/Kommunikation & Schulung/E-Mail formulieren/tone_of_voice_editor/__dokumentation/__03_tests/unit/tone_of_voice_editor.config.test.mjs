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
const configPath = path.join(gameDir, '_data/_gg01_tone_of_voice_editor.json');

describe('Tone-of-Voice-Editor Config', () => {
  it('contains 5 rounds with term replacements', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 5, 'expected at least 5 rounds');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');
    assert.ok(Number.isFinite(Number(cfg.scoring.correct_term)), 'missing scoring.correct_term');

    cfg.rounds.forEach((round, index) => {
      assert.ok(typeof round.badText === 'string' && round.badText.length > 0, `round ${index + 1}: missing badText`);
      assert.ok(Array.isArray(round.terms) && round.terms.length >= 3, `round ${index + 1}: expected at least 3 terms`);

      round.terms.forEach((term, termIndex) => {
        assert.ok(typeof term.word === 'string' && term.word.length > 0, `round ${index + 1}/${termIndex + 1}: missing word`);
        assert.ok(Array.isArray(term.options) && term.options.length >= 3, `round ${index + 1}/${termIndex + 1}: expected >=3 options`);
        assert.ok(typeof term.bestChoiceId === 'string' && term.bestChoiceId.length > 0, `round ${index + 1}/${termIndex + 1}: missing bestChoiceId`);

        const optionIds = new Set(term.options.map((option) => option.id));
        assert.ok(optionIds.has(term.bestChoiceId), `round ${index + 1}/${termIndex + 1}: bestChoiceId not found`);
      });
    });
  });
});
