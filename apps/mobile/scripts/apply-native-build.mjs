/**
 * Déplace les dossiers de build natif (`.cxx`) hors de l'arborescence source.
 *
 * Deux problèmes que cela résout, tous deux rencontrés sous Windows :
 *
 * 1. **Boucle CMake infinie.** Par défaut `.cxx` est créé DANS le dossier
 *    `android/` de chaque module natif — c'est-à-dire à l'intérieur de
 *    l'arborescence que les `file(GLOB … CONFIGURE_DEPENDS)` des CMakeLists
 *    surveillent. Chaque génération y écrit des fichiers, ce qui invalide le
 *    glob, ce qui relance la génération. Ninja abandonne au bout de 100 tours :
 *    « manifest 'build.ninja' still dirty after 100 tries ».
 *
 * 2. **Longueur de chemin.** CMake refuse un chemin d'objet de plus de 250
 *    caractères (`CMAKE_OBJECT_PATH_MAX`). Une racine courte laisse de la marge.
 *
 * ⚠️ À rejouer après chaque `expo prebuild`, qui régénère `android/build.gradle` :
 *
 *     node scripts/apply-native-build.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gradlePath = join(root, "android", "build.gradle");

/** Racine des builds natifs. Volontairement très courte et hors du projet. */
const CXX_ROOT = "C:/mfp-cxx";

if (!existsSync(gradlePath)) {
  console.error("android/build.gradle introuvable — lancez d'abord `expo prebuild`.");
  process.exit(1);
}

let gradle = readFileSync(gradlePath, "utf8");

if (gradle.includes("buildStagingDirectory")) {
  console.log("Dossier de build natif déjà déporté.");
  process.exit(0);
}

const BLOCK = `
// Sort les dossiers de build natif (.cxx) de l'arborescence source.
// Sans cela, CMake regenere en boucle (le .cxx tombe dans un file(GLOB
// CONFIGURE_DEPENDS)) et ninja abandonne : « manifest 'build.ninja' still
// dirty after 100 tries ». La racine courte evite en prime la limite de
// 250 caracteres sur les chemins d'objets (CMAKE_OBJECT_PATH_MAX).
//
// \`plugins.withId\` et non \`afterEvaluate\` : le plugin Expo evalue certains
// sous-projets avant ce script, et \`afterEvaluate\` echoue alors avec
// « Cannot run Project.afterEvaluate(Closure) when the project is already
// evaluated ». \`withId\` se declenche correctement dans les deux cas.
subprojects { subproject ->
  ['com.android.library', 'com.android.application'].each { pluginId ->
    subproject.plugins.withId(pluginId) {
      subproject.extensions.getByName('android')
        .externalNativeBuild.cmake.buildStagingDirectory =
          new File('${CXX_ROOT}/' + subproject.name)
    }
  }
}
`;

gradle += BLOCK;
writeFileSync(gradlePath, gradle, "utf8");

mkdirSync(CXX_ROOT, { recursive: true });
console.log(`Builds natifs déportés vers ${CXX_ROOT}.`);
