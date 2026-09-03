# 🗺️ CLAUDEMAP — MA FINANCE PERSO

> Carte maîtresse du projet. **Lue en priorité par Claude Code au démarrage de chaque session.**
> Elle définit **quoi** construire, **avec quelle stack**, **dans quel ordre**, et **à quoi ça doit ressembler**.
> Source de vérité fonctionnelle : `cahier-des-charges.md` (analyse des 5 classeurs Excel « Smart Finance Pro »).

---

## 1. Identité du projet

| | |
|---|---|
| **Nom de travail** | **Ma Finance Perso** |
| **Éditeur** | ITEKT Afrique — Côte d'Ivoire |
| **Type** | Application **mobile uniquement** (iOS + Android) — ⚠️ **pas de dashboard web** |
| **Cible** | Particulier gérant son patrimoine, aujourd'hui sur 5 classeurs Excel |
| **Objectif** | Remplacer intégralement les classeurs Excel : saisie, agrégations, **et les 36 graphiques natifs** |
| **Langue produit** | Français |
| **Devise** | Multi-devise, **défaut FCFA (XOF)** |
| **Multi-utilisateurs** | Oui — chaque compte est **strictement cloisonné** (`user_id` + RLS) |

**Promesse produit :** ce que faisaient 5 classeurs et 36 graphiques Excel, dans une app qu'on ouvre 20 secondes par jour — et qui, elle, calcule toute seule.

---

## 2. Stack technique (verrouillée)

### Mobile — `apps/mobile`
| Rôle | Choix | Note |
|---|---|---|
| Framework | **Expo SDK 57** (`expo@~57.0.16`, RN 0.86, React 19.2) | 1 base de code iOS + Android |
| Navigation | **Expo Router** (dossier `src/app`) | routing par fichiers, `typedRoutes` activé |
| **Styling** | **`StyleSheet` + tokens typés** (`@mfp/design-tokens`) | ⚠️ **pas de NativeWind** — voir l'encadré ci-dessous |
| **Graphiques** | **`react-native-gifted-charts`** + `react-native-svg` | pie / donut / line / area / bar — **pas de Skia** |
| Animations | **Reanimated 4** (+ `react-native-worklets`) | pressions, cascades d'entrée, curseurs FIRE |
| Dégradés / flou | `expo-linear-gradient`, `expo-blur` | héros, tab bar flottante |
| Icônes | **Lucide** (`lucide-react-native`) | |
| Data / cache | **TanStack Query** | cache + file d'attente hors-ligne |
| Stockage local | **AsyncStorage** | session, cache, file de sync |
| Sécurité locale | **expo-local-authentication** | biométrie / PIN à l'ouverture |
| **Test** | **Expo Go sur téléphone réel** | ⚠️ **pas d'émulateur** |

> ### ⚠️ Pourquoi pas NativeWind sur ce projet
> NativeWind **4.2.6** (dernière stable) est antérieure au SDK 57 / RN 0.86, et la **v5 est en
> preview**. C'est exactement le type d'assemblage qui a cassé le bundle Metro d'`asso-jeunes`.
> On style donc en `StyleSheet` alimenté par `@mfp/design-tokens` : une seule source de vérité
> visuelle malgré tout, et un contrôle fin des **élévations** et des **transitions** que Tailwind
> RN rend justement pénibles. **Ne pas réintroduire NativeWind sans une raison forte.**

> ⚠️ **Versions natives** : ne jamais les corriger à la main — lancer `pnpm --filter mobile fix`
> (= `expo install --fix`).

### Backend — **API NestJS + Postgres Neon**
| Rôle | Choix |
|---|---|
| API | **NestJS 12**, préfixe global `/api`, hébergée sur **Render** (plan gratuit) |
| Base | **PostgreSQL managé chez Neon** (plan gratuit : 0,5 Go, **sans expiration**) |
| ORM | **Prisma 7** + `@prisma/adapter-pg` ; migrations SQL versionnées |
| Auth | JWT d'accès (15 min) + jeton de rafraîchissement opaque (60 j, rotatif, haché SHA-256) ; mots de passe en **argon2** |
| **Isolation** | **dans le code** : `userId` toujours issu du JWT, chaque écriture filtrée sur `{ id, userId }` |
| Fichiers | reçus stockés **en base** (`bytea`), servis par `GET /api/receipts/:id` authentifié |

