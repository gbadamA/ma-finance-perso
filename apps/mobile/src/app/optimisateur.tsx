/**
 * Optimisateur de dépenses — module 8 du cahier des charges.
 * Checklist d'actions d'économie : aucun graphique, deux totaux et une progression.
 */

import { useMemo, useState } from "react";
import { View } from "react-native";
import { Check, Sparkles } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { actionSaving, groupSavings, summariseSavings, type SavingsAction } from "@mfp/core";
import { useData } from "../lib/data";
import { useTheme } from "../lib/theme";
import { toggleSavingsAction } from "../lib/mutations";
import { makeFormatters, tabular } from "../lib/format";
import { Screen, SectionHeader } from "../components/layout";
import {
  Card,
  Divider,
  EmptyState,
  Enter,
  Overline,
  ProgressBar,
  Touchable,
  Txt,
} from "../components/primitives";
import { ScreenHeader } from "../components/header";

export default function Optimisateur() {
  const theme = useTheme();
  const { data } = useData();
  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);

  /**
   * Cases cochées localement, avant confirmation du serveur.
   * Cocher une action doit être instantané : l'utilisateur en coche cinq
   * d'affilée, attendre un aller-retour réseau à chaque fois est intenable.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const actions = useMemo<SavingsAction[]>(
    () =>
      data.savingsActions.map((a) => ({
        ...a,
        done: overrides[a.id] ?? a.done,
      })),
    [data.savingsActions, overrides],
  );

  const summary = useMemo(() => summariseSavings(actions), [actions]);
  const groups = useMemo(() => groupSavings(actions), [actions]);

  const toggle = (action: SavingsAction) => {
    const next = !action.done;
    setOverrides((prev) => ({ ...prev, [action.id]: next }));
    // Hors ligne, la bascule part en file d'attente et sera rejouée : l'état
    // local reste donc en avance sur le serveur, ce qui est le comportement
    // voulu. Un rollback silencieux serait pire — la case se décocherait toute
    // seule sous les yeux de l'utilisateur.
    void toggleSavingsAction(action.id, next);
  };

  if (actions.length === 0) {
    return (
      <Screen>
        <ScreenHeader overline="Module 8" title="Optimisateur" />
        <EmptyState
          title="Checklist vide"
          message="La checklist est créée automatiquement à l'inscription. Rechargez l'application."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader overline="Module 8" title="Optimisateur de dépenses" />

      <Enter index={0}>
        <Card style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Overline>Acquis / mois</Overline>
              <Txt variant="amountLg" color={theme.money.gain} style={tabular}>
                {fmt.amount(summary.achievedMonthly)}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Overline>Reste à gagner</Overline>
              <Txt variant="amountLg" color={theme.money.warning} style={tabular}>
                {fmt.amount(summary.remainingMonthly)}
              </Txt>
            </View>
          </View>

          <ProgressBar percent={summary.progressPercent} color={theme.money.gain} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
            <Txt variant="caption" muted style={[tabular, { flex: 1 }]}>
              {summary.doneCount} / {summary.feasibleCount} actions réalisées
            </Txt>
            {summary.achievedYearly > 0 ? (
              <Txt variant="caption" color={theme.brand.accent} style={tabular}>
                {fmt.compact(summary.achievedYearly)} par an
              </Txt>
            ) : null}
          </View>
        </Card>
      </Enter>

      {summary.achievedYearly > 0 ? (
        <Enter index={1}>
          <Card alt style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
            <Sparkles color={theme.brand.accent} size={20} />
            <Txt variant="caption" style={{ flex: 1 }}>
              Ces {fmt.amount(summary.achievedMonthly)} par mois, investis au lieu d'être dépensés,
              alimentent directement votre projection FIRE.
            </Txt>
          </Card>
        </Enter>
      ) : null}

      {groups.map((group, groupIndex) => (
        <Enter key={group.category} index={groupIndex + 2}>
          <View style={{ gap: theme.spacing.md }}>
            <SectionHeader
              title={group.category}
              subtitle={
                group.potentialMonthly > 0
                  ? `${fmt.compact(group.achievedMonthly)} sur ${fmt.compact(group.potentialMonthly)} par mois`
                  : "Montants à renseigner"
              }
            />
            <Card padded={false}>
              {group.actions.map((action, index) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  format={fmt.amount}
                  onToggle={() => toggle(action)}
                  last={index === group.actions.length - 1}
                />
              ))}
            </Card>
          </View>
        </Enter>
      ))}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ActionRow({
  action,
  format,
  onToggle,
  last,
}: {
  action: SavingsAction;
  format: (v: number) => string;
  onToggle: () => void;
  last: boolean;
}) {
  const theme = useTheme();
  const saving = actionSaving(action);
  const disabled = !action.feasible;

  return (
    <View>
      <Touchable
        onPress={onToggle}
        haptic
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: action.done, disabled }}
        accessibilityLabel={action.label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: action.done ? theme.money.gain : theme.colors.border,
            backgroundColor: action.done ? theme.money.gain : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {action.done ? (
            <Animated.View entering={FadeIn.duration(theme.motion.duration.instant)}>
              <Check color={theme.colors.surface} size={15} strokeWidth={3} />
            </Animated.View>
          ) : null}
        </View>

        <Txt
          variant="body"
          style={{
            flex: 1,
            textDecorationLine: action.done ? "line-through" : "none",
          }}
          numberOfLines={2}
        >
          {action.label}
        </Txt>

        {saving !== 0 ? (
          <Txt
            variant="amountSm"
            color={action.done ? theme.money.gain : theme.colors.textMuted}
            style={tabular}
          >
            {format(saving)}
          </Txt>
        ) : (
          <Txt variant="caption" muted>
            —
          </Txt>
        )}
      </Touchable>
      {!last ? <Divider style={{ marginLeft: theme.spacing.lg + 24 + theme.spacing.md }} /> : null}
    </View>
  );
}
