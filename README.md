<div align="center">

# KINETIK

**Protocole de tri industriel** : un jeu de puzzle de poussée de conteneurs, doublé
d'un labyrinthe médiéval à énigmes.

[![Dernière version](https://img.shields.io/github/v/release/sdelmart/kinetik?label=version&color=00e5ff)](https://github.com/sdelmart/kinetik/releases/latest)
![Plateformes](https://img.shields.io/badge/plateformes-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-8b5cf6)
![Tests](https://img.shields.io/badge/tests-571%20r%C3%A9ussis-54e08a)
![Langues](https://img.shields.io/badge/langues-FR%20%C2%B7%20EN%20%C2%B7%20DE%20%C2%B7%20ES-ffb300)

![Écran d'accueil de KINETIK](docs/screenshots/home.png)

**[⬇ Télécharger le jeu](https://github.com/sdelmart/kinetik/releases/latest)**

</div>

---

Vous pilotez un drone de manutention dans une usine automatisée : poussez chaque
conteneur sur une plaque de charge. Le drone ne peut que **pousser**, jamais tirer.
**80 niveaux** en huit secteurs, chacun avec sa propre mécanique, un **Labyrinthe**
médiéval où chaque porte cache une énigme, un **Défi du jour**, un **Atelier** pour
créer ses niveaux, et des **classements en ligne** entre amis.

Tout est dessiné et composé dans le code : **aucune image, aucun fichier audio**.

## Sommaire

- [Captures d'écran](#captures-décran)
- [Télécharger et installer](#télécharger-et-installer)
- [Le jeu](#le-jeu)
- [Commandes](#commandes)
- [Développement](#développement)
- [Architecture](#architecture)
- [Choix techniques](#choix-techniques)
- [Tests](#tests)
- [Formats de niveau](#formats-de-niveau)
- [Origine du projet](#origine-du-projet)

---

## Captures d'écran

| | |
|---|---|
| ![Un niveau du secteur Noyau](docs/screenshots/sokoban.png) | ![Le choix des secteurs](docs/screenshots/sectors.png) |
| **Sokoban** : un niveau du Noyau (tapis roulants, glace, téléporteurs, sas) | **Secteurs** : huit secteurs à débloquer, plus les secteurs créés et partagés |
| ![Le Labyrinthe des Archives](docs/screenshots/labyrinth-map.png) | ![Le Labyrinthe dans le brouillard](docs/screenshots/labyrinth-fog.png) |
| **Labyrinthe** : chaque grille rouge est une porte verrouillée par une énigme | **Brouillard** : dans les derniers chapitres, seule la torche éclaire |
| ![L'Atelier, éditeur de niveaux](docs/screenshots/editor.png) | ![Le classement général](docs/screenshots/ranking.png) |
| **Atelier** : éditeur de niveaux et de secteurs, avec validation en direct | **Classement** : tous les joueurs du serveur, même à 0 point |
| ![L'écran-titre](docs/screenshots/intro.png) | ![La transition 3D d'entrée](docs/screenshots/transition.png) |
| **Écran-titre** : une faille de lumière dans l'écran… | **…qui se brise en éclats 3D** pour plonger dans le jeu |

---

## Télécharger et installer

Les installeurs de chaque version sont sur la
**[page des versions](https://github.com/sdelmart/kinetik/releases/latest)** :

| Système | Fichier |
|---|---|
| macOS, puces Apple (M1, M2, M3, M4) | `KINETIK-x.y.z-macOS-AppleSilicon.dmg` |
| macOS, processeur Intel | `KINETIK-x.y.z-macOS-Intel.dmg` |
| Windows | `KINETIK-x.y.z-Windows-Setup.exe` |
| Linux, toutes distributions | `KINETIK-x.y.z-Linux-x86_64.tar.gz` (exécutable direct) |
| Linux, fichier unique | `KINETIK-x.y.z-Linux-x86_64.AppImage` |
| Ubuntu, Debian, Mint, Pop!_OS | `KINETIK-x.y.z-Linux-x86_64.deb` |

**macOS** : l'application n'est pas signée par Apple. Si macOS indique qu'elle est
« endommagée », glissez-la dans Applications puis lancez dans le Terminal :

```bash
xattr -cr /Applications/KINETIK.app
```

**Linux (.tar.gz)** :

```bash
tar xzf KINETIK-*-Linux-x86_64.tar.gz
cd KINETIK-*-Linux-x86_64
./kinetik          # lancer le jeu
./install.sh       # optionnel : l'ajouter au menu des applications (sans droits root)
```

Le jeu a besoin de WebKitGTK 4.1, présent sur la plupart des bureaux. Le
[README inclus](packaging/linux/README.txt) donne la commande d'installation pour
chaque distribution.

---

## Le jeu

### Sokoban : 80 niveaux en 8 secteurs

Chaque secteur introduit une mécanique et garde celles d'avant. Dans chaque secteur,
les niveaux vont du plus facile au plus difficile, selon une difficulté **mesurée**
(voir [Choix techniques](#choix-techniques)).

| Secteur | Ce qu'il ajoute |
|---|---|
| **Assemblage** | Les bases : pousser, sans jamais se bloquer |
| **Fonderie** | Puits à combler, dalles fragiles qui s'effondrent |
| **Cryogénie** | Glace : tout ce qui y entre glisse jusqu'au prochain obstacle |
| **Réacteur** | Tapis roulants |
| **Noyau** | Téléporteurs, interrupteurs et sas |
| **Aiguillage** | Passages à sens unique |
| **Coffre** | Serrures : un conteneur posé dans la serrure ouvre les portes à clé, pour de bon |
| **Symétrie** | Conteneurs jumeaux, qui bougent en miroir l'un de l'autre |

Le Labyrinthe se débloque une fois les **quatre premiers secteurs** terminés.

### Mécaniques

| Élément | Comportement |
|---|---|
| **Cloison** | Bloque tout. |
| **Plaque de charge** | Objectif : le niveau est gagné quand toutes sont couvertes. |
| **Puits** | Un conteneur poussé dedans le comble et crée un passage. Le drone ne peut pas y entrer. |
| **Dalle fragile** | Cède dès qu'elle est laissée vide, et devient infranchissable. |
| **Glace** | Tout ce qui y arrive continue dans son élan jusqu'au prochain obstacle. |
| **Tapis roulant** | Emporte d'une case ce qui s'y trouve. |
| **Téléporteur** | Paire A/B : entrer sur l'un fait ressortir sur l'autre, s'il est libre. |
| **Interrupteur / Sas** | Le sas est ouvert tant qu'un poids (drone ou conteneur) est sur un interrupteur. |
| **Sens unique** | Ne se franchit que dans le sens de la flèche. |
| **Serrure / Porte à clé** | Un conteneur posé dans la serrure y reste et ouvre définitivement les portes à clé. |
| **Conteneurs jumeaux** | Pousser l'un déplace l'autre dans la direction opposée. |

### Indices

Un indice coûte un jeton et indique le prochain coup d'une **solution optimale**,
depuis la position où l'on se trouve réellement :

- sur la route optimale, l'indice est instantané ;
- si l'on s'en est écarté, le jeu cherche le plus court chemin pour la rejoindre ;
- si la position n'a plus de solution (un conteneur coincé), il le dit et propose
  d'annuler ou de recommencer.

Les indices se débloquent après avoir dépassé la référence de 5 coups ou passé
90 secondes sur un niveau. On démarre avec 3 jetons, on en gagne 1 par niveau
réussi du premier coup en 3 étoiles, et 3 à la fin d'un secteur.

### Le Labyrinthe

Un mode médiéval à part entière : **7 chapitres** et un **mode sans fin**.

- Labyrinthes générés procéduralement, de plus en plus grands et ramifiés, avec la
  sortie toujours placée au point le plus éloigné de l'entrée.
- **Brouillard de guerre** à partir du 3ᵉ chapitre : seule la torche éclaire autour
  du joueur, les zones visitées restent en mémoire.
- **Portes à énigmes** : environ 220 questions écrites (histoire, sciences,
  géographie, arts, logique) et des énigmes **générées à l'infini** (suites
  logiques, calcul mental, heures, jours de la semaine, chiffres romains,
  conversions, problèmes d'âge). Les questions déjà posées sont évitées.
- Une mauvaise réponse **change l'énigme** et coûte 5 pas : impossible d'essayer
  les réponses une par une.
- Un indice par question, avec un nombre d'indices limité par chapitre.
- **Passages secrets** : certains murs cèdent à qui résout leur énigme.
- Niveau de culture générale réglable (automatique, facile, moyen, difficile).

### Défi du jour

Un niveau différent chaque jour, **le même pour tout le monde**, choisi par un calcul
sur la date, sans serveur. Les 30 niveaux du défi utilisent à tour de rôle les
mécaniques des différents secteurs. Une **série** (🔥) compte les jours consécutifs
réussis.

### Atelier

Un éditeur complet : créer des secteurs et des niveaux, les tester, les **exporter /
importer** en JSON, partager un niveau sous forme de **code texte** à coller dans un
message, ou le **publier sur le serveur** pour les autres joueurs. Chaque niveau est
validé en direct (un drone, assez de conteneurs, téléporteurs appairés, etc.).

### En ligne, entre amis

Avec un serveur communautaire auto-hébergé ([`server/`](server/)) :

- **Secteurs partagés** : ce que chacun publie depuis l'Atelier apparaît chez tous.
- **Classements** par niveau, par secteur et général. Chaque joueur y figure, même
  avant d'avoir joué.
- **Progression synchronisée** entre plusieurs appareils.
- **Rattrapage hors ligne** : un score fait sans connexion est envoyé à la suivante.
- **Signalement** d'un secteur problématique.

Chaque joueur a une clé personnelle qui porte son nom : impossible de jouer sous le
nom d'un autre. L'installation du serveur est détaillée dans
[`server/README.md`](server/README.md).

### Et aussi

- **Profils** : jusqu'à 6 joueurs par installation, chacun avec sa progression,
  ses réglages et ses secteurs.
- **23 succès**, un écran de **statistiques**, un contre-la-montre contre son
  meilleur temps.
- **Musique procédurale** : 5 morceaux composés en code, avec progression
  d'accords et structure (intro, rythmique, mélodie, pont, climax), plus un mode
  aléatoire qui les enchaîne. Effets sonores synthétisés.
- **Personnalisation** : touches réassignables, couleur d'interface, 5 fonds animés,
  limite d'images par seconde, mode daltonien, halo néon, lignes de balayage.
- **Manette** et **écran tactile** (balayage) pris en charge.

### Score

```
score = 1000 − 8 par coup au-dessus de la référence − 2 par seconde (plafonné à 400)
```

avec un plancher à 100 points. Trois étoiles si la référence est tenue, deux jusqu'à
35 % au-dessus, une ensuite.

---

## Commandes

| Touche | Action |
|---|---|
| Flèches / WASD | Déplacer |
| `Z` | Annuler |
| `Y` | Rétablir |
| `R` | Recommencer le niveau |
| `Échap` | Retour |

Toutes les touches sont réassignables dans les Réglages.

---

## Développement

**Prérequis** : Node.js 18 ou plus. Pour les applications de bureau, en plus :
[Rust](https://rustup.rs) et, sous Linux, les paquets WebKitGTK.

```bash
npm install
npm run dev
```

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm test` | Suite de tests (571 tests) |
| `npm run build` | Build web statique dans `dist/` |
| `npm run build:single` | Le jeu entier en **un seul fichier HTML** (`dist-single/index.html`), jouable hors ligne |
| `npm run tauri build` | Application de bureau et installeurs natifs |
| `npm run calibrate` | Rejoue la solution enregistrée de chaque niveau de la campagne |
| `npm run calibrate:daily` | Même vérification pour le Défi du jour |
| `npm run generate` | Génère des niveaux (voir ci-dessous) |
| `npm run icon` | Regénère l'icône de l'application |

### Publier une version

Un installeur natif ne se compile que sur le système qu'il vise. Le workflow
[`release.yml`](.github/workflows/release.yml) s'en charge : à chaque tag `v*`, il
lance les tests, compile sur quatre machines (macOS Apple Silicon, macOS Intel,
Linux x64, Windows x64) et publie les six installeurs sous des noms clairs.

```bash
git tag v1.7.0 && git push origin v1.7.0
```

### Générateur de niveaux

```bash
npm run generate -- --write                 # régénère toute la campagne
npm run generate -- --daily=34 --write      # régénère le Défi du jour
npm run generate -- --only=vault --count=5 --seed=42 --write   # complète un secteur
```

La génération est longue (une vingtaine de minutes pour la campagne, sur plusieurs
cœurs). Chaque niveau trouvé est enregistré aussitôt : une génération interrompue
reprend là où elle s'est arrêtée.

---

## Architecture

Le moteur de jeu est entièrement séparé de l'affichage, de l'audio et de
l'interface : `src/core/` ne connaît ni le DOM ni le canvas, ce qui le rend testable
sans navigateur.

```
src/
├── core/        moteur Sokoban pur : règles, niveaux, score, solveur, indices
│   ├── rules.js         résolution des déplacements (cœur du jeu)
│   ├── solver.js        recherche en largeur
│   ├── hints.js         indices (route optimale et retour sur la route)
│   ├── campaign.json    les 80 niveaux et leurs solutions
│   └── daily.json       les 30 niveaux du Défi du jour
├── labyrinth/   mode Labyrinthe : génération, énigmes, rendu
├── state/       profils, réglages, sauvegarde, synchro et clients du serveur
├── render/      rendu canvas et sprites procéduraux
├── audio/       musique et effets synthétisés (Web Audio)
├── i18n/        4 langues
└── ui/          écrans et transition d'entrée
server/          serveur communautaire (Node.js / Express)
src-tauri/       application de bureau (Tauri v2, Rust)
scripts/         générateur de niveaux, vérifications, icône, empaquetage
packaging/       contenu de l'archive Linux portable
tests/           571 tests (Vitest)
```

---

## Choix techniques

**Une seule implémentation du déplacement.** Toutes les règles passent par une même
fonction « vectorielle » dans [`src/core/rules.js`](src/core/rules.js) : les quatre
directions, les deux types d'entités et toutes les surfaces. Dupliquer la logique
par direction est la source classique des bugs « ça marche vers la droite mais pas
vers la gauche ».

**Un générateur de niveaux qui mesure la difficulté.** Les 80 niveaux et les 30 défis
sont produits par [`scripts/generate-campaign.js`](scripts/generate-campaign.js). Il
part d'une salle aléatoire et la fait évoluer par petites retouches (recuit simulé),
en ne gardant que les versions plus difficiles. Chaque version est **résolue de façon
optimale avec le vrai moteur du jeu**, et sa difficulté est mesurée par le nombre de
poussées, les changements de conteneur et la taille de l'espace de recherche. Un
niveau n'est retenu que si sa solution **utilise réellement** la mécanique de son
secteur. Par rapport à la première version, faite à la main, un niveau demande en
moyenne 4 fois plus de coups, 3 fois plus de poussées et 5,5 fois plus de
changements de conteneur.

**Des solutions embarquées.** Chaque niveau contient sa solution optimale. Les tests
la rejouent (vérifier les 110 niveaux prend quelques millisecondes), et les indices
s'en servent pour être instantanés.

**Aucun asset externe.** Les sprites sont dessinés au canvas
([`src/render/sprites.js`](src/render/sprites.js)) et toute la bande-son est
synthétisée à la volée ([`src/audio/`](src/audio/)) : rendu net à toute résolution,
installeurs d'environ 1 Mo, et aucune question de droits.

**Une musique générative.** Les mélodies sont recalées sur l'accord en cours pour
rester consonantes, les morceaux suivent une structure, et un limiteur en sortie
empêche toute saturation.

**Une transition 3D sans bibliothèque.** L'écran-titre se brise en éclats qui volent
vers la caméra, puis plonge dans un tunnel : une projection en perspective calculée
à la main sur un canvas 2D ([`src/ui/introTransition.js`](src/ui/introTransition.js)).

**Une sauvegarde qui ne casse pas.** `localStorage` peut lever une exception
(navigation privée, quota). Tous les accès passent par
[`src/state/storage.js`](src/state/storage.js), qui bascule en mémoire plutôt que de
faire planter le jeu.

**Un serveur simple et sûr.** Stockage en fichiers JSON plutôt qu'une base de
données (adapté à un petit groupe), clés nominatives, saisons pour remettre les
classements à zéro, synchronisation par fusion champ par champ (on garde toujours le
meilleur des deux appareils), limitation de débit, et des clés qui ne passent
jamais dans une adresse.

---

## Tests

```bash
npm test
```

571 tests, dont :

- **règles** : chaque mécanique, la symétrie des quatre directions, la non-mutation de l'état ;
- **campagne et Défi du jour** : chaque niveau est valide, résolu par sa solution
  enregistrée, demande au moins 8 poussées, et chaque secteur est bien ordonné ;
- **indices** : suivre les indices depuis un détour résout le niveau, sur chaque secteur ;
- **Labyrinthe** : génération, sortie au point le plus éloigné, brouillard,
  pénalités, énigmes générées (forme et justesse des réponses) ;
- **serveur** : fusion de la progression, lecture des clés nominatives ;
- **traductions** : les 4 langues ont exactement les mêmes clés, sans texte vide ;
- **musique** : structure des morceaux, mélodies toujours dans l'accord.

---

## Formats de niveau

Un niveau est fait de deux couches alignées de caractères, le terrain et ce qui s'y
trouve, lisibles à l'œil nu :

```json
{
  "format": 1,
  "id": "assembly-v2-1",
  "par": 52,
  "terrain":  ["########", "#.*....#", "#......#", "########"],
  "entities": ["........", "....$...", "..@.....", "........"]
}
```

**Terrain** : `#` cloison · `.` sol · `*` plaque · `o` puits · `~` dalle fragile ·
`_` glace · `^ > v <` tapis · `a`/`b` téléporteurs · `s` interrupteur · `g` sas ·
`U R D L` sens uniques · `k` serrure · `q` porte à clé.
**Entités** : `@` drone · `$` conteneur · `1`/`2` conteneurs jumeaux.

Un niveau seul se partage aussi sous forme de **code texte** (préfixe `K2`), avec
deux caractères par case, sans rien à échapper dans un message ou une URL
([`src/core/levelCode.js`](src/core/levelCode.js)). Un fichier ou un code importé
n'est chargé que si tous ses niveaux passent la validation.

---

## Origine du projet

KINETIK est né d'un projet de Sokoban réalisé en équipe en terminale NSI pour les
Trophées NSI 2024, avec Mathieu, Simon et Martin, en Python/Tkinter. Il en est une
réécriture complète, multiplateforme et bien plus ambitieuse. Il s'inspire aussi de
quelques idées de [Sisyphe.io](https://github.com/acciaw/sisyphe.io), un autre projet
des Trophées NSI 2024, par Killian Milani, Siméon Gillet, Kylian Rousseau et Arthur
Barberousse.
