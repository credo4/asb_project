# Banc de test navigateur — API publique ASB

Outil **jetable**, pas du code de production : un unique fichier HTML
autonome (`index.html`), sans dépendance, sans build, qui vérifie depuis un
vrai navigateur que toute la surface publique de l'API (`/public/*`) est
consommable — exactement ce que ferait un développeur front-end avant de
commencer son intégration.

## Lancer l'outil

Depuis la racine de ce dossier (`backend/tools/api-smoke-test`) ou depuis
`backend/` :

```bash
npx serve tools/api-smoke-test
```

`serve` affiche l'URL locale (en général `http://localhost:3000`). Ouvre-la
dans un navigateur.

**⚠️ Ne double-clique JAMAIS sur `index.html` pour l'ouvrir directement**
(`file://...`). Une page ouverte en `file://` a pour origine `null` côté
navigateur : le CORS échouera systématiquement, mais avec un message trompeur
qui ressemble à un problème serveur alors que c'est uniquement lié à la façon
dont la page a été ouverte. Sers TOUJOURS le fichier via un serveur HTTP,
même local.

Si le port `3000` est déjà pris par l'API elle-même (cas fréquent en local,
les deux tournant par défaut sur ce port), lance `serve` sur un autre port :

```bash
npx serve tools/api-smoke-test -l 5500
```

## CORS : l'origine locale doit être autorisée côté API

L'API applique une allow-list CORS stricte, construite à partir de
`PUBLIC_SITE_ORIGINS` (+ `FRONTEND_URL` et `APP_URL`) — voir
`src/app.config.ts`. L'origine de la page servie par `serve` (ex.
`http://localhost:5500`) doit figurer dans `PUBLIC_SITE_ORIGINS` de
l'environnement pointé par le champ « URL de base » de l'outil, sinon **tous**
les appels échoueront avec une erreur réseau, indiscernable en JavaScript
d'une vraie panne (le navigateur ne révèle jamais la vraie cause d'un rejet
CORS). L'outil affiche ce cas explicitement plutôt que de laisser deviner.

- Pour tester en **local**, ajoute l'origine servie par `serve` à
  `PUBLIC_SITE_ORIGINS` dans `backend/.env`, puis relance l'API.
- Pour tester la **production**, l'origine locale doit être ajoutée à
  `PUBLIC_SITE_ORIGINS` sur l'environnement de prod (panneau Hostinger) — ou
  bien accepte que la section « Écriture »/« Lecture » échoue tant que ce
  n'est pas fait : ce n'est pas un bug de l'API, c'est l'invariant CORS qui
  fonctionne comme prévu.

## Ce que l'outil crée réellement en base

La section **Écriture** soumet de vrais formulaires contre l'API pointée :

- une demande de réservation pour chacun des 5 types de service
  (CONFERENCE, MASTERCLASS, WEBINAR, ADVISORY, ONE_TO_ONE),
- une candidature au roster,
- un événement analytics (clic « Check Availability »).

Tous les champs texte visibles (nom d'événement/organisation/message) sont
préfixés **`[TEST]`** et les emails générés commencent par `smoke-` — utilise
ces deux marqueurs pour retrouver et supprimer ces lignes ensuite
(`booking_requests`, `roster_applications`) depuis le back-office ou
directement en base. L'outil affiche un avertissement en haut de page à
chaque chargement pour ne jamais l'oublier.

## Écarts constatés (signalés, pas corrigés)

Deux tests demandés dans le prompt d'origine ne correspondent à aucune route
réelle du code actuel — l'outil les marque « non applicable » plutôt que
d'inventer un comportement :

1. **Aucun paramètre de tri** sur `GET /public/speakers`
   (`QueryPublicSpeakersDto` n'en expose pas ; l'ordre est fixe côté
   serveur).
2. **Aucune route de « listes éditoriales »** dans `src/modules/public/`
   (seul le type d'événement analytics `CURATED_LIST_VIEW` existe, pour
   tracer la consultation d'une liste qui vivra ailleurs — probablement en
   Phase 4/CMS).

## Étanchéité public/privé

Chaque réponse est passée dans un détecteur récursif qui signale toute clé
ressemblant à un tarif, un email, un téléphone, une note interne, une clé de
stockage, un document, une disponibilité, un statut interne ou un
identifiant utilisateur/interne. `feeTierPublic` est la seule exception
documentée (niveau tarifaire *indicatif* public, pas un tarif). Le verdict
global apparaît en haut de page, en plus du détail par endpoint.

## Rapport

Le bouton « Copier le rapport » met dans le presse-papier un résumé texte —
endpoint par endpoint, méthode, paramètres acceptés, statut observé et forme
de réponse — pensé pour être transmis tel quel à un développeur front-end
comme document d'intégration.
