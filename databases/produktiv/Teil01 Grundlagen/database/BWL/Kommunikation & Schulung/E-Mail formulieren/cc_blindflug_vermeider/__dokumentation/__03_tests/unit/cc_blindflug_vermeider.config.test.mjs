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
const configPath = path.join(gameDir, '_data/_gg01_cc_blindflug_vermeider.json');

describe('CC-Blindflug-Vermeider Config', () => {
  it('contains 5 scenarios with routing options and one correct option id', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 5, 'expected at least 5 rounds');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');
    assert.ok(Number.isFinite(Number(cfg.scoring.correct)), 'missing scoring.correct');
    assert.ok(Number.isFinite(Number(cfg.scoring.wrong)), 'missing scoring.wrong');

    cfg.rounds.forEach((round, index) => {
      assert.ok(typeof round.scenario === 'string' && round.scenario.length > 0, `round ${index + 1}: missing scenario`);
      assert.ok(Array.isArray(round.options) && round.options.length === 3, `round ${index + 1}: expected exactly 3 options`);
      assert.ok(typeof round.correctOptionId === 'string' && round.correctOptionId.length > 0, `round ${index + 1}: missing correctOptionId`);

      const optionIds = new Set();
      round.options.forEach((option) => {
        assert.ok(typeof option.id === 'string' && option.id.length > 0, `round ${index + 1}: option missing id`);
        assert.ok(Array.isArray(option.to), `round ${index + 1}: option.to must be array`);
        assert.ok(Array.isArray(option.cc), `round ${index + 1}: option.cc must be array`);
        assert.ok(Array.isArray(option.bcc), `round ${index + 1}: option.bcc must be array`);
        optionIds.add(option.id);
      });

      assert.ok(optionIds.has(round.correctOptionId), `round ${index + 1}: correctOptionId not found in options`);
    });
  });
});
