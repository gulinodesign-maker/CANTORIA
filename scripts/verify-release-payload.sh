#!/usr/bin/env bash
# Block uploading stale builds, wrong version or outdated HTML.
# Runs on macOS GitHub Actions after staging, archive and IPA export.
set -euo pipefail
phase="$1"
case "$phase" in source|staged|archive|ipa) ;; *) echo "Usage: $0 source|staged|archive|ipa" >&2; exit 2;; esac
sha="$(git rev-parse HEAD)"
eventsha="$(printenv GITHUB_SHA || true)"
if [[ -n "$eventsha" && "$sha" != "$eventsha" ]]; then
  echo "::error::Checkout $sha does not match workflow commit $eventsha" >&2
  exit 1
fi
latest="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
if [[ -z "$latest" || "$sha" != "$latest" ]]; then
  echo "::error::Stale release: checkout $sha differs from main $latest" >&2
  exit 1
fi
version="$(node -p "require('./release.json').version")"
build="$(node -p "require('./release.json').build")"
if [[ "$version" != "1.1" || ! "$build" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error::Invalid marketing version/build: $version ($build)" >&2
  exit 1
fi
echo "Checking source commit $sha, CANTORIA $version ($build), phase $phase"
if [[ "$phase" == source ]]; then exit 0; fi
if [[ "$phase" == staged ]]; then
  [[ -s web/build-info.json && -s ios/App/App/public/index.html ]] || {
    echo "::error::Capacitor staging did not copy web assets" >&2; exit 1;
  }
  for name in index.html release.json sw.js; do
    cmp -s "$name" "web/$name" || { echo "::error::Web staging differs: $name"; exit 1; }
    cmp -s "$name" "ios/App/App/public/$name" || { echo "::error::iOS staging differs: $name"; exit 1; }
  done
  cmp -s web/build-info.json ios/App/App/public/build-info.json ||
    { echo "::error::Capacitor lost build provenance"; exit 1; }
  echo "PASS: Native app staging contains this commit's web source."
  exit 0
fi
app=""
if [[ "$phase" == archive ]]; then
  app="$RUNNER_TEMP/Cantoria.xcarchive/Products/Applications/App.app"
else
  ipa="$(find "$RUNNER_TEMP/export" -maxdepth 1 -name '*.ipa' -print -quit)"
  [[ -n "$ipa" && -s "$ipa" ]] || { echo "::error::Signed IPA missing"; exit 1; }
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  unzip -qq "$ipa" -d "$tmp"
  app="$(find "$tmp/Payload" -maxdepth 1 -type d -name '*.app' -print -quit)"
fi
[[ -n "$app" && -d "$app" ]] || { echo "::error::Missing $phase app"; exit 1; }
plist="$app/Info.plist"
[[ -s "$plist" ]] || { echo "::error::Missing Info.plist"; exit 1; }
app_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")"
app_build="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$plist")"
if [[ "$app_version" != "$version" || "$app_build" != "$build" ]]; then
  echo "::error::Binary is $app_version ($app_build), expected $version ($build)" >&2
  exit 1
fi
for name in index.html release.json score-metadata.js sw.js; do
  if ! cmp -s "$name" "$app/public/$name"; then
    echo "::error::Stale $name in $phase app" >&2
    exit 1
  fi
done
if ! cmp -s web/build-info.json "$app/public/build-info.json"; then
  echo "::error::Commit fingerprint mismatch" >&2
  exit 1
fi
node - "$app/public/build-info.json" "$sha" "$version" "$build" <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto');
const [file,commit,version,build]=process.argv.slice(2);
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const digest=crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex');
if(data.commit!==commit||data.version!==version||
   data.build!==Number(build)||data.sourceSha256!==digest){
 console.error('Incorrect source/version embedded in iOS bundle',data);
 process.exit(1);
}
NODE
echo "PASS: $phase matches EXACT commit $sha and version $version ($build)"
