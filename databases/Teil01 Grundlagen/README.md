# Teil01 Grundlagen - Interface Port

Das Interface wurde aus `Backend_fiaeAP2` in dieses Projekt uebernommen.

## Fokus
- Gleiches UI (AppBar, Drawer, Suche, Filter, Tree, Content-Bereich)
- Datenquelle lokal aus dem Repo-Ordner `database/`
- Keine Spiel-/Prototyp-Logik im Loader

## Start
1. Index neu bauen:
   ```bash
   npm run build:index
   ```
2. Lokalen Server starten:
   ```bash
   npm run dev
   ```
3. Oeffnen:
   [http://localhost:4173](http://localhost:4173)

## Dateien
- `/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/index.html` (direkt aus Backend_fiaeAP2)
- `/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/shared_theme.css` (direkt aus Backend_fiaeAP2)
- `/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/index.js` (auf lokale `database`-Quelle angepasst)
- `/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/_scripts/build-database-index.mjs`
- `/Users/thor/WebstormProjects/easyPV/databases/Teil01 Grundlagen/_scripts/dev-server.mjs`

## Kommentar-Funktion (Firebase)
Die Feedback-Komponente aus dem anderen Projekt ist eingebunden.

- UI: `feedback.css` + `feedback.js`
- Firebase-Konfig: `config.local.js`
- Einbindung in `index.html`

Beim Senden wird Feedback in die Realtime Database unter der Collection `feedback` gespeichert.
Zusatzdaten (Datei-Kontext) werden aus der aktuell geoeffneten Datei uebernommen.
