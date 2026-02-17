#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const plannerRoot = path.join(root, '__agent_dont_push', 'Team-Code-Writing', '__02_planer');
const helperDir = path.join(plannerRoot, 'hilfsmittel');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
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

function shortForLabel(s, max = 70) {
  if (!s) return '';
  const oneLine = escText(s);
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 3)}...`;
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
  return out;
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

function buildRedirectDiagram({ title, htmlRel, htmlName, enginePath, configPath }) {
  const engineLabel = shortForLabel(enginePath || '(nicht gesetzt)');
  const configLabel = shortForLabel(configPath || '(nicht gesetzt)');

  return `@startuml
 title ${escText(title)}
 autonumber
 actor Nutzer
 participant Browser
 participant "HTML Entry" as Entry
 participant "Redirect Script" as Router
 participant "Game Engine" as Engine
 database "Config JSON" as Config
 collections "Assets" as Assets
 
 Nutzer -> Browser: Seite oeffnen
 Browser -> Entry: GET ${escText(htmlName)}
 Entry --> Browser: HTML mit Inline-Script
 Browser -> Router: Script ausfuehren
 Router -> Router: enginePath + configPath lesen
 Router -> Engine: Redirect zu ${escText(engineLabel)}
 Engine -> Config: Lade ${escText(configLabel)}
 Config --> Engine: JSON-Konfiguration
 Engine -> Assets: Lade CSS/JS/Medien
 Assets --> Engine: Ressourcen bereit
 Engine --> Browser: Spieloberflaeche initialisiert
 
 note over Entry
 Quelle: ${escText(htmlRel)}
 end note
@enduml
`;
}

function buildDirectDiagram({ title, htmlRel, htmlName, jsSrcs, fetchTargets }) {
  const jsLabel = jsSrcs.length > 0
    ? shortForLabel(jsSrcs.map((s) => path.basename(s)).join(', '), 90)
    : '(kein lokales JS eingebunden)';

  const hasDataLoad = fetchTargets.length > 0;
  const dataLabel = hasDataLoad
    ? shortForLabel(fetchTargets.join(', '), 90)
    : '(keine fetch()-Quelle erkannt)';

  return `@startuml
 title ${escText(title)}
 autonumber
 actor Nutzer
 participant Browser
 participant "HTML Page" as Page
 participant "Game Script" as Game
 database "Data JSON" as Data
 collections "Assets" as Assets
 
 Nutzer -> Browser: Seite oeffnen
 Browser -> Page: GET ${escText(htmlName)}
 Page --> Browser: HTML + CSS/JS Referenzen
 Browser -> Assets: Statische Dateien laden
 Assets --> Browser: Styles und Medien bereit
 Browser -> Game: Lade ${escText(jsLabel)}
 Game -> Game: init() + Event-Handler
 ` + (hasDataLoad
    ? `Game -> Data: fetch ${escText(dataLabel)}
 Data --> Game: Konfig-/Leveldaten
 `
    : `opt Keine externe Datenquelle
 Game -> Game: Nutzt eingebettete/spaetere Daten
 end
 `) + `
 Nutzer -> Browser: Eingabe (Klick/Drag/Tap)
 Browser -> Game: UI-Event weiterleiten
 Game -> Game: Regeln pruefen + State aktualisieren
 Game --> Browser: DOM/HUD/Feedback aktualisieren
 
 note over Page
 Quelle: ${escText(htmlRel)}
 end note
@enduml
`;
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

    if (!fs.existsSync(planDir)) {
      continue;
    }

    if (dir === root) {
      continue;
    }

    if (!byDir.has(dir)) {
      byDir.set(dir, []);
    }
    byDir.get(dir).push(htmlFile);
  }

  const dirs = [...byDir.keys()].sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
  const report = [];

  for (const dir of dirs) {
    const htmlCandidates = byDir.get(dir).sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
    const htmlFile = htmlCandidates[0];
    const htmlText = fs.readFileSync(htmlFile, 'utf8');

    const htmlRel = rel(htmlFile);
    const htmlName = path.basename(htmlFile);
    const title = extractTitle(htmlText, path.basename(dir));

    const isRedirect = /window\.location\.(replace|assign)|window\.location\.href\s*=/.test(htmlText);
    const enginePath = (htmlText.match(/const\s+enginePath\s*=\s*["'`]([^"'`]+)["'`]/) || [])[1] || '';
    const configPath = (htmlText.match(/const\s+configPath\s*=\s*["'`]([^"'`]+)["'`]/) || [])[1] || '';

    const srcs = extractScriptSrc(htmlText)
      .filter((s) => !s.includes('theme_bridge.js'));

    const localJs = [];
    for (const src of srcs) {
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) continue;
      const resolved = path.resolve(dir, src);
      if (fs.existsSync(resolved) && resolved.toLowerCase().endsWith('.js')) {
        localJs.push({ src, resolved });
      }
    }

    const fetchTargets = [];
    for (const js of localJs) {
      const jsText = fs.readFileSync(js.resolved, 'utf8');
      for (const t of extractFetchTargets(jsText)) {
        fetchTargets.push(t);
      }
    }

    const uniqueFetchTargets = [...new Set(fetchTargets)];
    const puml = isRedirect
      ? buildRedirectDiagram({ title, htmlRel, htmlName, enginePath, configPath })
      : buildDirectDiagram({ title, htmlRel, htmlName, jsSrcs: localJs.map((j) => j.src), fetchTargets: uniqueFetchTargets });

    const outFile = path.join(dir, '__dokumentation', '__02_plans', '__sequence_diagram.puml');
    fs.writeFileSync(outFile, puml, 'utf8');

    report.push({
      dir: rel(dir),
      html: htmlRel,
      mode: isRedirect ? 'redirect' : 'direct',
      puml: rel(outFile)
    });
  }

  const targetList = dirs.map((d) => rel(d)).join('\n') + '\n';
  fs.writeFileSync(path.join(helperDir, 'sequence_targets.txt'), targetList, 'utf8');

  const csv = ['dir\thtml\tmode\tpuml'];
  for (const row of report) {
    csv.push([row.dir, row.html, row.mode, row.puml].join('\t'));
  }
  fs.writeFileSync(path.join(helperDir, 'sequence_generation_report.tsv'), csv.join('\n') + '\n', 'utf8');

  console.log(`Generated ${report.length} sequence diagrams.`);
}

main();
