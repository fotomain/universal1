#!/usr/bin/env bash
# Build the Android app and run it on an Android emulator.
# Usage: ./run_on_emulator_android.command [appClothes1|appCC1|appOnTrend|appPosts]
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

export APP_NAME="${1:-${APP_NAME:-appClothes1}}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
if [ -z "$JAVA_HOME" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

command -v adb >/dev/null || { echo "adb not found (looked in $ANDROID_HOME/platform-tools)"; exit 1; }
command -v emulator >/dev/null || { echo "emulator not found (looked in $ANDROID_HOME/emulator)"; exit 1; }

# 1. Check if an emulator is already running
RUNNING_EMU="$(adb devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2=="device"{print $1; exit}')"

if [ -z "$RUNNING_EMU" ]; then
  AVD="${EMULATOR_NAME:-$(emulator -list-avds | head -n 1)}"
  if [ -z "$AVD" ]; then
    echo "No Android Virtual Device (AVD) found. Please create one in Android Studio."
    exit 1
  fi
  echo "Starting Android emulator '$AVD' in background..."
  nohup emulator -avd "$AVD" >/dev/null 2>&1 &
  echo "Waiting for emulator device connection..."
  adb wait-for-device
  echo "Waiting for emulator system to complete boot..."
  while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    sleep 2
  done
  echo "Emulator booted successfully!"
fi

# 2. Resolve target device name for Expo CLI
EMU_SERIAL="$(adb devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2=="device"{print $1; exit}')"
AVD_NAME=""
# Expo finds a running emulator by asking it for its name. Right after boot the emulator may not
# answer yet, and then Expo tries to start a second copy, which quits at once
# ("The emulator quit before it finished opening"). So wait until the emulator answers.
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  [ -z "$EMU_SERIAL" ] && break
  AVD_NAME="$(adb -s "$EMU_SERIAL" emu avd name 2>/dev/null | head -n 1 | tr -d '\r')"
  if [ -n "$AVD_NAME" ] && [ "$AVD_NAME" != "OK" ] && ! echo "$AVD_NAME" | grep -qi "error"; then break; fi
  AVD_NAME=""
  sleep 2
done
# No name: let Expo use the device that is already connected instead of starting an emulator itself.
DEVICE_ARGS=()
if [ -n "$AVD_NAME" ]; then
  DEVICE_ARGS=(--device "$AVD_NAME")
else
  echo "The running emulator did not report its name; Expo will use the connected device."
fi
TARGET_DEVICE="${AVD_NAME:-$EMU_SERIAL}"

# 3. Check for existing process on Metro port 8088 and free it if needed
EXISTING_PID="$(lsof -ti :8088 2>/dev/null || true)"
if [ -n "$EXISTING_PID" ]; then
  echo "Port 8088 is in use by PID(s): $EXISTING_PID. Stopping previous process..."
  kill -9 $EXISTING_PID 2>/dev/null || true
  sleep 1
fi

# Save the device screen to android_screen.png every 20s while the app runs,
# so the screen can be checked without touching the device.
SCREEN_SERIAL="$EMU_SERIAL"
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
[ -n "$SCREEN_SERIAL" ] && adb -s "$SCREEN_SERIAL" reverse tcp:8089 tcp:8089 >/dev/null 2>&1
trap 'kill $AUTH_PID $SCREEN_PID 2>/dev/null' EXIT

# Save the device's own error log (crashes, JavaScript errors, app messages) to android_device.log,
# so a white screen or crash can be diagnosed even when nothing reaches the Metro log.
if [ -n "$EMU_SERIAL" ]; then
  adb -s "$EMU_SERIAL" logcat -c 2>/dev/null || true
  adb -s "$EMU_SERIAL" logcat -v time ReactNativeJS:V ReactNative:W AndroidRuntime:E DevLauncher:V expo:V '*:F' > android_device.log 2>&1 &
  LOGCAT_PID=$!
  trap 'kill $LOGCAT_PID $AUTH_PID $SCREEN_PID 2>/dev/null' EXIT
fi

echo "========================================="
echo "Building Android for: $APP_NAME"
echo "Target emulator:      $TARGET_DEVICE"
echo "========================================="
LOG="android_emulator_build.log"
echo "Full output is also saved to: $LOG"
set -o pipefail
npx expo run:android ${DEVICE_ARGS[@]+"${DEVICE_ARGS[@]}"} --port 8088 2>&1 | tee "$LOG"
