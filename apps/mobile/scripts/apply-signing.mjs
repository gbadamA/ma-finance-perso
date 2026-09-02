/**
 * Réapplique la configuration de signature release dans le projet natif Android.
 *
 * `expo prebuild` régénère `android/` depuis zéro et rétablit le template React
 * Native, qui signe la release avec la clé de **debug**. Un APK ainsi signé
 * s'installe, mais ne peut jamais être mis à jour par un APK correctement signé.
 *
 * Ce script est donc à rejouer après chaque prebuild :
 *
 *     npx expo prebuild --platform android --clean
 *     node scripts/apply-signing.mjs
 *     cd android && ./gradlew assembleRelease
 *
 * La clé vit dans `credentials/`, hors de `android/` que prebuild efface, et
 * hors de git. Si elle est absente, le script ne fait rien et le build retombe
 * sur la clé de debug — un poste sans la clé peut donc quand même produire un
 * APK de test.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gradlePath = join(root, "android", "app", "build.gradle");
const keystorePath = join(root, "credentials", "keystore.properties");

if (!existsSync(gradlePath)) {
  console.error("android/app/build.gradle introuvable — lancez d'abord `expo prebuild`.");
  process.exit(1);
}

if (!existsSync(keystorePath)) {
  console.log("Aucune clé dans credentials/ : la release restera signée en debug.");
  process.exit(0);
}

let gradle = readFileSync(gradlePath, "utf8");

if (gradle.includes("signingConfigs.release")) {
  console.log("Signature release déjà en place.");
  process.exit(0);
}

const DEBUG_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const WITH_RELEASE = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        // Clé de release. Le fichier vit dans apps/mobile/credentials/, HORS de
        // android/ : \`expo prebuild --clean\` efface android/, pas la clé.
        release {
            def props = new Properties()
            def file = rootProject.file('../credentials/keystore.properties')
            if (file.exists()) {
                file.withInputStream { props.load(it) }
                storeFile rootProject.file('../credentials/' + props['MFP_RELEASE_STORE_FILE'])
                storePassword props['MFP_RELEASE_STORE_PASSWORD']
                keyAlias props['MFP_RELEASE_KEY_ALIAS']
                keyPassword props['MFP_RELEASE_KEY_PASSWORD']
            }
        }
    }`;

const DEBUG_SIGNING = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const RELEASE_SIGNING = `        release {
            // Signature de production si la clé est présente, sinon debug pour
            // qu'un poste sans la clé puisse quand même produire un APK de test.
            signingConfig rootProject.file('../credentials/keystore.properties').exists()
                ? signingConfigs.release
                : signingConfigs.debug`;

for (const [from, to] of [
  [DEBUG_BLOCK, WITH_RELEASE],
  [DEBUG_SIGNING, RELEASE_SIGNING],
]) {
  if (!gradle.includes(from)) {
    console.error(
      "Le template Android a changé : le bloc attendu est introuvable.\n" +
        "Réappliquez la signature à la main dans android/app/build.gradle.",
    );
    process.exit(1);
  }
  gradle = gradle.replace(from, to);
}

writeFileSync(gradlePath, gradle, "utf8");
console.log("Signature release appliquée à android/app/build.gradle.");
