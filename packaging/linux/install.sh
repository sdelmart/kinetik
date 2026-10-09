#!/bin/sh
# Installs KINETIK for the current user only (no root): the binary and icon
# go to ~/.local/share/kinetik, and a launcher appears in the app menu.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
target="${XDG_DATA_HOME:-$HOME/.local/share}/kinetik"
apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
desktop="$apps/kinetik.desktop"

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$target" "$desktop"
  echo "KINETIK a été désinstallé."
  exit 0
fi

mkdir -p "$target" "$apps"
cp "$here/kinetik" "$here/kinetik.png" "$target/"
chmod +x "$target/kinetik"

cat > "$desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=KINETIK
Comment=Puzzle industriel de tri de conteneurs
Exec=$target/kinetik
Icon=$target/kinetik.png
Terminal=false
Categories=Game;LogicGame;
DESKTOP

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" >/dev/null 2>&1 || true
echo "KINETIK est installé : il apparaît dans le menu des applications."
