# Prozedur: Sequenzdiagramme in __02_plans erstellen

1. Projektstruktur erfassen und alle HTML-Dateien finden.
2. Aus den HTML-Pfaden nur Endordner behalten, die einen Ordner `__dokumentation/__02_plans` besitzen.
3. Hauptordner ausschliessen (keine Erzeugung in Root).
4. Zielordner sortiert von oben nach unten (lexikografisch nach Pfad) verarbeiten.
5. Pro Zielordner die relevante HTML-Datei lesen und den Seitentyp erkennen:
   - Redirect-Seite (z. B. `window.location.replace(...)` + `enginePath`/`configPath`)
   - Direktes Spiel (lokales `_gjs_*.js` eingebunden)
6. Fuer jede Seite ein PlantUML-Sequenzdiagramm erzeugen:
   - Redirect: Nutzer -> Browser -> Entry -> Redirect -> Engine -> Config -> Assets
   - Direkt: Nutzer -> Browser -> HTML -> JS -> (optional fetch Data) -> UI-Events -> DOM-Update
7. Diagramm immer als `__sequence_diagram.puml` im zugehoerigen `__02_plans` speichern.
8. Hilfsartefakte im Arbeitsordner pflegen:
   - `hilfsmittel/generate_sequence_diagrams.mjs`
   - `hilfsmittel/sequence_targets.txt`
   - `hilfsmittel/sequence_generation_report.tsv`
9. Ergebnis pruefen (Anzahl generierter Dateien, Stichproben in Redirect- und Direct-Faellen).
10. Alle aenderungen auf `main` committen mit Message-Format `planer: <kurzbeschreibung>`.
