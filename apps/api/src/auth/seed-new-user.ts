/**
 * Amorçage d'un nouveau compte.
 *
 * Transposition du trigger Postgres `seed_new_user()` de la version Supabase.
 * Ici c'est du code applicatif : il n'y a plus de trigger sur `auth.users`
 * puisque l'API gère elle-même l'inscription.
 *
 * Sans cet amorçage, le premier écran de l'utilisateur est un formulaire de
 * création de catégories — exactement la friction que l'application est censée
 * supprimer par rapport aux classeurs Excel.
 */

import type { PrismaService } from "../prisma/prisma.service";

/** Les 8 catégories de la feuille « Dépenses ». Les clés pilotent les couleurs. */
const EXPENSE_CATEGORIES = [
  { key: "logement", label: "Logement" },
  { key: "nourriture", label: "Nourriture" },
  { key: "transport", label: "Transport" },
  { key: "sorties", label: "Sorties" },
  { key: "services", label: "Services" },
  { key: "achats", label: "Achats" },
  { key: "impots", label: "Impôts" },
  { key: "divers", label: "Divers" },
] as const;

/** Blocs « Actif » et « Passif » de la feuille « Revenus ». */
const INCOME_SOURCES = [
  { name: "Salaire", kind: "actif", isInvestment: false },
  { name: "Activité 2", kind: "actif", isInvestment: false },
  { name: "Loyer perçu", kind: "passif", isInvestment: false },
  { name: "Dividendes", kind: "passif", isInvestment: true },
] as const;

/** Allocation cible de départ, à ajuster dans l'écran Portefeuille. */
const TARGETS = [
  { assetClass: "actions", targetPercent: 50 },
  { assetClass: "obligations", targetPercent: 20 },
  { assetClass: "immobilier", targetPercent: 20 },
  { assetClass: "liquide", targetPercent: 5 },
  { assetClass: "crypto", targetPercent: 5 },
] as const;

/** Deux comptes, pour que la première saisie de solde ait une cible. */
const ACCOUNTS = [
  { name: "Liquide", kind: "liquide" },
  { name: "Compte courant", kind: "compte" },
] as const;

/**
 * Checklist de l'optimisateur — les ~38 actions du classeur, réparties sur les
 * 9 catégories d'origine. Les montants restent à 0 : l'utilisateur renseigne sa
 * dépense actuelle et la dépense visée, action par action.
 */
const SAVINGS_ACTIONS: readonly (readonly [string, string])[] = [
  ["Communautaire", "Partager un abonnement streaming"],
  ["Communautaire", "Covoiturage pour le trajet quotidien"],
  ["Communautaire", "Achats groupés au marché de gros"],
  ["Communautaire", "Mutualiser un outil ou un véhicule"],
  ["Dettes", "Renégocier le taux d'un crédit"],
  ["Dettes", "Regrouper les petits crédits"],
  ["Dettes", "Rembourser par anticipation"],
  ["Dettes", "Supprimer les découverts payants"],
  ["Énergie", "Passer tout l'éclairage en LED"],
  ["Énergie", "Régler la climatisation à 26 °C"],
  ["Énergie", "Débrancher les appareils en veille"],
  ["Énergie", "Isoler ou ombrager les pièces exposées"],
  ["Divertissement", "Résilier une chaîne ou un abonnement payant"],
  ["Divertissement", "Emprunter plutôt qu'acheter"],
  ["Divertissement", "Limiter les sorties payantes par semaine"],
  ["Nourriture", "Préparer les repas du midi"],
  ["Nourriture", "Faire les courses avec une liste stricte"],
  ["Nourriture", "Marché plutôt que supermarché"],
  ["Nourriture", "Réduire les livraisons à domicile"],
  ["Maison", "Renégocier le loyer ou les charges"],
  ["Maison", "Entretien préventif plutôt que réparation"],
  ["Maison", "Récupération d'eau"],
  ["Assurance", "Comparer l'assurance auto"],
  ["Assurance", "Augmenter la franchise"],
  ["Assurance", "Supprimer les garanties en doublon"],
  ["Assurance", "Regrouper les contrats chez un assureur"],
  ["Personnel", "Espacer les rendez-vous coiffeur"],
  ["Personnel", "Passer la salle de sport en formule annuelle"],
  ["Personnel", "Fixer un budget vêtements trimestriel"],
  ["Transport", "Entretenir à l'heure pour éviter la casse"],
  ["Transport", "Adopter une conduite souple (carburant)"],
  ["Transport", "Transport en commun plusieurs jours par semaine"],
  ["Transport", "Regrouper les trajets"],
  ["Services", "Passer à un forfait mobile moins cher"],
  ["Services", "Renégocier l'abonnement internet"],
  ["Services", "Résilier les abonnements dormants"],
  ["Services", "Changer d'offre bancaire (frais)"],
  ["Services", "Descendre d'un palier de stockage cloud"],
];

/**
 * Crée le jeu de départ d'un compte.
 *
 * Le tout dans **une transaction** : un compte à moitié amorçé (des catégories
 * mais pas de sources de revenus, par exemple) laisserait l'utilisateur devant
 * des écrans incohérents, sans moyen simple de réparer.
 */
export async function seedNewUser(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.settings.create({ data: { userId } }),

    prisma.expenseCategory.createMany({
      data: EXPENSE_CATEGORIES.map((category, index) => ({
        userId,
        key: category.key,
        label: category.label,
        position: index + 1,
      })),
    }),

    prisma.incomeSource.createMany({
      data: INCOME_SOURCES.map((source, index) => ({
        userId,
        name: source.name,
        kind: source.kind,
        isInvestment: source.isInvestment,
        position: index + 1,
      })),
    }),

    prisma.investmentTarget.createMany({
      data: TARGETS.map((target, index) => ({
        userId,
        assetClass: target.assetClass,
        targetPercent: target.targetPercent,
        position: index + 1,
      })),
    }),

    prisma.account.createMany({
      data: ACCOUNTS.map((account, index) => ({
        userId,
        name: account.name,
        kind: account.kind,
        position: index + 1,
      })),
    }),

    prisma.savingsAction.createMany({
      data: SAVINGS_ACTIONS.map(([category, label], index) => ({
        userId,
        category,
        label,
        position: index + 1,
      })),
    }),
  ]);
}
