/**
 * Optimisateur de dépenses — §5.5 du cahier des charges.
 * Checklist d'actions d'économie, sans graphique : deux totaux et une progression.
 */

import { sum } from "./money";
import type { SavingsAction } from "./types";

export type SavingsSummary = {
  /** Économie mensuelle si toutes les actions réalisables étaient appliquées. */
  potentialMonthly: number;
  /** Économie mensuelle effectivement acquise (actions marquées « réalisé »). */
  achievedMonthly: number;
  /** Ce qu'il reste à aller chercher. */
  remainingMonthly: number;
  /** Équivalent annuel de l'économie acquise — le chiffre qui motive. */
  achievedYearly: number;
  /** Nombre d'actions réalisables / réalisées. */
  feasibleCount: number;
  doneCount: number;
  /** Progression 0-100, en points. */
  progressPercent: number;
};

/**
 * `Économie mensuelle = Dépense initiale − Nouvelle dépense`.
 *
 * Une action non réalisable est ignorée des deux totaux : elle ne représente pas
 * un potentiel que l'utilisateur pourrait aller chercher. Une économie négative
 * (la nouvelle dépense coûte plus cher) est comptée telle quelle — c'est une
 * information utile, pas une erreur de saisie à masquer.
 */
export function actionSaving(action: SavingsAction): number {
  return action.initialExpense - action.newExpense;
}

export function summariseSavings(actions: readonly SavingsAction[]): SavingsSummary {
  const feasible = actions.filter((a) => a.feasible);
  const done = feasible.filter((a) => a.done);

  const potentialMonthly = sum(feasible.map(actionSaving));
  const achievedMonthly = sum(done.map(actionSaving));

  return {
    potentialMonthly,
    achievedMonthly,
    remainingMonthly: potentialMonthly - achievedMonthly,
    achievedYearly: achievedMonthly * 12,
    feasibleCount: feasible.length,
    doneCount: done.length,
    progressPercent: feasible.length === 0 ? 0 : (done.length / feasible.length) * 100,
  };
}

export type SavingsGroup = {
  category: string;
  actions: SavingsAction[];
  potentialMonthly: number;
  achievedMonthly: number;
  doneCount: number;
};

/** Regroupe la checklist par catégorie — l'ordre des catégories est celui du classeur. */
export function groupSavings(actions: readonly SavingsAction[]): SavingsGroup[] {
  const groups = new Map<string, SavingsAction[]>();
  for (const action of actions) {
    const list = groups.get(action.category) ?? [];
    list.push(action);
    groups.set(action.category, list);
  }
  return [...groups].map(([category, list]) => {
    const feasible = list.filter((a) => a.feasible);
    return {
      category,
      actions: list,
      potentialMonthly: sum(feasible.map(actionSaving)),
      achievedMonthly: sum(feasible.filter((a) => a.done).map(actionSaving)),
      doneCount: feasible.filter((a) => a.done).length,
    };
  });
}

/**
 * Combien d'années l'économie acquise fait-elle gagner sur un objectif de fortune ?
 * Approximation volontairement simple (pas de capitalisation) : elle sert à
 * répondre « ces 45 000 F par mois, ça change quoi ? », pas à remplacer la
 * projection FIRE qui, elle, capitalise.
 */
export function yearsSavedOn(target: number, monthlySaving: number): number | null {
  if (monthlySaving <= 0) return null;
  return target / (monthlySaving * 12);
}
