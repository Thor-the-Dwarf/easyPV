# Testprotokoll: metadata-rename (__gAttributes_ -> __metaData_)

Datum: 2026-02-18  
Rolle: Test-Spezialist02

## Gepruefte Punkte
- Alle alten Metadateien umbenannt.
- Keine Rest-Referenzen auf `__gAttributes_` in den relevanten Ladepfaden.
- `database-index.json` verweist auf existente `__metaData_`-Dateien.
- Generic-Loader in `index.html` priorisiert Metadaten fuer `openGenericFolder`.

## Ausgefuehrte Checks
- `rg --files -g "**/__metaData_*.json" databases` => 416 Treffer.
- `rg --files -g "**/__gAttributes_*.json" databases` => 0 Treffer.
- `rg -n "__gAttributes_|__gattributes_" databases index.html __agent_dont_push/Repo\ Maintainer` => 0 Treffer.
- Strukturcheck gegen `databases/Teil01 Grundlagen/database-index.json`:
  - Alle `relPath` mit `__metaData_` zeigen auf existierende Dateien.
  - Ergebnis: `missing_meta_refs:0`.

## Ergebnis
- Rename und Referenzmigration sind konsistent.
- Keine offenen Pfad-Fehler im geprueften Umfang.
