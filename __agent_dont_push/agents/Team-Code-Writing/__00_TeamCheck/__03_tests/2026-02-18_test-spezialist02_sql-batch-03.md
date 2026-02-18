# Test-Spezialist02 - SQL Batch (GRANT/REVOKE/Datentypen)

## Spiele
- `.../GRANT/_ghtml_rights_manager.html`
- `.../REVOKE/_ghtml_rights_revoke.html`
- `.../Datentypen/_ghtml_type_match.html`

## Checks
- `node --check` auf alle drei JS-Dateien
- Playwright-Smoke je Spiel
- Sichtpruefung Screenshots
- State-Pruefung auf `measurable: true` und `progress_percent`

## Artefakte
- `output/web-game-rights-manager/shot-0.png`, `state-0.json`
- `output/web-game-rights-revoke/shot-0.png`, `state-0.json`
- `output/web-game-type-match/shot-0.png`, `state-0.json`

## Ergebnis
- Alle drei Spiele liefern messbare Fortschrittsdaten fuer den globalen Tracker.
