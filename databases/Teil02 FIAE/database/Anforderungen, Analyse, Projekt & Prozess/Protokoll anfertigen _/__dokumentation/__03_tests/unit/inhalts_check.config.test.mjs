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
const configPath = path.join(gameDir, '_data/_gg01_inhalts_check.json');

describe('Inhalts-Check Config', () => {
  it('contains required fields and rounds with valid answers', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.required_fields) && cfg.required_fields.length >= 5, 'expected required_fields');
    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 6, 'expected at least 6 rounds');

    const fieldSet = new Set(cfg.required_fields);

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.excerpt === 'string' && round.excerpt.length > 0, `round ${index + 1}: missing excerpt`);
      assert.ok(Array.isArray(round.options) && round.options.length >= 3, `round ${index + 1}: missing options`);
      assert.ok(typeof round.missing_field === 'string' && round.missing_field.length > 0, `round ${index + 1}: missing missing_field`);
      assert.ok(round.options.includes(round.missing_field), `round ${index + 1}: missing_field not in options`);
      assert.ok(fieldSet.has(round.missing_field), `round ${index + 1}: missing_field not in required_fields`);
      assert.ok(typeof round.reason === 'string' && round.reason.length > 0, `round ${index + 1}: missing reason`);
    }
  });
});