> **Pourquoi ce revirement (Supabase → NestJS/Neon)** : le plan gratuit Supabase plafonne à
> **2 projets actifs par propriétaire**, et les deux places sont prises (`systemcollaboratif`,
> `qardan-hassana`). Neon, lui, autorise 100 projets gratuits qui **n'expirent pas** — contrairement
> au Postgres gratuit de Render, supprimé au bout de 30 jours, ce qui a mis hors service l'API de
> Preventix-360.
>
> ⚠️ **Ce qu'on perd, et qu'il faut savoir** : la Row Level Security exigée au §3.2 du cahier des
> charges était garantie par le **moteur Postgres**. Elle est désormais garantie par le **code** de
> `apps/api/src/modules/data/data.service.ts`. Une seule méthode qui oublierait le `userId`
> exposerait les données d'autrui — ce que la RLS rendait impossible. Toute nouvelle écriture doit
> donc suivre les deux règles écrites en tête de ce fichier.

> **Écart assumé vs cahier des charges** : le §3.1 recommandait Flutter. Le projet part en
> **React Expo**, standard de l'utilisateur pour toute nouvelle app mobile. Tous les types de
> graphiques Excel identifiés sont couverts par `react-native-gifted-charts`.

### Moteur de calcul — `packages/core`
**TypeScript pur, zéro dépendance, testé unitairement (Vitest).**
Toutes les formules du §5 du cahier des charges vivent **ici et nulle part ailleurs** : les écrans
ne font jamais d'arithmétique financière. C'est ce qui rend FIRE et héritage vérifiables.

### Monorepo — `pnpm` workspaces

```
ma-finance-perso/
├─ claudemap.md               ← ce fichier
├─ cahier-des-charges.md      ← source de vérité fonctionnelle
├─ apps/mobile/               ← l'application Expo (code dans src/)
├─ apps/api/                  ← l'API NestJS (Prisma + migrations SQL)
├─ packages/design-tokens/    ← DA : couleurs, élévations, mouvement, typo
├─ packages/core/             ← moteur de calcul pur + tests
└─ render.yaml                ← déploiement de l'API (sans base : elle vit chez Neon)
```

---

## 3. 🎨 Direction artistique — « Nuit & Ambre »

> **Dérivée du logo ITEKT Afrique** : bleu marine profond + orange ambré.
> Objectif : **sobre, dense, précis, premium**. Une app d'argent inspire le sérieux, pas la fête.
> Mode clair ET sombre natifs. Anti-template : ni vert-banque générique, ni cartes blanches flottantes.

### 3.1 Palette (tokens réels dans `packages/design-tokens/src/index.ts`)

```
Marque — issue du logo
  primary      #16276B   marine du logo — actions, courbe principale
  primaryDeep  #0C1740   marine saturée — fond de héros, splash
  primaryLift  #2B3F9E   marine éclaircie — pressions, dégradés
  accent       #F2994A   orange du logo — accents rares, KPI, objectif atteint
  accentSoft   #F7B77A   orange clair — sous-titres sur marine, halos

Dégradés signature (135°)
  hero      #0C1740 → #16276B → #2B3F9E     carte « Fortune totale »
  heroWarm  #16276B → #2B3F9E → #F2994A     moments forts (objectif atteint)
  accent    #F2994A → #F7B77A                boutons secondaires, badges

Sémantique financière (jamais utilisée comme couleur de marque)
  gain     #17B890   vert-teal  (+, hausse, économie réalisée)
  loss     #E5484D   corail     (−, baisse, dette)
  warning  #E8A33D   ambre      (dérive de portefeuille > seuil)

Neutres — clair                    Neutres — sombre
  bg            #F6F7FB              bg            #070C1E
  surface       #FFFFFF              surface       #0F1730
  surfaceAlt    #EEF1F8              surfaceAlt    #17203F
  surfaceSunken #E5EAF5              surfaceSunken #0A1128
  border        #DCE2F0              border        #242F55
  text          #0B1230              text          #EAEEF9
  textMuted     #5A6488              textMuted     #8C97B8
```

**Règle de contraste absolue :** l'orange ne porte **que** du texte sombre ; le marine ne porte
**que** du texte clair.

### 3.2 Élévations (`elevation` dans les tokens)

Quatre paliers, **déclinés par thème** — en sombre l'ombre ne se voit pas, ce sont la bordure et le
palier de surface qui séparent les plans :

| Palier | Usage |
|---|---|
| `card` | cartes posées sur le fond |
| `floating` | tab bar flottante, FAB, feuilles modales |
| `hero` | carte de fortune — l'ombre est **teintée marine**, pas noire |
| `accentGlow` | halo orange, **uniquement** sur un état de réussite |

