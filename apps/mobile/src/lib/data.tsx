/**
 * Chargement des données financières de l'utilisateur.
 *
 * Une seule requête groupée au montage, puis tout le calcul se fait en mémoire
 * via `@mfp/core`. Les volumes sont ceux d'une vie financière personnelle
 * (quelques milliers de lignes au bout de dix ans) : les paginer écran par
 * écran coûterait plus cher en allers-retours que de tout garder en RAM.
 *
 * ⚠️ L'app n'envoie jamais d'identifiant d'utilisateur : l'API le lit dans le
 * JWT. Si `/snapshot` renvoyait les données de quelqu'un d'autre, le problème
 * serait dans `DataService` côté serveur, pas ici.
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
import { apiRequest, isApiConfigured } from "./api";
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
    if (isDemo || !isApiConfigured) {
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
 * Requête
 * ------------------------------------------------------------------ */

/**
 * Un seul appel plutôt qu'un par module.
 *
 * L'API renvoie déjà exactement la forme de `Dataset` : la conversion des
 * colonnes Postgres (`snake_case`, `date`) vers le domaine (`camelCase`,
 * `MonthKey`) est faite côté serveur, dans `SnapshotService`. Le mobile ne
 * refait donc aucun mappage — un seul endroit à corriger si le schéma bouge.
 */
async function fetchDataset(): Promise<Dataset> {
  return apiRequest<Dataset>("/snapshot");
}
