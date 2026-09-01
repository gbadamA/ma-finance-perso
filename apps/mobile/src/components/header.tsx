/**
 * En-tête des écrans secondaires (hors onglets) : titre + retour.
 * Factorisé pour que le bouton de retour soit toujours au même endroit et
 * garde la même zone tactile d'un écran à l'autre.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../lib/theme";
import { Overline, Touchable, Txt } from "./primitives";

export function ScreenHeader({
  title,
  overline,
  right,
}: {
  title: string;
  overline?: string;
  right?: ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <Touchable
        onPress={() => router.back()}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Retour"
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft color={theme.colors.text} size={20} />
      </Touchable>

      <View style={{ flex: 1 }}>
        {overline ? <Overline>{overline}</Overline> : null}
        <Txt variant="h2" numberOfLines={1}>
          {title}
        </Txt>
      </View>

      {right}
    </View>
  );
}
