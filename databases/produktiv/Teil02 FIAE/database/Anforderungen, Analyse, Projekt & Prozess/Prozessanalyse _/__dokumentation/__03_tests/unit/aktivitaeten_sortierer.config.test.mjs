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
const configPath = path.join(gameDir, '_data/_gg01_aktivitaeten_sortierer.json');

describe('Aktivitaeten-Sortierer Config', () => {
  it('contains categories and rounds with valid mappings', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.categories) && cfg.categories.length === 3, 'expected 3 categories');
    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const categoryIds = new Set(cfg.categories.map((category) => category.id));

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.activity === 'string' && round.activity.length > 0, `round ${index + 1}: missing activity`);
      assert.ok(categoryIds.has(round.correct_category), `round ${index + 1}: invalid correct_category`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);
    }
  });
});
