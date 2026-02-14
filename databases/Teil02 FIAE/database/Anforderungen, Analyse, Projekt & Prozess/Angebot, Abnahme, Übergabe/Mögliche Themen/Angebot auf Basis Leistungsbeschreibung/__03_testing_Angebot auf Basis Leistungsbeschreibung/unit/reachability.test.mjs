import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const unitDir = path.dirname(__filename);
const testingDir = path.resolve(unitDir, '..');
const topicDir = path.dirname(testingDir);

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

describe('Local Reachability Smoke Test', () => {
  it('has a sibling __02_doing folder with at least one game asset', async () => {
    const entries = await readdir(topicDir, { withFileTypes: true });
    const doingDirs = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('__02_doing_'))
      .map((entry) => path.join(topicDir, entry.name));

    assert.equal(doingDirs.length, 1, 'expected exactly one sibling __02_doing_* folder');

    const files = await listFiles(doingDirs[0]);
    const gameFiles = files.filter((name) => /^(?:game_|_game_|_ghtml_|_gjs_|_g(?:g)?\d+_).+\.(html|js|json)$/i.test(name));
    assert.ok(gameFiles.length > 0, 'expected at least one game/_g*.{html,js,json} file');
  });
});
