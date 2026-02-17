#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const plannerRoot = path.join(root, '__agent_dont_push', 'Team-Code-Writing', '__02_planer');
const helperDir = path.join(plannerRoot, 'hilfsmittel');

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function rel(p) {
  return toPosix(path.relative(root, p));
}

function escText(s) {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim().replace(/"/g, "'");
}

function shortList(items, maxItems = 3, maxChars = 90) {
  if (!items || items.length === 0) return '(none)';
  const shown = items.slice(0, maxItems);
  let txt = shown.join(', ');
  if (items.length > maxItems) {
    txt += `, +${items.length - maxItems} more`;
  }
  if (txt.length > maxChars) {
    txt = `${txt.slice(0, maxChars - 3)}...`;
  }
  return escText(txt);
}

function extractTitle(htmlText, fallback) {
  const m = htmlText.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return fallback;
  const cleaned = escText(m[1]);
  return cleaned || fallback;
}

function extractScriptSrc(htmlText) {
  const out = [];
  const re = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(htmlText)) !== null) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

function extractStyleHref(htmlText) {
  const out = [];
  const re = /<link[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(htmlText)) !== null) {
    const rawTag = m[0];
    if (!/rel=["']stylesheet["']/i.test(rawTag)) continue;
    out.push(m[1]);
  }
  return [...new Set(out)];
}

function extractFetchTargets(jsText) {
  const out = [];
  const re = /fetch\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  let m;
  while ((m = re.exec(jsText)) !== null) {
    out.push(m[1]);
  }
  return [...new Set(out)];
}

function listDirectFilesByExt(dir, ext) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(ext))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'de'));
}

function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const curr = stack.pop();
    const entries = fs.readdirSync(curr, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(curr, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }
  return count;
}

