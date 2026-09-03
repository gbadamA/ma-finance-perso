/**
 * Photos de reçus — §6.1 du cahier des charges.
 *
 * Le fichier part vers `POST /receipts` et l'API le range sous l'utilisateur du
 * jeton. L'app ne choisit donc ni chemin ni propriétaire : il n'y a plus rien
 * ici qu'un écran pourrait falsifier, contrairement au chemin de bucket qu'on
 * construisait avant.
 */

import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { apiRequest, authHeaders, isApiConfigured, receiptEndpoint } from "./api";

export type PickedReceipt = {
  /** URI locale, affichable immédiatement dans un aperçu. */
  uri: string;
  mimeType: string;
  fileName: string;
};

/** Même plafond que celui appliqué par l'API. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Ouvre l'appareil photo.
 * `quality: 0.6` : un reçu doit rester lisible, pas être une photo d'art — et
 * sur une connexion ivoirienne, 4 Mo d'upload pour une note de restaurant est
 * un coût que l'utilisateur paie sans contrepartie.
 */
export async function captureReceipt(): Promise<PickedReceipt | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.6,
    allowsEditing: true,
  });
  return toPicked(result);
}

/** Choisit une image déjà dans la galerie (reçu reçu par WhatsApp, PDF scanné…). */
export async function pickReceipt(): Promise<PickedReceipt | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.6,
  });
  return toPicked(result);
}

function toPicked(result: ImagePicker.ImagePickerResult): PickedReceipt | null {
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0]!;
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? `recu-${Date.now()}.jpg`,
  };
}

export type UploadResult = { id: string | null; error: string | null };

/**
 * Envoie le fichier et renvoie son identifiant.
 *
 * ⚠️ Pas de mise en file hors-ligne : le fichier vit dans le cache de
 * l'appareil, que le système peut vider avant le rejeu. On promettrait un envoi
 * qu'on ne peut pas tenir. L'appelant enregistre alors la dépense **sans** son
 * reçu et le dit à l'utilisateur.
 */
export async function uploadReceipt(picked: PickedReceipt): Promise<UploadResult> {
  if (!isApiConfigured) return { id: null, error: "Mode démonstration : reçu non envoyé." };

  // Le poids est vérifié avant l'envoi : sur une connexion mobile, découvrir le
  // refus après avoir téléversé 8 Mo coûte du forfait pour rien.
  try {
    const size = new File(picked.uri).size;
    if (size !== null && size > MAX_BYTES) {
      return { id: null, error: "Reçu trop lourd (5 Mo maximum)." };
    }
  } catch {
    return { id: null, error: "Image illisible sur l'appareil." };
  }

  // React Native accepte `{ uri, name, type }` dans un `FormData` et lit le
  // fichier lui-même pendant l'envoi. On évite ainsi de charger l'image entière
  // en mémoire JavaScript, ce que faisait la lecture en `Uint8Array`.
  const form = new FormData();
  form.append("file", {
    uri: picked.uri,
    name: picked.fileName,
    type: picked.mimeType,
  } as unknown as Blob);

  try {
    const { id } = await apiRequest<{ id: string }>("/receipts", { method: "POST", form });
    return { id, error: null };
  } catch (error) {
    return { id: null, error: error instanceof Error ? error.message : "Envoi impossible." };
  }
}

/**
 * De quoi afficher un reçu dans un `<Image>`.
 *
 * L'endpoint exige le jeton : on renvoie donc l'en-tête avec l'URL, plutôt
 * qu'une URL signée autoporteuse comme le faisait le stockage Supabase.
 * Renvoie `null` si la session n'est pas ouverte.
 */
export async function receiptSource(
  id: string,
): Promise<{ uri: string; headers: Record<string, string> } | null> {
  const headers = await authHeaders();
  return headers ? { uri: receiptEndpoint(id), headers } : null;
}
