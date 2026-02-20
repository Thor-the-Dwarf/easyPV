# Aktueller Implementierungsplan – Session 2026-02-20

## Status: WP01 ✅ | WP02 ✅

---

## WP02 – UI-Layout (3-Spalten) + Navigation

### Abgelieferte Dateien
| Datei | Änderung |
|---|---|
| `assets/layout.js` | **NEU** – Sidebar open/close/toggle, mobiler Backdrop, Breadcrumb-API, Tool-Panel-Slot-System (`mountTools`, `slotTool`), Keyboard-Nav (Escape, Pfeil-Tasten), Resize-Handler |
| `assets/app.js` | Refactored – importiert `layout.js`, verbesserte `renderSidebar()` mit Arrow + Count-Badge + Sub-Badges, `navigateTo()` mountet Tools und rendert Content-Blöcke, Task-Checker |
| `assets/styles.css` | Erweitert – Sidebar-Arrows, Progress-Badge, Backdrop, Keyboard-Focus-Ringe, Tool-Widget-System, Content-Artikel, Aufgaben-Cards, Exam-Mode |
| `index.html` | Backdrop-Div, Progress-Badge im Sidebar-Header |

### Design-Entscheidungen
- **`layout.js` als eigenständiges Modul**: Trennt Layout-Concerns von App-Logic in `app.js`
- **`slotTool(id, element)` API**: WP06-WP11 können fertige Components direkt einhängen, ohne Layout-Code zu ändern
- **Exam-Mode via CSS-Klasse**: `body.exam-mode` blendet Hint-Bar, Tool-Panel, Beispiele und Hints aus
- **Keyboard-Navigation**: Escape schließt Sidebar mobil; Pfeil-Tasten navigieren in der Sidebar
- **Progress-Badge**: Zeigt `x/y` abgeschlossene Unterkapitel (basiert auf Task-Korrektheit)

### Acceptance Criteria – WP02
| Kriterium | Status |
|---|---|
| Desktop: 3-Spalten sichtbar | ✅ Grid: `var(--sidebar-w) 1fr var(--tool-panel-w)` |
| Mobile: Sidebar per Button ein/aus | ✅ Overlay-Sidebar + Backdrop + Escape |
| Aktives Kapitel ist visuell markiert | ✅ `.chapter-item.active` + `.subchapter-item.active` |

---

## Nächste Schritte (WP03)

- Hash-Router (`#/chapter/subchapter`) implementieren
- `popstate`-Event für Browser Back/Forward
- App-State aus URL wiederherstellen (ersetzt aktuellen `localStorage`-Ansatz)

---

## Offene WPs
```
WP03 → Hash-Router + Zustandsverwaltung
WP04 → Content-Renderer (Text/Code/Beispiel-Karten)  ← bereits Grundstruktur in app.js
WP05 → IPv6-Core-Lib (Parser/Formatter/BigInt)
WP06 → Prefix-Visualizer
WP07 → Prefix-Slicer
WP08 → Aufgaben-Engine
WP09 → Szenario-Generator
WP10 → Fehlerbilder-Bibliothek
WP11 → Mini-Simulationen
WP12 → Prüfungsmodus
WP13 → Teacher-Mode
WP14 → Accessibility + PWA
WP15 → GitHub Pages Deploy + Doku
```