function buildUseCaseDiagram(info) {
  const lines = [];
  lines.push('@startuml');
  lines.push(`title Use-Case-Diagramm: ${escText(info.title)}`);
  lines.push('left to right direction');
  lines.push('skinparam shadowing false');
  lines.push('');
  lines.push('actor "Spieler" as Player');
  if (info.hasTester) {
    lines.push('actor "Tester" as Tester');
  }
  if (info.hasDataActor) {
    lines.push('actor "Datenquelle" as DataSource');
  }
  if (info.hasThemeActor) {
    lines.push('actor "Theme-Service" as ThemeSvc');
  }
  if (info.hasStyleActor) {
    lines.push('actor "Style-CDN" as StyleCDN');
  }
  lines.push('');
  lines.push(`rectangle "System: ${escText(info.dirName)}" as SystemBoundary {`);
  lines.push('  usecase "Spiel starten" as UC_Start');
  if (info.hasDataActor) {
    lines.push('  usecase "Spielinhalte laden" as UC_LoadData');
  }
  if (info.hasThemeActor) {
    lines.push('  usecase "Theme anwenden" as UC_ApplyTheme');
  }
  if (info.hasStyleActor) {
    lines.push('  usecase "Externe Styles laden" as UC_LoadStyles');
  }
  lines.push('  usecase "Aufgaben bearbeiten" as UC_Play');
  lines.push('  usecase "Feedback erhalten" as UC_Feedback');
  lines.push('  usecase "Punkte/Fortschritt sehen" as UC_Progress');
  lines.push('  usecase "Runde abschliessen" as UC_Finish');
  lines.push('  usecase "Neu starten" as UC_Restart');
  if (info.hasTester) {
    lines.push('  usecase "Spielablauf verifizieren" as UC_Verify');
  }
  lines.push('}');
  lines.push('');
  lines.push('Player --> UC_Start');
  lines.push('Player --> UC_Play');
  lines.push('Player --> UC_Progress');
  lines.push('Player --> UC_Finish');
  lines.push('Player --> UC_Restart');
  if (info.hasDataActor) {
    lines.push('DataSource --> UC_LoadData');
  }
  if (info.hasThemeActor) {
    lines.push('ThemeSvc --> UC_ApplyTheme');
  }
  if (info.hasStyleActor) {
    lines.push('StyleCDN --> UC_LoadStyles');
  }
  if (info.hasTester) {
    lines.push('Tester --> UC_Verify');
  }
  lines.push('');
  if (info.hasDataActor) {
    lines.push('UC_Start .> UC_LoadData : <<include>>');
  }
  if (info.hasThemeActor) {
    lines.push('UC_Start .> UC_ApplyTheme : <<include>>');
  }
  if (info.hasStyleActor) {
    lines.push('UC_Start .> UC_LoadStyles : <<include>>');
  }
  lines.push('UC_Play .> UC_Feedback : <<include>>');
  lines.push('UC_Play .> UC_Progress : <<include>>');
  lines.push('UC_Finish .> UC_Progress : <<include>>');
  lines.push('UC_Restart .> UC_Start : <<include>>');
  if (info.hasTester) {
    lines.push('UC_Verify .> UC_Start : <<include>>');
    lines.push('UC_Verify .> UC_Play : <<include>>');
  }
  lines.push('');
  lines.push('note bottom');
  lines.push(`Quelle: ${escText(info.dirRel)}`);
  lines.push(`Dateien: ${info.htmlCount} HTML, ${info.jsCount} JS, ${info.cssCount} CSS, ${info.cjsCount} CJS`);
  if (info.fetchTargets.length > 0) {
    lines.push(`Fetch-Ziele: ${shortList(info.fetchTargets, 3, 95)}`);
  }
  lines.push('end note');
  lines.push('@enduml');
  lines.push('');
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(helperDir)) {
    fs.mkdirSync(helperDir, { recursive: true });
  }

  const htmlFiles = walk(root).sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
  const byDir = new Map();

  for (const htmlFile of htmlFiles) {
    const dir = path.dirname(htmlFile);
    const planDir = path.join(dir, '__dokumentation', '__02_plans');
    if (!fs.existsSync(planDir)) continue;
    if (dir === root) continue;

    if (!byDir.has(dir)) {
      byDir.set(dir, []);
    }
    byDir.get(dir).push(htmlFile);
  }

  const dirs = [...byDir.keys()].sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
  const report = [];

  for (const dir of dirs) {
    const htmlCandidates = byDir.get(dir).sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
    const htmlText = fs.readFileSync(htmlCandidates[0], 'utf8');

    const jsFiles = listDirectFilesByExt(dir, '.js');
    const cssFiles = listDirectFilesByExt(dir, '.css');
    const cjsFiles = listDirectFilesByExt(dir, '.cjs');

    const scriptSrc = extractScriptSrc(htmlText);
    const styleHref = extractStyleHref(htmlText);
    const sharedScripts = scriptSrc.filter((src) => src.startsWith('/') || /^https?:\/\//i.test(src));
    const externalStyles = styleHref.filter((href) => href.startsWith('/') || /^https?:\/\//i.test(href));

    const fetchTargets = [];
    for (const jsFile of jsFiles) {
      const jsText = fs.readFileSync(path.join(dir, jsFile), 'utf8');
      for (const target of extractFetchTargets(jsText)) {
        fetchTargets.push(target);
      }
    }
    const uniqueFetchTargets = [...new Set(fetchTargets)].sort((a, b) => a.localeCompare(b, 'de'));

    const dataCount = countFilesRecursive(path.join(dir, 'data'));
    const title = extractTitle(htmlText, path.basename(dir));
    const outFile = path.join(dir, '__dokumentation', '__02_plans', '__use_case_diagram.puml');

    const puml = buildUseCaseDiagram({
      title,
      dirName: path.basename(dir),
      dirRel: rel(dir),
      htmlCount: htmlCandidates.length,
      jsCount: jsFiles.length,
      cssCount: cssFiles.length,
      cjsCount: cjsFiles.length,
      fetchTargets: uniqueFetchTargets,
      hasTester: cjsFiles.length > 0,
      hasDataActor: dataCount > 0 || uniqueFetchTargets.length > 0,
      hasThemeActor: sharedScripts.some((s) => s.includes('theme_bridge')),
      hasStyleActor: externalStyles.length > 0
    });

    fs.writeFileSync(outFile, puml, 'utf8');

    report.push({
      dir: rel(dir),
      html: htmlCandidates.length,
      js: jsFiles.length,
      css: cssFiles.length,
      cjs: cjsFiles.length,
      data: dataCount,
      fetch: uniqueFetchTargets.length,
      shared: sharedScripts.length,
      puml: rel(outFile)
    });
  }

  const targetsOut = path.join(helperDir, 'use_case_targets.txt');
  fs.writeFileSync(targetsOut, dirs.map((d) => rel(d)).join('\n') + '\n', 'utf8');

  const reportOut = path.join(helperDir, 'use_case_generation_report.tsv');
  const rows = ['dir\thtml\tjs\tcss\tcjs\tdata\tfetch\tshared\tpuml'];
  for (const row of report) {
    rows.push([row.dir, row.html, row.js, row.css, row.cjs, row.data, row.fetch, row.shared, row.puml].join('\t'));
  }
  fs.writeFileSync(reportOut, rows.join('\n') + '\n', 'utf8');

  console.log(`Generated ${report.length} use-case diagrams.`);
}

main();
