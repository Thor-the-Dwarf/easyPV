# Prozedur: Zustandsdiagramme in __02_plans erstellen

1. Projektstruktur erfassen und alle HTML-Dateien finden.
2. Nur Endordner beruecksichtigen, die `__dokumentation/__02_plans` enthalten.
3. Hauptordner ausschliessen; dort wird nichts erzeugt.
4. Zielordner top-down verarbeiten (lexikografisch sortierte Pfade).
5. Pro Zielordner die HTML-Datei einlesen und Seitentyp erkennen:
   - Redirect-Seite (z. B. `window.location.replace(...)` + `enginePath`/`configPath`)
   - Direktes Spiel (lokales `_gjs_*.js`)
6. Optionale Merkmale aus JS ableiten (`level-zyklus`, `rollenwechsel`, `neustart`, `score`, `fehlerbehandlung`).
7. PlantUML-Zustandsdiagramm erzeugen:
   - Redirect: Entry -> Redirect -> Engine-Laden -> Daten -> Bereit/Fehler
   - Direkt: Init -> (optional Datenladen) -> Spielzyklus -> Abschluss/Neustart/Fehler
8. Diagramm als `__state_diagram.puml` im jeweiligen `__02_plans` speichern.
9. Hilfsartefakte unter `hilfsmittel` pflegen:
   - `generate_state_diagrams.mjs`
   - `state_targets.txt`
   - `state_generation_report.tsv`
10. Ergebnis pruefen (Dateianzahl, Stichproben, Vollstaendigkeit aller Zielordner) und danach alles auf `main` committen.
