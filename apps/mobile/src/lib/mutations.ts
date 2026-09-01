/**
 * Écritures en base.
 *
 * Chaque écriture est décrite comme une **opération rejouable** (`PendingOp`),
 * ce qui permet de la mettre en file quand le réseau manque et de la rejouer
 * telle quelle plus tard. Les écrans n'ont donc à connaître ni les noms de
 * colonnes Postgres, ni l'état du réseau.
 *
 * ⚠️ Aucune de ces fonctions n'envoie de `user_id` : le trigger `set_user_id()`
 * le renseigne côté base et la policy RLS le vérifie (§3.2).
 */

import { monthToDate } from "@mfp/supabase";
import { supabase } from "./supabase";
import {
  enqueue,
  flushQueue,
  isNetworkError,
  isOnline,
  pendingCount,
  type PendingOp,
  type SettingsPatch,
} from "./queue";

export type MutationResult = {
  error: string | null;
  /** L'opération est enregistrée localement et partira au retour du réseau. */
  queued?: boolean;
};

const DEMO_ERROR = "Mode démonstration : la saisie n'est pas enregistrée.";

/* ------------------------------------------------------------------ *
 * Exécution d'une opération
 * ------------------------------------------------------------------ */

/** Envoie réellement une opération. C'est aussi ce que rejoue la file. */
export async function applyOp(op: PendingOp): Promise<{ error: string | null }> {
  if (!supabase) return { error: DEMO_ERROR };
  const client = supabase;

  switch (op.kind) {
    case "expense.add": {
      const { error } = await client.from("expense_entries").insert({
        category_id: op.payload.categoryId,
        spent_on: op.payload.spentOn,
        amount: op.payload.amount,
        note: op.payload.note?.trim() || null,
        receipt_path: op.payload.receiptPath ?? null,
      });
      return { error: error?.message ?? null };
    }

    case "income.set": {
      // `upsert` : ressaisir un mois **corrige** au lieu de doubler, comme une
      // case du classeur (contrainte unique `source_id, month`).
      const { error } = await client.from("income_entries").upsert(
        {
          source_id: op.payload.sourceId,
          month: monthToDate(op.payload.month),
          amount: op.payload.amount,
          note: op.payload.note?.trim() || null,
        },
        { onConflict: "source_id,month" },
      );
      return { error: error?.message ?? null };
    }

    case "balances.set": {
      if (op.payload.balances.length === 0) return { error: null };
      const { error } = await client.from("account_snapshots").upsert(
        op.payload.balances.map((b) => ({
          account_id: b.accountId,
          month: monthToDate(op.payload.month),
          balance: b.balance,
        })),
        { onConflict: "account_id,month" },
      );
      return { error: error?.message ?? null };
    }

    case "investments.set": {
      if (op.payload.amounts.length === 0) return { error: null };
      const { error } = await client.from("investment_snapshots").upsert(
        op.payload.amounts.map((a) => ({
          asset_class: a.assetClass,
          month: monthToDate(op.payload.month),
          amount: a.amount,
        })),
        { onConflict: "user_id,asset_class,month" },
      );
      return { error: error?.message ?? null };
    }

    case "asset.value": {
      const { error } = await client
        .from("assets")
        .update({ current_value: op.payload.value })
        .eq("id", op.payload.assetId);
      return { error: error?.message ?? null };
    }

    case "goal.upsert": {
      const { error } = await client.from("financial_goals").upsert(
        {
          kind: op.payload.kind,
          horizon: op.payload.horizon,
          label: op.payload.label,
          target_amount: op.payload.targetAmount,
        },
        { onConflict: "user_id,kind,horizon" },
      );
      return { error: error?.message ?? null };
    }

    case "goal.delete": {
      const { error } = await client.from("financial_goals").delete().eq("id", op.payload.id);
      return { error: error?.message ?? null };
    }

    case "savings.toggle": {
      const { error } = await client
        .from("savings_actions")
        .update({ done: op.payload.done })
        .eq("id", op.payload.id);
      return { error: error?.message ?? null };
    }

    case "settings.update": {
      // PostgREST exige un filtre sur un UPDATE. `user_id is not null` est
      // toujours vrai, et la RLS restreint déjà la portée à la ligne de
      // l'utilisateur — on n'a donc pas besoin de connaître son identifiant.
      const { error } = await client
        .from("settings")
        .update(op.payload)
        .not("user_id", "is", null);
      return { error: error?.message ?? null };
    }
  }
}

