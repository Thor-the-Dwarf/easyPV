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
const configPath = path.join(gameDir, 'data/_gg01_zuweisungs_meister.json');

describe('Zuweisungs-Meister Config', () => {
  it('defines roles and rounds with valid role mappings', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.roles) && cfg.roles.length >= 4, 'expected roles array');
    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const roleIds = new Set(cfg.roles.map((role) => role.id));

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.ticket === 'string' && round.ticket.length > 0, `round ${index + 1}: missing ticket`);
      assert.ok(typeof round.details === 'string' && round.details.length > 0, `round ${index + 1}: missing details`);
      assert.ok(roleIds.has(round.correct_role), `round ${index + 1}: invalid correct_role`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);
    }
  });
});
