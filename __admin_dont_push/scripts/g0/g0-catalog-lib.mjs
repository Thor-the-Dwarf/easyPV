import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const G0_FILE_RE = /^_g0.+\.json$/i;
const DEFAULT_CATALOG_VERSION = 'g0-catalog/v1';
const DEFAULT_GAME_VERSION = 'g0-normalized/v1';

function toPosix(value) {
  return String(value || '').split(path.sep).join('/');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function makeTitleFromFileName(fileName) {
  const base = String(fileName || '').replace(/\.json$/i, '').replace(/^_g0\d*_?/i, '');
  if (!base) return 'Unbenanntes Spiel';
  return base
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pickFirstString(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const next = values[i];
    if (typeof next === 'string' && next.trim()) {
      return next.trim();
    }
  }
  return '';
}

function sanitizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function computeSha1(content) {
  return createHash('sha1').update(content).digest('hex');
}

function resolveSiblingFile(fileNames, suffix, kind) {
  const ext = kind === 'html' ? '.html' : '.js';
  const filtered = fileNames.filter((name) => name.toLowerCase().endsWith(ext));
  if (!filtered.length) return '';

  const suffixLower = String(suffix || '').toLowerCase();
  const preferredNames = kind === 'html'
    ? [`_ghtml_${suffixLower}${ext}`, `game_${suffixLower}${ext}`, `${suffixLower}${ext}`]
    : [`_gjs_${suffixLower}${ext}`, `game_${suffixLower}${ext}`, `${suffixLower}${ext}`];

  for (let i = 0; i < preferredNames.length; i += 1) {
    const exact = filtered.find((candidate) => candidate.toLowerCase() === preferredNames[i]);
    if (exact) return exact;
  }

  if (suffixLower) {
    const containsSuffix = filtered.find((candidate) => candidate.toLowerCase().includes(suffixLower));
    if (containsSuffix) return containsSuffix;
  }

  const prefix = kind === 'html' ? '_ghtml_' : '_gjs_';
  const prefixed = filtered.find((candidate) => candidate.toLowerCase().startsWith(prefix));
  if (prefixed) return prefixed;

  const gamePrefixed = filtered.find((candidate) => candidate.toLowerCase().startsWith('game_'));
  if (gamePrefixed) return gamePrefixed;

  return filtered[0];
}

function buildSourceGameId(rawJson, relPath) {
  const explicitId = pickFirstString(rawJson.id);
  if (explicitId) return slugify(explicitId);
  return slugify(relPath.replace(/\.json$/i, ''));
}

async function walkForG0Json(dirPath, output) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkForG0Json(entryPath, output);
      continue;
    }

    if (entry.isFile() && G0_FILE_RE.test(entry.name)) {
      output.push(entryPath);
    }
  }
}

function appendKeyFrequency(freqMap, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const prev = freqMap.get(key) || 0;
    freqMap.set(key, prev + 1);
  }
}