### 3.3 Mouvement (`motion` dans les tokens)

Une transition financière est **rapide et nette** : on ne fait pas rebondir un solde bancaire.

| Token | Valeur | Usage |
|---|---|---|
| `duration.instant` | 120 ms | retour tactile |
| `duration.quick` | 220 ms | onglet, filtre de période |
| `duration.normal` | 320 ms | entrée d'écran, dépliage |
| `duration.slow` | 520 ms | animation d'un graphique au montage |
| `stagger` | 45 ms | cascade d'entrée d'une liste |
| `spring.press` | damping 20 / stiffness 320 | pression (sans oscillation) |
| `spring.select` | damping 16 / stiffness 220 | sélection, bascule |
| `pressScale` | 0.97 | échelle d'un élément pressé |

### 3.4 Échelles catégorielles (les graphiques en dépendent)

Fixes, pour qu'une catégorie garde **toujours** la même couleur d'un écran à l'autre :

```
Dépenses (8)    Logement #3B5BDB · Nourriture #F2994A · Transport #17B890 · Sorties #E064A8
                Divers   #8C97B8 · Services   #7C5CE0 · Achats    #F5C24D · Impôts  #E5484D

Patrimoine (7)  Liquide #17B890 · Comptes #16276B · Actions #3B5BDB · Obligations #7C5CE0
                Immobilier #F2994A · Crypto #F5C24D · Autres #8C97B8
```

Clé inconnue → `colorForKey()` retombe de façon **déterministe** sur `seriesFallback`.

### 3.5 Règles de composition

- **Chiffres en `tabular-nums` systématiquement** — une colonne de montants doit s'aligner.
- **Le signe est porté par la couleur** (vert/corail), jamais par un `+`/`−` seul.
- **Densité** : l'utilisateur vient d'Excel, il veut voir des chiffres. Pas de grandes cartes vides.
- **Rayons** : `xs 6` · `sm 10` · `md 16` · `lg 24` · `xl 32`.
- **L'orange est rare.** S'il est partout, il ne signale plus rien.

### 3.6 ⚠️ Barre de navigation — ne jamais recouvrir les gestes système

La tab bar est **flottante** et repose sur `useSafeAreaInsets()` :

- marge basse = `max(insets.bottom, 12)` → elle **remonte au-dessus** de la barre gestuelle
  Android et du home indicator iOS ;
- `android.predictiveBackGestureEnabled` reste **désactivé** dans `app.json` ;
- tout contenu scrollable porte un `contentInset` bas = hauteur de la tab bar + inset, pour que
  la dernière ligne d'une liste ne finisse jamais sous la barre.

**À vérifier sur le téléphone réel à chaque écran ajouté.**

---

## 4. Modules — état d'avancement

Correspondance directe avec le §2 du cahier des charges.

| # | Module | Écran | Graphiques | Phase | Statut |
|---|---|---|---|---|---|
| 1 | Vue d'ensemble | `(tabs)/index` | Pie allocation · Area fortune · Bar revenus · Pie portfolio · Pie ratio R/D · Area cash · KPI investissements | 1 | ✅ |
| 2 | Comptes & Patrimoine | `(tabs)/patrimoine` | Courbe fortune (période sélectionnable) | 1 | ✅ lecture |
| 3 | Revenus | `revenus` | Bar mensuel passif vs actif | 1 | ✅ lecture |
| 4 | Dépenses | `(tabs)/depenses` | Pie répartition moyenne par catégorie | 1 | ✅ lecture |
| 5 | Actifs / biens de valeur | `assets` | Pie allocation d'asset | 2 | ✅ |
| 6 | Portefeuille | `portefeuille` | Area évolution · Pie idéal · Pie actuel (côte à côte) | 2 | ✅ |
| 7 | **FIRE** | `fire` | Line projection 40 ans (curseurs → recalcul direct) | 2 | ✅ |
| 8 | Optimisateur de dépenses | `optimisateur` | — (checklist + compteur) | 3 | ✅ |
| 9 | Planificateur d'héritage | `heritage` | Bar par horizon · Donut « horloge de vie » | 3 | ✅ |

**Généralisation clé :** les **20 bar charts dupliqués** de la feuille Revenus deviennent **un seul
graphique** + sélecteur de période. Idem pour les 2 pie charts identiques des Dépenses.

---

## 5. Plan de développement

