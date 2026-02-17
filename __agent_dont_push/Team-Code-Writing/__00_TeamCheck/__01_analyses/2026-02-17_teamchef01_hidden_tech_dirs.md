# Analyse - Sichtbare Technikordner im FolderTree (2026-02-17)

## Problem
- Neben fachlichen Themen waren weiterhin technische Ordner im FolderTree sichtbar.
- Besonders sichtbar: `testing` (inkl. `scripts`, `tests`, `config`) und `Teil01 Grundlagen/scripts`.

## Vorgehen
1. Sichtbarkeitslogik aus `index.html` geprüft (`_`-Prefix = hidden).
2. Effektiv sichtbare Ordner aus `index.json` mit derselben Hidden-Regel ausgewertet.
3. Kandidaten manuell geprüft, um fachliche Themenordner nicht zu treffen.

## Befund
- Tatsächlich sichtbare technische Pfade vor Korrektur:
  - `Teil01 Grundlagen/scripts`
  - `testing`
  - `testing/config`
  - `testing/scripts`
  - `testing/tests`
- Keine weiteren sichtbaren Technikordner mit denselben Mustern.
