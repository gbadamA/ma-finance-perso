# Ma Finance Perso

Application mobile de gestion financière personnelle — remplace les 5 classeurs Excel
« Smart Finance Pro » et leurs 36 graphiques natifs.

> **Lire d'abord [`claudemap.md`](claudemap.md)** : stack verrouillée, direction artistique,
> règles de travail. Le [`cahier-des-charges.md`](cahier-des-charges.md) est la source de vérité
> fonctionnelle.

---

## Démarrage rapide

```bash
pnpm install
pnpm --filter mobile fix     # aligne les versions natives sur le SDK
pnpm mobile                  # QR code -> Expo Go
```

Depuis la racine du kit Jarvis (téléphone et PC sur le même Wi-Fi) :

```powershell
.\scripts\expo.ps1 projets\ma-finance-perso\apps\mobile
```

**L'app démarre sans base de données** : sans `.env` renseigné, l'écran de connexion propose
un **mode démonstration** avec 24 mois de données générées. C'est le moyen le plus rapide de
voir tous les écrans.

---

## Architecture

```
apps/mobile/            Expo SDK 57 · Expo Router · StyleSheet + tokens
  src/app/              routes (fichiers = écrans)
  src/components/       primitives, graphiques, layout, curseur
  src/lib/              thème, auth, données, formatage
packages/core/          moteur de calcul TypeScript pur + 123 tests
packages/design-tokens/ couleurs, élévations, mouvement, typographie
packages/supabase/      client typé + mapping base <-> domaine
supabase/migrations/    schéma SQL + policies RLS
```

### Le moteur de calcul est isolé

**Aucun écran ne fait d'arithmétique financière.** Toutes les formules du §5 du cahier des
charges vivent dans `packages/core`, sans dépendance et testées unitairement. C'est ce qui rend
les projections FIRE et héritage vérifiables — et ce qui permet aux curseurs du simulateur de
recalculer 481 points de projection à chaque mouvement du doigt.

### Toute écriture est rejouable

Une saisie faite sans réseau n'est pas perdue : chaque écriture est décrite comme une
`PendingOp` (`lib/queue.ts`), persistée dans AsyncStorage et rejouée **dans l'ordre** au retour
au premier plan. Seules les erreurs réseau mettent en file — une contrainte violée se
reproduirait à l'identique et remplirait la file sans jamais la vider.

```bash
pnpm test        # 123 tests
pnpm typecheck   # TypeScript sur tout le monorepo
```

### L'isolation des données est dans la base

Chaque table métier porte `user_id NOT NULL` et une policy RLS `user_id = auth.uid()`
(migration `20260826091000_rls.sql`). Le client **n'envoie jamais** de `user_id` : un trigger
`set_user_id()` le renseigne côté serveur. La migration se termine par un garde-fou qui **échoue
au déploiement** si une table de `public` sort sans RLS.

---

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Copier `apps/mobile/.env.example` en `apps/mobile/.env` et renseigner :

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

3. Appliquer le schéma, puis régénérer les types :

```bash
pnpm db:push
pnpm db:types
```

> ⚠️ `packages/supabase/src/database.types.ts` est **écrit à la main** en attendant que le
> projet existe. `pnpm db:types` l'écrase par la version générée, qui fait autorité.

À l'inscription, un trigger amorce le compte : 8 catégories de dépenses, 4 sources de revenus,
une allocation cible, 2 comptes et les 38 actions de l'optimisateur.

---

## État d'avancement

| Module | Écran | État |
|---|---|---|
| 1 · Vue d'ensemble | `(tabs)/index` | ✅ 7 visualisations |
| 2 · Comptes & patrimoine | `(tabs)/patrimoine` | ✅ lecture |
| 3 · Revenus | `revenus` | ✅ lecture |
| 4 · Dépenses | `(tabs)/depenses` | ✅ lecture + tendances |
| 5 · Biens de valeur | `assets` | ✅ lecture |
| 6 · Portefeuille | `portefeuille` | ✅ idéal vs actuel + alerte |
| 7 · FIRE | `fire` | ✅ simulateur interactif |
| 8 · Optimisateur | `optimisateur` | ✅ checklist cochable |
| 9 · Héritage | `heritage` | ✅ projection + horloge de vie |
| Réglages | `reglages` | ✅ enregistrement |

### Saisie (§6.1) — ✅

Un bouton flottant, présent sur les quatre onglets, ouvre les trois saisies :

| Écran | Rôle |
|---|---|
| `saisie/depense` | ajout rapide : montant, catégorie en grille, date, note |
| `saisie/revenu` | toutes les sources du mois sur un écran, total en direct |
| `saisie/soldes` | **point mensuel** : comptes + placements + biens en un passage, fortune recalculée pendant la saisie |

