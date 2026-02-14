import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testingDir = path.resolve(unitDir, '..');
const topicDir = path.dirname(testingDir);
const doingDir = path.join(topicDir, '__02_doing_Stakeholder');
const configPath = path.join(doingDir, '_gg01_promotoren_opponenten_netz.json');

describe('Promotoren-Opponenten-Netz Config', () => {
  it('contains rounds with exactly one macht, one fach, and two opponents', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 4, 'expected at least 4 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(Array.isArray(round.people) && round.people.length >= 5, `round ${index + 1}: expected >= 5 people`);
      const macht = round.people.filter((p) => p.role === 'macht').length;
      const fach = round.people.filter((p) => p.role === 'fach').length;
      const opponents = round.people.filter((p) => p.role === 'opponent').length;
      assert.equal(macht, 1, `round ${index + 1}: expected exactly 1 macht`);
      assert.equal(fach, 1, `round ${index + 1}: expected exactly 1 fach`);
      assert.equal(opponents, 2, `round ${index + 1}: expected exactly 2 opponents`);
    }
  });
});
