import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testingDir = path.resolve(unitDir, '..');
const topicDir = path.dirname(testingDir);
const doingDir = path.join(topicDir, '__02_doing_Protokoll anfertigen _');
const configPath = path.join(doingDir, '_gg01_vom_gespraech_zum_punkt.json');

describe('Vom-Gespraech-zum-Punkt Config', () => {
  it('contains rounds with valid options and concise target mapping', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.statement === 'string' && round.statement.length > 0, `round ${index + 1}: missing statement`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: missing options`);
      assert.ok(typeof round.correct_option === 'string' && round.correct_option.length > 0, `round ${index + 1}: missing correct_option`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);

      const ids = new Set(round.options.map((option) => option.id));
      assert.ok(ids.has(round.correct_option), `round ${index + 1}: correct_option not in options`);
    }
  });
});
