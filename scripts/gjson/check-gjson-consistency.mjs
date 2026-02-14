import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

const DEFAULT_BASELINE_PATH = path.join(workspaceRoot, 'databases', 'metadata', 'gjson-index.baseline.json');
const GJSON_FILE_RE = /^_gjson_.+\.json$/i;
const G_FALLBACK_FILE_RE = /^_g\d+_.+\.json$/i;
const IGNORED_DIRS = new Set(['.git', '.idea', '.vscode', 'node_modules', 'output']);

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/gjson/check-gjson-consistency.mjs [--baseline <path>] [--update-baseline]');
  console.log('  node scripts/gjson/check-gjson-consistency.mjs [--baseline <path>] [--strict-uniform]');
  console.log('');
  console.log('Flags:');
  console.log('  --baseline <path>      Baseline file path (default: databases/metadata/gjson-index.baseline.json)');
  console.log('  --update-baseline      Write current index as baseline');
  console.log('  --strict-uniform       Enforce one global top-level attribute signature');
  console.log('  --no-strict-uniform    Disable uniform enforcement even for _gjson_*.json');
  console.log('  --show-limit <n>       Max rows per finding group (default: 12)');
  console.log('  --help                 Show this help');
}

function parseCliArgs(argv) {
  const args = {
    baseline: DEFAULT_BASELINE_PATH,
    updateBaseline: false,
    strictUniform: false,
    noStrictUniform: false,
    showLimit: 12
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--baseline') {
      const next = argv[i + 1];
      if (!next) throw new Error('--baseline requires a path');
      args.baseline = path.isAbsolute(next) ? next : path.resolve(workspaceRoot, next);
      i += 1;
      continue;
    }
    if (token === '--update-baseline') {
      args.updateBaseline = true;
      continue;
    }
    if (token === '--strict-uniform') {
      args.strictUniform = true;
      continue;
    }
    if (token === '--no-strict-uniform') {
      args.noStrictUniform = true;
      continue;
    }
    if (token === '--show-limit') {
      const next = argv[i + 1];
      if (!next) throw new Error('--show-limit requires a number');
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('--show-limit must be a positive integer');
      args.showLimit = parsed;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function toPosix(relPath) {
  return relPath.split(path.sep).join('/');
}

async function listJsonFiles(rootDir) {
  const jsonFiles = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = await readdir(dir, { withFileTypes: true });
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
        stack.push(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.json')) continue;
      const absPath = path.join(dir, entry.name);
      jsonFiles.push(toPosix(path.relative(rootDir, absPath)));
    }
  }

  jsonFiles.sort((a, b) => a.localeCompare(b));
  return jsonFiles;
}

function getSignatureFrequency(rows) {
  const countBySignature = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const prev = countBySignature.get(row.signature);
    if (prev) {
      prev.count += 1;
    } else {
      countBySignature.set(row.signature, { count: 1, samplePath: row.path });
    }
  }

  return [...countBySignature.entries()]
    .map(([signature, info]) => ({
      signature,
      count: info.count,
      samplePath: info.samplePath
    }))
    .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
}

function diffKeys(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((key) => !actualSet.has(key));
  const extra = actual.filter((key) => !expectedSet.has(key));
  return { missing, extra };
}

function printList(title, rows, showLimit, formatter) {
  if (!rows.length) return;
  console.log(`${title}: ${rows.length}`);
  const max = Math.min(showLimit, rows.length);
  for (let i = 0; i < max; i += 1) {
    console.log(`- ${formatter(rows[i])}`);
  }
  if (rows.length > max) {
    console.log('- ...');
  }
}

