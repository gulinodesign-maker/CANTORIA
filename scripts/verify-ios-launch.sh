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
  MARKETING_VERSION="$(node -p "require('./package.json').version")" \
  CURRENT_PROJECT_VERSION="${GITHUB_RUN_NUMBER:-1}" build >"$log" 2>&1; then
  tail -n 120 "$log"
  exit 1
fi
device="$(xcrun simctl list devices available -j | python3 -c 'import json,sys;j=json.load(sys.stdin);print(next((d["udid"] for group in j["devices"].values() for d in group if "iPhone" in d["name"] and d.get("isAvailable",True)),""))')"
if [[ -z "$device" ]]; then
  echo "No available iPhone simulator; cannot publish an unverified app." >&2
  exit 1
fi
echo "Starting iPhone simulator: $device"
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
xcrun simctl install "$device" "$data/Build/Products/Release-iphonesimulator/App.app"
xcrun simctl launch "$device" "$IOS_BUNDLE_ID"
sleep 12
xcrun simctl io "$device" screenshot "$screens"
xcrun simctl spawn "$device" log show --last 90s --style compact \
  --predicate 'process == "App" OR process == "WebKit.WebContent"' \
  > "$simlog" 2>&1 || true
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
swift "$RUNNER_TEMP/check-cantoria-screen.swift" "$screens"
