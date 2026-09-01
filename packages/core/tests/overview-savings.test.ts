import { describe, expect, it } from "vitest";
import { buildOverview, overviewFromDemo } from "../src/overview";
import { demoDataset } from "../src/demo";
import { groupSavings, summariseSavings, yearsSavedOn } from "../src/savings";
import { categoryTotals, expenseSlices } from "../src/expenses";
import type { SavingsAction } from "../src/types";

describe("buildOverview sur le jeu de demonstration", () => {
  const dataset = demoDataset();
  const overview = overviewFromDemo(dataset, "12m");

  it("n'est pas vide et expose un mois de reference", () => {
    expect(overview.isEmpty).toBe(false);
    expect(overview.referenceMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("respecte Fortune = comptes + equity des biens", () => {
    expect(overview.totalWealth).toBe(overview.accountsTotal + overview.assetsEquity);
  });

  it("limite chaque serie a la periode demandee", () => {
    expect(overview.wealthSeries).toHaveLength(12);
    expect(overview.cashSeries).toHaveLength(12);
    expect(overview.incomeSeries.length).toBeLessThanOrEqual(12);
  });

  it("elargit bien les series quand on passe a 24 mois", () => {
    const wider = overviewFromDemo(dataset, "24m");
    expect(wider.wealthSeries.length).toBeGreaterThan(overview.wealthSeries.length);
  });

  it("produit des camemberts dont les parts totalisent 100 points", () => {
    for (const slices of [
      overview.allocationSlices,
      overview.expenseSlices,
      overview.portfolioSlices,
      overview.incomeExpenseSlices,
    ]) {
      expect(slices.length).toBeGreaterThan(0);
      const total = slices.reduce((acc, s) => acc + s.percent, 0);
      expect(total).toBeCloseTo(100, 6);
    }
  });

  it("detecte la derive de portefeuille voulue par le jeu de demo", () => {
    // Les actions y montent plus vite que la cible : l'alerte doit se declencher.
    expect(overview.investmentsKpi.needsRebalance).toBe(true);
    expect(overview.investmentsKpi.maxDriftPoints).toBeGreaterThan(5);
  });

  it("calcule une sante financiere exploitable", () => {
    expect(overview.health.averageIncome).toBeGreaterThan(0);
    expect(overview.health.averageExpense).toBeGreaterThan(0);
    expect(overview.health.incomeExpenseRatio).not.toBeNull();
    expect(overview.health.runwayYears).not.toBeNull();
  });

  it("le pie ratio revenus/depenses ne porte que deux tranches", () => {
    expect(overview.incomeExpenseSlices).toHaveLength(2);
  });
});

describe("buildOverview sans aucune donnee", () => {
  const empty = buildOverview({
    settings: demoDataset().settings,
    accounts: [],
    accountSnapshots: [],
    incomeSources: [],
    incomeEntries: [],
    expenseCategories: [],
    expenseEntries: [],
    assets: [],
    targets: [],
    investmentSnapshots: [],
    period: "12m",
  });

  it("se declare vide pour que l'ecran bascule sur l'onboarding", () => {
    expect(empty.isEmpty).toBe(true);
    expect(empty.referenceMonth).toBeNull();
  });

  it("ne renvoie ni NaN ni valeur inventee", () => {
    expect(empty.totalWealth).toBe(0);
    expect(empty.allocationSlices).toEqual([]);
    expect(empty.health.incomeExpenseRatio).toBeNull();
  });
});

describe("categoryTotals", () => {
  const dataset = demoDataset();

  it("couvre les 8 categories du classeur", () => {
    const totals = categoryTotals(dataset.expenseEntries, dataset.expenseCategories);
    expect(totals).toHaveLength(8);
  });

  it("trie par montant decroissant et fait totaliser 100 points", () => {
    const totals = categoryTotals(dataset.expenseEntries, dataset.expenseCategories);
    expect(totals[0]!.total).toBeGreaterThanOrEqual(totals[1]!.total);
    expect(totals.reduce((acc, t) => acc + t.percent, 0)).toBeCloseTo(100, 6);
  });

  it("etiquette Sans categorie une depense orpheline plutot que de la perdre", () => {
    const totals = categoryTotals(
      [{ id: "x", categoryId: "inconnu", date: "2026-01-05", amount: 1000 }],
      dataset.expenseCategories,
    );
    expect(totals[0]!.label).toBe("Sans catégorie");
  });

  it("produit un camembert a partir des totaux", () => {
    const slices = expenseSlices(
      categoryTotals(dataset.expenseEntries, dataset.expenseCategories),
    );
    expect(slices).toHaveLength(8);
  });
});

describe("summariseSavings", () => {
  const actions: SavingsAction[] = [
    { id: "1", category: "A", label: "Faite", feasible: true, initialExpense: 10_000, newExpense: 4_000, done: true },
    { id: "2", category: "A", label: "A faire", feasible: true, initialExpense: 20_000, newExpense: 15_000, done: false },
    { id: "3", category: "B", label: "Non realisable", feasible: false, initialExpense: 90_000, newExpense: 0, done: false },
  ];

  it("applique Economie = depense initiale - nouvelle depense", () => {
    const s = summariseSavings(actions);
    expect(s.potentialMonthly).toBe(11_000);
    expect(s.achievedMonthly).toBe(6_000);
    expect(s.remainingMonthly).toBe(5_000);
  });

  it("exclut totalement les actions non realisables des deux totaux", () => {
    // L'action 3 vaudrait 90 000 de plus si elle etait comptee.
    expect(summariseSavings(actions).potentialMonthly).toBe(11_000);
  });

  it("annualise l'economie acquise, le chiffre qui motive", () => {
    expect(summariseSavings(actions).achievedYearly).toBe(72_000);
  });

  it("mesure la progression sur les seules actions realisables", () => {
    expect(summariseSavings(actions).progressPercent).toBe(50);
  });

  it("ne divise pas par zero sans aucune action realisable", () => {
    const s = summariseSavings([actions[2]!]);
    expect(s.progressPercent).toBe(0);
    expect(s.potentialMonthly).toBe(0);
  });

  it("regroupe par categorie", () => {
    const groups = groupSavings(actions);
    expect(groups.map((g) => g.category)).toEqual(["A", "B"]);
    expect(groups[0]!.potentialMonthly).toBe(11_000);
  });

  it("la checklist de demo compte 35 actions et a deja des acquis", () => {
    const s = summariseSavings(demoDataset().savingsActions);
    expect(demoDataset().savingsActions).toHaveLength(35);
    expect(s.achievedMonthly).toBeGreaterThan(0);
    expect(s.remainingMonthly).toBeGreaterThan(0);
  });
});

describe("yearsSavedOn", () => {
  it("chiffre l'objectif en annees d'economies", () => {
    expect(yearsSavedOn(1_200_000, 100_000)).toBe(1);
  });

  it("renvoie null quand l'economie est nulle ou negative", () => {
    expect(yearsSavedOn(1_200_000, 0)).toBeNull();
    expect(yearsSavedOn(1_200_000, -5)).toBeNull();
  });
});
