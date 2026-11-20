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

# Apple Intelligence native plugin uses the ALREADY COMPILED AppDelegate.swift,
# not a new ViewController. The stock CAPBridgeViewController storyboard is left
# unchanged, avoiding the black-screen regression from the 0.6.3 prototype.
app_delegate="ios/App/App/AppDelegate.swift"
python3 - "$app_delegate" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
src = path.read_text(encoding='utf-8')
if 'import Capacitor' not in src:
    raise SystemExit('Capacitor AppDelegate template is not available')
if 'import FoundationModels' not in src:
    src = src.replace('import Capacitor', 'import Capacitor\nimport FoundationModels\nimport Vision', 1)

hook = 'func applicationDidBecomeActive(_ application: UIApplication) {'
if hook not in src:
    raise SystemExit('Capacitor AppDelegate activation method was not found')
injection = '''func applicationDidBecomeActive(_ application: UIApplication) {
        // Let the built-in Capacitor WebView initialize first.
        // Registration is idempotent and never invokes an AI model on launch.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            Task { @MainActor in
                CantoriaIntelligenceBootstrap.register(in: self?.window)
            }
        }
'''
src = src.replace(hook, injection, 1)
path.write_text(src + '\n' + Path('native/CantoriaIntelligencePlugin.swift').read_text(encoding='utf-8'), encoding='utf-8')
PY

# Confirm this build never modifies the bridge view-controller identity.
grep -q 'customClass="CAPBridgeViewController" customModule="Capacitor"' ios/App/App/Base.lproj/Main.storyboard
grep -q 'CantoriaIntelligenceBootstrap.register' "$app_delegate"
grep -q 'class CantoriaIntelligencePlugin:' "$app_delegate"


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
