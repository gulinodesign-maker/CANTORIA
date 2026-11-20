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

# Register a local native plugin at capacitorDidLoad(), before WebView loading.
# To prevent the old "Unknown class" black screen, the ViewController subclass
# is appended to AppDelegate.swift, which is confirmed in the Xcode Sources phase.
# Its explicit Obj-C runtime name is used by Main.storyboard without a module
# qualifier; the class is guaranteed to compile in the existing App target.
app_delegate="ios/App/App/AppDelegate.swift"
storyboard="ios/App/App/Base.lproj/Main.storyboard"
project="ios/App/App.xcodeproj/project.pbxproj"
python3 - "$app_delegate" "$storyboard" "$project" <<'PY'
import sys
from pathlib import Path

app, storyboard, project = map(Path, sys.argv[1:])
src = app.read_text(encoding='utf-8')
if 'import Capacitor' not in src:
    raise SystemExit('Capacitor AppDelegate template missing')
if 'AppDelegate.swift in Sources' not in project.read_text(encoding='utf-8'):
    raise SystemExit('AppDelegate.swift is not compiled into the iOS target')
if 'import FoundationModels' not in src:
    src = src.replace(
        'import Capacitor',
        'import Capacitor\\nimport FoundationModels\\nimport Vision', 1
    )
native = Path('native/CantoriaIntelligencePlugin.swift').read_text(encoding='utf-8')
if '@objc(CantoriaBridgeViewController)' not in native:
    raise SystemExit('Native compiled ViewController class missing')
app.write_text(src + '\\n' + native, encoding='utf-8')

xml = storyboard.read_text(encoding='utf-8')
old = 'customClass="CAPBridgeViewController" customModule="Capacitor"'
if xml.count(old) != 1:
    raise SystemExit('Unexpected storyboard bridge class; refusing unsafe modification')
xml = xml.replace(old, 'customClass="CantoriaBridgeViewController"', 1)
storyboard.write_text(xml, encoding='utf-8')
PY

grep -q 'CantoriaBridgeViewController: CAPBridgeViewController' "$app_delegate"
grep -q 'bridge?.registerPluginInstance(CantoriaIntelligencePlugin())' "$app_delegate"
grep -q 'customClass="CantoriaBridgeViewController"' "$storyboard"
if grep -q 'customModule="App"' "$storyboard"; then
  echo "Refusing module-qualified storyboard class (black-screen risk)" >&2
  exit 1
fi

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
