const assert=require('node:assert/strict'),fs=require('node:fs');
const content=fs.readFileSync('scripts/verify-ios-launch.sh','utf8');
const workflow=fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8');
assert.deepEqual(require('../release.json'),{version:'1.1',build:36});
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
 'run_bounded 90 swift',
 'print("FAIL: Black iOS screen. Blocking TestFlight upload.")',
 'if [[ "$passed" != true ]]',
 'Refusing TestFlight upload.'
])assert.ok(content.includes(fragment),'Missing simulator safety: '+fragment);
assert.ok(content.indexOf('run_bounded 90 swift')<content.indexOf('if [[ "$passed" != true ]]'));
assert.ok(workflow.includes('run: bash scripts/verify-ios-launch.sh'));
assert.ok(workflow.indexOf('Block TestFlight release if iOS starts black')<
 workflow.indexOf('Archive unsigned for Apple cloud distribution signing'));
assert.ok(workflow.includes('cancel-in-progress: true'),'New release must supersede old run');
const watchdog=fs.readFileSync('.github/workflows/ios-testflight-retry.yml','utf8');
assert.ok(watchdog.includes('if (active.length > 0)'),'Do not retry while a release is running');
console.log('PASS: simulator boot is bounded, retries once, still blocks black-screen uploads and supersedes old runs');
