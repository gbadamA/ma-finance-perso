/**
 * Saisie de montant.
 *
 * Un `TextInput` numérique plutôt qu'un pavé maison : le clavier système est
 * déjà adapté à la devise et à la langue de l'appareil, et il reste accessible
 * (VoiceOver, TalkBack, clavier externe) — ce qu'un pavé dessiné à la main perd.
 *
 * L'aperçu formaté sous le champ montre à l'utilisateur **ce qui sera
 * enregistré** : sans lui, « 1250000 » et « 125000 » se ressemblent trop.
 */

import { useState } from "react";
import { TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { parseAmount, type CurrencyCode } from "@mfp/core";
import { useTheme } from "../lib/theme";
import { makeFormatters, tabular } from "../lib/format";
import { Overline, Txt } from "./primitives";

export function AmountInput({
  value,
  onChange,
  currency,
  label = "Montant",
  autoFocus = false,
  style,
}: {
  /** Entier d'unité mineure, `null` tant que rien d'exploitable n'est saisi. */
  value: number | null;
  onChange: (value: number | null) => void;
  currency: CurrencyCode;
  label?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const fmt = makeFormatters(currency);

  // Le texte brut est conservé à part : formater à chaque frappe déplacerait le
  // curseur et rendrait la correction d'une faute pénible.
  const [text, setText] = useState(value === null ? "" : String(value));

  const handle = (next: string) => {
    setText(next);
    onChange(parseAmount(next, currency));
  };

  return (
    <View style={style}>
      <Overline>{label}</Overline>
      <TextInput
        value={text}
        onChangeText={handle}
        placeholder="0"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numeric"
        autoFocus={autoFocus}
        style={[
          theme.typography.amountXl,
          tabular,
          {
            color: theme.colors.text,
            paddingVertical: theme.spacing.sm,
            fontWeight: "700",
          },
        ]}
      />
      <Txt variant="caption" muted style={tabular}>
        {value === null ? "Saisissez un montant" : fmt.amount(value)}
      </Txt>
    </View>
  );
}

/** Champ texte standard de l'app — même bordure et même rayon partout. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "numbers-and-punctuation";
  multiline?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Overline>{label}</Overline>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: theme.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          color: theme.colors.text,
          fontSize: theme.typography.body.fontSize,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
