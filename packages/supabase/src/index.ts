/**
 * @mfp/supabase — client typé et mapping base <-> domaine.
 *
 * Le mapping vit ici et non dans les écrans : la base parle `snake_case` et
 * `date`, le moteur de calcul parle `camelCase` et `MonthKey`. Une seule
 * traduction, testable, plutôt qu'une conversion ad hoc par écran.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database } from "./database.types";
export type Client = SupabaseClient<Database>;

type Tables = Database["public"]["Tables"];

export type SettingsRow = Tables["settings"]["Row"];
export type AccountRow = Tables["accounts"]["Row"];
export type AccountSnapshotRow = Tables["account_snapshots"]["Row"];
export type IncomeSourceRow = Tables["income_sources"]["Row"];
export type IncomeEntryRow = Tables["income_entries"]["Row"];
export type ExpenseCategoryRow = Tables["expense_categories"]["Row"];
export type ExpenseEntryRow = Tables["expense_entries"]["Row"];
export type AssetRow = Tables["assets"]["Row"];
export type AssetValuationRow = Tables["asset_valuations"]["Row"];
export type InvestmentTargetRow = Tables["investment_targets"]["Row"];
export type InvestmentSnapshotRow = Tables["investment_snapshots"]["Row"];
export type FinancialGoalRow = Tables["financial_goals"]["Row"];
export type SavingsActionRow = Tables["savings_actions"]["Row"];

/**
 * Factory unique du client.
 * `storage` est injecté par l'appelant (AsyncStorage sur React Native) pour
 * que ce paquet reste sans dépendance à React Native.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: { storage?: unknown; detectSessionInUrl?: boolean },
): Client {
  if (!url || !anonKey) {
    throw new Error(
      "[supabase] URL / cle anon manquantes. Renseigner apps/mobile/.env (voir .env.example).",
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
      ...(options?.storage ? { storage: options.storage as never } : {}),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Conversions date <-> MonthKey
 * ------------------------------------------------------------------ */

/** Postgres stocke un `date` ; le domaine manipule « 2026-08 ». */
export function rowMonth(date: string): string {
  return date.slice(0, 7);
}

/** « 2026-08 » -> « 2026-08-01 » : les séries mensuelles sont calées au 1er. */
export function monthToDate(month: string): string {
  return `${month}-01`;
}

/* ------------------------------------------------------------------ *
 * Chemins de stockage
 * ------------------------------------------------------------------ */

/**
 * Chemin d'un reçu dans le bucket privé `receipts`.
 * Le premier segment DOIT être l'identifiant de l'utilisateur : c'est sur lui
 * que porte la policy de storage (cf. migration RLS).
 */
export function receiptPath(userId: string, month: string, fileName: string): string {
  return `${userId}/${month}/${fileName}`;
}

export const RECEIPTS_BUCKET = "receipts";
