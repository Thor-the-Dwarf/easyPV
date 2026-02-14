import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const configPath = path.join(workspaceRoot, 'databases', 'testing', 'config', 'advanced-web-scenarios.json');
const outputRoot = path.join(workspaceRoot, 'databases', 'testing', 'output', 'advanced-web-tests');
const actionsPath = path.join(outputRoot, 'actions.json');
const clientPath = process.env.WEB_GAME_CLIENT || path.join(process.env.HOME || '', '.codex', 'skills', 'develop-web-game', 'scripts', 'web_game_playwright_client.js');

const servers = {
  teil01: {
    cwd: path.join(workspaceRoot, 'databases', 'Teil01 Grundlagen'),
    baseUrl: 'http://localhost:4173',
    cmd: process.execPath,
    args: ['scripts/dev-server.mjs']
  },
  teil02: {
    cwd: path.join(workspaceRoot, 'databases', 'Teil02 FIAE'),
    baseUrl: 'http://localhost:4174',
    cmd: 'python3',
    args: ['-m', 'http.server', '4174']
  }
};

function encodeUrlPath(relPath) {
  return relPath.split('/').map((p) => encodeURIComponent(p)).join('/');
}

function pngSize(buffer) {
  if (buffer.length < 24) throw new Error('invalid PNG (too small)');
  const sig = buffer.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error('invalid PNG signature');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(cmd, args, cwd) {
  return await new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function getChangedFiles() {
  try {
    const out = execSync('git diff --name-only HEAD', { cwd: workspaceRoot, encoding: 'utf8' });
    return out.split('\n').map((v) => v.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function touchesGFile(relRepoPath) {
  return /__02_doing_.*\/(?:_g|_gs_|game_).+\.(?:css|js|html)$/i.test(relRepoPath.replace(/\\/g, '/'));
}

function scenarioMatchesChangedFiles(scenario, changedFiles) {
  const scenarioDir = path.posix.dirname(scenario.relPath.replace(/\\/g, '/'));
  return changedFiles.some((f) => {
    const posix = f.replace(/\\/g, '/');
    return touchesGFile(posix) && posix.includes(scenarioDir);
  });
}

async function startServers() {
  const processes = [];

  for (const key of Object.keys(servers)) {
    const def = servers[key];
    const child = spawn(def.cmd, def.args, {
      cwd: def.cwd,
      stdio: 'ignore'
    });
    processes.push(child);
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  return processes;
}

async function stopServers(processes) {
  for (const p of processes) {
    if (p && !p.killed) {
      try {
        p.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  }
}

async function runScenario(scenario) {
  const server = servers[scenario.server];
  if (!server) throw new Error(`unknown server: ${scenario.server}`);

  const scenarioDir = path.join(outputRoot, scenario.id);
  const idleDir = path.join(scenarioDir, 'idle');
  const activeDir = path.join(scenarioDir, 'active');
  await rm(scenarioDir, { recursive: true, force: true });
  await mkdir(idleDir, { recursive: true });
  await mkdir(activeDir, { recursive: true });

  const url = `${server.baseUrl}/${encodeUrlPath(scenario.relPath)}`;

  const idleCode = await runCommand(process.execPath, [
    clientPath,
    '--url',
    url,
    '--actions-json',
    '{"steps":[{"buttons":[],"frames":14}]}',
    '--iterations',
    '1',
    '--pause-ms',
    '220',
    '--screenshot-dir',
    idleDir
  ], workspaceRoot);

  const activeCode = await runCommand(process.execPath, [
    clientPath,
    '--url',
    url,
    '--actions-file',
    actionsPath,
    '--iterations',
    '1',
    '--pause-ms',
    '240',
    '--screenshot-dir',
    activeDir
  ], workspaceRoot);

  const idleShot = path.join(idleDir, 'shot-0.png');
  const activeShot = path.join(activeDir, 'shot-0.png');
  const idleErr = path.join(idleDir, 'errors-0.json');
  const activeErr = path.join(activeDir, 'errors-0.json');

  const idleShotExists = await exists(idleShot);
  const activeShotExists = await exists(activeShot);

  let visualOk = false;
  let gameplayChanged = false;
  let dimensions = null;
  let activeSize = 0;

  if (idleShotExists && activeShotExists) {
    const idleBuffer = await readFile(idleShot);
    const activeBuffer = await readFile(activeShot);
    const idleHash = crypto.createHash('sha256').update(idleBuffer).digest('hex');
    const activeHash = crypto.createHash('sha256').update(activeBuffer).digest('hex');
    gameplayChanged = idleHash !== activeHash;

    const dim = pngSize(activeBuffer);
    dimensions = dim;
    activeSize = activeBuffer.length;
    visualOk = dim.width >= 700 && dim.height >= 450 && activeBuffer.length >= 12000;
  }

  const uiOk = !(await exists(idleErr)) && !(await exists(activeErr)) && idleCode === 0 && activeCode === 0;

  const serverRoot = scenario.server === 'teil01'
    ? path.join(workspaceRoot, 'databases', 'Teil01 Grundlagen')
    : path.join(workspaceRoot, 'databases', 'Teil02 FIAE');
  const jsonPath = path.join(serverRoot, scenario.relPath.replace(/\.html$/i, '.json'));

  let scoringOk = false;
  if (await exists(jsonPath)) {
    const raw = await readFile(jsonPath, 'utf8');
    scoringOk = scenario.scorePatterns.some((pattern) => raw.includes(pattern));
  }

  return {
    id: scenario.id,
    url,
    uiOk,
    visualOk,
    gameplayChanged,
    scoringOk,
    dimensions,
    screenshotBytes: activeSize,
    idleShotExists,
    activeShotExists
  };
}

async function main() {
  if (!(await exists(clientPath))) {
    console.error(`Missing WEB_GAME_CLIENT script at ${clientPath}`);
    process.exit(1);
  }

  await mkdir(outputRoot, { recursive: true });
  await writeFile(actionsPath, JSON.stringify({
    steps: [
      { buttons: [], frames: 6 },
      { buttons: ['left_mouse_button'], frames: 2, mouse_x: 260, mouse_y: 520 },
      { buttons: [], frames: 4 },
      { buttons: ['right'], frames: 4 },
      { buttons: ['space'], frames: 2 },
      { buttons: [], frames: 8 }
    ]
  }), 'utf8');

  const scenarios = JSON.parse(await readFile(configPath, 'utf8'));

  let selected = scenarios;
  if (process.argv.includes('--only-changed')) {
    const changedFiles = getChangedFiles();
    selected = scenarios.filter((s) => scenarioMatchesChangedFiles(s, changedFiles));
    if (selected.length === 0) {
      console.log('No relevant _g/game_ file changes detected for advanced scenarios.');
      process.exit(0);
    }
  }

  const serverProcs = await startServers();
  let results = [];

  try {
    for (const scenario of selected) {
      const result = await runScenario(scenario);
      results.push(result);
    }
  } finally {
    await stopServers(serverProcs);
  }

  const gameplayChangedCount = results.filter((r) => r.gameplayChanged).length;
  const uiFailures = results.filter((r) => !r.uiOk).length;
  const visualFailures = results.filter((r) => !r.visualOk).length;
  const scoringFailures = results.filter((r) => !r.scoringOk).length;

  const summary = {
    total: results.length,
    gameplayChangedCount,
    uiFailures,
    visualFailures,
    scoringFailures,
    results
  };

  await writeFile(path.join(outputRoot, 'report.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify(summary, null, 2));

  const pass = gameplayChangedCount >= 1 && uiFailures === 0 && visualFailures === 0 && scoringFailures === 0;
  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
