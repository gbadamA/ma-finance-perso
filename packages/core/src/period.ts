/**
 * Manipulation des périodes mensuelles.
 *
 * Tout le domaine raisonne en `MonthKey` (« 2026-08 ») plutôt qu'en `Date` :
 * les classeurs source sont mensuels, et une chaîne triable évite les pièges de
 * fuseau horaire qui décalaient une saisie du 1er du mois vers le mois précédent.
 */

import type { MonthKey, SeriesPoint } from "./types";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_RE.test(value);
}

/** Construit une `MonthKey` à partir d'une date ISO ou d'un objet Date. */
export function toMonthKey(date: string | Date): MonthKey {
  if (typeof date === "string") {
    // On lit les composants textuellement : `new Date("2026-08-01")` est
    // interprété en UTC et bascule au mois précédent dans les fuseaux négatifs.
    const match = /^(\d{4})-(\d{2})/.exec(date);
    if (match) return `${match[1]}-${match[2]}`;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Décale une `MonthKey` de `delta` mois (négatif pour reculer). */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = splitMonth(month);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const index = ((total % 12) + 12) % 12;
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

/** Nombre de mois entre deux `MonthKey` (positif si `to` est postérieur). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = splitMonth(from);
  const [ty, tm] = splitMonth(to);
  return (ty - fy) * 12 + (tm - fm);
}

function splitMonth(month: MonthKey): [number, number] {
  const parts = month.split("-");
  return [Number(parts[0]), Number(parts[1])];
}

/** Toutes les `MonthKey` de `from` à `to` inclus, sans trou. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const count = monthsBetween(from, to);
  if (count < 0) return [];
  const out: MonthKey[] = [];
  for (let i = 0; i <= count; i += 1) out.push(addMonths(from, i));
  return out;
}

const MONTH_LABELS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** « 2026-08 » → « août 2026 ». */
export function formatMonth(month: MonthKey, withYear = true): string {
  const [y, m] = splitMonth(month);
  const label = MONTH_LABELS[m - 1] ?? month;
  return withYear ? `${label} ${y}` : label;
}

/** Étiquette courte pour un axe de graphique : « août » ou « 08/26 » si serré. */
export function formatMonthAxis(month: MonthKey, compact = false): string {
  const [y, m] = splitMonth(month);
  if (compact) return `${String(m).padStart(2, "0")}/${String(y).slice(2)}`;
  return MONTH_LABELS[m - 1] ?? month;
}

/* ------------------------------------------------------------------ *
 * Sélecteur de période
 * ------------------------------------------------------------------ */

/**
 * Les périodes proposées par le sélecteur unique qui remplace les 20 bar charts
 * dupliqués du classeur Excel (§3.3 du cahier des charges).
 */
export type PeriodPreset = "3m" | "6m" | "12m" | "24m" | "ytd" | "all";

export const PERIOD_PRESETS: Array<{ key: PeriodPreset; label: string }> = [
  { key: "3m", label: "3 mois" },
  { key: "6m", label: "6 mois" },
  { key: "12m", label: "1 an" },
  { key: "24m", label: "2 ans" },
  { key: "ytd", label: "Année en cours" },
  { key: "all", label: "Tout" },
];

/**
 * Borne basse d'une période, relative au mois de référence.
 * Renvoie `null` pour « all » : l'appelant garde alors toute sa série.
 */
export function periodStart(preset: PeriodPreset, reference: MonthKey): MonthKey | null {
  switch (preset) {
    case "3m":
      return addMonths(reference, -2);
    case "6m":
      return addMonths(reference, -5);
    case "12m":
      return addMonths(reference, -11);
    case "24m":
      return addMonths(reference, -23);
    case "ytd":
      return `${splitMonth(reference)[0]}-01`;
    case "all":
      return null;
  }
}

/** Filtre une série sur une période. La série doit être triée par mois croissant. */
export function filterPeriod<T extends { month: MonthKey }>(
  series: readonly T[],
  preset: PeriodPreset,
  reference?: MonthKey,
): T[] {
  if (series.length === 0) return [];
  const ref = reference ?? series[series.length - 1]!.month;
  const start = periodStart(preset, ref);
  if (start === null) return [...series];
  return series.filter((p) => p.month >= start && p.month <= ref);
}

/**
 * Complète les mois manquants d'une série avec une valeur donnée.
 * Sans cela un graphique d'aires relie deux points distants de six mois par une
 * droite, ce qui laisse croire à une évolution régulière qui n'a pas été mesurée.
 */
export function fillMonths(
  series: readonly SeriesPoint[],
  fill: (month: MonthKey, previous: SeriesPoint | null) => number,
): SeriesPoint[] {
  if (series.length === 0) return [];
  const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month));
  const months = monthRange(sorted[0]!.month, sorted[sorted.length - 1]!.month);
  const byMonth = new Map(sorted.map((p) => [p.month, p]));
  const out: SeriesPoint[] = [];
  let previous: SeriesPoint | null = null;
  for (const month of months) {
    const existing = byMonth.get(month);
    // Annotation explicite : `point` alimente `previous`, qui alimente `fill`,
    // qui produit `point` — TypeScript ne sait pas inferer ce cycle.
    const point: SeriesPoint = existing ?? { month, value: fill(month, previous) };
    out.push(point);
    previous = point;
  }
  return out;
}

/** Report du dernier solde connu — le comportement attendu pour un solde de compte. */
export const carryForward = (_month: MonthKey, previous: SeriesPoint | null): number =>
  previous?.value ?? 0;

/** Zéro sur les mois sans donnée — le comportement attendu pour un flux (revenu, dépense). */
export const zeroFill = (): number => 0;
