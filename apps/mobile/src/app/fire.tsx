/**
 * Indépendance financière (FIRE) — module 7 du cahier des charges.
 *
 * Le classeur affichait une courbe figée. Ici les curseurs recalculent la
 * projection **en direct** : c'est la seule façon de répondre à « et si
 * j'investissais 50 000 de plus par mois ? » sans rouvrir un tableur.
 *
 * ⚠️ Les hypothèses manipulées ici sont **locales à l'écran**. Elles ne sont
 * enregistrées que sur action explicite : on doit pouvoir explorer un scénario
 * sans écraser ses paramètres réels.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react-native";
import {
  chartFill,
  chartSize,
} from "@mfp/design-tokens";
import { projectFireWithGoals, sampleForChart, type GoalCheckpoint } from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { makeFormatters, tabular } from "../lib/format";
import { Screen, SectionHeader, useChartWidth } from "../components/layout";
import {
  Amount,
  Badge,
  Card,
  Divider,
  Enter,
  Overline,
  ProgressBar,
  Touchable,
  Txt,
} from "../components/primitives";
import { axisLabelStyle, ChartPlaceholder, mutableCopy, plotWidth } from "../components/charts";
import { Slider } from "../components/slider";
import { ScreenHeader } from "../components/header";

export default function Fire() {
  const theme = useTheme();
  const { data } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const chartWidth = useChartWidth();

  /** Capital de départ : le dernier relevé du portefeuille. */
  const invested = useMemo(() => {
    const last = data.investmentSnapshots.at(-1)?.month;
    if (!last) return 0;
    return data.investmentSnapshots
      .filter((s) => s.month === last)
      .reduce((acc, s) => acc + s.amount, 0);
  }, [data.investmentSnapshots]);

  const [monthly, setMonthly] = useState(data.settings.monthlyInvestment);
  const [rate, setRate] = useState(data.settings.expectedReturn);
  const [swr, setSwr] = useState(data.settings.safeWithdrawalRate);
  const [inflation, setInflation] = useState(data.settings.inflationRate);

  const modified =
    monthly !== data.settings.monthlyInvestment ||
    rate !== data.settings.expectedReturn ||
    swr !== data.settings.safeWithdrawalRate ||
    inflation !== data.settings.inflationRate;

  const reset = () => {
    setMonthly(data.settings.monthlyInvestment);
    setRate(data.settings.expectedReturn);
    setSwr(data.settings.safeWithdrawalRate);
    setInflation(data.settings.inflationRate);
  };

  const projection = useMemo(
    () =>
      projectFireWithGoals(
        {
          initialInvested: invested,
          monthlyInvestment: monthly,
          expectedReturn: rate,
          safeWithdrawalRate: swr,
          inflationRate: inflation,
          birthDate: data.settings.birthDate,
        },
        data.goals,
      ),
    [invested, monthly, rate, swr, inflation, data.settings.birthDate, data.goals],
  );

  const points = useMemo(() => sampleForChart(projection.points, 90), [projection.points]);
  const chartData = useMemo(
    () =>
      // Pas d'étiquette par point : la librairie dimensionne chaque étiquette
      // sur l'espace d'UN point (~3 px sur 90 points) et n'affiche que « … ».
      // L'échelle des années est dessinée à la main sous le graphique.
      points.map((p) => ({ value: p.netWorth })),
    [points],
  );

  const now = projection.points[0]!;

  return (
    <Screen>
      <ScreenHeader
        overline="Module 7"
        title="Indépendance financière"
        right={
          modified ? (
            <Touchable onPress={reset} haptic accessibilityLabel="Réinitialiser les hypothèses">
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: 6,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <RotateCcw color={theme.colors.textMuted} size={14} />
                <Txt variant="caption" muted>
                  Rétablir
                </Txt>
              </View>
            </Touchable>
          ) : undefined
        }
      />

      {/* ---------------- Situation actuelle ---------------- */}
      <Enter index={0}>
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", gap: theme.spacing.lg }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Overline numberOfLines={1}>Capital investi</Overline>
              <Amount value={invested} format={fmt.amount} variant="amountMd" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Overline numberOfLines={1}>Rente actuelle</Overline>
              <Amount
                value={now.passiveIncome}
                format={fmt.amount}
                variant="amountMd"
                color={theme.brand.accent}
              />
            </View>
          </View>
          <Txt variant="caption" muted>
            La rente est ce que ce capital permettrait de retirer chaque mois au taux de retrait
            choisi, sans l'épuiser.
          </Txt>
        </Card>
      </Enter>

      {/* ---------------- Courbe de projection ---------------- */}
      <Enter index={1}>
        <Card>
          <SectionHeader
            title="Projection sur 40 ans"
            subtitle={`Valeur au terme : ${fmt.compact(projection.finalNetWorth)}`}
            right={
              modified ? (
                <Badge
                  label="Simulation"
                  color={theme.brand.accent}
                  background={theme.colors.surfaceAlt}
                />
              ) : undefined
            }
          />
          <View style={{ marginTop: theme.spacing.lg }}>
            {chartData.length < 2 ? (
              <ChartPlaceholder height={chartSize.tall} />
            ) : (
              <LineChart
                data={mutableCopy(chartData)}
                width={plotWidth(chartWidth)}
                height={chartSize.tall}
                curved
                thickness={2.5}
                color={theme.brand.accent}
                hideDataPoints
                areaChart
                startFillColor={theme.brand.accent}
                endFillColor={theme.brand.accent}
                startOpacity={chartFill.start}
                endOpacity={chartFill.end}
                initialSpacing={6}
                endSpacing={6}
                adjustToWidth
                noOfSections={4}
                rulesColor={theme.colors.border}
                yAxisColor="transparent"
                xAxisColor={theme.colors.border}
                yAxisTextStyle={axisLabelStyle(theme.colors.textMuted)}
                formatYLabel={(v: string) => fmt.compact(Number(v))}
                yAxisLabelWidth={54}
                isAnimated
                animationDuration={theme.motion.duration.slow}
              />
            )}
          </View>

          {/* Échelle des années, alignée sur la largeur du tracé. */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: theme.spacing.sm,
              marginLeft: chartWidth - plotWidth(chartWidth),
            }}
          >
            {[0, 10, 20, 30, 40].map((year) => (
              <Txt key={year} variant="caption" muted style={tabular}>
                {year === 0 ? "auj." : `${year} ans`}
              </Txt>
            ))}
          </View>
        </Card>
      </Enter>

      {/* ---------------- Curseurs ---------------- */}
      <Enter index={2}>
        <Card style={{ gap: theme.spacing.xl }}>
          <SectionHeader
            title="Hypothèses"
            subtitle="La courbe se recalcule pendant que vous glissez"
          />
          <Slider
            label="Apport mensuel"
            value={monthly}
            min={0}
            max={Math.max(2_000_000, data.settings.monthlyInvestment * 4)}
            step={25_000}
            onChange={setMonthly}
            format={(v) => fmt.amount(v)}
          />
          <Slider
            label="Rendement annuel"
            value={rate}
            min={0}
            max={15}
            step={0.5}
            onChange={setRate}
            format={(v) => `${v.toFixed(1).replace(".", ",")} %`}
            color={theme.money.gain}
          />
          <Slider
            label="Taux de retrait sûr"
            value={swr}
            min={2}
            max={8}
            step={0.25}
            onChange={setSwr}
            format={(v) => `${v.toFixed(2).replace(".", ",")} %`}
            color={theme.brand.primary}
          />
          <Slider
            label="Inflation"
            value={inflation}
            min={0}
            max={12}
            step={0.5}
            onChange={setInflation}
            format={(v) => `${v.toFixed(1).replace(".", ",")} %`}
            color={theme.money.warning}
          />
        </Card>
      </Enter>

      {/* ---------------- Objectifs ---------------- */}
      <SectionHeader
        title="Objectifs"
        subtitle={
          data.goals.length === 0 ? "Aucun objectif défini" : "Date de franchissement projetée"
        }
      />

      {projection.checkpoints.map((checkpoint, index) => (
        <Enter key={checkpoint.goalId} index={index + 3}>
          <CheckpointCard
            checkpoint={checkpoint}
            current={checkpoint.kind === "fortune" ? invested : now.passiveIncomeReal}
            format={fmt.amount}
            compact={fmt.compact}
          />
        </Enter>
      ))}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function CheckpointCard({
  checkpoint,
  current,
  format,
  compact,
}: {
  checkpoint: GoalCheckpoint;
  current: number;
  format: (v: number) => string;
  compact: (v: number) => string;
}) {
  const theme = useTheme();
  const reached = checkpoint.reachedAt;
  const alreadyThere = reached?.monthsRemaining === 0;
  const progress = (current / checkpoint.targetAmount) * 100;

  return (
    <Card
      level={alreadyThere ? "accentGlow" : "card"}
      style={{ gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        {alreadyThere ? (
          <CheckCircle2 color={theme.brand.accent} size={20} />
        ) : (
          <Circle color={theme.colors.textMuted} size={20} />
        )}
        <View style={{ flex: 1 }}>
          <Txt variant="h3">{checkpoint.label}</Txt>
          <Txt variant="caption" muted>
            {checkpoint.kind === "fortune" ? "Fortune" : "Revenu passif mensuel"} ·{" "}
            {compact(checkpoint.targetAmount)}
          </Txt>
        </View>
      </View>

      <ProgressBar
        percent={progress}
        color={alreadyThere ? theme.brand.accent : theme.brand.primary}
      />

      <Divider />

      {reached ? (
        <View style={{ flexDirection: "row" }}>
          <Metric
            label="Dans"
            value={alreadyThere ? "Atteint" : formatDelay(reached.monthsRemaining)}
          />
          <Metric label="Âge" value={reached.age !== null ? `${reached.age} ans` : "—"} />
          <Metric label="Capital" value={compact(reached.netWorth)} />
        </View>
      ) : (
        <Txt variant="caption" muted>
          Non atteint dans les 40 ans projetés avec ces hypothèses. Augmentez l'apport mensuel ou
          revoyez l'objectif — il manque {format(checkpoint.targetAmount - current)}.
        </Txt>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Overline>{label}</Overline>
      <Txt variant="amountSm" style={[tabular, { marginTop: 2 }]}>
        {value}
      </Txt>
    </View>
  );
}

function formatDelay(months: number): string {
  if (months <= 0) return "Atteint";
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} ans` : `${years} a ${rest} m`;
}
