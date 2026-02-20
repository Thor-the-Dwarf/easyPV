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
const configPath = path.join(gameDir, '_data/_gg01_struktur_puzzle_der_rote_faden.json');

describe('Struktur-Puzzle Config', () => {
  it('contains 6 blocks and a 6-step target order', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.blocks) && cfg.blocks.length === 6, 'expected exactly 6 blocks');
    assert.ok(Array.isArray(cfg.targetOrder) && cfg.targetOrder.length === 6, 'expected exactly 6 target steps');

    const blockSet = new Set(cfg.blocks);
    cfg.targetOrder.forEach((step) => {
      assert.ok(blockSet.has(step), `target step '${step}' must be part of blocks`);
    });
  });
});
