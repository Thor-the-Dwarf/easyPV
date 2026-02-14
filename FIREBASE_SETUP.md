# Firebase Setup (Feedback + Game Catalog Sync)

## Ziel
- User-Feedback pro Spiel erfassen und auf konkrete Repo-Items (`_g0*.json`, zugehoeriges HTML/JS) rueckfuehrbar speichern.
- Alle `_g0*.json` in eine einheitliche, normalisierte Struktur fuer Sync/Analyse ueberfuehren.

## Relevante Dateien
- Browser Feedback Client: `/Users/thor/WebstormProjects/easyPV/shared/firebase-feedback-client.js`
- Feedback UI (Root Flow): `/Users/thor/WebstormProjects/easyPV/generic_pages/generic_page.js`
- Normalisierung: `/Users/thor/WebstormProjects/easyPV/scripts/g0/build-normalized-catalog.mjs`
- Validator: `/Users/thor/WebstormProjects/easyPV/scripts/g0/validate-source-g0.mjs`
- Firestore Sync: `/Users/thor/WebstormProjects/easyPV/scripts/firebase/sync-g0-catalog-to-firestore.mjs`
- Config Template: `/Users/thor/WebstormProjects/easyPV/firebase.config.local.example.js`

## 1) Browser-Config anlegen
1. `firebase.config.local.example.js` nach `firebase.config.local.js` kopieren.
2. Werte in `window.EASYPV_FIREBASE_CONFIG.firebase` setzen.
3. Feedback-Ziel setzen:
   - `feedback.provider`: `firestore` oder `rtdb`
   - `feedback.collection`: z. B. `game_feedback`

`firebase.config.local.js` ist in `.gitignore`, damit keine Keys committed werden.

## 2) JSON-Normalisierung/Validierung
```bash
npm run check:g0
npm run build:g0-catalog
```

Output:
- `/Users/thor/WebstormProjects/easyPV/databases/metadata/g0-catalog.normalized.json`

## 3) Firestore-Sync vorbereiten
```bash
npm install
```

Benötigte Env-Variablen:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (mit `\n` escaped)
- optional: `FIREBASE_GAMES_COLLECTION` (default `game_catalog`)
- optional: `FIREBASE_SYNC_META_COLLECTION` (default `sync_meta`)
- optional: `G0_CATALOG_PATH` (default `databases/metadata/g0-catalog.normalized.json`)

## 4) Sync ausführen
```bash
npm run sync:g0:firebase
```

Jeder Datensatz wird unter `game_catalog/{gameId}` gespeichert und enthaelt:
- normierte Metadaten
- Repo-Pfade
- Original-Content
- Sync-Metadaten
