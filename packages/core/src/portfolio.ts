/**
 * Portefeuille d'investissement — §5.3 du cahier des charges.
 *
 * L'écran affiche deux camemberts côte à côte, « Portfolio Idéal » et
 * « Portfolio Actuel ». Ce module produit les deux **à partir du même ensemble
 * de classes d'actif**, sinon les tranches ne se correspondent pas visuellement
 * d'un camembert à l'autre et la comparaison ne veut plus rien dire.
 */

import { sum } from "./money";
import { carryForward, fillMonths } from "./period";
import { toSlices } from "./wealth";
import type {
  AssetClassKey,
  InvestmentSnapshot,
  MonthKey,
  SeriesPoint,
  Slice,
  TargetAllocation,
} from "./types";

export type AllocationDrift = {
  assetClass: AssetClassKey;
  /** Montant réellement détenu. */
  amount: number;
  /** Part réelle, en points de pourcentage. */
  actualPercent: number;
  /** Part visée, en points de pourcentage. */
  targetPercent: number;
  /** `actualPercent − targetPercent`. Positif = surpondéré. */
  driftPoints: number;
  /** Montant à acheter (positif) ou vendre (négatif) pour revenir à la cible. */
  rebalanceAmount: number;
  /** La dérive dépasse le seuil configuré. */
  alert: boolean;
};

export type PortfolioAnalysis = {
  total: number;
  drifts: AllocationDrift[];
  /** Camembert « Portfolio Actuel ». */
  actualSlices: Slice[];
  /** Camembert « Portfolio Idéal ». */
  targetSlices: Slice[];
  /** Dérive absolue la plus forte, en points. */
  maxDriftPoints: number;
  /** Au moins une classe d'actif dépasse le seuil. */
  needsRebalance: boolean;
};

/**
 * Compare l'allocation réelle du dernier relevé à l'allocation cible.
 *
 * `threshold` est exprimé en **points de pourcentage** (5 = ±5 pts), comme dans
 * le cahier des charges — et non en pourcentage relatif de la cible.
 */
export function analysePortfolio(
  snapshots: readonly InvestmentSnapshot[],
  targets: readonly TargetAllocation[],
  threshold: number,
  month?: MonthKey,
): PortfolioAnalysis {
  const reference = month ?? latestMonth(snapshots);
  const current = reference
    ? snapshots.filter((s) => s.month === reference)
    : [];

  const amounts = new Map<AssetClassKey, number>();
  for (const snapshot of current) {
    amounts.set(snapshot.assetClass, (amounts.get(snapshot.assetClass) ?? 0) + snapshot.amount);
  }
  const targetsByClass = new Map(targets.map((t) => [t.assetClass, t.targetPercent]));

  // Union des deux ensembles : une classe visée mais pas encore détenue doit
  // apparaître avec une dérive négative, sinon l'utilisateur ne la voit jamais.
  const classes = [...new Set([...amounts.keys(), ...targetsByClass.keys()])];
  const total = sum([...amounts.values()]);

  const drifts: AllocationDrift[] = classes.map((assetClass) => {
    const amount = amounts.get(assetClass) ?? 0;
    const actualPercent = total === 0 ? 0 : (amount / total) * 100;
    const targetPercent = targetsByClass.get(assetClass) ?? 0;
    const driftPoints = actualPercent - targetPercent;
    return {
      assetClass,
      amount,
      actualPercent,
      targetPercent,
      driftPoints,
      rebalanceAmount: Math.round((targetPercent / 100) * total) - amount,
      alert: Math.abs(driftPoints) > threshold,
    };
  });

  drifts.sort((a, b) => Math.abs(b.driftPoints) - Math.abs(a.driftPoints));

  return {
    total,
    drifts,
    actualSlices: toSlices(
      drifts.map((d) => ({ key: d.assetClass, label: labelFor(d.assetClass), value: d.amount })),
    ),
    targetSlices: toSlices(
      drifts.map((d) => ({
        key: d.assetClass,
        label: labelFor(d.assetClass),
        value: d.targetPercent,
      })),
    ),
    maxDriftPoints: drifts.length === 0 ? 0 : Math.abs(drifts[0]!.driftPoints),
    needsRebalance: drifts.some((d) => d.alert),
  };
}

/** Valeur totale du portefeuille mois par mois — alimente la courbe d'évolution. */
export function portfolioSeries(snapshots: readonly InvestmentSnapshot[]): SeriesPoint[] {
  const buckets = new Map<MonthKey, number>();
  for (const s of snapshots) {
    buckets.set(s.month, (buckets.get(s.month) ?? 0) + s.amount);
  }
  const raw = [...buckets]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return fillMonths(raw, carryForward);
}

/** Série d'une seule classe d'actif — utilisée au tap sur une tranche du camembert. */
export function assetClassSeries(
  snapshots: readonly InvestmentSnapshot[],
  assetClass: AssetClassKey,
): SeriesPoint[] {
  const raw = snapshots
    .filter((s) => s.assetClass === assetClass)
    .map((s) => ({ month: s.month, value: s.amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return fillMonths(raw, carryForward);
}

/**
 * Vérifie que les cibles totalisent 100 points.
 * Renvoie l'écart : l'écran affiche « il vous reste 15 points à répartir »
 * plutôt que de refuser l'enregistrement.
 */
export function targetGap(targets: readonly TargetAllocation[]): number {
  return 100 - sum(targets.map((t) => t.targetPercent));
}

function latestMonth(snapshots: readonly InvestmentSnapshot[]): MonthKey | null {
  let best: MonthKey | null = null;
  for (const s of snapshots) if (!best || s.month > best) best = s.month;
  return best;
}

const LABELS: Record<string, string> = {
  liquide: "Liquide",
  actions: "Actions",
  obligations: "Obligations",
  immobilier: "Immobilier",
  crypto: "Crypto",
  autres: "Autres",
};

/** Libellé lisible d'une classe d'actif ; les clés personnalisées restent telles quelles. */
export function labelFor(assetClass: AssetClassKey): string {
  return LABELS[assetClass] ?? assetClass;
}
