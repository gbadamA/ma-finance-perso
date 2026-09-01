/**
 * Session utilisateur (§3.2 du cahier des charges).
 *
 * En l'absence de projet Supabase configuré, l'app ouvre une **session de
 * démonstration** locale. Cela permet de développer et de montrer l'interface
 * avant que la base existe, sans jamais mélanger les deux modes : `isDemo`
 * est exposé pour que l'interface l'affiche explicitement.
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
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

export type AuthState = {
  session: Session | null;
  /** `true` tant qu'on n'a pas encore relu la session persistée. */
  loading: boolean;
  /** Aucune base configurée : les données affichées sont un jeu de démonstration. */
  isDemo: boolean;
  /** Session ouverte (réelle ou démo). */
  isSignedIn: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Ouvre la session de démonstration (uniquement hors Supabase). */
  enterDemo: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoSession, setDemoSession] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase n'est pas configuré." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase n'est pas configuré." };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: "Supabase n'est pas configuré." };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    setDemoSession(false);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      isDemo: !isSupabaseConfigured && demoSession,
      isSignedIn: Boolean(session) || demoSession,
      email: session?.user.email ?? (demoSession ? "demo@mafinanceperso.ci" : null),
      signIn,
      signUp,
      signOut,
      resetPassword,
      enterDemo: () => setDemoSession(true),
    }),
    [session, loading, demoSession, signIn, signUp, signOut, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre appele sous <AuthProvider>.");
  return ctx;
}

/**
 * Traduit les messages de Supabase Auth.
 * Ils arrivent en anglais et parlent de « credentials » — illisible pour
 * l'utilisateur visé. Les cas non couverts sont renvoyés tels quels plutôt
 * que masqués par un « une erreur est survenue » qui n'aide personne.
 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez votre e-mail avant de vous connecter.";
  if (m.includes("user already registered")) return "Un compte existe déjà avec cet e-mail.";
  if (m.includes("password should be at least")) {
    return "Le mot de passe doit faire au moins 6 caractères.";
  }
  if (m.includes("unable to validate email")) return "Adresse e-mail invalide.";
  if (m.includes("network")) return "Pas de connexion. Réessayez une fois en ligne.";
  return message;
}
