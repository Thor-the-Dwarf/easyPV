# Arbeitspakete für SQL-Heartbeat Prototyp

## WP1: Grundgerüst & Layout
- **Ziel**: Schematisches Layout gemäß Interface-Plänen (Left, Right, Bottom Drawers + Center + Top Canvas).
- **Details**:
    - HTML-Struktur erstellen.
    - CSS für Layout (Grid/Flex).
    - Resizing-Logik für Drawers (Left, Right, Bottom) implementieren.
    - **Wichtig**: Drawers verschieben den Content (Center), Top Canvas liegt darüber (transparent).

## WP2: SQL Editor (Bottom)
- **Ziel**: Eingabe von SQL-Befehlen.
- **Details**:
    - Simple Code-Editor Komponente (mit Syntax-Highlighting wenn möglich, sonst Textarea).
    - Controls: Play (Start Simulation) und FastForward (Skip) Buttons.

## WP3: Core Simulation Engine
- **Ziel**: Logik für die Ausführung und Visualisierung.
- **Details**:
    - State Management (welcher Step läuft gerade?).
    - Mock-Datenbank (Tabellen & Inhalte).
    - Interpreter-Mock: Zerlegt SQL in visuelle Schritte (z.B. "FROM A", "SELECT *").

## WP4: Prozess-Visualisierung (Right)
- **Ziel**: Feedback zum Ablauf.
- **Details**:
    - Chat-Verlauf (statisch & dynamisch).
    - Simulations-Mode: Zeile für Zeile mit Ladebalken (3s).

## WP5: Tabellen-Visualisierung (Center)
- **Ziel**: Anzeige der Daten.
- **Details**:
    - Darstellung der SQL-Tabellen.
    - Live-Updates während der Simulation (Highlighting/Veränderung).

## WP6: Integration & Canvas
- **Ziel**: Feinschliff.
- **Details**:
    - Top Canvas für übergreifende Effekte nutzen.
    - Alles verknüpfen.
