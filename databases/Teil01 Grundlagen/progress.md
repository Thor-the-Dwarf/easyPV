Original prompt: Teil01 Grundlagen ist ein Reroll der Backend_fiaeAP2. Neuerungen: Individuelle Json-Spiele(Prototypen) andere json-dateien. Aber im Grunde selber Aufbau. Soll heißen ich will das du die Testumgebung erstellst. Also die AppBar und das alles Rüber Holst. Die json dateien kommen diesmal aus dem Ordner "database" welcher Teil des Repositoris ist. Bereite alles Vor damit wir nachher entspannt die Prototypen alle implementieren und testen können.

## 2026-02-11 - Interface-Port
- Original-Interface aus `Backend_fiaeAP2` uebernommen (`index.html`, `shared_theme.css`).
- `index.js` auf lokale Datenquelle (`database-index.json` und `database/...`) angepasst.
- Spiel-Loader/iframe-Nutzung entfernt; Dateien werden im Content-Bereich angezeigt.
- Index-Builder aktualisiert (`kind`-Mapping fuer json/pdf/pptx/txt/etc.).
- HTTP-Smoketest erfolgreich fuer `/`, `/database-index.json`, und Dateien unter `/database/...`.

## TODO
- Optional spaeter: spezifischer JSON-Prototyp-Renderer pro Schema.

## 2026-02-11 - Firebase Feedback integriert
- Kommentar-/Feedback-Funktion aus `Backend_fiaeAP2` uebernommen.
- Dateien hinzugefuegt: `feedback.js`, `feedback.css`, `config.local.js`.
- `index.html` um Feedback-CSS + Scripts erweitert.
- `index.js` setzt beim Dateiwechsel `feedback_context_v1` in `sessionStorage`, damit Feedback dem aktuellen Inhalt zugeordnet wird.

## 2026-02-11 - Prototyp 01 implementiert (Leasing)
- Erster GamePlan aus der Liste umgesetzt: `GamePlan-Der-gnadenlose-Gutachter.txt`.
- Dateien erstellt im selben Themenordner:
  - `_ghtml_leasing_gutachter.html`
  - `_gjs_leasing_gutachter.js`
  - `game_leasing_gutachter.json`
  - `_gs_grey_leasing.css` (shared fuer zusammenhaengende Leasing-Prototypen)
- Umgesetzt: Slideshow-Faelle, Entscheidung (Zahlen/Gratis), Score, Feedback je Fall, Endscreen mit "zu viel gezahlt".
- Test-Hooks gesetzt: `window.render_game_to_text()` und `window.advanceTime(ms)`.
- Playwright-Smoke-Test aktiviert und lauffaehig gemacht (Client + Browser installiert).
- Erstes Screenshot zeigte graues Bild wegen externer Bild-URLs; behoben durch lokale SVG-Assets (`Leasing/assets/damage-01..05.svg`).
- Re-Test erfolgreich: Screenshot zeigt korrekten ersten Fall, `state-0.json` liefert erwarteten Zustand.

## 2026-02-11 - AP1-Pruefungsbezug hergestellt
- Prototyp inhaltlich von Leasing-Rueckgabe auf AP1-IT-Maengelarten umgestellt.
- Neue Klassifikation: Sachmangel, Qualitaetsmangel, Mengenmangel, Quantitaetsmangel, Rechtsmangel.
- IT-nahe Faelle (Hardware, Lieferung, Netzwerkleistung, SSD-Qualitaet, Lizenzrechte) eingebaut.
- Auswertung und Feedback mit direktem AP1-Bezug je Fall erweitert.
- Playwright-Re-Test erfolgreich, aktueller Screenshot zeigt AP1-Version korrekt.

## 2026-02-11 - Prototyp 02 implementiert
- `GamePlan-Finanzierungs-Sortiermaschine.txt` umgesetzt als neuer spielbarer Prototyp.
- Neue Dateien:
  - `_ghtml_finanzierungs_sortiermaschine.html`
  - `_gjs_finanzierungs_sortiermaschine.js`
  - `game_finanzierungs_sortiermaschine.json`
