# Testnachweis: Messbar-Batch 06 (Start-Fortschritt korrigiert)

## Ziel
False-Positive im Startzustand entfernen: Bei Deck-/Queue-basierten Spielen darf `progress_percent` beim ersten geladenen Element nicht automatisch >0 sein.

## Geaenderte Logik
- In den generischen Hook-Helfern wurde die Restlisten-Heuristik fuer `cards/components` praezisiert:
  - `processed = total - remaining - inHand`
  - `inHand` wird ueber `currentCard/currentComponent` beruecksichtigt.

## Browser-Smoke
- `.../Design Patterns/_ghtml_pattern_categorizer.html`
  - `level_total: 22`, `progress_percent: 0`, keine Fehler.
- `.../Schichtenarchitektur/_ghtml_layer_sorter.html`
  - `level_total: 16`, `progress_percent: 0`, keine Fehler.

## Artefakte
- `output/web-game-measurable-batch6-pattern-categorizer/`
- `output/web-game-measurable-batch6-layer-sorter/`
