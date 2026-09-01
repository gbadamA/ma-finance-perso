/**
 * Dépenses — module 4 du cahier des charges.
 *
 * Les **deux** camemberts identiques de la feuille Excel deviennent **un**
 * camembert + sélecteur de période. Les tendances par catégorie (« Transport
 * +18 % ») n'existaient pas dans le classeur : c'est ce que l'automatisation
 * rend possible et c'est ce qui déclenche une décision.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import {
  averageMonthlyExpense,
  categoryTotals,
  categoryTrends,
  expenseSlices,
  expensesByMonth,
  filterPeriod,
  formatMonth,
  periodStart,
  type PeriodPreset,
} from "@mfp/core";
import { useData } from "../../lib/data";
import { useTheme } from "../../lib/theme";
import { makeFormatters, tabular } from "../../lib/format";
import { PeriodSelector, Screen, SectionHeader, useChartWidth } from "../../components/layout";
import {
  Amount,
  Card,
  Dot,
  EmptyState,
  Enter,
  Overline,
  ProgressBar,
  Txt,
} from "../../components/primitives";
import { DonutChart, SeriesChart, sliceColor } from "../../components/charts";

export default function Depenses() {
  const theme = useTheme();
  const { data, loading, refresh } = useData();
  const [period, setPeriod] = useState<PeriodPreset>("12m");

  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const chartWidth = useChartWidth();

  const analysis = useMemo(() => {
    const monthly = expensesByMonth(data.expenseEntries);
    const reference = monthly.at(-1)?.month;
    const shown = filterPeriod(monthly, period, reference);
    const months = new Set(shown.map((p) => p.month));
    const entries = data.expenseEntries.filter((e) => months.has(e.date.slice(0, 7)));

    // Période précédente de MÊME longueur, pour que la comparaison ait un sens.
    const start = shown[0]?.month;
    const previousEntries =
      start && shown.length > 0
        ? data.expenseEntries.filter((e) => {
            const m = e.date.slice(0, 7);
            const previousStart = periodStart(period, start) ?? "0000-00";
            return m >= previousStart && m < start;
          })
        : [];

    const totals = categoryTotals(entries, data.expenseCategories);
    return {
      shown,
      totals,
      slices: expenseSlices(totals),
      average: averageMonthlyExpense(shown),
      trends: categoryTrends(totals, categoryTotals(previousEntries, data.expenseCategories)),
      total: totals.reduce((acc, t) => acc + t.total, 0),
      count: entries.length,
    };
  }, [data.expenseEntries, data.expenseCategories, period]);

  const trendByKey = useMemo(
    () => new Map(analysis.trends.map((t) => [t.key, t])),
    [analysis.trends],
  );

  if (data.expenseEntries.length === 0) {
    return (
      <Screen tabbed refreshing={loading} onRefresh={() => void refresh()}>
        <Txt variant="h1">Dépenses</Txt>
        <EmptyState
          title="Aucune dépense"
          message="Ajoutez vos dépenses au fil de l'eau : la répartition par catégorie se construit toute seule."
        />
      </Screen>
    );
  }

  return (
    <Screen tabbed refreshing={loading} onRefresh={() => void refresh()}>
      <View>
        <Overline>Dépenses</Overline>
        <Txt variant="h1">
          {analysis.shown.length > 0
            ? `${formatMonth(analysis.shown[0]!.month, false)} → ${formatMonth(analysis.shown.at(-1)!.month)}`
            : "Dépenses"}
        </Txt>
      </View>

      <PeriodSelector value={period} onChange={setPeriod} />

      <Enter index={0}>
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Overline>Moyenne mensuelle</Overline>
              <Amount value={analysis.average} format={fmt.amount} variant="amountLg" />
            </View>
            <View style={{ flex: 1 }}>
              <Overline>Total période</Overline>
              <Amount value={analysis.total} format={fmt.amount} variant="amountLg" />
            </View>
          </View>
          <Txt variant="caption" muted>
            {analysis.count} dépenses saisies sur {analysis.shown.length} mois
          </Txt>
        </Card>
      </Enter>

      <Enter index={1}>
        <Card>
          <SectionHeader title="Répartition par catégorie" />
          <View style={{ alignItems: "center", marginVertical: theme.spacing.lg }}>
            <DonutChart
              slices={analysis.slices}
              scale="expense"
              centerLabel="Par mois"
              centerValue={fmt.compact(analysis.average)}
            />
          </View>
        </Card>
      </Enter>

      <Enter index={2}>
        <Card>
          <SectionHeader title="Évolution mensuelle" />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SeriesChart
              data={analysis.shown}
              width={chartWidth}
              format={fmt.compact}
              color={theme.money.loss}
              area={false}
            />
          </View>
        </Card>
      </Enter>

      <SectionHeader title="Détail" subtitle="Moyenne par mois et tendance" />

      {analysis.totals.map((total, index) => {
        const slice = analysis.slices.find((s) => s.key === total.key);
        const color = slice ? sliceColor(slice, "expense") : theme.colors.textMuted;
        const trend = trendByKey.get(total.key);
        const up = (trend?.changePercent ?? 0) > 0;

        return (
          <Enter key={total.categoryId} index={index + 3}>
            <Card style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                <Dot color={color} />
                <Txt variant="h3" style={{ flex: 1 }}>
                  {total.label}
                </Txt>
                <Amount value={total.monthlyAverage} format={fmt.amount} variant="amountSm" />
              </View>

              <ProgressBar percent={total.percent} color={color} height={6} />

              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                <Txt variant="caption" muted style={[tabular, { flex: 1 }]}>
                  {total.percent.toFixed(1).replace(".", ",")} % · {total.count} dépenses
                </Txt>
                {trend?.changePercent !== null && trend?.changePercent !== undefined ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {up ? (
                      <TrendingUp color={theme.money.loss} size={13} />
                    ) : (
                      <TrendingDown color={theme.money.gain} size={13} />
                    )}
                    <Txt
                      variant="caption"
                      color={up ? theme.money.loss : theme.money.gain}
                      style={tabular}
                    >
                      {fmt.percent(trend.changePercent, 0)}
                    </Txt>
                  </View>
                ) : null}
              </View>
            </Card>
          </Enter>
        );
      })}
    </Screen>
  );
}
