# Implementierungsplan – Session 26-02-20 (WP-01 + WP-02)

## Branch
- `codex-project_ipv6-subnetting-web`

## Status Arbeitspakete

| WP | Tool | Status | Ergebnis |
|---|---|---|---|
| WP-01 | Präfix-Rechner | ✅ Umgesetzt | Tool-ID `prefix-calculator` mit Eingaben `prefixAlt`, `prefixNeu` und Outputs `adressenImPraefix`, `anzahlSubnetze` |
| WP-02 | Netzadresse & Range | ✅ Umgesetzt | Tool-ID `network-range` mit Eingaben `adresse`, `prefix` und Outputs `netzadresse`, `ersteAdresseImPraefix`, `letzteAdresseImPraefix` |
| WP-03 | Präfix-Split (Enumerator) | ⏳ Offen | Noch nicht implementiert |
| WP-04 | Next/Previous Network | ⏳ Offen | Noch nicht implementiert |
| WP-05 | Containment / Overlap Check | ⏳ Offen | Noch nicht implementiert |
| WP-06 | Reverse-DNS Generator | ⏳ Offen | Noch nicht implementiert |

## Umgesetzte Integrationen
- Drawer-Metadaten erweitert (`assets/layout.js`): eigene Accordion-Einträge für `prefix-calculator` und `network-range`.
- Tool-Factory erweitert (`assets/tools.js`): Mounting über `createPrefixCalculator(...)` und `createNetworkRange(...)`.
- Neue Widgets:
  - `assets/lib/prefix-calculator.js`
  - `assets/lib/network-range.js`
- Core-Lib erweitert (`assets/lib/ipv6.js`): `addressCountForPrefix()`, `subnetCountBetween()`, `prefixRange()`.
- Tests erweitert (`assets/lib/ipv6.test.js`).
- Lernpfad aktiviert (`assets/data/lessons.json`):
  - `basics/hex-prefix` zeigt `prefix-calculator`
  - `subnetting/prefix-basics` zeigt `network-range`