/**
 * Tente l'envoi, met en file si le réseau manque.
 *
 * On teste la connectivité **avant** d'essayer : sans cela chaque saisie
 * hors-ligne attend le timeout HTTP (plusieurs secondes) avant d'être mise en
 * file, et l'utilisateur croit l'app bloquée.
 */
async function perform(op: PendingOp): Promise<MutationResult> {
  if (!supabase) return { error: DEMO_ERROR };

  if (!(await isOnline())) {
    await enqueue(op);
    return { error: null, queued: true };
  }

  const { error } = await applyOp(op);
  if (!error) return { error: null };

  if (isNetworkError(error)) {
    await enqueue(op);
    return { error: null, queued: true };
  }
  return { error };
}

/* ------------------------------------------------------------------ *
 * File d'attente — réexportée pour l'interface
 * ------------------------------------------------------------------ */

/** Rejoue les saisies faites hors-ligne. Appelé au retour au premier plan. */
export function flushPending() {
  return flushQueue(applyOp);
}

export { pendingCount };

/* ------------------------------------------------------------------ *
 * API des écrans
 * ------------------------------------------------------------------ */

export function addExpense(input: {
  categoryId: string;
  /** Date ISO `AAAA-MM-JJ`. */
  spentOn: string;
  /** Entier d'unité mineure. */
  amount: number;
  note?: string;
  receiptPath?: string;
}): Promise<MutationResult> {
  return perform({ kind: "expense.add", payload: input });
}

export function setIncome(input: {
  sourceId: string;
  /** `MonthKey` (« 2026-08 »). */
  month: string;
  amount: number;
  note?: string;
}): Promise<MutationResult> {
  return perform({ kind: "income.set", payload: input });
}

export function setAccountBalances(
  month: string,
  balances: readonly { accountId: string; balance: number }[],
): Promise<MutationResult> {
  if (balances.length === 0) return Promise.resolve({ error: null });
  return perform({ kind: "balances.set", payload: { month, balances: [...balances] } });
}

export function setInvestmentAmounts(
  month: string,
  amounts: readonly { assetClass: string; amount: number }[],
): Promise<MutationResult> {
  if (amounts.length === 0) return Promise.resolve({ error: null });
  return perform({ kind: "investments.set", payload: { month, amounts: [...amounts] } });
}

export function setAssetValue(assetId: string, value: number): Promise<MutationResult> {
  return perform({ kind: "asset.value", payload: { assetId, value } });
}

export function upsertGoal(input: {
  kind: "fortune" | "revenu_passif";
  horizon: "court" | "moyen" | "long" | "minimum" | "ideal";
  label: string;
  targetAmount: number;
}): Promise<MutationResult> {
  return perform({ kind: "goal.upsert", payload: input });
}

export function deleteGoal(id: string): Promise<MutationResult> {
  return perform({ kind: "goal.delete", payload: { id } });
}

export function toggleSavingsAction(id: string, done: boolean): Promise<MutationResult> {
  return perform({ kind: "savings.toggle", payload: { id, done } });
}

export function updateSettings(payload: SettingsPatch): Promise<MutationResult> {
  return perform({ kind: "settings.update", payload });
}

/* ------------------------------------------------------------------ *
 * Allocation cible — écriture directe
 * ------------------------------------------------------------------ */

/**
 * Enregistre l'allocation cible. **Pas de mise en file** : c'est un réglage
 * qu'on modifie assis, pas une saisie sur le terrain, et le rejeu d'un
 * remplacement complet dans le désordre produirait une allocation incohérente.
 */
export async function setTargetAllocation(
  targets: readonly { assetClass: string; targetPercent: number }[],
): Promise<MutationResult> {
  if (!supabase) return { error: DEMO_ERROR };
  const { error } = await supabase.from("investment_targets").upsert(
    targets.map((t, index) => ({
      asset_class: t.assetClass,
      target_percent: t.targetPercent,
      position: index + 1,
    })),
    { onConflict: "user_id,asset_class" },
  );
  return { error: error?.message ?? null };
}
