-- =====================================================================
--  Ma Finance Perso — schéma initial
--  Réplique le §4 du cahier des charges (entités principales).
--
--  ⚠️ RÈGLE ABSOLUE : toute table métier porte `user_id uuid not null`
--     référençant `auth.users(id)`, indexé, avec RLS `user_id = auth.uid()`.
--     C'est la base de l'isolation décrite au §3.2. Les policies sont dans
--     la migration `..._rls.sql` qui suit.
--
--  ⚠️ MONTANTS : `bigint`, exprimé dans l'unité mineure de la devise
--     (franc entier pour XOF, centime pour EUR). Jamais de `numeric`
--     flottant : douze mois de dépenses additionnées dérivent visiblement.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------

create type account_kind as enum ('liquide', 'compte', 'epargne', 'investissement');
create type income_kind  as enum ('passif', 'actif');
create type goal_kind    as enum ('fortune', 'revenu_passif');
create type goal_horizon as enum ('court', 'moyen', 'long', 'minimum', 'ideal');

-- ---------------------------------------------------------------------
-- Paramètres utilisateur (1 ligne par compte)
-- ---------------------------------------------------------------------

create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'XOF',
  birth_date date,
  -- Taux exprimés en POINTS de pourcentage (4 = 4 %), comme dans le classeur.
  safe_withdrawal_rate numeric(5, 2) not null default 4,
  inflation_rate       numeric(5, 2) not null default 3,
  expected_return      numeric(5, 2) not null default 7,
  monthly_investment   bigint        not null default 0,
  -- Fenêtre des moyennes mobiles revenu / dépense (§5.1).
  average_window_months smallint not null default 6 check (average_window_months between 1 and 60),
  -- Seuil de dérive du portefeuille déclenchant l'alerte (§5.3).
  drift_threshold      numeric(5, 2) not null default 5,
  life_expectancy      smallint not null default 80 check (life_expectancy between 1 and 130),
  inheritance_target_age smallint not null default 90,
  -- Verrouillage biométrique / PIN local (§3.2) : le choix suit l'utilisateur
  -- d'un appareil à l'autre, la vérification reste 100 % locale.
  biometric_lock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Comptes & patrimoine  (feuille « Allocation de Fortune »)
-- ---------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind account_kind not null default 'compte',
  currency text not null default 'XOF',
  -- Libellés renommables, comme « Compte 1 » → « BICICI » dans le classeur.
  position smallint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id) where not archived;

create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- Normalisé au 1er du mois : la saisie est mensuelle.
  month date not null,
  balance bigint not null,
  note text,
  created_at timestamptz not null default now(),
  -- Un seul relevé par compte et par mois : une seconde saisie corrige la première.
  unique (account_id, month)
);
create index account_snapshots_user_month_idx on public.account_snapshots (user_id, month desc);

-- ---------------------------------------------------------------------
-- Revenus  (feuille « Revenus »)
-- ---------------------------------------------------------------------

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind income_kind not null,
  -- Un revenu d'investissement est passif MAIS exclu de la colonne
  -- « Revenus (sans invest) » du classeur : d'où ce drapeau distinct.
  is_investment boolean not null default false,
  position smallint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index income_sources_user_idx on public.income_sources (user_id);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.income_sources(id) on delete cascade,
  month date not null,
  amount bigint not null,
  note text,
  created_at timestamptz not null default now(),
  unique (source_id, month)
);
create index income_entries_user_month_idx on public.income_entries (user_id, month desc);

-- ---------------------------------------------------------------------
-- Dépenses  (feuille « Dépenses »)
-- ---------------------------------------------------------------------

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Clé stable qui pilote la couleur du camembert (cf. design-tokens).
  key text not null,
  label text not null,
  position smallint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
create index expense_categories_user_idx on public.expense_categories (user_id);

create table public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  -- Date complète : la dépense se saisit sur le moment, pas en fin de mois.
  spent_on date not null,
  amount bigint not null check (amount >= 0),
  note text,
  -- Chemin dans le bucket privé `receipts`, préfixé par l'user_id.
  receipt_path text,
  created_at timestamptz not null default now()
);
create index expense_entries_user_date_idx on public.expense_entries (user_id, spent_on desc);
create index expense_entries_category_idx on public.expense_entries (category_id);

-- ---------------------------------------------------------------------
-- Biens de valeur  (feuille « Assets »)
-- ---------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  name text not null,
  purchase_date date,
  purchase_price bigint not null default 0,
  -- Dette adossée au bien : elle se soustrait de la fortune totale (§5.1).
  debt bigint not null default 0,
  maintenance_cost bigint not null default 0,
  current_value bigint not null default 0,
  condition_score smallint check (condition_score between 0 and 100),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index assets_user_idx on public.assets (user_id) where not archived;

create table public.asset_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  valued_on date not null,
  value bigint not null,
  created_at timestamptz not null default now(),
  unique (asset_id, valued_on)
);
create index asset_valuations_user_idx on public.asset_valuations (user_id, valued_on desc);

-- ---------------------------------------------------------------------
-- Portefeuille d'investissement  (feuille « Portfolio d'Investissement »)
-- ---------------------------------------------------------------------

create table public.investment_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class text not null,
  -- « Portfolio Idéal » : part visée, en points de pourcentage.
  target_percent numeric(5, 2) not null check (target_percent between 0 and 100),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, asset_class)
);

create table public.investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class text not null,
  month date not null,
  -- « Portfolio Actuel » : montant réellement détenu.
  amount bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, asset_class, month)
);
create index investment_snapshots_user_month_idx on public.investment_snapshots (user_id, month desc);

-- ---------------------------------------------------------------------
-- Objectifs & optimisateur de dépenses
-- ---------------------------------------------------------------------

create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind goal_kind not null,
  horizon goal_horizon not null,
  label text not null,
  target_amount bigint not null check (target_amount > 0),
  -- La date d'atteinte est RECALCULÉE à la volée par le moteur FIRE et n'est
  -- pas stockée : elle dépend des hypothèses (rendement, apport) qui changent
  -- à chaque mouvement de curseur du simulateur.
  created_at timestamptz not null default now(),
  unique (user_id, kind, horizon)
);

create table public.savings_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  label text not null,
  feasible boolean not null default true,
  initial_expense bigint not null default 0,
  new_expense bigint not null default 0,
  done boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index savings_actions_user_idx on public.savings_actions (user_id);

-- ---------------------------------------------------------------------
-- `updated_at` automatique sur les paramètres
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();
