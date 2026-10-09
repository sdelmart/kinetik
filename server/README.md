# Serveur communautaire KINETIK

Un petit serveur (Node/Express) qui héberge une bibliothèque partagée de
secteurs custom KINETIK : n'importe qui pointé dessus peut publier un secteur
depuis l'Atelier et le voir apparaître chez tout le monde, dans l'écran
Secteurs. Pas de compte, pas de base de données — juste un fichier JSON et un
jeton par personne.

## Déploiement sur ton serveur Ubuntu

### 1. Copier le dossier `server/` sur le serveur

```bash
# depuis ta machine, en remplaçant user@ton-serveur
rsync -av --exclude node_modules --exclude data --exclude backups server/ user@ton-serveur:~/kinetik-server/
```

### 2. Installer Node.js (si pas déjà fait) et les dépendances

```bash
# sur le serveur Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

cd ~/kinetik-server
npm install --omit=dev
```

### 3. Configurer

```bash
cp .env.example .env
nano .env
```

Renseigne au minimum `PUBLISH_TOKENS` : un couple `Nom:clé` par joueur,
séparés par des virgules, par exemple `Scotty:7f2k9q1x8a1z,Anaïs:m3p0v6t2r9wd`.

- Le **nom** est celui qui apparaît dans tous les classements, quel que soit
  le nom tapé dans le jeu : personne ne peut jouer sous le nom d'un autre.
- **Tous les joueurs listés apparaissent dans le classement**, même à 0 point
  et avant d'avoir joué.
- Chacun colle **uniquement sa propre clé** dans KINETIK (Réglages → Serveur
  communautaire), et le bouton « Tester la connexion » affiche sous quel nom
  il est reconnu.

Une clé seule sans `Nom:` reste acceptée : le nom est alors la partie avant
le premier tiret (`scotty-7f2k9` → `Scotty`).

### 4. Lancer en service (systemd)

```bash
sudo tee /etc/systemd/system/kinetik-server.service > /dev/null <<'EOF'
[Unit]
Description=KINETIK community server
After=network.target

[Service]
Type=simple
User=TON_UTILISATEUR
WorkingDirectory=/home/TON_UTILISATEUR/kinetik-server
ExecStart=/usr/bin/node index.js
Restart=on-failure
EnvironmentFile=/home/TON_UTILISATEUR/kinetik-server/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now kinetik-server
sudo systemctl status kinetik-server
```

Remplace `TON_UTILISATEUR` par ton nom d'utilisateur Unix sur le serveur.

### 5. Sauvegardes et surveillance

Tout l'état qui compte (secteurs publiés, classement, profils, signalements)
vit dans `data/`, un simple dossier de fichiers JSON — rien de tout ça n'est
reproductible si le disque lâche. `scripts/backup.sh` archive ce dossier en
`.tar.gz` horodatés et ne garde que les 14 derniers (réglable avec `KEEP=`).

```bash
# ajoute à `crontab -e` sur le serveur : sauvegarde chaque nuit à 3h
0 3 * * * /home/TON_UTILISATEUR/kinetik-server/scripts/backup.sh >> /home/TON_UTILISATEUR/kinetik-server/backup.log 2>&1
```

Pense à copier `backups/` ailleurs que sur la même machine de temps en temps
(rsync vers un autre disque, un NAS, etc.) — une sauvegarde qui ne quitte
jamais le serveur qu'elle sauvegarde ne protège pas contre une panne disque.

`scripts/healthcheck.sh` ping `/api/health` et journalise le résultat dans
`healthcheck.log` ; avec `SYSLOG=1` il pousse aussi les échecs dans le journal
système (repris par la plupart des configurations de `cron` qui envoient un
mail sur erreur) :

```bash
# toutes les 5 minutes
*/5 * * * * SYSLOG=1 /home/TON_UTILISATEUR/kinetik-server/scripts/healthcheck.sh
```

### 6. Exposer en HTTPS (accès depuis l'extérieur)

