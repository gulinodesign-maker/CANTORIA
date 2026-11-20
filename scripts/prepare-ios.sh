#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$IOS_BUNDLE_ID" || ! "$IOS_BUNDLE_ID" =~ ^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$ ]]; then
  echo "Missing/invalid IOS_BUNDLE_ID. Configure repository variable IOS_BUNDLE_ID before building." >&2
  exit 1
fi

# Bundle the actual web application offline inside the iOS app.
mkdir -p web
cp index.html score-ocr.js score-geometry.js score-editor.js manifest.webmanifest sw.js web/
cp -R assets web/assets
cat > capacitor.config.json <<EOF
{
  "appId": "$IOS_BUNDLE_ID",
  "appName": "Cantoria",
  "webDir": "web"
}
EOF

if [[ ! -d ios/App/App.xcodeproj ]]; then
  npx cap add ios
fi
npx cap sync ios

# CRITICAL 0.7.1 HOTFIX: Keep Capacitor's stock CAPBridgeViewController.
# The 0.7.0 compiled custom Swift controller triggered a black launch screen.
# Do NOT append the experimental Foundation Models plugin to AppDelegate.swift
# or change Main.storyboard until a proper native runtime launch test passes.
# The classic photo OCR remains available with all local user data preserved.

# Fail closed if a future change restores a custom storyboard controller
# without an explicit successful launch test.
if ! grep -q 'customClass="CAPBridgeViewController" customModule="Capacitor"' ios/App/App/Base.lproj/Main.storyboard; then
  echo "Unsafe custom iOS controller detected: refusing possible black-screen build." >&2
  exit 1
fi

# The native AI bridge is independent of Capacitor's custom plugin mechanism.
# It hooks into AppDelegate's already-compiled code, and attaches to the
# existing WKWebView after it has started. Never change Main.storyboard here.
python3 - ios/App/App/AppDelegate.swift <<'PY'
from pathlib import Path
import sys

delegate = Path(sys.argv[1])
source = delegate.read_text(encoding='utf-8')
if 'import Capacitor' not in source or 'func applicationDidBecomeActive(_ application: UIApplication) {' not in source:
    raise SystemExit('Capacitor AppDelegate template mismatch: refusing unsafe native patch')
if 'CantoriaAppleMessageHandler' in source:
    raise SystemExit('AppDelegate was already modified: refusing duplicate bridge')
source = source.replace(
    'import Capacitor',
    'import Capacitor\nimport WebKit\nimport Vision\nimport FoundationModels',
    1
)
source = source.replace(
    '    var window: UIWindow?',
    '    var window: UIWindow?\n    private let cantoriaAIHandler = CantoriaAppleMessageHandler()',
    1
)
hook = '    func applicationDidBecomeActive(_ application: UIApplication) {'
source = source.replace(hook, hook + '''
        // Safe lifecycle hook: the system Capacitor controller has already
        // been created. The handler attaches after its WKWebView appears.
        // No model is ever executed on app launch.
        for delay in [0.4, 1.2, 3.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.cantoriaAIHandler.installIfNeeded(window: self?.window)
            }
        }
''', 1)
native = Path('native/CantoriaAppleMessageHandler.swift').read_text(encoding='utf-8')
delegate.write_text(source + '\n' + native, encoding='utf-8')
PY

# The 0.7.0 failure was caused by a replacement bridge ViewController.
# Reject any storyboard/controller change even if Swift compiles successfully.
grep -q 'customClass="CAPBridgeViewController" customModule="Capacitor"' ios/App/App/Base.lproj/Main.storyboard
grep -q 'CantoriaAppleMessageHandler()' ios/App/App/AppDelegate.swift
grep -q 'WKScriptMessageHandler' ios/App/App/AppDelegate.swift

# Required prompts for photo-based song capture on iOS.
plist="ios/App/App/Info.plist"
for entry in \
  "NSCameraUsageDescription|Cantoria usa la fotocamera per fotografare gli spartiti." \
  "NSPhotoLibraryUsageDescription|Cantoria apre le foto degli spartiti che scegli dalla libreria."; do
  key="${entry%%|*}"
  value="${entry#*|}"
  /usr/libexec/PlistBuddy -c "Add :$key string $value" "$plist" 2>/dev/null || \
    /usr/libexec/PlistBuddy -c "Set :$key $value" "$plist"
done

# Export compliance: standard HTTPS/system encryption is exempt.
# This plist is recreated on each build; never store the declaration in a throwaway iOS folder.
/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$plist"
actual_encryption=$(/usr/libexec/PlistBuddy -c "Print :ITSAppUsesNonExemptEncryption" "$plist")
if ! echo "$actual_encryption" | grep -Eiq '^(false|no|0)$'; then
  echo "Info.plist export compliance declaration is invalid" >&2
  exit 1
fi

# Beta icon: native 1024px variant of the existing official Cantoria PNG.
# Replace with the approved original high-resolution icon once available as a repository asset.
icon="ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
if [[ ! -f "$icon" ]]; then
  echo "Expected Capacitor iOS AppIcon template not found: $icon" >&2
  exit 1
fi
sips -s format png -z 1024 1024 assets/cantoria-icona-ufficiale-045.png --out "$icon" >/dev/null
echo "Cantoria iOS project prepared for bundle identifier: $IOS_BUNDLE_ID"
