/**
 * Représentation et formatage des montants.
 *
 * ⚠️ Invariant du projet : **un montant est un entier dans l'unité mineure de sa
 * devise** (centimes pour EUR/USD, franc entier pour XOF qui n'a pas de subdivision).
 * Jamais de flottant en base ni dans les agrégations : additionner 0.1 + 0.2 sur
 * douze mois de dépenses produit des écarts visibles à l'écran.
 */

export type CurrencyCode = "XOF" | "XAF" | "EUR" | "USD" | "MAD" | "CAD" | "GBP";

/** Nombre de décimales de l'unité mineure, par devise. */
const MINOR_DIGITS: Record<CurrencyCode, number> = {
  XOF: 0,
  XAF: 0,
  EUR: 2,
  USD: 2,
  MAD: 2,
  CAD: 2,
  GBP: 2,
};

const SYMBOL: Record<CurrencyCode, string> = {
  XOF: "FCFA",
  XAF: "FCFA",
  EUR: "€",
  USD: "$",
  MAD: "DH",
  CAD: "$",
  GBP: "£",
};

export const DEFAULT_CURRENCY: CurrencyCode = "XOF";

export function minorDigits(currency: CurrencyCode): number {
  return MINOR_DIGITS[currency] ?? 2;
}

export function currencySymbol(currency: CurrencyCode): string {
  return SYMBOL[currency] ?? currency;
}

/** Convertit une saisie utilisateur en entier d'unité mineure. */
export function toMinor(amount: number, currency: CurrencyCode): number {
  return Math.round(amount * 10 ** minorDigits(currency));
}

/** Convertit un entier d'unité mineure en nombre décimal affichable. */
export function toMajor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** minorDigits(currency);
}

/**
 * Parse une saisie libre : espaces (fines, insécables), virgule décimale,
 * séparateurs de milliers. Renvoie `null` si rien d'exploitable — l'appelant
 * décide quoi afficher, on ne devine pas un zéro.
 */
export function parseAmount(input: string, currency: CurrencyCode): number | null {
  const cleaned = input
    .replace(/[\s\u00A0\u202F']/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return toMinor(value, currency);
}

export type FormatOptions = {
  /** Affiche le symbole de devise. Défaut : true. */
  withSymbol?: boolean;
  /** Force le signe « + » sur les valeurs positives (variations). Défaut : false. */
  signed?: boolean;
  /**
   * Abrège les grands nombres (1,2 M au lieu de 1 200 000). Utile sur les axes
   * de graphiques et les tuiles KPI, jamais dans un tableau de comptes.
   */
  compact?: boolean;
};

/** Espace fine insécable — ne casse jamais une colonne de montants alignés. */
const SPACE = "\u202F";

/**
 * Formate un entier d'unité mineure en français.
 * Volontairement écrit à la main plutôt qu'avec `Intl.NumberFormat` : Hermes
 * n'embarque pas toujours les données ICU complètes, et le rendu de XOF
 * diverge alors entre Android et iOS.
 */
export function formatAmount(
  minor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  options: FormatOptions = {},
): string {
  const { withSymbol = true, signed = false, compact = false } = options;
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const digits = minorDigits(currency);

  let body: string;
  if (compact) {
    body = formatCompact(abs / 10 ** digits);
  } else {
    const scale = 10 ** digits;
    const whole = Math.floor(abs / scale);
    const frac = abs % scale;
    body = groupThousands(whole);
    if (digits > 0) body += "," + String(frac).padStart(digits, "0");
  }

  const sign = negative ? "\u2212" : signed ? "+" : "";
  return withSymbol ? sign + body + SPACE + currencySymbol(currency) : sign + body;
}

function groupThousands(value: number): string {
  const s = String(value);
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const fromEnd = s.length - i;
    out += s[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += SPACE;
  }
  return out;
}

function formatCompact(value: number): string {
  const units: Array<[number, string]> = [
    [1_000_000_000, "Md"],
    [1_000_000, "M"],
    [1_000, "k"],
  ];
  for (const [threshold, suffix] of units) {
    if (value >= threshold) {
      const scaled = value / threshold;
      const decimals = scaled < 10 ? 1 : 0;
      return scaled.toFixed(decimals).replace(".", ",") + SPACE + suffix;
    }
  }
  return groupThousands(Math.round(value));
}

/** Formate un pourcentage déjà exprimé en points (12.5 → « 12,5 % »). */
export function formatPercent(points: number, decimals = 1, signed = false): string {
  const sign = points < 0 ? "\u2212" : signed ? "+" : "";
  return sign + Math.abs(points).toFixed(decimals).replace(".", ",") + SPACE + "%";
}

/** Somme d'entiers — évite les `reduce` dispersés dans les écrans. */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Moyenne arrondie à l'entier d'unité mineure le plus proche.
 * Renvoie 0 sur une série vide : une moyenne « indéfinie » n'a rien à faire à
 * l'écran, et l'appelant sait déjà si sa série est vide.
 */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(sum(values) / values.length);
}

/** Variation en points de pourcentage entre deux valeurs. `null` si la base est nulle. */
export function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}
