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
const configPath = path.join(doingDir, '_g01_drei_phasen_modell.json');

describe('Drei-Phasen-Modell Config', () => {
  it('has valid phases and cards with exactly one mapped phase id', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.phases) && cfg.phases.length === 3, 'expected exactly 3 phases');
    assert.ok(Array.isArray(cfg.cards) && cfg.cards.length >= 4, 'expected at least 4 cards');

    const phaseIds = new Set(cfg.phases.map((p) => p.id));
    assert.equal(phaseIds.size, 3, 'phase ids must be unique');

    for (const [index, card] of cfg.cards.entries()) {
      assert.ok(phaseIds.has(card.correct_phase), `card ${index + 1}: correct_phase must reference existing phase`);
    }
  });
});
