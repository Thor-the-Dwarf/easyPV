# Testnachweis: Messbar-Batch 08 (Shared-Engines simulated_ms)

## Ziel
Die Shared-Engines unter `game_pages/*` sollen in `render_game_to_text` eine nachvollziehbare Simulationszeit liefern und `advanceTime(ms)` sinnvoll auswerten.

## Umsetzung
- Erweiterte Engines:
  - `game_pages/SortingGame/script.js`
  - `game_pages/DecisionGame/script.js`
  - `game_pages/SimulationGame/script.js`
  - `game_pages/FindingGame/script.js`
  - `game_pages/MatchingGame/script.js`
  - `game_pages/ConstructionGame/script.js`
- `simulated_ms` in State-Ausgabe aufgenommen.
- `advanceTime(ms)` akkumuliert Simulationszeit (FindingGame zusaetzlich mit Timer-Ticks bei >=1000ms).

## Browser-Smoke (Wrapper)
- `.../Leasing/finanzierungs_sortiermaschine/_ghtml_finanzierungs_sortiermaschine.html`
- `.../Leasing/risk_finder_das_kleingedruckte/_ghtml_risk_finder_das_kleingedruckte.html`
- `.../JOINs (INNER-LEFT) praxisnah/_ghtml_join_puzzle.html`

## Ergebnis
- In allen drei State-Dateien vorhanden: `simulated_ms ~ 200`.
- Startzustand bleibt korrekt: `progress_percent: 0`.
- Keine Console/Page Errors in den drei Smoke-Laeufen.

## Artefakte
- `output/web-game-measurable-batch8-sorting/`
- `output/web-game-measurable-batch8-finding/`
- `output/web-game-measurable-batch8-matching/`
