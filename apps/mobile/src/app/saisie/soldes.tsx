/**
 * Mise à jour mensuelle des soldes — §6.1 du cahier des charges.
 *
 * C'est le remplaçant direct de la saisie sur 7 feuilles Excel : comptes,
 * placements et valeur des biens en **un seul passage**, avec la fortune
 * recalculée en direct au-dessus. Le classeur obligeait à ouvrir chaque
 * feuille et à reporter les totaux à la main.
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { colorForKey, wealthColors } from "@mfp/design-tokens";
import {
  labelFor,
  latestBalance,
  parseAmount,
  sum,
  toMonthKey,
  totalEquity,
  type MonthKey,
} from "@mfp/core";
import { useData } from "../../lib/data";
import { useTheme } from "../../lib/theme";
import { setAccountBalances, setAssetValue, setInvestmentAmounts } from "../../lib/mutations";
import { makeFormatters, tabular } from "../../lib/format";
import { Card, Divider, Dot, Overline, Touchable, Txt } from "../../components/primitives";
import { MonthPicker } from "./revenu";

export default function SaisieSoldes() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, refresh } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const currency = data.settings.currency;

  const [month, setMonth] = useState<MonthKey>(toMonthKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Changer de mois repart des valeurs de ce mois-là.
  const [seenMonth, setSeenMonth] = useState(month);
  if (seenMonth !== month) {
    setSeenMonth(month);
    setEdits({});
  }

  /** Valeur pré-remplie : le dernier solde connu, qu'il suffit souvent d'ajuster. */
  const defaultFor = (key: string, fallback: number) =>
    edits[key] ?? String(fallback);

  const accountRows = data.accounts
    .filter((a) => !a.archived)
    .map((account) => {
      const previous = latestBalance(data.accountSnapshots, account.id, month);
      const raw = defaultFor(`acc:${account.id}`, previous);
      return { account, raw, value: parseAmount(raw, currency), previous };
    });

  const investmentClasses = useMemo(() => {
    const fromTargets = data.targets.map((t) => t.assetClass);
    const fromSnapshots = data.investmentSnapshots.map((s) => s.assetClass);
    return [...new Set([...fromTargets, ...fromSnapshots])];
  }, [data.targets, data.investmentSnapshots]);

  const investmentRows = investmentClasses.map((assetClass) => {
    const previous =
      [...data.investmentSnapshots]
        .filter((s) => s.assetClass === assetClass && s.month <= month)
        .sort((a, b) => a.month.localeCompare(b.month))
        .at(-1)?.amount ?? 0;
    const raw = defaultFor(`inv:${assetClass}`, previous);
    return { assetClass, raw, value: parseAmount(raw, currency), previous };
  });

  const assetRows = data.assets.map((asset) => {
    const raw = defaultFor(`ast:${asset.id}`, asset.currentValue);
    return { asset, raw, value: parseAmount(raw, currency) };
  });

  /** Fortune recalculée en direct à partir de la saisie en cours. */
  const projectedWealth =
    sum(accountRows.map((r) => r.value ?? r.previous)) +
    sum(assetRows.map((r) => (r.value ?? r.asset.currentValue) - r.asset.debt));

  const currentWealth =
    sum(accountRows.map((r) => r.previous)) + totalEquity(data.assets);
  const delta = projectedWealth - currentWealth;

  const submit = async () => {
    setBusy(true);
    setError(null);

    const fail = (message: string) => {
      setBusy(false);
      setError(message);
    };

    const balances = accountRows
      .filter((r) => r.value !== null)
      .map((r) => ({ accountId: r.account.id, balance: r.value! }));
    const balanceResult = await setAccountBalances(month, balances);
    if (balanceResult.error) return fail(balanceResult.error);

    const investments = investmentRows
      .filter((r) => r.value !== null)
      .map((r) => ({ assetClass: r.assetClass, amount: r.value! }));
    const investmentResult = await setInvestmentAmounts(month, investments);
    if (investmentResult.error) return fail(investmentResult.error);

    // Les valeurs de biens changent rarement : on n'écrit que celles qui ont bougé.
    for (const row of assetRows) {
      if (row.value === null || row.value === row.asset.currentValue) continue;
      const result = await setAssetValue(row.asset.id, row.value);
      if (result.error) return fail(result.error);
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
            <Overline>Point mensuel</Overline>
            <Txt variant="h2">Mettre à jour</Txt>
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

        {/* Fortune recalculée pendant la saisie — le retour immédiat qui manquait à Excel. */}
        <Card style={{ gap: theme.spacing.xs }}>
          <Overline>Fortune après saisie</Overline>
          <Txt variant="amountXl" style={tabular}>
            {fmt.amount(projectedWealth)}
          </Txt>
          {delta !== 0 ? (
            <Txt
              variant="caption"
              color={delta > 0 ? theme.money.gain : theme.money.loss}
              style={tabular}
            >
              {fmt.amount(delta, { signed: true })} vs dernier relevé
            </Txt>
          ) : null}
        </Card>

        <BalanceGroup
          title="Comptes"
          rows={accountRows.map((r) => ({
            key: `acc:${r.account.id}`,
            label: r.account.name,
            hint: r.previous > 0 ? `précédent ${fmt.compact(r.previous)}` : undefined,
            color: theme.brand.primary,
            raw: r.raw,
          }))}
          onEdit={(key, value) => setEdits((prev) => ({ ...prev, [key]: value }))}
        />

        {investmentRows.length > 0 ? (
          <BalanceGroup
            title="Placements"
            subtitle="Par classe d'actif — alimente le portefeuille"
            rows={investmentRows.map((r) => ({
              key: `inv:${r.assetClass}`,
              label: labelFor(r.assetClass),
              hint: r.previous > 0 ? `précédent ${fmt.compact(r.previous)}` : undefined,
              color: colorForKey(r.assetClass, wealthColors),
              raw: r.raw,
            }))}
            onEdit={(key, value) => setEdits((prev) => ({ ...prev, [key]: value }))}
          />
        ) : null}

        {assetRows.length > 0 ? (
          <BalanceGroup
            title="Biens de valeur"
            subtitle="Valeur estimée aujourd'hui"
            rows={assetRows.map((r) => ({
              key: `ast:${r.asset.id}`,
              label: r.asset.name,
              hint: r.asset.debt > 0 ? `dette ${fmt.compact(r.asset.debt)}` : r.asset.category,
              color: theme.brand.accent,
              raw: r.raw,
            }))}
            onEdit={(key, value) => setEdits((prev) => ({ ...prev, [key]: value }))}
          />
        ) : null}

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
          disabled={busy}
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: theme.spacing.sm,
              backgroundColor: theme.brand.primary,
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
              <Check color="#FFFFFF" size={18} />
              <Txt variant="h3" color="#FFFFFF">
                Enregistrer le point
              </Txt>
            </>
          )}
        </Touchable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */

type BalanceRow = {
  key: string;
  label: string;
  hint?: string;
  color: string;
  raw: string;
};

function BalanceGroup({
  title,
  subtitle,
  rows,
  onEdit,
}: {
  title: string;
  subtitle?: string;
  rows: readonly BalanceRow[];
  onEdit: (key: string, value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View>
        <Overline>{title}</Overline>
        {subtitle ? (
          <Txt variant="caption" muted>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <Card padded={false}>
        {rows.map((row, index) => (
          <View key={row.key}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
              }}
            >
              <Dot color={row.color} />
              <View style={{ flex: 1 }}>
                <Txt variant="h3" numberOfLines={1}>
                  {row.label}
                </Txt>
                {row.hint ? (
                  <Txt variant="caption" muted style={tabular}>
                    {row.hint}
                  </Txt>
                ) : null}
              </View>
              <TextInput
                value={row.raw}
                onChangeText={(value) => onEdit(row.key, value)}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                selectTextOnFocus
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
                    minWidth: 122,
                    textAlign: "right",
                  },
                ]}
              />
            </View>
            {index < rows.length - 1 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
          </View>
        ))}
      </Card>
    </View>
  );
}