async function createSnapshot() {
  const allJson = await listJsonFiles(workspaceRoot);
  const gjsonFiles = allJson.filter((relPath) => GJSON_FILE_RE.test(path.basename(relPath)));
  const fallbackFiles = allJson.filter((relPath) => G_FALLBACK_FILE_RE.test(path.basename(relPath)));

  let selectedFiles = gjsonFiles;
  let mode = 'gjson';
  let pattern = '_gjson_*.json';

  if (selectedFiles.length === 0) {
    selectedFiles = fallbackFiles;
    mode = 'g-fallback';
    pattern = '_g*.json (fallback)';
  }

  const files = [];
  const parseErrors = [];

  for (let i = 0; i < selectedFiles.length; i += 1) {
    const relPath = selectedFiles[i];
    const absPath = path.join(workspaceRoot, relPath);
    try {
      const raw = await readFile(absPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
        parseErrors.push({
          path: relPath,
          message: 'Root must be a JSON object'
        });
        continue;
      }
      const keys = Object.keys(parsed);
      const signature = [...keys].sort().join('|');
      files.push({
        path: relPath,
        keys,
        signature
      });
    } catch (error) {
      parseErrors.push({
        path: relPath,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode,
    pattern,
    fileCount: files.length,
    parseErrors,
    files,
    signatureFrequency: getSignatureFrequency(files),
    uniformSignature: getSignatureFrequency(files).length === 1 && files.length > 0
      ? getSignatureFrequency(files)[0].signature
      : null
  };
}

async function writeBaseline(snapshot, baselinePath) {
  const baseline = {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    mode: snapshot.mode,
    pattern: snapshot.pattern,
    fileCount: snapshot.fileCount,
    uniformSignature: snapshot.uniformSignature,
    signatureFrequency: snapshot.signatureFrequency,
    files: snapshot.files
  };

  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}

async function readBaseline(baselinePath) {
  const raw = await readFile(baselinePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.files)) {
    throw new Error('Invalid baseline format');
  }
  return parsed;
}

function compareSnapshots(baseline, current, enforceUniform) {
  const baselineMap = new Map(baseline.files.map((row) => [row.path, row]));
  const currentMap = new Map(current.files.map((row) => [row.path, row]));

  const removed = [];
  const added = [];
  const changed = [];
  const uniformViolations = [];

  for (const [pathKey, baselineRow] of baselineMap.entries()) {
    const currentRow = currentMap.get(pathKey);
    if (!currentRow) {
      removed.push(pathKey);
      continue;
    }
    if (baselineRow.signature !== currentRow.signature) {
      const keyDiff = diffKeys(baselineRow.keys || [], currentRow.keys || []);
      changed.push({
        path: pathKey,
        before: baselineRow.keys || [],
        after: currentRow.keys || [],
        missing: keyDiff.missing,
        extra: keyDiff.extra
      });
    }
  }

  for (const [pathKey, currentRow] of currentMap.entries()) {
    if (!baselineMap.has(pathKey)) {
      added.push({
        path: pathKey,
        keys: currentRow.keys || [],
        signature: currentRow.signature
      });
    }
  }

  const expectedUniform = enforceUniform
    ? (baseline.uniformSignature
      || (Array.isArray(baseline.signatureFrequency) && baseline.signatureFrequency[0]
        ? baseline.signatureFrequency[0].signature
        : null))
    : null;
  if (expectedUniform) {
    for (let i = 0; i < current.files.length; i += 1) {
      const row = current.files[i];
      if (row.signature !== expectedUniform) {
        uniformViolations.push({
          path: row.path,
          keys: row.keys
        });
      }
    }
  }

  return {
    removed,
    added,
    changed,
    uniformViolations
  };
}

function printSnapshotSummary(snapshot) {
  console.log(`Pattern: ${snapshot.pattern}`);
  console.log(`Indexed files: ${snapshot.fileCount}`);
  console.log(`Top-level key signatures: ${snapshot.signatureFrequency.length}`);
  if (snapshot.uniformSignature) {
    console.log('Uniform signature: yes');
  } else {
    console.log('Uniform signature: no');
  }
}

function printSignatureFrequency(snapshot, showLimit) {
  printList('Top signatures', snapshot.signatureFrequency, showLimit, (row) => {
    return `${row.count}x ${row.signature || '(empty-object)'} [${row.samplePath}]`;
  });
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const snapshot = await createSnapshot();

  if (snapshot.fileCount === 0) {
    console.log('No matching files found for _gjson_*.json or fallback _g*.json.');
    return;
  }

  if (snapshot.parseErrors.length > 0) {
    printSnapshotSummary(snapshot);
    printList('Parse errors', snapshot.parseErrors, args.showLimit, (row) => `${row.path}: ${row.message}`);
    process.exit(1);
  }

  const enforceUniform = args.noStrictUniform
    ? false
    : (args.strictUniform || snapshot.mode === 'gjson');

  if (args.updateBaseline) {
    await writeBaseline(snapshot, args.baseline);
    console.log(`Baseline updated: ${toPosix(path.relative(workspaceRoot, args.baseline))}`);
    printSnapshotSummary(snapshot);
    printSignatureFrequency(snapshot, args.showLimit);
    return;
  }

  let baseline;
  try {
    baseline = await readBaseline(args.baseline);
  } catch (error) {
    console.error(`Baseline missing or invalid: ${toPosix(path.relative(workspaceRoot, args.baseline))}`);
    console.error('Run again with --update-baseline to initialize it.');
    process.exit(1);
    return;
  }

  const diff = compareSnapshots(baseline, snapshot, enforceUniform);

  printSnapshotSummary(snapshot);
  console.log(`Baseline: ${toPosix(path.relative(workspaceRoot, args.baseline))}`);
  console.log(`Changed files: ${diff.changed.length}`);
  console.log(`Added files: ${diff.added.length}`);
  console.log(`Removed files: ${diff.removed.length}`);
  if (enforceUniform) {
    console.log(`Uniform violations: ${diff.uniformViolations.length}`);
  }

  printList('Changed', diff.changed, args.showLimit, (row) => {
    const bits = [];
    if (row.missing.length) bits.push(`missing=[${row.missing.join(', ')}]`);
    if (row.extra.length) bits.push(`extra=[${row.extra.join(', ')}]`);
    if (bits.length === 0) bits.push('key-order-only');
    return `${row.path} ${bits.join(' ')}`;
  });
  printList('Added', diff.added, args.showLimit, (row) => `${row.path} keys=[${row.keys.join(', ')}]`);
  printList('Removed', diff.removed, args.showLimit, (row) => row);
  if (enforceUniform) {
    printList('Uniform violations', diff.uniformViolations, args.showLimit, (row) => {
      return `${row.path} keys=[${row.keys.join(', ')}]`;
    });
  }

  const hasChanges = diff.changed.length > 0 || diff.added.length > 0 || diff.removed.length > 0;
  const hasUniformIssues = enforceUniform && diff.uniformViolations.length > 0;
  if (hasChanges || hasUniformIssues) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
