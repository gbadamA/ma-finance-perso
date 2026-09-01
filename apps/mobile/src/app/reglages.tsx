/**
 * Réglages — les hypothèses qui pilotent tous les modules de calcul, plus les
 * préférences de l'appareil (notifications, verrou) et l'export.
 *
 * Un changement d'hypothèse change la projection FIRE, l'alerte de dérive et
 * l'horloge de vie. C'est pourquoi chaque réglage est accompagné de ce qu'il
 * influence : un « taux de retrait sûr » sans explication ne veut rien dire
 * pour la plupart des gens, et un réglage qu'on ne comprend pas, on n'y touche pas.
 */

import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, CloudUpload, FileDown, FileText, Fingerprint, Target, X } from "lucide-react-native";
import { DEFAULT_SETTINGS, type CurrencyCode, type UserSettings } from "@mfp/core";
import { useData } from "../lib/data";
import { useAuth } from "../lib/auth";
import { useLock } from "../lib/lock";
import { updateSettings, flushPending, pendingCount } from "../lib/mutations";
import { exportCsv, exportPdf } from "../lib/export";
import {
  disableMonthlyReminder,
  enableMonthlyReminder,
  isMonthlyReminderOn,
  isNotificationsAvailable,
} from "../lib/notifications";
import { useTheme } from "../lib/theme";
import { Screen, SectionHeader } from "../components/layout";
import { Card, Divider, Enter, Overline, Touchable, Txt } from "../components/primitives";
import { Slider } from "../components/slider";
import { Toggle } from "../components/toggle";

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "XOF", label: "FCFA" },
  { code: "EUR", label: "Euro" },
  { code: "USD", label: "Dollar" },
  { code: "MAD", label: "Dirham" },
];

