# Implementierungsplan – Session 26-02-20

## Ziel dieser Session
- Arbeitspakete auf 6 fachlich sinnvolle IPv6-Tools reduzieren.
- Jedes Tool als eigener Akkordeon-Eintrag im Tool-Drawer (wie Präfix-Visualizer) planen.

## Arbeitspakete

| WP | Tool | Status | Kernfunktion |
|---|---|---|---|
| WP-01 | Präfix-Rechner | Geplant | Adressanzahl pro Präfix, optional Subnetzanzahl /alt -> /neu |
| WP-02 | Netzadresse & Range | Geplant | Netzadresse, erste/letzte Adresse im Präfix |
| WP-03 | Präfix-Split (Enumerator) | Geplant | Präfix aufteilen und Subnetzfenster per offset/limit listen |
| WP-04 | Next/Previous Network | Geplant | Nächstes/vorheriges Netz gleicher Präfixlänge |
| WP-05 | Containment / Overlap Check | Geplant | Enthaltensein und Präfix-Überlappung prüfen |
| WP-06 | Reverse-DNS Generator | Geplant | ip6.arpa vollständig und optional bis Präfixgrenze |

## Architekturelle Leitplanke
- Alle Tools werden über Tool-ID im Drawer-Accordion geführt.
- Pro Tool: Metadaten-Eintrag + Slot im Drawer + Widget-Mount über Tool-Registry.
