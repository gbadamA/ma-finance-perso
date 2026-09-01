import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createSupabaseClient } from "@mfp/supabase";

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  "";
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ??
  "";

/**
 * `false` tant que le projet Supabase n'est pas renseigné dans `.env`.
 * L'app bascule alors en **mode démonstration** (jeu de données local) plutôt
 * que de planter au démarrage : on peut développer et montrer l'interface
 * avant que la base existe.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createSupabaseClient(url, anonKey, { storage: AsyncStorage })
  : null;
