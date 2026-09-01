/**
 * Graphiques — enveloppes minces autour de `react-native-gifted-charts`.
 *
 * Objectif : que **tous** les graphiques de l'app partagent grille, axes,
 * typographie et palette. Sans cette couche, chaque écran reconfigure la
 * bibliothèque à sa façon et deux courbes voisines n'ont pas le même repère.
 *
 * Un seul composant paramétré par type, jamais dupliqué par période — c'est la
 * réponse aux 20 bar charts identiques du classeur (§3.3 du cahier des charges).
 */

import { useMemo } from "react";
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import { chartFill, chartSize, colorForKey, expenseColors, wealthColors } from "@mfp/design-tokens";
import { formatMonthAxis, type SeriesPoint, type Slice } from "@mfp/core";
import { useTheme } from "../lib/theme";
import { Amount, Dot, Overline, Txt } from "./primitives";
import { tabular } from "../lib/format";

/**
 * Largeur réservée aux étiquettes de l'axe Y.
 * ⚠️ `gifted-charts` ajoute cette colonne **en plus** de la `width` qu'on lui
 * passe : sans la soustraire, chaque graphique déborde de sa carte par la droite.
 */
const Y_AXIS_WIDTH = 54;

/** Largeur du tracé, une fois l'axe Y déduit. */
const plotWidth = (width: number) => Math.max(80, width - Y_AXIS_WIDTH);

/* ------------------------------------------------------------------ *
 * Séries temporelles
 * ------------------------------------------------------------------ */

type SeriesChartProps = {
  data: readonly SeriesPoint[];
  /** Largeur disponible (le parent la connaît, le graphique non). */
  width: number;
  height?: number;
  color?: string;
  /** Remplissage sous la courbe — l'« area chart » du classeur. */
  area?: boolean;
  format: (v: number) => string;
  /** Nombre maximum d'étiquettes d'axe X. Au-delà, elles se chevauchent. */
  maxLabels?: number;
};

/**
 * Courbe d'évolution (fortune, cash, portefeuille).
 * Les étiquettes d'axe X sont **éclaircies** plutôt que réduites : douze mois
 * écrits sur 340 px se chevauchent et deviennent illisibles.
 */
