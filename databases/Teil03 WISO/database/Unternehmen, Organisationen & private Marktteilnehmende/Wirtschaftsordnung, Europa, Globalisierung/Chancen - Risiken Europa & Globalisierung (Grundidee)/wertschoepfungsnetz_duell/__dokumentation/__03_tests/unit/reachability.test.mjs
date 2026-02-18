import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testsDir = path.resolve(unitDir, '..');
const docsDir = path.resolve(testsDir, '..');
const topicDir = path.resolve(docsDir, '..');

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

describe('Local Reachability Smoke Test', () => {
  it('has game files in topic root and data folder', async () => {
    const rootFiles = await listFiles(topicDir);
    const gameFiles = rootFiles.filter((name) => /^(?:game_|_game_|_ghtml_|_gjs_|_gcss_).+.(html|js|css)$/i.test(name));
    assert.ok(gameFiles.length > 0, 'expected at least one game HTML/JS/CSS file in topic root');

    const dataDir = path.join(topicDir, '_data');
    const dataFiles = await listFiles(dataDir);
    const jsonFiles = dataFiles.filter((name) => /.json$/i.test(name));
    assert.ok(jsonFiles.length > 0, 'expected at least one JSON file in _data/');
  });
});
