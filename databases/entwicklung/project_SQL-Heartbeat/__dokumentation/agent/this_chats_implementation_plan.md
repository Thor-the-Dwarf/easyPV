# Implementierungsplan für SQL-Heartbeat: Data Manipulation & Relations

## WP1 - WP5 + Metadata (ABGESCHLOSSEN)
- Layout, Editor, Simulation, Visualisierung, CREATE TABLE, Metadata Tooltips.

## WP6: Data Manipulation (INSERT, UPDATE, DELETE)
- **Ziel**: Simulator soll Daten dynamisch verändern können.
- **Parser (`parser.js`)**:
    - `INSERT INTO`: Erkenne Syntax, extrahiere Werte. Step-Typ: `INSERT`.
    - `UPDATE`: Erkenne `SET` und `WHERE`. Step-Typ: `UPDATE`.
    - `DELETE`: Erkenne `WHERE`. Step-Typ: `DELETE`.
- **Logic (`main.js`)**:
    - `INSERT`: Füge Zeile zum Daten-Objekt hinzu. Animation: `scaleIn`.
    - `UPDATE`: Suche Zeile (Mock-Logik für WHERE) und update Wert. Animation: `flash-row`.
    - `DELETE`: Entferne Zeile. Animation: `fadeOut` (dann remove).

## WP7: Foreign Key Visualization
- **Ziel**: Verbindungslinien zwischen FK und PK Spalten.
- **Tech**: SVG Overlay (`#top-canvas` existiert bereits, muss genutzt werden).
- **Logik**:
    - Funktion `drawRelationships()`:
        - Iteriere alle Tables/Columns.
        - Finde Spalten mit `isFK`.
        - Berechne Koordinaten von FK-Header und Target-PK-Header.
        - Zeichne Bézier-Kurve im SVG.
    - Trigger: Nach `renderTables()` und bei Layout-Änderungen.

## WP8: Erweiterte Animationen (Outlook)
- Später: Datenfluss-Animationen beim JOIN.
