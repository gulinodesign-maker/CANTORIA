#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$IOS_BUNDLE_ID" || ! "$IOS_BUNDLE_ID" =~ ^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$ ]]; then
  echo "Missing/invalid IOS_BUNDLE_ID. Configure repository variable IOS_BUNDLE_ID before building." >&2
  exit 1
fi

# Bundle the actual web application offline inside the iOS app.
mkdir -p web
cp index.html score-ocr.js score-capture-patch.js manifest.webmanifest sw.js web/
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

# Beta icon: native 1024px variant of the existing official Cantoria PNG.
# Replace with the approved original high-resolution icon once available as a repository asset.
icon="ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
if [[ ! -f "$icon" ]]; then
  echo "Expected Capacitor iOS AppIcon template not found: $icon" >&2
  exit 1
fi
sips -s format png -z 1024 1024 assets/cantoria-icona-ufficiale-045.png --out "$icon" >/dev/null
echo "Cantoria iOS project prepared for bundle identifier: $IOS_BUNDLE_ID"
