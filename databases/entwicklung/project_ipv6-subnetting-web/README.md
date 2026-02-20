# IPv6 Werkbank

**Eine interaktive, build-tool-freie Web-App zum Lernen von IPv6-Subnetting.**  
Reine HTML/CSS/JS-Implementierung – kein Framework, kein Build-Schritt.

---

## 🚀 Schnellstart

```bash
# Lokalen Server starten (Python 3)
cd databases/entwicklung/project_ipv6-subnetting-web
python3 -m http.server 8080

# Alternativ: Node.js
npx serve .
```

Dann im Browser öffnen: **http://localhost:8080**

---

## 📦 Projektstruktur

```
project_ipv6-subnetting-web/
├── index.html                          # Haupt-Einstiegspunkt
├── assets/
│   ├── styles.css                      # Design-System (CSS-Variablen, Themes)
│   ├── app.js                          # Orchestrator (Bootstrap, Theme, Routing)
│   ├── router.js                       # Hash-Router (#/chapter/sub)
│   ├── state.js                        # Zentraler App-State + localStorage
│   ├── layout.js                       # Sidebar, Tool-Panel, Breadcrumb
│   ├── renderer.js                     # Content-Renderer (Blöcke + Tasks)
│   ├── tools.js                        # Tool-Factory-Registry
│   ├── exam-mode.js                    # Prüfungsmodus + Share-Link
│   ├── lib/
│   │   ├── ipv6.js                     # IPv6-Core-Lib (BigInt-Arithmetik)
│   │   ├── ipv6.test.js                # Selbsttests (40+ Testfälle)
│   │   ├── task-engine.js              # Aufgaben-Validatoren + DOM-Renderer
│   │   ├── prefix-visualizer.js        # Prefix-Visualizer-Widget
│   │   ├── prefix-slicer.js            # Prefix-Slicer-Widget
│   │   ├── scenario-generator.js       # Szenario-Generator (Seeded RNG)
│   │   ├── fehlerbilder.js             # Fehlerbilder-Bibliothek + Quiz
│   │   └── ra-demo.js                  # RA-Simulations-Widget
│   └── data/
│       └── lessons.json                # Lerninhalte (Kapitel, Blöcke, Tasks)
├── __dokumentation/
│   └── current_implementation_plan.md  # Aktueller Implementierungsplan
└── __agent/
    ├── chat_history.json               # Agent-Protokoll
    └── tools/                          # Agent-Arbeitspakete
```

---

## 🧩 Architektur

### Modul-Abhängigkeiten

```
app.js (Orchestrator)
├── router.js        → parseHash, navigate, initRouter
├── state.js         → getState, setState, subscribe, findChapter
├── layout.js        → initLayout, mountTools, slotTool, updateBreadcrumb
├── renderer.js      → renderSubchapter, renderPlaceholder
│   └── lib/task-engine.js → createTaskCard, validateAnswer
└── tools.js         → mountActualTools
    ├── lib/ipv6.js                ← Basis für alle Tools
    ├── lib/prefix-visualizer.js
    ├── lib/prefix-slicer.js
    ├── lib/scenario-generator.js
    ├── lib/fehlerbilder.js
    └── lib/ra-demo.js
```

### Render-Pipeline

```
URL hash change → router.js
  → onNavigate(route) in app.js
    → state.js: findSubchapter()
    → renderer.js: renderSubchapter()
    → layout.js: mountTools() + updateBreadcrumb()
    → tools.js: mountActualTools()
```

---

## ⚡ Features

| Feature | Status |
|---|---|
| Dark/Light Theme | ✅ |
| Hash-Routing (Back/Forward) | ✅ |
| Dynamisches Sidebar-Rendering | ✅ |
| Content-Renderer (text/example/hint) | ✅ |
| Aufgaben-Engine (single-input, multiple-choice) | ✅ |
| Prefix-Visualizer (8×16-Bit-Gruppen, Nibble-Coloring) | ✅ |
| Prefix-Slicer (+Bits / Subnetz-Anzahl-Modus) | ✅ |
| Szenario-Generator (Seeded, teilbar via URL) | ✅ |
| Fehlerbilder-Bibliothek (8 Muster + Quiz) | ✅ |
| RA-Demo (4 animierte Szenarien) | ✅ |
| Prüfungsmodus (Timer, Scoring, Note) | ✅ |
| Progress-Tracking (localStorage) | ✅ |
| Exam-Mode (Hints/Tools ausblenden) | ✅ |
| Responsive (Desktop + Mobile) | ✅ |
| Keyboard-Navigation (Escape, Pfeile) | ✅ |
| IPv6-Lib Selbsttests (40+) | ✅ |

---

## 🔬 Smoke-Check / Tests

Öffne `test.html` im Browser, um die IPv6-Core-Lib-Tests auszuführen:

```
http://localhost:8080/test.html
```

---

## 🎓 Lernpfad

1. **Grundlagen** – Hexadezimal, Präfixnotation, Adressstruktur
2. **Adresstypen** – GUA, ULA, Link-Local, Multicast, Loopback
3. **Subnetting** – Präfixe teilen, Nibble-Grenzen, Schritt-für-Schritt
4. **Praxis** – Szenario-Planung, Fehlerbilder, RA-Simulation
5. **Checks** – Prüfungsmodus, Wiederholung

---

## 🛠️ Neue Inhalte hinzufügen

Nur `assets/data/lessons.json` bearbeiten – kein Code-Change nötig!

```jsonc
{
  "chapters": [
    {
      "id": "mein-kapitel",
      "title": "Mein neues Kapitel",
      "icon": "🆕",
      "subchapters": [
        {
          "id": "erster-abschnitt",
          "title": "Erster Abschnitt",
          "tools": ["prefix-visualizer"],
          "blocks": [
            { "type": "text",    "content": "Erklärender Text mit **Formatierung**." },
            { "type": "example", "label": "Beispiel", "code": "2001:db8::/48" },
            { "type": "hint",    "content": "Merke: Immer /64 für SLAAC." }
          ],
          "tasks": [
            {
              "id": "t-unique-id",
              "type": "single-input",
              "validator": "number",
              "question": "Wie viele /56 passen in ein /48?",
              "answer": "256",
              "hint": "2^(56-48) = 2^8",
              "error_rules": [
                { "type": "equals", "value": "8",  "message": "8 sind die Bits, nicht die Anzahl." }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 📄 Lizenz

Für den internen Einsatz. Kommerziell nutzbare Bibliotheken werden nicht verwendet.
