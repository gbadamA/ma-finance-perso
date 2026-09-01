/**
 * Curseur tactile.
 *
 * Écrit sur Gesture Handler + Reanimated plutôt que d'ajouter
 * `@react-native-community/slider` : le pouce suit alors le doigt **sur le
 * thread UI**, sans aller-retour par JavaScript. C'est ce qui permet au
 * simulateur FIRE de rester fluide alors qu'il recalcule 481 points de
 * projection à chaque déplacement.
 */

import { useCallback, useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/theme";
import { tabular } from "../lib/format";
import { Overline, Txt } from "./primitives";

const THUMB = 26;
const TRACK = 6;

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  color,
  style,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const tint = color ?? theme.brand.accent;

  const [width, setWidth] = useState(0);
  const usable = Math.max(1, width - THUMB);
  const ratio = (value - min) / Math.max(1e-9, max - min);

  const offset = useSharedValue(0);
  const dragging = useSharedValue(0);
  const position = useSharedValue(0);

  /**
   * La position suit la valeur du parent tant qu'on ne touche pas — c'est ce
   * qui permet à un bouton « rétablir » de déplacer réellement le pouce.
   *
   * ⚠️ Dans un effet, jamais pendant le rendu : écrire dans une `sharedValue`
   * en plein rendu déclenche l'avertissement « Writing to `value` during
   * component render » et rend l'ordre des mises à jour indéterminé.
   */
  useEffect(() => {
    if (!dragging.value) position.value = ratio * usable;
  }, [ratio, usable, dragging, position]);

  const emit = useCallback(
    (next: number) => {
      const stepped = Math.round(next / step) * step;
      const clamped = Math.min(max, Math.max(min, stepped));
      if (clamped !== value) onChange(clamped);
    },
    [step, min, max, value, onChange],
  );

  const tap = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragging.value = 1;
      offset.value = position.value;
      runOnJS(tap)();
    })
    .onUpdate((e) => {
      position.value = Math.min(usable, Math.max(0, offset.value + e.translationX));
      runOnJS(emit)(min + (position.value / usable) * (max - min));
    })
    .onFinalize(() => {
      dragging.value = 0;
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value },
      { scale: withSpring(dragging.value ? 1.25 : 1, theme.motion.spring.select) },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({ width: position.value + THUMB / 2 }));

  return (
    <View style={style}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm }}>
        <Overline>{label}</Overline>
        <View style={{ flex: 1 }} />
        <Txt variant="amountSm" color={tint} style={tabular}>
          {format(value)}
        </Txt>
      </View>

      <GestureDetector gesture={pan}>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          // Zone tactile plus haute que la piste : un curseur de 6 px de haut
          // est impossible à attraper au doigt.
          style={{ height: THUMB + 12, justifyContent: "center" }}
        >
          <View
            style={{
              height: TRACK,
              borderRadius: TRACK / 2,
              backgroundColor: theme.colors.surfaceSunken,
              marginHorizontal: THUMB / 2,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: THUMB / 2,
                height: TRACK,
                borderRadius: TRACK / 2,
                backgroundColor: tint,
              },
              fillStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: theme.colors.surface,
                borderWidth: 3,
                borderColor: tint,
              },
              theme.elevation("card"),
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
