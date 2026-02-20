# Aktueller Implementierungsplan – Session 2026-02-20

## Status: WP01 ✅ | WP02 ✅ | WP03 ✅ | WP04 ✅ | WP05 ✅

---

## WP05 – IPv6-Core-Lib

### Abgelieferte Dateien
| Datei | Inhalt |
|---|---|
| `assets/lib/ipv6.js` | **NEU** – vollständige IPv6-Lib: expand, compress, toBigInt, fromBigInt, prefixMask, applyMask, subprefix, listSubnets, getAddressType, prefixContains, groupInfo, isValidIPv6, isNibbleBoundary |
| `assets/lib/ipv6.test.js` | **NEU** – 40+ Testfälle; `runTests()` exportiert; DOM-Ausgabe in #test-results für WP15 |

### Exportierte Funktionen
```
expand(addr)                          → '2001:0db8:...' (8×4 hex)
compress(addr)                        → kürzeste RFC-5952-Form
toBigInt(addr)                        → bigint
fromBigInt(n)                         → Vollform-String
prefixMask(len)                       → bigint (128-bit Maske)
applyMask(addr, len)                  → Netzwerkadresse (Vollform)
subprefix(cidr, addBits, index)       → { address, prefixLen, cidr, cidrFull }
prefixLastAddress(addr, len)          → letzte Adresse im Präfix (Vollform)
subnetCount(addBits)                  → bigint (2^addBits)
listSubnets(cidr, addBits, maxShow)   → { subnets, last, total, newPrefixLen }
getAddressType(addr)                  → { type, label }   (gua/ula/link-local/…)
prefixContains(cidr, addr)            → boolean
groupInfo(addr, prefixLen)            → Array (für WP06-Visualizer)
isValidIPv6(addr)                     → boolean
isNibbleBoundary(len)                 → boolean
```

### Design-Entscheidungen
- **BigInt-only**: Kein Number für 128-Bit-Arithmetic – kein Overflow möglich
- **expand() als Basis**: alle anderen Funktionen rufen expand() auf, bevor sie rechnen
- **Keine State- oder DOM-Abhängigkeit**: reine Berechnungsfunktionen, testbar in Node.js
- **groupInfo()** für WP06 bereits vorbereitet: gibt pro Gruppe an ob Präfix-Anteil voll/partiell/keine
- **listSubnets()** für WP07 vorbereitet: erste N + letztes Subnetz ohne riesige Listen

### Testfälle
- expand: ::, ::1, 2001:db8::1, fe80::1, link-local EUI-64, IPv4-mapped
- compress: all-zeros→::, loopback, GUA, ULA, Link-Local EUI-64
- BigInt round-trip, prefixMask(0/48/64/128)
- applyMask, subprefix (mehrere Indizes, Nibble-Grienze, Fehler-Werfen)
- subnetCount, isNibbleBoundary, isValidIPv6, prefixLastAddress
- getAddressType (alle Typen), prefixContains, listSubnets

---

## Nächste Schritte
```
WP06 → Prefix-Visualizer (nutzt groupInfo() aus ipv6.js)
WP07 → Prefix-Slicer     (nutzt listSubnets() aus ipv6.js)
WP08 → Aufgaben-Engine
...
```
