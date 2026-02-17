# Arbeitsablauf: Komponenten-/Package-Diagramme (PlantUML)

## Ziel
Fuer jeden Endordner mit HTML-Datei eine PlantUML-Datei in `__dokumentation/__02_plans` erzeugen.

## Schritte
1. Projektweite HTML-Ziele erfassen und nur Ordner mit vorhandenem `__dokumentation/__02_plans` verwenden.
2. Hauptordner ausschliessen (`.`/Repo-Root).
3. Zielordner von oben nach unten (lexikografisch nach Relativpfad) bearbeiten.
4. Pro Zielordner genau eine Datei `__component_package_diagram.puml` erzeugen.
5. Diagramm aus den Ordnerartefakten ableiten:
   - HTML-Entry(s), JS, CSS, CJS
   - `_data/` und `_assets/` als Ressourcen-Pakete
   - optionale Shared Scripts (z. B. `theme_bridge.js`) und externe Styles
   - Beziehungen zwischen Komponenten (HTML -> JS/CSS, JS -> _data/assets, usw.)
6. Erzeugungsreports in `hilfsmittel` schreiben:
   - `component_package_targets.txt`
   - `component_package_generation_report.tsv`
7. Stichproben in mehreren Ordnern lesen und auf PlantUML-Gueltigkeit/Lesbarkeit pruefen.
8. Alle Aenderungen committen.

## Verwendetes Hilfsmittel
- `__agent_dont_push/Team-Code-Writing/__02_planer/hilfsmittel/generate_component_package_diagrams.mjs`
