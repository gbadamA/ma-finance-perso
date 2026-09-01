/**
 * Planificateur d'héritage — §5.6 du cahier des charges.
 * Projection à très long terme (0 à 500 ans) et « horloge de vie ».
 */

import { ageAt } from "./fire";

export type InheritanceInput = {
  /** Patrimoine actuel, entier d'unité mineure. */
  currentWealth: number;
  /** Rendement annuel, en points. */
  annualReturn: number;
  birthDate: string | null;
  /** Espérance de vie totale, en années. */
  lifeExpectancy: number;
  /** Date de référence. Défaut : aujourd'hui. */
  now?: Date;
};

export type HorizonPoint = {
  /** Horizon en années depuis aujourd'hui. */
  years: number;
  /** Année civile correspondante. */
  calendarYear: number;
  /** Âge qu'aurait l'utilisateur, `null` si la date de naissance manque. */
  age: number | null;
  /** Patrimoine projeté. */
  wealth: number;
  /**
   * `true` dès que l'horizon dépasse l'espérance de vie restante : le montant
   * n'est plus « ce que j'aurai », c'est « ce que je transmets ».
   */
  isInheritance: boolean;
};

/** Horizons du classeur — une échelle logarithmique, pas un pas régulier. */
export const DEFAULT_HORIZONS = [0, 1, 2, 5, 10, 20, 30, 40, 50, 75, 100, 200, 500] as const;

/**
 * `Patrimoine(horizon) = Patrimoine_actuel × (1 + rendement)^horizon`.
 *
 * ⚠️ À 500 ans et 7 %, le résultat dépasse allègrement `Number.MAX_SAFE_INTEGER`.
 * On ne tronque pas : le classeur affiche lui aussi des nombres absurdes à ces
 * horizons, c'est l'illustration du poids des intérêts composés. L'écran, lui,
 * affiche ces montants en notation abrégée.
 */
export function projectInheritance(
  input: InheritanceInput,
  horizons: readonly number[] = DEFAULT_HORIZONS,
): HorizonPoint[] {
  const now = input.now ?? new Date();
  const rate = input.annualReturn / 100;
  const currentAge = ageAt(input.birthDate, now);
  const yearsRemaining =
    currentAge === null ? null : Math.max(0, input.lifeExpectancy - currentAge);

  return horizons.map((years) => ({
    years,
    calendarYear: now.getFullYear() + years,
    age: currentAge === null ? null : currentAge + years,
    wealth: input.currentWealth * (1 + rate) ** years,
    isInheritance: yearsRemaining !== null && years > yearsRemaining,
  }));
}

export type LifeClock = {
  currentAge: number;
  lifeExpectancy: number;
  /** Part de vie déjà vécue, en points de pourcentage (bornée à 100). */
  livedPercent: number;
  /** Part restante, en points. */
  remainingPercent: number;
  yearsRemaining: number;
  /** Mois restants — plus parlant que les années quand il en reste peu. */
  monthsRemaining: number;
};

/**
 * `% de vie vécue = (Âge actuel / Espérance de vie totale) × 100`.
 * Alimente le donut « Horloge de vie ». `null` sans date de naissance : on
 * n'invente pas un âge par défaut pour remplir un graphique.
 */
export function lifeClock(
  birthDate: string | null,
  lifeExpectancy: number,
  now: Date = new Date(),
): LifeClock | null {
  const currentAge = ageAt(birthDate, now);
  if (currentAge === null || lifeExpectancy <= 0) return null;

  const livedPercent = Math.min(100, (currentAge / lifeExpectancy) * 100);
  const yearsRemaining = Math.max(0, lifeExpectancy - currentAge);

  return {
    currentAge,
    lifeExpectancy,
    livedPercent,
    remainingPercent: 100 - livedPercent,
    yearsRemaining,
    monthsRemaining: Math.round(yearsRemaining * 12),
  };
}

/** Patrimoine projeté à l'âge cible du planificateur. */
export function wealthAtTargetAge(
  input: InheritanceInput,
  targetAge: number,
): { years: number; wealth: number } | null {
  const currentAge = ageAt(input.birthDate, input.now ?? new Date());
  if (currentAge === null) return null;
  const years = Math.max(0, targetAge - currentAge);
  return {
    years,
    wealth: input.currentWealth * (1 + input.annualReturn / 100) ** years,
  };
}
