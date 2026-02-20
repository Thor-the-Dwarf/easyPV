# Aktueller Implementierungsplan – Session 2026-02-20

## Status: WP01 abgeschlossen ✅

---

## WP01 – Projekt-Skeleton + Dateistruktur

### Abgelieferte Dateien
| Datei | Beschreibung |
|---|---|
| `index.html` | HTML-Skeleton mit Header (Hint-Bar + Hauptzeile), 3-Spalten-Layout (Sidebar, Content, Tool-Panel), Error-Banner |
| `assets/styles.css` | Vollständiges Design-System: CSS-Variablen, Dark/Light-Theme, responsives 3-Spalten-Grid, Buttons, Sidebar, Tool-Panel, Error-Banner, Scrollbar |
| `assets/app.js` | Theme-Init, Sidebar-Toggle, Exam-Mode, `loadLessons()`, `renderSidebar()`, `navigateTo()`, sichtbare `showError()`-API |
| `assets/data/lessons.json` | Vollständiges Lerninhalt-Schema: 5 Kapitel, 11 Unterkapitel, Tasks, Tool-Bindings |
| `assets/lib/.gitkeep` | Platzhalter für IPv6-Core-Lib (WP05) |

### Design-Entscheidungen
- **Dark-First**: `data-theme="dark"` default; Light-Theme per Klick / `prefers-color-scheme`
- **CSS-Variablen**: Alle Farben, Abstände, Radien in `:root`/`[data-theme]` – kein Hardcoding
- **Error-Sichtbarkeit**: `showError()` zeigt Banner im DOM, kein `console.error`-only (Grundregel 9)
- **`type="module"`** auf `app.js`: spätere Imports (WP03 Router, WP05 Core-Lib) ohne Build-Tool möglich
- **`lessons.json` Schema**: bereits vollständig für WP04 (Renderer) nutzbar

### Acceptance Criteria – WP01
| Kriterium | Status |
|---|---|
| Seite lädt ohne Fehler in aktuellen Browsern | ✅ Reines HTML/CSS/JS, keine Deps |
| Keine externen Abhängigkeiten nötig | ✅ Google Fonts optional (nur UX), alle Logik lokal |
| Grundlayout-Container vorhanden (Nav/Main/Tools) | ✅ `#sidebar`, `#content-area`, `#tool-panel` |

---

## Nächste Schritte (WP02)

- Sidebar: Kapitel-Items mit echten Klappmechanismen (aus `lessons.json` gefüllt – Basis vorhanden)
- Content: Breiten- und Scroll-Verhalten finalisieren
- Tool-Panel: Basis-Komponenten vorbereiten
- Mobile: Overlay-Sidebar mit Backdrop

---

## Offene WPs (Reihenfolge)
```
WP02 → UI-Layout verfeinern + Navigation
WP03 → Hash-Router + Zustandsverwaltung
WP04 → Content-Renderer (Text/Code/Beispiel-Karten)
WP05 → IPv6-Core-Lib (Parser/Formatter/BigInt)
WP06 → Prefix-Visualizer
WP07 → Prefix-Slicer
WP08 → Aufgaben-Engine
...
```
