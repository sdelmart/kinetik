# KINETIK

> Protocole de tri industriel — un puzzle de poussée de conteneurs, avec éditeur de
> secteurs et de niveaux intégré.

Vous pilotez un drone de manutention dans une usine automatisée : poussez chaque
conteneur sur une plaque de charge. Le drone ne peut que **pousser**, jamais tirer.
**50 niveaux** répartis en cinq secteurs, chacun introduisant une nouvelle
mécanique, avec profils joueurs, indices débloquables et un Atelier pour créer,
tester, exporter et importer ses propres secteurs.

---

## Démarrage rapide

```bash
npm install
npm run dev
```

Puis ouvrez l'adresse affichée (par défaut <http://localhost:5173>).

**Prérequis :** Node.js 18 ou plus. Rien d'autre — aucune dépendance système,
aucun fichier image ni audio à installer.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement à chaud |
| `npm test` | Suite de tests (356 tests) |
| `npm run test:watch` | Tests en continu |
| `npm run calibrate` | Résout les 50 niveaux et affiche le nombre de coups optimal |
| `npm run calibrate -- --write` | Trie chaque secteur par difficulté et recalcule les références |
| `npm run build` | Build de production statique dans `dist/` |
| `npm run build:single` | Build en **un seul fichier HTML** dans `dist-single/` |
| `npm run icon` | Regénère l'icône de l'application |
| `npm run tauri build` | Exécutables natifs (voir plus bas) |
| `npm run package` | Rassemble les livrables prêts à distribuer dans `downloads/` |

---

## Distribution multiplateforme

Le jeu tourne sur **Windows, Linux et macOS** de trois manières :

1. **Fichier unique** — `npm run build:single` produit
   `dist-single/index.html`, un fichier autonome de ~85 Ko qu'il suffit de
   **double-cliquer**. Pas d'installation, pas de serveur, fonctionne hors ligne,
   identique sur les trois systèmes. C'est le moyen le plus simple de distribuer
   le jeu.
2. **Site statique** — `npm run build` produit un dossier `dist/` déposable sur
   n'importe quel hébergeur (GitHub Pages, Netlify…).
