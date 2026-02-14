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
const configPath = path.join(doingDir, '_g01_change_erfolgs_check.json');

describe('Change-Erfolgs-Check Config', () => {
  it('contains rounds with exactly 2 correct KPIs', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 4, 'expected at least 4 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.kpis) && round.kpis.length >= 4, `round ${index + 1}: expected >= 4 kpis`);
      const correct = round.kpis.filter((kpi) => kpi.correct === true);
      assert.equal(correct.length, 2, `round ${index + 1}: expected exactly 2 correct kpis`);
    }
  });
});
