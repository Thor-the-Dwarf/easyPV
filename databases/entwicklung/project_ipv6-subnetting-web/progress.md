Original prompt: Planänderung: Du arbeitest auf ne reigenen Git-Branch die du ertellst. Sie heißt project_ipv6-subnetting-web und du commitest immer darauf. setze nun das Erste Arbeitspaket um

## 2026-02-20
- Branch für diese Umsetzung erstellt: codex-project_ipv6-subnetting-web (Namespace-Konflikt mit bestehendem Branch `codex` verhindert `codex/...`).
- Ziel gesetzt: WP-01 Präfix-Rechner als neues Drawer-Tool implementieren.
- WP-01 implementiert: neues Tool `prefix-calculator` (Widget + CSS + Drawer-Meta + Tool-Factory).
- Core-Lib erweitert: `addressCountForPrefix()` und `subnetCountBetween()` in `assets/lib/ipv6.js`.
- Smoke-Tests erweitert: neue Testfaelle in `assets/lib/ipv6.test.js`.
- Tool in Lernpfad aktiviert: `basics/hex-prefix` nutzt jetzt auch `prefix-calculator`.
- Visual check via Playwright abgeschlossen: Screenshot `output/wp01-prefix-calculator/shot-0.png` zeigt neuen Drawer-Eintrag und korrektes Ergebnis fuer /48.
- Core-Funktionscheck (Node ESM-Snippet) erfolgreich: /64, /128, /48->/56, /64->/64 und Fehlerfall /64->/56.
- Gesamt-Suite `assets/lib/ipv6.test.js` laeuft, hat aber 2 bereits bestehende Altfails (`compress(ULA)`, `prefixLastAddress(/48)`) ausserhalb von WP-01.
- WP-02 umgesetzt: neues Tool `network-range` mit Inputs `adresse`, `prefix` und Outputs `netzadresse`, `ersteAdresseImPraefix`, `letzteAdresseImPraefix`.
- Core-Lib erweitert: `prefixRange()` in `assets/lib/ipv6.js`; Tests in `assets/lib/ipv6.test.js` ergänzt.
- Tool in Drawer integriert (`assets/layout.js`, `assets/tools.js`) und in `subnetting/prefix-basics` aktiviert.
- Playwright-Visual-Check: `output/wp02-network-range/shot-0.png` zeigt korrektes Rendering und Ausgabe.
- Hinweis: Gesamtsuite hat weiterhin 2 bestehende Altfails ausserhalb von WP-02 (`compress(ULA)`, `prefixLastAddress(/48)`).
