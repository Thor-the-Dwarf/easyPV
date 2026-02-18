#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const PATHS = {
  erschieneneThemen: path.join(
    workspaceRoot,
    'databases',
    'Teil01 Grundlagen',
    'database',
    'BWL',
    'Projektmanagement & Organisation',
    'Erschienene Themen'
  ),
  moeglicheThemen: path.join(
    workspaceRoot,
    'databases',
    'Teil02 FIAE',
    'database',
    'Datenbanken & SQL',
    'Mögliche Themen'
  ),
  changeManagement: path.join(
    workspaceRoot,
    'databases',
    'Teil01 Grundlagen',
    'database',
    'BWL',
    'Projektmanagement & Organisation',
    'Change Management'
  ),
  fremdvergabe: path.join(
    workspaceRoot,
    'databases',
    'Teil01 Grundlagen',
    'database',
    'BWL',
    'Projektmanagement & Organisation',
    'Fremdvergabe'
  )
};

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function exists(p) {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function statSafe(p) {
  try {
    return await fs.lstat(p);
  } catch {
    return null;
  }
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function listDir(p) {
  return await fs.readdir(p, { withFileTypes: true });
}

function withSuffix(filePath, suffix) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(dir, `${base}${suffix}${ext}`);
}

async function nextAvailablePath(filePath, suffix) {
  let candidate = withSuffix(filePath, suffix);
  let counter = 1;
  while (await exists(candidate)) {
    candidate = withSuffix(filePath, `${suffix}_${counter}`);
    counter += 1;
  }
  return candidate;
}

async function filesEqual(a, b) {
  const [bufA, bufB] = await Promise.all([fs.readFile(a), fs.readFile(b)]);
  return bufA.equals(bufB);
}

async function removeIfEmpty(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function collectAttributeFiles(rootDir, out = []) {
  const st = await statSafe(rootDir);
  if (!st || !st.isDirectory()) return out;

  const entries = await listDir(rootDir);
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await collectAttributeFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && /^__metaData_.*\.json$/i.test(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

async function setIconOnFile(filePath, iconValue) {
  const st = await statSafe(filePath);
  if (!st || !st.isFile()) return false;

  const raw = await fs.readFile(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }

  if (!data || typeof data !== 'object') return false;
  if (data.Icon === iconValue) return false;

  data.Icon = iconValue;
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return true;
}

async function setIconRecursively(rootDir, iconValue) {
  const attributeFiles = await collectAttributeFiles(rootDir);
  let changed = 0;

  for (let i = 0; i < attributeFiles.length; i += 1) {
    const changedFile = await setIconOnFile(attributeFiles[i], iconValue);
    if (changedFile) changed += 1;
  }

  return { scanned: attributeFiles.length, changed };
}

async function mergeIntoDirectory(sourceDir, targetDir, sourceTag) {
  await ensureDir(targetDir);
  const entries = await listDir(sourceDir);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(targetDir, entry.name);

    const dstStat = await statSafe(dstPath);

    if (!dstStat) {
      await fs.rename(srcPath, dstPath);
      continue;
    }

    if (entry.isDirectory() && dstStat.isDirectory()) {
      await mergeIntoDirectory(srcPath, dstPath, sourceTag);
      await removeIfEmpty(srcPath);
      continue;
    }

    if (entry.isFile() && dstStat.isFile()) {
      if (await filesEqual(srcPath, dstPath)) {
        await fs.unlink(srcPath);
      } else {
        const altPath = await nextAvailablePath(dstPath, `__from_${sourceTag}`);
        await fs.rename(srcPath, altPath);
      }
      continue;
    }

    const fallbackTarget = await nextAvailablePath(dstPath, `__from_${sourceTag}`);
    await fs.rename(srcPath, fallbackTarget);
  }

  await removeIfEmpty(sourceDir);
}

async function flattenThemenFolder(themenDir, sourceTag) {
  const st = await statSafe(themenDir);
  if (!st || !st.isDirectory()) {
    return { moved: false, removed: false };
  }

  const parentDir = path.dirname(themenDir);
  const entries = await listDir(themenDir);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const srcPath = path.join(themenDir, entry.name);
    const dstPath = path.join(parentDir, entry.name);

    const dstStat = await statSafe(dstPath);

    if (!dstStat) {
      await fs.rename(srcPath, dstPath);
      continue;
    }

    if (entry.isDirectory() && dstStat.isDirectory()) {
      await mergeIntoDirectory(srcPath, dstPath, sourceTag);
      await removeIfEmpty(srcPath);
      continue;
    }

    if (entry.isFile() && dstStat.isFile()) {
      if (await filesEqual(srcPath, dstPath)) {
        await fs.unlink(srcPath);
      } else {
        const altPath = await nextAvailablePath(dstPath, `__from_${sourceTag}`);
        await fs.rename(srcPath, altPath);
      }
      continue;
    }

    const fallbackTarget = await nextAvailablePath(dstPath, `__from_${sourceTag}`);
    await fs.rename(srcPath, fallbackTarget);
  }

  try {
    await fs.rm(themenDir, { recursive: true, force: true });
    return { moved: true, removed: true };
  } catch {
    return { moved: true, removed: false };
  }
}

async function setBooksForMoeglicheCounterparts() {
  const moeglicheRoot = PATHS.moeglicheThemen;
  const parentRoot = path.dirname(moeglicheRoot);
  const attrFiles = await collectAttributeFiles(moeglicheRoot);

  let changedSource = 0;
  let changedCounterparts = 0;

  for (let i = 0; i < attrFiles.length; i += 1) {
    const srcFile = attrFiles[i];
    if (await setIconOnFile(srcFile, 'books')) changedSource += 1;

    const rel = path.relative(moeglicheRoot, srcFile);
    const counterpart = path.join(parentRoot, rel);
    if (await exists(counterpart)) {
      if (await setIconOnFile(counterpart, 'books')) changedCounterparts += 1;
    }
  }

  return {
    totalSourceAttributeFiles: attrFiles.length,
    changedSource,
    changedCounterparts
  };
}

async function main() {
  const flameChange = await setIconRecursively(PATHS.changeManagement, 'flame');
  const flameFremd = await setIconRecursively(PATHS.fremdvergabe, 'flame');
  const booksStats = await setBooksForMoeglicheCounterparts();

  const flatErsch = await flattenThemenFolder(PATHS.erschieneneThemen, 'erschienene_themen');
  const flatMoeg = await flattenThemenFolder(PATHS.moeglicheThemen, 'moegliche_themen');

  log('apply_themen_icons_and_flatten: completed');
  log(`- flame Change Management: scanned ${flameChange.scanned}, changed ${flameChange.changed}`);
  log(`- flame Fremdvergabe: scanned ${flameFremd.scanned}, changed ${flameFremd.changed}`);
  log(
    `- books Mögliche Themen: source files ${booksStats.totalSourceAttributeFiles}, `
    + `changed source ${booksStats.changedSource}, changed counterparts ${booksStats.changedCounterparts}`
  );
  log(`- flatten Erschienene Themen: moved=${flatErsch.moved}, removed=${flatErsch.removed}`);
  log(`- flatten Mögliche Themen: moved=${flatMoeg.moved}, removed=${flatMoeg.removed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
