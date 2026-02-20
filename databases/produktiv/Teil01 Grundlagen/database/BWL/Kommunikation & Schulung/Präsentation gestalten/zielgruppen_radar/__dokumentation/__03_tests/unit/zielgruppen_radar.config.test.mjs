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
const configPath = path.join(gameDir, '_data/_gg01_zielgruppen_radar.json');

describe('Zielgruppen-Radar Config', () => {
  it('contains 3 audiences with 3 style options each', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.audiences) && cfg.audiences.length >= 3, 'expected at least 3 audiences');

    cfg.audiences.forEach((audience, index) => {
      assert.ok(typeof audience.name === 'string' && audience.name.length > 0, `audience ${index + 1}: missing name`);
      assert.ok(Array.isArray(audience.styles) && audience.styles.length === 3, `audience ${index + 1}: expected 3 styles`);
      assert.ok(typeof audience.correctStyleId === 'string' && audience.correctStyleId.length > 0, `audience ${index + 1}: missing correctStyleId`);

      const ids = new Set(audience.styles.map((style) => style.id));
      assert.ok(ids.has(audience.correctStyleId), `audience ${index + 1}: correctStyleId missing in styles`);
    });
  });
});
