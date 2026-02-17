# TeamChef01

## Ziel
1. FolderTree soll Ordner ignorieren, die mit `_` beginnen.
2. Technische Ordner, die User nicht sehen sollen, werden per Namenskonvention `_...` markiert.
3. Icon-Logik im FolderTree: Prüfungs-/Vergangenheitsthemen = 🔥, sonstige Game-Folder = 📚.
4. Alte Themenordner-Namen müssen weiterhin erkannt werden (`Erschienene Themen`, `Vergangene Themen`, `Mögliche Themen`).

## Team-Phasenordner
- `__agent_dont_push/Team-Code-Writing/__01_analyses`
- `__agent_dont_push/Team-Code-Writing/__02_plans`
- `__agent_dont_push/Team-Code-Writing/__03_tests`
- `__agent_dont_push/Team-Code-Writing/__04_lernings`
- `__agent_dont_push/Team-Code-Writing/__05_feedback`

## Team-Rollen
- Analyse-Spezialist: bewertet Ist-Zustand, Risiken, Seiteneffekte.
- UML-/Plan-Spezialist: definiert Umsetzungsschritte und Prüfkriterien.
- Software-Spezialist: implementiert Änderungen in kleinen, sicheren Deltas.
- Test-Spezialist: validiert visuell + technisch (inkl. Regressionen).

## Arbeitsregeln
- Vor Umsetzung immer Projektüberblick (Theme-Mode, Firebase-Feedback, Tree-UI) prüfen.
- Jede Phase dokumentiert ihr Ergebnis im passenden Phasenordner.
- Informationen aus Vorgänger-Artefakten werden aktiv berücksichtigt.
- Learnings zur Komponente landen in `__04_lernings/TeamChef01.txt`.
- Keine globalen Massen-Umbenennungen von Ordnern ohne vorherige manuelle Einzelprüfung je Themenpfad.

## Git-Konvention
- Commit-Message-Format: `TeamChef01: <kurze Beschreibung>`
