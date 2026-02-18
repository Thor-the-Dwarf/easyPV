# Arbeitsablauf: Use-Case-Diagramme (PlantUML)

## Ziel
Fuer jeden Endordner mit HTML-Datei ein Use-Case-Diagramm in `__dokumentation/__02_plans` erzeugen.

## Schritte
1. Alle HTML-Dateien im Repo suchen.
2. Nur Ordner behalten, in denen `__dokumentation/__02_plans` existiert.
3. Hauptordner ausschliessen (Root-`index.html`).
4. Zielordner top-down nach Relativpfad sortieren.
5. Pro Zielordner genau eine Datei erzeugen:
   - `__use_case_diagram.puml`
6. Inhalt des Diagramms aus den vorhandenen Artefakten ableiten:
   - Akteur `Spieler` immer
   - optional `Tester` bei vorhandenen `.cjs`
   - optional `Datenquelle` bei `_data/` oder `fetch(...)`
   - optional `Theme-Service` / `Style-CDN` bei externen Einbindungen
7. Hilfsdateien im Arbeitsordner schreiben:
   - `hilfsmittel/use_case_targets.txt`
   - `hilfsmittel/use_case_generation_report.tsv`
   - `hilfsmittel/generate_use_case_diagrams.mjs`
8. Stichproben auf PlantUML-Syntax und Ablagepfad pruefen.
9. Alles auf `main` committen.
