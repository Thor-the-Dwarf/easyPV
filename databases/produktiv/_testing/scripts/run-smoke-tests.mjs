import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const databasesRoot = path.join(workspaceRoot, 'databases');

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('__03_testing_')) {
        out.push(path.join(entryPath, 'unit', 'reachability.test.mjs'));
        continue;
      }
      await walk(entryPath, out);
    }
  }
  return out;
}

async function run() {
  const globalTest = path.join(databasesRoot, 'testing', 'tests', 'global-doing-folders-smoke.test.mjs');
  const coreRulesTest = path.join(databasesRoot, 'testing', 'tests', 'core-rules.test.mjs');
  const localTests = await walk(databasesRoot);
  const testFiles = [globalTest, coreRulesTest, ...localTests];

  const child = spawn(process.execPath, ['--test', ...testFiles], {
    cwd: workspaceRoot,
    stdio: 'inherit'
  });

  await new Promise((resolve) => {
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
