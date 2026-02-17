# Testing: Dependency Injection (Grundidee: warum hilft das beim Testen?)

## Ziel
- Basisqualitaet sicherstellen: Spiel-Dateien vorhanden und startbar.

## Struktur
- unit: lokale Smoke-Unit-Tests
- integration: spaetere Integrations-Tests
- fixtures: Testdaten
- artifacts: Screenshots/States
- reports: Testberichte

## Start
- Global + lokal: `node databases/_testing/scripts/run-smoke-tests.mjs`