Les deux derniers utilisent un `upsert` : ressaisir un mois **corrige** au lieu de doubler,
comme une case du classeur.

### Compléments — ✅

| Sujet | Où |
|---|---|
| Photo de reçu (appareil photo / galerie) | `lib/receipts.ts` + `saisie/depense` |
| Objectifs FIRE & allocation cible | `app/objectifs.tsx` |
| Notifications (rappel mensuel, dérive, objectif atteint) | `lib/notifications.ts` |
| Export CSV et rapport PDF | `lib/export.ts` |
| Verrouillage biométrique | `lib/lock.tsx` + `components/lock-screen.tsx` |
| File d'attente hors-ligne | `lib/queue.ts` + `lib/mutations.ts` |

**Reste à faire :**

- Modifier les **libellés** des comptes, sources de revenus et catégories depuis l'app
  (ils sont créés à l'inscription, pas encore renommables).
- Écran de détail d'une dépense pour **consulter un reçu** déjà envoyé (`receiptUrl()` existe).
- Connexion **Google / Apple** (le §3.2 la donne en option).

---

## Générer l'APK Android

Le projet natif n'est **pas** dans git (workflow CNG) : il se régénère depuis `app.json`.

```bash
cd apps/mobile
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

L'APK sort dans `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

### ⚠️ La clé de signature

Elle vit dans **`apps/mobile/credentials/`** — volontairement hors de `android/`, que
`prebuild --clean` efface. Ce dossier est dans `.gitignore`.

**Sauvegarde-le hors du poste.** Perdre `release.keystore` rend impossible toute mise à
jour d'un APK déjà installé : Android refuse une nouvelle signature sur un paquet existant,
il faudrait désinstaller (et perdre les données locales) ou republier sous un autre nom.

Après un `prebuild --clean`, le bloc de signature de `android/app/build.gradle` est à
réappliquer — il lit `../credentials/keystore.properties` et retombe sur la clé de debug
si le fichier est absent, pour qu'un poste sans la clé puisse quand même bâtir un APK de test.

### Installer sur un téléphone

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Ou transfère le fichier et ouvre-le (autoriser « sources inconnues »).

---

## Hébergement

**Il n'y a pas de serveur à héberger.** Le cahier des charges (§0) exclut le dashboard web :
l'application est 100 % mobile et son backend est **Supabase managé**. Pas d'API Node, pas de
conteneur à déployer.

Le « déploiement » se résume donc à :

1. créer un projet sur [supabase.com](https://supabase.com) — l'offre gratuite suffit
   (500 Mo de base, 1 Go de stockage, 50 000 utilisateurs actifs/mois) ;
2. `pnpm db:push` pour appliquer le schéma et les policies RLS ;
3. renseigner `apps/mobile/.env` et rebâtir l'APK.

> Railway n'a plus d'offre gratuite depuis août 2023 (crédit d'essai unique, puis 5 $/mois),
> et n'apporterait rien ici : il faudrait y auto-héberger toute la pile Supabase
> (Postgres + Auth + PostgREST + Storage), soit plusieurs conteneurs, en perdant l'Auth et
> la RLS managées sur lesquelles repose l'isolation des données.

---

## Points d'attention

- **Test sur téléphone réel via Expo Go**, jamais d'émulateur.
- **Ne pas réintroduire NativeWind** : la 4.2.6 est antérieure au SDK 57 et la v5 est en
  preview (cf. §2 du claudemap).
- **Ne pas corriger les versions natives à la main** — `pnpm --filter mobile fix`.
- **La formule FIRE utilise `rendement/12`** et non la capitalisation exacte : c'est ce que fait
  le classeur Excel remplacé. La « corriger » ferait diverger l'app des chiffres connus de
  l'utilisateur.
- **La barre d'onglets est flottante** et calée sur `useSafeAreaInsets()` pour ne jamais
  recouvrir les gestes système. Tout nouvel écran doit passer par `<Screen tabbed>`.
- **Notifications locales uniquement** — le push distant ne fonctionne plus dans Expo Go depuis
  le SDK 53, il serait donc intestable sur téléphone.
- **Les reçus ne passent pas par la file hors-ligne** : le fichier vit dans le cache, que le
  système peut vider avant le rejeu. Hors ligne, la dépense part, le reçu est abandonné — et
  l'écran le dit.
- **`supabase db push` n'a jamais été exécuté.** Les migrations sont écrites et relues, mais
  n'ont pas encore tourné contre un vrai Postgres.
