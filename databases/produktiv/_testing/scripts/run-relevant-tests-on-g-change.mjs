import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');

function changedFiles() {
  try {
    const out = execSync('git diff --name-only HEAD', { cwd: workspaceRoot, encoding: 'utf8' });
    return out.split('\n').map((v) => v.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function hasRelevantGChanges(files) {
  return files.some((f) => /__02_doing_.*\/(?:_g|_gs_|game_).+\.(?:css|js|html)$/i.test(f.replace(/\\/g, '/')));
}

async function run(cmd, args) {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: workspaceRoot, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const files = changedFiles();
  if (!hasRelevantGChanges(files)) {
    console.log('No relevant _g/game_ file changes detected.');
    process.exit(0);
  }

  const smokeCode = await run(process.execPath, ['databases/_testing/scripts/run-smoke-tests.mjs']);
  if (smokeCode !== 0) process.exit(smokeCode);

  const advancedCode = await run(process.execPath, ['databases/_testing/scripts/run-advanced-web-tests.mjs', '--only-changed']);
  process.exit(advancedCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
