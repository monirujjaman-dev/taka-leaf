#!/usr/bin/env bash
# Installs the APK on the running emulator, opens it, and fails if the app does not stay open.
# Leaves logcat.txt and screen.png behind for the workflow to upload.
set -u
apk="$1"
pkg=com.takaleaf.app

adb install -r "$apk"
adb logcat -c
adb shell am start -W -n "$pkg/.MainActivity"
sleep 30
adb logcat -d -v time > logcat.txt
adb exec-out screencap -p > screen.png
pid=$(adb shell pidof "$pkg" | tr -d '\r')

echo "--- crash lines ---"
grep -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|DEBUG   :|libc    :|Fatal signal|SoLoader|ExpoModulesCore|Unhandled" logcat.txt | head -150

if [ -z "$pid" ] || grep -q "FATAL EXCEPTION\|Fatal signal" logcat.txt; then
  echo "TakaLeaf did not stay open."
  exit 1
fi
echo "TakaLeaf is running (pid $pid)."
