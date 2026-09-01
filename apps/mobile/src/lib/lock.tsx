/**
 * Verrouillage local par biométrie / code de l'appareil — §3.2 et §7.
 *
 * C'est une **seconde couche, indépendante de la session serveur** : elle
 * protège l'accès physique au téléphone, pas les données côté base. Quelqu'un
 * qui prend le téléphone déverrouillé de l'utilisateur ne doit pas voir son
 * patrimoine d'un coup de pouce.
 *
 * ⚠️ Le verrou ne chiffre rien et ne remplace pas l'authentification. S'il est
 * contourné (root, restauration de sauvegarde), la RLS protège toujours les
 * données côté serveur.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type LockState = {
  /** Le verrou est actif dans les réglages. */
  enabled: boolean;
  /** L'app est actuellement verrouillée et doit masquer son contenu. */
  locked: boolean;
  /** L'appareil sait faire au moins biométrie ou code. */
  supported: boolean;
  unlock: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => void;
};

const LockContext = createContext<LockState | null>(null);

/**
 * Délai en arrière-plan au-delà duquel on reverrouille.
 * Sans lui, prendre une photo de reçu (qui fait passer l'app en arrière-plan)
 * demanderait une empreinte au retour — le verrou deviendrait insupportable et
 * l'utilisateur le couperait.
 */
const RELOCK_AFTER_MS = 30_000;

export function LockProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [locked, setLocked] = useState(enabled);
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(enabled);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    setActive(enabled);
    setLocked(enabled);
  }, [enabled]);

  useEffect(() => {
    void (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setSupported(hasHardware && enrolled);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next === "active" && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => subscription.remove();
  }, [active]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Déverrouiller Ma Finance Perso",
      cancelLabel: "Annuler",
      // On laisse le code de l'appareil en secours : un doigt mouillé ou un
      // capteur défaillant ne doit pas enfermer l'utilisateur hors de ses données.
      disableDeviceFallback: false,
    });
    if (result.success) setLocked(false);
    return result.success;
  }, []);

  return (
    <LockContext.Provider
      value={{
        enabled: active,
        locked: active && locked,
        supported,
        unlock,
        setEnabled: (next) => {
          setActive(next);
          setLocked(false);
        },
      }}
    >
      {children}
    </LockContext.Provider>
  );
}

export function useLock(): LockState {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error("useLock doit etre appele sous <LockProvider>.");
  return ctx;
}

/** L'appareil peut-il verrouiller (biométrie enrôlée ou code défini) ? */
export async function isLockAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}
