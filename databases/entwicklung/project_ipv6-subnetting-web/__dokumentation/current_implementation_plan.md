# Implementierungsplan – Session 26-02-20 (WP-01 bis WP-06)

## Branch
- `main`

## Status Arbeitspakete

| WP | Tool | Status | Ergebnis |
|---|---|---|---|
| WP-01 | Präfix-Rechner | ✅ Umgesetzt | Tool-ID `prefix-calculator` mit Eingaben `prefixAlt`, `prefixNeu` und Outputs `adressenImPraefix`, `anzahlSubnetze` |
| WP-02 | Netzadresse & Range | ✅ Umgesetzt | Tool-ID `network-range` mit Eingaben `adresse`, `prefix` und Outputs `netzadresse`, `ersteAdresseImPraefix`, `letzteAdresseImPraefix` |
| WP-03 | Präfix-Split (Enumerator) | ✅ Umgesetzt | Tool-ID `prefix-split-enumerator` mit Eingaben `basisPraefix`, `zielPrefix`, `offset`, `limit` und Outputs `anzahlSubnetzeGesamt`, `subnetze[]` |
| WP-04 | Next/Previous Network | ✅ Umgesetzt | Tool-ID `next-previous-network` mit Eingaben `praefix`, optional `steps` und Outputs `nextPraefix`, `previousPraefix`, `blockgroesse` |
| WP-05 | Containment / Overlap Check | ✅ Umgesetzt | Tool-ID `containment-overlap-check` mit Eingaben `A`, `B` und Outputs `A_in_B`, `overlap` |
| WP-06 | Reverse-DNS Generator | ✅ Umgesetzt | Tool-ID `reverse-dns-generator` mit Eingaben `adresse`, optional `prefix` und Outputs `ip6ArpaFull`, `ip6ArpaBisPrefix` |

## Umgesetzte Integrationen
- Drawer-Metadaten erweitert (`assets/layout.js`): eigene Accordion-Einträge für `prefix-calculator`, `network-range`, `prefix-split-enumerator`, `next-previous-network`, `containment-overlap-check`.
- Tool-Factory erweitert (`assets/tools.js`): Mounting über `createPrefixCalculator(...)`, `createNetworkRange(...)`, `createPrefixSplitEnumerator(...)`, `createNextPreviousNetwork(...)`, `createContainmentOverlapCheck(...)`, `createReverseDnsGenerator(...)`.
- Neue Widgets:
  - `assets/lib/prefix-calculator.js`
  - `assets/lib/network-range.js`
  - `assets/lib/prefix-split-enumerator.js`
  - `assets/lib/next-previous-network.js`
  - `assets/lib/containment-overlap-check.js`
- `assets/lib/reverse-dns-generator.js`
- Core-Lib erweitert (`assets/lib/ipv6.js`): `addressCountForPrefix()`, `subnetCountBetween()`, `prefixRange()`, `enumerateSubprefixes()`, `nextPreviousNetwork()`, `containmentOverlapCheck()`, `reverseDnsIp6Arpa()`.
- Tests erweitert (`assets/lib/ipv6.test.js`).
- Lernpfad aktiviert (`assets/data/lessons.json`):
  - `basics/hex-prefix` zeigt `prefix-calculator`, `network-range`, `prefix-split-enumerator`, `next-previous-network`, `containment-overlap-check`, `reverse-dns-generator`, `prefix-visualizer`
  - `subnetting/prefix-basics` zeigt `prefix-split-enumerator`, `next-previous-network`, `containment-overlap-check`, `reverse-dns-generator`, `network-range`, `prefix-slicer`

## Zusatzänderung (UI)
- Neue Pfadleiste unter der AppBar (`index.html`, `assets/styles.css`, `assets/layout.js`) zeigt den aktuellen Navigationspfad im Format `IPv6 Werkbank > Kapitel > Unterkapitel`.
