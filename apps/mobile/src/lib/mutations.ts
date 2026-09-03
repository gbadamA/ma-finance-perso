/**
 * Écritures du dossier financier.
 *
 * Chaque écriture est décrite comme une **opération rejouable** (`PendingOp`),
 * ce qui permet de la mettre en file quand le réseau manque et de la rejouer
 * telle quelle plus tard. Les écrans n'ont donc à connaître ni les routes de
 * l'API, ni l'état du réseau.
 *
 * ⚠️ Aucune de ces fonctions n'envoie d'identifiant d'utilisateur : l'API le lit
 * dans le JWT (§3.2). En envoyer un ici serait au mieux ignoré, au pire une
 * fausse impression de contrôle d'accès.
 */

import { ApiError, apiRequest, isApiConfigured, isRetryable } from "./api";
import {
  enqueue,
  flushQueue,
  isOnline,
  pendingCount,
  type ApplyResult,
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

/** Traduit une opération en requête. C'est aussi ce que rejoue la file. */
function send(op: PendingOp): Promise<unknown> {
  switch (op.kind) {
    case "expense.add":
      return apiRequest("/expenses", { method: "POST", body: op.payload });

    case "income.set":
      // `PUT` et non `POST` : ressaisir un mois **corrige** au lieu de doubler,
      // comme une case du classeur. L'API fait l'upsert sur (source, mois).
      return apiRequest("/income", { method: "PUT", body: op.payload });

    case "balances.set":
      return apiRequest("/balances", { method: "PUT", body: op.payload });

    case "investments.set":
      return apiRequest("/investments", { method: "PUT", body: op.payload });

    case "asset.value":
      return apiRequest(`/assets/${op.payload.assetId}/value`, {
        method: "PATCH",
        body: { value: op.payload.value },
      });

    case "goal.upsert":
      return apiRequest("/goals", { method: "PUT", body: op.payload });

    case "goal.delete":
      return apiRequest(`/goals/${op.payload.id}`, { method: "DELETE" });

    case "savings.toggle":
      return apiRequest(`/savings/${op.payload.id}`, {
        method: "PATCH",
        body: { done: op.payload.done },
      });

    case "settings.update":
      return apiRequest("/settings", { method: "PATCH", body: op.payload });
  }
}

/**
 * Envoie une opération et qualifie l'échec.
 *
 * `retryable` sépare « le réseau a manqué » de « le serveur a refusé » : seul le
 * premier cas mérite un rejeu, le second se reproduirait à l'identique.
 */
export async function applyOp(op: PendingOp): Promise<ApplyResult> {
  if (!isApiConfigured) return { error: DEMO_ERROR };

  try {
    await send(op);
    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Enregistrement impossible.",
      retryable: isRetryable(error),
    };
  }
}

/**
 * Tente l'envoi, met en file si le réseau manque.
 *
 * On teste la connectivité **avant** d'essayer : sans cela chaque saisie
 * hors-ligne attend le délai d'expiration HTTP (45 s) avant d'être mise en
 * file, et l'utilisateur croit l'app bloquée.
 */
async function perform(op: PendingOp): Promise<MutationResult> {
  if (!isApiConfigured) return { error: DEMO_ERROR };

  if (!(await isOnline())) {
    await enqueue(op);
    return { error: null, queued: true };
  }

  const { error, retryable } = await applyOp(op);
  if (!error) return { error: null };

  if (retryable) {
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
  /** Identifiant du reçu déjà téléversé, le cas échéant. */
  receiptId?: string;
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
 * Écritures directes
 * ------------------------------------------------------------------ */

/**
 * Enregistre l'allocation cible. **Pas de mise en file** : c'est un réglage
 * qu'on modifie assis, pas une saisie sur le terrain, et le rejeu d'un
 * remplacement complet dans le désordre produirait une allocation incohérente.
 */
export async function setTargetAllocation(
  targets: readonly { assetClass: string; targetPercent: number }[],
): Promise<MutationResult> {
  if (!isApiConfigured) return { error: DEMO_ERROR };
  try {
    await apiRequest("/targets", { method: "PUT", body: { targets: [...targets] } });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}

/**
 * Supprime une dépense. Pas de mise en file non plus : la ligne visée existe
 * déjà en base, et rejouer une suppression après un retour de réseau viserait
 * un identifiant que l'utilisateur ne voit plus depuis longtemps.
 */
export async function deleteExpense(id: string): Promise<MutationResult> {
  if (!isApiConfigured) return { error: DEMO_ERROR };
  try {
    await apiRequest(`/expenses/${id}`, { method: "DELETE" });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Suppression impossible." };
  }
}
