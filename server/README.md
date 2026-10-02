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
rsync -av --exclude node_modules --exclude data server/ user@ton-serveur:~/kinetik-server/
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

Renseigne au minimum `PUBLISH_TOKENS` — un jeton par personne autorisée à
publier, séparés par des virgules (ex. `scott-7f2k9,mathieu-x8a1z`). Chacun
colle ensuite **son propre** jeton dans KINETIK (Réglages → Serveur
communautaire).

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

### 5. Exposer en HTTPS (accès depuis l'extérieur)

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
chaque personne du groupe. Mets aussi cette adresse dans `ALLOWED_ORIGINS` du
`.env` si KINETIK tourne en version web plutôt qu'en app desktop (l'app
desktop n'a pas de restriction CORS à configurer).

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
- Ce que ce serveur **ne fait pas** : synchroniser les profils/progressions
  (volontairement, pour cette première version — seuls les secteurs custom
  sont partagés).

## API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | Vérifie que le serveur répond |
| GET | `/api/levels` | Liste les secteurs publiés (résumé) |
| GET | `/api/levels/:id` | Récupère un secteur complet |
| POST | `/api/levels` | Publie un secteur (`{ token, author, name, world }`) |
| PUT | `/api/levels/:id` | Met à jour un secteur (même jeton que la publication) |
| DELETE | `/api/levels/:id` | Supprime un secteur (même jeton que la publication) |