- `_gs_grey_leasing.css` um namespacete Styles fuer Sortiermaschine erweitert.
- Features: 3 Kategorien (Leasing/Kreditkauf/Eigenkapital), 10 Begriffe, Swipe/Touch + Klick-Fallback, Score (+10/-10), Streak, Feedback, Vibrations-/Audio-Feedback mit Mute.
- Playwright-Smoke-Test erfolgreich, Artefakte in `output/web-game-sortier/`.

## 2026-02-12 - Leasing-Kalkulator-Challenge Feinschliff
- Bugfix: `assets/leasing-kalkulator-asset.svg` repariert (ungueltiges `<` in SVG-Text auf `&lt;=` korrigiert), dadurch wird das Asset im Browser wieder korrekt gerendert.
- Responsive-Optimierung fuer globale Browser-/Mobile-Ansicht in `_gs_grey_leasing.css`:
  - Assetbereich vergroessert (Desktop/Tablet) und besser gewichtet im Split-Layout.
  - Zusetzliche Breakpoints fuer <=760px und <=430px (kompakter Header, einspaltige Targets, optimierte Abstaende und Touch-Hoehen).
- Playwright-Umgebung wieder lauffaehig gemacht (fehlende Browser installiert; Testlauf via eskalierter Ausfuehrung).
- Visueller Re-Test erfolgreich: `output/web-game-kalk/shot-0.png` zeigt sichtbares Asset und stabiles Layout; `state-0.json` liefert konsistenten Zustand.

## 2026-02-12 - Prototyp 03 umgesetzt (Nutzwertanalyse)
- Neuer Prototyp `GamePlan-Der-Matrix-Architekt.txt` implementiert in:
  - `database/BWL/Auswahl & Bewertung/Erschienene Themen/Nutzwertanalyse/_ghtml_der_matrix_architekt.html`
  - `database/BWL/Auswahl & Bewertung/Erschienene Themen/Nutzwertanalyse/_gjs_der_matrix_architekt.js`
  - `database/BWL/Auswahl & Bewertung/Erschienene Themen/Nutzwertanalyse/game_der_matrix_architekt.json`
  - `database/BWL/Auswahl & Bewertung/Erschienene Themen/Nutzwertanalyse/_gs_grey_nutzwertanalyse.css`
- Umgesetzt: Blueprint-UI, Bauteil-Bibliothek, Grid-Slots, Drag&Drop + Tap-Select-Placement (Touch-freundlich), Snap/Lock bei korrekter Platzierung, Fehler-Shake bei falscher Platzierung.
- KPI-Logik: Bau-Fortschritt in %, Treffer-Anzahl, Stabilitaetsstatus; Finish-Button pulsiert bei vollstaendiger Struktur.
- Test-Hooks bereitgestellt: `window.render_game_to_text()` und `window.advanceTime(ms)`.
- Syntaxcheck + Playwright-Smoke-Test erfolgreich, Artefakte in `output/web-game-matrix/`.

## 2026-02-12 - Matrix-Architekt komplett neu aufgebaut (User-Redesign)
- Prototyp nach neuer Vorgabe vollstaendig ersetzt:
  1) Situationstext oben (Kunde + Zukunftsplaene)
  2) Darunter echte Nutzwertanalyse-Tabelle als Drag-Grid
  3) Drag-Items darunter/seitlich je nach Portrait/Landscape
- `Nr`, `Kriterium`, `Gewichtung` sind fest vorgegeben; nur `Punkte` und `gP` werden per Drag/Touch gesetzt.
- Tabelle mit Alternativen (`Notebook`, `All-in-One-PC`, `Thin-Client`, `Desktop`) inkl. Auswertungszeile umgesetzt.
- Responsive-Logik: in Landscape (breit) steht Item-Pool rechts, auf kleineren Portrait-Ansichten unter der Tabelle.
- Interaktion: Drag&Drop + Tap-Select/Place, Fehlplatzierung mit rotem Feedback und Shake, Fortschritt in %.
- Testlauf erfolgreich: `output/web-game-matrix/shot-0.png`, `output/web-game-matrix/state-0.json`.

