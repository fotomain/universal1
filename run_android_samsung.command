#!/usr/bin/env bash
# Build the Android app and run it on a connected Samsung phone.
# Usage: ./run_android_samsung.command [appClothes1|appCC1|appOnTrend|appPosts]
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
for s in $(adb devices | awk 'NR>1 && $2=="device"{print $1}'); do
  if adb -s "$s" shell getprop ro.product.manufacturer | tr -d '\r' | grep -qi samsung; then
    # Expo identifies devices by the "model:" field of `adb devices -l` (e.g. SM_A336B)
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

echo "========================================="
echo "Building Android for: $APP_NAME"
echo "Target device:        $MODEL"
echo "========================================="
LOG="android_build.log"
echo "Full output is also saved to: $LOG"
set -o pipefail
npx expo run:android --device "$MODEL" --port 8088 2>&1 | tee "$LOG"
