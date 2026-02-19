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
const configPath = path.join(gameDir, '_data/_gg01_priorisierungs_pyramide.json');

describe('Priorisierungs-Pyramide Config', () => {
  it('contains cards mapped to valid kano categories', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.categories) && cfg.categories.length === 3, 'expected 3 categories');
    assert.ok(Array.isArray(cfg.cards) && cfg.cards.length >= 4, 'expected at least 4 cards');

    const ids = new Set(cfg.categories.map((c) => c.id));

    for (const [index, card] of cfg.cards.entries()) {
      assert.ok(typeof card.text === 'string' && card.text.length > 0, `card ${index + 1}: missing text`);
      assert.ok(ids.has(card.category), `card ${index + 1}: unknown category`);
    }
  });
});
