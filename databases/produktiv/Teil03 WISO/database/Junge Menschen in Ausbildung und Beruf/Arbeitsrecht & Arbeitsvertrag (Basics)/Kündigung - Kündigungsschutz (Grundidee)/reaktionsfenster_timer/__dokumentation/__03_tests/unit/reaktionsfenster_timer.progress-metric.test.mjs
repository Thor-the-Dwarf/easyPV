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
const jsPath = path.join(topicDir, '_gjs_reaktionsfenster_timer.js');

describe('Reaktionsfenster-Timer Progress Metrics', () => {
  it('exposes measurable score/progress output for automation and tracking', async () => {
    const jsRaw = await readFile(jsPath, 'utf8');

    assert.match(jsRaw, /measurable\s*:\s*true/, 'missing measurable flag in render_game_to_text');
    assert.match(jsRaw, /score\s*:/, 'missing score metric in render_game_to_text payload');
    assert.match(jsRaw, /progress_percent\s*:/, 'missing progress_percent metric in render_game_to_text payload');
    assert.match(jsRaw, /simulated_ms\s*=/, 'missing simulated_ms tracking for deterministic progression checks');
  });
});
