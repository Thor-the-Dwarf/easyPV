#!/usr/bin/env node
/**
 * Node fallback for the Rust fireBaseGetter.
 *
 * Reason: some environments (like Codex sandboxes) don't have `cargo` available.
 * This script downloads the Firestore collection `feedback_all_games` via firebase-admin,
 * applies the same hardcoded prompt-injection sanitization, exports feedback JSON files into
 * matching `__04_lernings_*` folders, and writes the protocol file with all written paths.
 *
 * Outputs (repo-relative):
 * - __admin_dont_push/fireBaseGetter/feedback_all_games.json
 * - __admin_dont_push/fireBaseGetter/codex_protocoll_allFeedBack.txt
 * - __04_lernings_<topic>/firebase_feedback_import/feedback_<doc_id>.json
 */

import fs from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const COLLECTION_NAME = 'feedback_all_games';
const SERVICE_ACCOUNT_FILE = '__admin_dont_push/firebase-service-account.local.json';
const OUTPUT_RELATIVE_PATH = '__admin_dont_push/fireBaseGetter/feedback_all_games.json';
const PROTOCOL_RELATIVE_PATH = '__admin_dont_push/fireBaseGetter/codex_protocoll_allFeedBack.txt';
const FIRESTORE_PAGE_SIZE = 1000;
const LEARNING_EXPORT_SUBDIR = 'firebase_feedback_import';

const SANITIZER_VERSION = 'hardcoded_prompt_injection_filter_v1';
const COMMENT_MAX_CHARS = 4000;
const BLOCK_SCORE_THRESHOLD = 14;
const BLOCKED_COMMENT_TOKEN = '[blocked-by-fireBaseGetter-security]';
const EMPTY_COMMENT_TOKEN = '[empty-after-sanitization]';
const REDACTION_TOKEN = '[redacted]';

const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const ZERO_WIDTH_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const MULTI_SPACE_RE = /\s+/g;

const DETECTION_RULES = [
  {
    id: 'ignore_previous_instructions',
    weight: 5,
    regex:
      /\b(ignore|disregard|forget)\b.{0,60}\b(previous|prior|above|all)\b.{0,60}\b(instruction|rules?|prompt|message)\b/is
  },
  {
    id: 'prompt_exfiltration',
    weight: 6,
    regex:
      /\b(reveal|show|print|dump|expose|leak)\b.{0,80}\b(system|developer|hidden|internal)\b.{0,40}\b(prompt|instruction|message)\b/is
  },
  {
    id: 'role_override',
    weight: 4,
    regex: /\b(you are|act as|pretend to be|simulate|impersonate)\b.{0,80}\b(system|developer|assistant|admin|root)\b/is
  },
  { id: 'jailbreak_keyword', weight: 5, regex: /\b(jailbreak|dan mode|do anything now|bypass safety|override safety|ignore safeguards)\b/i },
  { id: 'role_prefix', weight: 4, regex: /(^|\s)(system|assistant|developer|user)\s*:/gim },
  { id: 'xml_prompt_tag', weight: 4, regex: /<\s*\/?\s*(system|assistant|developer|instructions?|prompt)\b[^>]*>/gis },
  { id: 'code_fence', weight: 3, regex: /```.*?```/gs },
  { id: 'instruction_header', weight: 3, regex: /^#{1,6}\s*(system|developer|assistant|prompt|instruction)\b/gim },
  {
    id: 'tool_injection',
    weight: 4,
    regex: /\b(function\s*call|tool\s*call|execute_command|shell\s*command|browser\.search|browser\.open)\b/i
  },
  { id: 'encoded_payload', weight: 3, regex: /\b(base64|rot13|hex)\b.{0,40}\b(decode|payload|instruction|prompt|command)\b/is },
  { id: 'dangerous_uri_scheme', weight: 4, regex: /\b(javascript|data|file|vbscript)\s*:/i },
  { id: 'command_payload', weight: 4, regex: /\b(rm\s+-rf|curl\s+https?:\/\/|wget\s+https?:\/\/|powershell\s+-|bash\s+-c)\b/i }
];

const REWRITE_RULES = [
  { regex: /```.*?```/gs, replacement: REDACTION_TOKEN },
  { regex: /(^|\s)(system|assistant|developer|user)\s*:/gim, replacement: ' $1[role-redacted]:' },
  { regex: /<\s*\/?\s*(system|assistant|developer|instructions?|prompt)\b[^>]*>/gis, replacement: REDACTION_TOKEN },
  { regex: /\b(javascript|data|file|vbscript)\s*:/gi, replacement: '[scheme-redacted]' },
  { regex: /\b(ignore|disregard|forget)\b.{0,60}\b(instruction|rules?|prompt|message)\b/gis, replacement: REDACTION_TOKEN },
  {
    regex:
      /\b(reveal|show|print|dump|expose|leak)\b.{0,80}\b(system|developer|hidden|internal)\b.{0,40}\b(prompt|instruction|message)\b/gis,
    replacement: REDACTION_TOKEN
  }
];

function isDirectorySync(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (_) {
    return false;
  }
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch (_) {
    return false;
  }
}

async function safeStat(p) {
  try {
    return await stat(p);
  } catch (_) {
    return null;
  }
}

async function findRepoRoot(startDir) {
  let cursor = path.resolve(startDir);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (isDirectorySync(path.join(cursor, '.git'))) return cursor;
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error('could not find repository root (.git directory)');
    cursor = parent;
  }
}

function parsePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

async function readServiceAccountFromFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid service account JSON in ${filePath}`);
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      `Service account file is missing required fields (project_id, client_email, private_key): ${filePath}`
    );
  }
  return {
    projectId: String(parsed.project_id).trim(),
    clientEmail: String(parsed.client_email).trim(),
    privateKey: parsePrivateKey(parsed.private_key)
  };
}

async function loadFirebaseAdmin() {
  const app = await import('firebase-admin/app');
  const firestore = await import('firebase-admin/firestore');
  return { app, firestore };
}

function normalizeFirestoreValue(value, Timestamp) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  if (Timestamp && value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestoreValue(item, Timestamp));
  }

  if (typeof value === 'object') {
    // DocumentReference has a `path` string.
    if (typeof value.path === 'string' && typeof value.id === 'string' && typeof value.parent === 'object') {
      return String(value.path);
    }

    // Uint8Array/Buffer payloads: keep as base64 to avoid dumping binary into JSON.
    if (value instanceof Uint8Array) {
      return Buffer.from(value).toString('base64');
    }

    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeFirestoreValue(v, Timestamp);
    }
    return out;
  }

  return null;
}

function isCommentField(key) {
  const folded = String(key || '')
    .toLowerCase()
    .replace(/[-_ ]/g, '');

  return (
    folded.includes('comment') ||
    folded.includes('kommentar') ||
    folded.includes('feedbacktext') ||
    folded === 'feedback' ||
    folded === 'message' ||
    folded === 'nachricht'
  );
}

function joinPath(parent, key) {
  if (!parent) return String(key || '');
  return `${parent}.${String(key || '')}`;
}

function sanitizeCommentText(input) {
  const reasonsSet = new Set();
  let score = 0;
  let changed = false;
  let matchedInjectionRule = false;

  const originalLength = Array.from(String(input || '')).length;
  let sanitized = String(input || '').normalize('NFKC');

  if (sanitized !== String(input || '')) {
    changed = true;
    score += 1;
    reasonsSet.add('unicode_normalized_nfkc');
  }

  const withoutControl = sanitized.replace(CONTROL_CHAR_RE, '');
  if (withoutControl !== sanitized) {
    changed = true;
    score += 1;
    reasonsSet.add('control_chars_removed');
    sanitized = withoutControl;
  }

  const withoutZeroWidth = sanitized.replace(ZERO_WIDTH_RE, '');
  if (withoutZeroWidth !== sanitized) {
    changed = true;
    score += 1;
    reasonsSet.add('zero_width_removed');
    sanitized = withoutZeroWidth;
  }

  const compactWhitespace = sanitized.replace(MULTI_SPACE_RE, ' ');
  if (compactWhitespace !== sanitized) {
    changed = true;
    reasonsSet.add('whitespace_compacted');
    sanitized = compactWhitespace;
  }

  const trimmed = sanitized.trim();
  if (trimmed !== sanitized) {
    changed = true;
    reasonsSet.add('trimmed');
    sanitized = trimmed;
  }

  const charCount = Array.from(sanitized).length;
  if (charCount > COMMENT_MAX_CHARS) {
    changed = true;
    score += 2;
    reasonsSet.add('max_length_truncated');
    sanitized = Array.from(sanitized).slice(0, COMMENT_MAX_CHARS).join('');
  }

  for (const rule of DETECTION_RULES) {
    if (rule.regex.test(sanitized)) {
      matchedInjectionRule = true;
      score += rule.weight;
      reasonsSet.add(`detected:${rule.id}`);
    }
  }

  for (const rewrite of REWRITE_RULES) {
    const updated = sanitized.replace(rewrite.regex, rewrite.replacement);
    if (updated !== sanitized) {
      changed = true;
      sanitized = updated;
    }
  }

  if (!sanitized) {
    changed = true;
    score += 1;
    reasonsSet.add('empty_after_scrub');
    sanitized = EMPTY_COMMENT_TOKEN;
  }

  const blocked = matchedInjectionRule || score >= BLOCK_SCORE_THRESHOLD;
  if (blocked) {
    changed = true;
    if (matchedInjectionRule) {
      reasonsSet.add('blocked_by_detected_injection_rule');
    } else {
      reasonsSet.add('blocked_by_score_threshold');
    }
    sanitized = BLOCKED_COMMENT_TOKEN;
  }

  const sanitizedLength = Array.from(sanitized).length;

  return {
    sanitized,
    blocked,
    changed,
    score,
    reasons: Array.from(reasonsSet.values()),
    original_length: originalLength,
    sanitized_length: sanitizedLength
  };
}

function sanitizeCommentFields(data) {
  const reports = [];

  function recursive(value, currentPath, inCommentContext) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) {
        const childPath = joinPath(currentPath, key);
        const nextInComment = inCommentContext || isCommentField(key);
        const updated = recursive(child, childPath, nextInComment);
        value[key] = updated;
      }
      return value;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const childPath = `${currentPath}[${i}]`;
        value[i] = recursive(value[i], childPath, inCommentContext);
      }
      return value;
    }

    if (typeof value === 'string') {
      if (!inCommentContext) return value;
      const outcome = sanitizeCommentText(value);
      reports.push({
        field_path: currentPath,
        blocked: outcome.blocked,
        changed: outcome.changed,
        score: outcome.score,
        reasons: outcome.reasons,
        original_length: outcome.original_length,
        sanitized_length: outcome.sanitized_length
      });
      return outcome.sanitized;
    }

    return value;
  }

  recursive(data, 'data', false);
  return reports;
}

async function discoverLearningFolders(databasesRoot) {
  const result = [];
  const stack = [databasesRoot];

  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(current, entry.name);
      if (entry.name.startsWith('__04_lernings_')) {
        result.push(entryPath);
        continue;
      }
      stack.push(entryPath);
    }
  }

  result.sort();
  return result;
}

async function cleanupPreviousLearningExports(learningFolders) {
  for (const folder of learningFolders) {
    const exportDir = path.join(folder, LEARNING_EXPORT_SUBDIR);
    if (await fileExists(exportDir)) {
      await rm(exportDir, { recursive: true, force: true });
    }
  }
}

function normalizeRepoCandidatePath(candidate) {
  const trimmed = String(candidate || '').trim();
  if (!trimmed) return null;
  if (trimmed.includes('://')) return null;

  const normalized = trimmed.replace(/\\/g, '/');
  if (path.isAbsolute(normalized)) return normalized;
  return normalized.replace(/^\/+/, '');
}

async function findLearningChildDirectory(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (_) {
    return null;
  }

  const learningDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('__04_lernings_'))
    .map((entry) => path.join(dir, entry.name))
    .sort();

  return learningDirs.length ? learningDirs[0] : null;
}

async function resolveLearningFolderFromCandidate(repoRoot, candidate) {
  const normalized = normalizeRepoCandidatePath(candidate);
  if (!normalized) return null;

  let absolute = path.isAbsolute(normalized) ? normalized : path.join(repoRoot, normalized);

  const initialStat = await safeStat(absolute);
  const hasExtension = !!path.extname(absolute);
  if ((!initialStat && hasExtension) || (initialStat && initialStat.isFile())) {
    absolute = path.dirname(absolute);
  }

  const base = path.basename(absolute);
  if (base.startsWith('__04_lernings_')) {
    const st = await safeStat(absolute);
    if (st && st.isDirectory()) return absolute;
  }

  let cursor = absolute;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const st = await safeStat(cursor);
    if (st && st.isDirectory()) {
      const found = await findLearningChildDirectory(cursor);
      if (found) return found;
    }

    const resolvedCursor = path.resolve(cursor);
    const resolvedRoot = path.resolve(repoRoot);
    if (resolvedCursor === resolvedRoot) break;

    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return null;
}

function pushCandidatePath(obj, key, out) {
  if (!obj || typeof obj !== 'object') return;
  const value = obj[key];
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!trimmed) return;
  out.push(trimmed);
}

async function resolveLearningFolderForFeedback(repoRoot, dataObj) {
  const candidates = [];

  if (dataObj && typeof dataObj === 'object' && dataObj.context && typeof dataObj.context === 'object') {
    pushCandidatePath(dataObj.context, 'folderPath', candidates);
    pushCandidatePath(dataObj.context, 'gamePath', candidates);
    pushCandidatePath(dataObj.context, 'jsonPath', candidates);
  }

  pushCandidatePath(dataObj, 'folderPath', candidates);
  pushCandidatePath(dataObj, 'gamePath', candidates);
  pushCandidatePath(dataObj, 'jsonPath', candidates);

  for (const candidate of candidates) {
    const resolved = await resolveLearningFolderFromCandidate(repoRoot, candidate);
    if (resolved) return resolved;
  }

  return null;
}

function pathToRepoRelative(repoRoot, absolute) {
  try {
    const rel = path.relative(repoRoot, absolute);
    return rel.replace(/\\/g, '/');
  } catch (_) {
    return String(absolute || '').replace(/\\/g, '/');
  }
}

function sanitizeFileComponent(input) {
  const raw = String(input || '');
  let out = '';
  for (const ch of raw) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-' || ch === '_') {
      out += ch;
    } else {
      out += '_';
    }
  }

  const collapsed = out.replace(/^_+|_+$/g, '');
  return collapsed ? collapsed : 'unknown';
}

async function exportFeedbackToLearningFolders(repoRoot, mappedDocs) {
  const learningFolders = await discoverLearningFolders(path.join(repoRoot, 'databases'));
  await cleanupPreviousLearningExports(learningFolders);

  const writtenPaths = [];
  const usedPaths = new Set();
  let filteredFeedbacks = 0;
  let unresolvedFolderFeedbacks = 0;

  for (const doc of mappedDocs) {
    const docId = String(doc.id || '').trim();
    const dataObj = doc && doc.data && typeof doc.data === 'object' ? doc.data : null;
    if (!dataObj) {
      filteredFeedbacks += 1;
      continue;
    }

    const blockedFields = Number(doc?.commentSecurity?.blockedFields || 0);
    const commentText = typeof dataObj.comment === 'string' ? dataObj.comment.trim() : '';

    if (
      blockedFields > 0 ||
      !commentText ||
      commentText === BLOCKED_COMMENT_TOKEN ||
      commentText === EMPTY_COMMENT_TOKEN
    ) {
      filteredFeedbacks += 1;
      continue;
    }

    const learningFolder = await resolveLearningFolderForFeedback(repoRoot, dataObj);
    if (!learningFolder) {
      unresolvedFolderFeedbacks += 1;
      continue;
    }

    const exportDir = path.join(learningFolder, LEARNING_EXPORT_SUBDIR);
    await mkdir(exportDir, { recursive: true });

    const safeId = sanitizeFileComponent(docId || 'unknown');
    let targetPath = path.join(exportDir, `feedback_${safeId}.json`);
    let suffix = 2;

    // Ensure uniqueness inside one run.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = String(targetPath);
      if (!usedPaths.has(key)) {
        usedPaths.add(key);
        break;
      }
      targetPath = path.join(exportDir, `feedback_${safeId}_${suffix}.json`);
      suffix += 1;
    }

    const exportPayload = {
      id: docId || null,
      source: dataObj.source ?? null,
      comment: dataObj.comment ?? null,
      createdAtIso: dataObj.createdAtIso ?? null,
      context: dataObj.context ?? null,
      commentSecurity: doc.commentSecurity ?? null
    };

    await writeFile(targetPath, JSON.stringify(exportPayload, null, 2), 'utf8');
    writtenPaths.push(targetPath);
  }

  writtenPaths.sort();

  return {
    checkedDocuments: mappedDocs.length,
    exportedFeedbacks: writtenPaths.length,
    filteredFeedbacks,
    unresolvedFolderFeedbacks,
    writtenPaths
  };
}

async function writeFeedbackProtocolFile(repoRoot, writtenPaths) {
  const protocolPath = path.join(repoRoot, PROTOCOL_RELATIVE_PATH);
  await mkdir(path.dirname(protocolPath), { recursive: true });

  const lines = writtenPaths.map((p) => pathToRepoRelative(repoRoot, p)).sort();
  const content = lines.length ? `${lines.join('\n')}\n` : '';

  await writeFile(protocolPath, content, 'utf8');
}

async function main() {
  const repoRoot = await findRepoRoot(process.cwd());

  const serviceAccountPath = path.join(repoRoot, SERVICE_ACCOUNT_FILE);
  const { projectId, clientEmail, privateKey } = await readServiceAccountFromFile(serviceAccountPath);

  const { app, firestore } = await loadFirebaseAdmin();
  const { initializeApp, cert, getApps } = app;
  const { getFirestore, FieldPath, Timestamp } = firestore;

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId
    });
  }

  const db = getFirestore();

  const mappedDocs = [];

  let totalCommentFields = 0;
  let totalChangedFields = 0;
  let totalBlockedFields = 0;
  let docsWithBlockedComments = 0;

  let lastDoc = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db.collection(COLLECTION_NAME).orderBy(FieldPath.documentId()).limit(FIRESTORE_PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const docSnap of snapshot.docs) {
      const docId = docSnap.id;
      const name = `projects/${projectId}/databases/(default)/documents/${COLLECTION_NAME}/${docId}`;

      const rawData = docSnap.data() || {};
      const data = normalizeFirestoreValue(rawData, Timestamp);

      const reports = sanitizeCommentFields(data);

      const commentFieldCount = reports.length;
      const changedCount = reports.filter((r) => r.changed).length;
      const blockedCount = reports.filter((r) => r.blocked).length;

      totalCommentFields += commentFieldCount;
      totalChangedFields += changedCount;
      totalBlockedFields += blockedCount;
      if (blockedCount > 0) docsWithBlockedComments += 1;

      mappedDocs.push({
        id: docId,
        name,
        createTime: docSnap.createTime ? docSnap.createTime.toDate().toISOString() : '',
        updateTime: docSnap.updateTime ? docSnap.updateTime.toDate().toISOString() : '',
        data,
        commentSecurity: {
          sanitizerVersion: SANITIZER_VERSION,
          commentFieldsChecked: commentFieldCount,
          changedFields: changedCount,
          blockedFields: blockedCount,
          reports
        }
      });

      lastDoc = docSnap;
    }

    if (snapshot.size < FIRESTORE_PAGE_SIZE) break;
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const payload = {
    projectId,
    collection: COLLECTION_NAME,
    downloadedAtUnix: nowUnix,
    documentCount: mappedDocs.length,
    security: {
      sanitizerVersion: SANITIZER_VERSION,
      commentFieldsChecked: totalCommentFields,
      changedFields: totalChangedFields,
      blockedFields: totalBlockedFields,
      documentsWithBlockedComments: docsWithBlockedComments,
      blockScoreThreshold: BLOCK_SCORE_THRESHOLD,
      commentMaxChars: COMMENT_MAX_CHARS
    },
    documents: mappedDocs
  };

  const exportSummary = await exportFeedbackToLearningFolders(repoRoot, mappedDocs);
  await writeFeedbackProtocolFile(repoRoot, exportSummary.writtenPaths);

  payload.learningExport = {
    checkedDocuments: exportSummary.checkedDocuments,
    exportedFeedbacks: exportSummary.exportedFeedbacks,
    filteredFeedbacks: exportSummary.filteredFeedbacks,
    unresolvedFolderFeedbacks: exportSummary.unresolvedFolderFeedbacks,
    exportSubdir: LEARNING_EXPORT_SUBDIR,
    protocolFile: PROTOCOL_RELATIVE_PATH,
    writtenPaths: exportSummary.writtenPaths.map((p) => pathToRepoRelative(repoRoot, p))
  };

  const outputPath = path.join(repoRoot, OUTPUT_RELATIVE_PATH);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  // Keep output minimal; avoid logging secrets.
  // eslint-disable-next-line no-console
  console.log(
    `Downloaded ${mappedDocs.length} documents, exported ${exportSummary.exportedFeedbacks} feedback files, wrote ${pathToRepoRelative(repoRoot, outputPath)}`
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
