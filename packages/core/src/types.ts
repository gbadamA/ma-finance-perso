/**
 * Types du domaine — miroir du §4 du cahier des charges.
 *
 * Ces types décrivent la donnée **telle que le moteur de calcul la consomme**,
 * pas telle que Postgres la stocke : pas de `user_id` ici, l'isolation est un
 * problème de base de données (RLS), pas d'arithmétique.
 */

import type { CurrencyCode } from "./money";

/** Date de série mensuelle, normalisée au 1er du mois : « 2026-08 ». */
export type MonthKey = string;

/* ------------------------------------------------------------------ *
 * Comptes & patrimoine
 * ------------------------------------------------------------------ */

export type AccountKind = "liquide" | "compte" | "epargne" | "investissement";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  currency: CurrencyCode;
  archived: boolean;
};

/** Solde d'un compte à la fin d'un mois donné (feuille « Allocation de Fortune »). */
export type AccountSnapshot = {
  accountId: string;
  month: MonthKey;
  /** Entier d'unité mineure. */
  balance: number;
};

/* ------------------------------------------------------------------ *
 * Revenus
 * ------------------------------------------------------------------ */

export type IncomeKind = "passif" | "actif";

export type IncomeSource = {
  id: string;
  name: string;
  kind: IncomeKind;
  /** Un revenu d'investissement est passif mais exclu du « Revenu hors investissement ». */
  isInvestment: boolean;
};

export type IncomeEntry = {
  id: string;
  sourceId: string;
  month: MonthKey;
  amount: number;
};

/* ------------------------------------------------------------------ *
 * Dépenses
 * ------------------------------------------------------------------ */

/** Les 8 catégories du classeur. La liste est extensible côté base. */
export type ExpenseCategoryKey =
  | "logement"
  | "nourriture"
  | "transport"
  | "sorties"
  | "divers"
  | "services"
  | "achats"
  | "impots"
  | (string & {});

export type ExpenseCategory = {
  id: string;
  key: ExpenseCategoryKey;
  label: string;
};

export type ExpenseEntry = {
  id: string;
  categoryId: string;
  /** Date ISO complète : les dépenses se saisissent au jour le jour. */
  date: string;
  amount: number;
  note?: string | null;
  receiptPath?: string | null;
};

/* ------------------------------------------------------------------ *
 * Assets (biens de valeur)
 * ------------------------------------------------------------------ */

export type Asset = {
  id: string;
  category: string;
  name: string;
  purchaseDate: string | null;
  /** Prix d'achat, entier d'unité mineure. */
  purchasePrice: number;
  /** Dette restant adossée au bien (crédit auto, hypothèque). */
  debt: number;
  /** Coût de maintien cumulé depuis l'achat (entretien, assurance). */
  maintenanceCost: number;
  /** Dernière valeur estimée. */
  currentValue: number;
  /** Score d'état 0-100, purement informatif. */
  conditionScore?: number | null;
};

export type AssetValuation = {
  assetId: string;
  date: string;
  value: number;
};

/* ------------------------------------------------------------------ *
 * Portefeuille d'investissement
 * ------------------------------------------------------------------ */

export type AssetClassKey =
  | "liquide"
  | "actions"
  | "obligations"
  | "immobilier"
  | "crypto"
  | "autres"
  | (string & {});

/** Allocation **cible** par classe d'actif — le « Portfolio Idéal » du classeur. */
export type TargetAllocation = {
  assetClass: AssetClassKey;
  /** Part visée, en points de pourcentage (0-100). */
  targetPercent: number;
};

/** Montant **réel** détenu par classe d'actif à une date de relevé. */
export type InvestmentSnapshot = {
  assetClass: AssetClassKey;
  month: MonthKey;
  amount: number;
};

/* ------------------------------------------------------------------ *
 * Objectifs, économies, paramètres
 * ------------------------------------------------------------------ */

export type GoalKind = "fortune" | "revenu_passif";
export type GoalHorizon = "court" | "moyen" | "long" | "minimum" | "ideal";

export type FinancialGoal = {
  id: string;
  kind: GoalKind;
  horizon: GoalHorizon;
  label: string;
  targetAmount: number;
};

export type SavingsAction = {
  id: string;
  category: string;
  label: string;
  /** L'utilisateur a jugé l'action applicable à sa situation. */
  feasible: boolean;
  initialExpense: number;
  newExpense: number;
  /** L'action a effectivement été mise en oeuvre. */
  done: boolean;
};

export type UserSettings = {
  currency: CurrencyCode;
  birthDate: string | null;
  /** Taux de retrait sûr annuel, en points (ex. 4 pour 4 %). */
  safeWithdrawalRate: number;
  /** Hypothèse d'inflation annuelle, en points. */
  inflationRate: number;
  /** Rendement annuel attendu du portefeuille, en points. */
  expectedReturn: number;
  /** Apport mensuel investi. */
  monthlyInvestment: number;
  /** Fenêtre des moyennes mobiles (revenu moyen / dépense moyenne), en mois. */
  averageWindowMonths: number;
  /** Seuil de dérive du portefeuille déclenchant une alerte, en points. */
  driftThreshold: number;
  /** Espérance de vie utilisée par l'horloge de vie. */
  lifeExpectancy: number;
  /** Âge cible du planificateur d'héritage. */
  inheritanceTargetAge: number;
};

export const DEFAULT_SETTINGS: UserSettings = {
  currency: "XOF",
  birthDate: null,
  safeWithdrawalRate: 4,
  inflationRate: 3,
  expectedReturn: 7,
  monthlyInvestment: 0,
  averageWindowMonths: 6,
  driftThreshold: 5,
  lifeExpectancy: 80,
  inheritanceTargetAge: 90,
};

/* ------------------------------------------------------------------ *
 * Formes de sortie communes aux graphiques
 * ------------------------------------------------------------------ */

/** Une part de camembert (allocation de fortune, dépenses, portefeuille). */
export type Slice = {
  key: string;
  label: string;
  value: number;
  /** Part du total, en points de pourcentage. */
  percent: number;
};

/** Un point de série temporelle (area fortune, area cash, bar revenus). */
export type SeriesPoint = {
  month: MonthKey;
  value: number;
};
