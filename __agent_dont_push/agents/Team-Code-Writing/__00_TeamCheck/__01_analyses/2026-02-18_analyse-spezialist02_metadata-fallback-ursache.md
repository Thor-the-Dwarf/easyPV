# Analyse: Warum viele Themen den CPU-Standardtext zeigten

Datum: 2026-02-18  
Rolle: Analyse-Spezialist02

## Ursache
- Die Themen-Metadaten lagen in `__gAttributes_*.json`.
- Der Loader hatte fuer Generic-Ansichten `jsonRelPath` priorisiert und erst danach `attributesRelPath` genutzt.
- Dadurch wurde haeufig eine `_gg01_*.json` ohne verwertbare `c_suite_explanations` geladen.
- In diesem Fall faellt `generic_c_suite.js` auf `beispiel.json` zurueck, dessen Inhalt den CPU-Text liefert.

## Wirkung
- Viele Themen ohne eigene C-Suite-Erklaerungen zeigten den identischen CPU-Standardtext statt themenspezifischer Inhalte.

## Beschlossene Korrektur
- Metadateien von `__gAttributes_*.json` nach `__metaData_*.json` migrieren.
- Generic-Lader in `index.html` so anpassen, dass fuer Generic-Pages Metadaten priorisiert werden.
- Referenzen und Hilfs-/Auditdateien konsistent auf `__metaData_` umstellen.
