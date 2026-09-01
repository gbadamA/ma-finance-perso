/**
 * Patrimoine, comptes et biens de valeur.
 * Réplique les §5.1 (santé financière) et §5.4 (assets) du cahier des charges.
 */

import { average, percentChange, sum } from "./money";
import { carryForward, fillMonths, toMonthKey } from "./period";
import type {
  Account,
  AccountSnapshot,
  Asset,
  ExpenseEntry,
  IncomeEntry,
  IncomeSource,
  MonthKey,
  SeriesPoint,
  Slice,
} from "./types";

/* ------------------------------------------------------------------ *
 * Assets — §5.4
 * ------------------------------------------------------------------ */

export type AssetMetrics = {
  /** Valeur actuelle − dette associée. */
  netEquity: number;
  /** Valeur actuelle − prix d'achat − coût de maintien cumulé. */
  profitLoss: number;
};

export function assetMetrics(asset: Asset): AssetMetrics {
  return {
    netEquity: asset.currentValue - asset.debt,
    profitLoss: asset.currentValue - asset.purchasePrice - asset.maintenanceCost,
  };
}

/** Somme des `netEquity` — le « Total Equity » de la feuille Assets. */
export function totalEquity(assets: readonly Asset[]): number {
  return sum(assets.map((a) => assetMetrics(a).netEquity));
}

/** Répartition des biens par catégorie — alimente le pie « Allocation d'Asset ». */
export function assetAllocation(assets: readonly Asset[]): Slice[] {
  const byCategory = new Map<string, number>();
  for (const asset of assets) {
    const equity = assetMetrics(asset).netEquity;
    byCategory.set(asset.category, (byCategory.get(asset.category) ?? 0) + equity);
  }
  return toSlices([...byCategory].map(([key, value]) => ({ key, label: key, value })));
}

/* ------------------------------------------------------------------ *
 * Fortune totale — §5.1
 * ------------------------------------------------------------------ */

/**
 * `Fortune totale = Σ(Comptes) + Σ(Valeur des Assets) − Σ(Dette des Assets)`.
 *
 * Les deux derniers termes se réduisent au `totalEquity` : on garde la
 * décomposition dans le type de retour parce que la vue d'ensemble affiche
 * séparément « liquide », « comptes » et « biens ».
 */
export type WealthBreakdown = {
  accountsTotal: number;
  assetsValue: number;
  assetsDebt: number;
  total: number;
};

export function wealthAt(
  accounts: readonly Account[],
  snapshots: readonly AccountSnapshot[],
  assets: readonly Asset[],
  month: MonthKey,
): WealthBreakdown {
  const accountsTotal = sum(
    accounts
      .filter((a) => !a.archived)
      .map((a) => latestBalance(snapshots, a.id, month)),
  );
  const assetsValue = sum(assets.map((a) => a.currentValue));
  const assetsDebt = sum(assets.map((a) => a.debt));
  return {
    accountsTotal,
    assetsValue,
    assetsDebt,
    total: accountsTotal + assetsValue - assetsDebt,
  };
}

/**
 * Dernier solde connu d'un compte **à ou avant** le mois demandé.
 * Un compte non ressaisi ce mois-ci n'est pas un compte à zéro — c'est un compte
 * dont on connaît encore le dernier solde. Le classeur Excel faisait la même chose
 * en tirant la valeur vers le bas.
 */
export function latestBalance(
  snapshots: readonly AccountSnapshot[],
  accountId: string,
  month: MonthKey,
): number {
  let best: AccountSnapshot | null = null;
  for (const s of snapshots) {
    if (s.accountId !== accountId || s.month > month) continue;
    if (!best || s.month > best.month) best = s;
  }
  return best?.balance ?? 0;
}

/**
 * Série d'évolution de la fortune — alimente l'area chart « Fortune ».
 * Les mois sans relevé reprennent le dernier solde connu (cf. `latestBalance`).
 */
export function wealthSeries(
  accounts: readonly Account[],
  snapshots: readonly AccountSnapshot[],
  assets: readonly Asset[],
): SeriesPoint[] {
  const months = [...new Set(snapshots.map((s) => s.month))].sort();
  if (months.length === 0) return [];
  const raw = months.map((month) => ({
    month,
    value: wealthAt(accounts, snapshots, assets, month).total,
  }));
  return fillMonths(raw, carryForward);
}

/** Allocation de la fortune sur un mois — pie « Allocation de Fortune ». */
export function wealthAllocation(
  accounts: readonly Account[],
  snapshots: readonly AccountSnapshot[],
  assets: readonly Asset[],
  month: MonthKey,
): Slice[] {
  const entries = accounts
    .filter((a) => !a.archived)
    .map((a) => ({
      key: a.id,
      label: a.name,
      value: latestBalance(snapshots, a.id, month),
    }));
  const equity = totalEquity(assets);
  if (equity !== 0) entries.push({ key: "assets", label: "Biens de valeur", value: equity });
  return toSlices(entries);
}

