# Arbeitspakete für SQL-Heartbeat Prototyp

## WP1: Grundgerüst & Layout ✅ DONE
- HTML-Struktur, CSS Layout (Grid/Flex), Drawer Resizing

## WP2: SQL Editor (Bottom) ✅ DONE
- CodeMirror, Syntax-Highlighting, Play/FastForward Controls

## WP3: Core Simulation Engine ✅ DONE
- State Management, Mock-DB, Interpreter-Mock

## WP4: Prozess-Visualisierung (Right) ✅ DONE
- Chat-Verlauf, Step-by-Step mit Ladebalken

## WP5: Tabellen-Visualisierung (Center) ✅ DONE
- SQL-Tabellen, Live-Highlighting, DML (INSERT/UPDATE/DELETE)

## WP6: FK-Visualisierung (Top Canvas) ✅ DONE
- Staple-Routing, eindeutige Farben je FK, Crow's Foot + Kardinalitäten (n/1), Toggle-Button

---

## WP7: SQL Parser Upgrade – Vollständige Clause-Erkennung 🔄 IN PROGRESS
- **Ziel**: Parser erkennt alle SQL-Clauses und gibt strukturiertes Ergebnis zurück
- **Detected Clauses** (Regex-basiert):
  - SELECT, FROM, JOIN (INNER/LEFT/RIGHT/FULL), WHERE, GROUP BY, HAVING, DISTINCT, ORDER BY, LIMIT, OFFSET
  - INSERT INTO, UPDATE … SET, DELETE FROM
- **Neues Output-Format** von `parser.parse(sql)`:
  ```js
  {
    type: 'SELECT',
    clauses: ['SELECT', 'FROM', 'JOIN', 'WHERE'],   // erkannte Klauseln in Schreibreihenfolge
    tables: ['users', 'logs'],
    columns: ['id', 'name'],
    error: null,    // oder String bei Fehler
    steps: [...]    // bestehende Steps für Simulator
  }
  ```
- **Fehlerbehandlung**: `{ error: 'Fehlende FROM-Klausel', clauses: [], steps: [] }`
- Parser läuft im Hauptprozess → Fehler per UI sichtbar (Rule #9)

---

## WP8: Left Drawer – DBMS Ausführungsreihenfolge (Kern)
- **Ziel**: Visualisierung der Diskrepanz *Schreibreihenfolge (User)* vs. *Ausführungsreihenfolge (DBMS)*
- **Inhalt Left Drawer** (zwei Spalten + Verbindungslinien wie im Bild):
  - **Links** „Schreibreihenfolge": SELECT→FROM→JOIN→WHERE→GROUP BY→HAVING→DISTINCT→ORDER BY→LIMIT→OFFSET
  - **Rechts** „Ausführungsreihenfolge (DBMS)": FROM→JOIN→WHERE→GROUP BY→HAVING→SELECT→DISTINCT→ORDER BY→LIMIT→OFFSET
  - SVG-Verbindungslinien kreuzend zwischen den Spalten, farbcodiert
- **Mapping** (statisch hardcoded):
  ```js
  const WRITE_ORDER     = ['SELECT','FROM','JOIN','WHERE','GROUP BY','HAVING','DISTINCT','ORDER BY','LIMIT','OFFSET'];
  const EXECUTION_ORDER = ['FROM','JOIN','WHERE','GROUP BY','HAVING','SELECT','DISTINCT','ORDER BY','LIMIT','OFFSET'];
  ```
- Drawer ist per Drag resizable, Mindestbreite 220px

---

## WP9: Left Drawer – Live Keyword-Highlighting
- **Ziel**: Erkannte Clauses leuchten in beiden Spalten auf wenn User tippt oder Sim läuft
- **Details**:
  - `editor.on('change')` → Parser → `clauses[]` → CSS-Klasse `kw-active` auf betroffene Keywords
  - SVG-Verbindungslinie zum aktiven Keyword wird dicker / heller
  - Aktuell laufender DBMS-Schritt (aus `simulator.onStepChange`) pulsiert in der rechten Spalte
- **CSS-Klassen**: `.kw-active`, `.kw-done`, `.kw-pending`

---

## WP10: SQL Fehler & Feedback Panel (Left Drawer unten)
- **Ziel**: Menschenlesbare Fehlermeldungen bei ungültigem SQL
- **UI**: Status-Panel am unteren Rand des Left Drawers
  - 🔴 Fehler | 🟡 Warnung | 🟢 OK
  - Text scrollbar bei langen Fehlermeldungen
- **Validierungsregeln**:
  - SELECT ohne FROM → Fehler
  - HAVING ohne GROUP BY → Warnung
  - Unbekannte Klausel → Warnung

---

## WP11: Animations-Layer – Aktiver DBMS-Schritt
- **Ziel**: Aktiver Verarbeitungsschritt wird synchron in allen Bereichen hervorgehoben
- **Details**:
  - Left Drawer (rechte Spalte): Puls-Animation auf aktivem Schritt
  - Center: Tabelle / Zeilen-Highlight (teils vorhanden)
  - Top Canvas: FK-Linie zur relevanten Tabelle kurz aufleuchten
  - Timing: synchron mit `simulator.onStepChange`
- **CSS-Klassen**: `.dbms-step-active` (Glow), `.dbms-step-done` (grau), `.dbms-step-pending` (gedimmt)
