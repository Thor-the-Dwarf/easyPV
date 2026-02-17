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
const configPath = path.join(gameDir, '_data/_gg01_fehler_suche_der_korrupte_analyst.json');

describe('Fehler-Suche Config', () => {
  it('contains 10 rows with exactly 5 errors and plausible displayed values', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Number.isFinite(Number(cfg.time_limit_sec)), 'missing time_limit_sec');
    assert.ok(Array.isArray(cfg.rows) && cfg.rows.length === 10, 'expected exactly 10 rows');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring object');

    const ids = new Set();
    let errorCount = 0;

    for (const [index, row] of cfg.rows.entries()) {
      assert.ok(typeof row.id === 'string' && row.id.length > 0, `row ${index + 1}: missing id`);
      assert.ok(!ids.has(row.id), `duplicate row id: ${row.id}`);
      ids.add(row.id);

      assert.ok(typeof row.criterion === 'string' && row.criterion.length > 0, `row ${index + 1}: missing criterion`);
      assert.ok(Number.isFinite(Number(row.weight_percent)), `row ${index + 1}: missing weight_percent`);
      assert.ok(Number.isFinite(Number(row.score)), `row ${index + 1}: missing score`);
      assert.ok(typeof row.is_error === 'boolean', `row ${index + 1}: missing is_error`);
      assert.ok(Number.isFinite(Number(row.displayed_gp)), `row ${index + 1}: missing displayed_gp`);

      const expected = (Number(row.weight_percent) * Number(row.score)) / 100;
      const displayed = Number(row.displayed_gp);
      const isActuallyCorrect = Math.abs(expected - displayed) < 0.00001;

      if (row.is_error) {
        errorCount += 1;
        assert.ok(!isActuallyCorrect, `row ${index + 1}: flagged error but displayed_gp matches calculation`);
      } else {
        assert.ok(isActuallyCorrect, `row ${index + 1}: not an error but displayed_gp does not match calculation`);
      }
    }

    assert.equal(errorCount, 5, 'expected exactly 5 errors');
  });
});

