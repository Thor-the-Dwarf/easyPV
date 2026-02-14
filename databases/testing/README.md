# Testing Starter (Smoke-First)

## Ziel
Diese erste Teststufe prueft nur Basisqualitaet:
- `__02_doing_*` ist in Ordnung aufgebaut
- `__03_testing_*` hat lokale Smoke-Tests

## Befehle
- Struktur + lokale Tests erzeugen/aktualisieren:
  - `node databases/testing/scripts/bootstrap-testing-folders.mjs`
- Alle Smoke-Tests starten:
  - `node databases/testing/scripts/run-smoke-tests.mjs`

## Umfang
- Global: Dateistruktur + game-Dateien + sichere lokale HTML-Links
- Lokal: zugehoeriger `__02_doing_*` vorhanden + game-Dateien vorhanden