**Phase 0 — Socle** ✅ monorepo, DA, schéma Postgres + RLS, moteur de calcul (123 tests), jeu de démo.
**Phase 1 — MVP** ✅ *en lecture* — auth · Patrimoine · Revenus · Dépenses · Vue d'ensemble.
**Phase 2 — Stratégique** ✅ Assets · Portefeuille (réel vs cible + alerte) · Simulateur FIRE interactif.
**Phase 3 — Compléments** ✅ Optimisateur · Héritage · Réglages · Reçus photo · Objectifs · Notifications · Export CSV/PDF · Verrou biométrique · Hors-ligne.

### Saisie (§6.1) ✅

Bouton flottant sur les quatre onglets → `saisie/depense`, `saisie/revenu`, `saisie/soldes`.
Le point mensuel remplace la saisie sur 7 feuilles Excel : comptes, placements et biens en un
passage, **fortune recalculée pendant la frappe**. Revenus et soldes passent par un `upsert` :
ressaisir un mois corrige au lieu de doubler.

### Phase 3 ✅ — complétée

| Sujet | Où | Note |
|---|---|---|
| **Photo de reçu** | `lib/receipts.ts` + `saisie/depense` | appareil photo ou galerie, upload vers le bucket privé `receipts`, chemin `{user_id}/{mois}/…` |
| **Objectifs & allocation cible** | `app/objectifs.tsx` | 5 objectifs du classeur + curseurs d'allocation avec contrôle du total à 100 pts |
| **Notifications** | `lib/notifications.ts` | **locales uniquement** — rappel mensuel, dérive, objectif atteint |
| **Export CSV / PDF** | `lib/export.ts` | CSV `;` + BOM (Excel FR), rapport PDF via `expo-print`, partage système |
| **Verrou biométrique** | `lib/lock.tsx` + `components/lock-screen.tsx` | reverrouille après 30 s en arrière-plan |
| **File d'attente hors-ligne** | `lib/queue.ts` + `lib/mutations.ts` | toute écriture est une `PendingOp` rejouable, persistée dans AsyncStorage |

**Décisions à ne pas défaire :**

- **Notifications locales, pas de push distant.** Les trois alertes se déduisent de données déjà
  en mémoire ; et depuis le SDK 53 le push distant ne marche plus dans Expo Go, donc serait
  intestable sur téléphone — le seul mode de test du projet.
- **Les uploads de reçus ne passent PAS par la file d'attente.** Le fichier vit dans le cache,
  que le système peut vider avant le rejeu. Hors ligne, la dépense part en file, le reçu est
  abandonné et l'écran le dit.
- **`notifyOnce` mémorise les alertes déjà émises.** Sans cela la dérive re-notifierait à chaque
  ouverture jusqu'au rééquilibrage, et l'utilisateur couperait les notifications.
- **Le reçu part en `FormData` avec `{ uri, name, type }`**, pas en `Uint8Array` : React Native
  lit le fichier lui-même pendant l'envoi, sans charger 5 Mo en mémoire JavaScript.
- **Le renouvellement du jeton n'est tenté qu'une fois** par requête (`api.ts`). Boucler
  masquerait une session morte et l'app tournerait indéfiniment sur un écran vide.
- **La file d'attente est vidée à la déconnexion.** La rejouer sous le compte suivant lui
  attribuerait des dépenses qui ne sont pas les siennes.

### ⚠️ Ce qui reste

- **Pas de réinitialisation de mot de passe** : elle reposait sur le service d'e-mails de
  Supabase. L'API n'a pas de fournisseur SMTP ; le lien « Mot de passe oublié ? » a donc été
  retiré de l'écran de connexion plutôt que laissé en promesse non tenue.
- Modification des **libellés** de comptes / sources de revenus / catégories depuis l'app
  (création à l'inscription uniquement pour l'instant).
- Consultation d'un reçu déjà envoyé (`receiptSource()` existe, l'écran de détail d'une dépense non).
- Connexion Google / Apple (§3.2 la donne en option).

---

## 6. Règles de travail (à respecter à chaque session)

1. **Aucun calcul financier dans un écran.** Tout passe par `packages/core`, qui est testé.
2. **Aucun `userId` transmis depuis le client.** L'API le lit dans le JWT. Et côté API, toute
   écriture sur une ligne existante passe par `updateMany`/`deleteMany` filtré sur `{ id, userId }` —
   jamais `update({ where: { id } })`, qui laisserait un UUID deviné modifier la ligne d'autrui.
