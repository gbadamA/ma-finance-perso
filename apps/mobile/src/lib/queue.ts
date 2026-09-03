/**
 * File d'attente hors-ligne.
 *
 * Le cahier des charges (§3.1) fait du mode hors-ligne une exigence : la saisie
 * quotidienne d'une dépense ne doit pas dépendre du réseau. Une écriture faite
 * sans connexion est donc **persistée localement** puis rejouée dès que le
 * réseau revient.
 *
 * ⚠️ Ce qui n'est PAS mis en file : les uploads de reçus. Le fichier vit dans le
 * cache de l'appareil, que le système peut vider entre la mise en file et le
 * rejeu — on promettrait un envoi qu'on ne peut pas tenir. La dépense, elle,
 * part en file ; seule la photo est perdue, et l'écran le dit.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const STORAGE_KEY = "mfp.pending-ops.v1";

/**
 * Opérations rejouables. Le `kind` est persisté : le renommer casserait les
 * files déjà écrites sur les téléphones. Ajouter, ne jamais renommer.
 */
export type PendingOp =
  | { kind: "expense.add"; payload: ExpensePayload }
  | { kind: "income.set"; payload: IncomePayload }
  | { kind: "balances.set"; payload: BalancesPayload }
  | { kind: "investments.set"; payload: InvestmentsPayload }
  | { kind: "asset.value"; payload: { assetId: string; value: number } }
  | { kind: "goal.upsert"; payload: GoalPayload }
  | { kind: "goal.delete"; payload: { id: string } }
  | { kind: "savings.toggle"; payload: { id: string; done: boolean } }
  | { kind: "settings.update"; payload: SettingsPatch };

export type ExpensePayload = {
  categoryId: string;
  spentOn: string;
  amount: number;
  note?: string;
  receiptId?: string;
};
export type IncomePayload = { sourceId: string; month: string; amount: number; note?: string };
export type BalancesPayload = {
  month: string;
  balances: { accountId: string; balance: number }[];
};
export type InvestmentsPayload = {
  month: string;
  amounts: { assetClass: string; amount: number }[];
};
/**
 * Champs modifiables des réglages.
 *
 * Typé explicitement plutôt qu'en `Record<string, unknown>` : c'est ce qui fait
 * échouer à la compilation un champ absent de `UpdateSettingsDto` côté API, où
 * `forbidNonWhitelisted` le rejetterait sinon à l'exécution.
 */
export type SettingsPatch = {
  currency?: string;
  birthDate?: string | null;
  safeWithdrawalRate?: number;
  inflationRate?: number;
  expectedReturn?: number;
  monthlyInvestment?: number;
  averageWindowMonths?: number;
  driftThreshold?: number;
  lifeExpectancy?: number;
  inheritanceTargetAge?: number;
  biometricLock?: boolean;
};

export type GoalPayload = {
  kind: "fortune" | "revenu_passif";
  horizon: "court" | "moyen" | "long" | "minimum" | "ideal";
  label: string;
  targetAmount: number;
};

type QueuedOp = PendingOp & { id: string; queuedAt: string; attempts: number };

/** Nombre d'échecs au-delà duquel on cesse de réessayer une opération. */
const MAX_ATTEMPTS = 5;

/* ------------------------------------------------------------------ *
 * Persistance
 * ------------------------------------------------------------------ */

export async function readQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    // Une file illisible (JSON corrompu, stockage plein) ne doit pas empêcher
    // l'app de démarrer : on repart d'une file vide plutôt que de planter.
    return [];
  }
}

async function writeQueue(ops: QueuedOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Rien à faire de plus : si le stockage refuse d'écrire, l'opération est
    // perdue et l'appelant a déjà été prévenu que la saisie était « en attente ».
  }
}

export async function enqueue(op: PendingOp): Promise<void> {
  const ops = await readQueue();
  ops.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(ops);
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

/* ------------------------------------------------------------------ *
 * Connectivité
 * ------------------------------------------------------------------ */

/**
 * `true` si l'appareil semble joignable.
 * En cas de doute (API indisponible sur la plateforme), on répond `true` :
 * mieux vaut tenter l'envoi et échouer que refuser une saisie à tort.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isInternetReachable ?? state.isConnected ?? true;
  } catch {
    return true;
  }
}

/**
 * Résultat d'un envoi.
 *
 * `retryable` remplace l'ancienne reconnaissance de panne réseau **par le texte
 * du message** : le client HTTP distingue déjà `NetworkError` d'une `ApiError`,
 * et se fier au libellé cassait dès que le serveur changeait sa formulation.
 * Seules les erreurs rejouables restent en file : un 400 se reproduirait à
 * l'identique et remplirait la file sans jamais la vider.
 */
export type ApplyResult = { error: string | null; retryable?: boolean };

/* ------------------------------------------------------------------ *
 * Rejeu
 * ------------------------------------------------------------------ */

export type FlushOutcome = {
  /** Opérations effectivement envoyées. */
  sent: number;
  /** Opérations restées en file (réseau toujours absent). */
  remaining: number;
  /** Opérations abandonnées après trop d'échecs métier. */
  dropped: number;
};

/**
 * Rejoue la file dans l'ordre de saisie.
 *
 * L'ordre compte : deux relevés du même mois enregistrés hors-ligne doivent
 * s'appliquer dans l'ordre où ils ont été saisis, sinon le plus ancien écrase
 * le plus récent (les soldes et revenus passent par un `upsert`).
 */
export async function flushQueue(
  apply: (op: PendingOp) => Promise<ApplyResult>,
): Promise<FlushOutcome> {
  const ops = await readQueue();
  if (ops.length === 0) return { sent: 0, remaining: 0, dropped: 0 };
  if (!(await isOnline())) return { sent: 0, remaining: ops.length, dropped: 0 };

  const kept: QueuedOp[] = [];
  let sent = 0;
  let dropped = 0;

  for (const op of ops) {
    const { error, retryable } = await apply(op);
    if (!error) {
      sent += 1;
      continue;
    }
    if (retryable) {
      // Le réseau est retombé : inutile d'essayer les suivantes maintenant,
      // et il faut préserver l'ordre — on garde tout le reste tel quel.
      kept.push(op, ...ops.slice(ops.indexOf(op) + 1));
      break;
    }
    // Erreur métier : on retente quelques fois (une référence manquante peut se
    // résoudre si l'opération précédente de la file crée la ligne attendue),
    // puis on jette.
    const attempts = op.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) dropped += 1;
    else kept.push({ ...op, attempts });
  }

  await writeQueue(kept);
  return { sent, remaining: kept.length, dropped };
}
