# Cahier des charges — Application Mobile de Gestion Financière Personnelle
## Automatisation des classeurs Excel "Smart Finance Pro" — 100% Mobile

---

## 0. Contexte et objectif

L'utilisateur gère actuellement ses finances personnelles à travers **5 classeurs Excel indépendants**, remplis manuellement chaque mois, incluant de nombreux **graphiques natifs Excel** pour visualiser sa situation. L'objectif est de remplacer entièrement ce workflow par **une application mobile unique** (iOS/Android) reproduisant toutes les capacités de calcul **et de visualisation** des fichiers Excel, avec saisie rapide, automatisation des agrégations, et graphiques natifs mobiles.

> **Choix d'architecture validé avec l'utilisateur : pas de dashboard web.** Toute la solution — saisie ET pilotage stratégique (simulateur FIRE, allocation de portefeuille, projection d'héritage) — doit vivre dans l'application mobile.

> **Choix produit validé : application multi-utilisateurs.** Chaque personne crée son propre compte et ne voit/ne modifie que ses propres données (comptes, revenus, dépenses, assets, objectifs). Aucune donnée n'est partagée entre utilisateurs par défaut.

---

## 1. Analyse détaillée des fichiers sources

### 1.1 `Dashboard_Financier.xlsm` (fichier central — 7 feuilles, 33 graphiques)

**Feuille "💰 Dashboard Financier"** (vue de synthèse) — 8 graphiques :
- Pie chart **"🏦 Allocation de Fortune"** — répartition du patrimoine entre les comptes/liquide/assets sur le dernier mois
- Area chart — évolution de la **Fortune totale** dans le temps (série "Fortune" de la feuille Allocation de Fortune)
- Bar chart — évolution des **Revenus (hors investissement)** dans le temps
- Bar chart (secondaire, comparatif)
- Pie chart **"📈 Portfolio d'Investissements"** — répartition actuelle du portefeuille
- Pie chart **"⚖️ Ratio Revenus / Dépenses"** — comparaison directe revenu moyen vs dépense moyenne
- Area chart **"💰 Réserve de Cash"** — évolution du cash disponible dans le temps
- Graphique "Big Number" / KPI **"📈 Investissements"** — indicateur chiffré mis en avant (type chartEx, équivalent à une carte "gros chiffre" avec libellé)

**Feuille "🏦 Allocation de Fortune"** — pas de graphique propre (sert de source de données aux graphiques du Dashboard)
- Colonnes : Date | Liquide | Assets | Compte 1-8 | Fortune | Change (%) | Change ($) | Revenus (sans invest) | Notes

**Feuille "🧲 Revenus"** — 20 bar charts (un mini-graphique en barres par bloc de 12 mois/année, affichant la tendance du **Revenu Total mensuel** sur l'année). C'est un pattern répétitif = graphique de tendance annuelle glissante, à généraliser en **un seul graphique dynamique par période sélectionnée** côté mobile (pas besoin de dupliquer 20 fois).
- Bloc **Passif** : Investments + Passive 1-5 + total ; Bloc **Actif** : Active 1-7 + total

**Feuille "🍾 Dépenses "** — 2 pie charts **"Répartition des dépenses (moyenne)"** — répartition moyenne des dépenses par catégorie (Logement, Nourriture, Transport, Sorties, Divers, Services, Achats, Impôts)

**Feuille "🚗 Assets"** — 1 pie chart **"Allocation d'Asset"** — répartition du patrimoine "biens de valeur" par catégorie

**Feuille "📈 Portfolio d'Investissement"** — 3 graphiques :
- Area chart **"Réserve de Cash"**
- Pie chart **"Portfolio Idéal"** — allocation cible par classe d'actif
- Pie chart **"Portfolio Actuel"** — allocation réelle par classe d'actif (à comparer visuellement au cible)

**Feuille "Notes"** — règles d'usage (à automatiser, cf. §3.2)

> Le fichier `Demo_Dashboard_Financier.xlsm` est une version pré-remplie du même modèle (mêmes 33 graphiques), à utiliser comme jeu de données de démo pour le développement et les tests visuels.

---

### 1.2 `Calculateur_d-Indépendance_Financière.xlsx` (module FIRE — 2 graphiques)

**Feuille "Calculateur d'Indépendance Fin..."**
- **Entrées** : Date de naissance, Montant déjà investi, Investissement mensuel, Retour annuel attendu (%), Taux de retrait sûr / SWR (%), Inflation annuelle (%)
- **Objectifs paramétrables** : Revenu passif (Minimum/Idéal), Fortune (Court/Moyen/Long terme)
- **Moteur de projection mensuel** (~480 lignes = 40 ans) : valeur nette cumulée, âge, revenu passif potentiel, revenu passif ajusté à l'inflation, dates de checkpoint pour chaque objectif
- **Graphique Line — "Fortune Personnelle sur 40 ans"** : courbe de la valeur nette projetée dans le temps, avec un point de référence (valeur actuelle)

**Feuille "Inflation Moyenne"**
- Table de référence de taux d'inflation historiques
- **Graphique Line — "Évolution de l'inflation"** : courbe historique de l'inflation utilisée comme aide à la décision pour choisir l'hypothèse

---

### 1.3 `Optimisateur_de_dépenses.xlsx` (checklist d'économies — aucun graphique)

- ~35 actions d'économie prédéfinies par catégorie (Communautaire, Dettes, Énergie, Divertissement, Nourriture, Maison, Assurance, Personnel, Transport)
- Par action : Réalisable ? (Oui/Non), Dépense initiale, Nouvelle dépense, Réalisé ? (Oui/Non), Économie mensuelle calculée

---

### 1.4 `Planificateur_d-Héritage.xlsx` (projection long terme — 2 graphiques)

- **Entrées** : Date de naissance, Âge cible
- **Table de projection** sur horizons 0 à 500 ans (croissance composée), avec âge/date correspondants
- **Graphique Bar** — patrimoine projeté par horizon (barres comparatives)
- **Graphique Pie — "⏰ Horloge de vie"** — représentation visuelle du % de vie déjà vécue vs restante (type "donut" horloge)

---

## 2. Synthèse — Modules fonctionnels (application mobile unique)

| # | Module | Origine Excel | Graphiques natifs à reproduire |
|---|--------|----------------|----------------------------------|
| 1 | **Vue d'ensemble** | Dashboard Financier | Pie allocation fortune, Area fortune, Bar revenus, Pie portfolio, Pie ratio revenus/dépenses, Area cash, KPI investissements |
| 2 | **Comptes & Patrimoine** | Allocation de Fortune | Courbe d'évolution de la fortune totale (zoomable par période) |
| 3 | **Revenus** | Revenus | Bar chart mensuel du revenu total (passif vs actif), sélecteur de période remplaçant les 20 graphiques dupliqués |
| 4 | **Dépenses** | Dépenses | 1 pie chart dynamique "répartition moyenne par catégorie" (période sélectionnable) |
| 5 | **Actifs / Biens de valeur** | Assets | Pie chart "allocation d'asset" par catégorie |
| 6 | **Portefeuille d'investissement** | Portfolio d'Investissement | Area réserve de cash, Pie portfolio idéal, Pie portfolio actuel (côte à côte pour comparaison visuelle) |
| 7 | **Indépendance Financière (FIRE)** | Calculateur d'Indépendance | Line chart projection de fortune sur 40 ans (interactif : curseurs → recalcul de la courbe en direct), Line chart historique d'inflation |
| 8 | **Optimisateur de dépenses** | Optimisateur de dépenses | Aucun graphique — checklist + compteur d'économies |
| 9 | **Planificateur d'héritage** | Planificateur d'Héritage | Bar chart patrimoine par horizon, Donut "Horloge de vie" |

---

## 3. Architecture technique proposée (100% Mobile)

### 3.1 Stack recommandée

- **Application mobile** : Flutter (un seul codebase iOS/Android) — recommandé pour la richesse des bibliothèques de graphiques natifs performants (fl_chart, syncfusion_flutter_charts) et le mode hors-ligne
- **Backend / API légère** : Node.js (NestJS) ou backend serverless (Supabase/Firebase) — logique de calcul centralisée pour les projections complexes (FIRE, héritage), synchronisation multi-appareils
- **Base de données** : PostgreSQL (via Supabase) ou SQLite local + sync cloud — séries mensuelles historisées
- **Mode hors-ligne** : stockage local (SQLite/Hive) avec synchronisation différée dès reconnexion — essentiel pour la saisie quotidienne de dépenses sans dépendance réseau
- **Graphiques** : bibliothèque de charts native mobile (courbes, barres, pie/donut, aires) — tous les graphiques Excel identifiés ci-dessus sont reproductibles avec les types standards (line, bar, pie, area, KPI card)
- **Authentification multi-utilisateurs** : inscription/connexion par email + mot de passe (+ option Google/Apple Sign-In), chaque compte étant strictement cloisonné (cf. §3.3) ; verrouillage biométrique/PIN à l'ouverture de l'app comme seconde couche locale
- **Notifications push** : rappel mensuel de saisie, alerte de dérive de portefeuille, objectif FIRE atteint
- **Devise** : multi-devise, défaut FCFA, configurable (les classeurs sources utilisent des montants génériques compatibles EUR/USD/FCFA)
- **Export** : export CSV/PDF depuis l'app (continuité avec l'usage Excel, partage par email/WhatsApp)

### 3.2 Authentification et isolation des données par utilisateur

- **Inscription / Connexion** : email + mot de passe (hashé, bcrypt/argon2), avec option de connexion via Google/Apple pour simplifier l'onboarding
- **Session** : jeton JWT (access token courte durée + refresh token), rattaché à l'`User.id`
- **Isolation stricte des données** : chaque table métier (Account, IncomeEntry, ExpenseEntry, Asset, InvestmentSnapshot, FinancialGoal, SavingsAction, Settings…) porte une clé étrangère `user_id` obligatoire ; toute requête backend est systématiquement filtrée par l'utilisateur authentifié — jamais par un identifiant transmis librement par le client
- **Sécurité base de données** : si Postgres/Supabase, activer la **Row Level Security (RLS)** avec une policy `user_id = auth.uid()` sur chaque table, en complément du filtrage applicatif (défense en profondeur)
- **Verrouillage local** : biométrie/PIN à chaque ouverture de l'app, indépendant de la session serveur (protège l'accès physique au téléphone)
- **Récupération de compte** : réinitialisation de mot de passe par email ; option d'export/sauvegarde chiffrée des données propres à l'utilisateur
- **Multi-appareils** : un même compte peut être utilisé sur plusieurs appareils, avec synchronisation des données propres à cet utilisateur uniquement
- **Non prévu (sauf demande future)** : partage de données entre comptes (ex. couple/famille) — à considérer comme évolution ultérieure (comptes "liés" avec permissions), hors périmètre du MVP

