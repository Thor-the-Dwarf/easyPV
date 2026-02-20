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
const configPath = path.join(gameDir, '_data/_gg01_folie_des_grauens_fehler_suche.json');

describe('Folie-des-Grauens Config', () => {
  it('contains exactly 7 identifiable errors with marker coordinates', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.errors) && cfg.errors.length === 7, 'expected exactly 7 errors');

    cfg.errors.forEach((error, index) => {
      assert.ok(typeof error.id === 'string' && error.id.length > 0, `error ${index + 1}: missing id`);
      assert.ok(typeof error.label === 'string' && error.label.length > 0, `error ${index + 1}: missing label`);
      assert.ok(error.marker && typeof error.marker === 'object', `error ${index + 1}: missing marker`);
      ['x_percent', 'y_percent', 'w_percent', 'h_percent'].forEach((key) => {
        const value = Number(error.marker[key]);
        assert.ok(Number.isFinite(value), `error ${index + 1}: marker ${key} must be numeric`);
      });
    });
  });
});
