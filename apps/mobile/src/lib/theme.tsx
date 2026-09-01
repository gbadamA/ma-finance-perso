/**
 * Thème clair / sombre.
 *
 * Un seul point d'accès aux tokens depuis les écrans : `useTheme()`.
 * Aucun composant ne lit `palette.dark` directement — sinon la bascule de
 * thème oublie systématiquement un écran.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme, type ViewStyle } from "react-native";
import {
  brand,
  elevation,
  gradient,
  money,
  motion,
  palette,
  radius,
  spacing,
  typography,
  type ElevationName,
  type ThemeColors,
  type ThemeName,
} from "@mfp/design-tokens";

export type Theme = {
  name: ThemeName;
  isDark: boolean;
  colors: ThemeColors;
  brand: typeof brand;
  money: typeof money;
  gradient: typeof gradient;
  motion: typeof motion;
  radius: typeof radius;
  spacing: typeof spacing;
  typography: typeof typography;
  /**
   * Élévation du palier demandé, déjà résolue pour le thème actif.
   * Le retour est un `ViewStyle` : les quatre paliers sont des littéraux figés
   * dont TypeScript refuse de former une union assignable.
   */
  elevation: (name: ElevationName) => ViewStyle;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === "light" ? "light" : "dark";

  const value = useMemo<Theme>(
    () => ({
      name,
      isDark: name === "dark",
      colors: palette[name],
      brand,
      money,
      gradient,
      motion,
      radius,
      spacing,
      typography,
      elevation: (level) => elevation[name][level],
    }),
    [name],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme doit etre appele sous <ThemeProvider>.");
  return theme;
}

/**
 * Couleur d'un montant selon son signe.
 * `neutral` pour zéro : un solde à zéro n'est ni un gain ni une perte, le
 * teinter en rouge serait un jugement que la donnée ne porte pas.
 */
export function amountColor(theme: Theme, value: number): string {
  if (value > 0) return theme.money.gain;
  if (value < 0) return theme.money.loss;
  return theme.colors.textMuted;
}