function toFrequencyRows(freqMap) {
  return Array.from(freqMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function detectTeilFromPath(relPath) {
  const parts = String(relPath || '').split('/');
  if (parts.length < 2) return null;
  if (parts[0] !== 'databases') return null;
  return parts[1] || null;
}

function normalizeRecord({
  parsedJson,
  rawText,
  relPath,
  fileName,
  folderRelPath,
  siblingFileNames,
  assignedGameId,
  sourceGameId
}) {
  const meta = sanitizeObject(parsedJson.meta);
  const topLevelKeys = Object.keys(parsedJson).sort();
  const suffix = String(fileName || '').replace(/\.json$/i, '').replace(/^_g0\d*_?/i, '');

  const htmlSibling = resolveSiblingFile(siblingFileNames, suffix, 'html');
  const jsSibling = resolveSiblingFile(siblingFileNames, suffix, 'js');

  const htmlRelPath = htmlSibling ? toPosix(path.join(folderRelPath, htmlSibling)) : null;
  const jsRelPath = jsSibling ? toPosix(path.join(folderRelPath, jsSibling)) : null;

  const title = pickFirstString(parsedJson.title, meta.title, makeTitleFromFileName(fileName));
  const subtitle = pickFirstString(parsedJson.subtitle, meta.subtitle);
  const legacyId = pickFirstString(parsedJson.id);

  return {
    schemaVersion: DEFAULT_GAME_VERSION,
    gameId: assignedGameId,
    sourceGameId: sourceGameId,
    source: {
      jsonPath: relPath,
      jsonSha1: computeSha1(rawText),
      jsonBytes: Buffer.byteLength(rawText, 'utf8')
    },
    repo: {
      teil: detectTeilFromPath(relPath),
      folderPath: folderRelPath,
      htmlPath: htmlRelPath,
      scriptPath: jsRelPath
    },
    metadata: {
      title: title,
      subtitle: subtitle || null,
      legacyId: legacyId || null,
      topLevelKeys: topLevelKeys,
      hasMeta: Object.keys(meta).length > 0
    },
    content: parsedJson
  };
}

function allocateUniqueGameId(desiredId, existingIds) {
  let next = desiredId || 'game';
  if (!existingIds.has(next)) {
    existingIds.add(next);
    return next;
  }

  let idx = 2;
  while (existingIds.has(`${next}_${idx}`)) {
    idx += 1;
  }
  const finalId = `${next}_${idx}`;
  existingIds.add(finalId);
  return finalId;
}

export async function createG0Catalog(options = {}) {
  const workspaceRoot = options.workspaceRoot
    ? path.resolve(options.workspaceRoot)
    : process.cwd();
  const includeContent = options.includeContent !== false;
  const databasesRoot = path.join(workspaceRoot, 'databases');

  const filePaths = [];
  await walkForG0Json(databasesRoot, filePaths);
  filePaths.sort((a, b) => toPosix(a).localeCompare(toPosix(b)));

  const parseErrors = [];
  const missingTitlePaths = [];
  const missingIdPaths = [];
  const missingMetaPaths = [];
  const sourceGameIdCount = new Map();
  const topLevelKeyFreq = new Map();
  const games = [];
  const assignedIds = new Set();

  for (let i = 0; i < filePaths.length; i += 1) {
    const absolutePath = filePaths[i];
    const relPath = toPosix(path.relative(workspaceRoot, absolutePath));
    const folderPath = path.dirname(absolutePath);
    const folderRelPath = toPosix(path.relative(workspaceRoot, folderPath));
    const fileName = path.basename(absolutePath);
    const rawText = await readFile(absolutePath, 'utf8');

    let parsedJson;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      parseErrors.push({
        jsonPath: relPath,
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const metaObj = sanitizeObject(parsedJson.meta);
    if (!pickFirstString(parsedJson.title, metaObj.title)) missingTitlePaths.push(relPath);
    if (!pickFirstString(parsedJson.id)) missingIdPaths.push(relPath);
    if (!Object.keys(metaObj).length) missingMetaPaths.push(relPath);

    const topLevelKeys = Object.keys(parsedJson).sort();
    appendKeyFrequency(topLevelKeyFreq, topLevelKeys);

    const siblingEntries = await readdir(folderPath, { withFileTypes: true });
    const siblingNames = siblingEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

    const sourceGameId = buildSourceGameId(parsedJson, relPath);
    sourceGameIdCount.set(sourceGameId, (sourceGameIdCount.get(sourceGameId) || 0) + 1);
    const assignedGameId = allocateUniqueGameId(sourceGameId || 'game', assignedIds);

    const normalizedRecord = normalizeRecord({
      parsedJson,
      rawText,
      relPath,
      fileName,
      folderRelPath,
      siblingFileNames: siblingNames,
      assignedGameId,
      sourceGameId
    });
    if (!includeContent) {
      delete normalizedRecord.content;
    }
    games.push(normalizedRecord);
  }

  const duplicateSourceGameIds = Array.from(sourceGameIdCount.entries())
    .filter(([, count]) => count > 1)
    .map(([gameId, count]) => ({ gameId, count }))
    .sort((a, b) => b.count - a.count || a.gameId.localeCompare(b.gameId));

  const catalog = {
    schemaVersion: DEFAULT_CATALOG_VERSION,
    generatedAt: new Date().toISOString(),
    totalGames: games.length,
    stats: {
      totalSourceFiles: filePaths.length,
      missingSourceFields: {
        title: missingTitlePaths.length,
        id: missingIdPaths.length,
        meta: missingMetaPaths.length
      },
      duplicateSourceGameIds: duplicateSourceGameIds.length,
      topLevelKeyFrequency: toFrequencyRows(topLevelKeyFreq)
    },
    games
  };

  const report = {
    fileCount: filePaths.length,
    parseErrors,
    duplicateSourceGameIds,
    missingSourceFields: {
      title: missingTitlePaths,
      id: missingIdPaths,
      meta: missingMetaPaths
    }
  };

  return { catalog, report };
}
