import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasesRoot = path.resolve(__dirname, '../..');

async function walkDoingDirs(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('__02_doing_')) {
      out.push(full);
      continue;
    }
    await walkDoingDirs(full, out);
  }
  return out;
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => e.name);
}

function isGameHtml(name) {
  return /^(?:_?game_|_ghtml_).+\.html$/i.test(name);
}

function isGameJs(name) {
  return /^(?:_?game_|_gjs_).+\.js$/i.test(name);
}

function isGameJson(name) {
  return /^(?:_?game_|_gjs_|_g(?:g)?\d+_).+\.json$/i.test(name);
}

function extractLocalScriptSrcs(html) {
  return [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => m[1])
    .filter((src) => src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//'));
}

function hasContentShape(jsonValue) {
  if (Array.isArray(jsonValue)) return jsonValue.length > 0;
  if (!jsonValue || typeof jsonValue !== 'object') return false;
  return Object.keys(jsonValue).length > 0;
}

describe('Core Rules for __02_doing_* Games', () => {
  it('rule set A: each game folder matches a valid archetype', async () => {
    const doingDirs = await walkDoingDirs(databasesRoot);
    assert.ok(doingDirs.length > 0, 'expected __02_doing_* folders');

    for (const dir of doingDirs) {
      const files = await listFiles(dir);
      const html = files.filter(isGameHtml);
      const js = files.filter(isGameJs);
      const json = files.filter(isGameJson);

      const isPlayable = html.length > 0;
      const isDataOnly = html.length === 0 && js.length === 0 && json.length > 0;

      if (isPlayable) {
        assert.ok(js.length > 0, `playable folder missing game/_g*.js in ${dir}`);
        assert.ok(json.length > 0, `playable folder missing game/_g*.json in ${dir}`);
      } else {
        assert.ok(isDataOnly, `folder is neither playable nor data-only: ${dir}`);
      }
    }
  });

  it('rule set B: each game html references at least one local script', async () => {
    const doingDirs = await walkDoingDirs(databasesRoot);

    for (const dir of doingDirs) {
      const files = await listFiles(dir);
      const htmlFiles = files.filter(isGameHtml);

      for (const htmlFile of htmlFiles) {
        const content = await readFile(path.join(dir, htmlFile), 'utf8');
        const scripts = extractLocalScriptSrcs(content);
        assert.ok(scripts.length > 0, `no local script src found in ${path.join(dir, htmlFile)}`);
      }
    }
  });

  it('rule set C: game json files are parseable and contain useful game structure', async () => {
    const doingDirs = await walkDoingDirs(databasesRoot);

    for (const dir of doingDirs) {
      const files = await listFiles(dir);
      const jsonFiles = files.filter(isGameJson);

      for (const jsonFile of jsonFiles) {
        const full = path.join(dir, jsonFile);
        const raw = await readFile(full, 'utf8');

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          assert.fail(`invalid JSON in ${full}`);
        }

        assert.ok(hasContentShape(parsed), `game json lacks expected structure: ${full}`);
      }
    }
  });

  it('rule set D: if game_x.html exists, game_x.js must exist too', async () => {
    const doingDirs = await walkDoingDirs(databasesRoot);

    for (const dir of doingDirs) {
      const files = await listFiles(dir);
      const jsSet = new Set(files.filter(isGameJs));
      const htmlFiles = files.filter(isGameHtml);

      for (const html of htmlFiles) {
        const jsCandidate = html.startsWith('_ghtml_')
          ? html.replace(/^_ghtml_/i, '_gjs_').replace(/\.html$/i, '.js')
          : html.replace(/\.html$/i, '.js');
        const altJsCandidate = jsCandidate.startsWith('_game_')
          ? jsCandidate.slice(1)
          : `_${jsCandidate}`;
        assert.ok(
          jsSet.has(jsCandidate) || jsSet.has(altJsCandidate),
          `missing sibling JS for ${path.join(dir, html)}`
        );
      }
    }
  });
});