/** Série de la réserve de cash — area « Réserve de Cash ». */
export function cashSeries(
  accounts: readonly Account[],
  snapshots: readonly AccountSnapshot[],
): SeriesPoint[] {
  const liquid = new Set(
    accounts.filter((a) => !a.archived && (a.kind === "liquide" || a.kind === "compte")).map((a) => a.id),
  );
  const months = [...new Set(snapshots.map((s) => s.month))].sort();
  const raw = months.map((month) => ({
    month,
    value: sum([...liquid].map((id) => latestBalance(snapshots, id, month))),
  }));
  return fillMonths(raw, carryForward);
}

/* ------------------------------------------------------------------ *
 * Revenus & dépenses agrégés — §5.1
 * ------------------------------------------------------------------ */

export type MonthlyIncome = {
  month: MonthKey;
  passive: number;
  active: number;
  /** Revenus d'investissement, sous-ensemble de `passive`. */
  investment: number;
  total: number;
  /** Total hors investissement — la colonne « Revenus (sans invest) » du classeur. */
  totalExcludingInvestment: number;
};

export function incomeByMonth(
  sources: readonly IncomeSource[],
  entries: readonly IncomeEntry[],
): MonthlyIncome[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const buckets = new Map<MonthKey, MonthlyIncome>();

  for (const entry of entries) {
    const source = byId.get(entry.sourceId);
    if (!source) continue; // source supprimée : l'entrée n'est plus classable
    const bucket =
      buckets.get(entry.month) ??
      { month: entry.month, passive: 0, active: 0, investment: 0, total: 0, totalExcludingInvestment: 0 };
    if (source.kind === "passif") bucket.passive += entry.amount;
    else bucket.active += entry.amount;
    if (source.isInvestment) bucket.investment += entry.amount;
    bucket.total += entry.amount;
    buckets.set(entry.month, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.totalExcludingInvestment = bucket.total - bucket.investment;
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Total des dépenses par mois — les dépenses étant saisies au jour le jour. */
export function expensesByMonth(entries: readonly ExpenseEntry[]): SeriesPoint[] {
  const buckets = new Map<MonthKey, number>();
  for (const entry of entries) {
    const month = toMonthKey(entry.date);
    buckets.set(month, (buckets.get(month) ?? 0) + entry.amount);
  }
  return [...buckets]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/* ------------------------------------------------------------------ *
 * Santé financière — §5.1
 * ------------------------------------------------------------------ */

export type FinancialHealth = {
  /** Moyenne mobile des revenus sur la fenêtre configurée. */
  averageIncome: number;
  averageExpense: number;
  /** `Revenu moyen / Dépense moyenne`. `null` si la dépense moyenne est nulle. */
  incomeExpenseRatio: number | null;
  /** Épargne mensuelle moyenne. */
  averageSavings: number;
  /** Taux d'épargne, en points de pourcentage. */
  savingsRatePercent: number | null;
  /** `Fortune totale / Dépenses annuelles moyennes` — en années de couverture. */
  runwayYears: number | null;
};

export function financialHealth(
  income: readonly MonthlyIncome[],
  expenses: readonly SeriesPoint[],
  totalWealth: number,
  windowMonths: number,
): FinancialHealth {
  const averageIncome = average(lastN(income, windowMonths).map((m) => m.total));
  const averageExpense = average(lastN(expenses, windowMonths).map((p) => p.value));
  const annualExpense = averageExpense * 12;
  const averageSavings = averageIncome - averageExpense;

  return {
    averageIncome,
    averageExpense,
    incomeExpenseRatio: averageExpense === 0 ? null : averageIncome / averageExpense,
    averageSavings,
    savingsRatePercent: averageIncome === 0 ? null : (averageSavings / averageIncome) * 100,
    runwayYears: annualExpense === 0 ? null : totalWealth / annualExpense,
  };
}

/**
 * Les deux parts du pie « Ratio Revenus / Dépenses ».
 * C'est bien un camembert à deux tranches dans le classeur : il compare
 * visuellement les deux moyennes, il ne représente pas une répartition.
 */
export function incomeExpenseSlices(averageIncome: number, averageExpense: number): Slice[] {
  return toSlices([
    { key: "revenus", label: "Revenus", value: averageIncome },
    { key: "depenses", label: "Dépenses", value: averageExpense },
  ]);
}

/** Variation de la fortune entre les deux derniers points d'une série. */
export function lastChange(series: readonly SeriesPoint[]): {
  absolute: number;
  percent: number | null;
} {
  if (series.length < 2) return { absolute: 0, percent: null };
  const previous = series[series.length - 2]!.value;
  const current = series[series.length - 1]!.value;
  return { absolute: current - previous, percent: percentChange(previous, current) };
}

/* ------------------------------------------------------------------ *
 * Helpers partagés
 * ------------------------------------------------------------------ */

export function lastN<T>(series: readonly T[], n: number): T[] {
  if (n <= 0) return [];
  return series.slice(Math.max(0, series.length - n));
}

/**
 * Transforme des entrées brutes en parts de camembert triées, en écartant les
 * valeurs nulles ou négatives : une tranche négative n'a pas de représentation
 * possible sur un disque, et un zéro produit une tranche invisible mais présente
 * dans la légende.
 */
export function toSlices(
  entries: readonly { key: string; label: string; value: number }[],
): Slice[] {
  const positives = entries.filter((e) => e.value > 0);
  const total = sum(positives.map((e) => e.value));
  if (total === 0) return [];
  return positives
    .map((e) => ({ ...e, percent: (e.value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}
