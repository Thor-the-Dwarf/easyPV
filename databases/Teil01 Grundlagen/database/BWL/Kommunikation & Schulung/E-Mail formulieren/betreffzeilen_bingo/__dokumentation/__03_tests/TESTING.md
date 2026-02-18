# Testing: Betreffzeilen-Bingo

## Ziel
- Basisqualitaet sicherstellen: Spiel-Dateien vorhanden, Konfig validierbar, Kernlogik lauffaehig.

## Struktur
- unit: lokale Smoke- und Konfig-Tests
- integration: spaetere Integrations-Tests
- fixtures: Testdaten
- artifacts: Screenshots/States
- reports: Testberichte

## Start
- Global + lokal: `node databases/_testing/scripts/run-smoke-tests.mjs`
- Nur dieses Spiel: `node --test "__dokumentation/__03_tests/unit/*.test.mjs"`
