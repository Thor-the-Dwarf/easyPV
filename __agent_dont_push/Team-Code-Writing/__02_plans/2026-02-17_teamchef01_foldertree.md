# Plan - FolderTree Fix (2026-02-17)

## Umsetzungsschritte
1. `index.html` erweitern um Hidden-Folder-Regel:
   - Ordnername startet mit `_` => im Tree verstecken.
2. Hidden-Filter direkt in `normalizeNode` anwenden.
3. Alle technischen Ordner `assets`/`data` im `databases/`-Baum in `_assets`/`_data` umbenennen.
4. Pfadreferenzen in HTML/JS/JSON/Tests/Plänen auf `_assets`/`_data` umstellen.
5. Icon-Logik rückbauen:
   - `brain`-Metadaten auf `books` normalisieren.
   - `folderEmoji` nur mit 🔥/📚 für spielbare Endordner.
   - `resolveFolderIcon` um `Vergangene Themen` ergänzen; Default auf `books`.
6. Indizes neu erzeugen (`index.json`, `database-index.json`).
7. Regressionstest:
   - Syntax-/Diff-Prüfung.
   - Browser-Smoke für Root-Indexseite und Icon-/Tree-Verhalten.

## Akzeptanzkriterien
- `_`-Ordner erscheinen nicht im Tree.
- Es existieren keine `assets`/`data`-Ordner mehr unter `databases/` (stattdessen `_assets`/`_data`).
- Game-Folder in `Erschienene/Vergangene Themen` zeigen 🔥.
- Andere Game-Folder zeigen 📚.

## Nachtrag Plan (Spielbutton-Flow)
1. Icon-Zuordnung verschieben:
   - Themenordner (mit direkten Spielkindern) erhalten 🔥/📚.
   - Spielknoten selbst zeigen kein Icon.
2. Klickverhalten:
   - Spielknoten-Label öffnet direkt die Spielseite (`gameRelPath`) inkl. Theme-Parameter.
   - Generic-View bleibt Fallback für Knoten ohne `gameRelPath`.
