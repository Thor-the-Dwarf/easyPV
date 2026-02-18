# Testing - Anhang-Vergesser-Alarm

## Manual Smoke
1. Spielseite oeffnen.
2. Runde 1 startet mit aktivem Timer.
3. Bei Mail ohne Anhang + Text "Anbei" muss `Stopp` korrekt sein.
4. Bei Mail mit vorhandenem Anhang muss `Senden` korrekt sein.
5. Nach letzter Runde erscheint Ergebnisscreen.

## Technical Checks
- `node --check _gjs_anhang_vergesser_alarm.js`
- JSON validieren: `_data/_gg01_anhang_vergesser_alarm.json`
- Hooks vorhanden: `window.render_game_to_text`, `window.advanceTime`
