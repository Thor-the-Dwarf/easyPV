# Test-Spezialist02 - Point Delete

## Scope
- Spiel: `databases/Teil02 FIAE/database/Datenbanken & SQL/DELETE/_ghtml_point_delete.html`
- Ziel: Messbarkeit des Fortschritts validieren.

## Checks
- `node --check` auf `_gjs_point_delete.js`
- Playwright-Smoke mit Klick auf Zielzeile
- Sichtpruefung Screenshot
- Pruefung `state-0.json` auf `measurable` und `progress_percent`

## Artefakte
- `output/web-game-point-delete/shot-0.png`
- `output/web-game-point-delete/state-0.json`

## Ergebnis
- Hook vorhanden und liefert messbare Felder.
- Beispielstatus aus Test: `progress_percent: 17`, `selected_id: 404`, `target_id: 404`.
