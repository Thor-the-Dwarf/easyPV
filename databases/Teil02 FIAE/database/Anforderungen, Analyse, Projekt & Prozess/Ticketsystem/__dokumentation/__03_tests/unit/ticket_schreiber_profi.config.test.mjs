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
const configPath = path.join(gameDir, 'data/_gg01_ticket_schreiber_profi.json');

describe('Ticket-Schreiber-Profi Config', () => {
  it('contains required fields and rounds with valid options', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.required_fields) && cfg.required_fields.length >= 4, 'expected required_fields');
    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const fieldIds = new Set(cfg.required_fields.map((f) => f.id));
    assert.ok(fieldIds.size >= 4, 'expected unique required field ids');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.snippet === 'string' && round.snippet.length > 0, `round ${index + 1}: missing snippet`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: missing options`);
      assert.ok(fieldIds.has(round.missing_field), `round ${index + 1}: invalid missing_field`);

      const optionIds = new Set(round.options.map((opt) => opt.id));
      assert.ok(optionIds.has(round.missing_field), `round ${index + 1}: missing_field not selectable`);
    }
  });
});
