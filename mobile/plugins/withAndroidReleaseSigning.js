const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Signe les builds Android release avec le keystore du club lorsque les propriétés
 * Gradle WRBH_RELEASE_* sont présentes (~/.gradle/gradle.properties, hors dépôt).
 * Sans ces propriétés, le comportement Expo par défaut (clé de debug) est conservé.
 */
const SIGNING_CONFIG = `
        release {
            if (project.hasProperty('WRBH_RELEASE_STORE_FILE')) {
                storeFile file(WRBH_RELEASE_STORE_FILE)
                storePassword WRBH_RELEASE_STORE_PASSWORD
                keyAlias WRBH_RELEASE_KEY_ALIAS
                keyPassword WRBH_RELEASE_KEY_PASSWORD
            }
        }`;

const SIGNING_REFERENCE =
  "signingConfig project.hasProperty('WRBH_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

function patchBuildGradle(contents) {
  if (contents.includes("WRBH_RELEASE_STORE_FILE")) return contents;

  let next = contents.replace("signingConfigs {", `signingConfigs {${SIGNING_CONFIG}`);

  const buildTypesIndex = next.indexOf("buildTypes {");
  const releaseIndex = next.indexOf("release {", buildTypesIndex);
  const target = "signingConfig signingConfigs.debug";
  const targetIndex = next.indexOf(target, releaseIndex);
  if (buildTypesIndex === -1 || releaseIndex === -1 || targetIndex === -1) {
    throw new Error("withAndroidReleaseSigning: buildTypes.release introuvable dans app/build.gradle");
  }

  return next.slice(0, targetIndex) + SIGNING_REFERENCE + next.slice(targetIndex + target.length);
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("withAndroidReleaseSigning: build.gradle Groovy attendu");
    }
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });
};
