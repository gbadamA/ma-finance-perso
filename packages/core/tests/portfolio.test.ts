import { describe, expect, it } from "vitest";
import { analysePortfolio, portfolioSeries, targetGap } from "../src/portfolio";
import type { InvestmentSnapshot, TargetAllocation } from "../src/types";

const targets: TargetAllocation[] = [
  { assetClass: "actions", targetPercent: 60 },
  { assetClass: "obligations", targetPercent: 40 },
];

const snapshots: InvestmentSnapshot[] = [
  { assetClass: "actions", month: "2026-01", amount: 600_000 },
  { assetClass: "obligations", month: "2026-01", amount: 400_000 },
  { assetClass: "actions", month: "2026-02", amount: 700_000 },
  { assetClass: "obligations", month: "2026-02", amount: 300_000 },
];

describe("analysePortfolio", () => {
  it("utilise le dernier releve quand aucun mois n'est precise", () => {
    const a = analysePortfolio(snapshots, targets, 5);
    expect(a.total).toBe(1_000_000);
    const actions = a.drifts.find((d) => d.assetClass === "actions")!;
    expect(actions.actualPercent).toBe(70);
  });

  it("calcule la derive en POINTS de pourcentage, pas en relatif", () => {
    const a = analysePortfolio(snapshots, targets, 5);
    expect(a.drifts.find((d) => d.assetClass === "actions")!.driftPoints).toBe(10);
    expect(a.drifts.find((d) => d.assetClass === "obligations")!.driftPoints).toBe(-10);
  });

  it("alerte au-dela du seuil et se tait en dessous", () => {
    expect(analysePortfolio(snapshots, targets, 5).needsRebalance).toBe(true);
    expect(analysePortfolio(snapshots, targets, 15).needsRebalance).toBe(false);
  });

  it("chiffre le montant a acheter ou vendre pour revenir a la cible", () => {
    const a = analysePortfolio(snapshots, targets, 5);
    expect(a.drifts.find((d) => d.assetClass === "actions")!.rebalanceAmount).toBe(-100_000);
    expect(a.drifts.find((d) => d.assetClass === "obligations")!.rebalanceAmount).toBe(100_000);
  });

  it("montre une classe visee mais pas encore detenue", () => {
    const withCrypto = [...targets, { assetClass: "crypto", targetPercent: 10 }];
    const a = analysePortfolio(snapshots, withCrypto, 5);
    const crypto = a.drifts.find((d) => d.assetClass === "crypto")!;
    expect(crypto.amount).toBe(0);
    expect(crypto.driftPoints).toBe(-10);
  });

  it("produit deux camemberts couvrant les MEMES classes, pour etre comparables", () => {
    const a = analysePortfolio(snapshots, targets, 5);
    expect(a.actualSlices.map((s) => s.key).sort()).toEqual(
      a.targetSlices.map((s) => s.key).sort(),
    );
  });

  it("trie les derives par amplitude decroissante", () => {
    const a = analysePortfolio(snapshots, [...targets, { assetClass: "crypto", targetPercent: 30 }], 5);
    const amplitudes = a.drifts.map((d) => Math.abs(d.driftPoints));
    expect([...amplitudes].sort((x, y) => y - x)).toEqual(amplitudes);
  });

  it("ne divise pas par zero sur un portefeuille vide", () => {
    const a = analysePortfolio([], targets, 5);
    expect(a.total).toBe(0);
    expect(a.drifts.every((d) => d.actualPercent === 0)).toBe(true);
  });

  it("respecte le mois demande plutot que le dernier", () => {
    const a = analysePortfolio(snapshots, targets, 5, "2026-01");
    expect(a.needsRebalance).toBe(false);
  });
});

describe("portfolioSeries", () => {
  it("somme toutes les classes par mois", () => {
    expect(portfolioSeries(snapshots)).toEqual([
      { month: "2026-01", value: 1_000_000 },
      { month: "2026-02", value: 1_000_000 },
    ]);
  });
});

describe("targetGap", () => {
  it("indique combien de points restent a repartir", () => {
    expect(targetGap(targets)).toBe(0);
    expect(targetGap([{ assetClass: "actions", targetPercent: 85 }])).toBe(15);
  });
});
