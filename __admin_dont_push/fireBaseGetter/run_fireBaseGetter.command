#!/bin/zsh
set -euo pipefail

# Finder startet .command oft mit HOME als cwd. Wir wollen stabil im Getter-Ordner laufen.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "fireBaseGetter launcher"
echo "cwd: $PWD"
echo ""

if ! command -v cargo >/dev/null 2>&1; then
  echo "ERROR: 'cargo' wurde nicht gefunden."
  echo ""
  echo "Installiere Rust (rustup) und starte das Terminal danach neu:"
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo ""
  echo "Danach erneut diese Datei per Rechtsklick -> Öffnen starten."
  echo ""
  read -r "?Zum Schließen Enter drücken... "
  exit 1
fi

echo "Starte fireBaseGetter via: cargo run --release"
echo ""

set -x
cargo run --release
set +x

echo ""
echo "Fertig."
echo "Output:"
echo "  __admin_dont_push/fireBaseGetter/feedback_all_games.json"
echo "  __admin_dont_push/fireBaseGetter/codex_protocoll_allFeedBack.txt"
echo "  __04_lernings_*/firebase_feedback_import/*"
echo ""
read -r "?Zum Schließen Enter drücken... "
