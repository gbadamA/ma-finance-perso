/**
 * Jeu de données de démonstration — livrable §9.4 du cahier des charges,
 * calqué sur `Demo_Dashboard_Financier.xlsm`.
 *
 * Sert à deux choses : peupler l'app pour les tests visuels sans base de données,
 * et donner aux tests unitaires un scénario réaliste plutôt que des cas à trois lignes.
 * Montants en francs CFA entiers (XOF n'a pas de subdivision).
 */

import { addMonths, toMonthKey } from "./period";
import type {
  Account,
  Asset,
  ExpenseCategory,
  ExpenseEntry,
  FinancialGoal,
  IncomeEntry,
  IncomeSource,
  InvestmentSnapshot,
  AccountSnapshot,
  SavingsAction,
  TargetAllocation,
  UserSettings,
} from "./types";

/** Mois de référence du jeu de démo : les 24 derniers mois glissants. */
const MONTHS = 24;

function recentMonths(count = MONTHS): string[] {
  const end = toMonthKey(new Date());
  return Array.from({ length: count }, (_, i) => addMonths(end, i - count + 1));
}

/** Générateur pseudo-aléatoire déterministe : la démo doit être reproductible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export const demoAccounts: Account[] = [
  { id: "acc-cash", name: "Liquide", kind: "liquide", currency: "XOF", archived: false },
  { id: "acc-courant", name: "Compte courant", kind: "compte", currency: "XOF", archived: false },
  { id: "acc-epargne", name: "Épargne", kind: "epargne", currency: "XOF", archived: false },
  { id: "acc-titres", name: "Compte-titres", kind: "investissement", currency: "XOF", archived: false },
];

export const demoExpenseCategories: ExpenseCategory[] = [
  { id: "cat-logement", key: "logement", label: "Logement" },
  { id: "cat-nourriture", key: "nourriture", label: "Nourriture" },
  { id: "cat-transport", key: "transport", label: "Transport" },
  { id: "cat-sorties", key: "sorties", label: "Sorties" },
  { id: "cat-divers", key: "divers", label: "Divers" },
  { id: "cat-services", key: "services", label: "Services" },
  { id: "cat-achats", key: "achats", label: "Achats" },
  { id: "cat-impots", key: "impots", label: "Impôts" },
];

export const demoIncomeSources: IncomeSource[] = [
  { id: "src-salaire", name: "Salaire", kind: "actif", isInvestment: false },
  { id: "src-freelance", name: "Freelance", kind: "actif", isInvestment: false },
  { id: "src-loyer", name: "Loyer perçu", kind: "passif", isInvestment: false },
  { id: "src-dividendes", name: "Dividendes", kind: "passif", isInvestment: true },
];

export const demoTargets: TargetAllocation[] = [
  { assetClass: "actions", targetPercent: 50 },
  { assetClass: "obligations", targetPercent: 20 },
  { assetClass: "immobilier", targetPercent: 20 },
  { assetClass: "liquide", targetPercent: 5 },
  { assetClass: "crypto", targetPercent: 5 },
];

export const demoAssets: Asset[] = [
  {
    id: "ast-voiture",
    category: "Véhicule",
    name: "Toyota RAV4",
    purchaseDate: "2023-04-12",
    purchasePrice: 14_500_000,
    debt: 3_200_000,
    maintenanceCost: 850_000,
    currentValue: 11_800_000,
    conditionScore: 78,
  },
  {
    id: "ast-terrain",
    category: "Immobilier",
    name: "Terrain Bingerville",
    purchaseDate: "2021-09-01",
    purchasePrice: 9_000_000,
    debt: 0,
    maintenanceCost: 320_000,
    currentValue: 15_400_000,
    conditionScore: 95,
  },
  {
    id: "ast-moto",
    category: "Véhicule",
    name: "Moto de service",
    purchaseDate: "2024-11-20",
    purchasePrice: 1_250_000,
    debt: 0,
    maintenanceCost: 180_000,
    currentValue: 900_000,
    conditionScore: 62,
  },
  {
    id: "ast-materiel",
    category: "Équipement",
    name: "Matériel informatique",
    purchaseDate: "2025-02-10",
    purchasePrice: 2_400_000,
    debt: 0,
    maintenanceCost: 60_000,
    currentValue: 1_500_000,
    conditionScore: 70,
  },
];

export const demoGoals: FinancialGoal[] = [
  { id: "goal-court", kind: "fortune", horizon: "court", label: "Fortune court terme", targetAmount: 50_000_000 },
  { id: "goal-moyen", kind: "fortune", horizon: "moyen", label: "Fortune moyen terme", targetAmount: 150_000_000 },
  { id: "goal-long", kind: "fortune", horizon: "long", label: "Fortune long terme", targetAmount: 400_000_000 },
  { id: "goal-rente-min", kind: "revenu_passif", horizon: "minimum", label: "Rente minimum", targetAmount: 400_000 },
  { id: "goal-rente-ideale", kind: "revenu_passif", horizon: "ideal", label: "Rente idéale", targetAmount: 1_200_000 },
];

export const demoSettings: UserSettings = {
  currency: "XOF",
  birthDate: "1992-06-15",
  safeWithdrawalRate: 4,
  inflationRate: 3,
  expectedReturn: 8,
  monthlyInvestment: 350_000,
  averageWindowMonths: 6,
  driftThreshold: 5,
  lifeExpectancy: 80,
  inheritanceTargetAge: 90,
};

/* ------------------------------------------------------------------ *
 * Séries mensuelles générées
 * ------------------------------------------------------------------ */

