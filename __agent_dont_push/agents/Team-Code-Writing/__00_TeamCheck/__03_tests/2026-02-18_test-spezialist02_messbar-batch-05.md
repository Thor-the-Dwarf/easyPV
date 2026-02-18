# Testnachweis: Messbar-Batch 05 (Hook-Qualitaet)

## Ziel
Verbesserte Fortschrittsberechnung in den generischen Hooks validieren, damit Spiele mit abweichenden Config-Schemata (nicht nur `levels`) messbar bleiben.

## Technischer Scope
- 31 bereits nachgeruestete `_gjs_*.js` auf robustere Hook-Logik umgestellt (`config|cfg`, mehrere Array-Typen, Counter-Fallbacks).
- `render_game_to_text` liefert jetzt `level_total` und `progress_percent` auch bei `scenarios`, `patterns`, `phases` usw.

## Browser-Smoke (Playwright)
- `.../UML: Zustandsdiagramm/_ghtml_state_machine.html`
  - Ergebnis: `level_total: 3`, `progress_percent: 0`, keine Fehler.
- `.../Design Patterns/_ghtml_pattern_categorizer.html`
  - Ergebnis: `level_total: 22`, `progress_percent: 5`, keine Fehler.
- `.../Change Management/change_curve/_ghtml_change_curve.html`
  - Ergebnis: `level_total: 7`, `progress_percent: 0`, keine Fehler.

## Artefakte
- `output/web-game-measurable-batch5-state-machine/`
- `output/web-game-measurable-batch5-pattern-categorizer/`
- `output/web-game-measurable-batch5-change-curve-teil02/`
