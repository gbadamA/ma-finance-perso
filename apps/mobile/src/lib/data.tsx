/**
 * Chargement des données financières de l'utilisateur.
 *
 * Une seule requête groupée au montage, puis tout le calcul se fait en mémoire
 * via `@mfp/core`. Les volumes sont ceux d'une vie financière personnelle
 * (quelques milliers de lignes au bout de dix ans) : les paginer écran par
 * écran coûterait plus cher en allers-retours que de tout garder en RAM.
 *
 * ⚠️ Aucune requête ne filtre sur `user_id` : c'est la RLS qui le fait (§3.2).
 * Si une requête d'ici renvoyait les données d'un autre utilisateur, le
 * problème serait dans les policies, pas ici.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SETTINGS,
  demoDataset,
  type Account,
  type AccountSnapshot,
  type Asset,
  type CurrencyCode,
  type ExpenseCategory,
  type ExpenseEntry,
  type FinancialGoal,
  type IncomeEntry,
  type IncomeSource,
  type InvestmentSnapshot,
  type SavingsAction,
  type TargetAllocation,
  type UserSettings,
} from "@mfp/core";
import { rowMonth } from "@mfp/supabase";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type Dataset = {
  settings: UserSettings;
  /**
   * Verrouillage biométrique local. Hors de `UserSettings` à dessein :
   * `@mfp/core` est un moteur de calcul, une préférence d'interface n'y a
   * pas sa place.
   */
  biometricLock: boolean;
  accounts: Account[];
  accountSnapshots: AccountSnapshot[];
  incomeSources: IncomeSource[];
  incomeEntries: IncomeEntry[];
  expenseCategories: ExpenseCategory[];
  expenseEntries: ExpenseEntry[];
  assets: Asset[];
  targets: TargetAllocation[];
  investmentSnapshots: InvestmentSnapshot[];
  goals: FinancialGoal[];
  savingsActions: SavingsAction[];
};

export type DataState = {
  data: Dataset;
  loading: boolean;
  error: string | null;
  /** Recharge tout depuis la base. Utilisé après une saisie et au pull-to-refresh. */
  refresh: () => Promise<void>;
};

const EMPTY: Dataset = {
  settings: DEFAULT_SETTINGS,
  biometricLock: false,
  accounts: [],
  accountSnapshots: [],
  incomeSources: [],
  incomeEntries: [],
  expenseCategories: [],
  expenseEntries: [],
  assets: [],
  targets: [],
  investmentSnapshots: [],
  goals: [],
  savingsActions: [],
};

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isDemo } = useAuth();
  const [data, setData] = useState<Dataset>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    if (isDemo || !supabase) {
      setData({ ...demoDataset(), biometricLock: false });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      setData(await fetchDataset());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<DataState>(
    () => ({ data, loading, error, refresh: load }),
    [data, loading, error, load],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData doit etre appele sous <DataProvider>.");
  return ctx;
}

/** Raccourci le plus fréquent : la devise de l'utilisateur. */
export function useCurrency(): CurrencyCode {
  return useData().data.settings.currency;
}

/* ------------------------------------------------------------------ *
 * Requêtes
 * ------------------------------------------------------------------ */

async function fetchDataset(): Promise<Dataset> {
  const client = supabase!;

  // Une seule salve parallèle : douze allers-retours séquentiels sur une
  // connexion mobile ivoirienne se voient à l'ouverture de l'app.
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
  ] = await Promise.all([
    client.from("settings").select("*").maybeSingle(),
    client.from("accounts").select("*").order("position"),
    client.from("account_snapshots").select("*").order("month"),
    client.from("income_sources").select("*").order("position"),
    client.from("income_entries").select("*").order("month"),
    client.from("expense_categories").select("*").order("position"),
    client.from("expense_entries").select("*").order("spent_on"),
    client.from("assets").select("*").eq("archived", false),
    client.from("investment_targets").select("*").order("position"),
    client.from("investment_snapshots").select("*").order("month"),
    client.from("financial_goals").select("*"),
    client.from("savings_actions").select("*").order("position"),
  ]);

  const failed = [
    settings, accounts, accountSnapshots, incomeSources, incomeEntries,
    expenseCategories, expenseEntries, assets, targets, investmentSnapshots,
    goals, savingsActions,
  ].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  return {
    biometricLock: settings.data?.biometric_lock ?? false,

    settings: settings.data
      ? {
          currency: settings.data.currency as CurrencyCode,
          birthDate: settings.data.birth_date,
          safeWithdrawalRate: Number(settings.data.safe_withdrawal_rate),
          inflationRate: Number(settings.data.inflation_rate),
          expectedReturn: Number(settings.data.expected_return),
          monthlyInvestment: settings.data.monthly_investment,
          averageWindowMonths: settings.data.average_window_months,
          driftThreshold: Number(settings.data.drift_threshold),
          lifeExpectancy: settings.data.life_expectancy,
          inheritanceTargetAge: settings.data.inheritance_target_age,
        }
      : DEFAULT_SETTINGS,

    accounts: (accounts.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      currency: r.currency as CurrencyCode,
      archived: r.archived,
    })),

    accountSnapshots: (accountSnapshots.data ?? []).map((r) => ({
      accountId: r.account_id,
      month: rowMonth(r.month),
      balance: r.balance,
    })),

    incomeSources: (incomeSources.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      isInvestment: r.is_investment,
    })),

    incomeEntries: (incomeEntries.data ?? []).map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      month: rowMonth(r.month),
      amount: r.amount,
    })),

    expenseCategories: (expenseCategories.data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
    })),

    expenseEntries: (expenseEntries.data ?? []).map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      date: r.spent_on,
      amount: r.amount,
      note: r.note,
      receiptPath: r.receipt_path,
    })),

    assets: (assets.data ?? []).map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      purchaseDate: r.purchase_date,
      purchasePrice: r.purchase_price,
      debt: r.debt,
      maintenanceCost: r.maintenance_cost,
      currentValue: r.current_value,
      conditionScore: r.condition_score,
    })),

    targets: (targets.data ?? []).map((r) => ({
      assetClass: r.asset_class,
      targetPercent: Number(r.target_percent),
    })),

    investmentSnapshots: (investmentSnapshots.data ?? []).map((r) => ({
      assetClass: r.asset_class,
      month: rowMonth(r.month),
      amount: r.amount,
    })),

    goals: (goals.data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      horizon: r.horizon,
      label: r.label,
      targetAmount: r.target_amount,
    })),

    savingsActions: (savingsActions.data ?? []).map((r) => ({
      id: r.id,
      category: r.category,
      label: r.label,
      feasible: r.feasible,
      initialExpense: r.initial_expense,
      newExpense: r.new_expense,
      done: r.done,
    })),
  };
}
