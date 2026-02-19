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
const configPath = path.join(gameDir, '_data/_gg01_listening_comprehension_the_meeting.json');

describe('Listening-Comprehension Config', () => {
  it('contains dialog lines and 3 valid quiz questions', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(cfg.dialog && Array.isArray(cfg.dialog.lines) && cfg.dialog.lines.length >= 5, 'expected at least 5 dialog lines');
    assert.ok(Array.isArray(cfg.questions) && cfg.questions.length === 3, 'expected exactly 3 questions');

    cfg.questions.forEach((question, index) => {
      assert.ok(typeof question.question === 'string' && question.question.length > 0, `question ${index + 1}: missing text`);
      assert.ok(Array.isArray(question.options) && question.options.length === 4, `question ${index + 1}: expected 4 options`);
      assert.ok(typeof question.correctOptionId === 'string' && question.correctOptionId.length > 0, `question ${index + 1}: missing correctOptionId`);

      const ids = new Set(question.options.map((opt) => opt.id));
      assert.ok(ids.has(question.correctOptionId), `question ${index + 1}: correctOptionId missing in options`);
    });
  });
});
