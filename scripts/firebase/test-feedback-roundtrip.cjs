#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { chromium } = require('playwright');

const workspaceRoot = path.resolve(__dirname, '..', '..');
const testOutputDir = path.join(workspaceRoot, 'output', 'firebase-feedback-test');

const testConfig = {
  folderLabel: 'Protokoll anfertigen _',
  jsonRel:
    'databases/Teil02 FIAE/database/Anforderungen, Analyse, Projekt & Prozess/Erschienene Themen/Protokoll anfertigen _/__02_doing_Protokoll anfertigen _/_gg01_inhalts_check.json',
  gameRel:
    'databases/Teil02 FIAE/database/Anforderungen, Analyse, Projekt & Prozess/Erschienene Themen/Protokoll anfertigen _/__02_doing_Protokoll anfertigen _/_ghtml_inhalts_check.html',
  nodeId: 'feedback_roundtrip_test_protokoll'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function encodeRepoPath(relPath) {
  return String(relPath || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function waitForServer(baseUrl, timeoutMs) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { method: 'GET' });
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await sleep(200);
  }

  const detail = lastError && lastError.message ? lastError.message : 'timeout';
  throw new Error('HTTP server not reachable: ' + detail);
}

function buildGenericPageUrl(baseUrl, cfg) {
  const params = new URLSearchParams();
  params.set('folder', cfg.folderLabel);
  params.set('jsonRel', cfg.jsonRel);
  params.set('gameRel', cfg.gameRel);
  params.set('nodeId', cfg.nodeId);
  params.set('theme', 'dark');

  const jsonUrl = new URL(encodeRepoPath(cfg.jsonRel), baseUrl).href;
  const gameUrl = new URL(encodeRepoPath(cfg.gameRel), baseUrl).href;

  params.set('json', jsonUrl);
  params.set('game', gameUrl);

  return new URL('generic_pages/generic_page.html?' + params.toString(), baseUrl).href;
}

async function installFeedbackCapture(page) {
  await page.waitForFunction(
    () => !!(window.EasyPvFirebaseFeedback && typeof window.EasyPvFirebaseFeedback.submitFeedback === 'function'),
    { timeout: 25000 }
  );

  await page.evaluate(() => {
    if (window.__feedbackCaptureInstalled) return;

    window.__feedbackCaptures = [];
    const originalSubmit = window.EasyPvFirebaseFeedback.submitFeedback;

    window.EasyPvFirebaseFeedback.submitFeedback = async function wrappedSubmit(payload) {
      const payloadClone = JSON.parse(JSON.stringify(payload || {}));
      const result = await originalSubmit(payload);
      const resultClone = JSON.parse(JSON.stringify(result || {}));
      window.__feedbackCaptures.push({ payload: payloadClone, result: resultClone });
      return result;
    };

    window.__feedbackCaptureInstalled = true;
  });
}

async function sendFeedback(page, commentText) {
  await page.click('#fab-feedback');
  await page.waitForSelector('#feedback-modal-layer:not([hidden])', { timeout: 8000 });
  await page.fill('#feedback-comment-input', commentText);
  await page.click('#feedback-send-btn');

  await page.waitForFunction(
    () => {
      const status = document.getElementById('feedback-modal-status');
      return status && /Danke, Feedback wurde gespeichert\./.test(status.textContent || '');
    },
    { timeout: 30000 }
  );
}

async function collectStoredFeedbackDocs(page) {
  return await page.evaluate(async () => {
    const captures = Array.isArray(window.__feedbackCaptures) ? window.__feedbackCaptures.slice() : [];
    const status = window.EasyPvFirebaseFeedback && typeof window.EasyPvFirebaseFeedback.getStatus === 'function'
      ? window.EasyPvFirebaseFeedback.getStatus()
      : null;
    const collection = status && status.collection ? status.collection : null;

    if (!collection || !window.firebase || !window.firebase.firestore) {
      return {
        collection,
        captures,
        fetched: [],
        error: 'Firestore client unavailable on page context'
      };
    }

    const db = window.firebase.firestore();
    const fetched = [];

    for (let i = 0; i < captures.length; i += 1) {
      const capture = captures[i];
      const docId = capture && capture.result && capture.result.id ? capture.result.id : null;
      if (!docId) continue;

      try {
        const snap = await db.collection(collection).doc(docId).get();
        if (!snap.exists) {
          fetched.push({ id: docId, exists: false, data: null });
          continue;
        }
        fetched.push({
          id: docId,
          exists: true,
          data: snap.data()
        });
      } catch (error) {
        fetched.push({ id: docId, exists: false, data: null, error: String(error && error.message ? error.message : error) });
      }
    }

    return {
      collection,
      captures,
      fetched,
      error: null
    };
  });
}

async function run() {
  const port = Number(process.env.FEEDBACK_TEST_PORT || 4283);
  const baseUrl = `http://localhost:${port}/`;
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const commentGeneric = `[AUTO][generic][${timestamp}] Protokoll-Ordnerpfad pruefen`;
  const commentGame = `[AUTO][game][${timestamp}] Protokoll-Ordnerpfad+Titel pruefen`;

  ensureDir(testOutputDir);

  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: workspaceRoot,
    stdio: 'ignore'
  });

  let browser = null;

  try {
    await waitForServer(baseUrl, 20000);

    browser = await chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader']
    });

    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    const targetUrl = buildGenericPageUrl(baseUrl, testConfig);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#fab-feedback', { timeout: 10000 });

    await installFeedbackCapture(page);

    await sendFeedback(page, commentGeneric);
    await page.waitForTimeout(700);

    await page.click('#fab-practice');
    await page.waitForFunction(() => {
      const frame = document.getElementById('content-frame');
      return !!(frame && /_ghtml_inhalts_check\.html/.test(String(frame.getAttribute('src') || frame.src || '')));
    }, { timeout: 12000 });
    await page.waitForTimeout(900);

    await sendFeedback(page, commentGame);
    await page.waitForTimeout(700);

    const screenshotPath = path.join(testOutputDir, `feedback-roundtrip-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const roundtrip = await collectStoredFeedbackDocs(page);

    const result = {
      executedAtIso: new Date().toISOString(),
      baseUrl,
      targetUrl,
      comments: {
        generic: commentGeneric,
        game: commentGame
      },
      roundtrip
    };

    const resultPath = path.join(testOutputDir, `feedback-roundtrip-${timestamp}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    process.stdout.write(resultPath + '\n');
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {
        // ignore close errors
      }
    }

    if (server && !server.killed) {
      server.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
  process.exit(1);
});
