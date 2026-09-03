/**
 * Session utilisateur (§3.2 du cahier des charges).
 *
 * Parle à l'API NestJS. En l'absence d'API configurée, l'app ouvre une
 * **session de démonstration** locale : on peut montrer l'interface avant que
 * le serveur soit déployé, sans jamais mélanger les deux modes — `isDemo` est
 * exposé pour que l'interface l'affiche explicitement.
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
  ApiError,
  apiRequest,
  clearTokens,
  isApiConfigured,
  loadTokens,
  saveTokens,
  type Tokens,
} from "./api";
import { clearQueue } from "./queue";

export type AuthState = {
  /** `true` tant qu'on n'a pas encore relu les jetons persistés. */
  loading: boolean;
  /** Aucune API configurée : les données affichées sont un jeu de démonstration. */
  isDemo: boolean;
  /** Session ouverte (réelle ou démo). */
  isSignedIn: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Ouvre la session de démonstration (uniquement hors API configurée). */
  enterDemo: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const EMAIL_KEY = "mfp.email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [demoSession, setDemoSession] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!isApiConfigured) {
        if (active) setLoading(false);
        return;
      }
      const tokens = await loadTokens();
      if (!active) return;
      setSignedIn(Boolean(tokens));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback(
    async (path: "login" | "register", mail: string, password: string) => {
      if (!isApiConfigured) return { error: "L'API n'est pas configurée." };
      try {
        const tokens = await apiRequest<Tokens>(`/auth/${path}`, {
          method: "POST",
          body: { email: mail, password },
          anonymous: true,
        });
        await saveTokens(tokens);
        setEmail(mail);
        setSignedIn(true);
        return { error: null };
      } catch (error) {
        return { error: describe(error) };
      }
    },
    [],
  );

  const signIn = useCallback(
    (mail: string, password: string) => authenticate("login", mail, password),
    [authenticate],
  );

  const signUp = useCallback(
    (mail: string, password: string) => authenticate("register", mail, password),
    [authenticate],
  );

  const signOut = useCallback(async () => {
    setDemoSession(false);
    setSignedIn(false);
    setEmail(null);

    // La file d'attente porte les saisies d'un utilisateur donné : les rejouer
    // sous le compte suivant lui attribuerait des dépenses qui ne sont pas les
    // siennes. On la vide donc à la déconnexion.
    await clearQueue();
    await clearTokens();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      isDemo: !isApiConfigured && demoSession,
      isSignedIn: signedIn || demoSession,
      email: email ?? (demoSession ? "demo@mafinanceperso.ci" : null),
      signIn,
      signUp,
      signOut,
      enterDemo: () => setDemoSession(true),
    }),
    [loading, demoSession, signedIn, email, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre appele sous <AuthProvider>.");
  return ctx;
}

/**
 * Traduit une erreur d'API en message lisible.
 *
 * L'API répond déjà en français ; on couvre ici les cas qu'elle ne formule pas
 * elle-même — panne réseau, ou statut sans message.
 */
function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "L'API n'est pas configurée.";
    if (error.status === 401) return "E-mail ou mot de passe incorrect.";
    if (error.status === 409) return "Un compte existe déjà avec cet e-mail.";
    return error.message;
  }
  return "Pas de connexion. Réessayez une fois en ligne.";
}

export { EMAIL_KEY };
