import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');

const htmlPath = path.join(
  workspaceRoot,
  'databases/Teil01 Grundlagen/database/BWL/Auswahl & Bewertung/Erschienene Themen/Leasing/__02_doing_Leasing/_ghtml_finanzierungs_sortiermaschine.html'
);

const jsPath = path.join(
  workspaceRoot,
  'databases/Teil01 Grundlagen/database/BWL/Auswahl & Bewertung/Erschienene Themen/Leasing/__02_doing_Leasing/_gjs_finanzierungs_sortiermaschine.js'
);

function extractDelayConfig(jsCode) {
  const match = jsCode.match(/const\s+delay\s*=\s*isCorrect\s*\?\s*(\d+)\s*:\s*(\d+)\s*;/);
  if (!match) return null;
  return {
    correctMs: Number(match[1]),
    wrongMs: Number(match[2])
  };
}

describe('Learner UX: Finanzierungs-Sortiermaschine', () => {
  it('shows clear game goal and action hint in header', async () => {
    const html = await readFile(htmlPath, 'utf8');
    assert.match(html, /<h1>\s*Finanzierungs-Sortiermaschine\s*<\/h1>/i);
    assert.match(html, /Wische oder tippe schnell die richtige Kategorie\./i);
  });

  it('provides orientation elements (progress, score, streak)', async () => {
    const html = await readFile(htmlPath, 'utf8');
    assert.match(html, /id="sortier-progress"/);
    assert.match(html, /id="sortier-score"/);
    assert.match(html, /id="sortier-streak"/);
  });

  it('keeps answer transition delays learner-friendly (no long dead time)', async () => {
    const js = await readFile(jsPath, 'utf8');
    const delay = extractDelayConfig(js);
    assert.ok(delay, 'delay config not found');

    assert.ok(delay.correctMs <= 1200, `correct delay too long: ${delay.correctMs}ms`);
    assert.ok(delay.wrongMs <= 2200, `wrong delay too long: ${delay.wrongMs}ms`);
    assert.ok(delay.wrongMs >= delay.correctMs, 'wrong delay should not be shorter than correct delay');
  });
});
