const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// HOTFIX 0.7.1: do not let the native Apple Intelligence experiment replace
// the stock Capacitor view controller. The 0.7.0 simulator screenshot was
// uniformly black despite a successful compile and TestFlight upload.
const prepare=fs.readFileSync('scripts/prepare-ios.sh','utf8');
const html=fs.readFileSync('index.html','utf8');
const pkg=require('../package.json');
const sw=fs.readFileSync('sw.js','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Cantoria inline script is required');
new vm.Script(script);
assert.equal(pkg.version,'0.7.1');
assert.ok(sw.includes('cantoria-shell-v0.7.1'));
assert.ok(html.includes('Versione 0.7.1'));

assert.ok(prepare.includes('npx cap sync ios'));
assert.ok(prepare.includes('cp index.html score-ocr.js score-geometry.js score-editor.js'));
assert.ok(!prepare.includes('app.write_text('),'Must not inject native Swift into compiled AppDelegate');
assert.ok(!prepare.includes('storyboard.write_text('),'Must not replace native storyboard controller');
assert.ok(!prepare.includes('customClass="CantoriaBridgeViewController"'),
 'The custom controller shipped in 0.7.0 produced a black screen');
assert.ok(!prepare.includes('native/CantoriaIntelligencePlugin.swift'),
 'The native plugin must not be loaded in the emergency recovery build');
assert.ok(!prepare.includes('native/CantoriaViewController.swift'));
assert.ok(!prepare.includes('import FoundationModels')&&
 !prepare.includes('import Vision'),'Do not import experimental frameworks on app launch');
const release=fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8');
const gate=release.indexOf('Block TestFlight release if iOS starts black');
const upload=release.indexOf('Upload signed IPA to TestFlight');
assert.ok(gate>=0&&upload>gate,'A black-screen test must block Apple upload');
assert.ok(release.includes('bash scripts/verify-ios-launch.sh'));
const launch=fs.readFileSync('scripts/verify-ios-launch.sh','utf8');
assert.ok(launch.includes('xcrun simctl launch'));
assert.ok(launch.includes('FAIL: Black iOS screen. Blocking TestFlight upload.'));


// Keep the user-requested side-by-side choice visible but disable AI safely.
assert.ok(html.includes('photo-analysis-actions'));
assert.ok(html.includes('data-action="recognize-photo"'));
assert.ok(html.includes('data-action="recognize-apple"'));
assert.ok(html.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert.ok(html.includes('Apple Intelligence temporaneamente disattivata'));
assert.ok(html.includes('(!state.appleAIAvailable||state.ocrBusy||state.appleAIBusy)'));
const a=script.indexOf('function nativeAppleIntelligence(){');
const b=script.indexOf('async function probeAppleIntelligence()',a);
assert.ok(a>=0&&b>a);
assert.ok(script.slice(a,b).includes('return null;'),
 'Native plugin must not be registered from web on the recovery build');
assert.ok(!script.includes('setTimeout(probeAppleIntelligence,900)'));
assert.ok(!script.includes('window.addEventListener(\'focus\',probeAppleIntelligence)'));
assert.ok(script.includes("result=await worker.recognize(image, {}, {text:true,blocks:true})"),
 'Classic OCR remains functional');
assert.ok(script.includes('function photoSectionsFromText('));
assert.ok(script.includes('function exportPdf('));

console.log('OK: stock iOS startup preserved; Apple AI safely disabled, Classic OCR and song editing retained');
