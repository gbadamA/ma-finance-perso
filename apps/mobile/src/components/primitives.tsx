/**
 * Primitives visuelles partagées.
 * Tout ce qui se répète d'un écran à l'autre vit ici — c'est ce qui garantit
 * que deux cartes voisines ont la même élévation et la même courbe d'animation.
 */

import { forwardRef, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { ElevationName } from "@mfp/design-tokens";
import { amountColor, useTheme, type Theme } from "../lib/theme";
import { tabular } from "../lib/format";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ------------------------------------------------------------------ *
 * Pression
 * ------------------------------------------------------------------ */

export type TouchableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Retour haptique au toucher. Réservé aux actions qui changent l'état. */
  haptic?: boolean;
  /** Désactive l'échelle (utile sur un élément déjà animé par ailleurs). */
  noScale?: boolean;
};

/**
 * Zone tactile avec retour d'échelle.
 * Un ressort plutôt qu'une durée : le doigt peut relâcher à tout moment et
 * l'animation doit rattraper la position courante sans saccade.
 */
export const Touchable = forwardRef<View, TouchableProps>(function Touchable(
  { children, style, haptic = false, noScale = false, onPressIn, onPressOut, ...rest },
  ref,
) {
  const { motion } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      style={[style, !noScale && animatedStyle]}
      onPressIn={(e) => {
        if (!noScale) scale.value = withSpring(motion.pressScale, motion.spring.press);
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!noScale) scale.value = withSpring(1, motion.spring.press);
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

/* ------------------------------------------------------------------ *
 * Entrée en cascade
 * ------------------------------------------------------------------ */

/**
 * Entrée d'un élément de liste, décalée par son rang.
 * Le décalage est plafonné : au-delà d'une dizaine d'éléments, attendre une
 * demi-seconde que la dernière carte arrive donne l'impression d'une app lente.
 */
export function Enter({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { motion } = useTheme();
  const delay = Math.min(index, 8) * motion.stagger;
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.duration(motion.duration.normal).delay(delay).springify().damping(18)}
    >
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  level?: ElevationName;
  /** Surface alternative (pour une carte posée sur une autre carte). */
  alt?: boolean;
  padded?: boolean;
};

export function Card({ children, style, level = "card", alt = false, padded = true }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: alt ? theme.colors.surfaceAlt : theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: padded ? theme.spacing.lg : 0,
        },
        theme.elevation(level),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Texte
 * ------------------------------------------------------------------ */

type Variant = keyof Theme["typography"];

export function Txt({
  variant = "body",
  muted = false,
  color,
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        theme.typography[variant] as TextStyle,
        { color: color ?? (muted ? theme.colors.textMuted : theme.colors.text) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Étiquette de section : petite, espacée, discrète. */
export function Overline({
  children,
  color,
  numberOfLines,
}: {
  children: ReactNode;
  color?: string;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        theme.typography.overline as TextStyle,
        { color: color ?? theme.colors.textMuted, textTransform: "uppercase" },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Montant. **Toujours** en chiffres tabulaires : sans cela une colonne de
 * montants se décale d'une ligne à l'autre au gré des « 1 » et des « 8 ».
 */
export function Amount({
  value,
  format,
  variant = "amountMd",
  /** Colore selon le signe (variation) plutôt qu'en couleur de texte (solde). */
  signed = false,
  color,
  style,
}: {
  value: number;
  format: (v: number) => string;
  variant?: Variant;
  signed?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return (
    // Un montant tient TOUJOURS sur une ligne : replié, « 13 088 509 FCFA »
    // déborde sur la colonne voisine. On réduit la taille plutôt que la ligne.
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.65}
      style={[
        theme.typography[variant] as TextStyle,
        tabular,
        { color: color ?? (signed ? amountColor(theme, value) : theme.colors.text) },
        style,
      ]}
    >
      {format(value)}
    </Text>
  );
}

/* ------------------------------------------------------------------ *
 * Divers
 * ------------------------------------------------------------------ */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
        style,
      ]}
    />
  );
}

/** Pastille colorée d'une série — reprend la couleur exacte du graphique. */
export function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}

export function Badge({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: theme.radius.pill,
        backgroundColor: background,
      }}
    >
      <Text style={[theme.typography.caption as TextStyle, { color, fontWeight: "600" }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Barre de progression animée.
 * `withTiming` sur la largeur : une barre qui saute à sa valeur finale ne
 * laisse pas voir de combien elle a bougé depuis la dernière fois.
 */
export function ProgressBar({
  percent,
  color,
  height = 8,
}: {
  percent: number;
  color?: string;
  height?: number;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  const style = useAnimatedStyle(
    () => ({ width: withTiming(`${clamped}%`, { duration: theme.motion.duration.slow }) }),
    [clamped],
  );
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.surfaceSunken,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[{ height, borderRadius: height / 2, backgroundColor: color ?? theme.brand.accent }, style]}
      />
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card style={{ alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl }}>
      <Txt variant="h3">{title}</Txt>
      <Txt variant="caption" muted style={{ textAlign: "center" }}>
        {message}
      </Txt>
      {action}
    </Card>
  );
}
