const assert=require('node:assert/strict'),fs=require('node:fs');
const content=fs.readFileSync('scripts/verify-ios-launch.sh','utf8');
const workflow=fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8');
assert.deepEqual(require('../release.json'),{version:'1.1',build:41});
for(const fragment of [
 'Building launch-test iOS app (no Apple signing)',
 'run_bounded()',
 'subprocess.Popen(command, start_new_session=True)',
 'process.wait(timeout=seconds)',
 'os.killpg(process.pid, signal.SIGTERM)',
 'os.killpg(process.pid, signal.SIGKILL)',
 'for attempt in 1 2; do',
 'run_bounded 75 xcrun simctl boot "$device"',
 'run_bounded 240 xcrun simctl bootstatus "$device" -b',
 'run_bounded 45 xcrun simctl shutdown "$device"',
 'run_bounded 90 xcrun simctl erase "$device"',
 'run_bounded 75 xcrun simctl install',
 'run_bounded 60 xcrun simctl launch',
 'run_bounded 45 xcrun simctl io "$device" screenshot',
 'run_bounded 150 xcrun swiftc',
 'run_bounded 30 "$RUNNER_TEMP/check-cantoria-screen" "$screens"',
 'print("FAIL: Black iOS screen. Blocking TestFlight upload.")',
 'if [[ "$passed" != true ]]',
 'Refusing TestFlight upload.'
])assert.ok(content.includes(fragment),'Missing simulator safety: '+fragment);
assert.ok(content.indexOf('run_bounded 150 xcrun swiftc')<content.indexOf('for attempt in 1 2; do') &&
 content.indexOf('run_bounded 30 "$RUNNER_TEMP/check-cantoria-screen"')<content.indexOf('if [[ "$passed" != true ]]'));
// Keep a manual black-screen diagnostic, but never run an iPhone simulator
// as part of the automatic TestFlight gate.
assert.ok(!workflow.includes('run: bash scripts/verify-ios-launch.sh'));
assert.ok(workflow.includes('Archive unsigned for Apple cloud distribution signing'));
const smoke=fs.readFileSync('.github/workflows/ios-startup-smoke.yml','utf8');
assert.ok(smoke.includes('workflow_dispatch:'));
assert.ok(!smoke.includes('pull_request:'),'The visual smoke run must remain opt-in');
assert.ok(workflow.includes('cancel-in-progress: true'),'New release must supersede old run');
const watchdog=fs.readFileSync('.github/workflows/ios-testflight-retry.yml','utf8');
assert.ok(watchdog.includes('if (active.length > 0)'),'Do not retry while a release is running');
console.log('PASS: optional simulator diagnostic remains bounded; TestFlight no longer requires simulator boot');
