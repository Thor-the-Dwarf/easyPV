# Tests - Hidden Technikordner (2026-02-17)

## Durchgeführt
1. Referenzsuche alt/neu:
   - keine verbleibenden Treffer auf `databases/testing/...` oder `databases/Teil01 Grundlagen/scripts/...`
2. Syntax-Checks:
   - `node --check databases/_testing/scripts/*.mjs` (alle Hauptskripte)
   - `node --check databases/Teil01 Grundlagen/_scripts/*.mjs`
3. Tree-Sichtbarkeit über `index.json`-Auswertung:
   - vor Korrektur: 5 sichtbare Technikpfade
   - nach Korrektur: 0 sichtbare Technikpfade (`testing/scripts/tests/config` und `Teil01 Grundlagen/scripts` nicht mehr sichtbar)
4. Root-Index neu erstellt:
   - `node __agent_dont_push/Repo Maintainer/hilfsmittel/rebuild_root_index.mjs`

## Ergebnis
- FolderTree zeigt nur noch fachliche Root-Bereiche (`Teil01 Grundlagen`, `Teil02 FIAE`, `Teil03 WISO`).
- Sichtbarkeit bleibt an `_` gekoppelt.
