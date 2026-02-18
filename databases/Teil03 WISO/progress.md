Original prompt: commite ab jetzt mit der Message: games_teil03_reverse <Deine Message> Und implementiere deine Game-Plans. Beginne mit dem letzten GamePlan und arbeite dich hoch. Du hast nen Kollegen der das Selbe von Oben herab macht. Schau dir an Welche Struktur und Namenskonventionen wir haben und leg los

- Start: Reverse-Implementierung in Teil03 WISO begonnen.
- Fokus dieses Durchlaufs: Topic "Standortwettbewerb" von unten nach oben umsetzen.

- Umsetzung: 5 Reverse-Spiele fuer Standortwettbewerb angelegt (verlagerungsszenario_simulator bis investitionsentscheidung_router).
- Enthalten: Spielcode, Daten, Doku-Struktur, UML-PUML, Unit-Smoke-Tests.
- Validierung: Node-Unit-Smoke fuer alle 5 neuen Spiele erfolgreich (10/10 gruen).
- Playwright: Verlagerungsszenario-Simulator visuell geprueft, state payload vorhanden, keine error-Datei im frischen Run (`output/web-game-teil03-reverse-standort-v2`).
- Fix: Optionsbutton-Textfarbe explizit gesetzt, damit Inhalte sichtbar sind.

- Fortsetzung: 5 weitere Spiele fuer "Kündigung - Kündigungsschutz (Grundidee)" umgesetzt.
- Neu: `anhoerung_prozesspfad`, `fristrechner_duell`, `kuendigungsgrund_klassifikator`, `reaktionsfenster_timer`, `sozialauswahl_simulator`.
- Je Spiel: Standardstruktur, UML/Plan-Dateien, Quiz-Mechanik und messbarer Fortschritt (`score`, `progress_percent`, `simulated_ms`).
- Tests: Lokale Node-Unit-Tests fuer den Block komplett gruen (15/15).
- Browser-Smoke: `output/web-game-kuendigungsschutz/` mit State/Screenshot erzeugt.
