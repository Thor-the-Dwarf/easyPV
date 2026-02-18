- Original prompt (current turn): Feedback-FAB wiederherstellen (sichtbar auf generic_page und auf allen Spielen).
- Umsetzung:
  - Neuer getrackter Firebase-Client unter `shared/firebase-feedback-client.js` angelegt (entkoppelt von `__admin_dont_push`).
  - `generic_pages/generic_page.html` auf `../shared/firebase-feedback-client.js` umgestellt.
  - Root-`index.html` erweitert um Floating Feedback-FAB + Modal fuer direkt geladene Spielseiten (wenn nicht `generic_page` im Frame).
  - Root-Feedback sendet an bestehende `EasyPvFirebaseFeedback.submitFeedback(...)`-Schnittstelle mit Frame-Kontext.
  - Sichtbarkeit: Root-FAB blendet sich automatisch aus, wenn `generic_page` geladen ist (kein Doppel-FAB).
- Validierung:
  - Inline-Script-Syntax in `index.html` erfolgreich geprueft.
  - Shared-Client-Datei vorhanden und Referenzen in `index.html` + `generic_page.html` korrekt.

## 2026-02-18 - GamePlan-Ordner Ausbau (E-Mail formulieren)
- Anhang-Vergesser-Alarm geprueft: Struktur + Tests entsprechen bereits dem Standard-Game-Ordner.
- Betreffzeilen-Bingo verifiziert (inkl. JSON/JS/Tests) und lokal per Playwright-Smoke (`output/web-game-betreffzeilen-bingo/`) gegengeklickt.
- Neues Spiel aus GamePlan implementiert: `cc_blindflug_vermeider` unter
  - `databases/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/E-Mail formulieren/cc_blindflug_vermeider/`
  - inkl. `_gg01`, `_ghtml`, `_gjs`, `_gcss`, `__dokumentation`, `__03_tests`.
- Lokale Validierung:
  - `node --check _gjs_cc_blindflug_vermeider.js`
  - `node --test __dokumentation/__03_tests/unit/*.test.mjs`
  - Playwright-Smoke + State: `output/web-game-cc-blindflug-vermeider/`.
- Root-Index und Teil01-Index neu gebaut, damit neue Ordner im FolderTree erscheinen.

### TODO (naechster Schritt)
- Aus den verbliebenen Dateien in `E-Mail formulieren/` naechstes Spiel umsetzen:
  - `GamePlan-Der-Tone-of-Voice-Editor.txt`
  - `GamePlan-Phishing-Detektiv-E-Mail-Edition.txt`

## 2026-02-18 - GamePlan-Umsetzung (Kündigungsschutz)
- Neuer 5er-Block unter `databases/Teil03 WISO/.../Kündigung - Kündigungsschutz (Grundidee)/` umgesetzt:
  - `anhoerung_prozesspfad`
  - `fristrechner_duell`
  - `kuendigungsgrund_klassifikator`
  - `reaktionsfenster_timer`
  - `sozialauswahl_simulator`
- Pro Spiel erstellt: `_ghtml`, `_gjs`, `_gcss`, `_data/_gg01_*.json`, `_assets`, komplette `__dokumentation`-Ordnerstruktur.
- Pro Spiel in `__02_plans`: Haupt-GamePlan + 4 Standardvarianten (`entscheidungsduell`, `kpi_challenge`, `szenario_simulator`, `zeitfenster_timer`) und UML-PUML-Dateien.
- Fortschritts-Messbarkeit abgesichert:
  - `render_game_to_text` enthaelt `measurable`, `score`, `progress_percent`.
  - deterministischer Hook via `advanceTime` + `simulated_ms`.
  - zusaetzlicher Unit-Test `${slug}.progress-metric.test.mjs` je Spiel.
- Validierung:
  - `node --test` ueber alle neuen Unit-Tests: 15/15 gruen.
  - Playwright-Smoke fuer `anhoerung_prozesspfad` erfolgreich; State-Artifact unter `output/web-game-kuendigungsschutz/`.
