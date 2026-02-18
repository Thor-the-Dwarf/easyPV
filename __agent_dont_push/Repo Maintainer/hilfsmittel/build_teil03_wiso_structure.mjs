import { promises as fs } from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const TEIL03_DATABASE_DIR = path.join(WORKSPACE_ROOT, 'databases', 'Teil03 WISO', 'database');
const SOURCE_FILE = path.join(TEIL03_DATABASE_DIR, 'Inhaltsverzeichnis_Teil03_WISO.txt');

const DOC_SUBFOLDERS = ['__01_analyses', '__02_plans', '__03_tests', '__04_lernings', '__05_feedback'];

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFolderName(value) {
  return normalizeWhitespace(String(value || '').replace(/\s*\/\s*/g, ' - '));
}

function normalizeLevel1(value) {
  return normalizeFolderName(String(value || '').replace(/^\d+\)\s*/, ''));
}

function pushError(errors, message) {
  errors.push(message);
}

function dedupeByKey(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.level1}|||${row.level2}|||${row.level3}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function parseInhaltsverzeichnis() {
  const content = await fs.readFile(SOURCE_FILE, 'utf8');
  const lines = content.split(/\r?\n/);
  const errors = [];
  const rows = [];

  let currentLevel1 = '';
  let currentLevel2 = '';

  for (let idx = 0; idx < lines.length; idx += 1) {
    const lineNo = idx + 1;
    const trimmed = lines[idx].trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      const level2 = normalizeFolderName(trimmed.slice(4));
      if (!currentLevel1) {
        pushError(errors, `Zeile ${lineNo}: Level-2 ohne aktives Level-1: "${trimmed}"`);
        continue;
      }
      if (!level2) {
        pushError(errors, `Zeile ${lineNo}: Leerer Level-2-Name.`);
        continue;
      }
      currentLevel2 = level2;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const level1 = normalizeLevel1(trimmed.slice(3));
      if (!level1) {
        pushError(errors, `Zeile ${lineNo}: Leerer Level-1-Name.`);
        continue;
      }
      currentLevel1 = level1;
      currentLevel2 = '';
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const level3 = normalizeFolderName(trimmed.slice(2));
      if (!currentLevel1 || !currentLevel2) {
        pushError(errors, `Zeile ${lineNo}: Level-3 ohne vollständigen Kontext: "${trimmed}"`);
        continue;
      }
      if (!level3) {
        pushError(errors, `Zeile ${lineNo}: Leerer Level-3-Name.`);
        continue;
      }
      rows.push({
        lineNo,
        level1: currentLevel1,
        level2: currentLevel2,
        level3
      });
      continue;
    }
  }

  if (errors.length) {
    const err = new Error('Parse-Fehler in Inhaltsverzeichnis.');
    err.details = errors;
    throw err;
  }

  const deduped = dedupeByKey(rows);
  const duplicateCount = rows.length - deduped.length;
  return { rows: deduped, duplicateCount };
}

async function pathType(absPath) {
  try {
    const stats = await fs.stat(absPath);
    if (stats.isDirectory()) return 'dir';
    if (stats.isFile()) return 'file';
    return 'other';
  } catch (_) {
    return 'missing';
  }
}

async function ensureDirOrMissing(pathsToCheck) {
  const errors = [];
  for (const absPath of pathsToCheck) {
    const kind = await pathType(absPath);
    if (kind === 'missing' || kind === 'dir') continue;
    errors.push(`${absPath} ist kein Verzeichnis (${kind}).`);
  }
  return errors;
}

function buildRequiredDirectories(rows) {
  const required = new Set([TEIL03_DATABASE_DIR]);
  const leaves = [];

  for (const row of rows) {
    const level1Path = path.join(TEIL03_DATABASE_DIR, row.level1);
    const level2Path = path.join(level1Path, row.level2);
    const level3Path = path.join(level2Path, row.level3);
    const docRoot = path.join(level3Path, '__dokumentation');

    required.add(level1Path);
    required.add(level2Path);
    required.add(level3Path);
    required.add(docRoot);

    for (const subfolder of DOC_SUBFOLDERS) {
      required.add(path.join(docRoot, subfolder));
    }

    leaves.push(level3Path);
  }

  return { requiredDirectories: Array.from(required), leaves };
}

async function ensureGitKeep(absDir) {
  const gitkeepPath = path.join(absDir, '.gitkeep');
  const kind = await pathType(gitkeepPath);

  if (kind === 'file') return false;
  if (kind !== 'missing') {
    throw new Error(`${gitkeepPath} existiert, ist aber keine Datei.`);
  }

  await fs.writeFile(gitkeepPath, '', 'utf8');
  return true;
}

async function createStructure(requiredDirectories) {
  let createdDirs = 0;
  for (const absDir of requiredDirectories) {
    const kind = await pathType(absDir);
    if (kind === 'dir') continue;
    await fs.mkdir(absDir, { recursive: true });
    createdDirs += 1;
  }
  return createdDirs;
}

async function createGitKeeps(rows) {
  let createdGitKeeps = 0;
  for (const row of rows) {
    const docRoot = path.join(TEIL03_DATABASE_DIR, row.level1, row.level2, row.level3, '__dokumentation');
    for (const subfolder of DOC_SUBFOLDERS) {
      const subPath = path.join(docRoot, subfolder);
      if (await ensureGitKeep(subPath)) createdGitKeeps += 1;
    }
  }
  return createdGitKeeps;
}

function createCounts(rows) {
  const level1 = new Set();
  const level2 = new Set();
  const level3 = new Set();

  for (const row of rows) {
    level1.add(row.level1);
    level2.add(`${row.level1}|||${row.level2}`);
    level3.add(`${row.level1}|||${row.level2}|||${row.level3}`);
  }

  return {
    level1: level1.size,
    level2: level2.size,
    level3: level3.size
  };
}

async function main() {
  const sourceKind = await pathType(SOURCE_FILE);
  if (sourceKind !== 'file') {
    throw new Error(`Inhaltsverzeichnis fehlt: ${SOURCE_FILE}`);
  }

  const { rows, duplicateCount } = await parseInhaltsverzeichnis();
  const counts = createCounts(rows);
  const { requiredDirectories } = buildRequiredDirectories(rows);

  const dirTypeErrors = await ensureDirOrMissing(requiredDirectories);
  if (dirTypeErrors.length > 0) {
    const err = new Error('Konflikt: Mindestens ein erwarteter Ordnerpfad ist als Datei/Objekt belegt.');
    err.details = dirTypeErrors;
    throw err;
  }

  const createdDirs = await createStructure(requiredDirectories);
  const createdGitKeeps = await createGitKeeps(rows);

  console.log('Teil03 WISO Struktur erstellt/validiert.');
  console.log(`Level-1 Ordner: ${counts.level1}`);
  console.log(`Level-2 Ordner: ${counts.level2}`);
  console.log(`Level-3 Endordner: ${counts.level3}`);
  console.log(`Angelegte Verzeichnisse: ${createdDirs}`);
  console.log(`Neu angelegte .gitkeep-Dateien: ${createdGitKeeps}`);
  console.log(`Deduplizierte doppelte Level-3-Einträge: ${duplicateCount}`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  if (Array.isArray(error.details) && error.details.length) {
    console.error('Details:');
    for (const detail of error.details) {
      console.error(`- ${detail}`);
    }
  }
  process.exitCode = 1;
});
