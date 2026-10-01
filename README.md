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
npx expo start --web
npm run web

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

make me save_to_github.command: it must save to branch of universal1: expo-YYYY-MM-DD-HH-MM
it must solve the error: The following problems have occurred when adding the files: Unable to create '/Users/mgtimber/UNIVERSAL1/expo-app/.git/index.lock': File exists. Another git process seems to be running in this repository, e.g. an editor opened by 'git commit'. Please make sure all processes are terminated then try again. If it still fails, a git process may have crashed in this repository earlier: remove the file manually to continue.

git init
git add .
git commit -m "first commit"
git branch -M main1
git remote add origin https://github.com/fotomain/universal1.git
git push -u origin main1
