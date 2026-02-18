# Testnachweis: Messbar-Batch 04

## Umfang
- 36 direkte Spiele aus `necht_messbare_spiele.json` auf `render_game_to_text` + `advanceTime` geprueft.
- 9 Redirect-Wrapper auf messbare Ziel-Engines geprueft.
- Laufzeit-Smoketest via Playwright fuer repraesentative Spiele durchgefuehrt.

## Gepruefte Beispielspiele (Browser)
- Change Management / change_kurve
- Fremdvergabe / fremdvergabe_risiko_waage
- Datenbanken & SQL / CREATE TABLE / schema_architect
- Datenbanken & SQL / Stored Procedures / procedure_kit
- UML / Zustandsdiagramm / state_machine
- Leasing / leasing_gutachter (Redirect auf DecisionGame)

## Ergebnis
- `state-0.json` liefert in allen geprueften Faellen `progress_percent`.
- Kein verbleibender Page-Error im erneut geprueften `change_kurve` nach Fix.
- 1 verbleibender 404-Console-Fehler in einzelnen Altseiten (Nebenressource), Messbarkeit bleibt vorhanden.

## Artefakte
- `output/web-game-measurable-batch4-change-kurve/`
- `output/web-game-measurable-batch4-risiko-waage/`
- `output/web-game-measurable-batch4-schema-architect/`
- `output/web-game-measurable-batch4-procedure-kit/`
- `output/web-game-measurable-batch4-state-machine/`
- `output/web-game-measurable-batch4-leasing-gutachter/`
- Nachtrag: JOIN-Wrapper-Pfad korrigiert und Wrapper-Ziel erfolgreich auf MatchingGame-Engine validiert.
