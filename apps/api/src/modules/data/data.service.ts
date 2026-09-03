import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  AddExpenseDto,
  SetAssetValueDto,
  SetBalancesDto,
  SetIncomeDto,
  SetInvestmentsDto,
  SetTargetsDto,
  ToggleSavingsDto,
  UpdateSettingsDto,
  UpsertGoalDto,
} from "./data.dto";

/**
 * Toutes les écritures du dossier financier.
 *
 * ⚠️ **C'est ici que vit l'isolation des données.** Avec Supabase, la Row Level
 * Security la garantissait au niveau du moteur Postgres : même une requête
 * fautive ne pouvait pas franchir la frontière. Ici, c'est du code — et une
 * seule méthode qui oublierait le `userId` exposerait ou écraserait les données
 * d'un autre utilisateur.
 *
 * Deux règles, sans exception :
 *
 *  1. Le `userId` vient **toujours** du JWT (`@CurrentUser()`), jamais du corps
 *     de la requête ni de l'URL.
 *  2. Toute écriture visant une ligne existante passe par un `updateMany` /
 *     `deleteMany` filtré sur `{ id, userId }`, jamais par `update({ where: { id } })` :
 *     avec un identifiant seul, connaître un UUID suffirait à modifier la ligne
 *     d'autrui. Un compte de lignes touchées à zéro vaut « introuvable ».
 */
