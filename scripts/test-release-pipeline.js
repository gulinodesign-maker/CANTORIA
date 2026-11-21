const assert=require('node:assert/strict'),fs=require('node:fs');
const release=require('../release.json');
assert.equal(release.version,'1.1');
assert.equal(release.build,28);
const pipeline=fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8');
assert.ok(pipeline.includes('cancel-in-progress: true'),'Older releases must be cancelled');
assert.ok(pipeline.includes('ref: $'+'{{ github.sha }}'),'Checkout must be pinned');
for(const phase of ['source','staged','archive','ipa']){
 assert.ok(pipeline.includes('bash scripts/verify-release-payload.sh '+phase),'Missing gate '+phase);
}
assert.ok(pipeline.indexOf('verify-release-payload.sh ipa')<pipeline.indexOf('Upload signed IPA to TestFlight'));
const shell=fs.readFileSync('scripts/verify-release-payload.sh','utf8');
for(const token of ['git ls-remote origin refs/heads/main','CFBundleShortVersionString','CFBundleVersion','cmp -s "$name" "web/$name"','cmp -s web/build-info.json','sourceSha256'])
 assert.ok(shell.includes(token),'Missing safeguard '+token);
const prep=fs.readFileSync('scripts/prepare-ios.sh','utf8');
assert.ok(prep.includes("fs.writeFileSync('web/build-info.json'"));
assert.ok(prep.includes("crypto.createHash('sha256')"));
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('class="cover-author"'),'Composer credit absent');
assert.ok(html.includes('CANTORIA 1.1 (28)'),'Release UI notes not updated');
console.log('PASS: stale builds cancelled, exact signed app verified, immutable source fingerprint');
