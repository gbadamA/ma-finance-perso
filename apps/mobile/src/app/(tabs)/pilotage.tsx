/**
 * Pilotage — point d'entrée des modules stratégiques (5 à 9).
 *
 * Ces écrans ne sont pas consultés tous les jours : les mettre en onglets
 * principaux diluerait la barre de navigation. Ils sont regroupés ici avec,
 * pour chacun, **le chiffre qui donne envie de l'ouvrir** — pas seulement un
 * libellé et un chevron.
 */

import { useMemo } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  ChevronRight,
  Clock,
  ListChecks,
  Package,
  PieChart,
  Rocket,
  Target,
  Wallet,
} from "lucide-react-native";
import {
  analysePortfolio,
  capitalNeededFor,
  lifeClock,
  projectFireWithGoals,
  summariseSavings,
  totalEquity,
  wealthAt,
  wealthSeries,
} from "@mfp/core";
import { useData } from "../../lib/data";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { makeFormatters, tabular } from "../../lib/format";
import { Screen, SectionHeader } from "../../components/layout";
import {
  Badge,
  Card,
  Enter,
  Overline,
  ProgressBar,
  Touchable,
  Txt,
} from "../../components/primitives";

export default function Pilotage() {
  const theme = useTheme();
  const router = useRouter();
  const { data, loading, refresh } = useData();
  const { signOut, email, isDemo } = useAuth();

  const fmt = useMemo(() => makeFormatters(data.settings.currency), [data.settings.currency]);

  const summary = useMemo(() => {
    const series = wealthSeries(data.accounts, data.accountSnapshots, data.assets);
    const reference = series.at(-1)?.month ?? null;
    const wealth = reference
      ? wealthAt(data.accounts, data.accountSnapshots, data.assets, reference).total
      : 0;

    const invested = data.investmentSnapshots
      .filter((s) => s.month === (data.investmentSnapshots.at(-1)?.month ?? ""))
      .reduce((acc, s) => acc + s.amount, 0);

    const fire = projectFireWithGoals(
      {
        initialInvested: invested,
        monthlyInvestment: data.settings.monthlyInvestment,
        expectedReturn: data.settings.expectedReturn,
        safeWithdrawalRate: data.settings.safeWithdrawalRate,
        inflationRate: data.settings.inflationRate,
        birthDate: data.settings.birthDate,
      },
      data.goals,
    );

    const firstGoal = fire.checkpoints.find((c) => c.reachedAt !== null);
    const portfolio = analysePortfolio(
      data.investmentSnapshots,
      data.targets,
      data.settings.driftThreshold,
    );
    const savings = summariseSavings(data.savingsActions);
    const clock = lifeClock(data.settings.birthDate, data.settings.lifeExpectancy);

    return { wealth, invested, fire, firstGoal, portfolio, savings, clock };
  }, [data]);

  return (
    <Screen tabbed refreshing={loading} onRefresh={() => void refresh()}>
      <View>
        <Overline>Pilotage</Overline>
        <Txt variant="h1">Vos leviers</Txt>
      </View>

      {/* ---- FIRE : le module le plus engageant, donc en tête ---- */}
      <Enter index={0}>
        <Touchable noScale onPress={() => router.push("/fire")}>
          <Card style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <IconBubble color={theme.brand.accent}>
                <Rocket color={theme.brand.accent} size={20} />
              </IconBubble>
              <View style={{ flex: 1 }}>
                <Txt variant="h3">Indépendance financière</Txt>
                <Txt variant="caption" muted>
                  {summary.firstGoal?.reachedAt
                    ? `${summary.firstGoal.label} dans ${formatDelay(summary.firstGoal.reachedAt.monthsRemaining)}`
                    : "Définissez vos objectifs pour voir la date"}
                </Txt>
              </View>
              <ChevronRight color={theme.colors.textMuted} size={18} />
            </View>

            {summary.firstGoal?.reachedAt ? (
              <>
                <ProgressBar
                  percent={(summary.invested / summary.firstGoal.targetAmount) * 100}
                  color={theme.brand.accent}
                />
                <View style={{ flexDirection: "row" }}>
                  <Txt variant="caption" muted style={[tabular, { flex: 1 }]}>
                    {fmt.compact(summary.invested)} investis
                  </Txt>
                  <Txt variant="caption" muted style={tabular}>
                    objectif {fmt.compact(summary.firstGoal.targetAmount)}
                  </Txt>
                </View>
              </>
            ) : null}
          </Card>
        </Touchable>
      </Enter>

      {/* ---- Portefeuille ---- */}
      <Enter index={1}>
        <ModuleRow
          href="/portefeuille"
          icon={<Wallet color={theme.brand.primary} size={20} />}
          title="Portefeuille d'investissement"
          subtitle={
            summary.portfolio.total === 0
              ? "Aucun relevé"
              : `${fmt.compact(summary.portfolio.total)} · dérive max ${summary.portfolio.maxDriftPoints
                  .toFixed(1)
                  .replace(".", ",")} pts`
          }
          badge={
            summary.portfolio.needsRebalance
              ? { label: "À rééquilibrer", color: theme.money.warning }
              : undefined
          }
        />
      </Enter>

      {/* ---- Assets ---- */}
      <Enter index={2}>
        <ModuleRow
          href="/assets"
          icon={<Package color={theme.brand.primary} size={20} />}
          title="Biens de valeur"
          subtitle={`${data.assets.length} biens · net ${fmt.compact(totalEquity(data.assets))}`}
        />
      </Enter>

      {/* ---- Optimisateur ---- */}
      <Enter index={3}>
        <ModuleRow
          href="/optimisateur"
          icon={<ListChecks color={theme.brand.primary} size={20} />}
          title="Optimisateur de dépenses"
          subtitle={
            summary.savings.feasibleCount === 0
              ? "Checklist à remplir"
              : `${fmt.compact(summary.savings.achievedMonthly)}/mois acquis · ${fmt.compact(
                  summary.savings.remainingMonthly,
                )} à aller chercher`
          }
          badge={
            summary.savings.doneCount > 0
              ? {
                  label: `${summary.savings.doneCount}/${summary.savings.feasibleCount}`,
                  color: theme.money.gain,
                }
              : undefined
          }
        />
      </Enter>

      {/* ---- Héritage ---- */}
      <Enter index={4}>
        <ModuleRow
          href="/heritage"
          icon={<Clock color={theme.brand.primary} size={20} />}
          title="Planificateur d'héritage"
          subtitle={
            summary.clock
              ? `${summary.clock.livedPercent.toFixed(0)} % de vie écoulée · ${summary.clock.yearsRemaining} ans devant`
              : "Renseignez votre date de naissance"
          }
        />
      </Enter>

      {/* ---- Revenus (saisie mensuelle) ---- */}
      <Enter index={5}>
        <ModuleRow
          href="/revenus"
          icon={<PieChart color={theme.brand.primary} size={20} />}
          title="Revenus"
          subtitle={`${data.incomeSources.length} sources suivies`}
        />
      </Enter>

      {/* ---- Objectifs & allocation cible ---- */}
      <Enter index={6}>
        <ModuleRow
          href="/objectifs"
          icon={<Target color={theme.brand.primary} size={20} />}
          title="Objectifs & allocation cible"
          subtitle={
            data.goals.length === 0
              ? "Aucun objectif défini"
              : `${data.goals.length} objectifs · ${data.targets.length} classes d'actif`
          }
        />
      </Enter>

      <SectionHeader title="Compte" subtitle={email ?? undefined} />

      <Enter index={7}>
        <Card style={{ gap: theme.spacing.md }}>
          {isDemo ? (
            <Txt variant="caption" muted>
              Session de démonstration : les données sont locales et ne sont pas enregistrées.
            </Txt>
          ) : null}
          <Touchable
            onPress={() => router.push("/reglages")}
            haptic
            style={{
              paddingVertical: theme.spacing.md,
              alignItems: "center",
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <Txt variant="h3">Réglages</Txt>
          </Touchable>
          <Touchable
            onPress={() => void signOut()}
            haptic
            style={{ paddingVertical: theme.spacing.md, alignItems: "center" }}
          >
            <Txt variant="caption" color={theme.money.loss}>
              Se déconnecter
            </Txt>
          </Touchable>
        </Card>
      </Enter>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ModuleRow({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: Href;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: { label: string; color: string };
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Touchable noScale onPress={() => router.push(href)}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <IconBubble color={theme.brand.primary}>{icon}</IconBubble>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="h3">{title}</Txt>
            <Txt variant="caption" muted numberOfLines={1}>
              {subtitle}
            </Txt>
          </View>
          {badge ? (
            <Badge label={badge.label} color={badge.color} background={theme.colors.surfaceAlt} />
          ) : null}
          <ChevronRight color={theme.colors.textMuted} size={18} />
        </View>
      </Card>
    </Touchable>
  );
}

function IconBubble({ children }: { color: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/** « 7 ans 3 mois » plutôt que « 87 mois » : personne ne compte en mois au-delà de deux ans. */
function formatDelay(months: number): string {
  if (months <= 0) return "atteint";
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} ans` : `${years} ans ${rest} mois`;
}
