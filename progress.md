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

## 2026-02-18 - Weitere GamePlan-Umsetzungen (E-Mail formulieren)
- `GamePlan-Der-Tone-of-Voice-Editor.txt` als neues Spiel umgesetzt unter:
  - `databases/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/E-Mail formulieren/tone_of_voice_editor/`
  - inkl. `_data`, `_ghtml`, `_gjs`, `_gcss`, Doku- und Teststruktur.
- `GamePlan-Phishing-Detektiv-E-Mail-Edition.txt` als neues Spiel umgesetzt unter:
  - `databases/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/E-Mail formulieren/phishing_detektiv_email_edition/`
  - inkl. Inbox-Detailansicht, Klassifikationslogik, Doku- und Teststruktur.
- Validierung erfolgreich:
  - `node --check` fuer beide JS-Dateien
  - `node --test "__dokumentation/__03_tests/unit/*.test.mjs"` in beiden neuen Spielordnern
  - Playwright-Smoke-Artefakte:
    - `output/web-game-tone-of-voice-editor/`
    - `output/web-game-phishing-detektiv-email-edition/`
- Root-Index und Teil01-Index neu gebaut, damit die neuen Spiele im FolderTree erscheinen.

## 2026-02-19 - GamePlan-Umsetzungen (Englisch)
- Neue Spiele aus GamePlan-Dateien umgesetzt:
  - `databases/produktiv/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/Englisch/email_translate_race/`
  - `databases/produktiv/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/Englisch/false_friend_falle/`
- Pro Spiel erstellt:
  - `_data/_gg01_*.json` + `_data/__metaData_Englisch.json`
  - `_ghtml_*.html`, `_gjs_*.js`, `_gcss_*.css`
  - `__dokumentation/__02_plans/__gp_englisch__*.txt`
  - `__dokumentation/__03_tests/TESTING.md`
  - `__dokumentation/__03_tests/unit/*.config.test.mjs`
  - `__dokumentation/__03_tests/unit/*.progress-metric.test.mjs`
- Fix: JSON-Quoting in `false_friend_falle` korrigiert (ungültige doppelte Anführungszeichen in `reason`-Texten entfernt).
- Validierung:
  - JSON-Parse + `node --check` für beide Spiele erfolgreich.
  - Unit-Tests in beiden Spielordnern erfolgreich (`3/3` je Spiel).
  - Playwright-Smoke durchgeführt:
    - Basislauf: `output/web-game-email-translate-race/`, `output/web-game-false-friend-falle/`
    - Interaktionslauf (Klicks + State): `output/web-game-email-translate-race-click/`, `output/web-game-false-friend-falle-click/`
  - `state-0.json` bestätigt messbare Progress-Metriken und Interaktionszustände (`answered/armed`, `score`, `progress_percent`).
- Indexe neu erzeugt:
  - `databases/produktiv/Teil01 Grundlagen/database-index.json`
  - `index.json`

### TODO (naechster Block Englisch)
- Als nächste GamePlan-Ordner umsetzen:
  - `GamePlan-Listening-Comprehension-The-Meeting.txt`
  - `GamePlan-Sentence-Builder-Support-Ticket.txt`

## 2026-02-19 - Abschluss Englisch-Block
- Weitere GamePlans umgesetzt:
  - `databases/produktiv/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/Englisch/listening_comprehension_the_meeting/`
  - `databases/produktiv/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/Englisch/sentence_builder_support_ticket/`
- Inhalte je Spiel:
  - `_data/_gg01_*.json`
  - `_ghtml_*.html`, `_gjs_*.js`, `_gcss_*.css`
  - `__dokumentation/__02_plans/__gp_englisch__*.txt`
  - `__dokumentation/__03_tests/TESTING.md`
  - `__dokumentation/__03_tests/unit/*.config.test.mjs`
  - `__dokumentation/__03_tests/unit/*.progress-metric.test.mjs`
- Validierung erfolgreich:
  - JSON-Parse + `node --check` in beiden Ordnern
  - `node --test "__dokumentation/__03_tests/unit/*.test.mjs"` in beiden Ordnern (je `3/3` gruen)
  - Playwright-Smoke:
    - `output/web-game-listening-comprehension-the-meeting/` (Briefing -> Quiz via Enter)
    - `output/web-game-sentence-builder-support-ticket/` (Token-Auswahl verifiziert)
  - `state-0.json` zeigt messbare Progress-Daten (`measurable`, `score`, `progress_percent`, `simulated_ms`)
- Indexe neu erzeugt:
  - `databases/produktiv/Teil01 Grundlagen/database-index.json`
  - `index.json`

### TODO (naechster Schritt)
- Naechste GamePlan-Dateien ausserhalb von `Englisch/` scannen und im Standard-Game-Ordneraufbau umsetzen.

## 2026-02-19 - Weitere GamePlan-Umsetzung (Englisch)
- Neues Spiel aus GamePlan umgesetzt:
  - `databases/produktiv/Teil01 Grundlagen/database/BWL/Kommunikation & Schulung/Englisch/it_vocab_sprint/`
- Inhalte:
  - 20 Begriffe in `_data/_gg01_it_vocab_sprint.json`
  - 120s Sprint-Logik + lokaler Highscore in `_gjs_it_vocab_sprint.js`
  - fliegender Begriff + 4 Ziel-Buckets in `_ghtml_it_vocab_sprint.html` / `_gcss_it_vocab_sprint.css`
  - Test- und Plan-Dokumentation unter `__dokumentation/`
- Validierung:
  - JSON-Parse + `node --check` erfolgreich
  - `node --test "__dokumentation/__03_tests/unit/*.test.mjs"` erfolgreich (`3/3`)
  - Playwright-Interaktions-Smoke erfolgreich:
    - `output/web-game-it-vocab-sprint-click/shot-0.png`
    - `output/web-game-it-vocab-sprint-click/state-0.json`
- Indexe neu erzeugt:
  - `databases/produktiv/Teil01 Grundlagen/database-index.json`
  - `index.json`

### TODO (naechster Block Englisch)
- Als nächste GamePlan-Ordner umsetzen:
  - `GamePlan-Listening-Comprehension-The-Meeting.txt`
  - `GamePlan-Sentence-Builder-Support-Ticket.txt`
