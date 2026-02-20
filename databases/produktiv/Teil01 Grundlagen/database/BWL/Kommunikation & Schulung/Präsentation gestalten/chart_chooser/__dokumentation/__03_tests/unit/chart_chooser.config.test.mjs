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
const configPath = path.join(gameDir, '_data/_gg01_chart_chooser.json');

describe('Chart-Chooser Config', () => {
  it('contains 5 scenarios with valid options and correctOptionId', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.scenarios) && cfg.scenarios.length >= 5, 'expected at least 5 scenarios');

    cfg.scenarios.forEach((scenario, index) => {
      assert.ok(typeof scenario.dataDesc === 'string' && scenario.dataDesc.length > 0, `scenario ${index + 1}: missing dataDesc`);
      assert.ok(Array.isArray(scenario.options) && scenario.options.length >= 2, `scenario ${index + 1}: expected at least 2 options`);
      assert.ok(typeof scenario.correctOptionId === 'string' && scenario.correctOptionId.length > 0, `scenario ${index + 1}: missing correctOptionId`);

      const ids = new Set(scenario.options.map((opt) => opt.id));
      assert.ok(ids.has(scenario.correctOptionId), `scenario ${index + 1}: correctOptionId missing in options`);
    });
  });
});
