# Manuelle Prüfung: assets/data-Umbenennungen (2026-02-17)

## Ziel
Prüfen, ob durch die automatische Umbenennung `assets`/`data` -> `_assets`/`_data` versehentlich Themenordner versteckt wurden.

## Manuelle Prüfschritte
1. Kritische Themenpfade mit vielen Unterordnern einzeln geöffnet:
   - `.../Leasing`
   - `.../Nutzwertanalyse`
   - `.../4-Ohren-Modell`
   - `.../Change Management` (Teil01 + Teil02)
   - `.../Fremdvergabe`
   - `.../Anforderungsanalyse`
   - `.../Protokoll anfertigen _`
   - `.../Prozessanalyse _`
   - `.../Stakeholder`
   - `.../Ticketsystem`
2. In jedem dieser Pfade die Inhalte von `_assets` und `_data` direkt geprüft.
3. Abgleich, ob dort spielbare Themenstruktur liegt (HTML/JS-Game-Einstieg) oder nur Technik-/Metadaten.

## Ergebnis (manuell bestätigt)
- In den geprüften Themenpfaden enthalten `_assets` nur Asset-Dateien (oder sind leer).
- In den geprüften Themenpfaden enthalten `_data` nur Metadaten (`__metaData_*.json`) und/oder Konfigurationsdateien (`_gg*.json`).
- Keine der geprüften Umbenennungen hat einen sichtbaren Themenordner mit Spiel-Einstieg (`_ghtml_*`, `game_*.html`) ersetzt.

## Entscheidung
- Keine Rückbenennung in diesem Commit.
- Für Folgeaufträge gilt: keine pauschale Ordner-Massenumbenennung ohne vorherige manuelle Einzelprüfung.
