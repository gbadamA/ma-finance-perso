/**
 * Biens de valeur — module 5 du cahier des charges (feuille « Assets »).
 * Net Equity, P/L et répartition par catégorie (§5.4).
 */

import { useMemo } from "react";
import { View } from "react-native";
import { assetAllocation, assetMetrics, sum, totalEquity } from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { makeFormatters, tabular } from "../lib/format";
import { Screen, SectionHeader } from "../components/layout";
import {
  Amount,
  Card,
  Divider,
  EmptyState,
  Enter,
  Overline,
  ProgressBar,
  Txt,
} from "../components/primitives";
import { DonutChart, SliceLegend } from "../components/charts";
import { ScreenHeader } from "../components/header";

export default function Assets() {
  const theme = useTheme();
  const { data } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);

  const summary = useMemo(() => {
    const rows = data.assets
      .map((asset) => ({ asset, ...assetMetrics(asset) }))
      .sort((a, b) => b.netEquity - a.netEquity);
    return {
      rows,
      equity: totalEquity(data.assets),
      value: sum(data.assets.map((a) => a.currentValue)),
      debt: sum(data.assets.map((a) => a.debt)),
      profitLoss: sum(rows.map((r) => r.profitLoss)),
      slices: assetAllocation(data.assets),
    };
  }, [data.assets]);

  if (data.assets.length === 0) {
    return (
      <Screen>
        <ScreenHeader overline="Module 5" title="Biens de valeur" />
        <EmptyState
          title="Aucun bien enregistré"
          message="Véhicule, terrain, matériel : enregistrez-les pour que leur valeur nette entre dans votre fortune."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader overline="Module 5" title="Biens de valeur" />

      <Enter index={0}>
        <Card style={{ gap: theme.spacing.sm }}>
          <Overline>Valeur nette</Overline>
          <Amount value={summary.equity} format={fmt.amount} variant="amountXl" />

          <Divider style={{ marginVertical: theme.spacing.md }} />

          <Line label="Valeur estimée" value={fmt.amount(summary.value)} />
          <Line
            label="Dettes adossées"
            value={fmt.amount(-summary.debt)}
            color={summary.debt > 0 ? theme.money.loss : undefined}
          />
          <Line
            label="Plus / moins-value"
            value={fmt.amount(summary.profitLoss, { signed: true })}
            color={summary.profitLoss >= 0 ? theme.money.gain : theme.money.loss}
          />
        </Card>
      </Enter>

      <Enter index={1}>
        <Card>
          <SectionHeader title="Allocation d'asset" subtitle="Valeur nette par catégorie" />
          <View style={{ alignItems: "center", marginVertical: theme.spacing.lg }}>
            <DonutChart
              slices={summary.slices}
              centerLabel="Net"
              centerValue={fmt.compact(summary.equity)}
            />
          </View>
          <SliceLegend slices={summary.slices} format={fmt.compact} />
        </Card>
      </Enter>

      <SectionHeader title="Inventaire" subtitle={`${summary.rows.length} biens`} />

      {summary.rows.map((row, index) => {
        const gain = row.profitLoss >= 0;
        return (
          <Enter key={row.asset.id} index={index + 2}>
            <Card style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">{row.asset.name}</Txt>
                  <Txt variant="caption" muted>
                    {row.asset.category}
                    {row.asset.purchaseDate ? ` · acheté en ${row.asset.purchaseDate.slice(0, 4)}` : ""}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Amount value={row.netEquity} format={fmt.amount} variant="amountSm" />
                  <Txt
                    variant="caption"
                    color={gain ? theme.money.gain : theme.money.loss}
                    style={[tabular, { fontSize: 11 }]}
                  >
                    {fmt.amount(row.profitLoss, { signed: true, withSymbol: false })}
                  </Txt>
                </View>
              </View>

              {row.asset.conditionScore !== null && row.asset.conditionScore !== undefined ? (
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row" }}>
                    <Txt variant="caption" muted style={{ flex: 1 }}>
                      État
                    </Txt>
                    <Txt variant="caption" muted style={tabular}>
                      {row.asset.conditionScore}/100
                    </Txt>
                  </View>
                  <ProgressBar
                    percent={row.asset.conditionScore}
                    color={conditionColor(row.asset.conditionScore, theme)}
                    height={5}
                  />
                </View>
              ) : null}

              <View style={{ flexDirection: "row" }}>
                <Cell label="Achat" value={fmt.compact(row.asset.purchasePrice)} />
                <Cell label="Valeur" value={fmt.compact(row.asset.currentValue)} />
                <Cell
                  label="Dette"
                  value={row.asset.debt > 0 ? fmt.compact(row.asset.debt) : "—"}
                  color={row.asset.debt > 0 ? theme.money.loss : undefined}
                />
                <Cell label="Entretien" value={fmt.compact(row.asset.maintenanceCost)} />
              </View>
            </Card>
          </Enter>
        );
      })}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

/** Un score d'état bas annonce une dépense à venir : il se colore comme une alerte. */
function conditionColor(score: number, theme: ReturnType<typeof useTheme>): string {
  if (score >= 70) return theme.money.gain;
  if (score >= 40) return theme.money.warning;
  return theme.money.loss;
}

function Line({ label, value, color }: { label: string; value: string; color?: string }) {
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

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Overline>{label}</Overline>
      <Txt variant="caption" color={color} style={[tabular, { marginTop: 2, fontWeight: "600" }]}>
        {value}
      </Txt>
    </View>
  );
}
