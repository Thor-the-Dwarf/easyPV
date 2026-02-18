# Test-Spezialist02 - SQL Batch (3 Spiele)

## Spiele
- `.../SQL (allgemein)/_ghtml_sql_sorter.html`
- `.../UNION/_ghtml_union_compat.html`
- `.../UPDATE/_ghtml_mass_update.html`

## Checks
- `node --check` auf alle drei JS-Dateien
- Playwright-Smoke je Spiel
- Sichtpruefung Screenshots
- State-Pruefung auf `measurable: true` und `progress_percent`

## Artefakte
- `output/web-game-sql-sorter/shot-0.png`, `state-0.json`
- `output/web-game-union-compat/shot-0.png`, `state-0.json`
- `output/web-game-mass-update/shot-0.png`, `state-0.json`

## Ergebnis
- Alle drei Spiele liefern messbare Fortschrittssignale und sind fuer den globalen Fortschrittstracker auswertbar.
