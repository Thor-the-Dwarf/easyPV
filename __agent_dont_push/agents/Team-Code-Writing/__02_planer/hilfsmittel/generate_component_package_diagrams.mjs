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

function shortList(items, maxItems = 3, maxChars = 80) {
  if (!items || items.length === 0) return '(keine)';
  const shown = items.slice(0, maxItems);
  let txt = shown.join(', ');
  if (items.length > maxItems) {
    txt += `, +${items.length - maxItems} weitere`;
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

function buildDiagram(info) {
  const lines = [];
  lines.push('@startuml');
  lines.push(`title Komponenten-/Package-Diagramm: ${escText(info.title)}`);
  lines.push('left to right direction');
  lines.push('skinparam packageStyle rectangle');
  lines.push('skinparam componentStyle rectangle');
  lines.push('skinparam shadowing false');
  lines.push('');
  lines.push(`package "Ordner: ${escText(info.dirName)}" as Scope {`);
  lines.push(`  component "HTML Entry\\n${shortList(info.htmlFiles, 3, 90)}" as HTML`);

  if (info.jsFiles.length > 0) {
    lines.push(`  component "Game-Logik (JS)\\n${shortList(info.jsFiles, 3, 90)}" as JS`);
  }
  if (info.cssFiles.length > 0) {
    lines.push(`  component "Styles (CSS)\\n${shortList(info.cssFiles, 3, 90)}" as CSS`);
  }
  if (info.cjsFiles.length > 0) {
    lines.push(`  component "Checks/Tools (CJS)\\n${shortList(info.cjsFiles, 3, 90)}" as CJS`);
  }
  if (info.localJsonFiles.length > 0) {
    lines.push(`  component "Lokale JSON-Dateien\\n${shortList(info.localJsonFiles, 3, 90)}" as JSONLOCAL`);
  }
  if (info.sharedScripts.length > 0) {
    lines.push(`  component "Shared Scripts\\n${shortList(info.sharedScripts, 2, 90)}" as SHAREDJS`);
  }
  if (info.externalStyles.length > 0) {
    lines.push(`  component "Externe Styles\\n${shortList(info.externalStyles, 2, 90)}" as EXTCSS`);
  }
  lines.push('  package "Ressourcen" as RES {');
  lines.push(`    database "_data/\\n${info.dataCount} Dateien" as DATA`);
  lines.push(`    folder "_assets/\\n${info.assetsCount} Dateien" as ASSETS`);
  lines.push('  }');
  lines.push('  package "Dokumentation" as DOC {');
  lines.push('    folder "__dokumentation/__02_plans" as PLAN');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  if (info.jsFiles.length > 0) {
    lines.push('HTML --> JS : laedt Script');
  }
  if (info.cssFiles.length > 0) {
    lines.push('HTML --> CSS : laedt Styles');
  }
  if (info.sharedScripts.length > 0) {
    lines.push('HTML --> SHAREDJS : bindet Shared Runtime ein');
  }
  if (info.externalStyles.length > 0) {
    lines.push('HTML --> EXTCSS : bindet externe Styles ein');
  }
  if (info.localJsonFiles.length > 0) {
    if (info.jsFiles.length > 0) {
      lines.push('JS --> JSONLOCAL : liest lokale JSON');
    } else {
      lines.push('HTML --> JSONLOCAL : nutzt lokale JSON');
    }
  }
  if (info.jsFiles.length > 0) {
    lines.push('JS --> DATA : liest Konfig/Leveldaten');
    lines.push('JS --> ASSETS : nutzt Laufzeit-Assets');
  } else {
    lines.push('HTML --> DATA : nutzt Daten');
  }
  lines.push('HTML --> ASSETS : nutzt statische Assets');

  if (info.cjsFiles.length > 0 && info.jsFiles.length > 0) {
    lines.push('CJS ..> JS : validiert/verifiziert');
  }

  if (info.fetchTargets.length > 0 && info.jsFiles.length > 0) {
    lines.push('');
    lines.push('note right of JS');
    lines.push(`fetch()-Ziele: ${shortList(info.fetchTargets, 3, 90)}`);
    lines.push('end note');
  }

  lines.push('');
  lines.push('note bottom');
  lines.push(`Quelle: ${escText(info.dirRel)}`);
  lines.push(`Dateien: ${info.htmlFiles.length} HTML, ${info.jsFiles.length} JS, ${info.cssFiles.length} CSS, ${info.cjsFiles.length} CJS`);
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
    const htmlFilesInDir = htmlCandidates.map((p) => path.basename(p));
    const htmlText = fs.readFileSync(htmlCandidates[0], 'utf8');

    const jsFiles = listDirectFilesByExt(dir, '.js');
    const cssFiles = listDirectFilesByExt(dir, '.css');
    const cjsFiles = listDirectFilesByExt(dir, '.cjs');
    const localJsonFiles = listDirectFilesByExt(dir, '.json');

    const scriptSrc = extractScriptSrc(htmlText);
    const styleHref = extractStyleHref(htmlText);

    const sharedScripts = scriptSrc.filter((src) => src.startsWith('/') || /^https?:\/\//i.test(src));
    const externalStyles = styleHref.filter((href) => href.startsWith('/') || /^https?:\/\//i.test(href));

    const fetchTargets = [];
    for (const jsFile of jsFiles) {
      const jsPath = path.join(dir, jsFile);
      const jsText = fs.readFileSync(jsPath, 'utf8');
      for (const target of extractFetchTargets(jsText)) {
        fetchTargets.push(target);
      }
    }
    const uniqueFetchTargets = [...new Set(fetchTargets)].sort((a, b) => a.localeCompare(b, 'de'));

    const title = extractTitle(htmlText, path.basename(dir));
    const outFile = path.join(dir, '__dokumentation', '__02_plans', '__component_package_diagram.puml');

    const puml = buildDiagram({
      title,
      dirName: path.basename(dir),
      dirRel: rel(dir),
      htmlFiles: htmlFilesInDir,
      jsFiles,
      cssFiles,
      cjsFiles,
      localJsonFiles,
      sharedScripts,
      externalStyles,
      fetchTargets: uniqueFetchTargets,
      dataCount: countFilesRecursive(path.join(dir, '_data')),
      assetsCount: countFilesRecursive(path.join(dir, '_assets'))
    });

    fs.writeFileSync(outFile, puml, 'utf8');

    report.push({
      dir: rel(dir),
      html: htmlFilesInDir.length,
      js: jsFiles.length,
      css: cssFiles.length,
      cjs: cjsFiles.length,
      data: countFilesRecursive(path.join(dir, '_data')),
      assets: countFilesRecursive(path.join(dir, '_assets')),
      puml: rel(outFile)
    });
  }

  const targetsOut = path.join(helperDir, 'component_package_targets.txt');
  fs.writeFileSync(targetsOut, dirs.map((d) => rel(d)).join('\n') + '\n', 'utf8');

  const reportOut = path.join(helperDir, 'component_package_generation_report.tsv');
  const rows = ['dir\thtml\tjs\tcss\tcjs\tdata\tassets\tpuml'];
  for (const row of report) {
    rows.push([row.dir, row.html, row.js, row.css, row.cjs, row.data, row.assets, row.puml].join('\t'));
  }
  fs.writeFileSync(reportOut, rows.join('\n') + '\n', 'utf8');

  console.log(`Generated ${report.length} component/package diagrams.`);
}

main();
