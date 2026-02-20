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
- WP-03 implementiert: neues Tool `prefix-split-enumerator` (basisPraefix, zielPrefix, offset, limit) mit Ausgabe `anzahlSubnetzeGesamt` und `subnetze[]`.
- Core-Lib erweitert: `enumerateSubprefixes()` in `assets/lib/ipv6.js` inkl. Fensterlogik.
- Drawer-Integration erweitert (`assets/tools.js`, `assets/layout.js`) und in `subnetting/prefix-basics` als erster Tool-Eintrag aktiviert.
- WP-03 visual verifiziert: `output/wp03-prefix-split-enumerator/shot-0.png` zeigt den neuen Drawer-Eintrag inkl. korrektem Fenster 0..15 bei /48 -> /56.
- Zusätzliche WP-03-Tests in `assets/lib/ipv6.test.js` ergänzt (Fenster, Index, Equal-Prefix, Fehlerfall).
- WP-04 umgesetzt: neues Tool `next-previous-network` mit Inputs `praefix`, optional `steps` und Outputs `nextPraefix`, `previousPraefix`, `blockgroesse`.
- Core-Lib erweitert: `nextPreviousNetwork()` in `assets/lib/ipv6.js`; Tests in `assets/lib/ipv6.test.js` ergänzt.
- Tool in Drawer integriert (`assets/tools.js`, `assets/layout.js`) und in `subnetting/prefix-basics` aktiviert.
- Playwright-Visual-Checks: `output/wp04-next-previous-network/shot-0.png` und `output/wp04-next-previous-network-open/shot-0.png`.
- Hinweis: Gesamtsuite hat weiterhin 2 bestehende Altfails ausserhalb von WP-04 (`compress(ULA)`, `prefixLastAddress(/48)`).
- Tool-Sichtbarkeit gefixt: `basics/hex-prefix` enthält jetzt zusätzlich `network-range`, `prefix-split-enumerator`, `next-previous-network`.
- Verifiziert mit Screenshot: `output/tools-visible-fix/shot-0.png` (Tools(5) sichtbar).
