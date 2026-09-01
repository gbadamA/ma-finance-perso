/**
 * Écran de verrouillage.
 *
 * Rendu **par-dessus toute l'app** quand le verrou est actif : le contenu ne
 * doit pas être visible une fraction de seconde avant d'être masqué, sinon la
 * capture d'écran du sélecteur d'applications montre le patrimoine.
 */

import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { Fingerprint } from "lucide-react-native";
import { useTheme } from "../lib/theme";
import { useLock } from "../lib/lock";
import { Touchable, Txt } from "./primitives";

export function LockScreen() {
  const theme = useTheme();
  const { unlock } = useLock();
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    const ok = await unlock();
    setFailed(!ok);
  };

  // Demande l'empreinte dès l'affichage : faire taper un bouton d'abord ajoute
  // un geste à chaque ouverture de l'app, plusieurs fois par jour.
  useEffect(() => {
    void attempt();
  }, []);

  return (
    <LinearGradient
      colors={theme.gradient.hero as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
    >
      <Animated.View
        entering={FadeIn.duration(theme.motion.duration.slow)}
        style={{ alignItems: "center", gap: theme.spacing.lg }}
      >
        <Image
          source={require("../../assets/images/logo-itekt.png")}
          style={{ width: 96, height: 96, borderRadius: theme.radius.lg }}
          resizeMode="contain"
        />
        <Txt variant="h1" color="#FFFFFF">
          Ma Finance Perso
        </Txt>
        <Txt variant="caption" color={theme.brand.accentSoft} style={{ textAlign: "center" }}>
          {failed
            ? "Déverrouillage annulé. Réessayez pour accéder à vos données."
            : "Déverrouillez pour accéder à vos données."}
        </Txt>
      </Animated.View>

      <Touchable
        onPress={attempt}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Déverrouiller"
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.xxl,
            paddingVertical: theme.spacing.lg,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.brand.accent,
          },
          theme.elevation("accentGlow"),
        ]}
      >
        <Fingerprint color={theme.gradient.hero[0]} size={22} />
        <Txt variant="h3" color={theme.gradient.hero[0]}>
          Déverrouiller
        </Txt>
      </Touchable>
    </LinearGradient>
  );
}
