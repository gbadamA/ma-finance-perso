-- =====================================================================
--  Ma Finance Perso — amorçage d'un nouveau compte
--
--  À l'inscription, l'utilisateur doit trouver l'app déjà structurée :
--  les 8 catégories de dépenses du classeur, des sources de revenus types,
--  une allocation cible de départ, et la checklist de l'optimisateur
--  pré-remplie (§8, phase 3 point 8 : « checklist pré-remplie »).
--
--  Sans cela, le premier écran est un formulaire de création de catégories —
--  exactement la friction que l'app est censée supprimer.
-- =====================================================================

create or replace function public.seed_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id) values (new.id);

  -- Les 8 catégories de la feuille « Dépenses ». Les clés pilotent les
  -- couleurs du camembert et ne doivent pas être renommées (le libellé, si).
  insert into public.expense_categories (user_id, key, label, position) values
    (new.id, 'logement',   'Logement',   1),
    (new.id, 'nourriture', 'Nourriture', 2),
    (new.id, 'transport',  'Transport',  3),
    (new.id, 'sorties',    'Sorties',    4),
    (new.id, 'services',   'Services',   5),
    (new.id, 'achats',     'Achats',     6),
    (new.id, 'impots',     'Impôts',     7),
    (new.id, 'divers',     'Divers',     8);

  -- Blocs « Actif » et « Passif » de la feuille « Revenus ».
  insert into public.income_sources (user_id, name, kind, is_investment, position) values
    (new.id, 'Salaire',      'actif',  false, 1),
    (new.id, 'Activité 2',   'actif',  false, 2),
    (new.id, 'Loyer perçu',  'passif', false, 3),
    (new.id, 'Dividendes',   'passif', true,  4);

  -- Allocation cible de départ, à ajuster dans l'écran Portefeuille.
  insert into public.investment_targets (user_id, asset_class, target_percent, position) values
    (new.id, 'actions',     50, 1),
    (new.id, 'obligations', 20, 2),
    (new.id, 'immobilier',  20, 3),
    (new.id, 'liquide',      5, 4),
    (new.id, 'crypto',       5, 5);

  -- Un compte « Liquide » pour que la première saisie de solde ait une cible.
  insert into public.accounts (user_id, name, kind, position) values
    (new.id, 'Liquide',        'liquide', 1),
    (new.id, 'Compte courant', 'compte',  2);

  -- Checklist de l'optimisateur : les montants restent à 0, l'utilisateur
  -- renseigne sa dépense actuelle et la dépense visée action par action.
  insert into public.savings_actions (user_id, category, label, position)
  select new.id, category, label, row_number() over ()
  from (values
    ('Communautaire', 'Partager un abonnement streaming'),
    ('Communautaire', 'Covoiturage pour le trajet quotidien'),
    ('Communautaire', 'Achats groupés au marché de gros'),
    ('Communautaire', 'Mutualiser un outil ou un véhicule'),
    ('Dettes',        'Renégocier le taux d''un crédit'),
    ('Dettes',        'Regrouper les petits crédits'),
    ('Dettes',        'Rembourser par anticipation'),
    ('Dettes',        'Supprimer les découverts payants'),
    ('Énergie',       'Passer tout l''éclairage en LED'),
    ('Énergie',       'Régler la climatisation à 26 °C'),
    ('Énergie',       'Débrancher les appareils en veille'),
    ('Énergie',       'Isoler ou ombrager les pièces exposées'),
    ('Divertissement','Résilier une chaîne ou un abonnement payant'),
    ('Divertissement','Emprunter plutôt qu''acheter'),
    ('Divertissement','Limiter les sorties payantes par semaine'),
    ('Nourriture',    'Préparer les repas du midi'),
    ('Nourriture',    'Faire les courses avec une liste stricte'),
    ('Nourriture',    'Marché plutôt que supermarché'),
    ('Nourriture',    'Réduire les livraisons à domicile'),
    ('Maison',        'Renégocier le loyer ou les charges'),
    ('Maison',        'Entretien préventif plutôt que réparation'),
    ('Maison',        'Récupération d''eau'),
    ('Assurance',     'Comparer l''assurance auto'),
    ('Assurance',     'Augmenter la franchise'),
    ('Assurance',     'Supprimer les garanties en doublon'),
    ('Assurance',     'Regrouper les contrats chez un assureur'),
    ('Personnel',     'Espacer les rendez-vous coiffeur'),
    ('Personnel',     'Passer la salle de sport en formule annuelle'),
    ('Personnel',     'Fixer un budget vêtements trimestriel'),
    ('Transport',     'Entretenir à l''heure pour éviter la casse'),
    ('Transport',     'Adopter une conduite souple (carburant)'),
    ('Transport',     'Transport en commun plusieurs jours par semaine'),
    ('Transport',     'Regrouper les trajets'),
    ('Services',      'Passer à un forfait mobile moins cher'),
    ('Services',      'Renégocier l''abonnement internet'),
    ('Services',      'Résilier les abonnements dormants'),
    ('Services',      'Changer d''offre bancaire (frais)'),
    ('Services',      'Descendre d''un palier de stockage cloud')
  ) as actions(category, label);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_new_user();
