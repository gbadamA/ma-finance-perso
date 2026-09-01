import { describe, expect, it } from "vitest";
import {
  assetMetrics,
  cashSeries,
  expensesByMonth,
  financialHealth,
  incomeByMonth,
  latestBalance,
  toSlices,
  totalEquity,
  wealthAt,
  wealthSeries,
} from "../src/wealth";
import type {
  Account,
  AccountSnapshot,
  Asset,
  ExpenseEntry,
  IncomeEntry,
  IncomeSource,
} from "../src/types";

const accounts: Account[] = [
  { id: "a", name: "Liquide", kind: "liquide", currency: "XOF", archived: false },
  { id: "b", name: "Courant", kind: "compte", currency: "XOF", archived: false },
  { id: "z", name: "Ancien", kind: "compte", currency: "XOF", archived: true },
];

const snapshots: AccountSnapshot[] = [
  { accountId: "a", month: "2026-01", balance: 100_000 },
  { accountId: "b", month: "2026-01", balance: 900_000 },
  { accountId: "a", month: "2026-03", balance: 150_000 },
  { accountId: "b", month: "2026-03", balance: 1_100_000 },
  { accountId: "z", month: "2026-03", balance: 5_000_000 },
];

const assets: Asset[] = [
  {
    id: "car",
    category: "Vehicule",
    name: "Voiture",
    purchaseDate: "2024-01-01",
    purchasePrice: 10_000_000,
    debt: 2_000_000,
    maintenanceCost: 500_000,
    currentValue: 8_000_000,
  },
];

describe("latestBalance", () => {
  it("reporte le dernier solde connu sur un mois sans releve", () => {
    expect(latestBalance(snapshots, "a", "2026-02")).toBe(100_000);
  });

  it("ne regarde jamais dans le futur", () => {
    expect(latestBalance(snapshots, "a", "2025-12")).toBe(0);
  });

  it("prend le releve du mois quand il existe", () => {
    expect(latestBalance(snapshots, "a", "2026-03")).toBe(150_000);
  });
});

describe("wealthAt", () => {
  it("applique Fortune = comptes + valeur des assets - dettes", () => {
    const w = wealthAt(accounts, snapshots, assets, "2026-03");
    expect(w.accountsTotal).toBe(1_250_000);
    expect(w.total).toBe(1_250_000 + 8_000_000 - 2_000_000);
  });

  it("exclut les comptes archives", () => {
    // Le compte "z" porte 5 000 000 en 2026-03 et ne doit pas compter.
    expect(wealthAt(accounts, snapshots, assets, "2026-03").accountsTotal).toBe(1_250_000);
  });
});

