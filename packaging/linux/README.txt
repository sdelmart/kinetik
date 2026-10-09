KINETIK — version Linux portable (x86_64)
==========================================

Lancer le jeu
-------------
    ./kinetik

Dépendances
-----------
Le jeu utilise WebKitGTK 4.1, déjà présent sur la plupart des bureaux
GNOME/KDE. S'il manque, installe-le :

  Debian / Ubuntu / Mint / Pop!_OS :  sudo apt install libwebkit2gtk-4.1-0
  Fedora                           :  sudo dnf install webkit2gtk4.1
  Arch / Manjaro / EndeavourOS     :  sudo pacman -S webkit2gtk-4.1
  openSUSE                         :  sudo zypper install libwebkit2gtk-4_1-0

Installer dans le menu des applications (optionnel)
---------------------------------------------------
    ./install.sh

Copie le jeu dans ~/.local/share/kinetik et ajoute KINETIK au menu des
applications, sans droits administrateur. Pour le retirer :

    ./install.sh --uninstall

Fenêtre vide au lancement ?
---------------------------
Le jeu désactive déjà le rendu DMA-BUF de WebKitGTK, cause la plus courante.
Si la fenêtre reste vide, essaie :

    WEBKIT_DISABLE_COMPOSITING_MODE=1 ./kinetik
