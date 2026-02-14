# fireBaseGetter (Rust)

Starrer Getter fuer die Firestore-Collection `feedback_all_games`.

Der Ablauf ist fix und hat keine CLI-Parameter:
1. Repo-Root ueber `.git` finden.
2. Service-Account aus `firebase-service-account.local.json` lesen.
3. OAuth2 Access-Token per JWT (`RS256`) holen.
4. Alle Seiten von `feedback_all_games` aus Firestore ziehen.
5. Ergebnis immer in `__admin_dont_push/fireBaseGetter/feedback_all_games.json` ueberschreiben.

## Start

```bash
cd __admin_dont_push/fireBaseGetter
cargo run --release
```

## Hinweise

- Erwartet lokal die Datei `firebase-service-account.local.json` im Repo-Root.
- Das Output-JSON enthaelt pro Dokument:
  - `id`
  - `data` (normalisierte Firestore-Felder)
  - `raw` (Original-Firestore-Dokument)
