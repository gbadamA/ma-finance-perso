import { describe, expect, it } from "vitest";
import {
  ageAt,
  capitalNeededFor,
  projectFire,
  projectFireWithGoals,
  resolveCheckpoints,
  sampleForChart,
} from "../src/fire";
import type { FinancialGoal } from "../src/types";

const BASE = {
  initialInvested: 10_000_000,
  monthlyInvestment: 350_000,
  expectedReturn: 8,
  safeWithdrawalRate: 4,
  inflationRate: 3,
  birthDate: "1992-06-15",
  startDate: new Date(2026, 7, 1), // 1er août 2026, heure locale
};

describe("projectFire", () => {
  it("produit horizonMonths + 1 points, le premier étant la situation actuelle", () => {
    const p = projectFire({ ...BASE, horizonMonths: 12 });
    expect(p.points).toHaveLength(13);
    expect(p.points[0]!.monthIndex).toBe(0);
    expect(p.points[0]!.netWorth).toBe(BASE.initialInvested);
    expect(p.currentNetWorth).toBe(BASE.initialInvested);
  });

  it("applique la formule du classeur : V(t) = V(t-1) x (1 + r/12) + apport", () => {
    const p = projectFire({ ...BASE, horizonMonths: 2 });
    const monthly = 0.08 / 12;
    const m1 = 10_000_000 * (1 + monthly) + 350_000;
    const m2 = m1 * (1 + monthly) + 350_000;
    expect(p.points[1]!.netWorth).toBe(Math.round(m1));
    expect(p.points[2]!.netWorth).toBe(Math.round(m2));
  });

  it("derive le revenu passif du taux de retrait sur mensualise", () => {
    const p = projectFire({ ...BASE, horizonMonths: 0 });
    expect(p.points[0]!.passiveIncome).toBe(Math.round(10_000_000 * (0.04 / 12)));
  });

  it("ajuste le revenu passif de l'inflation, ce qui le rend inferieur au nominal", () => {
    const p = projectFire({ ...BASE, horizonMonths: 120 });
    const last = p.points[120]!;
    expect(last.passiveIncomeReal).toBeLessThan(last.passiveIncome);
    // 10 ans a 3 % : le pouvoir d'achat perd environ 26 %.
    // Tolerance a 5 decimales : les deux montants sont arrondis a l'entier
    // d'unite mineure, leur rapport ne peut donc pas etre exact au-dela.
    expect(last.passiveIncomeReal / last.passiveIncome).toBeCloseTo(1 / 1.03 ** 10, 5);
  });

  it("sans apport ni rendement, la valeur ne bouge pas", () => {
    const p = projectFire({
      ...BASE,
      monthlyInvestment: 0,
      expectedReturn: 0,
      horizonMonths: 60,
    });
    expect(p.finalNetWorth).toBe(BASE.initialInvested);
  });

  it("fait vieillir l'utilisateur au fil de la projection", () => {
    const p = projectFire({ ...BASE, horizonMonths: 240 });
    expect(p.points[0]!.age).toBe(34);
    expect(p.points[240]!.age).toBe(54);
  });

  it("laisse l'age a null quand la date de naissance manque", () => {
    const p = projectFire({ ...BASE, birthDate: null, horizonMonths: 1 });
    expect(p.points[0]!.age).toBeNull();
  });

  it("projette sur 40 ans par defaut, comme le classeur", () => {
    expect(projectFire(BASE).points).toHaveLength(481);
  });
});

describe("resolveCheckpoints", () => {
  const goals: FinancialGoal[] = [
    { id: "g1", kind: "fortune", horizon: "court", label: "Court", targetAmount: 15_000_000 },
    { id: "g2", kind: "fortune", horizon: "long", label: "Hors de portee", targetAmount: 10_000_000_000 },
    { id: "g3", kind: "revenu_passif", horizon: "minimum", label: "Rente", targetAmount: 100_000 },
  ];

  it("trouve le PREMIER mois ou l'objectif est franchi", () => {
    const { points } = projectFire({ ...BASE, horizonMonths: 120 });
    const [court] = resolveCheckpoints(points, goals);
    expect(court!.reachedAt).not.toBeNull();
    const index = court!.reachedAt!.monthIndex;
    expect(points[index]!.netWorth).toBeGreaterThanOrEqual(15_000_000);
    expect(points[index - 1]!.netWorth).toBeLessThan(15_000_000);
  });

  it("renvoie null pour un objectif non atteint dans l'horizon", () => {
    const { points } = projectFire({ ...BASE, horizonMonths: 120 });
    const checkpoints = resolveCheckpoints(points, goals);
    expect(checkpoints[1]!.reachedAt).toBeNull();
  });

  it("compare un objectif de rente au revenu passif REEL, pas au nominal", () => {
    const { points } = projectFire({ ...BASE, horizonMonths: 480 });
    const rente = resolveCheckpoints(points, goals)[2]!;
    const hit = points[rente.reachedAt!.monthIndex]!;
    expect(hit.passiveIncomeReal).toBeGreaterThanOrEqual(100_000);
  });

  it("projectFireWithGoals renvoie les checkpoints directement", () => {
    const p = projectFireWithGoals({ ...BASE, horizonMonths: 120 }, goals);
    expect(p.checkpoints).toHaveLength(3);
  });
});

describe("sampleForChart", () => {
  it("reduit le nombre de points sans jamais perdre le dernier", () => {
    const { points } = projectFire(BASE);
    const sampled = sampleForChart(points, 60);
    expect(sampled.length).toBeLessThanOrEqual(61);
    expect(sampled[0]!.monthIndex).toBe(0);
    expect(sampled.at(-1)!.monthIndex).toBe(480);
  });

  it("laisse une serie deja courte intacte", () => {
    const { points } = projectFire({ ...BASE, horizonMonths: 10 });
    expect(sampleForChart(points, 60)).toHaveLength(11);
  });
});

describe("capitalNeededFor", () => {
  it("applique la regle des 25 a 4 %", () => {
    expect(capitalNeededFor(1_000_000, 4)).toBe(300_000_000);
  });

  it("renvoie l'infini si le taux de retrait est nul", () => {
    expect(capitalNeededFor(1_000_000, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("ageAt", () => {
  it("ne compte pas l'anniversaire du jour meme s'il n'est pas passe", () => {
    expect(ageAt("1992-06-15", new Date(2026, 5, 14))).toBe(33);
    expect(ageAt("1992-06-15", new Date(2026, 5, 15))).toBe(34);
  });

  it("renvoie null sur une date invalide", () => {
    expect(ageAt("pas-une-date", new Date())).toBeNull();
  });
});
