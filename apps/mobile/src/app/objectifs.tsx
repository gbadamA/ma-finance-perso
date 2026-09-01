/**
 * Objectifs financiers et allocation cible.
 *
 * Deux réglages qui pilotent deux écrans : les objectifs alimentent les
 * checkpoints du simulateur FIRE (§5.2), l'allocation cible alimente le
 * « Portfolio Idéal » et l'alerte de dérive (§5.3).
 *
 * Le classeur les mélangeait à la table de projection ; les isoler ici évite
 * qu'on modifie une hypothèse en croyant lire un résultat.
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, TextInput, View } from "react-native";
import { Check, Target, Wallet } from "lucide-react-native";
import { colorForKey, wealthColors } from "@mfp/design-tokens";
import {
  capitalNeededFor,
  labelFor,
  parseAmount,
  targetGap,
  type GoalHorizon,
  type GoalKind,
} from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { setTargetAllocation, upsertGoal } from "../lib/mutations";
import { makeFormatters, tabular } from "../lib/format";
import { Screen, SectionHeader } from "../components/layout";
import {
  Card,
  Divider,
  Dot,
  Enter,
  Overline,
  ProgressBar,
  Touchable,
  Txt,
} from "../components/primitives";
import { ScreenHeader } from "../components/header";
import { Slider } from "../components/slider";

/**
 * Les cinq objectifs du classeur : trois horizons de fortune, deux niveaux de
 * rente. La liste est fixe (contrainte `unique (user_id, kind, horizon)` en
 * base) — c'est le montant qui se règle, pas la structure.
 */
const GOAL_SLOTS: { kind: GoalKind; horizon: GoalHorizon; label: string; hint: string }[] = [
  { kind: "fortune", horizon: "court", label: "Fortune — court terme", hint: "1 à 3 ans" },
  { kind: "fortune", horizon: "moyen", label: "Fortune — moyen terme", hint: "5 à 10 ans" },
  { kind: "fortune", horizon: "long", label: "Fortune — long terme", hint: "15 ans et plus" },
  {
    kind: "revenu_passif",
    horizon: "minimum",
    label: "Rente minimum",
    hint: "de quoi couvrir l'essentiel",
  },
  {
    kind: "revenu_passif",
    horizon: "ideal",
    label: "Rente idéale",
    hint: "l'indépendance confortable",
  },
];