3. **Application native** — via [Tauri](https://tauri.app) :

   ```bash
   npm install -D @tauri-apps/cli@^2   # une seule fois
   npm run tauri build
   ```

   Produit un `.msi`/`.exe` (Windows), un `.dmg`/`.app` (macOS) et un
   `.AppImage`/`.deb` (Linux). Nécessite la chaîne d'outils Rust
   (<https://rustup.rs>) et, sous Linux, les paquets WebKitGTK.

### Builds automatiques pour les trois systèmes

Un installateur natif ne peut être compilé que **sur le système qu'il vise** :
un `.exe` se construit sous Windows, un `.dmg` sous macOS. Le workflow
[`.github/workflows/release.yml`](.github/workflows/release.yml) s'en charge —
il lance les tests, puis compile en parallèle sur quatre cibles
(macOS Apple Silicon, macOS Intel, Linux x64, Windows x64) et attache tous les
binaires à la release :

```bash
git tag v1.0.0 && git push --tags
```

Sans tag, `workflow_dispatch` permet de lancer le build à la main depuis
l'onglet Actions pour récupérer les artefacts.

---

## Architecture

Le moteur de jeu est entièrement séparé de l'affichage, de l'audio et de
l'interface : `src/core/` ne connaît ni le DOM ni le canvas, ce qui le rend
testable sans navigateur.

```
src/
├── core/        moteur pur : plateau, règles, niveaux, score, solveur
│   ├── constants.js   codes de terrain, directions
│   ├── level.js       format de niveau, validation, sérialisation
│   ├── state.js       état d'exécution (terrain, conteneurs, drone)
│   ├── rules.js       résolution des déplacements  ← cœur du jeu
│   ├── history.js     annuler / rétablir
│   ├── score.js       calcul du score et des étoiles
│   ├── solver.js      recherche en largeur (validation des niveaux)
│   ├── worlds.js      les 5 secteurs (données dans campaign.json)
│   └── hints.js       économie et déverrouillage des indices
├── state/       profils, réglages et sauvegarde (tolérants aux pannes)
├── render/      rendu canvas et sprites procéduraux
├── audio/       synthèse Web Audio (musique + effets)
├── i18n/        4 langues
└── ui/          écrans (menu, secteurs, niveaux, jeu, réglages, atelier)
```

### Choix techniques notables

**Une seule implémentation du déplacement.** Les règles sont exprimées une fois
sous forme vectorielle dans [`src/core/rules.js`](src/core/rules.js) : une même
fonction traite les quatre directions, les deux types d'entités et toutes les
surfaces. Dupliquer la logique par direction est la source classique de bugs
« ça marche vers la droite mais pas vers la gauche ».

**Aucun asset externe.** Tous les sprites sont dessinés au canvas
([`src/render/sprites.js`](src/render/sprites.js)) et toute la bande-son est
synthétisée à la volée par Web Audio ([`src/audio/`](src/audio/)). Conséquences :
le rendu reste net à toute résolution, le build pèse quelques dizaines de Ko, et
il n'y a **aucune question de licence** sur les images ou la musique.

**Un solveur qui garantit la campagne — et fait tourner les indices.**
`npm run calibrate` résout chaque niveau par recherche en largeur. Il prouve que
les 50 niveaux sont solvables, **ordonne chaque secteur du plus facile au plus
difficile** d'après la longueur de la solution optimale, et en déduit la
référence de coups. La difficulté croissante est donc mesurée, pas estimée à
l'œil, et un test la vérifie à chaque exécution de la suite. Le même solveur
alimente les indices en jeu. C'est lui qui a détecté deux vraies erreurs de
conception pendant le développement : une règle fautive sur les dalles fragiles,
puis un niveau où le drone détruisait lui-même le passage dont il avait besoin.

**Sauvegarde qui ne casse pas.** `localStorage` peut lever une exception
(navigation privée, quota, stockage désactivé). Tous les accès passent par
[`src/state/storage.js`](src/state/storage.js), qui bascule en mémoire plutôt
que de faire planter le jeu.

---

## Profils joueurs

Plusieurs personnes peuvent partager une installation : jusqu'à **6 profils**,
chacun avec sa propre progression, ses scores, ses réglages, ses secteurs
personnalisés et ses jetons d'indice. Tout est rangé sous un espace de noms
séparé (`kinetik:p:<id>:…`), donc rien ne se mélange ; supprimer un profil efface
uniquement ses données. Le profil actif est retenu d'une session à l'autre, et se
change depuis le menu ou les réglages.

---

## Indices

Un indice résout la position **réellement en cours** par recherche en largeur et
met en évidence la case où aller — il reste donc juste même quand le joueur s'est
éloigné de toute route prévue.

Il est volontairement encadré pour assister sans remplacer le puzzle :

- il coûte **1 jeton** ;
- il ne se débloque qu'une fois le niveau éprouvé : 5 coups au-delà de la
  référence, ou 90 secondes passées dessus ;
- on démarre avec 3 jetons, on en gagne 1 par niveau terminé du premier coup en
  3 étoiles, et 3 de plus à la fin d'un secteur ;
- si la position n'a plus de solution (un conteneur perdu dans un puits), il le
  dit au lieu de laisser chercher en vain.

---

## Personnalisation en jeu

Tout est dans **Réglages**, et persiste entre deux sessions :

- **Commandes** — les 8 actions sont remappables ; la touche est enregistrée par
  code physique, donc un clavier AZERTY garde la même disposition.
- **Audio** — 5 pistes musicales (*Pulse, Dérive, Forge, Vapeur, Broyeur*) plus
  *Silence*, volumes musique et effets séparés, coupure rapide du son.
- **Affichage** — langue (4), **couleur d'interface**, **fond animé** (5
  ambiances), **limite d'images par seconde** (30 / 60 / 120 / illimité) avec
  compteur FPS optionnel, **mode daltonien**, halo néon, lignes de balayage,
  grille du plateau.

La limite d'images s'applique au plateau **et** au fond animé : à 30 FPS sur un
portable, le jeu consomme nettement moins de batterie ; en « illimité » il suit
la fréquence de l'écran (144 Hz compris).

Les 5 fonds — *Grille, Nébuleuse, Circuit, Pluie de données, Vide* — sont
dessinés au canvas et se teintent de la couleur choisie. Les plus coûteux sont
rendus dans un tampon basse résolution, le fond fixe ne consomme aucune frame,
et `prefers-reduced-motion` désactive l'animation.

**Couleur d'interface** — 6 teintes prédéfinies ou n'importe quelle couleur via
le sélecteur natif, appliquée instantanément à tous les boutons, au logo et au
fond animé, en dehors des niveaux. À l'intérieur d'un secteur, la couleur du
secteur reste utilisée pour le plateau de jeu — les deux ne se mélangent pas,
c'est la couleur du secteur qui identifie où vous êtes.

**Quitter le jeu** — un bouton dédié apparaît dans le menu, mais uniquement
dans l'application native (le `.exe`/`.dmg`/`.AppImage`) : fermer un onglet de
navigateur par script est bloqué par la plupart des navigateurs, le bouton
n'y serait donc jamais qu'un bouton mort.

**Mode daltonien** — le vert et le rouge sont la paire de couleurs la plus
souvent confondue en cas de daltonisme, et le jeu s'en sert par défaut pour
« ouvert/livré/activé » contre « fermé/en attente » (sas, interrupteur,
conteneur livré). En mode daltonien, ces états basculent vers le bleu — jamais
confondu avec le rouge ni l'ambre, quel que soit le type de daltonisme — et un
conteneur livré affiche en plus une coche, pour ne jamais dépendre de la seule
couleur.

**Contre-la-montre** — dès qu'un niveau a déjà été terminé une fois, l'écran de
jeu affiche en direct l'écart avec votre meilleur temps sur ce niveau
(`⏱ vs record`), qui passe en ambre dès que vous êtes plus lent que votre
record. Statistiques indique aussi le niveau le plus rapide, calculé par
rapport à la référence de coups (un temps brut n'est pas comparable entre un
petit et un grand niveau, mais le temps par coup de référence l'est).

**Manette** — branchez n'importe quel contrôleur standard : croix directionnelle
ou stick gauche pour se déplacer, gâchette gauche/droite pour annuler/rétablir,
bouton secondaire (B/Cercle) pour recommencer, Start pour revenir en arrière.
Fonctionne dès qu'un niveau est ouvert, sans réglage préalable.

---

## Sauvegarde

Persistée automatiquement dans le stockage local du navigateur (ou de
l'application native), **séparément pour chaque profil** :

- progression et déverrouillage des secteurs ;
- jetons d'indice ;
- par niveau : meilleur score, meilleures étoiles, moins de coups, meilleur temps ;
- totaux cumulés (déplacements, poussées, temps, score) affichés au menu ;
- tous les réglages ;
- les secteurs créés dans l'Atelier.

Le bouton **Effacer la sauvegarde** dans les réglages remet tout à zéro après
confirmation. Les secteurs personnalisés s'exportent en `.json` pour être
partagés ou sauvegardés à part.

---

## Défi du jour

Un niveau différent chaque jour, **le même pour tout le monde** : il est choisi
sans serveur ni aléa, par un simple calcul déterministe sur la date (numéro du
jour modulo la taille d'un pool de 30 niveaux dédiés, distincts de la
campagne — voir [`src/core/daily.js`](src/core/daily.js) et
[`daily.json`](src/core/daily.json)). Rejouer un jour donné retombe toujours
sur le même niveau.

Le fait de coder la date dans l'identifiant du niveau (`daily-2026-03-08`)
suffit à obtenir un historique par jour en réutilisant tel quel le système de
sauvegarde par niveau — aucune structure de données séparée. Une **série**
(streak 🔥) se calcule à la volée à partir de cet historique : elle continue
tant qu'aucun jour entier n'est manqué, et ne se réinitialise pas juste parce
que le défi du jour n'a pas encore été joué aujourd'hui.

---

## Succès

18 succès à débloquer, visibles dans **Succès** (verrouillés en gris) :
premiers pas, secteur par secteur, campagne complète, paliers d'étoiles
cumulées, niveaux terminés sans indice, séries quotidiennes (3, 7, 30 jours),
création d'un niveau dans l'Atelier, score cumulé. Chacun est une simple
fonction pure évaluée sur l'état de sauvegarde
([`src/core/achievements.js`](src/core/achievements.js)) — rejouable et
testée, sans dépendre du moment ni de la façon dont la condition a été remplie.

---

## Statistiques

Un tableau de bord (**Statistiques**) agrège ce qui est déjà suivi ailleurs :
score et temps de jeu cumulés, progression par secteur, série quotidienne en
cours et record, niveau le plus rejoué, niveau le plus difficile (le moins
bien étoilé), et nombre de succès débloqués.

---

## Tests

```bash
npm test
```

356 tests couvrant :

- **`rules.test.js`** — déplacements, poussées, symétrie des quatre directions,
  puits, dalles fragiles, glace, tapis roulants, téléporteurs, sas, et
  non-mutation de l'état.
- **`level.test.js`** — les 12 règles de validation d'un niveau et les
  conversions de format.
- **`score.test.js`** — formule de score et attribution des étoiles.
- **`campaign.test.js`** — chaque niveau livré est valide, solvable, n'est pas
  déjà résolu au départ, son `par` est atteignable, et **chaque secteur est
  bien ordonné du plus facile au plus difficile**.
- **`daily.test.js`** — sélection déterministe du niveau du jour, intégrité et
  solvabilité des 30 niveaux du pool, et calcul des séries (continuité,
  rupture après un jour manqué, série la plus longue).
- **`achievements.test.js`** — chaque succès se déclenche à son seuil exact,
  jamais avant, jamais deux fois, et les identifiants inconnus issus d'une
  sauvegarde corrompue sont ignorés sans planter.
- **`hints.test.js`** — conditions de déverrouillage, justesse du coup suggéré
  après que le joueur se soit égaré, détection des positions sans issue, et
  impossibilité de farmer des jetons en rejouant un niveau.
- **`pacing.test.js`** — la limite d'images ne saute pas de frame à tort et ne
  divise pas par deux un écran 60 Hz.
- **`i18n.test.js`** — les 4 langues ont exactement le même jeu de clés, sans
  chaîne vide, et tous les codes d'erreur, pistes musicales, fonds et succès
  sont traduits partout.

---

## Mécaniques

| Élément | Comportement |
|---|---|
| **Cloison** | Bloque tout. |
| **Plaque de charge** | Objectif : le niveau est gagné quand toutes sont couvertes. |
| **Puits** | Un conteneur poussé dedans le comble et crée un passage. Le drone ne peut pas y entrer. |
| **Dalle fragile** | Cède dès qu'elle est laissée vide, et devient infranchissable. |
| **Dalle glissante** | Tout ce qui y arrive continue dans son élan jusqu'au prochain obstacle. |
| **Tapis roulant** | Emporte d'une case ce qui s'y trouve, puis réévalue. |
| **Téléporteur** | Paire A/B : entrer sur l'un ressort sur l'autre, s'il est libre. |
| **Interrupteur / Sas** | Le sas est ouvert tant qu'un poids (drone ou conteneur) est sur un interrupteur. |

Les secteurs les introduisent progressivement : Assemblage (bases), Fonderie
(puits et dalles fragiles), Cryogénie (glace), Réacteur (tapis roulants),
Noyau (téléporteurs et sas).

---

## Format de niveau

Un niveau est constitué de deux couches alignées de caractères — le terrain et
ce qui s'y trouve — ce qui reste lisible à l'œil nu et facile à valider :

```json
{
  "format": 1,
  "id": "assembly-1",
  "name": "",
  "par": 6,
  "terrain":  ["##########", "#........#", "#....*...#", "##########"],
  "entities": ["..........", "..........", "..@$......", ".........."]
}
```

Terrain : `#` cloison · `.` sol · `*` plaque · `o` puits · `~` dalle fragile ·
`_` dalle glissante · `^ > v <` tapis · `a`/`b` téléporteurs · `s` interrupteur ·
`g` sas. Entités : `@` drone · `$` conteneur.

Les secteurs créés dans l'Atelier s'exportent et s'importent dans ce format.
Un fichier importé n'est chargé que si **tous** ses niveaux passent la
validation.

### Partager un niveau par code

En plus de l'export JSON (un secteur entier, en fichier), l'Atelier propose
**Copier le code** / **Coller un code** pour partager **un seul niveau** sous
forme de texte court, collable dans un message :

```
K1.c.9.7.AAAAAAAAAAAA...
```

Chaque case du plateau tient sur **un seul caractère** : les 16 types de
terrain et les 3 entités possibles (rien / drone / conteneur) se combinent en
un indice de 0 à 47, qui pointe directement dans un alphabet de 64 symboles
(`A`-`Z`, `a`-`z`, `0`-`9`, `-`, `_`) — sans caractère à échapper dans une URL
ou un message. Un niveau de taille courante tient dans une grosse centaine de
caractères. Voir [`src/core/levelCode.js`](src/core/levelCode.js).

Un code collé est décodé, revalidé avec les mêmes règles qu'un import JSON, et
rejeté proprement (message d'erreur, aucune modification du niveau en cours)
s'il est corrompu ou illégal — jamais un niveau à moitié importé.

---

## Score

```
score = 1000 − 8 par coup au-dessus de la référence − 2 par seconde (plafonné à 400)
```

avec un plancher à 100 points. Trois étoiles si la référence est tenue, deux
jusqu'à 35 % au-dessus, une ensuite. La formule est volontairement fixe,
documentée et testée, pour que deux parties identiques donnent le même score.

---

## Raccourcis

| Touche | Action |
|---|---|
| Flèches / WASD | Déplacer le drone |
| `Z` | Annuler |
| `Y` | Rétablir |
| `R` | Recommencer le niveau |
| `Échap` | Retour |

Toutes les touches sont remappables dans les Réglages. Sur écran tactile, un
balayage dans une direction déplace le drone.