describe("wealthSeries", () => {
  it("comble les mois manquants en reportant la valeur precedente", () => {
    const series = wealthSeries(accounts, snapshots, assets);
    expect(series.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(series[1]!.value).toBe(series[0]!.value);
  });

  it("renvoie une serie vide sans aucun releve", () => {
    expect(wealthSeries(accounts, [], assets)).toEqual([]);
  });
});

describe("cashSeries", () => {
  it("ne retient que le liquide et les comptes courants", () => {
    const withSavings: Account[] = [
      ...accounts,
      { id: "s", name: "Epargne", kind: "epargne", currency: "XOF", archived: false },
    ];
    const withSavingsSnaps: AccountSnapshot[] = [
      ...snapshots,
      { accountId: "s", month: "2026-03", balance: 4_000_000 },
    ];
    const series = cashSeries(withSavings, withSavingsSnaps);
    expect(series.at(-1)!.value).toBe(1_250_000);
  });
});

describe("assetMetrics", () => {
  it("calcule Net Equity = valeur - dette", () => {
    expect(assetMetrics(assets[0]!).netEquity).toBe(6_000_000);
  });

  it("calcule P/L = valeur - prix d'achat - cout de maintien", () => {
    expect(assetMetrics(assets[0]!).profitLoss).toBe(-2_500_000);
  });

  it("totalEquity somme les net equity", () => {
    expect(totalEquity(assets)).toBe(6_000_000);
  });
});

describe("incomeByMonth", () => {
  const sources: IncomeSource[] = [
    { id: "sal", name: "Salaire", kind: "actif", isInvestment: false },
    { id: "loy", name: "Loyer", kind: "passif", isInvestment: false },
    { id: "div", name: "Dividendes", kind: "passif", isInvestment: true },
  ];
  const entries: IncomeEntry[] = [
    { id: "1", sourceId: "sal", month: "2026-01", amount: 1_000_000 },
    { id: "2", sourceId: "loy", month: "2026-01", amount: 200_000 },
    { id: "3", sourceId: "div", month: "2026-01", amount: 150_000 },
    { id: "4", sourceId: "inconnu", month: "2026-01", amount: 999_999 },
  ];

  it("separe actif, passif et investissement", () => {
    const [m] = incomeByMonth(sources, entries);
    expect(m!.active).toBe(1_000_000);
    expect(m!.passive).toBe(350_000);
    expect(m!.investment).toBe(150_000);
    expect(m!.total).toBe(1_350_000);
  });

  it("expose le total hors investissement, comme la colonne du classeur", () => {
    const [m] = incomeByMonth(sources, entries);
    expect(m!.totalExcludingInvestment).toBe(1_200_000);
  });

  it("ignore une entree dont la source a disparu plutot que de la mal classer", () => {
    const [m] = incomeByMonth(sources, entries);
    expect(m!.total).not.toContain(999_999);
    expect(m!.total).toBe(1_350_000);
  });
});

describe("expensesByMonth", () => {
  it("regroupe les saisies quotidiennes par mois", () => {
    const entries: ExpenseEntry[] = [
      { id: "1", categoryId: "c", date: "2026-01-03", amount: 10_000 },
      { id: "2", categoryId: "c", date: "2026-01-28", amount: 15_000 },
      { id: "3", categoryId: "c", date: "2026-02-05", amount: 7_000 },
    ];
    expect(expensesByMonth(entries)).toEqual([
      { month: "2026-01", value: 25_000 },
      { month: "2026-02", value: 7_000 },
    ]);
  });
});

describe("financialHealth", () => {
  const income = incomeByMonth(
    [{ id: "s", name: "Salaire", kind: "actif", isInvestment: false }],
    [
      { id: "1", sourceId: "s", month: "2026-01", amount: 1_000_000 },
      { id: "2", sourceId: "s", month: "2026-02", amount: 1_000_000 },
    ],
  );
  const expenses = [
    { month: "2026-01", value: 500_000 },
    { month: "2026-02", value: 500_000 },
  ];

  it("calcule le ratio revenus / depenses", () => {
    const h = financialHealth(income, expenses, 12_000_000, 6);
    expect(h.incomeExpenseRatio).toBe(2);
  });

  it("exprime la sante financiere en annees de depenses couvertes", () => {
    const h = financialHealth(income, expenses, 12_000_000, 6);
    expect(h.runwayYears).toBe(2); // 12 M / (500 k x 12)
  });

  it("renvoie null plutot qu'une division par zero quand il n'y a pas de depense", () => {
    const h = financialHealth(income, [], 12_000_000, 6);
    expect(h.incomeExpenseRatio).toBeNull();
    expect(h.runwayYears).toBeNull();
  });

  it("calcule le taux d'epargne", () => {
    const h = financialHealth(income, expenses, 0, 6);
    expect(h.savingsRatePercent).toBe(50);
  });
});

describe("toSlices", () => {
  it("ecarte les valeurs nulles ou negatives, indessinables sur un disque", () => {
    const slices = toSlices([
      { key: "a", label: "A", value: 60 },
      { key: "b", label: "B", value: 40 },
      { key: "c", label: "C", value: 0 },
      { key: "d", label: "D", value: -10 },
    ]);
    expect(slices.map((s) => s.key)).toEqual(["a", "b"]);
    expect(slices[0]!.percent).toBe(60);
  });

  it("trie par valeur decroissante", () => {
    const slices = toSlices([
      { key: "petit", label: "Petit", value: 10 },
      { key: "gros", label: "Gros", value: 90 },
    ]);
    expect(slices[0]!.key).toBe("gros");
  });

  it("renvoie une liste vide si tout est a zero", () => {
    expect(toSlices([{ key: "a", label: "A", value: 0 }])).toEqual([]);
  });
});
