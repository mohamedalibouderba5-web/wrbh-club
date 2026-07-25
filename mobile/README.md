# WRBH Mobile (Expo)

App Android native du club — package `dz.wrbh.club`.

## Démarrage (dev)

```bash
cd mobile
npm install
set EXPO_PUBLIC_API_URL=https://wrbh-api.onrender.com
npx expo start
```

## Build APK (local, recommandé)

Prérequis : JDK 17 + Android SDK. Keystore hors dépôt (`~/.wrbh-signing` + `~/.gradle/gradle.properties` avec `WRBH_RELEASE_*`).

```bash
cd mobile
set EXPO_PUBLIC_API_URL=https://wrbh-api.onrender.com
npx expo prebuild --platform android
cd android
gradlew.bat assembleRelease
```

APK : `android/app/build/outputs/apk/release/app-release.apk`

## EAS (optionnel)

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build -p android --profile preview
```

Deep link : `wrbh://`
