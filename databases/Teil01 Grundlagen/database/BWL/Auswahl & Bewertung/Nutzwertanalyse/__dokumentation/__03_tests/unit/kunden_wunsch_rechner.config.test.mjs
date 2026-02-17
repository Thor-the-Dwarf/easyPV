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
const configPath = path.join(gameDir, '_data/_gg01_kunden_wunsch_rechner.json');

describe('Kunden-Wunsch-Rechner Config', () => {
  it('contains 5 rounds with ideal weights that sum to 100 and sane scoring thresholds', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 5, 'expected at least 5 rounds');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');

    assert.ok(Number.isFinite(Number(cfg.scoring.good_threshold)), 'missing good_threshold');
    assert.ok(Number.isFinite(Number(cfg.scoring.ok_threshold)), 'missing ok_threshold');
    assert.ok(cfg.scoring.good_threshold < cfg.scoring.ok_threshold, 'good_threshold must be < ok_threshold');

    for (const [index, round] of cfg.rounds.entries()) {
      assert.ok(typeof round.quote === 'string' && round.quote.length > 0, `round ${index + 1}: missing quote`);
      assert.ok(round.ideal && typeof round.ideal === 'object', `round ${index + 1}: missing ideal weights`);

      const p = Number(round.ideal.price);
      const q = Number(round.ideal.quality);
      const b = Number(round.ideal.brand);
      assert.ok(Number.isFinite(p) && Number.isFinite(q) && Number.isFinite(b), `round ${index + 1}: ideal weights must be numbers`);
      assert.equal(p + q + b, 100, `round ${index + 1}: ideal weights must sum to 100`);
    }
  });
});

