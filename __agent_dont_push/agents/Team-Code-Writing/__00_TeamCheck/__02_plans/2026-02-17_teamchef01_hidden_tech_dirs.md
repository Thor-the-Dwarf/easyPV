# Plan - Hidden Technikordner per `_` (2026-02-17)

## Ziel
- Alle aktuell sichtbaren technischen Ordner im FolderTree per `_`-Namensregel verbergen.
- Fachliche Themenordner unangetastet lassen.

## Schritte
1. Manuelle Auswahl nur der sichtbaren Technikordner.
2. Umbenennen:
   - `databases/testing` -> `databases/_testing`
   - `databases/Teil01 Grundlagen/scripts` -> `databases/Teil01 Grundlagen/_scripts`
3. Alle Pfadreferenzen auf neue Ordnernamen aktualisieren.
4. `index.json` neu generieren.
5. Sichtbarkeitsprüfung erneut ausführen.
