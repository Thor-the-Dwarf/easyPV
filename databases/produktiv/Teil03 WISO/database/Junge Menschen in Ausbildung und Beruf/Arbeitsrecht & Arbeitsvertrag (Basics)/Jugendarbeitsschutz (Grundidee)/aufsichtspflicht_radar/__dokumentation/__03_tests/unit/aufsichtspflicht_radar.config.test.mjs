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
const configPath = path.join(topicDir, '_data/_gg01_aufsichtspflicht_radar.json');

describe('Aufsichtspflicht-Radar Config', () => {
  it('contains rounds and scoring fields', async () => {
    const raw = await readFile(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    assert.ok(Array.isArray(cfg.rounds) && cfg.rounds.length >= 5, 'expected at least 5 rounds');
    assert.ok(cfg.scoring && typeof cfg.scoring === 'object', 'missing scoring');
    assert.ok(Number.isFinite(Number(cfg.scoring.correct)), 'missing scoring.correct');
    assert.ok(Number.isFinite(Number(cfg.scoring.wrong)), 'missing scoring.wrong');
  });
});
