# Aktueller Implementierungsplan – Session 2026-02-20

## Status: WP01-WP07 ✅

---

## WP06 – Prefix-Visualizer + WP07 – Prefix-Slicer

### Abgelieferte Dateien
| Datei | Inhalt |
|---|---|
| `assets/lib/prefix-visualizer.js` | **NEU** – `createPrefixVisualizer()`: 8 Hex-Gruppen, Nibble-Coloring, Bit-Bar, Adresstyp-Badge, Copy-Buttons, Nibble-Grenz-Warnung, Live-Update (debounced) |
| `assets/lib/prefix-slicer.js` | **NEU** – `createPrefixSlicer()`: CIDR-Input, +Bits-Slider, Subnetz-Anzahl-Modus, Summary-Block, erste 5+letztes Subnetz, Copy-Buttons, Nibble-Grenz-Warnung/OK |
| `assets/tools.js` | **NEU** – Tool-Registry (`TOOL_FACTORIES` Map), `mountActualTools(ids, ctx)`, `registeredToolIds()` |
| `assets/app.js` | Import + Aufruf von `mountActualTools` nach `mountTools` in Render-Pipeline |
| `assets/styles.css` | +450 Zeilen: Sections 23 (Visualizer) + 24 (Slicer) |

### Design-Entscheidungen
- **Tool-Factory-Pattern**: `TOOL_FACTORIES` Map entkoppelt Tool-IDs von Implementierungen; WP09-WP11 ergänzen nur Map-Einträge
- **`slotTool(id, element)`**: Layouts `placeholder` wird durch echtes Widget ersetzt ohne Layout-Logik zu berühren
- **Debounce im Visualizer**: 400ms Delay beim Tippen, sofort bei Enter/Button
- **Slicer Mode-Tabs**: +Bits vs. Subnetzanzahl, Anzahl wird auf nächste 2^n-Potenz aufgerundet
- **`defaultCidr` Context**: tools.js übergibt Kontext; später kann der aktuelle Unterkapitel-Beispielwert further übergeben werden

### Acceptance Criteria – WP06
| Kriterium | Status |
|---|---|
| Präfix-Highlight passt zu /48,/52,/56,/60,/64 | ✅ Nibble-Coloring im Visualizer |
| Änderung der Eingabe aktualisiert live | ✅ debounced input + Enter |
| Copy liefert exakt erwartete Zeichenkette | ✅ clipboard API + Fallback |

### Acceptance Criteria – WP07
| Kriterium | Status |
|---|---|
| Für /48 +8 ergibt /56 und 256 Subnetze | ✅ Über listSubnets() aus ipv6.js |
| Liste zeigt korrekt index 0..4 und index last | ✅ Subnets + lastItem Separator |
| UI bleibt schnell (keine riesigen Listen) | ✅ maxShow=5 in listSubnets() |

---

## Modulstruktur (aktuell)
```
app.js          ← Orchestrator
├── router.js   ← Hash-Routing
├── state.js    ← App-State
├── layout.js   ← Sidebar, Tool-Panel
├── renderer.js ← Content-Renderer
└── tools.js    ← Tool-Registry
    ├── lib/ipv6.js               ← Core-Lib
    ├── lib/prefix-visualizer.js  ← WP06
    └── lib/prefix-slicer.js      ← WP07
```

---

## Nächste Schritte
```
WP08 → Aufgaben-Engine (Validator + Feedback)
WP09 → Szenario-Generator
WP10 → Fehlerbilder-Bibliothek
WP11 → Mini-Simulationen (RA/NDP/PMTUD)
WP12 → Prüfungsmodus
WP13 → Teacher-Mode
WP14 → Accessibility + PWA
WP15 → Deploy + Doku
```