### 3.3 Principe clé d'automatisation (vs. Excel)

| Contrainte Excel actuelle | Solution mobile |
|---|---|
| Saisie manuelle sur 7 feuilles séparées | Écran de saisie mensuelle guidée (wizard) qui alimente tous les modules simultanément |
| Recalcul de formules fragiles (glisser-déposer interdit) | Moteur de calcul intégré à l'app, aucune formule visible/modifiable |
| 20 graphiques dupliqués (un par année) pour visualiser une tendance | 1 seul graphique interactif avec sélecteur de période (mois/année/tout) |
| Pas d'alerte automatique | Notifications : rappel de saisie, dérive de portefeuille (>5 pts vs cible), objectif FIRE atteint |
| Agrégations manuelles inter-feuilles | Calculs automatiques temps réel |
| Aucun accès nomade | Saisie immédiate depuis le mobile (dépense sur le moment, photo de reçu) |
| Graphiques statiques (photo de la situation au moment de l'ouverture) | Graphiques dynamiques et interactifs (zoom, période, tap pour détail) |

---

## 4. Modèle de données (entités principales)

```
User (id, email, mot de passe hashé, date de création)
 └── Settings [user_id] (devise par défaut, date de naissance, taux SWR par défaut, hypothèse d'inflation, âge cible héritage)

Account [user_id] (ex: "Compte 1"..."Compte 8", Liquide, Cash)
 └── MonthlySnapshot [user_id] (date, solde)

IncomeSource [user_id] (type: passif/actif, nom personnalisable)
 └── IncomeEntry [user_id] (date, montant)

ExpenseCategory [user_id] (Logement, Nourriture, Transport, Sorties, Divers, Services, Achats, Impôts — extensible)
 └── ExpenseEntry [user_id] (date, montant, catégorie, note, photo reçu optionnelle)

Asset [user_id] (catégorie, nom, date d'achat, prix d'achat, dette liée, coût de maintien, valeur actuelle, score état)
 └── ValuationHistory [user_id] (date, valeur réelle)

InvestmentAllocation [user_id] (classe d'actif, ratio cible %)
 └── InvestmentSnapshot [user_id] (date, montant par classe d'actif)

FinancialGoal [user_id] (type: fortune / revenu_passif, horizon: court/moyen/long, montant cible, date atteinte calculée)

SavingsAction [user_id] (catégorie, libellé, réalisable, dépense initiale, nouvelle dépense, réalisé, économie mensuelle calculée)

InheritanceProjection [user_id] (âge cible, hypothèse de croissance — recalculée à la volée, non stockée)
```

> Toutes les entités métier portent une clé `user_id` (foreign key vers `User.id`, `NOT NULL`, indexée) — c'est la base de l'isolation des données décrite en §3.2.

---

## 5. Spécifications de calcul (à répliquer fidèlement)

### 5.1 Vue d'ensemble / Santé financière
- `Fortune totale = Σ(Comptes) + Σ(Valeur actuelle des Assets) − Σ(Dette des Assets)`
- `Indicateur Santé financière (années) = Fortune totale / Dépenses annuelles moyennes`
- `Revenu moyen / Dépense moyenne = moyenne mobile sur N derniers mois (paramétrable)`
- `Ratio Revenus/Dépenses = Revenu moyen / Dépense moyenne` (alimente le pie chart dédié)

### 5.2 Indépendance Financière (FIRE)
- `Valeur(t) = Valeur(t-1) × (1 + retour_annuel/12) + apport_mensuel`
- `Revenu passif potentiel(t) = Valeur(t) × Taux_de_retrait_sûr / 12`
- `Revenu passif ajusté inflation(t) = Revenu passif potentiel(t) / (1 + inflation)^(années écoulées)`
- Détection du premier mois où chaque objectif est franchi → date, âge, temps restant
- Courbe de projection avec marqueurs sur les objectifs atteints (reproduit le line chart "Fortune Personnelle sur 40 ans")

### 5.3 Portefeuille d'investissement
- `Écart d'allocation = Allocation réelle (%) − Allocation cible (%)`, par classe d'actif
- Alerte si écart > seuil configurable (ex. ±5 points)
- Affichage côte à côte des deux pie charts "Portfolio Idéal" vs "Portfolio Actuel" pour comparaison visuelle immédiate

### 5.4 Assets
- `Net Equity = Valeur actuelle − Dette associée`
- `P/L = Valeur actuelle − Prix d'achat − Coût de maintien cumulé`
- `Total Equity = Σ(Net Equity)`

### 5.5 Optimisateur de dépenses
- `Économie mensuelle = Dépense initiale − Nouvelle dépense`, comptabilisée si `Réalisé = Oui`
- Deux totaux affichés : économie potentielle totale vs économie réalisée totale

### 5.6 Planificateur d'héritage
- `Patrimoine(horizon) = Patrimoine_actuel × (1 + rendement_annuel)^horizon`, pour chaque horizon (0 à 500 ans)
- Bascule en mode "Héritage" dès que l'horizon dépasse l'espérance de vie restante
- `% de vie vécue = (Âge actuel / Espérance de vie totale) × 100` → alimente le donut "Horloge de vie"

---

## 6. Structure de l'application mobile

### 6.1 Écrans de saisie rapide (quotidien)
- Ajout rapide d'une dépense (montant, catégorie, note, photo reçu)
- Ajout rapide d'un revenu
- Checklist "Optimisateur de dépenses" avec cases à cocher et suivi de progression
- Rappel mensuel de mise à jour des soldes de comptes et de la valeur des assets

### 6.2 Écrans de pilotage (stratégique, intégrés à l'app mobile)
- **Vue d'ensemble** : les 7 visualisations du Dashboard Financier (pie allocation, area fortune, bar revenus, pie portfolio, pie ratio revenus/dépenses, area cash, carte KPI investissements)
- **Simulateur FIRE interactif** : curseurs sur taux de retrait, rendement, inflation, apport mensuel → recalcul en direct de la courbe de projection
- **Portefeuille** : comparaison visuelle allocation réelle vs cible, alertes de rééquilibrage
- **Assets** : inventaire complet, historique de valorisation, pie chart de répartition
- **Planificateur d'héritage** : table + bar chart de projection multi-horizon + horloge de vie
- Export CSV/PDF des rapports mensuels et annuels directement depuis l'app
- Gestion des libellés personnalisables (comptes, sources de revenus — comme "Compte 1"→renommable dans Excel)

---

## 7. Sécurité & confidentialité

- Authentification obligatoire (email/mot de passe ou Google/Apple Sign-In) ; aucune donnée accessible sans session valide
- Isolation stricte des données par utilisateur (`user_id` sur chaque table + Row Level Security côté base de données, cf. §3.2)
- Chiffrement des données financières au repos (AES-256) et en transit (TLS)
- Verrouillage par biométrie/PIN à l'ouverture de l'app (protection locale complémentaire à la session serveur)
- Aucune donnée financière partagée entre utilisateurs ni avec des tiers ; export uniquement à la demande explicite du propriétaire des données
- Sauvegardes automatiques régulières par utilisateur (absentes des fichiers Excel actuels)

---

## 8. Plan de développement suggéré (MVP puis itérations)

**Phase 1 — MVP (saisie + vue d'ensemble)**
1. Authentification multi-utilisateurs (inscription/connexion, isolation des données par `user_id`) + profil utilisateur (paramètres FIRE)
2. Module Comptes & Patrimoine (saisie mensuelle des soldes)
3. Module Revenus + Module Dépenses (saisie mobile)
4. Écran Vue d'ensemble avec les graphiques principaux (allocation, fortune, ratio revenus/dépenses)

**Phase 2 — Modules stratégiques**
5. Module Assets (inventaire + valorisation + pie chart)
6. Module Portefeuille d'investissement (comparaison allocation réelle vs cible)
7. Module Indépendance Financière (simulateur FIRE interactif complet)

**Phase 3 — Modules complémentaires**
8. Module Optimisateur de dépenses (checklist pré-remplie + suivi)
9. Module Planificateur d'héritage (projection + horloge de vie)
10. Notifications, exports, mode hors-ligne complet, personnalisation avancée des libellés

---

## 9. Livrables attendus de Claude Code

1. Schéma de base de données complet avec `user_id` sur chaque table métier et policies RLS (migrations incluses)
2. Backend/API avec authentification (JWT), logique de calcul testée unitairement (projections FIRE et héritage en priorité), et tests garantissant l'étanchéité des données entre utilisateurs
3. Application mobile Flutter complète (Phases 1, 2 et 3) incluant tous les graphiques identifiés en §1 et §2
4. Jeu de données de démonstration (basé sur `Demo_Dashboard_Financier.xlsm`) pour tester l'application
5. Documentation technique (README) et guide de build/déploiement (iOS + Android)

---

*Document généré à partir de l'analyse structurelle complète des 5 classeurs Excel fournis (feuilles, colonnes, formules, ET les 36 graphiques natifs identifiés dans les fichiers .xlsx/.xlsm). Architecture 100% mobile, sans dashboard web, avec authentification multi-utilisateurs et isolation stricte des données par compte. Prêt à être utilisé comme prompt d'implémentation pour Claude Code.*
