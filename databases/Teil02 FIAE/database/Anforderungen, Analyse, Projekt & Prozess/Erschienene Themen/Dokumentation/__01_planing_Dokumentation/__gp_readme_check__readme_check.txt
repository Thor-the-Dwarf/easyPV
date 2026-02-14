Anforderungen (UX-Game-Optimiert)
- Ziel: Erstellung einer vollständigen und strukturell korrekten README.md für ein Softwareprojekt zur Sicherstellung der Informationsverfügbarkeit für Dritte.
- Game-Mechanic: "The Markdown Builder". Der Spieler erhält einen "Baukasten" mit verschiedenen Dokumentations-Modulen (H1 Titel, Installation, Lizenz etc.) und muss diese in die richtige Reihenfolge in den "README-Editor" ziehen.
- Challenge: 
  - Level 1: Standard-Blöcke (Titel, Beschreibung, Installation).
  - Level 2: "Dependency-Check" - Dokumentation von Voraussetzungen (Prerequisites) vor der Installationsanleitung platzieren.
  - Level 3: "Global Compliance" - Sicherstellen, dass rechtliche Hinweise (License/Contact) vorhanden und korrekt platziert sind.

Arbeitspakete (UX-Game-Optimiert)
1. Interactive HUD und Scoring
- [ ] HUD-Elemente: "Completeness-Meter" (Fortschrittsbalken), "Structure-Score" (Qualitäts-Rating).
- [ ] Scoring: Bonus für logische Abfolge (z.B. Installation vor Usage). Punktabzug bei vergessenen Pflichtfeldern (Title).

2. Screen-Layout (The Documentation Lab)
- [ ] `editor-area -> build-blocks-sidebar -> live-preview-panel -> sync-status`.
- [ ] Sidebar: Karten mit Titeln wie "Installation", "Usage", "License", "Contributing".
- [ ] Editor: Ein leerer Bereich mit "Slot-Indikatoren" zum Einrasten der Blöcke.

3. Kernvisuals und Effekte
- [ ] Developer-Aesthetic: Dark Mode, Monospace Fonts (JetBrains Mono/Courier), Syntax-Highlighting Look.
- [ ] "Markdown-Sparkle": Wenn ein Block korrekt platziert wird, erscheint kurz eine gerenderte HTML-Vorschau mit einem Glanzeffekt.
- [ ] Drag-Shadows: Während des Ziehens zeigt ein Schatten die potenzielle Endposition an.

4. Browser- und Device-Resilienz
- [ ] Touch-Friendly D&D: Nutzung von Pointer-Events für nahtlose Bedienung auf Tablets.
- [ ] Responsive Sidebar: Auf Mobile klappt die Block-Auswahl von unten ein (Drawer-System).

5. Content-Strategie (Markdown Blocks)
- [ ] 15 verschiedene Bausteine: Pflichtfelder, optionale Goodies (Badges, Screenshots-Platzhalter) und "Distractors" (unnötige Infos wie "Wetter von heute").

6. QA-Paket
- [ ] Test: Funktioniert das Einrasten (Snapping) der Blöcke frustfrei?
- [ ] Test: Wird die Vorschau korrekt gerendert (Symbolisch)?

7. Abnahme-Kriterien
- [ ] Der Spieler kennt die Standard-Bestandteile einer Projektdokumentation.
- [ ] Das Interface fühlt sich "nerdig" und professionell an (Code-Editor-Vibe).
- [ ] Das haptische Feedback beim "Snappen" der Blöcke ist befriedigend.
