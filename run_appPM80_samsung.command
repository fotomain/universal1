#!/usr/bin/env bash
# Build the "Project Budget Management" app (appPM80, com.projectbudgetmanagement) and run it on a connected Samsung phone.
# Same as: ./run_android_samsung.command appPM80
#   - if android/ was made for another app (applicationId differs) it is regenerated first (expo prebuild --clean);
#   - FAST START when nothing native changed since the last install on this phone (Metro only + open the app);
#   - FORCE_NATIVE=1 ./run_appPM80_samsung.command   -> always the full Gradle build + install.
# Usage: ./run_appPM80_samsung.command
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
exec ./run_android_samsung.command appPM80
