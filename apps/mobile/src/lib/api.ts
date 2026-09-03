/**
 * Client HTTP de l'API — remplace `@supabase/supabase-js`.
 *
 * Trois responsabilités qui étaient auparavant portées par le SDK Supabase :
 * porter le jeton d'accès, le renouveler quand il expire, et signaler une
 * panne réseau de façon reconnaissable par la file d'attente hors-ligne.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  ""
).replace(/\/$/, "");

/**
 * `false` tant que l'URL de l'API n'est pas renseignée dans `.env`.
 * L'app bascule alors en **mode démonstration** plutôt que de planter : on peut
 * montrer l'interface avant que l'API soit déployée.
 */
export const isApiConfigured = Boolean(BASE_URL);

const ACCESS_KEY = "mfp.token.access";
const REFRESH_KEY = "mfp.token.refresh";

export type Tokens = { accessToken: string; refreshToken: string };

/* ------------------------------------------------------------------ *
 * Jetons
 * ------------------------------------------------------------------ */

let accessToken: string | null = null;

export async function loadTokens(): Promise<Tokens | null> {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ]);
  accessToken = access;
  return access && refresh ? { accessToken: access, refreshToken: refresh } : null;
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  accessToken = tokens.accessToken;
  await AsyncStorage.multiSet([
    [ACCESS_KEY, tokens.accessToken],
    [REFRESH_KEY, tokens.refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

async function readRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}

/* ------------------------------------------------------------------ *
 * Erreurs
 * ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Panne réseau — distincte d'une erreur métier.
 *
 * La file d'attente hors-ligne ne rejoue QUE celles-ci : une contrainte violée
 * se reproduirait à l'identique et remplirait la file sans jamais la vider.
 */
export class NetworkError extends Error {
  constructor(message = "Réseau indisponible.") {
    super(message);
    this.name = "NetworkError";
  }
}

/* ------------------------------------------------------------------ *
 * Requêtes
 * ------------------------------------------------------------------ */

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Requête d'authentification : ni jeton, ni tentative de renouvellement. */
  anonymous?: boolean;
  /** Corps déjà formé (téléversement de fichier). */
  form?: FormData;
};

/**
 * Le plan gratuit de Render endort l'instance après 15 min d'inactivité, et le
 * réveil prend ~30 s. Un délai plus court ferait échouer le premier appel de la
 * journée alors que tout fonctionne.
 */
const TIMEOUT_MS = 45_000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured) throw new ApiError("API non configurée.", 0);

  const send = async (token: string | null): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(`${BASE_URL}/api${path}`, {
        method: options.method ?? "GET",
        signal: controller.signal,
        headers: {
          ...(options.form ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: options.form ?? (options.body ? JSON.stringify(options.body) : undefined),
      });
    } catch (error) {
      // `fetch` ne rejette que sur une panne réseau ou un abandon — jamais sur
      // un code HTTP d'erreur. Les deux cas valent « réessayer plus tard ».
      throw new NetworkError(
        error instanceof Error && error.name === "AbortError"
          ? "Le serveur met trop de temps à répondre."
          : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
  };

  if (!options.anonymous && !accessToken) await loadTokens();

  let response = await send(options.anonymous ? null : accessToken);

  // Jeton d'accès expiré (durée de vie : 15 min) : on le renouvelle une fois et
  // on rejoue. Une seule tentative — boucler masquerait une session morte.
  if (response.status === 401 && !options.anonymous) {
    const renewed = await tryRefresh();
    if (!renewed) throw new ApiError("Session expirée, reconnectez-vous.", 401);
    response = await send(accessToken);
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  // 204 sans corps : la plupart des écritures répondent ainsi.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Renvoie `true` si la session a pu être prolongée. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      await clearTokens();
      return false;
    }
    await saveTokens((await response.json()) as Tokens);
    return true;
  } catch {
    // Panne réseau pendant le renouvellement : on garde les jetons, la session
    // n'est pas morte — seul le réseau manque.
    return false;
  }
}

/**
 * Extrait le message d'erreur de l'API.
 * NestJS renvoie `{ message: string | string[] }` ; la forme tableau vient de
 * la validation, où chaque champ invalide produit une ligne.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(" ");
    if (body.message) return body.message;
  } catch {
    // Corps vide ou non-JSON : on retombe sur le code HTTP.
  }
  return `Erreur ${response.status}.`;
}

/* ------------------------------------------------------------------ *
 * Accès direct — affichage d'un fichier
 * ------------------------------------------------------------------ */

/** URL absolue d'un reçu, pour un `<Image>` qui téléchargera lui-même. */
export function receiptEndpoint(id: string): string {
  return `${BASE_URL}/api/receipts/${id}`;
}

/**
 * En-tête d'autorisation pour les téléchargements que `<Image>` fait lui-même,
 * hors de `apiRequest`. `null` si aucune session n'est ouverte.
 *
 * ⚠️ Ce chemin ne bénéficie **pas** du renouvellement automatique : si le jeton
 * a expiré, l'image ne s'affiche pas et la prochaine requête normale rétablira
 * la session. C'est acceptable pour un aperçu, ça ne le serait pas pour une
 * écriture.
 */
export async function authHeaders(): Promise<Record<string, string> | null> {
  if (!accessToken) await loadTokens();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : null;
}

/** Vrai pour les erreurs qui justifient une mise en file d'attente. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  // 5xx : panne côté serveur, l'opération reste valide et mérite un rejeu.
  return error instanceof ApiError && error.status >= 500;
}
