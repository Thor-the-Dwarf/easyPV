# Test-Spezialist02 - advanceTime Batch-11 (No-Op entfernt)

## Ziel
- Alle verbleibenden Spiele mit exakt `window.advanceTime = function advanceTime() { return true; };` auf messbares Zeitverhalten umstellen.

## Umfang
- 23 `_gjs_*.js` Dateien in:
  - `Teil01 Grundlagen`
  - `Teil02 FIAE`
  - `Teil03 WISO`

## Technische Aenderung
- No-Op `advanceTime()` durch deterministische Variante ersetzt:
  - `window.advanceTime(ms)` akkumuliert `__simulatedMs`.
- `window.render_game_to_text` wird per Wrapper erweitert:
  - Falls Payload JSON-Objekt ist und `simulated_ms` fehlt, wird `simulated_ms` injiziert.

## Validierung
- Global-Check:
  - `rg` findet keine Treffer mehr fuer `window.advanceTime = function advanceTime() { return true; };` in `databases/`.
- Syntax:
  - `node --check` auf allen geaenderten JS-Dateien erfolgreich.
- Smoke-Test-Artefakte:
  - `__agent_dont_push/Test Artifacts/root_output/web-game-advanceTime-batch-11/state-0.json`
  - `__agent_dont_push/Test Artifacts/root_output/web-game-advanceTime-batch-11-teil03/state-0.json`
- Ergebnis:
  - Beide `state-0.json` enthalten `simulated_ms: 133.33333333333334`.
  - Screenshots rendern stabil:
    - `.../web-game-advanceTime-batch-11/shot-0.png`
    - `.../web-game-advanceTime-batch-11-teil03/shot-0.png`

## Fazit
- Batch-11 beseitigt alle verbleibenden no-op `advanceTime` Implementierungen in den Spielskripten unter `databases/`.