/**
 * Soldes de comptes sur 24 mois : progression régulière + bruit saisonnier.
 * Le compte-titres croît plus vite que l'épargne, ce qui fait diverger
 * l'allocation réelle de l'allocation cible — c'est ce qui rend l'écran
 * Portefeuille et son alerte de dérive visibles dans la démo.
 */
export function demoAccountSnapshots(): AccountSnapshot[] {
  const rand = seeded(20260825);
  const months = recentMonths();
  const start: Record<string, number> = {
    "acc-cash": 180_000,
    "acc-courant": 1_250_000,
    "acc-epargne": 4_800_000,
    "acc-titres": 6_500_000,
  };
  const growth: Record<string, number> = {
    "acc-cash": 0.004,
    "acc-courant": 0.011,
    "acc-epargne": 0.018,
    "acc-titres": 0.031,
  };

  const out: AccountSnapshot[] = [];
  for (const account of demoAccounts) {
    let balance = start[account.id] ?? 0;
    for (const month of months) {
      balance = balance * (1 + (growth[account.id] ?? 0)) + (rand() - 0.45) * 120_000;
      out.push({ accountId: account.id, month, balance: Math.round(Math.max(0, balance)) });
    }
  }
  return out;
}

/** Revenus mensuels : salaire stable, freelance irrégulier, dividendes trimestriels. */
export function demoIncomeEntries(): IncomeEntry[] {
  const rand = seeded(777);
  const months = recentMonths();
  const out: IncomeEntry[] = [];

  months.forEach((month, index) => {
    out.push({ id: `inc-sal-${month}`, sourceId: "src-salaire", month, amount: 1_450_000 });
    if (rand() > 0.35) {
      out.push({
        id: `inc-free-${month}`,
        sourceId: "src-freelance",
        month,
        amount: Math.round(200_000 + rand() * 550_000),
      });
    }
    out.push({ id: `inc-loyer-${month}`, sourceId: "src-loyer", month, amount: 250_000 });
    // Dividendes versés une fois par trimestre.
    if (index % 3 === 2) {
      out.push({
        id: `inc-div-${month}`,
        sourceId: "src-dividendes",
        month,
        amount: Math.round(120_000 + rand() * 90_000),
      });
    }
  });
  return out;
}

