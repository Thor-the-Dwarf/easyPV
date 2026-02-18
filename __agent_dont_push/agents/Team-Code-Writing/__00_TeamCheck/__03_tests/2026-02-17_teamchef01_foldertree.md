# Tests - FolderTree Fix (2026-02-17)

## Geplante Checks
1. `git diff -- index.html` auf Scope-Kontrolle.
2. Statische Prüfung der geänderten JS-Logik in `index.html`.
3. UI-Smoke auf `index.html` mit Screenshot/DOM-Validierung:
   - keine sichtbaren `assets`, `data`, `__dokumentation`-Knoten,
   - Leaf-Games mit 🔥/📚.
4. Nebenfunktionen spot-check:
   - Theme-Button weiterhin sichtbar/reaktionsfähig.
   - Generic/Firebase-Feedback-Code in `generic_pages/` unverändert.

## Ergebnis
- `git diff -- index.html` geprüft: Scope nur Hidden-Folder + Icon-Logik.
- Browser-Smoke (`web_game_playwright_client`) erfolgreich:
  - Screenshot (Drawer offen): `output/web-game-foldertree-check-open/shot-0.png`
  - Keine Browser-Fehler.
- Erweiterter DOM-Test (Playwright) nach vollständigem Aufklappen:
  - `hiddenFolderLeaks = 0` für `assets`, `data`, `__dokumentation`, `_assets`, `_data`
  - `openableFolders = 375`
  - `openableIconCounts = { 📚: 286, 🔥: 89 }`
  - Keine `📁`-Icons mehr bei `is-openable`-Knoten.
- Nach strikter `_`-Migration erneut geprüft:
  - `find databases ... -name assets -o -name data` liefert `0` Treffer.
  - Browser-DOM-Test: `underscoreLeaks = 0` (kein sichtbarer Tree-Label mit führendem `_`).
  - Browser-DOM-Test: `openableIconCounts = { 📚: 286, 🔥: 89 }`, `errors = []`.
  - Screenshot: `output/web-game-foldertree-underscore/shot-0.png`.

## Ergänzende Checks (Themen-Icon + Spielbutton)
- `index.html` Inline-Script-Syntax geprüft (`new Function(script)`): OK.
- Code-Review auf neue Funktionen:
  - `resolveThemeFolderIcon` vorhanden (Themenordner-Icons).
  - `isLeafPlayableNode` führt bei Spielknoten zu leerem Icon.
  - `openPlayableFolder` öffnet bei vorhandenem `gameRelPath` direkt die Spielseite.
