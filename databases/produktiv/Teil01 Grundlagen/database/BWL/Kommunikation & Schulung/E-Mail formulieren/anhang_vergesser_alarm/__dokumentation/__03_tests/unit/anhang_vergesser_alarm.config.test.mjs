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
const configPath = path.join(gameDir, '_data/_gg01_anhang_vergesser_alarm.json');

describe('Anhang-Vergesser-Alarm Config', () => {
  it('contains valid rounds and scoring fields', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 5, 'expected at least 5 rounds');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');
    assert.ok(Number.isFinite(Number(cfg.scoring.correct)), 'missing scoring.correct');
    assert.ok(Number.isFinite(Number(cfg.scoring.wrong)), 'missing scoring.wrong');
    assert.ok(Number.isFinite(Number(cfg.scoring.timeout)), 'missing scoring.timeout');

    cfg.rounds.forEach((round, index) => {
      assert.ok(typeof round.subject === 'string' && round.subject.length > 0, `round ${index + 1}: missing subject`);
      assert.ok(typeof round.body === 'string' && round.body.length > 0, `round ${index + 1}: missing body`);
      assert.ok(typeof round.hasAttachment === 'boolean', `round ${index + 1}: missing hasAttachment boolean`);
      assert.ok(round.expectedAction === 'send' || round.expectedAction === 'block', `round ${index + 1}: invalid expectedAction`);
    });
  });
});
