import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Lecture complète du dossier financier d'un utilisateur.
 *
 * **Un seul appel plutôt qu'un par module.** Les volumes sont ceux d'une vie
 * financière personnelle — quelques milliers de lignes au bout de dix ans — et
 * l'application calcule tout en mémoire via `@mfp/core`. Douze allers-retours
 * séquentiels sur une connexion mobile ivoirienne se verraient à l'ouverture.
 *
 * ⚠️ Chaque requête porte `where: { userId }`. C'est ce filtre, et lui seul, qui
 * remplace la Row Level Security de Supabase : l'oublier exposerait les données
 * de tous les utilisateurs. Ne jamais accepter un `userId` venant du client —
 * il vient du JWT, via `@CurrentUser()`.
 */
@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string) {
    const scope = { where: { userId } };

    const [
      settings,
      accounts,
      accountSnapshots,
      incomeSources,
      incomeEntries,
      expenseCategories,
      expenseEntries,
      assets,
      targets,
      investmentSnapshots,
      goals,
      savingsActions,
    ] = await this.prisma.$transaction([
      this.prisma.settings.findUnique({ where: { userId } }),
      this.prisma.account.findMany({ ...scope, orderBy: { position: "asc" } }),
      this.prisma.accountSnapshot.findMany({ ...scope, orderBy: { month: "asc" } }),
      this.prisma.incomeSource.findMany({ ...scope, orderBy: { position: "asc" } }),
      this.prisma.incomeEntry.findMany({ ...scope, orderBy: { month: "asc" } }),
      this.prisma.expenseCategory.findMany({ ...scope, orderBy: { position: "asc" } }),
      this.prisma.expenseEntry.findMany({ ...scope, orderBy: { spentOn: "asc" } }),
      this.prisma.asset.findMany({ where: { userId, archived: false } }),
      this.prisma.investmentTarget.findMany({ ...scope, orderBy: { position: "asc" } }),
      this.prisma.investmentSnapshot.findMany({ ...scope, orderBy: { month: "asc" } }),
      this.prisma.financialGoal.findMany(scope),
      this.prisma.savingsAction.findMany({ ...scope, orderBy: { position: "asc" } }),
    ]);

    return {
      // `biometricLock` est hors de `settings` : c'est une préférence
      // d'interface, pas une hypothèse de calcul.
      biometricLock: settings?.biometricLock ?? false,

      settings: {
        currency: settings?.currency ?? "XOF",
        birthDate: settings?.birthDate ?? null,
        safeWithdrawalRate: settings?.safeWithdrawalRate ?? 4,
        inflationRate: settings?.inflationRate ?? 3,
        expectedReturn: settings?.expectedReturn ?? 7,
        monthlyInvestment: settings?.monthlyInvestment ?? 0n,
        averageWindowMonths: settings?.averageWindowMonths ?? 6,
        driftThreshold: settings?.driftThreshold ?? 5,
        lifeExpectancy: settings?.lifeExpectancy ?? 80,
        inheritanceTargetAge: settings?.inheritanceTargetAge ?? 90,
      },

      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        currency: a.currency,
        archived: a.archived,
      })),

      accountSnapshots: accountSnapshots.map((s) => ({
        accountId: s.accountId,
        month: monthKey(s.month),
        balance: s.balance,
      })),

      incomeSources: incomeSources.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        isInvestment: s.isInvestment,
      })),

      incomeEntries: incomeEntries.map((e) => ({
        id: e.id,
        sourceId: e.sourceId,
        month: monthKey(e.month),
        amount: e.amount,
      })),

      expenseCategories: expenseCategories.map((c) => ({
        id: c.id,
        key: c.key,
        label: c.label,
      })),

      expenseEntries: expenseEntries.map((e) => ({
        id: e.id,
        categoryId: e.categoryId,
        date: isoDay(e.spentOn),
        amount: e.amount,
        note: e.note,
        receiptId: e.receiptId,
      })),

      assets: assets.map((a) => ({
        id: a.id,
        category: a.category,
        name: a.name,
        purchaseDate: a.purchaseDate ? isoDay(a.purchaseDate) : null,
        purchasePrice: a.purchasePrice,
        debt: a.debt,
        maintenanceCost: a.maintenanceCost,
        currentValue: a.currentValue,
        conditionScore: a.conditionScore,
      })),

      targets: targets.map((t) => ({
        assetClass: t.assetClass,
        targetPercent: t.targetPercent,
      })),

      investmentSnapshots: investmentSnapshots.map((s) => ({
        assetClass: s.assetClass,
        month: monthKey(s.month),
        amount: s.amount,
      })),

      goals: goals.map((g) => ({
        id: g.id,
        kind: g.kind,
        horizon: g.horizon,
        label: g.label,
        targetAmount: g.targetAmount,
      })),

      savingsActions: savingsActions.map((a) => ({
        id: a.id,
        category: a.category,
        label: a.label,
        feasible: a.feasible,
        initialExpense: a.initialExpense,
        newExpense: a.newExpense,
        done: a.done,
      })),
    };
  }
}

/**
 * `Date` -> « 2026-08 ».
 *
 * On lit les composants **UTC** : la colonne est un `date` Postgres, que le
 * pilote matérialise à minuit UTC. Passer par `getMonth()` local ferait
 * basculer la date au mois précédent dans tous les fuseaux négatifs.
 */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** `Date` -> « 2026-08-14 », même raisonnement sur l'UTC. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
