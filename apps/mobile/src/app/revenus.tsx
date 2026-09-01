/**
 * Revenus — module 3 du cahier des charges.
 *
 * La feuille Excel portait **20 bar charts** identiques, un par année. Ici :
 * un seul graphique et un sélecteur de période (§3.3). Les blocs « Passif » et
 * « Actif » du classeur deviennent les deux séries empilées.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { Briefcase, Coins, TrendingUp } from "lucide-react-native";
import {
  average,
  filterPeriod,
  formatMonth,
  incomeByMonth,
  type PeriodPreset,
} from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { makeFormatters, tabular } from "../lib/format";
import { PeriodSelector, Screen, SectionHeader, useChartWidth } from "../components/layout";
import {
  Amount,
  Card,
  Dot,
  EmptyState,
  Enter,
  Overline,
  ProgressBar,
  Txt,
} from "../components/primitives";
import { StackedIncomeChart } from "../components/charts";
import { ScreenHeader } from "../components/header";

export default function Revenus() {
  const theme = useTheme();
  const { data } = useData();
  const [period, setPeriod] = useState<PeriodPreset>("12m");

  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const chartWidth = useChartWidth();

  const analysis = useMemo(() => {
    const monthly = incomeByMonth(data.incomeSources, data.incomeEntries);
    const shown = filterPeriod(monthly, period);
    const months = new Set(shown.map((m) => m.month));

    // Total par source sur la période, pour le classement du bas d'écran.
    const bySource = new Map<string, number>();
    for (const entry of data.incomeEntries) {
      if (!months.has(entry.month)) continue;
      bySource.set(entry.sourceId, (bySource.get(entry.sourceId) ?? 0) + entry.amount);
    }
    const grandTotal = [...bySource.values()].reduce((a, b) => a + b, 0);

    return {
      shown,
      averageTotal: average(shown.map((m) => m.total)),
      averagePassive: average(shown.map((m) => m.passive)),
      averageActive: average(shown.map((m) => m.active)),
      averageExInvestment: average(shown.map((m) => m.totalExcludingInvestment)),
      sources: data.incomeSources
        .map((source) => ({
          source,
          total: bySource.get(source.id) ?? 0,
          percent: grandTotal === 0 ? 0 : ((bySource.get(source.id) ?? 0) / grandTotal) * 100,
        }))
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total),
    };
  }, [data.incomeSources, data.incomeEntries, period]);

  /**
   * Part passive du revenu : l'indicateur qui compte pour l'indépendance
   * financière — bien plus que le revenu total.
   */
  const passiveShare =
    analysis.averageTotal === 0 ? 0 : (analysis.averagePassive / analysis.averageTotal) * 100;

  if (data.incomeEntries.length === 0) {
    return (
      <Screen>
        <ScreenHeader overline="Module 3" title="Revenus" />
        <EmptyState
          title="Aucun revenu saisi"
          message="Enregistrez vos revenus mensuels pour suivre la part passive de votre revenu total."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Module 3"
        title="Revenus"
        right={
          analysis.shown.length > 0 ? (
            <Txt variant="caption" muted>
              {formatMonth(analysis.shown.at(-1)!.month)}
            </Txt>
          ) : undefined
        }
      />

      <PeriodSelector value={period} onChange={setPeriod} />

      <Enter index={0}>
        <Card style={{ gap: theme.spacing.md }}>
          <Overline>Revenu moyen mensuel</Overline>
          <Amount value={analysis.averageTotal} format={fmt.amount} variant="amountXl" />
          <Txt variant="caption" muted>
            Hors investissement : {fmt.amount(analysis.averageExInvestment)}
          </Txt>

          <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Txt variant="caption" muted style={{ flex: 1 }}>
                Part passive
              </Txt>
              <Txt variant="amountSm" color={theme.brand.accent} style={tabular}>
                {passiveShare.toFixed(1).replace(".", ",")} %
              </Txt>
            </View>
            <ProgressBar percent={passiveShare} color={theme.brand.accent} />
          </View>
        </Card>
      </Enter>

      <Enter index={1}>
        <Card>
          <SectionHeader title="Actif et passif" subtitle="Un graphique, toutes les périodes" />
          <View style={{ marginTop: theme.spacing.lg }}>
            <StackedIncomeChart data={analysis.shown} width={chartWidth} format={fmt.compact} />
          </View>
        </Card>
      </Enter>

      <Enter index={2}>
        <Card>
          <View style={{ flexDirection: "row", gap: theme.spacing.lg }}>
            <KindStat
              icon={<Briefcase color={theme.brand.primary} size={18} />}
              label="Actif"
              value={fmt.amount(analysis.averageActive)}
              color={theme.brand.primary}
            />
            <KindStat
              icon={<Coins color={theme.brand.accent} size={18} />}
              label="Passif"
              value={fmt.amount(analysis.averagePassive)}
              color={theme.brand.accent}
            />
          </View>
        </Card>
      </Enter>

      <SectionHeader title="Par source" subtitle="Total sur la période" />

      {analysis.sources.map((row, index) => (
        <Enter key={row.source.id} index={index + 3}>
          <Card style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Dot color={row.source.kind === "passif" ? theme.brand.accent : theme.brand.primary} />
              <Txt variant="h3" style={{ flex: 1 }}>
                {row.source.name}
              </Txt>
              {row.source.isInvestment ? (
                <TrendingUp color={theme.colors.textMuted} size={14} />
              ) : null}
              <Amount value={row.total} format={fmt.amount} variant="amountSm" />
            </View>
            <ProgressBar
              percent={row.percent}
              color={row.source.kind === "passif" ? theme.brand.accent : theme.brand.primary}
              height={6}
            />
            <Txt variant="caption" muted style={tabular}>
              {row.source.kind === "passif" ? "Passif" : "Actif"}
              {row.source.isInvestment ? " · investissement" : ""} ·{" "}
              {row.percent.toFixed(1).replace(".", ",")} %
            </Txt>
          </Card>
        </Enter>
      ))}
    </Screen>
  );
}

function KindStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, gap: theme.spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Overline>{label}</Overline>
      </View>
      <Txt variant="amountMd" color={color} style={tabular}>
        {value}
      </Txt>
    </View>
  );
}
