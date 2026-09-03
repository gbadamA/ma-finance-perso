# API — Ma Finance Perso

NestJS 12 + Prisma 7 + PostgreSQL. Préfixe global : **`/api`**.

## Ce qu'il faut savoir avant de toucher au code

L'isolation entre utilisateurs **n'est plus garantie par la base**. Le projet est parti sur
Supabase, dont la Row Level Security la garantissait au niveau du moteur Postgres ; il tourne
désormais sur Neon, sans RLS. Deux règles, sans exception :

1. Le `userId` vient **toujours** du JWT (`@CurrentUser()`), jamais du corps de la requête ni de
   l'URL.
2. Toute écriture visant une ligne existante passe par `updateMany` / `deleteMany` filtré sur
   `{ id, userId }` — jamais `update({ where: { id } })`, qui laisserait un UUID deviné modifier
   la ligne d'autrui.

`test/verification.mjs` vérifie ces deux règles sur chaque endpoint. **Le lancer après toute
modification de `data.service.ts`.**

## Mise en route locale

```bash
cp .env.example .env      # puis renseigner DATABASE_URL et JWT_SECRET
pnpm db:generate          # depuis la racine du monorepo
pnpm db:migrate
pnpm api                  # http://localhost:3000/api
```

Une base jetable suffit pour développer :

```bash
docker run -d --name mfp-pg -e POSTGRES_PASSWORD=mfp -e POSTGRES_DB=mfp -p 55432:5432 postgres:16-alpine
```

`DATABASE_URL=postgresql://postgres:mfp@localhost:55432/mfp`

## Vérification

```bash
pnpm verify:api                                        # contre l'API locale
API_URL=https://…onrender.com pnpm verify:api          # contre l'API déployée
```

56 contrôles : semis d'inscription, écritures, upsert des mois, jetons (rotation, révocation),
validation, reçus, et surtout **l'étanchéité entre deux comptes**.

⚠️ Le script crée des comptes de test horodatés. Ne pas le lancer contre une base contenant de
vraies données.

## Déploiement

### 1. La base — Neon

Le plan gratuit de Neon offre 0,5 Go par projet, jusqu'à 100 projets, **sans expiration**. C'est
la raison du choix : le Postgres gratuit de Render est supprimé au bout de 30 jours, ce qui a mis
hors service l'API de Preventix-360.

1. Créer un projet sur <https://console.neon.tech> (région : Frankfurt, la plus proche d'Abidjan).
2. Copier la chaîne de connexion **pooled** — celle dont l'hôte contient `-pooler`. Render peut
   lancer plusieurs instances, et des connexions directes épuiseraient vite le quota.

### 2. L'API — Render

Le service web `free` de Render, lui, n'expire pas : il endort seulement l'instance après 15 min
d'inactivité, et le réveil prend ~30 s. Le client mobile prévoit un délai de 45 s pour cette
raison.

1. New > Blueprint, pointer sur le dépôt : `render.yaml` décrit le service.
2. Dans **Environment**, coller `DATABASE_URL` (la chaîne pooled). `JWT_SECRET` est généré par
   Render — ne pas le régénérer ensuite, cela invaliderait toutes les sessions ouvertes.
3. Le build applique les migrations (`prisma migrate deploy`) avant de démarrer.

### 3. Le mobile

Renseigner `EXPO_PUBLIC_API_URL` dans `apps/mobile/.env` avec l'URL Render (sans `/api` final,
le client l'ajoute), puis regénérer l'APK.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `DATABASE_URL` | chaîne Postgres **pooled** de Neon |
| `JWT_SECRET` | 32 caractères minimum ; l'API refuse de démarrer en deçà |
| `PORT` | fourni par Render ; 3000 en local |

Aucune de ces valeurs ne doit être commitée : `.env` est dans `.gitignore`, seul `.env.example`
(vide) est versionné.
