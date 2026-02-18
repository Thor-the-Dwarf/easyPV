# Prozedur: Aktivitaetsdiagramme in __02_plans erstellen

1. Alle HTML-Dateien im Projekt ermitteln.
2. Pro HTML-Ordner pruefen, ob ein Zielordner `__dokumentation/__02_plans` existiert.
3. Hauptordner ausschliessen.
4. Programmteil fuer Programmteil bewerten, ob ein Aktivitaetsdiagramm sinnvoll ist:
   - Redirect-Entry erkannt -> geeignet.
   - Lokales Game-Script erkannt -> geeignet.
   - Sonstige Interaktionshinweise (Button/Form/Event) -> geeignet.
   - Keine Aktivitaetslogik -> ueberspringen.
5. Geeignete Ordner von oben nach unten (sortierte Pfade) bearbeiten.
6. Diagramm als `__activity_diagram.puml` im jeweiligen `__02_plans` speichern.
7. Fuer Nachvollziehbarkeit Hilfsdateien schreiben:
   - `hilfsmittel/generate_activity_diagrams.mjs`
   - `hilfsmittel/activity_targets.txt`
   - `hilfsmittel/activity_generation_report.tsv`
8. Ergebnis pruefen (Dateianzahl, PUML-Syntax, Stichproben).
9. Alles auf `main` committen (inkl. bereits vorhandener Aenderungen laut Team-Regel).
