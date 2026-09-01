/**
 * Bouton d'ajout rapide.
 *
 * Trois actions, pas une : ajouter une dépense se fait tous les jours, saisir
 * ses revenus et faire le point mensuel une fois par mois. Un bouton unique
 * qui n'ouvrirait que la dépense forcerait à passer par un menu pour les deux
 * autres — alors que ce sont eux qui remplacent le classeur.
 *
 * ⚠️ Positionné **au-dessus de la tab bar**, elle-même calée sur les insets :
 * il ne recouvre jamais les gestes système (§3.6 du claudemap).
 */

import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarCheck, Coins, Plus, Receipt } from "lucide-react-native";
import { useTheme } from "../lib/theme";
import { Touchable, Txt } from "./primitives";
import { TAB_BAR_HEIGHT, TAB_BAR_LIFT } from "./layout";

const FAB = 56;

export function QuickAdd() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const rotation = useSharedValue(0);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotation.value = withSpring(next ? 45 : 0, theme.motion.spring.select);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const go = (path: "/saisie/depense" | "/saisie/revenu" | "/saisie/soldes") => {
    setOpen(false);
    rotation.value = withSpring(0, theme.motion.spring.select);
    router.push(path);
  };

  const bottom = Math.max(insets.bottom, TAB_BAR_LIFT) + TAB_BAR_HEIGHT + theme.spacing.lg;

  return (
    <>
      {/* Voile : fermer en tapant à côté est le geste attendu, et il évite
          d'avoir à viser le petit bouton une seconde fois. */}
      {open ? (
        <AnimatedOverlay onPress={toggle} color={theme.colors.scrim} />
      ) : null}

      <View
        pointerEvents="box-none"
        style={{ position: "absolute", right: theme.spacing.lg, bottom }}
      >
        {open ? (
          <View style={{ alignItems: "flex-end", gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
            <Action
              index={2}
              label="Point mensuel"
              icon={<CalendarCheck color={theme.brand.primary} size={19} />}
              onPress={() => go("/saisie/soldes")}
            />
            <Action
              index={1}
              label="Revenu"
              icon={<Coins color={theme.brand.primary} size={19} />}
              onPress={() => go("/saisie/revenu")}
            />
            <Action
              index={0}
              label="Dépense"
              icon={<Receipt color={theme.brand.primary} size={19} />}
              onPress={() => go("/saisie/depense")}
            />
          </View>
        ) : null}

        <Touchable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={open ? "Fermer le menu d'ajout" : "Ajouter"}
          accessibilityState={{ expanded: open }}
          style={[
            {
              width: FAB,
              height: FAB,
              borderRadius: FAB / 2,
              backgroundColor: theme.brand.accent,
              alignItems: "center",
              justifyContent: "center",
            },
            theme.elevation("accentGlow"),
          ]}
        >
          <Animated.View style={iconStyle}>
            {/* Texte sombre sur l'orange — la règle de contraste de la DA. */}
            <Plus color={theme.gradient.hero[0]} size={26} strokeWidth={2.5} />
          </Animated.View>
        </Touchable>
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Action({
  index,
  label,
  icon,
  onPress,
}: {
  index: number;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(theme.motion.duration.quick).delay(index * theme.motion.stagger)}
      exiting={FadeOut.duration(theme.motion.duration.instant)}
    >
      <Touchable
        onPress={onPress}
        haptic
        accessibilityRole="button"
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            paddingLeft: theme.spacing.lg,
            paddingRight: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          theme.elevation("floating"),
        ]}
      >
        {icon}
        <Txt variant="h3">{label}</Txt>
      </Touchable>
    </Animated.View>
  );
}

function AnimatedOverlay({ onPress, color }: { onPress: () => void; color: string }) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(theme.motion.duration.quick)}
      exiting={FadeOut.duration(theme.motion.duration.quick)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: color,
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={onPress} accessibilityLabel="Fermer" />
    </Animated.View>
  );
}
