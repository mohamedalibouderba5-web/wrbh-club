# WRBH Mobile (Expo)

## Démarrage

```bash
cd mobile
npm install
# Pointer vers l'API (téléphone physique = IP LAN de votre PC)
# dans app.json extra.apiUrl ou :
set EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
npx expo start
```

## Comptes démo

- Parent : `parent@wrbh.local` / `parent123`
- Coach : `coach1@wrbh.local` / `coach123`

## Build APK / TestFlight

```bash
npm i -g eas-cli
eas login
eas build -p android --profile preview
eas build -p ios --profile preview
```

Deep link scheme : `wrbh://`  
Bouton **Actualiser / Réveiller le serveur** sur l’écran login et Accueil.
