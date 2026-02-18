# Testnachweis: Messbar-Batch 07 (advanceTime verbessert)

## Ziel
`advanceTime` nicht mehr als reiner No-Op: Simulationszeit soll deterministisch im State sichtbar sein.

## Umsetzung
- In den 31 generischen Hook-Dateien wurde `window.advanceTime(ms)` erweitert:
  - akkumuliert `state.__simulated_ms`
  - optionaler `gameTick`-Fortschritt bei >= 1000ms
- `render_game_to_text` liefert zusaetzlich `simulated_ms`.

## Browser-Smoke
- `.../Design Patterns/_ghtml_pattern_categorizer.html`
- `.../Schichtenarchitektur/_ghtml_layer_sorter.html`
- `.../UML: Zustandsdiagramm/_ghtml_state_machine.html`

## Ergebnis
- Alle drei States enthalten `simulated_ms` (~200ms im Smoke-Lauf).
- Startzustand bleibt korrekt (`progress_percent: 0`).
- Keine Console/Page Errors in den drei Laeufen.

## Artefakte
- `output/web-game-measurable-batch7-pattern-categorizer/`
- `output/web-game-measurable-batch7-layer-sorter/`
- `output/web-game-measurable-batch7-state-machine/`
