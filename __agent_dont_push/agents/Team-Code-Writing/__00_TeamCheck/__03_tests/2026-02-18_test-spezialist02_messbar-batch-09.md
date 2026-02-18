# Testnachweis: Messbar-Batch 09 (Teil01-Sonderspiele harmonisiert)

## Ziel
Die verbleibenden 5 Teil01-Sonderspiele auf denselben Messstandard bringen wie Engines und Batch-07-Hooks:
- `simulated_ms` im `render_game_to_text`
- `advanceTime(ms)` akkumuliert Simulationszeit

## Angepasste Spiele
- `.../Change Management/change_kurve/_gjs_change_kurve.js`
- `.../Change Management/widerstands_radar/_gjs_widerstands_radar.js`
- `.../Fremdvergabe/fremdvergabe_outsourcing_vertrag/_gjs_fremdvergabe_outsourcing_vertrag.js`
- `.../Fremdvergabe/fremdvergabe_risiko_waage/_gjs_fremdvergabe_risiko_waage.js`
- `.../Fremdvergabe/fremdvergabe_werkbank/_gjs_fremdvergabe_werkbank.js`

## Browser-Smoke
- alle 5 Seiten via Playwright ausgefuehrt (je 12 Frames).

## Ergebnis
- In allen 5 `state-0.json` vorhanden: `simulated_ms ~ 200`.
- Startzustand konsistent: `progress_percent: 0`.
- Nur verbleibender 404-Console-Noise auf einzelnen Seiten; keine neuen Page-Errors.

## Artefakte
- `output/web-game-measurable-batch9-change-kurve/`
- `output/web-game-measurable-batch9-widerstands-radar/`
- `output/web-game-measurable-batch9-outsourcing-vertrag/`
- `output/web-game-measurable-batch9-risiko-waage/`
- `output/web-game-measurable-batch9-werkbank/`