@Injectable()
export class DataService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------------------------------------------------------- *
   * Dépenses
   * ---------------------------------------------------------------- */

  async addExpense(userId: string, dto: AddExpenseDto) {
    // La catégorie doit appartenir à l'utilisateur : sans cette vérification,
    // une dépense pourrait être rattachée à la catégorie d'un autre compte.
    await this.assertOwns("expenseCategory", userId, dto.categoryId);
    if (dto.receiptId) await this.assertOwns("receipt", userId, dto.receiptId);

    return this.prisma.expenseEntry.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        spentOn: new Date(`${dto.spentOn}T00:00:00Z`),
        amount: BigInt(dto.amount),
        note: dto.note?.trim() || null,
        receiptId: dto.receiptId ?? null,
      },
      select: { id: true },
    });
  }

  async deleteExpense(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.expenseEntry.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException("Dépense introuvable.");
  }

  /* ---------------------------------------------------------------- *
   * Revenus
   * ---------------------------------------------------------------- */

  /**
   * Un seul revenu par source et par mois : ressaisir **corrige** au lieu de
   * doubler, comme une case du classeur.
   */
  async setIncome(userId: string, dto: SetIncomeDto): Promise<void> {
    await this.assertOwns("incomeSource", userId, dto.sourceId);
    const month = monthDate(dto.month);

    await this.prisma.incomeEntry.upsert({
      where: { sourceId_month: { sourceId: dto.sourceId, month } },
      create: {
        userId,
        sourceId: dto.sourceId,
        month,
        amount: BigInt(dto.amount),
        note: dto.note?.trim() || null,
      },
      update: { amount: BigInt(dto.amount), note: dto.note?.trim() || null },
    });
  }

  /* ---------------------------------------------------------------- *
   * Soldes de comptes
   * ---------------------------------------------------------------- */

  async setBalances(userId: string, dto: SetBalancesDto): Promise<void> {
    if (dto.balances.length === 0) return;

    // Un seul aller-retour pour vérifier la propriété de tous les comptes,
    // plutôt qu'une requête par ligne.
    const ids = [...new Set(dto.balances.map((b) => b.accountId))];
    const owned = await this.prisma.account.count({ where: { userId, id: { in: ids } } });
    if (owned !== ids.length) throw new ForbiddenException("Compte inconnu.");

    const month = monthDate(dto.month);

    // Transaction : le point mensuel est un tout. Enregistrer trois soldes sur
    // huit laisserait une fortune fausse à l'écran.
    await this.prisma.$transaction(
      dto.balances.map((b) =>
        this.prisma.accountSnapshot.upsert({
          where: { accountId_month: { accountId: b.accountId, month } },
          create: { userId, accountId: b.accountId, month, balance: BigInt(b.balance) },
          update: { balance: BigInt(b.balance) },
        }),
      ),
    );
  }

  /* ---------------------------------------------------------------- *
   * Portefeuille
   * ---------------------------------------------------------------- */

  async setInvestments(userId: string, dto: SetInvestmentsDto): Promise<void> {
    if (dto.amounts.length === 0) return;
    const month = monthDate(dto.month);

    await this.prisma.$transaction(
      dto.amounts.map((a) =>
        this.prisma.investmentSnapshot.upsert({
          where: {
            userId_assetClass_month: { userId, assetClass: a.assetClass, month },
          },
          create: { userId, assetClass: a.assetClass, month, amount: BigInt(a.amount) },
          update: { amount: BigInt(a.amount) },
        }),
      ),
    );
  }

  async setTargets(userId: string, dto: SetTargetsDto): Promise<void> {
    await this.prisma.$transaction(
      dto.targets.map((t, index) =>
        this.prisma.investmentTarget.upsert({
          where: { userId_assetClass: { userId, assetClass: t.assetClass } },
          create: {
            userId,
            assetClass: t.assetClass,
            targetPercent: t.targetPercent,
            position: index + 1,
          },
          update: { targetPercent: t.targetPercent, position: index + 1 },
        }),
      ),
    );
  }

  /* ---------------------------------------------------------------- *
   * Biens de valeur
   * ---------------------------------------------------------------- */

  async setAssetValue(userId: string, id: string, dto: SetAssetValueDto): Promise<void> {
    const { count } = await this.prisma.asset.updateMany({
      where: { id, userId },
      data: { currentValue: BigInt(dto.value) },
    });
    if (count === 0) throw new NotFoundException("Bien introuvable.");
  }

  /* ---------------------------------------------------------------- *
   * Objectifs
   * ---------------------------------------------------------------- */

  async upsertGoal(userId: string, dto: UpsertGoalDto): Promise<void> {
    await this.prisma.financialGoal.upsert({
      where: {
        userId_kind_horizon: { userId, kind: dto.kind, horizon: dto.horizon },
      },
      create: {
        userId,
        kind: dto.kind,
        horizon: dto.horizon,
        label: dto.label,
        targetAmount: BigInt(dto.targetAmount),
      },
      update: { label: dto.label, targetAmount: BigInt(dto.targetAmount) },
    });
  }

  async deleteGoal(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financialGoal.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException("Objectif introuvable.");
  }

  /* ---------------------------------------------------------------- *
   * Optimisateur de dépenses
   * ---------------------------------------------------------------- */

  async toggleSavings(userId: string, id: string, dto: ToggleSavingsDto): Promise<void> {
    const { count } = await this.prisma.savingsAction.updateMany({
      where: { id, userId },
      data: { done: dto.done },
    });
    if (count === 0) throw new NotFoundException("Action introuvable.");
  }

  /* ---------------------------------------------------------------- *
   * Réglages
   * ---------------------------------------------------------------- */

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<void> {
    await this.prisma.settings.update({
      where: { userId },
      data: {
        ...dto,
        // `monthlyInvestment` est le seul montant du lot : il passe en BigInt,
        // les autres champs sont des nombres ou des booléens.
        ...(dto.monthlyInvestment !== undefined
          ? { monthlyInvestment: BigInt(dto.monthlyInvestment) }
          : {}),
      },
    });
  }

  /* ---------------------------------------------------------------- *
   * Vérification de propriété
   * ---------------------------------------------------------------- */

  /**
   * Vérifie qu'une ligne référencée appartient bien à l'utilisateur.
   *
   * Renvoie « introuvable » et non « interdit » quand elle appartient à
   * quelqu'un d'autre : répondre 403 confirmerait que l'identifiant existe.
   */
  private async assertOwns(
    model: "expenseCategory" | "incomeSource" | "receipt",
    userId: string,
    id: string,
  ): Promise<void> {
    // `switch` plutôt qu'un accès dynamique `this.prisma[model]` : les délégués
    // Prisma ont des types distincts, et les unifier demanderait un cast qui
    // ferait perdre justement la vérification qu'on cherche ici.
    const where = { id, userId };
    const count =
      model === "expenseCategory"
        ? await this.prisma.expenseCategory.count({ where })
        : model === "incomeSource"
          ? await this.prisma.incomeSource.count({ where })
          : await this.prisma.receipt.count({ where });

    if (count === 0) throw new NotFoundException("Référence introuvable.");
  }
}

/**
 * « 2026-08 » -> 1er août 2026 à minuit **UTC**.
 *
 * Le `Z` est indispensable : `new Date("2026-08-01")` est déjà interprété en
 * UTC, mais `new Date(2026, 7, 1)` ne le serait pas — et la colonne étant un
 * `date` Postgres, un décalage d'une heure ferait basculer le mois.
 */
function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`);
}
