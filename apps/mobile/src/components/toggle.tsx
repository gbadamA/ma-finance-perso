/**
 * Interrupteur.
 *
 * Écrit à la main plutôt qu'avec le `Switch` de React Native : celui-ci prend
 * la couleur d'accent du système et refuse la nôtre sur iOS, ce qui casserait
 * la DA sur la moitié des appareils.
 */

import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../lib/theme";
import { Touchable, Txt } from "./primitives";

const TRACK_W = 48;
const TRACK_H = 28;
const KNOB = 22;

export function Toggle({
  value,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  const trackStyle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(value ? theme.brand.accent : theme.colors.surfaceSunken, {
        duration: theme.motion.duration.quick,
      }),
    }),
    [value, theme],
  );

  const knobStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: withSpring(value ? TRACK_W - KNOB - 3 : 3, theme.motion.spring.select) },
      ],
    }),
    [value, theme],
  );

  return (
    <Touchable
      onPress={() => onChange(!value)}
      haptic
      disabled={disabled}
      noScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.lg,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="h3">{label}</Txt>
        {hint ? (
          <Txt variant="caption" muted style={{ marginTop: 2 }}>
            {hint}
          </Txt>
        ) : null}
      </View>

      <Animated.View
        style={[
          { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, justifyContent: "center" },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: "#FFFFFF",
            },
            theme.elevation("card"),
            knobStyle,
          ]}
        />
      </Animated.View>
    </Touchable>
  );
}