3. **Aucune couleur, ombre ou durée en dur** dans un `.tsx` — tout vient de `@mfp/design-tokens`.
4. **Un seul graphique paramétrable** plutôt que N dupliqués (leçon des 20 bar charts Excel).
5. **Montants stockés en entier** (unité mineure, ex. franc CFA entier) — jamais de flottant en base.
6. **Test = Expo Go sur téléphone réel**, jamais d'émulateur.
7. **Ne pas réintroduire NativeWind** (cf. §2).
8. Après tout changement de schéma : `pnpm db:push` **puis** `pnpm db:types`.

---

## 7. ⚠️ Pièges vérifiés sur émulateur — ne pas les réintroduire

Ces six points ont **cassé l'application au lancement réel**, alors que TypeScript,
les 123 tests et le bundle Metro passaient tous. Ils ne se voient qu'en exécutant.

| Piège | Symptôme | Correctif en place |
|---|---|---|
| **`expo-notifications` lève à l'import dans Expo Go** (Android, SDK 53+) | l'app entière plante au démarrage | `lib/notifications.ts` charge le module en **`require()` différé**, jamais dans Expo Go |
| **`gifted-charts-core` mute ses entrées** (`obj.isActiveClone = null` dans son clone) | « Cannot add new property 'isActiveClone' » sur chaque graphique | `mutableCopy()` dans `components/charts.tsx`, appliqué à **toute** donnée passée à la librairie |
| **La librairie ajoute la colonne d'axe Y EN PLUS de `width`** | chaque graphique déborde de sa carte par la droite | `plotWidth(width)` = `width − 54` |
| **`labelWidth` n'existe pas sur `lineDataItem`** | étiquettes d'axe réduites à « … » | échelle des années **dessinée à la main** sous le graphique FIRE |
| **Écriture dans une `sharedValue` pendant le rendu** | « [Reanimated] Writing to `value` during component render » | `useEffect` dans `components/slider.tsx` |
| **Montant replié sur deux lignes** | « 13 088 509 F / CFA » débordant sur la colonne voisine | `Amount` force `numberOfLines={1}` + `adjustsFontSizeToFit` |

### Lancer sur l'émulateur (`mty`)

```bash
emulator -avd mty -no-snapshot -no-boot-anim      # GPU matériel, PAS swiftshader (ANR du System UI)
adb shell svc power stayon true                    # sinon l'écran s'endort : captures noires, taps absorbés
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

⚠️ **Ne pas lancer Metro avec `--localhost`** : il n'écoute alors que sur `::1` (IPv6),
`adb reverse` pointe vers l'IPv4 et Expo Go ne joint jamais le serveur.

---

## 8. Commandes

```bash
pnpm install                    # à la racine du projet
pnpm --filter mobile fix        # aligne les versions natives sur le SDK
pnpm mobile                     # démarre Expo (QR code → Expo Go)
pnpm test                       # tests du moteur de calcul (Vitest)
pnpm typecheck                  # TypeScript sur tout le monorepo (core + mobile + api)

pnpm api                        # démarre l'API en local (http://localhost:3000/api)
pnpm db:generate                # régénère le client Prisma
pnpm db:migrate                 # applique les migrations en attente (jamais `migrate dev` en prod)
pnpm db:studio                  # inspecte la base dans le navigateur
```

L'API a besoin de `apps/api/.env` (voir `.env.example`) :
`DATABASE_URL` (chaîne **pooled** de Neon) et `JWT_SECRET` (32 caractères minimum).

```bash
pnpm verify:api                 # 56 contrôles de bout en bout contre l'API locale
API_URL=https://…onrender.com pnpm verify:api
```

⚠️ `pnpm verify:api` crée des comptes de test horodatés. **Jamais contre une base de production.**

### Base jetable pour développer

```bash
docker run -d --name mfp-pg -e POSTGRES_PASSWORD=mfp -e POSTGRES_DB=mfp -p 55432:5432 postgres:16-alpine
```

### APK

```bash
cd apps/mobile/android
ANDROID_HOME="$LOCALAPPDATA/Android/Sdk" JAVA_HOME="C:/Program Files/Java/jdk-21"   ./gradlew.bat assembleRelease --no-daemon
```

⚠️ **JDK 21, pas 25** (le JBR d'Android Studio) : AGP échoue sur son avertissement
« restricted method ». Et `ANDROID_HOME` doit être passé explicitement — il n'y a pas de
`local.properties` dans le dépôt.

L'URL de l'API est figée dans `app.json` (`extra.apiUrl`) : c'est elle qui part dans l'APK.
`EXPO_PUBLIC_API_URL` (dans `.env`) la surcharge en développement.

Depuis la racine du kit, pour tester sur le téléphone :

```powershell
.\scripts\expo.ps1 projets\ma-finance-perso\apps\mobile
```
