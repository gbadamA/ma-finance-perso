/**
 * Portefeuille d'investissement — module 6 du cahier des charges.
 *
 * Les deux camemberts « Portfolio Idéal » et « Portfolio Actuel » sont
 * affichés **côte à côte, au même rayon** : c'est la comparaison visuelle qui
 * porte l'information, une différence de taille la fausserait.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { ArrowDown, ArrowUp, Scale } from "lucide-react-native";
import { chartSize } from "@mfp/design-tokens";
import {
  analysePortfolio,
  filterPeriod,
  labelFor,
  portfolioSeries,
  targetGap,
  type PeriodPreset,
} from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { makeFormatters, tabular } from "../lib/format";
import { PeriodSelector, Screen, SectionHeader, useChartWidth } from "../components/layout";
import {
  Amount,
  Badge,
  Card,
  Dot,
  EmptyState,
  Enter,
  Overline,
  Txt,
} from "../components/primitives";
import { DonutChart, SeriesChart, sliceColor } from "../components/charts";
import { ScreenHeader } from "../components/header";

export default function Portefeuille() {
  const theme = useTheme();
  const { data } = useData();
  const [period, setPeriod] = useState<PeriodPreset>("12m");

  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);
  const chartWidth = useChartWidth();

  const analysis = useMemo(
    () => analysePortfolio(data.investmentSnapshots, data.targets, data.settings.driftThreshold),
    [data.investmentSnapshots, data.targets, data.settings.driftThreshold],
  );
  const series = useMemo(
    () => filterPeriod(portfolioSeries(data.investmentSnapshots), period),
    [data.investmentSnapshots, period],
  );
  const gap = targetGap(data.targets);

  if (data.investmentSnapshots.length === 0) {
    return (
      <Screen>
        <ScreenHeader overline="Module 6" title="Portefeuille" />
        <EmptyState
          title="Aucun relevé"
          message="Enregistrez la valeur de vos placements par classe d'actif pour suivre votre allocation."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Module 6"
        title="Portefeuille"
        right={
          analysis.needsRebalance ? (
            <Badge
              label="Dérive"
              color={theme.money.warning}
              background={theme.colors.surfaceAlt}
            />
          ) : undefined
        }
      />

      <Enter index={0}>
        <Card style={{ gap: theme.spacing.sm }}>
          <Overline>Valeur du portefeuille</Overline>
          <Amount value={analysis.total} format={fmt.amount} variant="amountXl" />
          {gap !== 0 ? (
            <Txt variant="caption" color={theme.money.warning}>
              Vos allocations cibles totalisent {(100 - gap).toFixed(0)} points — il reste{" "}
              {gap.toFixed(0)} points à répartir.
            </Txt>
          ) : null}
        </Card>
      </Enter>

      {/* -------- Idéal vs Actuel, côte à côte -------- */}
      <Enter index={1}>
        <Card>
          <SectionHeader title="Cible et réel" subtitle="Même échelle, comparaison directe" />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              marginTop: theme.spacing.lg,
            }}
          >
            <PieBlock title="Idéal" slices={analysis.targetSlices} />
            <PieBlock title="Actuel" slices={analysis.actualSlices} />
          </View>
        </Card>
      </Enter>

      {/* -------- Écarts par classe d'actif -------- */}
      <SectionHeader
        title="Écarts d'allocation"
        subtitle={`Seuil d'alerte : ±${data.settings.driftThreshold} pts`}
      />

      {analysis.drifts.map((drift, index) => {
        const slice = analysis.actualSlices.find((s) => s.key === drift.assetClass);
        const color = slice ? sliceColor(slice, "wealth") : theme.colors.textMuted;
        const over = drift.driftPoints > 0;

        return (
          <Enter key={drift.assetClass} index={index + 2}>
            <Card
              level={drift.alert ? "accentGlow" : "card"}
              style={{ gap: theme.spacing.md }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                <Dot color={color} />
                <Txt variant="h3" style={{ flex: 1 }}>
                  {labelFor(drift.assetClass)}
                </Txt>
                <Amount value={drift.amount} format={fmt.amount} variant="amountSm" />
              </View>

              {/* Barre d'écart centrée sur la cible : la position du repère
                  dit tout de suite si on est au-dessus ou en dessous. */}
              <DriftBar
                actual={drift.actualPercent}
                target={drift.targetPercent}
                color={color}
                alert={drift.alert}
              />

              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                <Txt variant="caption" muted style={[tabular, { flex: 1 }]}>
                  {drift.actualPercent.toFixed(1).replace(".", ",")} % · cible{" "}
                  {drift.targetPercent.toFixed(0)} %
                </Txt>
                {drift.rebalanceAmount !== 0 ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {over ? (
                      <ArrowDown color={theme.money.loss} size={13} />
                    ) : (
                      <ArrowUp color={theme.money.gain} size={13} />
                    )}
                    <Txt
                      variant="caption"
                      color={over ? theme.money.loss : theme.money.gain}
                      style={tabular}
                    >
                      {fmt.compact(Math.abs(drift.rebalanceAmount))}
                    </Txt>
                  </View>
                ) : null}
              </View>
            </Card>
          </Enter>
        );
      })}

      {analysis.needsRebalance ? (
        <Enter index={analysis.drifts.length + 2}>
          <Card alt style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
            <Scale color={theme.money.warning} size={20} />
            <Txt variant="caption" style={{ flex: 1 }}>
              Rééquilibrer, c'est vendre ce qui a monté et acheter ce qui a baissé — pour revenir à
              la répartition que vous aviez choisie à froid.
            </Txt>
          </Card>
        </Enter>
      ) : null}

      {/* -------- Évolution -------- */}
      <PeriodSelector value={period} onChange={setPeriod} />

      <Enter index={analysis.drifts.length + 3}>
        <Card>
          <SectionHeader title="Évolution" />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SeriesChart
              data={series}
              width={chartWidth}
              format={fmt.compact}
              color={theme.brand.accent}
            />
          </View>
        </Card>
      </Enter>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function PieBlock({ title, slices }: { title: string; slices: readonly { key: string; label: string; value: number; percent: number }[] }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
      <Overline>{title}</Overline>
      <DonutChart slices={slices} scale="wealth" radius={chartSize.pieRadiusCompact} compact />
    </View>
  );
}

/**
 * Barre d'écart : la cible est un repère fixe au milieu, la barre s'étire à
 * droite (surpondéré) ou à gauche (sous-pondéré). Une barre de progression
 * classique ne dirait pas de quel côté on se trouve.
 */
function DriftBar({
  actual,
  target,
  color,
  alert,
}: {
  actual: number;
  target: number;
  color: string;
  alert: boolean;
}) {
  const theme = useTheme();
  // Échelle : ±20 points couvrent tous les cas réalistes sans écraser les petits écarts.
  const drift = Math.max(-20, Math.min(20, actual - target));
  const half = Math.abs(drift) / 40;

  return (
    <View
      style={{
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.surfaceSunken,
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: drift >= 0 ? "50%" : `${50 - half * 100}%`,
          width: `${half * 100}%`,
          height: 8,
          backgroundColor: alert ? theme.money.warning : color,
          opacity: alert ? 1 : 0.7,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: "50%",
          width: 2,
          height: 8,
          backgroundColor: theme.colors.textMuted,
        }}
      />
    </View>
  );
}