export default function Objectifs() {
  const theme = useTheme();
  const { data, refresh } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);

  const [goalEdits, setGoalEdits] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState(() =>
    data.targets.map((t) => ({ ...t })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const existing = useMemo(() => {
    const map: Record<string, number> = {};
    for (const goal of data.goals) map[`${goal.kind}:${goal.horizon}`] = goal.targetAmount;
    return map;
  }, [data.goals]);

  const slotKey = (slot: (typeof GOAL_SLOTS)[number]) => `${slot.kind}:${slot.horizon}`;
  const rawFor = (slot: (typeof GOAL_SLOTS)[number]) => {
    const key = slotKey(slot);
    return goalEdits[key] ?? (existing[key] !== undefined ? String(existing[key]) : "");
  };

  const gap = targetGap(targets);
  const balanced = Math.abs(gap) < 0.01;

  const save = async () => {
    setBusy(true);
    setMessage(null);

    for (const slot of GOAL_SLOTS) {
      const amount = parseAmount(rawFor(slot), data.settings.currency);
      // Un champ vide signifie « pas d'objectif » : on ne crée pas une ligne à
      // zéro, que la contrainte `target_amount > 0` refuserait de toute façon.
      if (amount === null || amount <= 0) continue;
      if (existing[slotKey(slot)] === amount) continue;

      const result = await upsertGoal({
        kind: slot.kind,
        horizon: slot.horizon,
        label: slot.label,
        targetAmount: amount,
      });
      if (result.error) {
        setBusy(false);
        setMessage(result.error);
        return;
      }
    }

    if (balanced) {
      const result = await setTargetAllocation(targets);
      if (result.error) {
        setBusy(false);
        setMessage(result.error);
        return;
      }
    }

    setBusy(false);
    await refresh();
    setMessage(
      balanced
        ? "Enregistré."
        : "Objectifs enregistrés. L'allocation n'a pas été sauvegardée : elle ne totalise pas 100 points.",
    );
  };

  return (
    <Screen>
      <ScreenHeader overline="Réglages" title="Objectifs & allocation" />

      {/* ---------------- Objectifs ---------------- */}
      <SectionHeader
        title="Objectifs"
        subtitle="Alimentent les jalons du simulateur FIRE"
        right={<Target color={theme.colors.textMuted} size={18} />}
      />

      {GOAL_SLOTS.map((slot, index) => {
        const raw = rawFor(slot);
        const amount = parseAmount(raw, data.settings.currency);
        return (
          <Enter key={slotKey(slot)} index={index}>
            <Card style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">{slot.label}</Txt>
                  <Txt variant="caption" muted>
                    {slot.hint}
                  </Txt>
                </View>
                <TextInput
                  value={raw}
                  onChangeText={(next) =>
                    setGoalEdits((prev) => ({ ...prev, [slotKey(slot)]: next }))
                  }
                  placeholder="—"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
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
                      minWidth: 130,
                      textAlign: "right",
                    },
                  ]}
                />
              </View>

              {/* Une rente mensuelle ne parle pas tant qu'on ne sait pas quel
                  capital elle exige : la règle des 25 le traduit. */}
              {slot.kind === "revenu_passif" && amount !== null && amount > 0 ? (
                <>
                  <Divider />
                  <Txt variant="caption" muted style={tabular}>
                    Capital nécessaire à {data.settings.safeWithdrawalRate} % :{" "}
                    {fmt.compact(capitalNeededFor(amount, data.settings.safeWithdrawalRate))}
                  </Txt>
                </>
              ) : null}
            </Card>
          </Enter>
        );
      })}

      {/* ---------------- Allocation cible ---------------- */}
      <SectionHeader
        title="Allocation cible"
        subtitle="Le « Portfolio Idéal » du classeur"
        right={<Wallet color={theme.colors.textMuted} size={18} />}
      />

      <Enter index={GOAL_SLOTS.length}>
        <Card style={{ gap: theme.spacing.xl }}>
          {targets.map((target) => (
            <Slider
              key={target.assetClass}
              label={labelFor(target.assetClass)}
              value={target.targetPercent}
              min={0}
              max={100}
              step={1}
              onChange={(next) =>
                setTargets((prev) =>
                  prev.map((t) =>
                    t.assetClass === target.assetClass ? { ...t, targetPercent: next } : t,
                  ),
                )
              }
              format={(v) => `${v.toFixed(0)} %`}
              color={colorForKey(target.assetClass, wealthColors)}
            />
          ))}

          <View style={{ gap: theme.spacing.sm }}>
            <Divider />
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Txt variant="h3" style={{ flex: 1 }}>
                Total
              </Txt>
              <Txt
                variant="amountMd"
                color={balanced ? theme.money.gain : theme.money.warning}
                style={tabular}
              >
                {(100 - gap).toFixed(0)} / 100
              </Txt>
            </View>
            <ProgressBar
              percent={100 - gap}
              color={balanced ? theme.money.gain : theme.money.warning}
              height={6}
            />
            {!balanced ? (
              <Txt variant="caption" color={theme.money.warning}>
                {gap > 0
                  ? `Il reste ${gap.toFixed(0)} points à répartir.`
                  : `Vous dépassez de ${Math.abs(gap).toFixed(0)} points.`}
              </Txt>
            ) : null}
          </View>

          {/* Aperçu des couleurs : les mêmes que sur les camemberts du
              portefeuille, pour qu'on reconnaisse ses classes d'actif. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
            {targets.map((target) => (
              <View
                key={target.assetClass}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Dot color={colorForKey(target.assetClass, wealthColors)} />
                <Txt variant="caption" muted style={tabular}>
                  {labelFor(target.assetClass)} {target.targetPercent.toFixed(0)} %
                </Txt>
              </View>
            ))}
          </View>
        </Card>
      </Enter>

      {message ? (
        <Txt
          variant="caption"
          color={message === "Enregistré." ? theme.money.gain : theme.money.warning}
        >
          {message}
        </Txt>
      ) : null}

      <Touchable
        onPress={save}
        haptic
        disabled={busy}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing.sm,
          backgroundColor: theme.brand.primary,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.lg,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Check color="#FFFFFF" size={18} />
            <Txt variant="h3" color="#FFFFFF">
              Enregistrer
            </Txt>
          </>
        )}
      </Touchable>
    </Screen>
  );
}
