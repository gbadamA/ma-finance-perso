-- =====================================================================
--  Ma Finance Perso — Row Level Security
--
--  §3.2 et §7 du cahier des charges : chaque table métier est filtrée par
--  `user_id = auth.uid()`. C'est le moteur Postgres qui garantit
--  l'étanchéité — pas le code applicatif, pas le client mobile.
--
--  ⚠️ Le client n'envoie JAMAIS son `user_id`. `with check` impose
--     `auth.uid()` à l'insertion : une ligne forgée avec l'identifiant d'un
--     autre utilisateur est rejetée par la base, pas par l'application.
--
--  ⚠️ Toute nouvelle table métier DOIT être ajoutée ici. Le bloc de
--     vérification en fin de fichier échoue au déploiement si une table
--     de `public` n'a pas la RLS activée — c'est volontaire.
--
--  ⚠️ On active la RLS SANS `force`. C'est délibéré : `force` soumettrait
--     aussi le propriétaire des tables aux policies, et le trigger
--     `seed_new_user()` — qui amorce le compte pendant l'inscription, à un
--     moment où `auth.uid()` est encore NULL — échouerait sur son propre
--     `with check`. L'inscription serait cassée. Les rôles `postgres` et
--     `service_role` contournent donc la RLS, ce qui est le fonctionnement
--     normal de Supabase ; `authenticated` et `anon`, eux, y sont soumis.
-- =====================================================================

do $$
declare
  t text;
  -- Toutes les tables métier. `settings` est traitée à part : sa clé
  -- primaire EST le user_id, il n'y a pas de colonne séparée.
  tables text[] := array[
    'accounts',
    'account_snapshots',
    'income_sources',
    'income_entries',
    'expense_categories',
    'expense_entries',
    'assets',
    'asset_valuations',
    'investment_targets',
    'investment_snapshots',
    'financial_goals',
    'savings_actions'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (user_id = (select auth.uid()))
    $f$, t || '_select_own', t);

    execute format($f$
      create policy %I on public.%I
        for insert to authenticated
        with check (user_id = (select auth.uid()))
    $f$, t || '_insert_own', t);

    execute format($f$
      create policy %I on public.%I
        for update to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_update_own', t);

    execute format($f$
      create policy %I on public.%I
        for delete to authenticated
        using (user_id = (select auth.uid()))
    $f$, t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- settings : la clé primaire est le user_id
-- ---------------------------------------------------------------------

alter table public.settings enable row level security;

create policy settings_select_own on public.settings
  for select to authenticated using (user_id = (select auth.uid()));

create policy settings_insert_own on public.settings
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy settings_update_own on public.settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Pas de policy DELETE : on ne supprime pas ses paramètres, on supprime son
-- compte — et la cascade depuis `auth.users` s'en charge.

-- ---------------------------------------------------------------------
-- `user_id` renseigné par la base, jamais par le client
-- ---------------------------------------------------------------------

create or replace function public.set_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Défense en profondeur : même si le client omet le champ, la ligne est
  -- correctement rattachée ; s'il en envoie un autre, la policy le rejette.
  new.user_id := coalesce(new.user_id, auth.uid());
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'accounts', 'account_snapshots', 'income_sources', 'income_entries',
    'expense_categories', 'expense_entries', 'assets', 'asset_valuations',
    'investment_targets', 'investment_snapshots', 'financial_goals',
    'savings_actions'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_user_id()',
      t || '_set_user_id', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Stockage des reçus — bucket privé, cloisonné par préfixe d'utilisateur
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Le premier segment du chemin DOIT être l'identifiant de l'utilisateur :
-- `{user_id}/2026-08/recu-xyz.jpg`. Un chemin qui commence autrement est refusé.
create policy receipts_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy receipts_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy receipts_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy receipts_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Garde-fou : aucune table de `public` ne peut sortir sans RLS
-- ---------------------------------------------------------------------

do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ')
    into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception
      'RLS manquante sur : %. Toute table metier doit etre ajoutee a la migration RLS (cf. §3.2 du cahier des charges).',
      unprotected;
  end if;
end;
$$;