export default function Reglages() {
  const theme = useTheme();
  const router = useRouter();
  const { data, refresh } = useData();
  const { isDemo, email } = useAuth();
  const lock = useLock();

  const [draft, setDraft] = useState<UserSettings>(data.settings);
  const [birth, setBirth] = useState(data.settings.birthDate ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [reminder, setReminder] = useState(false);
  // `expo-notifications` ne se charge pas dans Expo Go : l'interrupteur est
  // désactivé et explique pourquoi, plutôt que d'être mort sans raison visible.
  const notificationsAvailable = isNotificationsAvailable();
  const [biometric, setBiometric] = useState(data.biometricLock);
  const [pending, setPending] = useState(0);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    void isMonthlyReminderOn().then(setReminder);
    void pendingCount().then(setPending);
  }, []);

  const dirty = useMemo(
    () => JSON.stringify({ ...draft, birthDate: birth || null }) !== JSON.stringify(data.settings),
    [draft, birth, data.settings],
  );

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setMessage(null);
    if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
      setMessage("Format de date attendu : AAAA-MM-JJ.");
      return;
    }
    setSaving(true);
    const result = await updateSettings({
      currency: draft.currency,
      birth_date: birth || null,
      safe_withdrawal_rate: draft.safeWithdrawalRate,
      inflation_rate: draft.inflationRate,
      expected_return: draft.expectedReturn,
      monthly_investment: draft.monthlyInvestment,
      average_window_months: draft.averageWindowMonths,
      drift_threshold: draft.driftThreshold,
      life_expectancy: draft.lifeExpectancy,
      inheritance_target_age: draft.inheritanceTargetAge,
    });
    setSaving(false);
    if (result.error) setMessage(result.error);
    else {
      await refresh();
      router.back();
    }
  };

  const toggleReminder = async (next: boolean) => {
    if (next) {
      const granted = await enableMonthlyReminder();
      setReminder(granted);
      if (!granted) {
        setMessage("Notifications refusées. Autorisez-les dans les réglages du téléphone.");
      }
    } else {
      await disableMonthlyReminder();
      setReminder(false);
    }
  };

  const toggleBiometric = async (next: boolean) => {
    if (next && !lock.supported) {
      setMessage("Aucune empreinte ni code n'est configuré sur cet appareil.");
      return;
    }
    setBiometric(next);
    lock.setEnabled(next);
    const result = await updateSettings({ biometric_lock: next });
    if (result.error) setMessage(result.error);
    else await refresh();
  };

  const runExport = async (kind: "csv" | "pdf") => {
    setMessage(null);
    setExporting(kind);
    const result = kind === "csv" ? await exportCsv(data) : await exportPdf(data);
    setExporting(null);
    if (result.error) setMessage(result.error);
  };

  const syncNow = async () => {
    const outcome = await flushPending();
    setPending(outcome.remaining);
    if (outcome.sent > 0) await refresh();
    setMessage(
      outcome.sent > 0
        ? `${outcome.sent} saisie(s) envoyée(s).`
        : outcome.remaining > 0
          ? "Toujours hors ligne : les saisies restent en attente."
          : "Rien en attente.",
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Overline>Réglages</Overline>
          <Txt variant="h2">Hypothèses</Txt>
          {email ? (
            <Txt variant="caption" muted>
              {email}
            </Txt>
          ) : null}
        </View>
        <Touchable
          onPress={() => router.back()}
          haptic
          accessibilityLabel="Fermer"
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X color={theme.colors.text} size={20} />
        </Touchable>
      </View>

      {/* -------- Saisies en attente -------- */}
      {pending > 0 ? (
        <Enter index={0}>
          <Card
            alt
            style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}
          >
            <CloudUpload color={theme.money.warning} size={20} />
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{pending} saisie(s) en attente</Txt>
              <Txt variant="caption" muted>
                Enregistrées sur l'appareil, elles partiront au retour du réseau.
              </Txt>
            </View>
            <Touchable
              onPress={() => void syncNow()}
              haptic
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.brand.primary,
              }}
            >
              <Txt variant="caption" color="#FFFFFF" style={{ fontWeight: "700" }}>
                Envoyer
              </Txt>
            </Touchable>
          </Card>
        </Enter>
      ) : null}

      {/* -------- Objectifs -------- */}
      <Enter index={1}>
        <Touchable noScale onPress={() => router.push("/objectifs")}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <Target color={theme.brand.accent} size={20} />
            <View style={{ flex: 1 }}>
              <Txt variant="h3">Objectifs & allocation cible</Txt>
              <Txt variant="caption" muted>
                {data.goals.length} objectifs · {data.targets.length} classes d'actif
              </Txt>
            </View>
          </Card>
        </Touchable>
      </Enter>

      {/* -------- Devise -------- */}
      <Enter index={2}>
        <Card style={{ gap: theme.spacing.md }}>
          <SectionHeader title="Devise" subtitle="Tous les montants de l'application" />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
            {CURRENCIES.map((c) => {
              const active = draft.currency === c.code;
              return (
                <Touchable key={c.code} onPress={() => set("currency", c.code)} haptic>
                  <View
                    style={{
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? theme.brand.primary : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? theme.brand.primary : theme.colors.border,
                    }}
                  >
                    <Txt
                      variant="caption"
                      color={active ? "#FFFFFF" : theme.colors.textMuted}
                      style={{ fontWeight: active ? "700" : "500" }}
                    >
                      {c.label}
                    </Txt>
                  </View>
                </Touchable>
              );
            })}
          </View>
        </Card>
      </Enter>

      {/* -------- Identité -------- */}
      <Enter index={3}>
        <Card style={{ gap: theme.spacing.md }}>
          <SectionHeader
            title="Date de naissance"
            subtitle="Pilote l'âge des objectifs FIRE et l'horloge de vie"
          />
          <TextInput
            value={birth}
            onChangeText={setBirth}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numbers-and-punctuation"
            style={{
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              color: theme.colors.text,
              fontSize: theme.typography.body.fontSize,
              fontVariant: ["tabular-nums"],
            }}
          />
        </Card>
      </Enter>

      {/* -------- Projection -------- */}
      <Enter index={4}>
        <Card style={{ gap: theme.spacing.xl }}>
          <SectionHeader title="Projection" subtitle="Modules FIRE et héritage" />
          <Slider
            label="Rendement annuel attendu"
            value={draft.expectedReturn}
            min={0}
            max={15}
            step={0.5}
            onChange={(v) => set("expectedReturn", v)}
            format={(v) => `${v.toFixed(1).replace(".", ",")} %`}
            color={theme.money.gain}
          />
          <Slider
            label="Taux de retrait sûr"
            value={draft.safeWithdrawalRate}
            min={2}
            max={8}
            step={0.25}
            onChange={(v) => set("safeWithdrawalRate", v)}
            format={(v) => `${v.toFixed(2).replace(".", ",")} %`}
          />
          <Slider
            label="Inflation annuelle"
            value={draft.inflationRate}
            min={0}
            max={12}
            step={0.5}
            onChange={(v) => set("inflationRate", v)}
            format={(v) => `${v.toFixed(1).replace(".", ",")} %`}
            color={theme.money.warning}
          />
          <Txt variant="caption" muted>
            Le taux de retrait sûr est le pourcentage du capital qu'on peut retirer chaque année
            sans l'épuiser. La règle courante est 4 %.
          </Txt>
        </Card>
      </Enter>

      {/* -------- Seuils -------- */}
      <Enter index={5}>
        <Card style={{ gap: theme.spacing.xl }}>
          <SectionHeader title="Seuils" subtitle="Vue d'ensemble et portefeuille" />
          <Slider
            label="Fenêtre des moyennes"
            value={draft.averageWindowMonths}
            min={1}
            max={24}
            step={1}
            onChange={(v) => set("averageWindowMonths", v)}
            format={(v) => `${v} mois`}
          />
          <Slider
            label="Seuil d'alerte de dérive"
            value={draft.driftThreshold}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) => set("driftThreshold", v)}
            format={(v) => `± ${v.toFixed(1).replace(".", ",")} pts`}
            color={theme.money.warning}
          />
          <Slider
            label="Espérance de vie"
            value={draft.lifeExpectancy}
            min={50}
            max={110}
            step={1}
            onChange={(v) => set("lifeExpectancy", v)}
            format={(v) => `${v} ans`}
          />
        </Card>
      </Enter>

      {/* -------- Appareil -------- */}
      <Enter index={6}>
        <Card style={{ gap: theme.spacing.lg }}>
          <SectionHeader title="Cet appareil" subtitle="Ne quitte pas le téléphone" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <Bell color={theme.colors.textMuted} size={18} />
            <View style={{ flex: 1 }}>
              <Toggle
                value={reminder}
                onChange={(next) => void toggleReminder(next)}
                label="Rappel mensuel"
                hint={
                  notificationsAvailable
                    ? "Le 1er de chaque mois à 9 h"
                    : "Indisponible dans Expo Go — nécessite un development build"
                }
                disabled={!notificationsAvailable}
              />
            </View>
          </View>
          <Divider />
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <Fingerprint color={theme.colors.textMuted} size={18} />
            <View style={{ flex: 1 }}>
              <Toggle
                value={biometric}
                onChange={(next) => void toggleBiometric(next)}
                label="Verrouillage biométrique"
                hint={
                  lock.supported
                    ? "Demandé à l'ouverture de l'application"
                    : "Aucune empreinte ni code sur cet appareil"
                }
                disabled={!lock.supported}
              />
            </View>
          </View>
        </Card>
      </Enter>

      {/* -------- Export -------- */}
      <Enter index={7}>
        <Card style={{ gap: theme.spacing.md }}>
          <SectionHeader title="Export" subtitle="Continuité avec l'usage Excel" />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <ExportButton
              icon={<FileDown color={theme.brand.primary} size={17} />}
              label="CSV"
              busy={exporting === "csv"}
              onPress={() => void runExport("csv")}
            />
            <ExportButton
              icon={<FileText color={theme.brand.primary} size={17} />}
              label="Rapport PDF"
              busy={exporting === "pdf"}
              onPress={() => void runExport("pdf")}
            />
          </View>
          <Txt variant="caption" muted>
            Le CSV contient toutes vos données brutes. Le PDF est un rapport de synthèse sur les
            douze derniers mois.
          </Txt>
        </Card>
      </Enter>

      {message ? (
        <Txt variant="caption" color={theme.money.warning}>
          {message}
        </Txt>
      ) : null}

      {isDemo ? (
        <Txt variant="caption" muted>
          Mode démonstration : les modifications ne sont pas enregistrées.
        </Txt>
      ) : null}

      <Touchable
        onPress={save}
        haptic
        disabled={!dirty || saving}
        style={{
          backgroundColor: dirty ? theme.brand.primary : theme.colors.surfaceAlt,
          borderRadius: theme.radius.sm,
          paddingVertical: theme.spacing.lg,
          alignItems: "center",
        }}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Txt variant="h3" color={dirty ? "#FFFFFF" : theme.colors.textMuted}>
            {dirty ? "Enregistrer" : "Aucun changement"}
          </Txt>
        )}
      </Touchable>

      <Divider />
      <Txt variant="caption" muted>
        Valeurs par défaut : rendement {DEFAULT_SETTINGS.expectedReturn} %, retrait{" "}
        {DEFAULT_SETTINGS.safeWithdrawalRate} %, inflation {DEFAULT_SETTINGS.inflationRate} %.
      </Txt>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ExportButton({
  icon,
  label,
  busy,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Touchable
      onPress={onPress}
      haptic
      disabled={busy}
      accessibilityRole="button"
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {busy ? <ActivityIndicator color={theme.brand.primary} size="small" /> : icon}
      <Txt variant="caption" style={{ fontWeight: "600" }}>
        {label}
      </Txt>
    </Touchable>
  );
}
