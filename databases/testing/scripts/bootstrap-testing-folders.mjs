import { mkdir, readdir, stat, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const databasesRoot = path.join(workspaceRoot, 'databases');

const LOCAL_TEST_TEMPLATE = `import { describe, it } from 'node:test';
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
    const gameFiles = files.filter((name) => /^game_.+\\.(html|js|json)$/i.test(name));
    assert.ok(gameFiles.length > 0, 'expected at least one game_*.{html,js,json} file');
  });
});
`;

const FOLDERS = ['unit', 'integration', 'fixtures', 'artifacts', 'reports'];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('__03_testing_')) {
        out.push(entryPath);
        continue;
      }
      await walk(entryPath, out);
    }
  }
  return out;
}

async function ensureFolderStructure(testingDir) {
  for (const folder of FOLDERS) {
    const target = path.join(testingDir, folder);
    await mkdir(target, { recursive: true });

    if (folder !== 'unit') {
      const keepFile = path.join(target, '.gitkeep');
      if (!(await exists(keepFile))) {
        await writeFile(keepFile, '', 'utf8');
      }
    }
  }

  const readme = path.join(testingDir, 'TESTING.md');
  if (!(await exists(readme))) {
    const topicName = path.basename(testingDir).replace(/^__03_testing_/, '');
    const content = [
      `# Testing: ${topicName}`,
      '',
      '## Ziel',
      '- Basisqualitaet sicherstellen: Spiel-Dateien vorhanden und startbar.',
      '',
      '## Struktur',
      '- unit: lokale Smoke-Unit-Tests',
      '- integration: spaetere Integrations-Tests',
      '- fixtures: Testdaten',
      '- artifacts: Screenshots/States',
      '- reports: Testberichte',
      '',
      '## Start',
      '- Global + lokal: `node databases/testing/scripts/run-smoke-tests.mjs`',
      ''
    ].join('\n');
    await writeFile(readme, content, 'utf8');
  }

  const localTest = path.join(testingDir, 'unit', 'reachability.test.mjs');
  if (!(await exists(localTest))) {
    await writeFile(localTest, LOCAL_TEST_TEMPLATE, 'utf8');
  }
}

async function main() {
  const testingDirs = await walk(databasesRoot);
  for (const dir of testingDirs) {
    await ensureFolderStructure(dir);
  }
  console.log(`Prepared ${testingDirs.length} testing folders.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
