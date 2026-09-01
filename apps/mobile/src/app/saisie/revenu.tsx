/**
 * Saisie des revenus du mois — §6.1 du cahier des charges.
 *
 * Toutes les sources sur un seul écran, pas un formulaire par source : c'est
 * une saisie mensuelle qu'on fait d'un bloc, comme on remplissait une colonne
 * du classeur. Un seul enregistrement pour l'ensemble.
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import {
  addMonths,
  formatMonth,
  parseAmount,
  sum,
  toMonthKey,
  type MonthKey,
} from "@mfp/core";
import { useData } from "../../lib/data";
import { useTheme } from "../../lib/theme";
import { setIncome } from "../../lib/mutations";
import { makeFormatters, tabular } from "../../lib/format";
import { Card, Divider, Dot, Overline, Touchable, Txt } from "../../components/primitives";

export default function SaisieRevenu() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, refresh } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);

  const [month, setMonth] = useState<MonthKey>(toMonthKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Valeurs saisies, indexées par source. Initialisées depuis la base au
   * changement de mois : ré-ouvrir un mois déjà rempli doit montrer ce qui y
   * est, pas un formulaire vide.
   */
  const existing = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of data.incomeEntries) {
      if (entry.month === month) map[entry.sourceId] = String(entry.amount);
    }
    return map;
  }, [data.incomeEntries, month]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [touchedMonth, setTouchedMonth] = useState(month);
  if (touchedMonth !== month) {
    // Changer de mois réinitialise la saisie sur les valeurs de ce mois-là.
    setTouchedMonth(month);
    setEdits({});
  }

  const valueFor = (sourceId: string) => edits[sourceId] ?? existing[sourceId] ?? "";

  const parsed = useMemo(
    () =>
      data.incomeSources.map((source) => ({
        source,
        amount: parseAmount(valueFor(source.id), data.settings.currency),
      })),
    [data.incomeSources, edits, existing, data.settings.currency],
  );

  const total = sum(parsed.map((p) => p.amount ?? 0));
  const filled = parsed.filter((p) => p.amount !== null);

  const submit = async () => {
    if (filled.length === 0) return;
    setBusy(true);
    setError(null);
    for (const row of filled) {
      const result = await setIncome({
        sourceId: row.source.id,
        month,
        amount: row.amount!,
      });
      if (result.error) {
        setBusy(false);
        setError(result.error);
        return;
      }
    }
    setBusy(false);
    await refresh();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + 100,
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Overline>Revenus du mois</Overline>
            <Txt variant="h2">Saisir</Txt>
          </View>
          <Touchable
            onPress={() => router.back()}
            haptic
            accessibilityLabel="Annuler"
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X color={theme.colors.text} size={20} />
          </Touchable>
        </View>

        <MonthPicker month={month} onChange={setMonth} />

        <Card padded={false}>
          {data.incomeSources.map((source, index) => {
            const value = valueFor(source.id);
            const alreadySaved = existing[source.id] !== undefined;
            return (
              <View key={source.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: theme.spacing.md,
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md,
                  }}
                >
                  <Dot
                    color={source.kind === "passif" ? theme.brand.accent : theme.brand.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{source.name}</Txt>
                    <Txt variant="caption" muted>
                      {source.kind === "passif" ? "Passif" : "Actif"}
                      {source.isInvestment ? " · investissement" : ""}
                      {alreadySaved ? " · déjà saisi" : ""}
                    </Txt>
                  </View>
                  <TextInput
                    value={value}
                    onChangeText={(next) =>
                      setEdits((prev) => ({ ...prev, [source.id]: next }))
                    }
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    style={[
                      theme.typography.amountSm,
                      tabular,
                      {
                        color: theme.colors.text,
                        backgroundColor: theme.colors.surfaceAlt,
                        borderRadius: theme.radius.sm,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        minWidth: 118,
                        textAlign: "right",
                      },
                    ]}
                  />
                </View>
                {index < data.incomeSources.length - 1 ? (
                  <Divider style={{ marginLeft: theme.spacing.lg }} />
                ) : null}
              </View>
            );
          })}
        </Card>

        <Card alt style={{ flexDirection: "row", alignItems: "center" }}>
          <Txt variant="h3" style={{ flex: 1 }}>
            Total du mois
          </Txt>
          <Txt variant="amountLg" style={tabular}>
            {fmt.amount(total)}
          </Txt>
        </Card>

        {error ? (
          <Txt variant="caption" color={theme.money.loss}>
            {error}
          </Txt>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: theme.spacing.lg,
          right: theme.spacing.lg,
          bottom: Math.max(insets.bottom, theme.spacing.md),
        }}
      >
        <Touchable
          onPress={submit}
          haptic
          disabled={filled.length === 0 || busy}
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: theme.spacing.sm,
              backgroundColor:
                filled.length > 0 ? theme.brand.primary : theme.colors.surfaceAlt,
              borderRadius: theme.radius.md,
              paddingVertical: theme.spacing.lg,
            },
            theme.elevation("floating"),
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Check
                color={filled.length > 0 ? "#FFFFFF" : theme.colors.textMuted}
                size={18}
              />
              <Txt
                variant="h3"
                color={filled.length > 0 ? "#FFFFFF" : theme.colors.textMuted}
              >
                Enregistrer {filled.length > 0 ? `(${filled.length})` : ""}
              </Txt>
            </>
          )}
        </Touchable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Sélecteur de mois par flèches.
 * Un `DateTimePicker` demanderait de choisir un jour, alors que la donnée est
 * mensuelle — et ferait croire que le jour compte.
 */
export function MonthPicker({
  month,
  onChange,
}: {
  month: MonthKey;
  onChange: (month: MonthKey) => void;
}) {
  const theme = useTheme();
  const current = toMonthKey(new Date());

  return (
    <Card style={{ flexDirection: "row", alignItems: "center" }}>
      <Touchable
        onPress={() => onChange(addMonths(month, -1))}
        haptic
        accessibilityLabel="Mois précédent"
        style={{ padding: theme.spacing.sm }}
      >
        <ChevronLeft color={theme.colors.text} size={22} />
      </Touchable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Overline>Mois</Overline>
        <Txt variant="h3">{formatMonth(month)}</Txt>
      </View>

      {/* On n'avance pas au-delà du mois courant : saisir un revenu futur
          fausserait toutes les moyennes mobiles. */}
      <Touchable
        onPress={() => onChange(addMonths(month, 1))}
        haptic
        disabled={month >= current}
        accessibilityLabel="Mois suivant"
        style={{ padding: theme.spacing.sm, opacity: month >= current ? 0.3 : 1 }}
      >
        <ChevronRight color={theme.colors.text} size={22} />
      </Touchable>
    </Card>
  );
}
