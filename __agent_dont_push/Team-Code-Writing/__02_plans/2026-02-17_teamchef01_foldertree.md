# Plan - FolderTree Fix (2026-02-17)

## Umsetzungsschritte
1. `index.html` erweitern um Hidden-Folder-Regel:
   - Ordnername startet mit `_` => im Tree verstecken.
   - Legacy-Compatibility: `assets` und `data` ebenfalls im Tree verstecken.
2. Hidden-Filter direkt in `normalizeNode` anwenden.
3. Icon-Logik rückbauen:
   - `brain`-Metadaten auf `books` normalisieren.
   - `folderEmoji` nur mit 🔥/📚 für spielbare Endordner.
   - `resolveFolderIcon` um `Vergangene Themen` ergänzen; Default auf `books`.
4. Regressionstest:
   - Syntax-/Diff-Prüfung.
   - Browser-Smoke für Root-Indexseite und Icon-/Tree-Verhalten.

## Akzeptanzkriterien
- `_`-Ordner erscheinen nicht im Tree.
- `assets/data` erscheinen nicht im Tree.
- Game-Folder in `Erschienene/Vergangene Themen` zeigen 🔥.
- Andere Game-Folder zeigen 📚.
