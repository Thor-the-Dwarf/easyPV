# Aktueller Implementierungsplan – Session 2026-02-20

## Status: WP01 ✅ | WP02 ✅ | WP03 ✅ | WP04 ✅

---

## WP03 – Client-Routing (Hash) + Zustandsverwaltung

### Abgelieferte Dateien
| Datei | Inhalt |
|---|---|
| `assets/router.js` | **NEU** – `parseHash`, `initRouter(handler)`, `navigate(chapterId, subId)`, `replaceRoute`, `clearRoute`; hashchange-Event-Listener |
| `assets/state.js` | **NEU** – `getState`, `setState(patch)`, `subscribe(fn)`, `findChapter`, `findSubchapter`, `progressSummary`, `markTaskDone`; localStorage-Persistenz für progress + examMode |

### Design-Entscheidungen WP03
- **URL = einzige Quelle der Wahrheit** für aktives Kapitel/Unterkapitel
- `hashchange` statt `pushState` – einfacher, kein Server-Config nötig
- `initRouter` nach `loadLessons()` gestartet – Route erst auflösen wenn Daten vorhanden
- `replaceRoute` für Redirect (z. B. Chapter ohne SubId → erstes SubKapitel) ohne Back-Stack-Eintrag

### Acceptance Criteria – WP03
| Kriterium | Status |
|---|---|
| Reload behält Kapitel (URL-gesteuert) | ✅ Hash im URL, initRouter parst bei Seitenstart |
| Back/Forward funktioniert | ✅ hashchange-Event; jede navigate() = History-Eintrag |
| Kein Vollseiten-Reload beim Wechsel | ✅ hash ändert sich ohne Seitenreload |

---

## WP04 – Content-System (lessons.json) + Renderer

### Abgelieferte Dateien
| Datei | Inhalt |
|---|---|
| `assets/renderer.js` | **NEU** – `renderSubchapter`, `renderPlaceholder`, `renderError`; Block-Renderer für text/example/hint; Task-Checker per Event-Delegation; Enter-Taste-Support; CustomEvent 'task-done' |
| `assets/app.js` | Refactored – schlanker Orchestrator; importiert alle vier Module; Render-Pipeline: Route → findSubchapter → renderSubchapter + mountTools + updateBreadcrumb |
| `assets/styles.css` | Ergänzt – Error-Screen, tasks-list Grid, task-done-State |

### Acceptance Criteria – WP04
| Kriterium | Status |
|---|---|
| Neues Kapitel ohne Code-Änderung über JSON | ✅ renderer.js rendert alle Block-Typen generisch |
| Beispiele und Aufgaben korrekt angezeigt | ✅ example/hint/task-Blöcke implementiert |
| Tool-Panel wechselt passend zum Kapitel | ✅ mountTools(sub.tools) in Render-Pipeline |

---

## Modulstruktur (aktuell)
```
app.js          ← Orchestrator (Bootstrap, Theme, Exam-Mode)
├── router.js   ← Hash-Routing (#/chapter/sub)
├── state.js    ← Zentraler App-State + Persistenz
├── layout.js   ← Sidebar, Backdrop, Tool-Panel, Breadcrumb
└── renderer.js ← Content-Renderer (Block-Typen, Task-Checker)
```

---

## Nächste Schritte (WP05)
- `assets/lib/ipv6.js` – IPv6-Core-Lib
  - `expand(compressed)` → 8×4-hex
  - `compress(full)` → kürzeste Form
  - `toBigInt(addr)` / `fromBigInt(bigint)`
  - `prefixMask(len)` / `applyMask(addr, len)`
  - `subprefix(parentLen, addBits, index)` → Kinder-Präfix
- Basis für WP06 (Visualizer) und WP07 (Slicer)