/** Dépenses réparties sur les 8 catégories, avec un pic d'impôts annuel. */
export function demoExpenseEntries(): ExpenseEntry[] {
  const rand = seeded(4242);
  const months = recentMonths();
  const profile: Record<string, [number, number]> = {
    "cat-logement": [450_000, 0.04],
    "cat-nourriture": [285_000, 0.22],
    "cat-transport": [135_000, 0.3],
    "cat-sorties": [95_000, 0.55],
    "cat-divers": [70_000, 0.6],
    "cat-services": [88_000, 0.15],
    "cat-achats": [110_000, 0.7],
    "cat-impots": [0, 0],
  };

  const out: ExpenseEntry[] = [];
  for (const month of months) {
    for (const [categoryId, [base, variance]] of Object.entries(profile)) {
      if (categoryId === "cat-impots") {
        // Un seul versement d'impôts par an, en mars.
        if (month.endsWith("-03")) {
          out.push({
            id: `exp-impots-${month}`,
            categoryId,
            date: `${month}-15`,
            amount: 1_150_000,
            note: "Impôt sur le revenu",
          });
        }
        continue;
      }
      // Deux à quatre dépenses par catégorie et par mois, pour que la liste
      // ressemble à une vraie saisie quotidienne et pas à un total mensuel.
      const count = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i += 1) {
        const share = base / count;
        const day = String(1 + Math.floor(rand() * 27)).padStart(2, "0");
        out.push({
          id: `exp-${categoryId}-${month}-${i}`,
          categoryId,
          date: `${month}-${day}`,
          amount: Math.round(share * (1 + (rand() - 0.5) * variance)),
        });
      }
    }
  }
  return out;
}

/**
 * Relevés du portefeuille. Les actions montent plus vite que la cible de 50 %,
 * les obligations décrochent : la dérive dépasse le seuil de 5 points sur les
 * derniers mois, ce qui déclenche l'alerte de rééquilibrage dans la démo.
 */
export function demoInvestmentSnapshots(): InvestmentSnapshot[] {
  const rand = seeded(31415);
  const months = recentMonths();
  const start: Record<string, number> = {
    actions: 3_100_000,
    obligations: 1_450_000,
    immobilier: 1_400_000,
    liquide: 350_000,
    crypto: 200_000,
  };
  const growth: Record<string, number> = {
    actions: 0.038,
    obligations: 0.006,
    immobilier: 0.021,
    liquide: 0.002,
    crypto: 0.055,
  };

  const out: InvestmentSnapshot[] = [];
  for (const [assetClass, initial] of Object.entries(start)) {
    let amount = initial;
    for (const month of months) {
      amount = amount * (1 + (growth[assetClass] ?? 0) + (rand() - 0.5) * 0.02);
      out.push({ assetClass, month, amount: Math.round(Math.max(0, amount)) });
    }
  }
  return out;
}

/**
 * Checklist de l'optimisateur — les ~35 actions du classeur, réparties sur les
 * 9 catégories d'origine. Les montants sont des ordres de grandeur ivoiriens.
 */
