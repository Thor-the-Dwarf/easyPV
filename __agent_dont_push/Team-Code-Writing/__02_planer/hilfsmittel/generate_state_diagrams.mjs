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
  return s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"/g, "'");
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

function extractFeatures(jsText) {
  return {
    hasLevelCycle: /(loadLevel|startLevel|nextLevel|levelIdx|levels?\s*:)/.test(jsText),
    hasRoleSwitch: /(setRole|roleMenu|currentRole|roles_allowed|role-btn)/.test(jsText),
    hasRestart: /(restart|location\.reload)/i.test(jsText),
    hasScore: /\bscore\b/.test(jsText),
    hasErrorHandling: /(catch\s*\(|throw\s+new\s+Error|console\.error|alert\s*\()/.test(jsText)
  };
}

function buildRedirectStateDiagram({ title, htmlRel, htmlName, enginePath, configPath }) {
  return `@startuml
title ${escText(title)} - Zustandsdiagramm
hide empty description

[*] --> EntryGeladen
state EntryGeladen : HTML Entry geladen: ${escText(htmlName)}
EntryGeladen --> RedirectVorbereiten : enginePath/configPath auslesen
RedirectVorbereiten --> RedirectAusfuehren : window.location.replace/assign
RedirectAusfuehren --> EngineLaden : Zielseite aufrufen
EngineLaden --> DatenLaden : Engine-/Config-Daten laden
DatenLaden --> SpielBereit : Initialisierung abgeschlossen
DatenLaden --> Fehler : Daten nicht ladbar
SpielBereit --> [*] : Steuerung an Ziel-Engine
Fehler --> [*]

note right of RedirectVorbereiten
Quelle: ${escText(htmlRel)}
enginePath: ${escText(shortForLabel(enginePath || '(nicht gesetzt)', 90))}
configPath: ${escText(shortForLabel(configPath || '(nicht gesetzt)', 90))}
end note
@enduml
`;
}

function buildDirectStateDiagram({
  title,
  htmlRel,
  htmlName,
  jsSrcs,
  fetchTargets,
  features
}) {
  const hasFetch = fetchTargets.length > 0;
  const jsLabel = jsSrcs.length > 0
    ? shortForLabel(jsSrcs.map((s) => path.basename(s)).join(', '), 100)
    : '(kein lokales JS erkannt)';
  const fetchLabel = hasFetch
    ? shortForLabel(fetchTargets.join(', '), 100)
    : '(kein fetch erkannt)';

  const featureTags = [];
  if (features.hasLevelCycle) featureTags.push('level-zyklus');
  if (features.hasRoleSwitch) featureTags.push('rollenwechsel');
  if (features.hasRestart) featureTags.push('neustart');
  if (features.hasScore) featureTags.push('score');
  if (features.hasErrorHandling) featureTags.push('fehlerbehandlung');

  const initFlow = hasFetch
    ? `Initialisierung --> DatenLaden : fetch Konfiguration/Leveldaten
DatenLaden --> Bereit : Daten erfolgreich geladen
DatenLaden --> Fehler : Laden fehlgeschlagen`
    : `Initialisierung --> Bereit : Keine externe Konfiguration noetig`;

  const roleTransitions = features.hasRoleSwitch
    ? `  WarteAufEingabe --> Rollenwahl : Rolle wechseln
  Rollenwahl --> WarteAufEingabe : Rolle gesetzt
`
    : '';

  const cycleTransitions = features.hasLevelCycle
    ? `  FortschrittPruefen --> Levelwechsel : Naechstes Level laden
  Levelwechsel --> WarteAufEingabe : Level bereit
  FortschrittPruefen --> Abschluss : Letztes Level abgeschlossen`
    : `  FortschrittPruefen --> WarteAufEingabe : Weitere Aufgabe offen
  FortschrittPruefen --> Abschluss : Letzte Aufgabe erledigt`;

  const restartTransitions = features.hasRestart
    ? `Abschluss --> Neustart : Neustart ausloesen
Neustart --> Initialisierung : State zuruecksetzen`
    : '';

  const scoreHint = features.hasScore ? ' + Score/HUD aktualisieren' : '';

  return `@startuml
title ${escText(title)} - Zustandsdiagramm
hide empty description

[*] --> AppStart
state AppStart : HTML geladen: ${escText(htmlName)}
AppStart --> Initialisierung : Script(s) laden
${initFlow}
Bereit --> Spielzyklus : Erste Runde starten

state Spielzyklus {
  [*] --> WarteAufEingabe
${roleTransitions}  WarteAufEingabe --> Auswertung : Nutzerinteraktion
  Auswertung --> Feedback : Regeln pruefen${scoreHint}
  Feedback --> FortschrittPruefen : Weiter / Auto-Fortschritt
${cycleTransitions}
}

${restartTransitions}
Abschluss --> [*] : Sitzung verlassen
Fehler --> [*]

note right of Initialisierung
Quelle: ${escText(htmlRel)}
JS: ${escText(jsLabel)}
fetch: ${escText(fetchLabel)}
Merkmale: ${escText(featureTags.join(', ') || 'basis')}
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

    if (!fs.existsSync(planDir)) continue;
    if (dir === root) continue;

    if (!byDir.has(dir)) byDir.set(dir, []);
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

    const srcs = extractScriptSrc(htmlText).filter((s) => !s.includes('theme_bridge.js'));
    const localJs = [];
    for (const src of srcs) {
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) continue;
      const resolved = path.resolve(dir, src);
      if (fs.existsSync(resolved) && resolved.toLowerCase().endsWith('.js')) {
        localJs.push({ src, resolved });
      }
    }

    const fetchTargets = [];
    const aggregate = {
      hasLevelCycle: false,
      hasRoleSwitch: false,
      hasRestart: false,
      hasScore: false,
      hasErrorHandling: false
    };

    for (const js of localJs) {
      const jsText = fs.readFileSync(js.resolved, 'utf8');

      for (const t of extractFetchTargets(jsText)) {
        fetchTargets.push(t);
      }

      const f = extractFeatures(jsText);
      aggregate.hasLevelCycle = aggregate.hasLevelCycle || f.hasLevelCycle;
      aggregate.hasRoleSwitch = aggregate.hasRoleSwitch || f.hasRoleSwitch;
      aggregate.hasRestart = aggregate.hasRestart || f.hasRestart;
      aggregate.hasScore = aggregate.hasScore || f.hasScore;
      aggregate.hasErrorHandling = aggregate.hasErrorHandling || f.hasErrorHandling;
    }

    const uniqueFetchTargets = [...new Set(fetchTargets)];
    const puml = isRedirect
      ? buildRedirectStateDiagram({ title, htmlRel, htmlName, enginePath, configPath })
      : buildDirectStateDiagram({
        title,
        htmlRel,
        htmlName,
        jsSrcs: localJs.map((j) => j.src),
        fetchTargets: uniqueFetchTargets,
        features: aggregate
      });

    const outFile = path.join(dir, '__dokumentation', '__02_plans', '__state_diagram.puml');
    fs.writeFileSync(outFile, puml, 'utf8');

    report.push({
      dir: rel(dir),
      html: htmlRel,
      mode: isRedirect ? 'redirect' : 'direct',
      jsCount: localJs.length,
      fetchCount: uniqueFetchTargets.length,
      hasLevelCycle: aggregate.hasLevelCycle ? 'yes' : 'no',
      hasRoleSwitch: aggregate.hasRoleSwitch ? 'yes' : 'no',
      hasRestart: aggregate.hasRestart ? 'yes' : 'no',
      puml: rel(outFile)
    });
  }

  const targetList = dirs.map((d) => rel(d)).join('\n') + '\n';
  fs.writeFileSync(path.join(helperDir, 'state_targets.txt'), targetList, 'utf8');

  const tsv = ['dir\thtml\tmode\tjs_count\tfetch_count\thas_level_cycle\thas_role_switch\thas_restart\tpuml'];
  for (const row of report) {
    tsv.push([
      row.dir,
      row.html,
      row.mode,
      row.jsCount,
      row.fetchCount,
      row.hasLevelCycle,
      row.hasRoleSwitch,
      row.hasRestart,
      row.puml
    ].join('\t'));
  }
  fs.writeFileSync(path.join(helperDir, 'state_generation_report.tsv'), tsv.join('\n') + '\n', 'utf8');

  console.log(`Generated ${report.length} state diagrams.`);
}

main();
