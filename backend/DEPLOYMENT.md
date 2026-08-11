# Déploiement — VPS Hostinger

Guide pas à pas pour déployer `backend/` sur un VPS (Ubuntu/Debian). Le
dépôt GitHub est **privé** : on clone via une clé SSH de déploiement
(lecture seule), pas via HTTPS + token.

## 1. Prérequis sur le VPS

```bash
# Node.js LTS (via nvm, recommandé pour ne pas dépendre du paquet système)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts

# MySQL 8 (si pas déjà géré par Hostinger ailleurs)
sudo apt update && sudo apt install -y mysql-server

# PM2 (garde le process Node vivant, redémarre au boot)
npm install -g pm2

# nginx (reverse proxy) + certbot (SSL gratuit Let's Encrypt)
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 2. Cloner le dépôt (clé de déploiement, lecture seule)

Sur le VPS :
```bash
ssh-keygen -t ed25519 -C "asb-vps-deploy" -f ~/.ssh/asb_deploy_key -N ""
cat ~/.ssh/asb_deploy_key.pub
```
Copie la clé publique affichée, puis sur GitHub :
**Repo → Settings → Deploy keys → Add deploy key** (PAS besoin de cocher
"Allow write access" — lecture seule suffit pour déployer).

```bash
# ~/.ssh/config sur le VPS
cat >> ~/.ssh/config <<'EOF'
Host github-asb
  HostName github.com
  User git
  IdentityFile ~/.ssh/asb_deploy_key
EOF

git clone github-asb:Touche-Dev/asb_project.git ~/asb_project
cd ~/asb_project/backend
```

## 3. Configurer l'environnement

```bash
cp .env.example .env
nano .env
```

Valeurs **à changer absolument** par rapport à `.env.example` :
- `NODE_ENV=production`
- `APP_URL=https://ton-domaine-api.com` (l'URL publique de CE backend)
- `FRONTEND_URL=https://admin.ton-domaine.com` (back-office)
- `PUBLIC_SITE_ORIGINS=https://ton-domaine-public.com` (le site public,
  autant d'origines que nécessaire séparées par des virgules)
- `TRUST_PROXY=true` (l'app tourne derrière nginx, voir §5 — indispensable
  pour que le rate-limit voie la vraie IP du client, pas celle de nginx)
- `DATABASE_URL` (identifiants MySQL réels du VPS)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (générer des valeurs longues
  et aléatoires, ex: `openssl rand -hex 32` — **jamais** les valeurs de dev)
- `MAIL_*` (vrai SMTP, plus question d'Ethereal en prod)
- `STORAGE_ROOT` (chemin absolu recommandé en prod, ex: `/var/www/asb/storage`)

## 4. Installer, migrer, builder

```bash
npm ci
npx prisma generate
npm run db:deploy    # prisma migrate deploy — jamais `migrate dev` en prod
npm run build
npm run seed          # optionnel, une seule fois : taxonomies + admin de bootstrap
```

## 5. Démarrer avec PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup           # affiche une commande à copier-coller pour démarrer au boot
```

## 6. nginx en reverse proxy + SSL

```nginx
# /etc/nginx/sites-available/asb-backend
server {
    listen 80;
    server_name ton-domaine-api.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/asb-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ton-domaine-api.com   # active le HTTPS
```

Une fois en ligne : `https://ton-domaine-api.com/docs` sert la doc Swagger
en direct — "Try it out" fonctionne nativement (même origine que l'API,
aucune config CORS supplémentaire nécessaire pour la doc elle-même).

## 7. Redéployer après un `git push`

```bash
cd ~/asb_project/backend
git pull
npm ci
npx prisma generate
npm run db:deploy
npm run build
pm2 restart asb-backend
```

`storage/` (médias uploadés) n'est pas versionné (voir `.gitignore`) : il
persiste sur le disque du VPS entre les déploiements, `git pull` n'y touche
pas.

## Rappels sécurité

- `.env` ne doit **jamais** être commité ni copié depuis un `.env` de dev.
- La clé de déploiement GitHub est en lecture seule — si elle fuit, un
  attaquant peut lire le code mais pas y écrire.
- Le port 3000 (Node) ne doit PAS être joignable directement depuis
  Internet — seul nginx (80/443) doit l'être. Avec `ufw` :
  ```bash
  sudo ufw allow 'Nginx Full'   # 80 + 443
  sudo ufw allow OpenSSH
  sudo ufw enable
  sudo ufw deny 3000            # bloque l'accès externe direct au port Node
  ```
  (En interne, nginx continue d'atteindre `127.0.0.1:3000` normalement —
  `ufw` ne bloque que le trafic entrant depuis l'extérieur.)
