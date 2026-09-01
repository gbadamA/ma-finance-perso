/**
 * Vue d'ensemble — module 1 du cahier des charges.
 * Reproduit les 7 visualisations de la feuille « Dashboard Financier »,
 * toutes pilotées par **un seul** sélecteur de période.
 */

import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowUpRight, Scale, Settings2, TrendingDown, TrendingUp, Wallet } from "lucide-react-native";
import { buildOverview, formatMonth, type PeriodPreset } from "@mfp/core";
import { useData } from "../../lib/data";
import { useAuth } from "../../lib/auth";
import { notifyDrift, notifyGoalReached } from "../../lib/notifications";
import { useTheme } from "../../lib/theme";
import { makeFormatters, tabular } from "../../lib/format";
import {
  HeroCard,
  PeriodSelector,
  Screen,
  SectionHeader,
  useChartWidth,
} from "../../components/layout";
import {
  Amount,
  Badge,
  Card,
  Divider,
  Enter,
  Overline,
  Touchable,
  Txt,
} from "../../components/primitives";
import { DonutChart, SeriesChart, SliceLegend, StackedIncomeChart } from "../../components/charts";

export default function VueDEnsemble() {
  const theme = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData();
  const { isDemo } = useAuth();
  const [period, setPeriod] = useState<PeriodPreset>("12m");

  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const overview = useMemo(() => buildOverview({ ...data, period }), [data, period]);
  const chartWidth = useChartWidth();

  /**
   * Alertes locales (§3.1). Déclenchées ici parce que c'est le seul écran que
   * l'utilisateur ouvre à coup sûr — et `notifyOnce` garantit qu'une même
   * situation ne notifie pas deux fois.
   */
  useEffect(() => {
    if (isDemo || overview.isEmpty) return;
    if (overview.investmentsKpi.needsRebalance) {
      void notifyDrift(overview.investmentsKpi.maxDriftPoints, data.settings.driftThreshold);
    }
  }, [
    isDemo,
    overview.isEmpty,
    overview.investmentsKpi.needsRebalance,
    overview.investmentsKpi.maxDriftPoints,
    data.settings.driftThreshold,
  ]);

  useEffect(() => {
    if (isDemo || overview.isEmpty) return;
    // Un objectif dont le franchissement est projeté à 0 mois est atteint.
    for (const goal of data.goals) {
      const reached =
        goal.kind === "fortune"
          ? overview.totalWealth >= goal.targetAmount
          : overview.investmentsKpi.total > 0 &&
            (overview.investmentsKpi.total * (data.settings.safeWithdrawalRate / 100)) / 12 >=
              goal.targetAmount;
      if (reached) void notifyGoalReached(goal.id, goal.label);
    }
  }, [
    isDemo,
    overview.isEmpty,
    overview.totalWealth,
    overview.investmentsKpi.total,
    data.goals,
    data.settings.safeWithdrawalRate,
  ]);

  const rising = overview.wealthChange.absolute >= 0;

  return (
    <Screen tabbed refreshing={loading} onRefresh={() => void refresh()}>
      {/* ---------------- En-tête ---------------- */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Overline>Vue d'ensemble</Overline>
          <Txt variant="h1">
            {overview.referenceMonth ? formatMonth(overview.referenceMonth) : "Bienvenue"}
          </Txt>
        </View>
        {isDemo ? (
          <Badge label="DÉMO" color={theme.gradient.hero[0]} background={theme.brand.accent} />
        ) : null}
        <Touchable
          onPress={() => router.push("/reglages")}
          haptic
          accessibilityLabel="Réglages"
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Settings2 color={theme.colors.textMuted} size={18} />
        </Touchable>
      </View>

      {/* ---------------- Fortune totale ---------------- */}
      <Enter index={0}>
        <HeroCard warm={overview.investmentsKpi.needsRebalance === false && rising}>
          <Overline color={theme.brand.accentSoft}>Fortune totale</Overline>
          <Amount
            value={overview.totalWealth}
            format={fmt.amount}
            variant="amountXl"
            color="#FFFFFF"
            style={{ marginTop: theme.spacing.xs }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
            }}
          >
            {rising ? (
              <TrendingUp color={theme.money.gain} size={16} />
            ) : (
              <TrendingDown color={theme.money.loss} size={16} />
            )}
            <Txt
              variant="caption"
              color={rising ? theme.money.gain : theme.money.loss}
              style={tabular}
            >
              {fmt.amount(overview.wealthChange.absolute, { signed: true })}
              {overview.wealthChange.percent !== null
                ? `  (${fmt.percent(overview.wealthChange.percent)})`
                : ""}
            </Txt>
            <Txt variant="caption" color={theme.brand.accentSoft}>
              ce mois-ci
            </Txt>
          </View>

          <Divider style={{ marginVertical: theme.spacing.lg, opacity: 0.25 }} />

          <View style={{ flexDirection: "row" }}>
            <HeroStat label="Comptes" value={fmt.compact(overview.accountsTotal)} />
            <HeroStat label="Biens" value={fmt.compact(overview.assetsEquity)} />
            <HeroStat
              label="Santé"
              value={
                overview.health.runwayYears === null
                  ? "—"
                  : `${overview.health.runwayYears.toFixed(1).replace(".", ",")} ans`
              }
            />
          </View>
        </HeroCard>
      </Enter>

      {/* ---------------- Période ---------------- */}
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* ---------------- Évolution de la fortune ---------------- */}
      <Enter index={1}>
        <Card>
          <SectionHeader title="Évolution de la fortune" />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SeriesChart
              data={overview.wealthSeries}
              width={chartWidth}
              format={fmt.compact}
              color={theme.brand.primary}
            />
          </View>
        </Card>
      </Enter>

      {/* ---------------- Allocation de fortune ---------------- */}
      <Enter index={2}>
        <Card>
          <SectionHeader title="Allocation de fortune" subtitle="Répartition au dernier relevé" />
          <View style={{ alignItems: "center", marginVertical: theme.spacing.lg }}>
            <DonutChart
              slices={overview.allocationSlices}
              scale="wealth"
              centerLabel="Total"
              centerValue={fmt.compact(overview.totalWealth)}
            />
          </View>
          <SliceLegend slices={overview.allocationSlices} scale="wealth" format={fmt.compact} />
        </Card>
      </Enter>

      {/* ---------------- Revenus ---------------- */}
      <Enter index={3}>
        <Touchable noScale onPress={() => router.push("/revenus")}>
          <Card>
            <SectionHeader
              title="Revenus"
              subtitle="Actif et passif, mois par mois"
              right={<ArrowUpRight color={theme.colors.textMuted} size={18} />}
            />
            <View style={{ marginTop: theme.spacing.lg }}>
              <StackedIncomeChart
                data={overview.incomeSeries}
                width={chartWidth}
                format={fmt.compact}
              />
            </View>
          </Card>
        </Touchable>
      </Enter>

      {/* ---------------- Ratio revenus / dépenses ---------------- */}
      <Enter index={4}>
        <Card>
          <SectionHeader
            title="Revenus / Dépenses"
            subtitle={`Moyennes sur ${data.settings.averageWindowMonths} mois`}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.xl,
              marginTop: theme.spacing.lg,
            }}
          >
            <DonutChart
              slices={overview.incomeExpenseSlices}
              radius={62}
              compact
              centerLabel="Ratio"
              centerValue={
                overview.health.incomeExpenseRatio === null
                  ? "—"
                  : `${overview.health.incomeExpenseRatio.toFixed(2).replace(".", ",")}×`
              }
            />
            <View style={{ flex: 1, gap: theme.spacing.md }}>
              <StatRow
                label="Revenu moyen"
                value={fmt.amount(overview.health.averageIncome)}
                color={theme.money.gain}
              />
              <StatRow
                label="Dépense moyenne"
                value={fmt.amount(overview.health.averageExpense)}
                color={theme.money.loss}
              />
              <StatRow
                label="Épargne"
                value={fmt.amount(overview.health.averageSavings, { signed: true })}
                color={
                  overview.health.averageSavings >= 0 ? theme.money.gain : theme.money.loss
                }
                hint={
                  overview.health.savingsRatePercent === null
                    ? undefined
                    : `${overview.health.savingsRatePercent.toFixed(0)} % du revenu`
                }
              />
            </View>
          </View>
        </Card>
      </Enter>

      {/* ---------------- Dépenses ---------------- */}
      <Enter index={5}>
        <Touchable noScale onPress={() => router.push("/(tabs)/depenses")}>
          <Card>
            <SectionHeader
              title="Répartition des dépenses"
              subtitle="Moyenne sur la période"
              right={<ArrowUpRight color={theme.colors.textMuted} size={18} />}
            />
            <View style={{ alignItems: "center", marginVertical: theme.spacing.lg }}>
              <DonutChart
                slices={overview.expenseSlices}
                scale="expense"
                centerLabel="Par mois"
                centerValue={fmt.compact(overview.health.averageExpense)}
              />
            </View>
            <SliceLegend
              slices={overview.expenseSlices}
              scale="expense"
              format={fmt.compact}
              max={5}
            />
          </Card>
        </Touchable>
      </Enter>

      {/* ---------------- Réserve de cash ---------------- */}
      <Enter index={6}>
        <Card>
          <SectionHeader title="Réserve de cash" subtitle="Liquide et comptes courants" />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SeriesChart
              data={overview.cashSeries}
              width={chartWidth}
              format={fmt.compact}
              color={theme.money.gain}
            />
          </View>
        </Card>
      </Enter>

      {/* ---------------- KPI investissements ---------------- */}
      <Enter index={7}>
        <Touchable noScale onPress={() => router.push("/portefeuille")}>
          <Card
            level={overview.investmentsKpi.needsRebalance ? "accentGlow" : "card"}
            style={{ gap: theme.spacing.md }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Wallet color={theme.brand.accent} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Overline>Investissements</Overline>
                <Amount
                  value={overview.investmentsKpi.total}
                  format={fmt.amount}
                  variant="amountLg"
                />
              </View>
              {overview.investmentsKpi.changePercent !== null ? (
                <Badge
                  label={fmt.percent(overview.investmentsKpi.changePercent)}
                  color={
                    overview.investmentsKpi.changePercent >= 0
                      ? theme.money.gain
                      : theme.money.loss
                  }
                  background={theme.colors.surfaceAlt}
                />
              ) : null}
            </View>

            {overview.investmentsKpi.needsRebalance ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.md,
                }}
              >
                <Scale color={theme.money.warning} size={16} />
                <Txt variant="caption" color={theme.money.warning} style={{ flex: 1 }}>
                  Dérive de {overview.investmentsKpi.maxDriftPoints.toFixed(1).replace(".", ",")} pts
                  vs votre allocation cible.
                </Txt>
              </View>
            ) : null}
          </Card>
        </Touchable>
      </Enter>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function HeroStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    // `minWidth: 0` + troncature : sans cela le libellé le plus long déborde
    // sur la colonne voisine (« BIENS DE VALEUR SANTÉ » collés).
    <View style={{ flex: 1, minWidth: 0, paddingRight: theme.spacing.sm }}>
      <Overline color={theme.brand.accentSoft} numberOfLines={1}>
        {label}
      </Overline>
      <Txt variant="amountSm" color="#FFFFFF" numberOfLines={1} style={[tabular, { marginTop: 2 }]}>
        {value}
      </Txt>
    </View>
  );
}

function StatRow({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <Txt variant="caption" muted style={{ flex: 1 }}>
          {label}
        </Txt>
        <Txt variant="amountSm" color={color} style={tabular}>
          {value}
        </Txt>
      </View>
      {hint ? (
        <Txt variant="caption" muted style={{ fontSize: 11, textAlign: "right" }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
