const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const child=require('node:child_process');
const release=require('../release.json');
assert.deepEqual(release,{version:'1.1',build:52});
const prepare=fs.readFileSync('scripts/prepare-ios.sh','utf8');
const script='scripts/ios-screen-awake.py';
assert.ok(prepare.indexOf('npx cap sync ios')<prepare.indexOf('python3 '+script+' ios/App/App/AppDelegate.swift'));
assert.ok(prepare.includes('python3 '+script+' --verify ios/App/App/AppDelegate.swift'));
assert.ok(prepare.indexOf('python3 '+script+' --verify')<prepare.indexOf('Preserve Capacitor'));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cantoria-native-awake-'));
const dest=path.join(dir,'AppDelegate.swift');
const example=[
 'import UIKit',
 'import Capacitor',
 '@UIApplicationMain',
 'class AppDelegate: UIResponder, UIApplicationDelegate {',
 '  var window: UIWindow?',
 '  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {',
 '    // Capacitor stock iOS template',
 '    return true',
 '  }',
 '  func applicationWillResignActive(_ application: UIApplication) {}',
 '}'
].join('\n');
function run(...args){return child.spawnSync('python3',[script,...args],{encoding:'utf8'});}
try{
 fs.writeFileSync(dest,example);
 const first=run(dest);
 assert.equal(first.status,0,first.stderr||first.stdout);
 const patched=fs.readFileSync(dest,'utf8');
 assert.match(patched,/CANTORIA_FOREGROUND_SCREEN_AWAKE_V38/);
 assert.match(patched,/UIApplication\.didBecomeActiveNotification[\s\S]*?UIApplication\.shared\.isIdleTimerDisabled = true/);
 assert.match(patched,/UIApplication\.willResignActiveNotification[\s\S]*?UIApplication\.shared\.isIdleTimerDisabled = false/);
 assert.match(patched,/UIApplication\.didEnterBackgroundNotification[\s\S]*?UIApplication\.shared\.isIdleTimerDisabled = false/);
 assert.match(patched,/application\.applicationState == \.active[\s\S]*?application\.isIdleTimerDisabled = true/);
 assert.ok(patched.includes('import Capacitor'));
 assert.ok(patched.includes('return true'));
 assert.equal(patched.split('CANTORIA_FOREGROUND_SCREEN_AWAKE_V38').length,2,'One lifecycle observer block per build');
 assert.equal(run('--verify',dest).status,0,'Build must be able to verify the actual generated Swift');
 const second=run(dest);
 assert.equal(second.status,0,'Native injection must be idempotent');
 assert.equal(fs.readFileSync(dest,'utf8'),patched,'Running twice cannot duplicate observers');
 fs.writeFileSync(dest,example.replace('didFinishLaunchingWithOptions','unexpectedMethod'));
 const unsupported=run(dest);
 assert.equal(unsupported.status,1,'Unexpected Capacitor template must fail safe');
 assert.equal(fs.readFileSync(dest,'utf8').includes('isIdleTimerDisabled'),false);
 assert.equal(run('--verify',dest).status,1,'Unpatched iOS project must be rejected');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
console.log('PASS: foreground screen stays awake in native iOS, resets on deactivation/background, safe and idempotent Capacitor patch');