Comme ce sera accessible depuis internet, il faut du HTTPS devant — le plus
simple est [Caddy](https://caddyserver.com/), qui obtient et renouvelle le
certificat tout seul dès qu'il a un nom de domaine qui pointe vers chez toi :

```bash
sudo apt install -y caddy   # voir caddyserver.com/docs/install pour Ubuntu
```

```caddyfile
# /etc/caddy/Caddyfile
kinetik-api.ton-domaine.fr {
    reverse_proxy localhost:8787
}
```

```bash
sudo systemctl reload caddy
```

Il te faut un nom de domaine (ou sous-domaine) qui pointe vers l'IP publique
de ta maison, et le port 443 (+ 80 pour la validation du certificat) ouvert
sur ta box/routeur vers le serveur Ubuntu.

Une fois ça fait, mets `https://kinetik-api.ton-domaine.fr` comme adresse de
serveur dans KINETIK (Réglages → Serveur communautaire), pour toi et pour
chaque personne du groupe. L'adresse doit être en `https://` : l'app desktop
refuse les connexions en `http://`.

`ALLOWED_ORIGINS` concerne aussi l'app desktop, qui se présente au serveur avec
l'origine `tauri://localhost`. Laisse `*`, ou si tu restreins, garde
`tauri://localhost` dans la liste (plus `http://tauri.localhost` pour Windows),
sinon l'app desktop sera refusée.

### Dépannage : « tlsv1 alert internal error »

Si le navigateur ne charge même pas `https://kinetik-api.ton-domaine.fr/api/health`
et que `curl` affiche cette erreur, Caddy n'a pas de certificat à présenter pour
ce nom. Sur un Caddy qui a aussi une règle `*.ton-domaine` en `on_demand` avec
un `ask`, mets le bloc KINETIK dans le même mode et assure-toi que le service
`ask` l'autorise :

```caddyfile
kinetik-api.ton-domaine.fr {
    tls {
        on_demand
    }
    reverse_proxy localhost:8787
}
```

Teste l'autorisation avec `curl -i "http://127.0.0.1:9191/ask?domain=kinetik-api.ton-domaine.fr"`
(adapte l'adresse à ton `ask`) : il faut un `200`.

### Saisons (remise à zéro des classements)

Les scores et la progression synchronisée sont rangés par **saison**
(`data/scores-s2.json`, `data/profiles-s2.json`). Quand la campagne du jeu
change, on passe à la saison suivante (constante `SEASON` dans `index.js` et
dans `src/state/season.js` côté jeu) : tout le monde repart de zéro, les
anciens fichiers restent sur le disque comme sauvegarde, et une version trop
ancienne de l'app est refusée pour ne pas réinjecter d'anciens scores.
Les secteurs publiés et les signalements ne sont pas concernés.

## Sécurité — ce que ce serveur fait et ne fait pas

- **La lecture est publique** : quiconque connaît l'adresse peut lister et
  télécharger les secteurs publiés. C'est voulu (navigation sans friction),
  mais ça veut dire qu'il ne faut rien publier qu'on ne veuille pas voir
  public.
- **La publication est protégée par jeton**, et ce jeton est aussi la seule
  preuve de propriété pour modifier/supprimer un secteur plus tard — il n'y a
  pas de compte avec mot de passe. Traite un jeton comme un mot de passe :
  s'il fuite, n'importe qui peut publier en se faisant passer pour toi.
- **Chaque secteur est validé côté serveur** (mêmes règles que dans le jeu :
  un seul drone, assez de conteneurs, téléporteurs/interrupteurs bien
  appairés, etc.) avant d'être accepté.
- **Débit limité** : 30 publications / 15 min et 120 lectures / min par IP,
  pour qu'un serveur exposé sur internet ne puisse pas être spammé.
- **Chaque score et chaque progression sont rattachés au joueur de la clé**
  utilisée : impossible de poster sous le nom de quelqu'un d'autre. Les
  valeurs elles-mêmes (coups, temps) restent déclarées par l'app : principe
  de l'honneur au sein du groupe.
- **Les clés ne passent jamais dans une adresse** (où les logs de Caddy les
  enregistreraient) : elles voyagent dans le corps des requêtes ou dans un
  en-tête.

## API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | Vérifie que le serveur répond |
| GET | `/api/levels` | Liste les secteurs publiés (résumé) |
| GET | `/api/levels/:id` | Récupère un secteur complet |
| POST | `/api/levels` | Publie un secteur (`{ token, author, name, world }`) |
| PUT | `/api/levels/:id` | Met à jour un secteur (même jeton que la publication) |
| DELETE | `/api/levels/:id` | Supprime un secteur (même jeton que la publication) |
| POST | `/api/scores` | Soumet un score (`{ token, season, worldId, levelId, worldName, moves, pushes, seconds, score, stars }`), classé sous le joueur de la clé, seulement s'il améliore son meilleur score sur ce niveau |
| GET | `/api/scores/:worldId/:levelId` | Classement d'un niveau, trié par score décroissant |
| GET | `/api/scores/:worldId` | Classement agrégé d'un secteur (score total, niveaux terminés par joueur) |
| POST | `/api/profile/sync` | Synchronise la progression du joueur de la clé (`{ token, season, save, achievements, hintTokens, labyrinth }`) ; fusionne avec ce qui est déjà stocké (le meilleur des deux côtés champ par champ) et renvoie l'état fusionné — à utiliser aussi bien pour envoyer que pour récupérer la progression |
| POST | `/api/levels/:id/report` | Signale un secteur comme problématique (`{ reason }`, optionnel) — aucun jeton requis, ouvert à qui navigue le serveur, limité à 10 requêtes/heure/IP |
| GET | `/api/reports` | Liste les signalements reçus (clé dans l'en-tête `X-Kinetik-Token`) |
| POST | `/api/whoami` | Nom du joueur auquel appartient une clé (`{ token }`) |
| GET | `/api/players` | Classement général : tous les joueurs déclarés, même à 0 |
| POST | `/api/scores/bulk` | Rattrapage de scores en lot (`{ token, season, scores }`) |
