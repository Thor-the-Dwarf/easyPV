# Implementierungsplan – Session 26-02-20 (WP-01 Umsetzung)

## Branch
- `codex-project_ipv6-subnetting-web`

## Status Arbeitspakete

| WP | Tool | Status | Ergebnis |
|---|---|---|---|
| WP-01 | Präfix-Rechner | ✅ Umgesetzt | Tool-ID `prefix-calculator` mit Eingaben `prefixAlt`, `prefixNeu` und Outputs `adressenImPraefix`, `anzahlSubnetze` |
| WP-02 | Netzadresse & Range | ⏳ Offen | Noch nicht implementiert |
| WP-03 | Präfix-Split (Enumerator) | ⏳ Offen | Noch nicht implementiert |
| WP-04 | Next/Previous Network | ⏳ Offen | Noch nicht implementiert |
| WP-05 | Containment / Overlap Check | ⏳ Offen | Noch nicht implementiert |
| WP-06 | Reverse-DNS Generator | ⏳ Offen | Noch nicht implementiert |

## Umgesetzte Integrationen
- Drawer-Metadaten erweitert (`assets/layout.js`): eigener Accordion-Eintrag fuer `prefix-calculator`.
- Tool-Factory erweitert (`assets/tools.js`): Mounting ueber `createPrefixCalculator(...)`.
- Neues Widget (`assets/lib/prefix-calculator.js`) inkl. Validierung und Ergebnisdarstellung.
- Core-Lib erweitert (`assets/lib/ipv6.js`): `addressCountForPrefix()`, `subnetCountBetween()`.
- Tests erweitert (`assets/lib/ipv6.test.js`).
- Lernpfad aktiviert (`assets/data/lessons.json`): `basics/hex-prefix` zeigt den neuen Rechner.