## 2026-02-12 - Matrix-Architekt auf Dropdown-Mechanik umgestellt
- Drag&Drop komplett entfernt.
- Punktevergabe jetzt ueber Dropdowns in jeder `Punkte`-Spalte.
- `gP`-Spalten werden live berechnet (`Gewichtung * Punkte / 100`) und sofort aktualisiert.
- Auswertungszeile (`gP`-Summen je Alternative) wird ebenfalls live aktualisiert.
- Layout vereinfacht: keine Drag-Item-Spalte mehr, voller Fokus auf Tabelle + Situationstext.
- Testlauf erfolgreich: Syntaxcheck + Playwright-Smoke-Test gruen.

## 2026-02-12 - Matrix-Architekt Lernmodus erweitert
- Punkteskala angepasst: nur 1 bis 4 Punkte moeglich, 0 entfernt.
- Submit-Pruefung hinzugefuegt: Auswahl wird gegen Musterloesung geprueft, Felder als richtig/falsch markiert.
- Nach Submit wird eine Vergleichstabelle eingeblendet:
  - Zeilen und Spalten enthalten wieder die Geraete.
  - Je Zelle steht ein begruendeter Paarvergleich fuer das gewaehlt Kriterium.
- Kriterium-Selector eingebaut, um Vergleichserklaerungen pro Kriterium umzuschalten.
- JSON um fachliche Begruendungstexte (`reasoning`) je Kriterium/Geraet erweitert.
- Re-Test erfolgreich (Syntax + Browser-Screenshot-Run).
- Vergleichserklaerung erweitert: Nach Submit gibt es jetzt standardmaessig die Option `Alle Kriterien`, wodurch pro Geraetepaar alle Kriterien mit Begruendung ausgegeben werden (nicht nur ein Einzelkriterium).
- User-Feedback umgesetzt:
  - Vergleichsteil auf `eine Tabelle pro Kriterium` umgestellt (statt Sammelansicht).
  - Punktewerte pro Kriterium auf eindeutige Rangfolge korrigiert (1,2,3,4 ohne Dopplung).
  - UI-Logik ergaenzt, sodass Dopplungen in einer Zeile verhindert werden (Optionen werden pro Zeile exklusiv deaktiviert).
  - Submit validiert zusaetzlich auf Dopplungen und blockiert mit klarer Fehlermeldung.

## 2026-02-12 - Prototyp umgesetzt: Der Deeskalations-Profi
- `GamePlan-Der-Deeskalations-Profi.txt` umgesetzt in:
  - `database/BWL/Kommunikation & Schulung/Erschienene Themen/4-Ohren-Modell/game_4ohren_deeskalation.json`
  - `database/BWL/Kommunikation & Schulung/Erschienene Themen/4-Ohren-Modell/_ghtml_4ohren_deeskalation.html`
  - `database/BWL/Kommunikation & Schulung/Erschienene Themen/4-Ohren-Modell/_gjs_4ohren_deeskalation.js`
  - `database/BWL/Kommunikation & Schulung/Erschienene Themen/4-Ohren-Modell/_gs_grey_kommunikation.css`
- Features: 5 Konfliktszenarien, drei Antwortoptionen je Runde, nur sachliche Antwort = 100 Punkte, sonst 0.
- KPI-Anzeige: Runde, Punkte, Quote; Feedback je Auswahl und Endauswertung mit Neustart.
- Test-Hooks integriert: `window.render_game_to_text()` und `window.advanceTime(ms)`.
- Syntaxcheck + Playwright-Smoke-Test erfolgreich, Artefakte in `output/web-game-deesk/`.
