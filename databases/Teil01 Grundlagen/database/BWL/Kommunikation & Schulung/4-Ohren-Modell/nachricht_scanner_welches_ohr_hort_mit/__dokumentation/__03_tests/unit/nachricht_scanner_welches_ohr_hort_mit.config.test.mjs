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
const configPath = path.join(gameDir, 'data/_gg01_nachricht_scanner_welches_ohr_hort_mit.json');

describe('Nachricht-Scanner Config', () => {
  it('contains 10 statements and 4 ears with valid mappings', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.ears) && cfg.ears.length === 4, 'expected exactly 4 ears');
    const earIds = new Set(cfg.ears.map((ear) => ear.id));
    assert.equal(earIds.size, 4, 'ear ids must be unique');

    assert.ok(Array.isArray(cfg.statements) && cfg.statements.length === 10, 'expected exactly 10 statements');

    const statementIds = new Set();
    for (const [index, st] of cfg.statements.entries()) {
      assert.ok(typeof st.id === 'string' && st.id.length > 0, `statement ${index + 1}: missing id`);
      assert.ok(!statementIds.has(st.id), `duplicate statement id: ${st.id}`);
      statementIds.add(st.id);

      assert.ok(typeof st.text === 'string' && st.text.length > 0, `statement ${index + 1}: missing text`);
      assert.ok(typeof st.correct_ear === 'string' && st.correct_ear.length > 0, `statement ${index + 1}: missing correct_ear`);
      assert.ok(earIds.has(st.correct_ear), `statement ${index + 1}: correct_ear must match an ear id`);
      assert.ok(typeof st.explanation === 'string' && st.explanation.length > 0, `statement ${index + 1}: missing explanation`);
    }

    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring object');
    assert.equal(cfg.scoring.correct, 10, 'expected correct score of 10');
    assert.equal(cfg.scoring.wrong, 0, 'expected wrong score of 0');
  });
});

