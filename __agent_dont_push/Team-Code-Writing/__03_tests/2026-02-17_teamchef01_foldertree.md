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
