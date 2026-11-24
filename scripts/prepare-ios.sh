#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$IOS_BUNDLE_ID" || ! "$IOS_BUNDLE_ID" =~ ^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$ ]]; then
  echo "Missing/invalid IOS_BUNDLE_ID. Configure repository variable IOS_BUNDLE_ID before building." >&2
  exit 1
fi

# Bundle the actual web application offline inside the iOS app.
mkdir -p web
cp index.html release.json liturgical-calendar.js liturgical-theme.css midi-follow.js harmony-analysis.js score-ocr.js score-geometry.js score-metadata.js score-editor.js manifest.webmanifest sw.js web/
cp -R assets web/assets
# Stamp the exact commit and HTML hash into the bundled web application.
node - <<'NODE'
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const release=require('./release.json');
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceSha256=crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex');
fs.writeFileSync('web/build-info.json',JSON.stringify({
 version:release.version,build:release.build,commit,sourceSha256
},null,2)+'\n');
NODE
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

# Cantoria is a live score reader. Keep the display awake throughout the
# foreground iOS session, not only while listening for chords. This patch
# must be applied after Capacitor generates AppDelegate on each CI build.
python3 scripts/ios-screen-awake.py ios/App/App/AppDelegate.swift
python3 scripts/ios-screen-awake.py --verify ios/App/App/AppDelegate.swift

# Preserve Capacitor's stock controller; never replace the startup storyboard.
if ! grep -Eq 'customClass="(CAPBridgeViewController|CantoriaBridgeViewController)" customModule="(Capacitor|App)"' ios/App/App/Base.lproj/Main.storyboard; then
 echo "Unsafe controller. Refusing build." >&2; exit 1
fi

# Register the native Core MIDI bridge after Capacitor generates the iOS project.
python3 scripts/ios-core-midi.py ios/App/App/AppDelegate.swift ios/App/App/Base.lproj/Main.storyboard
python3 scripts/ios-core-midi.py --verify ios/App/App/AppDelegate.swift ios/App/App/Base.lproj/Main.storyboard

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
python3 scripts/ios-scene.py ios/App

echo "Cantoria iOS project prepared for bundle identifier: $IOS_BUNDLE_ID"
