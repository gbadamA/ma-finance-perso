/**
 * Types de la base — miroir des migrations `supabase/migrations/`.
 *
 * ⚠️ Ce fichier est écrit à la main **en attendant que le projet Supabase
 * existe**. Dès qu'il est créé, il doit être régénéré :
 *
 *     pnpm db:push && pnpm db:types
 *
 * La version générée fait autorité. Si les deux divergent, c'est ce fichier
 * qui a tort — ne pas « corriger » les migrations pour lui donner raison.
 *
 * Convention : `user_id` est absent des `Insert`. Il est renseigné par le
 * trigger `set_user_id()` côté base — le client ne l'envoie jamais (§3.2).
 */

export type AccountKind = "liquide" | "compte" | "epargne" | "investissement";
export type IncomeKind = "passif" | "actif";
export type GoalKind = "fortune" | "revenu_passif";
export type GoalHorizon = "court" | "moyen" | "long" | "minimum" | "ideal";

type Timestamped = { created_at: string };
type Owned = { user_id: string };

export type Database = {
  public: {
    Tables: {
      settings: {
        Row: Owned & {
          display_name: string | null;
          currency: string;
          birth_date: string | null;
          safe_withdrawal_rate: number;
          inflation_rate: number;
          expected_return: number;
          monthly_investment: number;
          average_window_months: number;
          drift_threshold: number;
          life_expectancy: number;
          inheritance_target_age: number;
          biometric_lock: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]> & Owned;
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Relationships: [];
      };

      accounts: {
        Row: Owned &
          Timestamped & {
            id: string;
            name: string;
            kind: AccountKind;
            currency: string;
            position: number;
            archived: boolean;
          };
        Insert: {
          name: string;
          kind?: AccountKind;
          currency?: string;
          position?: number;
          archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };

      account_snapshots: {
        Row: Owned &
          Timestamped & {
            id: string;
            account_id: string;
            month: string;
            balance: number;
            note: string | null;
          };
        Insert: { account_id: string; month: string; balance: number; note?: string | null };
        Update: Partial<Database["public"]["Tables"]["account_snapshots"]["Insert"]>;
        Relationships: [];
      };

      income_sources: {
        Row: Owned &
          Timestamped & {
            id: string;
            name: string;
            kind: IncomeKind;
            is_investment: boolean;
            position: number;
            archived: boolean;
          };
        Insert: {
          name: string;
          kind: IncomeKind;
          is_investment?: boolean;
          position?: number;
          archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["income_sources"]["Insert"]>;
        Relationships: [];
      };

      income_entries: {
        Row: Owned &
          Timestamped & {
            id: string;
            source_id: string;
            month: string;
            amount: number;
            note: string | null;
          };
        Insert: { source_id: string; month: string; amount: number; note?: string | null };
        Update: Partial<Database["public"]["Tables"]["income_entries"]["Insert"]>;
        Relationships: [];
      };

      expense_categories: {
        Row: Owned &
          Timestamped & {
            id: string;
            key: string;
            label: string;
            position: number;
            archived: boolean;
          };
        Insert: { key: string; label: string; position?: number; archived?: boolean };
        Update: Partial<Database["public"]["Tables"]["expense_categories"]["Insert"]>;
        Relationships: [];
      };

      expense_entries: {
        Row: Owned &
          Timestamped & {
            id: string;
            category_id: string;
            spent_on: string;
            amount: number;
            note: string | null;
            receipt_path: string | null;
          };
        Insert: {
          category_id: string;
          spent_on: string;
          amount: number;
          note?: string | null;
          receipt_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["expense_entries"]["Insert"]>;
        Relationships: [];
      };

      assets: {
        Row: Owned &
          Timestamped & {
            id: string;
            category: string;
            name: string;
            purchase_date: string | null;
            purchase_price: number;
            debt: number;
            maintenance_cost: number;
            current_value: number;
            condition_score: number | null;
            archived: boolean;
          };
        Insert: {
          category: string;
          name: string;
          purchase_date?: string | null;
          purchase_price?: number;
          debt?: number;
          maintenance_cost?: number;
          current_value?: number;
          condition_score?: number | null;
          archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
        Relationships: [];
      };

      asset_valuations: {
        Row: Owned &
          Timestamped & { id: string; asset_id: string; valued_on: string; value: number };
        Insert: { asset_id: string; valued_on: string; value: number };
        Update: Partial<Database["public"]["Tables"]["asset_valuations"]["Insert"]>;
        Relationships: [];
      };

      investment_targets: {
        Row: Owned &
          Timestamped & {
            id: string;
            asset_class: string;
            target_percent: number;
            position: number;
          };
        Insert: { asset_class: string; target_percent: number; position?: number };
        Update: Partial<Database["public"]["Tables"]["investment_targets"]["Insert"]>;
        Relationships: [];
      };

      investment_snapshots: {
        Row: Owned &
          Timestamped & { id: string; asset_class: string; month: string; amount: number };
        Insert: { asset_class: string; month: string; amount: number };
        Update: Partial<Database["public"]["Tables"]["investment_snapshots"]["Insert"]>;
        Relationships: [];
      };

      financial_goals: {
        Row: Owned &
          Timestamped & {
            id: string;
            kind: GoalKind;
            horizon: GoalHorizon;
            label: string;
            target_amount: number;
          };
        Insert: { kind: GoalKind; horizon: GoalHorizon; label: string; target_amount: number };
        Update: Partial<Database["public"]["Tables"]["financial_goals"]["Insert"]>;
        Relationships: [];
      };

      savings_actions: {
        Row: Owned &
          Timestamped & {
            id: string;
            category: string;
            label: string;
            feasible: boolean;
            initial_expense: number;
            new_expense: number;
            done: boolean;
            position: number;
          };
        Insert: {
          category: string;
          label: string;
          feasible?: boolean;
          initial_expense?: number;
          new_expense?: number;
          done?: boolean;
          position?: number;
        };
        Update: Partial<Database["public"]["Tables"]["savings_actions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_kind: AccountKind;
      income_kind: IncomeKind;
      goal_kind: GoalKind;
      goal_horizon: GoalHorizon;
    };
  };
};
