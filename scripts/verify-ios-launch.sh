#!/usr/bin/env bash
# Release-blocking launch check. The 0.7.0 custom controller compiled successfully
# but shipped a uniformly black display. Reject any repeat before TestFlight export.
set -euo pipefail
: "${RUNNER_TEMP:?Requires GitHub macOS runner}"
: "${IOS_BUNDLE_ID:?Requires the same bundle ID as the current build}"
log="$RUNNER_TEMP/cantoria-simulator-build.log"
screens="$RUNNER_TEMP/cantoria-launch.png"
simlog="$RUNNER_TEMP/cantoria-launch.log"
data="$RUNNER_TEMP/CantoriaLaunchDerived"
echo "Building launch-test iOS app (no Apple signing)…"
if ! xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$data" CODE_SIGNING_ALLOWED=NO \
  MARKETING_VERSION="$(node -p "require('./release.json').version")" \
  CURRENT_PROJECT_VERSION="$(node -p "require('./release.json').build")" build >"$log" 2>&1; then
  tail -n 120 "$log"
  exit 1
fi

# GitHub-hosted macOS may pause indefinitely while CoreSimulator runs
# LaunchServicesMigrator. Bound every simulator command, recover the simulator
# once on failure, and NEVER bypass the screenshot/black-screen gate.
run_bounded() {
  local seconds="$1"; shift
  python3 - "$seconds" "$@" <<'PY'
import os, signal, subprocess, sys
seconds = int(sys.argv[1])
command = sys.argv[2:]
print("Simulator check (max %ss): %s" % (seconds, " ".join(command)), flush=True)
process = subprocess.Popen(command, start_new_session=True)
try:
    rc = process.wait(timeout=seconds)
except subprocess.TimeoutExpired:
    print("::warning::Simulator command exceeded %ss: %s" %
          (seconds, " ".join(command)), flush=True)
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
    rc = 124
sys.exit(rc)
PY
}
device="$(xcrun simctl list devices available -j | python3 -c 'import json,sys;j=json.load(sys.stdin);print(next((d["udid"] for group in j["devices"].values() for d in group if "iPhone" in d["name"] and d.get("isAvailable",True)),""))')"
if [[ -z "$device" ]]; then
  echo "::error::No available iPhone simulator; cannot publish an unverified app."
  exit 1
fi
cat > "$RUNNER_TEMP/check-cantoria-screen.swift" <<'SWIFT'
import AppKit
import Foundation
let file = URL(fileURLWithPath: CommandLine.arguments[1])
guard let bytes = try? Data(contentsOf: file),
      let bitmap = NSBitmapImageRep(data: bytes) else {
    print("FAIL: Cannot decode simulator screenshot")
    exit(1)
}
var visible = 0
var total = 0
for y in stride(from: bitmap.pixelsHigh / 8, to: bitmap.pixelsHigh * 7 / 8, by: 15) {
  for x in stride(from: bitmap.pixelsWide / 8, to: bitmap.pixelsWide * 7 / 8, by: 15) {
    guard let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
    total += 1
    if (color.redComponent + color.greenComponent + color.blueComponent) / 3 > 0.35 {
      visible += 1
    }
  }
}
let fraction = Double(visible) / Double(max(total, 1))
print("Cantoria launch visible pixel fraction: \(fraction)")
if fraction < 0.15 {
  print("FAIL: Black iOS screen. Blocking TestFlight upload.")
  exit(1)
}
print("PASS: iOS app startup is visibly nonblack.")
SWIFT
passed=false
for attempt in 1 2; do
  echo "Cantoria iOS launch verification attempt $attempt of 2, simulator $device"
  rm -f "$screens" "$simlog"
  if [[ "$attempt" -gt 1 ]]; then
    echo "::warning::Simulator startup stalled. Shutting down and erasing simulator before retry."
    run_bounded 45 xcrun simctl shutdown "$device" || true
    run_bounded 90 xcrun simctl erase "$device" || true
  fi
  if ! run_bounded 75 xcrun simctl boot "$device"; then
    echo "::warning::Simulator boot command failed (attempt $attempt)."
    continue
  fi
  if ! run_bounded 240 xcrun simctl bootstatus "$device" -b; then
    echo "::warning::Simulator bootstatus did not finish (attempt $attempt)."
    continue
  fi
  if ! run_bounded 75 xcrun simctl install "$device" "$data/Build/Products/Release-iphonesimulator/App.app"; then
    echo "::warning::Simulator installation failed (attempt $attempt)."
    continue
  fi
  if ! run_bounded 60 xcrun simctl launch "$device" "$IOS_BUNDLE_ID"; then
    echo "::warning::Cantoria failed to launch (attempt $attempt)."
    continue
  fi
  sleep 12
  if ! run_bounded 45 xcrun simctl io "$device" screenshot "$screens"; then
    echo "::warning::Simulator screenshot failed (attempt $attempt)."
    continue
  fi
  run_bounded 35 xcrun simctl spawn "$device" log show --last 90s --style compact \
    --predicate 'process == "App" OR process == "WebKit.WebContent"' \
    > "$simlog" 2>&1 || true
  if run_bounded 90 swift "$RUNNER_TEMP/check-cantoria-screen.swift" "$screens"; then
    passed=true
    break
  fi
  echo "::warning::App launch failed the visible-screen test; retrying the simulator once."
done
if [[ "$passed" != true ]]; then
  echo "::error::Cantoria launch was not verified after two bounded simulator attempts. Refusing TestFlight upload."
  exit 1
fi
echo "PASS: Verified nonblack iOS startup after bounded simulator launch."