export const demoSavingsActions: SavingsAction[] = [
  { id: "sv-1", category: "Communautaire", label: "Partager un abonnement streaming", feasible: true, initialExpense: 9_000, newExpense: 3_000, done: true },
  { id: "sv-2", category: "Communautaire", label: "Covoiturage bureau", feasible: true, initialExpense: 45_000, newExpense: 20_000, done: false },
  { id: "sv-3", category: "Communautaire", label: "Achats groupés au marché de gros", feasible: true, initialExpense: 120_000, newExpense: 95_000, done: false },
  { id: "sv-4", category: "Dettes", label: "Renégocier le taux du crédit auto", feasible: true, initialExpense: 185_000, newExpense: 162_000, done: false },
  { id: "sv-5", category: "Dettes", label: "Regrouper les petits crédits", feasible: false, initialExpense: 0, newExpense: 0, done: false },
  { id: "sv-6", category: "Dettes", label: "Rembourser par anticipation", feasible: true, initialExpense: 185_000, newExpense: 150_000, done: false },
  { id: "sv-7", category: "Énergie", label: "Ampoules LED partout", feasible: true, initialExpense: 38_000, newExpense: 27_000, done: true },
  { id: "sv-8", category: "Énergie", label: "Climatiseur à 26 °C", feasible: true, initialExpense: 62_000, newExpense: 44_000, done: true },
  { id: "sv-9", category: "Énergie", label: "Chauffe-eau solaire", feasible: false, initialExpense: 0, newExpense: 0, done: false },
  { id: "sv-10", category: "Énergie", label: "Débrancher les veilles", feasible: true, initialExpense: 12_000, newExpense: 8_000, done: false },
  { id: "sv-11", category: "Divertissement", label: "Résilier une chaîne payante", feasible: true, initialExpense: 15_000, newExpense: 0, done: true },
  { id: "sv-12", category: "Divertissement", label: "Bibliothèque au lieu d'acheter", feasible: true, initialExpense: 18_000, newExpense: 5_000, done: false },
  { id: "sv-13", category: "Divertissement", label: "Sorties : 1 par semaine max", feasible: true, initialExpense: 95_000, newExpense: 60_000, done: false },
  { id: "sv-14", category: "Nourriture", label: "Cuisiner le midi", feasible: true, initialExpense: 90_000, newExpense: 45_000, done: true },
  { id: "sv-15", category: "Nourriture", label: "Liste de courses stricte", feasible: true, initialExpense: 285_000, newExpense: 245_000, done: false },
  { id: "sv-16", category: "Nourriture", label: "Marché plutôt que supermarché", feasible: true, initialExpense: 150_000, newExpense: 118_000, done: true },
  { id: "sv-17", category: "Nourriture", label: "Réduire les livraisons", feasible: true, initialExpense: 55_000, newExpense: 20_000, done: false },
  { id: "sv-18", category: "Maison", label: "Renégocier le loyer", feasible: false, initialExpense: 0, newExpense: 0, done: false },
  { id: "sv-19", category: "Maison", label: "Entretien préventif plutôt que réparation", feasible: true, initialExpense: 40_000, newExpense: 25_000, done: false },
  { id: "sv-20", category: "Maison", label: "Récupération d'eau", feasible: true, initialExpense: 22_000, newExpense: 14_000, done: false },
  { id: "sv-21", category: "Assurance", label: "Comparer l'assurance auto", feasible: true, initialExpense: 48_000, newExpense: 36_000, done: true },
  { id: "sv-22", category: "Assurance", label: "Augmenter la franchise", feasible: true, initialExpense: 48_000, newExpense: 41_000, done: false },
  { id: "sv-23", category: "Assurance", label: "Supprimer les garanties en doublon", feasible: true, initialExpense: 30_000, newExpense: 18_000, done: false },
  { id: "sv-24", category: "Personnel", label: "Coiffeur toutes les 6 semaines", feasible: true, initialExpense: 24_000, newExpense: 16_000, done: false },
  { id: "sv-25", category: "Personnel", label: "Salle de sport : formule annuelle", feasible: true, initialExpense: 35_000, newExpense: 25_000, done: true },
  { id: "sv-26", category: "Personnel", label: "Vêtements : budget trimestriel", feasible: true, initialExpense: 65_000, newExpense: 40_000, done: false },
  { id: "sv-27", category: "Transport", label: "Entretien à l'heure pour éviter la casse", feasible: true, initialExpense: 45_000, newExpense: 32_000, done: false },
  { id: "sv-28", category: "Transport", label: "Conduite souple (carburant)", feasible: true, initialExpense: 85_000, newExpense: 72_000, done: true },
  { id: "sv-29", category: "Transport", label: "Transport en commun 2 jours par semaine", feasible: true, initialExpense: 85_000, newExpense: 58_000, done: false },
  { id: "sv-30", category: "Transport", label: "Regrouper les trajets", feasible: true, initialExpense: 30_000, newExpense: 22_000, done: false },
  { id: "sv-31", category: "Services", label: "Forfait mobile moins cher", feasible: true, initialExpense: 25_000, newExpense: 12_000, done: true },
  { id: "sv-32", category: "Services", label: "Internet : renégocier à l'échéance", feasible: true, initialExpense: 35_000, newExpense: 28_000, done: false },
  { id: "sv-33", category: "Services", label: "Résilier les abonnements dormants", feasible: true, initialExpense: 18_000, newExpense: 0, done: true },
  { id: "sv-34", category: "Services", label: "Frais bancaires : changer d'offre", feasible: true, initialExpense: 12_000, newExpense: 4_000, done: false },
  { id: "sv-35", category: "Services", label: "Cloud : palier inférieur", feasible: true, initialExpense: 8_000, newExpense: 3_000, done: false },
];

/** Jeu de démo complet, prêt à être injecté dans les écrans. */
export function demoDataset() {
  return {
    settings: demoSettings,
    accounts: demoAccounts,
    accountSnapshots: demoAccountSnapshots(),
    incomeSources: demoIncomeSources,
    incomeEntries: demoIncomeEntries(),
    expenseCategories: demoExpenseCategories,
    expenseEntries: demoExpenseEntries(),
    assets: demoAssets,
    targets: demoTargets,
    investmentSnapshots: demoInvestmentSnapshots(),
    goals: demoGoals,
    savingsActions: demoSavingsActions,
  };
}

export type DemoDataset = ReturnType<typeof demoDataset>;
