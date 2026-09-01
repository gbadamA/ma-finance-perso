/**
 * Module FIRE — Indépendance Financière.
 * Réplique le §5.2 du cahier des charges (classeur « Calculateur d'Indépendance Financière »).
 *
 * ⚠️ Fidélité au classeur : la capitalisation utilise `retour_annuel / 12` et non
 * `(1 + retour_annuel)^(1/12) - 1`. C'est mathématiquement moins exact (cela
 * surestime légèrement le rendement composé), mais c'est **exactement** ce que
 * fait la feuille Excel que l'application remplace. Changer la formule ferait
 * diverger l'app des chiffres que l'utilisateur connaît. Ne pas « corriger ».
 */

import type { FinancialGoal, GoalHorizon, GoalKind } from "./types";

export type FireInput = {
  /** Montant déjà investi, entier d'unité mineure. */
  initialInvested: number;
  /** Apport investi chaque mois. */
  monthlyInvestment: number;
  /** Rendement annuel attendu, en points (7 pour 7 %). */
  expectedReturn: number;
  /** Taux de retrait sûr annuel, en points (4 pour 4 %). */
  safeWithdrawalRate: number;
  /** Inflation annuelle, en points. */
  inflationRate: number;
  /** Date de naissance ISO, pour calculer l'âge à chaque checkpoint. */
  birthDate: string | null;
  /** Durée de la projection, en mois. Défaut : 480 (40 ans, comme le classeur). */
  horizonMonths?: number;
  /** Date de départ de la projection. Défaut : aujourd'hui. */
  startDate?: Date;
};

export type FirePoint = {
  /** Rang du mois depuis le départ (0 = aujourd'hui). */
  monthIndex: number;
  /** Date ISO du mois projeté. */
  date: string;
  /** Âge de l'utilisateur à cette date, `null` si la date de naissance manque. */
  age: number | null;
  /** Valeur nette cumulée du portefeuille. */
  netWorth: number;
  /** Revenu passif mensuel que ce capital permettrait de retirer. */
  passiveIncome: number;
  /** Le même revenu, exprimé en pouvoir d'achat d'aujourd'hui. */
  passiveIncomeReal: number;
};

export type GoalCheckpoint = {
  goalId: string;
  kind: GoalKind;
  horizon: GoalHorizon;
  label: string;
  targetAmount: number;
  /** `null` si l'objectif n'est pas atteint dans l'horizon projeté. */
  reachedAt: {
    monthIndex: number;
    date: string;
    age: number | null;
    /** Mois restants avant d'y être. */
    monthsRemaining: number;
    /** Valeur du portefeuille au moment du franchissement. */
    netWorth: number;
  } | null;
};

export type FireProjection = {
  points: FirePoint[];
  checkpoints: GoalCheckpoint[];
  /** Valeur au départ — sert de point de référence sur le graphique. */
  currentNetWorth: number;
  /** Valeur au terme de l'horizon. */
  finalNetWorth: number;
};

const DEFAULT_HORIZON_MONTHS = 480; // 40 ans, comme la feuille Excel

/**
 * Calcule la projection mensuelle complète.
 *
 * Pure et synchrone : c'est ce qui permet aux curseurs du simulateur de
 * recalculer la courbe à chaque mouvement du doigt sans passer par le réseau.
 */
export function projectFire(input: FireInput): FireProjection {
  const horizon = input.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const start = input.startDate ?? new Date();
  const monthlyReturn = input.expectedReturn / 100 / 12;
  const monthlyWithdrawal = input.safeWithdrawalRate / 100 / 12;
  const inflation = input.inflationRate / 100;

  const points: FirePoint[] = [];
  let value = input.initialInvested;

  for (let i = 0; i <= horizon; i += 1) {
    if (i > 0) {
      value = value * (1 + monthlyReturn) + input.monthlyInvestment;
    }
    const date = addMonthsToDate(start, i);
    const years = i / 12;
    const passiveIncome = value * monthlyWithdrawal;
    points.push({
      monthIndex: i,
      date: toIsoDay(date),
      age: ageAt(input.birthDate, date),
      netWorth: Math.round(value),
      passiveIncome: Math.round(passiveIncome),
      passiveIncomeReal: Math.round(passiveIncome / (1 + inflation) ** years),
    });
  }

  return {
    points,
    checkpoints: [],
    currentNetWorth: points[0]!.netWorth,
    finalNetWorth: points[points.length - 1]!.netWorth,
  };
}

/**
 * Date, âge et temps restant du premier mois où chaque objectif est franchi.
 *
 * Un objectif « fortune » se compare à la valeur nette ; un objectif
 * « revenu passif » se compare au revenu passif **ajusté de l'inflation** —
 * viser 500 000 F de rente dans 25 ans sans corriger l'inflation reviendrait à
 * viser bien moins que 500 000 F d'aujourd'hui.
 */
export function resolveCheckpoints(
  points: readonly FirePoint[],
  goals: readonly FinancialGoal[],
): GoalCheckpoint[] {
  return goals.map((goal) => {
    const hit = points.find((p) =>
      goal.kind === "fortune"
        ? p.netWorth >= goal.targetAmount
        : p.passiveIncomeReal >= goal.targetAmount,
    );
    return {
      goalId: goal.id,
      kind: goal.kind,
      horizon: goal.horizon,
      label: goal.label,
      targetAmount: goal.targetAmount,
      reachedAt: hit
        ? {
            monthIndex: hit.monthIndex,
            date: hit.date,
            age: hit.age,
            monthsRemaining: hit.monthIndex,
            netWorth: hit.netWorth,
          }
        : null,
    };
  });
}

/** Projection + checkpoints en un appel — ce que consomme l'écran FIRE. */
export function projectFireWithGoals(
  input: FireInput,
  goals: readonly FinancialGoal[],
): FireProjection {
  const projection = projectFire(input);
  return { ...projection, checkpoints: resolveCheckpoints(projection.points, goals) };
}

/**
 * Sous-échantillonne la projection pour l'affichage.
 * 481 points sur une courbe de 350 px de large, c'est 1,4 point par pixel : on
 * paie le coût de rendu sans qu'aucun de ces points ne soit visible.
 */
export function sampleForChart(points: readonly FirePoint[], maxPoints = 120): FirePoint[] {
  if (points.length <= maxPoints) return [...points];
  const step = Math.ceil(points.length / maxPoints);
  const out: FirePoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]!);
  // Le dernier point porte la valeur finale : il ne doit jamais sauter.
  const last = points[points.length - 1]!;
  if (out[out.length - 1]!.monthIndex !== last.monthIndex) out.push(last);
  return out;
}

/** Règle des 25 : capital nécessaire pour servir une rente mensuelle donnée. */
export function capitalNeededFor(
  monthlyIncome: number,
  safeWithdrawalRate: number,
): number {
  if (safeWithdrawalRate <= 0) return Number.POSITIVE_INFINITY;
  return Math.round((monthlyIncome * 12) / (safeWithdrawalRate / 100));
}

/* ------------------------------------------------------------------ *
 * Utilitaires de date
 * ------------------------------------------------------------------ */

/** Date locale au format ISO court, sans passer par UTC (qui décalerait d'un jour). */
function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonthsToDate(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // Ramener au même jour du mois quand il existe (31 janvier + 1 mois = 28 ou 29 février).
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, daysInTarget));
  return d;
}

/** Âge révolu à une date donnée. `null` si la date de naissance est absente. */
export function ageAt(birthDate: string | null, at: Date): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  let age = at.getFullYear() - birth.getFullYear();
  const monthDiff = at.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birth.getDate())) age -= 1;
  return age;
}
