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
const configPath = path.join(gameDir, 'data/_gg01_priorisierungs_butler.json');

describe('Priorisierungs-Butler Config', () => {
  it('defines P1-P4 priorities and valid rounds', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.priorities), 'expected priorities array');
    assert.ok(Array.isArray(cfg.rounds), 'expected rounds array');
    assert.ok(cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const allowed = new Set(cfg.priorities.map((p) => p.id));
    assert.deepEqual([...allowed].sort(), ['P1', 'P2', 'P3', 'P4'], 'expected priorities P1-P4');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.ticket === 'string' && round.ticket.length > 0, `round ${index + 1}: missing ticket`);
      assert.ok(typeof round.details === 'string' && round.details.length > 0, `round ${index + 1}: missing details`);
      assert.ok(allowed.has(round.correct_priority), `round ${index + 1}: invalid correct_priority`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);
    }
  });
});
