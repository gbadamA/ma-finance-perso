/**
 * Notifications — §3.1 du cahier des charges.
 *
 * Trois usages : rappel mensuel de saisie, alerte de dérive de portefeuille,
 * objectif FIRE atteint. **Toutes locales**, aucune notification distante.
 *
 * ⚠️ **`expo-notifications` lève une exception dès son import dans Expo Go**
 * (Android, SDK 53+) : le module refuse de se charger parce que le push distant
 * y a été retiré — et cela même si l'on ne s'en sert que pour du local.
 * Le module est donc chargé **paresseusement** et seulement hors d'Expo Go.
 * Sans cette précaution, l'application entière plante au démarrage sur
 * l'émulateur, alors qu'il ne s'agit que d'une fonctionnalité secondaire.
 *
 * Conséquence assumée : **les notifications ne fonctionnent pas dans Expo Go**.
 * Elles demandent un development build (`npx expo run:android`). L'écran de
 * réglages le dit explicitement plutôt que de proposer un interrupteur mort.
 */

import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type NotificationsModule = typeof import("expo-notifications");

/** `true` quand l'app tourne dans le client Expo Go, pas dans un build à nous. */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Identifiants stables : ils permettent de remplacer une alerte au lieu d'empiler. */
const MONTHLY_REMINDER_ID = "mfp.reminder.monthly";
const SEEN_KEY = "mfp.alerts-seen.v1";

/** Jour du mois du rappel : le 1er, quand les soldes de fin de mois sont connus. */
const REMINDER_DAY = 1;
const REMINDER_HOUR = 9;

let cached: NotificationsModule | null = null;
let loadFailed = false;

/**
 * Charge le module à la demande. Renvoie `null` quand les notifications ne sont
 * pas disponibles — l'appelant dégrade alors sans planter.
 */
function load(): NotificationsModule | null {
  if (IS_EXPO_GO || loadFailed) return null;
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
    return mod;
  } catch {
    loadFailed = true;
    return null;
  }
}

/** Les notifications sont-elles utilisables sur cette exécution ? */
export function isNotificationsAvailable(): boolean {
  return load() !== null;
}

/* ------------------------------------------------------------------ *
 * Permissions
 * ------------------------------------------------------------------ */

export async function ensurePermission(): Promise<boolean> {
  const Notifications = load();
  if (!Notifications) return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // `canAskAgain` à false = l'utilisateur a refusé définitivement ; redemander
  // ne ferait rien afficher et laisserait croire à un bug.
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Canal Android obligatoire : sans lui, rien ne s'affiche sur Android 8+. */
export async function configureChannel(): Promise<void> {
  const Notifications = load();
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("finance", {
    name: "Finances",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lightColor: "#F2994A",
  });
}

/* ------------------------------------------------------------------ *
 * Rappel mensuel de saisie
 * ------------------------------------------------------------------ */

export async function enableMonthlyReminder(): Promise<boolean> {
  const Notifications = load();
  if (!Notifications) return false;
  if (!(await ensurePermission())) return false;
  await configureChannel();
  await disableMonthlyReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_REMINDER_ID,
    content: {
      title: "Point mensuel",
      body: "Mettez à jour vos soldes et vos revenus du mois — deux minutes.",
      data: { route: "/saisie/soldes" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: REMINDER_DAY,
      hour: REMINDER_HOUR,
      minute: 0,
      channelId: "finance",
    },
  });
  return true;
}

export async function disableMonthlyReminder(): Promise<void> {
  const Notifications = load();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(MONTHLY_REMINDER_ID).catch(() => {
    // Rien de programmé : `cancel` rejette, ce n'est pas une erreur.
  });
}

export async function isMonthlyReminderOn(): Promise<boolean> {
  const Notifications = load();
  if (!Notifications) return false;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === MONTHLY_REMINDER_ID);
}

/* ------------------------------------------------------------------ *
 * Alertes ponctuelles
 * ------------------------------------------------------------------ */

/**
 * Notifie **une seule fois par situation**.
 *
 * Sans cette mémoire, l'alerte de dérive se redéclencherait à chaque ouverture
 * de l'app tant que le portefeuille n'est pas rééquilibré — c'est le meilleur
 * moyen de faire couper les notifications par l'utilisateur.
 */
async function notifyOnce(key: string, title: string, body: string): Promise<void> {
  const Notifications = load();
  if (!Notifications) return;

  const seen = await readSeen();
  if (seen[key]) return;

  if (!(await ensurePermission())) return;
  await configureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immédiat
  });

  seen[key] = new Date().toISOString();
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

/** Dérive de portefeuille au-delà du seuil configuré (§5.3). */
export function notifyDrift(maxDriftPoints: number, threshold: number): Promise<void> {
  // La clé inclut la dérive arrondie : passer de 6 à 11 points est une
  // situation nouvelle qui mérite un nouveau signal.
  const bucket = Math.round(maxDriftPoints);
  return notifyOnce(
    `drift:${bucket}`,
    "Portefeuille à rééquilibrer",
    `Votre allocation s'écarte de ${bucket} points de la cible (seuil : ${threshold}).`,
  );
}

/** Objectif FIRE franchi (§5.2). */
export function notifyGoalReached(goalId: string, label: string): Promise<void> {
  return notifyOnce(
    `goal:${goalId}`,
    "Objectif atteint",
    `${label} : vous y êtes. Ouvrez le simulateur pour voir la suite.`,
  );
}

async function readSeen(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Remet à zéro les alertes déjà vues (utile après un rééquilibrage). */
export async function resetSeenAlerts(): Promise<void> {
  await AsyncStorage.removeItem(SEEN_KEY);
}
