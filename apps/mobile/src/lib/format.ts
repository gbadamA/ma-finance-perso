/**
 * Formatage lié à la devise active de l'utilisateur.
 * Fine couche au-dessus de `@mfp/core` : les écrans n'ont pas à trimballer la
 * devise dans chaque appel.
 */

import type { TextStyle } from "react-native";
import { formatAmount, formatPercent, type CurrencyCode, type FormatOptions } from "@mfp/core";

export function makeFormatters(currency: CurrencyCode) {
  return {
    /** Montant complet : « 1 250 000 FCFA ». */
    amount: (minor: number, options?: FormatOptions) => formatAmount(minor, currency, options),
    /** Montant abrégé pour les axes et les tuiles : « 1,3 M ». */
    compact: (minor: number) =>
      formatAmount(minor, currency, { compact: true, withSymbol: false }),
    /** Variation signée : « +12,4 % ». */
    percent: (points: number, decimals = 1) => formatPercent(points, decimals, true),
    /** Part d'un camembert : « 34,2 % », sans signe. */
    share: (points: number) => formatPercent(points, 1, false),
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;

/**
 * Style à appliquer à TOUT chiffre affiché : sans lui, les colonnes dansent.
 * Typé `TextStyle` explicitement — un `as const` produirait un tableau readonly
 * que React Native refuse.
 */
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };
