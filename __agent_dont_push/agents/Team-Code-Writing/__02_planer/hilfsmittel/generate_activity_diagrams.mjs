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

function escapePumlText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().replace(/"/g, "'");
}

function toAscii(s) {
  const map = {
    ae: /[\u00E4\u00C4]/g,
    oe: /[\u00F6\u00D6]/g,
    ue: /[\u00FC\u00DC]/g,
    ss: /\u00DF/g
  };

  let out = String(s || '');
  out = out.replace(map.ae, 'ae');
  out = out.replace(map.oe, 'oe');
  out = out.replace(map.ue, 'ue');
  out = out.replace(map.ss, 'ss');
  out = out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  out = out.replace(/[^\x20-\x7E]/g, '');
  return out;
}

function extractTitle(htmlText, fallback) {
  const m = htmlText.match(/<title>([\s\S]*?)<\/title>/i);
  const t = m ? m[1] : fallback;
  return toAscii(escapePumlText(t || fallback));
}

function extractScriptSrc(htmlText) {
  const out = [];
  const re = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(htmlText)) !== null) out.push(m[1]);
  return out;
}

function extractFetchTargets(jsText) {
  const out = [];
  const re = /fetch\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  let m;
  while ((m = re.exec(jsText)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

function hasBehaviorHints(htmlText) {
  return /<button\b|<form\b|onclick=|addEventListener\s*\(/i.test(htmlText);
}

function buildActivityDiagram({ title, htmlName, mode, jsNames, fetchTargets }) {
  const titleSafe = toAscii(escapePumlText(title));
  const htmlSafe = toAscii(escapePumlText(htmlName));
  const jsSafe = toAscii(escapePumlText(jsNames.join(', ') || 'kein lokales js'));
  const fetchSafe = toAscii(escapePumlText(fetchTargets.join(', ') || 'keine externen daten'));

  if (mode === 'redirect') {
    return `@startuml\n` +
      `title ${titleSafe}\n` +
      `start\n` +
      `:Nutzer oeffnet Seite (${htmlSafe});\n` +
      `:Browser laedt HTML;\n` +
      `:Inline Redirect-Script wird ausgefuehrt;\n` +
      `:enginePath und configPath bestimmen;\n` +
      `:Weiterleitung zur Spiel-Engine;\n` +
      `:Engine laedt Konfiguration und Assets;\n` +
      `:Spieloberflaeche wird angezeigt;\n` +
      `stop\n` +
      `@enduml\n`;
  }

  const dataBlock = fetchTargets.length > 0
    ? `if (Externe Daten verfuegbar?) then (ja)\n` +
      `  :JSON/Leveldaten laden (${fetchSafe});\n` +
      `else (nein)\n` +
      `  :Mit lokalen Initialdaten arbeiten;\n` +
      `endif\n`
    : `:Keine externe Datendatei noetig;\n`;

  return `@startuml\n` +
    `title ${titleSafe}\n` +
    `start\n` +
    `:Nutzer oeffnet Seite (${htmlSafe});\n` +
    `:Browser laedt HTML/CSS/JS;\n` +
    `:Game-Script initialisieren (${jsSafe});\n` +
    dataBlock +
    `:Startzustand der UI rendern;\n` +
    `while (Spielrunde aktiv?) is (ja)\n` +
    `  :Nutzereingabe verarbeiten;\n` +
    `  :Regeln pruefen und Zustand aktualisieren;\n` +
    `  if (Aktion korrekt?) then (ja)\n` +
    `    :Positives Feedback und Fortschritt;\n` +
    `  else (nein)\n` +
    `    :Fehlerfeedback und ggf. Retry;\n` +
    `  endif\n` +
    `  :HUD/DOM neu zeichnen;\n` +
    `endwhile (nein)\n` +
    `:Ergebnis anzeigen;\n` +
    `stop\n` +
    `@enduml\n`;
}

function choosePrimaryHtml(filesInDir) {
  const sorted = [...filesInDir].sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
  const pref = sorted.find((f) => path.basename(f).startsWith('_ghtml_'));
  return pref || sorted[0];
}

function main() {
  if (!fs.existsSync(helperDir)) fs.mkdirSync(helperDir, { recursive: true });

  const htmlFiles = walk(root).sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
  const grouped = new Map();

  for (const html of htmlFiles) {
    const dir = path.dirname(html);
    if (!grouped.has(dir)) grouped.set(dir, []);
    grouped.get(dir).push(html);
  }

  const dirs = [...grouped.keys()].sort((a, b) => rel(a).localeCompare(rel(b), 'de'));
  const reportRows = ['dir\thtml\tdecision\treason\tmode\toutput'];
  const targets = [];
  let created = 0;

  for (const dir of dirs) {
    const files = grouped.get(dir);
    const htmlFile = choosePrimaryHtml(files);
    const htmlRel = rel(htmlFile);
    const htmlName = path.basename(htmlFile);
    const planDir = path.join(dir, '__dokumentation', '__02_plans');

    if (dir === root) {
      reportRows.push(`${rel(dir)}\t${htmlRel}\tskip\tmain-root-excluded\tnone\t`);
      continue;
    }

    if (!fs.existsSync(planDir)) {
      reportRows.push(`${rel(dir)}\t${htmlRel}\tskip\tmissing-__02_plans\tnone\t`);
      continue;
    }

    const htmlText = fs.readFileSync(htmlFile, 'utf8');
    const isRedirect = /window\.location\.(replace|assign)|window\.location\.href\s*=/.test(htmlText);

    const srcs = extractScriptSrc(htmlText).filter((s) => !s.includes('theme_bridge.js'));
    const localJs = [];
    for (const src of srcs) {
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) continue;
      const resolved = path.resolve(dir, src);
      if (fs.existsSync(resolved) && resolved.toLowerCase().endsWith('.js')) {
        localJs.push({ src, resolved });
      }
    }

    let decision = 'create';
    let reason = 'interactive-flow-detected';
    let mode = 'direct';

    if (isRedirect) {
      mode = 'redirect';
      reason = 'redirect-entry';
    } else if (localJs.length > 0) {
      mode = 'direct';
      reason = 'local-game-script';
    } else if (hasBehaviorHints(htmlText)) {
      mode = 'direct';
      reason = 'html-interactions';
    } else {
      decision = 'skip';
      mode = 'none';
      reason = 'no-meaningful-activity-flow';
    }

    const outFile = path.join(planDir, '__activity_diagram.puml');

    if (decision === 'create') {
      const fetchTargets = [];
      for (const js of localJs) {
        const jsText = fs.readFileSync(js.resolved, 'utf8');
        for (const t of extractFetchTargets(jsText)) fetchTargets.push(toAscii(t));
      }

      const uniqueFetch = [...new Set(fetchTargets)];
      const title = extractTitle(htmlText, path.basename(dir));
      const puml = buildActivityDiagram({
        title,
        htmlName,
        mode,
        jsNames: localJs.map((j) => path.basename(j.src)),
        fetchTargets: uniqueFetch
      });

      fs.writeFileSync(outFile, puml, 'utf8');
      created += 1;
      targets.push(rel(dir));
      reportRows.push(`${rel(dir)}\t${htmlRel}\tcreate\t${reason}\t${mode}\t${rel(outFile)}`);
    } else {
      reportRows.push(`${rel(dir)}\t${htmlRel}\tskip\t${reason}\t${mode}\t`);
    }
  }

  fs.writeFileSync(path.join(helperDir, 'activity_targets.txt'), `${targets.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(helperDir, 'activity_generation_report.tsv'), `${reportRows.join('\n')}\n`, 'utf8');

  console.log(`Created ${created} activity diagrams.`);
}

main();
