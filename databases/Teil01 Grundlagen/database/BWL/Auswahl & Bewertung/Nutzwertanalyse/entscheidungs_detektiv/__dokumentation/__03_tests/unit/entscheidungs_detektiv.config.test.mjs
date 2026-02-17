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
const configPath = path.join(gameDir, 'data/_gg01_entscheidungs_detektiv.json');

describe('Entscheidungs-Detektiv Config', () => {
  it('contains 5 rounds with valid weighted options and one clear winner id', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 5, 'expected at least 5 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.scenario === 'string' && round.scenario.length > 0, `round ${index + 1}: missing scenario`);
      assert.ok(Array.isArray(round.criteria) && round.criteria.length >= 3, `round ${index + 1}: missing criteria`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: missing options`);
      assert.ok(typeof round.correct_option === 'string' && round.correct_option.length > 0, `round ${index + 1}: missing correct_option`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);

      const totalWeight = round.criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);
      assert.equal(totalWeight, 100, `round ${index + 1}: criteria weights must add up to 100`);

      const optionIds = new Set(round.options.map((option) => option.id));
      assert.ok(optionIds.has(round.correct_option), `round ${index + 1}: correct option id not found`);

      for (const option of round.options) {
        for (const criterion of round.criteria) {
          assert.ok(
            Number.isFinite(Number(option.scores?.[criterion.id])),
            `round ${index + 1}: option ${option.id} missing score for criterion ${criterion.id}`
          );
        }
      }
    }
  });
});
