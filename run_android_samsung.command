#!/usr/bin/env bash
# Build the Android app and run it on a connected Samsung phone.
# Usage: ./run_android_samsung.command [appClothes1|appCC1|appOnTrend|appPosts]
# Fast path: when nothing native changed since the last successful install on this phone (same
# package.json / package-lock.json / app.config.js / patches / android Gradle files / icon / splash)
# and the app is still installed, Gradle is skipped: only Metro starts and the app is opened.
# FORCE_NATIVE=1 ./run_android_samsung.command   -> always do the full Gradle build + install.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

export APP_NAME="${1:-${APP_NAME:-appClothes1}}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
if [ -z "$JAVA_HOME" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

command -v adb >/dev/null || { echo "adb not found (looked in $ANDROID_HOME/platform-tools)"; exit 1; }

MODEL=""
SERIAL=""
for s in $(adb devices | awk 'NR>1 && $2=="device"{print $1}'); do
  if adb -s "$s" shell getprop ro.product.manufacturer | tr -d '\r' | grep -qi samsung; then
    # Expo identifies devices by the "model:" field of `adb devices -l` (e.g. SM_A336B)
    SERIAL="$s"
    MODEL="$(adb devices -l | awk -v s="$s" '$1==s{for(i=1;i<=NF;i++) if($i ~ /^model:/){sub(/^model:/,"",$i); print $i}}')"
    break
  fi
done
if [ -z "$MODEL" ]; then
  echo "No authorized Samsung device found. Current adb devices:"
  adb devices -l
  echo "Plug in the phone, enable USB debugging and accept the prompt on its screen."
  exit 1
fi

# Stop a Metro bundler left over from an earlier run on port 8088 (for example the emulator script),
# so the phone always loads the current code and not an old bundle.
EXISTING_PID="$(lsof -ti :8088 2>/dev/null || true)"
if [ -n "$EXISTING_PID" ]; then
  echo "Port 8088 is in use by PID(s): $EXISTING_PID. Stopping previous process..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

# Save the device screen to android_screen.png every 20s while the app runs,
# so the screen can be checked without touching the device.
SCREEN_SERIAL="$SERIAL"
if [ -n "$SCREEN_SERIAL" ]; then
  (
    while true; do
      if adb -s "$SCREEN_SERIAL" exec-out screencap -p > .android_screen.tmp 2>/dev/null && [ -s .android_screen.tmp ]; then
        mv -f .android_screen.tmp android_screen.png
      fi
      sleep 20
    done
  ) &
  SCREEN_PID=$!
  trap 'kill $SCREEN_PID 2>/dev/null' EXIT
fi

# Auth server for Android Google sign-in (server/auth-server.mjs) on port 8089,
# reachable from the device as http://localhost:8089.
AUTH_PIDS="$(lsof -ti :8089 2>/dev/null || true)"
[ -n "$AUTH_PIDS" ] && kill $AUTH_PIDS 2>/dev/null
node server/auth-server.mjs > auth_server.log 2>&1 &
AUTH_PID=$!
if ! adb -s "$SERIAL" reverse tcp:8089 tcp:8089 >/dev/null 2>&1; then
  echo "Warning: could not forward port 8089 to the phone - Google sign-in will not reach the auth server."
fi
trap 'kill $AUTH_PID $SCREEN_PID 2>/dev/null' EXIT

# Save the device's own error log (crashes, JavaScript errors, app messages) to android_device.log,
# so a white screen or crash can be diagnosed even when nothing reaches the Metro log.
if [ -n "$SERIAL" ]; then
  adb -s "$SERIAL" logcat -c 2>/dev/null || true
  adb -s "$SERIAL" logcat -v time ReactNativeJS:V ReactNative:W AndroidRuntime:E DevLauncher:V expo:V '*:F' > android_device.log 2>&1 &
  LOGCAT_PID=$!
  trap 'kill $LOGCAT_PID $AUTH_PID $SCREEN_PID 2>/dev/null' EXIT
fi

# Load the app code over the USB cable instead of Wi-Fi: the development bundle is very large,
# and over Wi-Fi the phone can show a white screen / "Reloading..." for minutes.
REVERSE_OK=0
if adb -s "$SERIAL" reverse tcp:8088 tcp:8088 >/dev/null 2>&1; then
  export REACT_NATIVE_PACKAGER_HOSTNAME=localhost
  REVERSE_OK=1
else
  echo "Warning: could not forward port 8088 over USB - the phone will load the app over Wi-Fi (slower)."
fi

# ---- Is a native build needed? -------------------------------------------------------------
PACKAGE="$(node -e "console.log(require('./app.config.js').expo.android.package)")"
SLUG="$(node -e "console.log(require('./app.config.js').expo.slug)")"
STAMP_FILE=".android_native_stamp"   # last successful install: "<phone serial>:<hash of native inputs>"
NEW_STAMP="$SERIAL:$( { echo "$APP_NAME"
  cat package.json package-lock.json app.config.js react-native.config.js patches/* \
      android/build.gradle android/settings.gradle android/gradle.properties android/app/build.gradle \
      android/app/src/main/AndroidManifest.xml android/gradle/wrapper/gradle-wrapper.properties \
      "assets/$APP_NAME/icon.png" "assets/$APP_NAME/splash.png" 2>/dev/null; } | shasum -a 256 | cut -d' ' -f1)"
INSTALLED="$(adb -s "$SERIAL" shell pm path "$PACKAGE" 2>/dev/null | tr -d '\r')"

LOG="android_build.log"
if [ "${FORCE_NATIVE:-0}" != "1" ] && [ "$REVERSE_OK" = "1" ] && [ -n "$INSTALLED" ] \
   && [ "$(cat "$STAMP_FILE" 2>/dev/null)" = "$NEW_STAMP" ]; then
  echo "========================================="
  echo "FAST START (no Gradle): $APP_NAME on $MODEL"
  echo "Native inputs unchanged and $PACKAGE is installed. FORCE_NATIVE=1 forces a full build."
  echo "========================================="
  (
    for i in $(seq 1 180); do
      curl -s http://localhost:8088/status 2>/dev/null | grep -q running && break
      sleep 1
    done
    adb -s "$SERIAL" shell "am start -a android.intent.action.VIEW -d 'exp+$SLUG://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8088' $PACKAGE" >/dev/null 2>&1
  ) &
  npx expo start --dev-client --port 8088
  exit $?
fi

echo "========================================="
echo "Building Android for: $APP_NAME"
echo "Target device:        $MODEL"
echo "========================================="
echo "Full output is also saved to: $LOG"
# Remember this state as installed only after Expo reports that it opened the app on the phone.
rm -f "$STAMP_FILE"
: > "$LOG"
(
  for i in $(seq 1 3600); do
    if grep -aq "Opening exp+" "$LOG" 2>/dev/null; then echo "$NEW_STAMP" > "$STAMP_FILE"; exit 0; fi
    sleep 2
  done
) &
set -o pipefail
npx expo run:android --device "$MODEL" --port 8088 2>&1 | tee "$LOG"
