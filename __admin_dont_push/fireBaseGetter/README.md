# fireBaseGetter (Rust)

Starrer Getter fuer die Firestore-Collection `feedback_all_games`.

Der Ablauf ist fix und hat keine CLI-Parameter:
1. Repo-Root ueber `.git` finden.
2. Service-Account aus `firebase-service-account.local.json` lesen.
3. OAuth2 Access-Token per JWT (`RS256`) holen.
4. Alle Seiten von `feedback_all_games` aus Firestore ziehen.
5. Harte, fest codierte Prompt-Injection-Sicherheitspruefung auf allen Kommentar-Feldern ausfuehren.
6. Ergebnis immer in `__admin_dont_push/fireBaseGetter/feedback_all_games.json` ueberschreiben.

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
  - `commentSecurity` (Sanitizer-Bericht pro Kommentarfeld)

## Hardcoded Security

Der Getter hat eine feste Defense-in-Depth-Pipeline fuer User-Kommentare:
- Unicode-Normalisierung (NFKC)
- Entfernen von Steuerzeichen und Zero-Width-Zeichen
- Whitespace-Normalisierung und Trimming
- Laengenlimit (`COMMENT_MAX_CHARS`)
- Erkennung typischer Prompt-Injection-Muster (u. a. Role-Override, System-Prompt-Exfiltration, Tool-/Function-Injection, XML-Role-Tags, Code-Fences, dangerous URI schemes)
- Rewrite/Redaction gefaehrlicher Muster
- Harte Blockierung bei jedem erkannten Injection-Muster (zusaetzlich Score-Schwelle `BLOCK_SCORE_THRESHOLD`)

Geblockte Kommentare werden durch `"[blocked-by-fireBaseGetter-security]"` ersetzt.
