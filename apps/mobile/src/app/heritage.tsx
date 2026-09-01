/**
 * Planificateur d'héritage — module 9 du cahier des charges.
 *
 * Deux visualisations : le patrimoine projeté par horizon (0 à 500 ans) et
 * l'« horloge de vie ». Le second chiffre est inconfortable — c'est le but :
 * il donne son sens au premier.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { chartSize } from "@mfp/design-tokens";
import {
  DEFAULT_HORIZONS,
  lifeClock,
  projectInheritance,
  wealthAt,
  wealthAtTargetAge,
  wealthSeries,
  type HorizonPoint,
} from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { makeFormatters, tabular } from "../lib/format";
import { Screen, SectionHeader, useChartWidth } from "../components/layout";
import {
  Card,
  Divider,
  EmptyState,
  Enter,
  Overline,
  Touchable,
  Txt,
} from "../components/primitives";
import { axisLabelStyle, DonutChart, mutableCopy, plotWidth } from "../components/charts";
import { ScreenHeader } from "../components/header";
import { Slider } from "../components/slider";

/** Horizons affichés sur le graphique : au-delà de 100 ans les barres écrasent tout. */
const CHART_HORIZONS = DEFAULT_HORIZONS.filter((y) => y <= 50);

export default function Heritage() {
  const theme = useTheme();
  const { data } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const chartWidth = useChartWidth();

  const [rate, setRate] = useState(data.settings.expectedReturn);
  const [targetAge, setTargetAge] = useState(data.settings.inheritanceTargetAge);

  const currentWealth = useMemo(() => {
    const series = wealthSeries(data.accounts, data.accountSnapshots, data.assets);
    const reference = series.at(-1)?.month;
    return reference
      ? wealthAt(data.accounts, data.accountSnapshots, data.assets, reference).total
      : 0;
  }, [data]);

  const input = {
    currentWealth,
    annualReturn: rate,
    birthDate: data.settings.birthDate,
    lifeExpectancy: data.settings.lifeExpectancy,
  };

  const points = useMemo(() => projectInheritance(input, DEFAULT_HORIZONS), [input]);
  const chartPoints = useMemo(() => projectInheritance(input, CHART_HORIZONS), [input]);
  const clock = lifeClock(data.settings.birthDate, data.settings.lifeExpectancy);
  const atTarget = wealthAtTargetAge(input, targetAge);

  const bars = useMemo(
    () =>
      chartPoints.map((p) => ({
        // `Number.MAX_SAFE_INTEGER` casse le rendu SVG : on borne pour l'affichage
        // seulement, la valeur exacte reste dans le tableau du bas.
        value: Math.min(p.wealth, Number.MAX_SAFE_INTEGER),
        label: `${p.years}a`,
        frontColor: p.isInheritance ? theme.brand.accent : theme.brand.primary,
        labelTextStyle: axisLabelStyle(theme.colors.textMuted),
      })),
    [chartPoints, theme],
  );

  if (currentWealth === 0) {
    return (
      <Screen>
        <ScreenHeader overline="Module 9" title="Héritage" />
        <EmptyState
          title="Pas encore de patrimoine"
          message="La projection part de votre fortune actuelle. Saisissez d'abord vos soldes de comptes."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader overline="Module 9" title="Planificateur d'héritage" />

      {/* -------- Horloge de vie -------- */}
      {clock ? (
        <Enter index={0}>
          <Card>
            <SectionHeader title="Horloge de vie" subtitle={`${clock.currentAge} ans aujourd'hui`} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.xl,
                marginTop: theme.spacing.lg,
              }}
            >
              <DonutChart
                slices={[
                  {
                    key: "vecu",
                    label: "Vécu",
                    value: clock.livedPercent,
                    percent: clock.livedPercent,
                  },
                  {
                    key: "restant",
                    label: "Restant",
                    value: clock.remainingPercent,
                    percent: clock.remainingPercent,
                  },
                ]}
                radius={chartSize.pieRadiusCompact}
                compact
                centerLabel="Vécu"
                centerValue={`${clock.livedPercent.toFixed(0)} %`}
              />
              <View style={{ flex: 1, gap: theme.spacing.md }}>
                <Stat label="Années devant" value={`${clock.yearsRemaining}`} />
                <Stat label="Soit en mois" value={`${clock.monthsRemaining}`} />
                <Txt variant="caption" muted>
                  Hypothèse : {clock.lifeExpectancy} ans d'espérance de vie (modifiable dans les
                  réglages).
                </Txt>
              </View>
            </View>
          </Card>
        </Enter>
      ) : (
        <Enter index={0}>
          <Card>
            <Txt variant="caption" muted>
              Renseignez votre date de naissance dans les réglages pour afficher l'horloge de vie.
            </Txt>
          </Card>
        </Enter>
      )}

      {/* -------- Projection -------- */}
      <Enter index={1}>
        <Card>
          <SectionHeader
            title="Patrimoine projeté"
            subtitle="Orange : au-delà de votre espérance de vie"
          />
          <View style={{ marginTop: theme.spacing.lg }}>
            <BarChart
              data={mutableCopy(bars)}
              width={plotWidth(chartWidth)}
              height={chartSize.standard}
              barWidth={Math.max(10, plotWidth(chartWidth) / bars.length - 8)}
              spacing={8}
              initialSpacing={10}
              barBorderTopLeftRadius={4}
              barBorderTopRightRadius={4}
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
          </View>
        </Card>
      </Enter>

      {/* -------- Hypothèses -------- */}
      <Enter index={2}>
        <Card style={{ gap: theme.spacing.xl }}>
          <SectionHeader title="Hypothèses" />
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
            label="Âge cible"
            value={targetAge}
            min={Math.max(20, (clock?.currentAge ?? 20) + 1)}
            max={120}
            step={1}
            onChange={setTargetAge}
            format={(v) => `${v} ans`}
          />
          {atTarget ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Divider style={{ marginBottom: theme.spacing.sm }} />
              <Overline>À {targetAge} ans, dans {atTarget.years} ans</Overline>
              <Txt variant="amountLg" color={theme.brand.accent} style={tabular}>
                {fmt.compact(atTarget.wealth)}
              </Txt>
            </View>
          ) : null}
        </Card>
      </Enter>

      {/* -------- Table complète -------- */}
      <SectionHeader title="Tous les horizons" subtitle="Jusqu'à 500 ans, comme le classeur" />

      <Enter index={3}>
        <Card padded={false}>
          {points.map((point, index) => (
            <HorizonRow
              key={point.years}
              point={point}
              format={fmt.compact}
              last={index === points.length - 1}
            />
          ))}
        </Card>
      </Enter>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function HorizonRow({
  point,
  format,
  last,
}: {
  point: HorizonPoint;
  format: (v: number) => string;
  last: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
        }}
      >
        <Txt variant="amountSm" style={[tabular, { width: 58 }]}>
          {point.years === 0 ? "Auj." : `+${point.years} a`}
        </Txt>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" muted style={tabular}>
            {point.calendarYear}
            {point.age !== null ? ` · ${point.age} ans` : ""}
          </Txt>
        </View>
        <Txt
          variant="amountSm"
          color={point.isInheritance ? theme.brand.accent : theme.colors.text}
          style={tabular}
        >
          {format(point.wealth)}
        </Txt>
      </View>
      {!last ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Overline>{label}</Overline>
      <Txt variant="amountMd" style={[tabular, { marginTop: 2 }]}>
        {value}
      </Txt>
    </View>
  );
}
