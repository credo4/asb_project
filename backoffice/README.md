# ASB — Back-office administrateur

Interface Vue 3 utilisée par l'équipe Africa Speakers Bureau pour gérer les
speakers, les demandes clients, les candidatures et le contenu du site.

Consomme l'API exposée par [`../backend`](../backend). Rôles concernés :
`SUPER_ADMIN`, `ADMIN`.

**Statut** : Phase 1 (fondations) livrée — connexion, coquille applicative,
thème, client API, composable de liste. Phases suivantes (speakers,
validation de profils, demandes clients, candidatures, tableau de bord) :
voir le prompt de construction (hors dépôt).

## Stack

Vue 3 + Vite + TypeScript strict + Pinia + Vue Router + PrimeVue (thème
personnalisé, voir `src/theme/asb-preset.ts` + `src/styles/tokens.css`) +
axios.

## Commandes

```bash
npm install
npm run dev              # serveur de dev (http://localhost:5173)
npm run build             # build de production (vue-tsc puis vite build)
npm run typecheck         # vue-tsc seul, sans build
npm run lint               # eslint --fix
npm run format              # prettier --write src/
npm run types:generate       # régénère src/types/api.ts depuis l'API locale
```

`npm run types:generate` interroge `http://localhost:3000/internal-docs-json`
(voir `../backend/src/app.config.ts`) — l'API backend doit tourner en local
en mode développement (jamais monté en production). C'est un document
OpenAPI distinct de `/docs` (le contrat public, documenté et stable) :
celui-ci couvre TOUTES les routes (admin/auth/speaker/public) pour permettre
le codegen des types ici, sans jamais promettre de stabilité de contrat.

## Variables d'environnement

Copier `.env.example` en `.env` :

```
VITE_API_URL=http://localhost:3000
```

## Page de référence visuelle

`/_design` (accessible sans connexion) liste boutons, champs, badges,
tableau, états vides et squelettes — sert à vérifier que le thème est bien
appliqué. À supprimer avant la mise en production.

## Avant la mise en production

Ajouter l'origine du back-office déployé dans `PUBLIC_SITE_ORIGINS` (ou
`FRONTEND_URL`, voir `../backend/.env`) côté API — sans ça, le navigateur
bloque tous les appels API par CORS.
