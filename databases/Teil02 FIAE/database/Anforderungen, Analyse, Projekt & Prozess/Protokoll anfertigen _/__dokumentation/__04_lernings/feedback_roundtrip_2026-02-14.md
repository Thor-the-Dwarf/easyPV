# Feedback Roundtrip Test (Firestore)

## Testkontext
- Datum (UTC): 2026-02-14T18:10:30.148Z
- Collection: `feedback_all_games`
- Getestete Generic-Page:
  - `generic_pages/generic_page.html`
- Zielordner (Repo-Pfad):
  - `databases/Teil02 FIAE/database/Anforderungen, Analyse, Projekt & Prozess/Erschienene Themen/Protokoll anfertigen _/__02_doing_Protokoll anfertigen _`
- Testspiel:
  - `databases/Teil02 FIAE/database/Anforderungen, Analyse, Projekt & Prozess/Erschienene Themen/Protokoll anfertigen _/__02_doing_Protokoll anfertigen _/_ghtml_inhalts_check.html`

## Gesendete Testdaten
1. Generic-Feedback
- comment: `[AUTO][generic][20260214181020013] Protokoll-Ordnerpfad pruefen`
- source: `generic_page`
- context.folderPath: `databases/Teil02 FIAE/database/Anforderungen, Analyse, Projekt & Prozess/Erschienene Themen/Protokoll anfertigen _/__02_doing_Protokoll anfertigen _`
- context.gameTitle: `null`

2. Game-Feedback
- comment: `[AUTO][game][20260214181020013] Protokoll-Ordnerpfad+Titel pruefen`
- source: `game_page`
- context.folderPath: `databases/Teil02 FIAE/database/Anforderungen, Analyse, Projekt & Prozess/Erschienene Themen/Protokoll anfertigen _/__02_doing_Protokoll anfertigen _`
- context.gameTitle: `Inhalts-Check`

## Firestore-Abfrage (Roundtrip)
1. Dokument `RXsCC4WKwXyYHqbgbYiu`
- exists: `true`
- source: `generic_page`
- comment: `[AUTO][generic][20260214181020013] Protokoll-Ordnerpfad pruefen`
- context.folderPath vorhanden: `ja`
- context.gameTitle vorhanden: `ja (null im Generic-Modus)`

2. Dokument `Lys2wb3BiaKkJAGhsH0j`
- exists: `true`
- source: `game_page`
- comment: `[AUTO][game][20260214181020013] Protokoll-Ordnerpfad+Titel pruefen`
- context.folderPath vorhanden: `ja`
- context.gameTitle vorhanden: `ja ("Inhalts-Check")`

## Artefakte
- JSON-Roundtrip:
  - `output/firebase-feedback-test/feedback-roundtrip-20260214181020013.json`
- Screenshot:
  - `output/firebase-feedback-test/feedback-roundtrip-20260214181020013.png`

## Ergebnis
- Generic-Feedback sendet jetzt den Ordnerpfad mit.
- Game-Feedback sendet den Ordnerpfad und den Game-Titel mit.
- Beide Datensaetze wurden in Firestore gespeichert und erfolgreich wieder abgefragt.
