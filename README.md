# █████████████████████ Uneversal1 APP

https://youtu.be/4pe1fn3Gus0
https://youtu.be/nta1YhicoGw

refactor: 
mediaPostGUID->rowGUID,
mediaPostOwnerGUID->rowOwnerGUID,
mediaPostJSON->rowJSON,

ListWebCardsComponent.tsx:489  POST https://czgrxgzdmodkkmbmraub.supabase.co/rest/v1/mediaPostTable?select=* 400 (Bad Request)

## ███ Git

git push origin main1 --force
git push origin main1:main --force

## ███ RUN
npm run web
npx expo start --web



[Documents](../../Documents)
# CLEAR
taskkill /f /im node.exe
npm cache clean --force
sudo killall node
killall node
killall -9 node
# NEW APP
npm run web -- -c
npx expo start -c
npx expo start --web --clear

npx expo start --clear
rmdir /s .expo

# PUBLISH WEB EAS 
npm install -g eas-cli
## Verify status 
eas whoami
# 1. Link this project to your Expo account (creates projectId in app.config.js / app.json)
eas init
# 2. Generate the eas.json configuration file
eas build:configure

# PUBLISH ========= publish to global eas web
--- make me ./deploy/deploy_web_eas.command

# PUBLISH STORES
Build for App Stores (Production AAB & iOS IPA)
bash
# Android AAB for Google Play:
eas build --platform android --profile production
# iOS Archive for Apple App Store:
eas build --platform ios --profile production
# Both platforms simultaneously:
eas build --platform all --profile production

## 💾 Save Codebase to GitHub (Branch with Chronology)
Save to repository `universal1` on chronological branch `expo-YYYY-MM-DD-HH-MM` (automatically resolves `.git/index.lock` and hung processes):

```bash
# From expo-app or project root:
./save_to_github.command
# or
./save_to_github
# or
npm run save_to_github
```
git push origin HEAD:main
