/**
 * Comptes & Patrimoine — module 2 du cahier des charges.
 * Remplace la feuille « Allocation de Fortune » : une ligne par compte, la
 * courbe d'évolution de la fortune, et l'accès à la saisie mensuelle.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Banknote, Landmark, PiggyBank, LineChart as LineIcon, Package } from "lucide-react-native";
import {
  formatMonth,
  latestBalance,
  lastChange,
  percentChange,
  totalEquity,
  wealthAt,
  wealthSeries,
  filterPeriod,
  type AccountKind,
  type PeriodPreset,
} from "@mfp/core";
import { useData } from "../../lib/data";
import { useTheme } from "../../lib/theme";
import { makeFormatters, tabular } from "../../lib/format";
import { PeriodSelector, Screen, SectionHeader, useChartWidth } from "../../components/layout";
import {
  Amount,
  Card,
  Divider,
  EmptyState,
  Enter,
  Overline,
  Touchable,
  Txt,
} from "../../components/primitives";
import { SeriesChart } from "../../components/charts";

const KIND_ICON: Record<AccountKind, typeof Banknote> = {
  liquide: Banknote,
  compte: Landmark,
  epargne: PiggyBank,
  investissement: LineIcon,
};

const KIND_LABEL: Record<AccountKind, string> = {
  liquide: "Liquide",
  compte: "Compte courant",
  epargne: "Épargne",
  investissement: "Investissement",
};

export default function Patrimoine() {
  const theme = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData();
  const [period, setPeriod] = useState<PeriodPreset>("12m");

  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const chartWidth = useChartWidth();

  const series = useMemo(
    () => wealthSeries(data.accounts, data.accountSnapshots, data.assets),
    [data],
  );
  const reference = series.at(-1)?.month ?? null;
  const shown = useMemo(
    () => filterPeriod(series, period, reference ?? undefined),
    [series, period, reference],
  );

  const breakdown = reference
    ? wealthAt(data.accounts, data.accountSnapshots, data.assets, reference)
    : null;
  const change = lastChange(series);

  /**
   * Chaque compte avec son solde et sa variation sur un mois.
   * La variation est calculée ici plutôt que dans le rendu : sinon elle est
   * recalculée à chaque frame de scroll.
   */
  const rows = useMemo(() => {
    if (!reference) return [];
    const previous = shown.length >= 2 ? shown.at(-2)!.month : null;
    return data.accounts
      .filter((a) => !a.archived)
      .map((account) => {
        const balance = latestBalance(data.accountSnapshots, account.id, reference);
        const before = previous
          ? latestBalance(data.accountSnapshots, account.id, previous)
          : balance;
        return {
          account,
          balance,
          delta: balance - before,
          percent: percentChange(before, balance),
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [data.accounts, data.accountSnapshots, reference, shown]);

  if (!reference || !breakdown) {
    return (
      <Screen tabbed refreshing={loading} onRefresh={() => void refresh()}>
        <Txt variant="h1">Patrimoine</Txt>
        <EmptyState
          title="Aucun relevé"
          message="Saisissez les soldes de vos comptes pour voir votre fortune évoluer mois après mois."
        />
      </Screen>
    );
  }

  return (
    <Screen tabbed refreshing={loading} onRefresh={() => void refresh()}>
      <View>
        <Overline>Patrimoine</Overline>
        <Txt variant="h1">{formatMonth(reference)}</Txt>
      </View>

      <Enter index={0}>
        <Card style={{ gap: theme.spacing.sm }}>
          <Overline>Fortune totale</Overline>
          <Amount value={breakdown.total} format={fmt.amount} variant="amountXl" />
          <Txt
            variant="caption"
            color={change.absolute >= 0 ? theme.money.gain : theme.money.loss}
            style={tabular}
          >
            {fmt.amount(change.absolute, { signed: true })}
            {change.percent !== null ? `  (${fmt.percent(change.percent)})` : ""} vs mois précédent
          </Txt>

          <Divider style={{ marginVertical: theme.spacing.md }} />

          <Breakdown label="Comptes" value={fmt.amount(breakdown.accountsTotal)} />
          <Breakdown label="Valeur des biens" value={fmt.amount(breakdown.assetsValue)} />
          <Breakdown
            label="Dettes adossées"
            value={fmt.amount(-breakdown.assetsDebt)}
            color={breakdown.assetsDebt > 0 ? theme.money.loss : undefined}
          />
        </Card>
      </Enter>

      <PeriodSelector value={period} onChange={setPeriod} />

      <Enter index={1}>
        <Card>
          <SectionHeader title="Évolution" subtitle={`${shown.length} mois affichés`} />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SeriesChart data={shown} width={chartWidth} format={fmt.compact} />
          </View>
        </Card>
      </Enter>

      <SectionHeader title="Comptes" subtitle={`${rows.length} comptes actifs`} />

      {rows.map((row, index) => {
        const Icon = KIND_ICON[row.account.kind];
        return (
          <Enter key={row.account.id} index={index + 2}>
            <Card padded={false}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.md,
                  padding: theme.spacing.lg,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radius.sm,
                    backgroundColor: theme.colors.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon color={theme.brand.primary} size={19} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">{row.account.name}</Txt>
                  <Txt variant="caption" muted>
                    {KIND_LABEL[row.account.kind]}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Amount value={row.balance} format={fmt.amount} variant="amountSm" />
                  {row.delta !== 0 ? (
                    <Txt
                      variant="caption"
                      color={row.delta > 0 ? theme.money.gain : theme.money.loss}
                      style={[tabular, { fontSize: 11 }]}
                    >
                      {fmt.amount(row.delta, { signed: true, withSymbol: false })}
                    </Txt>
                  ) : null}
                </View>
              </View>
            </Card>
          </Enter>
        );
      })}

      <Enter index={rows.length + 2}>
        <Touchable
          onPress={() => router.push("/assets")}
          haptic
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.md,
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.md,
            padding: theme.spacing.lg,
          }}
        >
          <Package color={theme.brand.accent} size={20} />
          <View style={{ flex: 1 }}>
            <Txt variant="h3">Biens de valeur</Txt>
            <Txt variant="caption" muted>
              {data.assets.length} biens · net {fmt.compact(totalEquity(data.assets))}
            </Txt>
          </View>
        </Touchable>
      </Enter>
    </Screen>
  );
}

function Breakdown({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Txt variant="caption" muted style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="amountSm" color={color} style={tabular}>
        {value}
      </Txt>
    </View>
  );
}
