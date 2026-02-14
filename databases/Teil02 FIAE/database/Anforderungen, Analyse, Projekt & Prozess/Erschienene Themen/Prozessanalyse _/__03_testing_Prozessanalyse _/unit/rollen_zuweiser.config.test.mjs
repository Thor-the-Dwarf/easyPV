import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testingDir = path.resolve(unitDir, '..');
const topicDir = path.dirname(testingDir);
const doingDir = path.join(topicDir, '__02_doing_Prozessanalyse _');
const configPath = path.join(doingDir, '_g01_rollen_zuweiser.json');

describe('Rollen-Zuweiser Config', () => {
  it('contains RACI roles and valid round assignments', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.raci_roles) && cfg.raci_roles.length === 4, 'expected 4 RACI roles');
    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const roleIds = new Set(cfg.raci_roles.map((role) => role.id));
    assert.deepEqual([...roleIds].sort(), ['A', 'C', 'I', 'R'], 'expected RACI role ids');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.scenario === 'string' && round.scenario.length > 0, `round ${index + 1}: missing scenario`);
      assert.ok(roleIds.has(round.expected_role), `round ${index + 1}: invalid expected_role`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);
    }
  });
});
