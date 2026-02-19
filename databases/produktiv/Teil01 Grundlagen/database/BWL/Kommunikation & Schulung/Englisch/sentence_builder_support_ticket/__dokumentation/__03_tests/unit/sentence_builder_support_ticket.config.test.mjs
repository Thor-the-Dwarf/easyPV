import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testsDir = path.resolve(unitDir, '..');
const docsDir = path.resolve(testsDir, '..');
const gameDir = path.resolve(docsDir, '..');
const configPath = path.join(gameDir, '_data/_gg01_sentence_builder_support_ticket.json');

describe('Sentence-Builder Config', () => {
  it('contains at least 5 tasks with target sentence and word blocks', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.tasks) && cfg.tasks.length >= 5, 'expected at least 5 tasks');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');

    cfg.tasks.forEach((task, index) => {
      assert.ok(typeof task.de === 'string' && task.de.length > 0, `task ${index + 1}: missing german prompt`);
      assert.ok(typeof task.target === 'string' && task.target.length > 0, `task ${index + 1}: missing target sentence`);
      assert.ok(Array.isArray(task.words) && task.words.length >= 4, `task ${index + 1}: expected at least 4 words`);
    });
  });
});
