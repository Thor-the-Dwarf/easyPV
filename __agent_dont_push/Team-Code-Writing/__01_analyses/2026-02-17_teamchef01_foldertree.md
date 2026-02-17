# Analyse - FolderTree Hidden-Folder + Icons (2026-02-17)

## Vorgängerquellen
- `__agent_dont_push/progress.md` (Eintrag zur Brain/Flame-Umstellung in `index.html`)
- `__agent_dont_push/Repo Maintainer/arbeitsabläufe/foldertree_icons_und_themenordner_aufloesen.md`

## Ist-Zustand
- FolderTree-Normalisierung liegt in `index.html`.
- Aktuell wurden `brain/flame`-Icons eingeführt; gewünschte Bücher-Logik ist nicht mehr konsistent.
- Technische Unterordner wie `__dokumentation`, `assets`, `data` erscheinen im sichtbaren Baum.

## Risikoanalyse
- Globales Ausblenden aller `_`-Ordner kann Spielpfade zerstören, wenn Spielinhalte darin liegen.
- Icon-Umstellung darf Theme-Mode und Firebase-Feedback im Generic-View nicht beeinflussen.

## Abgeleitete Anforderungen
1. Versteckte Ordner im sichtbaren Tree zuverlässig herausfiltern.
2. Legacy-Ordner `assets/data` (ohne `_`) weiterhin ausblenden, bis Umbenennung überall erfolgt.
3. Leaf-Game-Ordner müssen wieder 🔥/📚 statt 🧠 verwenden.
