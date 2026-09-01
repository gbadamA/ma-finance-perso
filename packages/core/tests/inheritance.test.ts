import { describe, expect, it } from "vitest";
import { DEFAULT_HORIZONS, lifeClock, projectInheritance, wealthAtTargetAge } from "../src/inheritance";

const NOW = new Date(2026, 7, 25); // 25 août 2026

const input = {
  currentWealth: 10_000_000,
  annualReturn: 7,
  birthDate: "1992-06-15",
  lifeExpectancy: 80,
  now: NOW,
};

describe("projectInheritance", () => {
  it("applique la croissance composee sur chaque horizon", () => {
    const points = projectInheritance(input, [0, 10, 20]);
    expect(points[0]!.wealth).toBe(10_000_000);
    expect(points[1]!.wealth).toBeCloseTo(10_000_000 * 1.07 ** 10, 2);
    expect(points[2]!.wealth).toBeCloseTo(10_000_000 * 1.07 ** 20, 2);
  });

  it("bascule en mode heritage au-dela de l'esperance de vie restante", () => {
    // 34 ans en 2026, esperance 80 => il reste 46 ans.
    const points = projectInheritance(input, [40, 50]);
    expect(points[0]!.isInheritance).toBe(false);
    expect(points[1]!.isInheritance).toBe(true);
  });

  it("ne bascule jamais en heritage sans date de naissance", () => {
    const points = projectInheritance({ ...input, birthDate: null }, [500]);
    expect(points[0]!.isInheritance).toBe(false);
    expect(points[0]!.age).toBeNull();
  });

  it("fait vieillir l'utilisateur avec l'horizon", () => {
    const points = projectInheritance(input, [0, 30]);
    expect(points[0]!.age).toBe(34);
    expect(points[1]!.age).toBe(64);
  });

  it("donne l'annee civile de chaque horizon", () => {
    const points = projectInheritance(input, [0, 100]);
    expect(points[0]!.calendarYear).toBe(2026);
    expect(points[1]!.calendarYear).toBe(2126);
  });

  it("couvre les horizons du classeur, jusqu'a 500 ans", () => {
    const points = projectInheritance(input);
    expect(points).toHaveLength(DEFAULT_HORIZONS.length);
    expect(points.at(-1)!.years).toBe(500);
    // Le montant devient absurde, et c'est justement la demonstration voulue.
    expect(points.at(-1)!.wealth).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });

  it("laisse un patrimoine nul a zero quel que soit l'horizon", () => {
    const points = projectInheritance({ ...input, currentWealth: 0 }, [0, 100]);
    expect(points.every((p) => p.wealth === 0)).toBe(true);
  });
});

describe("lifeClock", () => {
  it("calcule le pourcentage de vie vecue", () => {
    const clock = lifeClock("1992-06-15", 80, NOW)!;
    expect(clock.currentAge).toBe(34);
    expect(clock.livedPercent).toBeCloseTo(42.5, 5);
    expect(clock.remainingPercent).toBeCloseTo(57.5, 5);
  });

  it("exprime aussi le reste en mois", () => {
    const clock = lifeClock("1992-06-15", 80, NOW)!;
    expect(clock.yearsRemaining).toBe(46);
    expect(clock.monthsRemaining).toBe(552);
  });

  it("borne a 100 % au-dela de l'esperance de vie, sans reste negatif", () => {
    const clock = lifeClock("1920-01-01", 80, NOW)!;
    expect(clock.livedPercent).toBe(100);
    expect(clock.yearsRemaining).toBe(0);
  });

  it("renvoie null sans date de naissance plutot que d'inventer un age", () => {
    expect(lifeClock(null, 80, NOW)).toBeNull();
  });

  it("renvoie null sur une esperance de vie absurde", () => {
    expect(lifeClock("1992-06-15", 0, NOW)).toBeNull();
  });
});

describe("wealthAtTargetAge", () => {
  it("projette jusqu'a l'age cible", () => {
    const r = wealthAtTargetAge(input, 64)!;
    expect(r.years).toBe(30);
    expect(r.wealth).toBeCloseTo(10_000_000 * 1.07 ** 30, 2);
  });

  it("ne remonte pas le temps si l'age cible est deja passe", () => {
    const r = wealthAtTargetAge(input, 20)!;
    expect(r.years).toBe(0);
    expect(r.wealth).toBe(10_000_000);
  });

  it("renvoie null sans date de naissance", () => {
    expect(wealthAtTargetAge({ ...input, birthDate: null }, 90)).toBeNull();
  });
});