export function SeriesChart({
  data,
  width,
  height = chartSize.standard,
  color,
  area = true,
  format,
  maxLabels = 6,
}: SeriesChartProps) {
  const theme = useTheme();
  const stroke = color ?? theme.brand.primary;
  const step = Math.max(1, Math.ceil(data.length / maxLabels));

  const points = useMemo(
    () =>
      data.map((p, i) => ({
        value: p.value,
        label: i % step === 0 ? formatMonthAxis(p.month) : "",
        labelTextStyle: axisLabelStyle(theme.colors.textMuted),
      })),
    [data, step, theme.colors.textMuted],
  );

  if (data.length < 2) return <ChartPlaceholder height={height} />;

  return (
    <LineChart
      data={mutableCopy(points)}
      width={plotWidth(width)}
      height={height}
      curved
      thickness={2.5}
      color={stroke}
      hideDataPoints
      areaChart={area}
      startFillColor={stroke}
      endFillColor={stroke}
      startOpacity={chartFill.start}
      endOpacity={chartFill.end}
      // 20 et non 8 : l'étiquette du premier mois est centrée sur son point et
      // se faisait rogner par le bord gauche du tracé.
      initialSpacing={20}
      endSpacing={12}
      adjustToWidth
      noOfSections={4}
      rulesColor={theme.colors.border}
      rulesType="solid"
      yAxisColor="transparent"
      xAxisColor={theme.colors.border}
      yAxisTextStyle={axisLabelStyle(theme.colors.textMuted)}
      formatYLabel={(v: string) => format(Number(v))}
      yAxisLabelWidth={Y_AXIS_WIDTH}
      isAnimated
      animationDuration={theme.motion.duration.slow}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Barres empilées : revenus passifs vs actifs
 * ------------------------------------------------------------------ */

export function StackedIncomeChart({
  data,
  width,
  height = chartSize.standard,
  format,
  maxLabels = 6,
}: {
  data: readonly { month: string; passive: number; active: number }[];
  width: number;
  height?: number;
  format: (v: number) => string;
  maxLabels?: number;
}) {
  const theme = useTheme();
  const step = Math.max(1, Math.ceil(data.length / maxLabels));

  const stacks = useMemo(
    () =>
      data.map((m, i) => ({
        // L'actif en bas : c'est la part que l'utilisateur « travaille »,
        // le passif s'empile dessus et c'est lui qu'on regarde grandir.
        stacks: [
          { value: m.active, color: theme.brand.primary },
          { value: m.passive, color: theme.brand.accent },
        ],
        label: i % step === 0 ? formatMonthAxis(m.month) : "",
        labelTextStyle: axisLabelStyle(theme.colors.textMuted),
      })),
    [data, step, theme],
  );

  if (data.length === 0) return <ChartPlaceholder height={height} />;

  const barWidth = Math.max(6, Math.min(22, plotWidth(width) / Math.max(1, data.length) - 6));

  return (
    <View>
      <BarChart
        stackData={mutableCopy(stacks)}
        width={plotWidth(width)}
        height={height}
        barWidth={barWidth}
        spacing={6}
        initialSpacing={10}
        barBorderTopLeftRadius={4}
        barBorderTopRightRadius={4}
        noOfSections={4}
        rulesColor={theme.colors.border}
        yAxisColor="transparent"
        xAxisColor={theme.colors.border}
        yAxisTextStyle={axisLabelStyle(theme.colors.textMuted)}
        formatYLabel={(v: string) => format(Number(v))}
        yAxisLabelWidth={Y_AXIS_WIDTH}
        isAnimated
        animationDuration={theme.motion.duration.slow}
      />
      <Legend
        items={[
          { label: "Actif", color: theme.brand.primary },
          { label: "Passif", color: theme.brand.accent },
        ]}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Camemberts
 * ------------------------------------------------------------------ */

export type PieScale = "expense" | "wealth" | "auto";

const SCALES: Record<Exclude<PieScale, "auto">, Record<string, string>> = {
  expense: expenseColors,
  wealth: wealthColors,
};

export function sliceColor(slice: Slice, scale: PieScale): string {
  return colorForKey(slice.key, scale === "auto" ? {} : SCALES[scale]);
}

/**
 * Camembert / anneau.
 * Le total va au centre : sur mobile, une légende externe qui répète les
 * pourcentages fait déborder l'écran, alors que le total est ce qu'on cherche.
 */
export function DonutChart({
  slices,
  scale = "auto",
  radius = chartSize.pieRadius,
  centerLabel,
  centerValue,
  compact = false,
}: {
  slices: readonly Slice[];
  scale?: PieScale;
  radius?: number;
  centerLabel?: string;
  centerValue?: string;
  compact?: boolean;
}) {
  const theme = useTheme();

  const data = useMemo(
    () => slices.map((s) => ({ value: s.value, color: sliceColor(s, scale) })),
    [slices, scale],
  );

  if (slices.length === 0) return <ChartPlaceholder height={radius * 2} />;

  return (
    <PieChart
      data={mutableCopy(data)}
      donut
      radius={radius}
      innerRadius={radius * chartSize.donutInnerRatio}
      innerCircleColor={theme.colors.surface}
      strokeWidth={2}
      strokeColor={theme.colors.surface}
      centerLabelComponent={() =>
        centerValue ? (
          <View style={{ alignItems: "center" }}>
            {centerLabel ? <Overline>{centerLabel}</Overline> : null}
            <Txt
              variant={compact ? "amountSm" : "amountMd"}
              style={[tabular, { marginTop: 2 }]}
            >
              {centerValue}
            </Txt>
          </View>
        ) : null
      }
    />
  );
}

/** Légende d'un camembert : pastille, libellé, part. */
export function SliceLegend({
  slices,
  scale = "auto",
  format,
  max = 8,
}: {
  slices: readonly Slice[];
  scale?: PieScale;
  format: (v: number) => string;
  max?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {slices.slice(0, max).map((s) => (
        <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <Dot color={sliceColor(s, scale)} />
          <Txt variant="caption" style={{ flex: 1 }} numberOfLines={1}>
            {s.label}
          </Txt>
          <Amount value={s.value} format={format} variant="amountSm" />
          <Txt variant="caption" muted style={[tabular, { width: 52, textAlign: "right" }]}>
            {s.percent.toFixed(1).replace(".", ",")} %
          </Txt>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Communs
 * ------------------------------------------------------------------ */

export function Legend({
  items,
  style,
}: {
  items: readonly { label: string; color: string }[];
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", gap: theme.spacing.lg, marginTop: theme.spacing.md, flexWrap: "wrap" },
        style,
      ]}
    >
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Dot color={item.color} />
          <Txt variant="caption" muted>
            {item.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * Emplacement réservé quand la série est trop courte pour être tracée.
 * On garde la hauteur du graphique : sinon la carte se replie et toute la page
 * saute au moment où la première donnée arrive.
 */
export function ChartPlaceholder({ height }: { height: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceSunken,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt variant="caption" muted>
        Pas encore assez de donnees
      </Txt>
    </View>
  );
}

export { Y_AXIS_WIDTH, plotWidth };

export function axisLabelStyle(color: string): TextStyle {
  // `fontVariant` est recréé à chaque appel plutôt que repris de la constante
  // `tabular` : `mutableCopy` ci-dessous protège déjà la donnée, mais partager
  // un tableau entre tous les libellés d'axe invite exactement le genre de
  // mutation croisée qu'on vient de corriger.
  return { color, fontSize: 10, fontVariant: ["tabular-nums"] };
}

/**
 * Copie profonde mutable des données d'un graphique.
 *
 * ⚠️ Indispensable : `gifted-charts-core` clone ses entrées avec un algorithme
 * qui **écrit dans l'objet source** (`obj.isActiveClone = null` puis `delete`).
 * Il suffit qu'un seul objet du graphe soit non-extensible — un style figé, un
 * objet gelé par React en développement — pour que le rendu casse avec
 * « Cannot add new property 'isActiveClone' ».
 *
 * On lui passe donc une copie fraîche dont on sait qu'elle est mutable. Le coût
 * est négligeable (quelques dizaines de points) devant un écran qui ne s'affiche pas.
 */
export function mutableCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(mutableCopy) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = mutableCopy(item);
    return out as T;
  }
  return value;
}
