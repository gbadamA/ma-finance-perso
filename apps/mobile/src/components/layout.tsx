/**
 * Structure d'écran et barre d'onglets.
 *
 * ⚠️ Contrainte produit (§3.6 du claudemap) : **rien ne doit jamais tomber sous
 * la barre gestuelle Android ni sous le home indicator iOS.** Tout le calcul de
 * marge basse est centralisé ici — un écran qui utilise `<Screen>` est
 * correct par construction, et c'est le seul moyen de ne pas devoir y penser
 * à chaque nouvel écran.
 */

import { type ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { PERIOD_PRESETS, type PeriodPreset } from "@mfp/core";
import { useTheme } from "../lib/theme";
import { Overline, Touchable, Txt } from "./primitives";

/** Hauteur de la barre d'onglets, hors marge de sécurité système. */
export const TAB_BAR_HEIGHT = 62;
/** Écart entre le bas de la barre et la limite de la zone sûre. */
export const TAB_BAR_LIFT = 10;

/**
 * Marge basse à réserver dans un écran à onglets.
 * `Math.max(insets.bottom, TAB_BAR_LIFT)` : sur un téléphone sans barre
 * gestuelle, `insets.bottom` vaut 0 et la barre collerait au bord de l'écran.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, TAB_BAR_LIFT) + TAB_BAR_LIFT;
}

/* ------------------------------------------------------------------ *
 * Conteneur d'écran
 * ------------------------------------------------------------------ */

export function Screen({
  children,
  /** L'écran est sous la barre d'onglets : réserve la place en bas. */
  tabbed = false,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  contentStyle,
}: {
  children: ReactNode;
  tabbed?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();

  const padding: ViewStyle = {
    paddingTop: insets.top + theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: tabbed ? tabSpace : Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.lg,
    gap: theme.spacing.lg,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, padding, style]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]}
      contentContainerStyle={[padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={theme.brand.accent}
            colors={[theme.brand.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 * Barre d'onglets flottante
 * ------------------------------------------------------------------ */

export type TabItem = {
  key: string;
  label: string;
  icon: (props: { color: string; size: number }) => ReactNode;
};

/**
 * Barre d'onglets **flottante**, remontée au-dessus des gestes système.
 * Le flou laisse deviner le contenu qui défile dessous sans le rendre illisible.
 */
export function FloatingTabBar({
  items,
  activeKey,
  onSelect,
}: {
  items: readonly TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        bottom: Math.max(insets.bottom, TAB_BAR_LIFT),
      }}
    >
      <View
        style={[
          {
            height: TAB_BAR_HEIGHT,
            borderRadius: theme.radius.xl,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
          },
          theme.elevation("floating"),
        ]}
      >
        <BlurView
          intensity={theme.isDark ? 40 : 60}
          tint={theme.isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        {/* Le flou seul laisse passer trop de contraste : un voile de surface
            garantit que les libellés restent lisibles sur n'importe quel fond. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.surface, opacity: theme.isDark ? 0.72 : 0.82 },
          ]}
        />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          {items.map((item) => {
            const active = item.key === activeKey;
            const color = active ? theme.brand.accent : theme.colors.textMuted;
            return (
              <Touchable
                key={item.key}
                onPress={() => onSelect(item.key)}
                haptic
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
              >
                {item.icon({ color, size: 21 })}
                <Txt variant="caption" color={color} style={{ fontSize: 11, fontWeight: active ? "700" : "500" }}>
                  {item.label}
                </Txt>
                {active ? (
                  <Animated.View
                    entering={FadeIn.duration(theme.motion.duration.quick)}
                    // Au-DESSUS de l'icône : posé en bas, il traversait le
                    // libellé et se lisait comme un texte barré.
                    style={{
                      position: "absolute",
                      top: 5,
                      width: 18,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: theme.brand.accent,
                    }}
                  />
                ) : null}
              </Touchable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Carte de héros
 * ------------------------------------------------------------------ */

/**
 * Grande carte en dégradé — la fortune totale.
 * Son ombre est **teintée marine** et non noire : une ombre neutre sous une
 * surface colorée donne un effet d'autocollant posé sur la page.
 */
export function HeroCard({
  children,
  warm = false,
  style,
}: {
  children: ReactNode;
  /** Variante qui laisse entrer l'orange — réservée aux moments forts. */
  warm?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const colors = warm ? theme.gradient.heroWarm : theme.gradient.hero;

  return (
    <View style={[{ borderRadius: theme.radius.lg }, theme.elevation("hero"), style]}>
      <LinearGradient
        colors={colors as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: theme.radius.lg, padding: theme.spacing.xl, overflow: "hidden" }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Sélecteur de période
 * ------------------------------------------------------------------ */

/**
 * Le sélecteur unique qui remplace les 20 graphiques dupliqués du classeur.
 * `LinearTransition` fait glisser la pastille active d'un segment à l'autre
 * au lieu de la faire disparaître puis réapparaître.
 */
export function PeriodSelector({
  value,
  onChange,
  presets = PERIOD_PRESETS,
}: {
  value: PeriodPreset;
  onChange: (preset: PeriodPreset) => void;
  presets?: readonly { key: PeriodPreset; label: string }[];
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2 }}
    >
      {presets.map((preset) => {
        const active = preset.key === value;
        return (
          <Touchable
            key={preset.key}
            onPress={() => onChange(preset.key)}
            haptic
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Animated.View
              layout={LinearTransition.duration(theme.motion.duration.quick)}
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.pill,
                backgroundColor: active ? theme.brand.primary : theme.colors.surfaceAlt,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: active ? theme.brand.primary : theme.colors.border,
              }}
            >
              <Txt
                variant="caption"
                color={active ? "#FFFFFF" : theme.colors.textMuted}
                style={{ fontWeight: active ? "700" : "500" }}
              >
                {preset.label}
              </Txt>
            </Animated.View>
          </Touchable>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 * En-tête de section
 * ------------------------------------------------------------------ */

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Overline>{title}</Overline>
        {subtitle ? (
          <Txt variant="caption" muted style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Largeur utile d'un graphique dans une carte pleine largeur. */
export function useChartWidth(insetCards = 1): number {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  return width - theme.spacing.lg * 2 - theme.spacing.lg * 2 * insetCards;
}
