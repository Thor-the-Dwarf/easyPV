# Arbeitsablauf: Teil03 WISO Ordnerstruktur aus Inhaltsverzeichnis

1. Inhaltsverzeichnis einlesen:
   - Quelle: `databases/Teil03 WISO/database/Inhaltsverzeichnis_Teil03_WISO.txt`
   - Regeln:
     - `##` = Level 1
     - `###` = Level 2
     - `-` = Level 3 (Endordner)
2. Namensnormalisierung anwenden:
   - Level-1 Nummern entfernen (`1)`, `2)` ...)
   - `/` durch ` - ` ersetzen
   - Mehrfach-Leerzeichen reduzieren, trimmen
3. Vor dem Erstellen Konfliktprüfung ausführen:
   - Wenn ein erwarteter Ordnerpfad als Datei belegt ist: Abbruch mit Fehlerliste
4. Struktur erzeugen:
   - Für jeden Level-3-Endordner `__dokumentation` anlegen
   - Unterordner anlegen:
     - `__01_analyses`
     - `__02_plans`
     - `__03_tests`
     - `__04_lernings`
     - `__05_feedback`
5. Leere Unterordner versionierbar machen:
   - In jedem Unterordner eine `.gitkeep` anlegen
6. Validierung:
   - Sollwerte prüfen: Level-1 = 3, Level-2 = 15, Level-3 = 43
   - Prüfen, dass in jedem Endordner alle 5 `.gitkeep` vorhanden sind
   - Idempotenztest: Generator zweimal ausführen, zweiter Lauf ohne neue Änderungen
7. Root-Index für GUI aktualisieren:
   - Skript: `__agent_dont_push/Repo Maintainer/hilfsmittel/rebuild_root_index.mjs`
8. Abschließender Voll-Commit:
   - `git add -A`
   - Commit-Message im Format `repo_maintainer: ...`
