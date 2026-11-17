#!/usr/bin/env bash
# Prints the next app version tag: calendar version on the Asia/Dhaka date, vYYYY.MM.DD, with
# .2, .3 ... when there is already a release that day. (Android builds keep their own
# android-v* tags; see .github/workflows/android.yml.)
set -euo pipefail
base="v$(TZ=Asia/Dhaka date +%Y.%m.%d)"
tags=$(git ls-remote --tags --refs origin "refs/tags/${base}*" | sed 's#.*refs/tags/##')
if ! grep -qx "$base" <<<"$tags"; then echo "$base"; exit 0; fi
n=2
while grep -qx "$base.$n" <<<"$tags"; do n=$((n + 1)); done
echo "$base.$n"
