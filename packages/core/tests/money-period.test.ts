import { describe, expect, it } from "vitest";
import {
  average,
  formatAmount,
  formatPercent,
  parseAmount,
  percentChange,
  toMajor,
  toMinor,
} from "../src/money";
import {
  addMonths,
  carryForward,
  fillMonths,
  filterPeriod,
  formatMonth,
  monthRange,
  monthsBetween,
  periodStart,
  toMonthKey,
  zeroFill,
} from "../src/period";

describe("conversion majeur / mineur", () => {
  it("ne subdivise pas le franc CFA", () => {
    expect(toMinor(12_500, "XOF")).toBe(12_500);
    expect(toMajor(12_500, "XOF")).toBe(12_500);
  });

  it("travaille en centimes pour l'euro", () => {
    expect(toMinor(12.34, "EUR")).toBe(1234);
    expect(toMajor(1234, "EUR")).toBe(12.34);
  });

  it("arrondit plutot que de tronquer, pour ne pas perdre un centime par saisie", () => {
    expect(toMinor(0.005, "EUR")).toBe(1);
  });
});

describe("parseAmount", () => {
  it("accepte les separateurs de milliers et la virgule decimale", () => {
    expect(parseAmount("1 250 000", "XOF")).toBe(1_250_000);
    expect(parseAmount("12,34", "EUR")).toBe(1234);
  });

  it("absorbe les espaces insecables d'un copier-coller", () => {
    expect(parseAmount("1 250 000", "XOF")).toBe(1_250_000);
  });

  it("renvoie null sur une saisie vide ou inexploitable plutot qu'un zero invente", () => {
    expect(parseAmount("", "XOF")).toBeNull();
    expect(parseAmount("abc", "XOF")).toBeNull();
    expect(parseAmount("-", "XOF")).toBeNull();
  });

  it("accepte un montant negatif", () => {
    expect(parseAmount("-500", "XOF")).toBe(-500);
  });
});

describe("formatAmount", () => {
  it("groupe les milliers et suffixe la devise", () => {
    expect(formatAmount(1_250_000, "XOF")).toBe("1 250 000 FCFA");
  });

  it("affiche les centimes de l'euro", () => {
    expect(formatAmount(123_456, "EUR")).toBe("1 234,56 €");
  });

  it("utilise un vrai signe moins, pas un trait d'union", () => {
    expect(formatAmount(-500, "XOF").startsWith("−")).toBe(true);
  });

  it("force le + seulement quand on le demande", () => {
    expect(formatAmount(500, "XOF", { signed: true }).startsWith("+")).toBe(true);
    expect(formatAmount(500, "XOF").startsWith("+")).toBe(false);
  });

  it("abrege les grands nombres pour les axes de graphiques", () => {
    expect(formatAmount(1_250_000, "XOF", { compact: true, withSymbol: false })).toBe("1,3 M");
    expect(formatAmount(45_000, "XOF", { compact: true, withSymbol: false })).toBe("45 k");
  });

  it("peut omettre le symbole", () => {
    expect(formatAmount(1000, "XOF", { withSymbol: false })).toBe("1 000");
  });
});

describe("formatPercent", () => {
  it("utilise la virgule decimale francaise", () => {
    expect(formatPercent(12.34)).toBe("12,3 %");
  });

  it("porte le signe moins typographique", () => {
    expect(formatPercent(-4.5).startsWith("−")).toBe(true);
  });
});

describe("average et percentChange", () => {
  it("renvoie 0 sur une serie vide plutot que NaN", () => {
    expect(average([])).toBe(0);
  });

  it("arrondit la moyenne a l'entier", () => {
    expect(average([100, 101])).toBe(101);
  });

  it("renvoie null quand la base est nulle, au lieu d'une division par zero", () => {
    expect(percentChange(0, 100)).toBeNull();
  });

  it("calcule une variation relative a la valeur ABSOLUE de depart", () => {
    expect(percentChange(-100, -50)).toBe(50);
  });
});

describe("MonthKey", () => {
  it("lit le mois textuellement, sans passer par UTC", () => {
    // `new Date("2026-01-01")` est interprete en UTC et bascule en decembre
    // dans les fuseaux negatifs : la lecture textuelle evite ce piege.
    expect(toMonthKey("2026-01-01T00:00:00Z")).toBe("2026-01");
  });

  it("passe correctement les annees en arriere comme en avant", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-06", -18)).toBe("2024-12");
  });

  it("compte les mois entre deux dates, signe compris", () => {
    expect(monthsBetween("2026-01", "2026-06")).toBe(5);
    expect(monthsBetween("2026-06", "2026-01")).toBe(-5);
  });

  it("genere une plage continue, bornes incluses", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("renvoie une plage vide si les bornes sont inversees", () => {
    expect(monthRange("2027-02", "2026-11")).toEqual([]);
  });

  it("formate en francais", () => {
    expect(formatMonth("2026-08")).toBe("août 2026");
  });
});

describe("periodStart", () => {
  it("compte le mois de reference dans la fenetre", () => {
    expect(periodStart("3m", "2026-08")).toBe("2026-06");
    expect(periodStart("12m", "2026-08")).toBe("2025-09");
  });

  it("ramene l'annee en cours a janvier", () => {
    expect(periodStart("ytd", "2026-08")).toBe("2026-01");
  });

  it("renvoie null pour Tout, ce qui laisse la serie intacte", () => {
    expect(periodStart("all", "2026-08")).toBeNull();
  });
});

describe("filterPeriod", () => {
  const series = monthRange("2026-01", "2026-12").map((month) => ({ month, value: 1 }));

  it("garde exactement le nombre de mois demande", () => {
    expect(filterPeriod(series, "3m")).toHaveLength(3);
    expect(filterPeriod(series, "6m")).toHaveLength(6);
  });

  it("garde tout sur Tout", () => {
    expect(filterPeriod(series, "all")).toHaveLength(12);
  });

  it("ne plante pas sur une serie vide", () => {
    expect(filterPeriod([], "12m")).toEqual([]);
  });
});

describe("fillMonths", () => {
  const sparse = [
    { month: "2026-01", value: 100 },
    { month: "2026-04", value: 400 },
  ];

  it("reporte la derniere valeur connue pour un solde", () => {
    const filled = fillMonths(sparse, carryForward);
    expect(filled.map((p) => p.value)).toEqual([100, 100, 100, 400]);
  });

  it("met zero sur les mois sans flux", () => {
    const filled = fillMonths(sparse, zeroFill);
    expect(filled.map((p) => p.value)).toEqual([100, 0, 0, 400]);
  });

  it("laisse une serie vide vide", () => {
    expect(fillMonths([], carryForward)).toEqual([]);
  });
});
