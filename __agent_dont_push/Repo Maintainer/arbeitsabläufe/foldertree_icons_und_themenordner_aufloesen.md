# Arbeitsablauf: FolderTree-Icons und Themenordner auflösen

1. Betroffene Themenordner lokalisieren (`Erschienene Themen`, `Mögliche Themen`).
2. Relevante `__metaData_*.json` erfassen und Ziel-Icons setzen:
   - Erschienene Themen -> `Icon: flame` (GUI: 🔥)
   - Mögliche Themen -> `Icon: books` (GUI: 📚)
3. Inhalte der Themenordner eine Ebene höher verschieben.
4. Bei Namenskonflikten:
   - identische Dateien: Quell-Datei entfernen
   - unterschiedliche Dateien: mit Suffix `__from_<quelle>` erhalten
5. Leere Themenordner entfernen.
6. GUI-Logik prüfen (`index.html`):
   - `normalizeIconValue` muss `books/book/📚` erkennen
   - `folderEmoji` muss `📚` rendern
7. Root-Tree neu generieren (`index.json`), damit die GUI keine alten Themenpfade mehr zeigt:
   - Hilfsskript: `__agent_dont_push/Repo Maintainer/hilfsmittel/rebuild_root_index.mjs`
8. Abschließende Prüfung per `find`/`rg` und danach vollständigen Commit ausführen.
