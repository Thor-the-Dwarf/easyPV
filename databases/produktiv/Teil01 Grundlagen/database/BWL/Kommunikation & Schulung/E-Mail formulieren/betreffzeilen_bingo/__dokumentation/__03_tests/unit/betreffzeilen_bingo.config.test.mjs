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
const configPath = path.join(gameDir, '_data/_gg01_betreffzeilen_bingo.json');

describe('Betreffzeilen-Bingo Config', () => {
  it('contains rounds with three options and one correct option id', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 10, 'expected at least 10 rounds');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');
    assert.ok(Number.isFinite(Number(cfg.scoring.correct)), 'missing scoring.correct');
    assert.ok(Number.isFinite(Number(cfg.scoring.wrong)), 'missing scoring.wrong');

    cfg.rounds.forEach((round, index) => {
      assert.ok(typeof round.bodyPreview === 'string' && round.bodyPreview.length > 0, `round ${index + 1}: missing bodyPreview`);
      assert.ok(Array.isArray(round.options) && round.options.length === 3, `round ${index + 1}: expected exactly 3 options`);
      assert.ok(typeof round.correctOptionId === 'string' && round.correctOptionId.length > 0, `round ${index + 1}: missing correctOptionId`);

      const optionIds = new Set();
      round.options.forEach((option) => {
        assert.ok(typeof option.id === 'string' && option.id.length > 0, `round ${index + 1}: option missing id`);
        assert.ok(typeof option.text === 'string' && option.text.length > 0, `round ${index + 1}: option missing text`);
        optionIds.add(option.id);
      });

      assert.ok(optionIds.has(round.correctOptionId), `round ${index + 1}: correctOptionId not found in options`);
    });
  });
});
