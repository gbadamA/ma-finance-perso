/**
 * Photos de reçus — §6.1 du cahier des charges.
 *
 * Le bucket `receipts` est **privé** et sa policy exige que le premier segment
 * du chemin soit l'identifiant de l'utilisateur (`{user_id}/{mois}/{fichier}`).
 * On construit donc le chemin ici, à partir de la session — jamais à partir
 * d'une valeur venue de l'écran.
 */

import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { RECEIPTS_BUCKET, receiptPath } from "@mfp/supabase";
import { supabase } from "./supabase";

export type PickedReceipt = {
  /** URI locale, affichable immédiatement dans un aperçu. */
  uri: string;
  mimeType: string;
  fileName: string;
};

/** Taille au-delà de laquelle le bucket refuse le fichier (cf. migration RLS). */
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

export type UploadResult = { path: string | null; error: string | null };

/**
 * Envoie le fichier et renvoie son chemin dans le bucket.
 *
 * ⚠️ Pas de mise en file hors-ligne : le fichier vit dans le cache de
 * l'appareil, que le système peut vider avant le rejeu. On promettrait un envoi
 * qu'on ne peut pas tenir. L'appelant enregistre alors la dépense **sans** son
 * reçu et le dit à l'utilisateur.
 */
export async function uploadReceipt(
  picked: PickedReceipt,
  /** `MonthKey` de la dépense — organise le bucket par mois. */
  month: string,
): Promise<UploadResult> {
  if (!supabase) return { path: null, error: "Mode démonstration : reçu non envoyé." };

  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) return { path: null, error: "Session expirée." };

  // Lecture via l'API `File` d'expo-file-system plutôt que `fetch(file://)` :
  // le polyfill fetch de React Native n'implémente pas `arrayBuffer()` de façon
  // fiable sur les URI locales, et l'échec est silencieux selon la plateforme.
  let body: Uint8Array;
  try {
    body = await new File(picked.uri).bytes();
  } catch {
    return { path: null, error: "Image illisible sur l'appareil." };
  }

  if (body.byteLength > MAX_BYTES) {
    return { path: null, error: "Reçu trop lourd (5 Mo maximum)." };
  }

  // Nom unique : deux reçus pris la même minute ne doivent pas s'écraser.
  const extension = picked.fileName.split(".").pop()?.toLowerCase() || "jpg";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const path = receiptPath(userId, month, name);

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, body, { contentType: picked.mimeType, upsert: false });

  return error ? { path: null, error: error.message } : { path, error: null };
}

/**
 * URL temporaire d'affichage d'un reçu.
 * Le bucket étant privé, il n'existe pas d'URL publique : on signe à la demande,
 * pour une heure — assez pour consulter, trop court pour être partagé par erreur.
 */
export async function receiptUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function deleteReceipt(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
  return error?.message ?? null;
}
