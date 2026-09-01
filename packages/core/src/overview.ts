/**
 * Vue d'ensemble — assemble en un seul calcul les 7 visualisations de la feuille
 * « Dashboard Financier » (§2 module 1 du cahier des charges).
 *
 * L'écran appelle `buildOverview()` une fois et distribue le résultat à ses
 * graphiques. Sans cela, chaque carte recalculerait la fortune de son côté et
 * deux cartes voisines finiraient par afficher des totaux différents.
 */

import { expenseSlices, categoryTotals } from "./expenses";
import { analysePortfolio } from "./portfolio";
import { filterPeriod, type PeriodPreset } from "./period";
import {
  cashSeries,
  expensesByMonth,
  financialHealth,
  incomeByMonth,
  incomeExpenseSlices,
  lastChange,
  lastN,
  wealthAllocation,
  wealthAt,
  wealthSeries,
  type FinancialHealth,
  type MonthlyIncome,
} from "./wealth";
import type { DemoDataset } from "./demo";
import type {
  Account,
  AccountSnapshot,
  Asset,
  ExpenseCategory,
  ExpenseEntry,
  IncomeEntry,
  IncomeSource,
  InvestmentSnapshot,
  MonthKey,
  SeriesPoint,
  Slice,
  TargetAllocation,
  UserSettings,
} from "./types";

export type OverviewInput = {
  settings: UserSettings;
  accounts: readonly Account[];
  accountSnapshots: readonly AccountSnapshot[];
  incomeSources: readonly IncomeSource[];
  incomeEntries: readonly IncomeEntry[];
  expenseCategories: readonly ExpenseCategory[];
  expenseEntries: readonly ExpenseEntry[];
  assets: readonly Asset[];
  targets: readonly TargetAllocation[];
  investmentSnapshots: readonly InvestmentSnapshot[];
  /** Période du sélecteur unique qui remplace les 20 graphiques dupliqués. */
  period: PeriodPreset;
};

export type Overview = {
  /** Mois le plus récent pour lequel on a une donnée, `null` si l'app est vide. */
  referenceMonth: MonthKey | null;
  /** Fortune totale et sa décomposition. */
  totalWealth: number;
  accountsTotal: number;
  assetsEquity: number;
  /** Variation depuis le mois précédent. */
  wealthChange: { absolute: number; percent: number | null };

  /** Pie « Allocation de Fortune ». */
  allocationSlices: Slice[];
  /** Area « Fortune » sur la période. */
  wealthSeries: SeriesPoint[];
  /** Bar « Revenus (hors investissement) » sur la période. */
  incomeSeries: MonthlyIncome[];
  /** Area « Réserve de Cash » sur la période. */
  cashSeries: SeriesPoint[];
  /** Série des dépenses mensuelles sur la période. */
  expenseSeries: SeriesPoint[];
  /** Pie « Répartition des dépenses (moyenne) ». */
  expenseSlices: Slice[];
  /** Pie « Portfolio d'Investissements » (allocation réelle). */
  portfolioSlices: Slice[];
  /** Pie « Ratio Revenus / Dépenses ». */
  incomeExpenseSlices: Slice[];

  /** Carte KPI « Investissements ». */
  investmentsKpi: {
    total: number;
    /** Variation par rapport au relevé précédent. */
    changePercent: number | null;
    /** Le portefeuille s'écarte de la cible au-delà du seuil. */
    needsRebalance: boolean;
    maxDriftPoints: number;
  };

  health: FinancialHealth;
  /** `true` tant qu'aucune donnée n'a été saisie — l'écran affiche alors l'onboarding. */
  isEmpty: boolean;
};

export function buildOverview(input: OverviewInput): Overview {
  const {
    settings,
    accounts,
    accountSnapshots,
    incomeSources,
    incomeEntries,
    expenseCategories,
    expenseEntries,
    assets,
    targets,
    investmentSnapshots,
    period,
  } = input;

  const fullWealth = wealthSeries(accounts, accountSnapshots, assets);
  const referenceMonth = fullWealth.at(-1)?.month ?? null;

  const isEmpty =
    accountSnapshots.length === 0 &&
    incomeEntries.length === 0 &&
    expenseEntries.length === 0 &&
    assets.length === 0;

  const breakdown = referenceMonth
    ? wealthAt(accounts, accountSnapshots, assets, referenceMonth)
    : { accountsTotal: 0, assetsValue: 0, assetsDebt: 0, total: 0 };

  const fullIncome = incomeByMonth(incomeSources, incomeEntries);
  const fullExpenses = expensesByMonth(expenseEntries);
  const fullCash = cashSeries(accounts, accountSnapshots);

  // Les dépenses sont saisies au jour le jour : on filtre la série mensuelle
  // pour connaître les mois retenus, puis on ne garde que les saisies de ces mois.
  const periodExpenseSeries = filterPeriod(fullExpenses, period, referenceMonth ?? undefined);
  const retainedMonths = new Set(periodExpenseSeries.map((p) => p.month));
  const periodExpenseEntries = expenseEntries.filter((e) =>
    retainedMonths.has(e.date.slice(0, 7)),
  );

  const health = financialHealth(
    fullIncome,
    fullExpenses,
    breakdown.total,
    settings.averageWindowMonths,
  );

  const portfolio = analysePortfolio(
    investmentSnapshots,
    targets,
    settings.driftThreshold,
    referenceMonth ?? undefined,
  );

  return {
    referenceMonth,
    totalWealth: breakdown.total,
    accountsTotal: breakdown.accountsTotal,
    assetsEquity: breakdown.assetsValue - breakdown.assetsDebt,
    wealthChange: lastChange(fullWealth),

    allocationSlices: referenceMonth
      ? wealthAllocation(accounts, accountSnapshots, assets, referenceMonth)
      : [],
    wealthSeries: filterPeriod(fullWealth, period, referenceMonth ?? undefined),
    incomeSeries: filterPeriod(fullIncome, period, referenceMonth ?? undefined),
    cashSeries: filterPeriod(fullCash, period, referenceMonth ?? undefined),
    expenseSeries: periodExpenseSeries,
    expenseSlices: expenseSlices(categoryTotals(periodExpenseEntries, expenseCategories)),
    portfolioSlices: portfolio.actualSlices,
    incomeExpenseSlices: incomeExpenseSlices(health.averageIncome, health.averageExpense),

    investmentsKpi: {
      total: portfolio.total,
      changePercent: investmentChange(investmentSnapshots),
      needsRebalance: portfolio.needsRebalance,
      maxDriftPoints: portfolio.maxDriftPoints,
    },

    health,
    isEmpty,
  };
}

/** Variation du portefeuille entre les deux derniers relevés mensuels. */
function investmentChange(snapshots: readonly InvestmentSnapshot[]): number | null {
  const months = [...new Set(snapshots.map((s) => s.month))].sort();
  const [previousMonth, lastMonth] = lastN(months, 2);
  if (!previousMonth || !lastMonth) return null;
  const totalFor = (month: MonthKey) =>
    snapshots.filter((s) => s.month === month).reduce((acc, s) => acc + s.amount, 0);
  const before = totalFor(previousMonth);
  if (before === 0) return null;
  return ((totalFor(lastMonth) - before) / before) * 100;
}

/** Construit la vue d'ensemble depuis le jeu de démonstration. */
export function overviewFromDemo(dataset: DemoDataset, period: PeriodPreset = "12m"): Overview {
  return buildOverview({ ...dataset, period });
}
