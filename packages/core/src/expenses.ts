/**
 * Dépenses — répartition par catégorie et moyennes de période.
 *
 * Le classeur portait **deux camemberts identiques** « Répartition des dépenses
 * (moyenne) ». Ici il n'y en a qu'un, paramétré par la période sélectionnée
 * (§3.3 du cahier des charges).
 */

import { average, sum } from "./money";
import { toMonthKey } from "./period";
import { toSlices } from "./wealth";
import type { ExpenseCategory, ExpenseEntry, MonthKey, SeriesPoint, Slice } from "./types";

export type CategoryTotal = {
  categoryId: string;
  key: string;
  label: string;
  /** Total dépensé sur la période. */
  total: number;
  /** Moyenne mensuelle sur la période. */
  monthlyAverage: number;
  /** Part du total de la période, en points de pourcentage. */
  percent: number;
  /** Nombre de dépenses saisies. */
  count: number;
};

/**
 * Totaux et moyennes par catégorie sur un ensemble de dépenses.
 *
 * ⚠️ La moyenne mensuelle divise par le **nombre de mois couverts par la
 * période**, pas par le nombre de mois où la catégorie apparaît : une catégorie
 * dépensée un mois sur six a une moyenne mensuelle faible, ce qui est le
 * comportement voulu — sinon « Impôts » paraîtrait aussi lourd que « Nourriture ».
 */
export function categoryTotals(
  entries: readonly ExpenseEntry[],
  categories: readonly ExpenseCategory[],
): CategoryTotal[] {
  const monthsCovered = new Set(entries.map((e) => toMonthKey(e.date))).size || 1;
  const byCategory = new Map<string, { total: number; count: number }>();

  for (const entry of entries) {
    const bucket = byCategory.get(entry.categoryId) ?? { total: 0, count: 0 };
    bucket.total += entry.amount;
    bucket.count += 1;
    byCategory.set(entry.categoryId, bucket);
  }

  const grandTotal = sum([...byCategory.values()].map((b) => b.total));
  const labels = new Map(categories.map((c) => [c.id, c]));

  return [...byCategory]
    .map(([categoryId, bucket]) => {
      const category = labels.get(categoryId);
      return {
        categoryId,
        key: category?.key ?? categoryId,
        label: category?.label ?? "Sans catégorie",
        total: bucket.total,
        monthlyAverage: Math.round(bucket.total / monthsCovered),
        percent: grandTotal === 0 ? 0 : (bucket.total / grandTotal) * 100,
        count: bucket.count,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Parts du camembert « Répartition des dépenses ». */
export function expenseSlices(totals: readonly CategoryTotal[]): Slice[] {
  return toSlices(totals.map((t) => ({ key: t.key, label: t.label, value: t.total })));
}

/** Série mensuelle d'une seule catégorie — affichée au tap sur une tranche. */
export function categorySeries(
  entries: readonly ExpenseEntry[],
  categoryId: string,
): SeriesPoint[] {
  const buckets = new Map<MonthKey, number>();
  for (const entry of entries) {
    if (entry.categoryId !== categoryId) continue;
    const month = toMonthKey(entry.date);
    buckets.set(month, (buckets.get(month) ?? 0) + entry.amount);
  }
  return [...buckets]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Compare la moyenne mensuelle d'une catégorie sur la période courante à celle
 * de la période précédente de même longueur. C'est ce qui permet d'afficher
 * « Transport : +18 % ce mois-ci » sans que l'utilisateur ait à comparer lui-même.
 */
export type CategoryTrend = {
  key: string;
  label: string;
  current: number;
  previous: number;
  changePercent: number | null;
};

export function categoryTrends(
  current: readonly CategoryTotal[],
  previous: readonly CategoryTotal[],
): CategoryTrend[] {
  const previousByKey = new Map(previous.map((t) => [t.key, t.monthlyAverage]));
  return current.map((t) => {
    const before = previousByKey.get(t.key) ?? 0;
    return {
      key: t.key,
      label: t.label,
      current: t.monthlyAverage,
      previous: before,
      changePercent: before === 0 ? null : ((t.monthlyAverage - before) / before) * 100,
    };
  });
}

/** Dépense moyenne par mois, toutes catégories confondues. */
export function averageMonthlyExpense(series: readonly SeriesPoint[]): number {
  return average(series.map((p) => p.value));
}
