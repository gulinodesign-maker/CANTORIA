const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const prepare=fs.readFileSync('scripts/prepare-ios.sh','utf8');
const native=fs.readFileSync('native/CantoriaAppleMessageHandler.swift','utf8');
const release=fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
new vm.Script(script);

for(const fragment of [
 'class="song-card" role="button"','data-action="card-pdf"',
 'function exportPdf(mode,songOverride=null,shiftOverride=state.shift)',
 'song-options-grid','song-option-tile','song-options-open-pdf',
 "function inferSongKey(song)",
 "recognizePhotoText(true,state.appleAIAvailable?'apple':'classic')"
])assert.ok(html.includes(fragment),'Missing 0.7.3 behavior: '+fragment);
assert.ok(!html.includes('Apri spartito →'));
assert.ok(!html.includes('Cambia tonalità originale'));
assert.ok(!html.includes('Altre opzioni di esportazione'));
assert.ok(native.includes('request.customWords = chordRoots +'));
assert.ok(native.includes('SI non è S1'));
assert.ok(html.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));

assert.equal(require('../package.json').version,'0.7.3');
assert.ok(fs.readFileSync('sw.js','utf8').includes('cantoria-shell-v0.7.3'));
assert.ok(html.includes('Versione 0.7.3'));

// Both independent modes remain available in the same photo capture UI.
for(const fragment of [
 'photo-analysis-actions','data-action="recognize-photo"',
 'data-action="recognize-apple"',"recognizePhotoText(false,'apple')",
 "native.recognize({image})","await improvePhotoWithApple()",
 "result=await worker.recognize(image, {}, {text:true,blocks:true})",
 'Apple Intelligence non disponibile su questo dispositivo',
 "setTimeout(probeAppleIntelligence,delay)"
])assert.ok(html.includes(fragment),'Missing iOS/photo action: '+fragment);
assert.ok(html.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert.ok(!html.includes('data-action="improve-photo-apple"'));

// A native bridge MUST NOT alter Capacitor's original storyboard or create a
// new CAPBridgeViewController subclass: 0.7.0 compiled but launched black.
assert.ok(prepare.includes('npx cap sync ios'));
assert.ok(prepare.includes("import WebKit\\nimport Vision\\nimport FoundationModels"));
assert.ok(prepare.includes('AppDelegate.swift'));
assert.ok(prepare.includes('native/CantoriaAppleMessageHandler.swift'));
assert.ok(prepare.includes('customClass="CAPBridgeViewController" customModule="Capacitor"'));
assert.ok(!prepare.includes('storyboard.write_text('));
assert.ok(!prepare.includes('customClass="CantoriaBridgeViewController"'));
assert.ok(!native.includes('CAPBridgeViewController:'));
assert.ok(native.includes('WKScriptMessageHandler'));
assert.ok(native.includes('userContentController(_ userContentController: WKUserContentController'));
assert.ok(native.includes('webView.configuration.userContentController.add(self, name: "cantoriaAI")'));
assert.ok(native.includes('message.frameInfo.isMainFrame'));
assert.ok(native.includes('SystemLanguageModel.default.availability'));
assert.ok(native.includes('LanguageModelSession(instructions:'));
assert.ok(native.includes('VNRecognizeTextRequest()'));
assert.ok(native.includes('textLines.joined(separator:'));
assert.ok(native.includes('candidate.boundingBox(for: range)'));
assert.ok(native.includes('window.__cantoriaAIReply'));
assert.ok(!native.includes('URLSession.shared')&&!native.includes('api.openai.com'),
 'The on-device model must not send images or text to a paid external API');

// TestFlight MUST actually start app in a simulator and inspect screenshot
// before signature or Apple submission.
assert.ok(release.indexOf('Block TestFlight release if iOS starts black')>=0);
assert.ok(release.indexOf('Block TestFlight release if iOS starts black')<
 release.indexOf('Upload signed IPA to TestFlight'));
const smoke=fs.readFileSync('scripts/verify-ios-launch.sh','utf8');
assert.ok(smoke.includes('xcrun simctl launch'));
assert.ok(smoke.includes('FAIL: Black iOS screen. Blocking TestFlight upload.'));

// Verify that the WebKit callback completes the corresponding promise, and
// that unavailable/unknown native handlers never register a fake capability.
const a=script.indexOf('let cantoriaAINextRequest=0;');
const b=script.indexOf('async function probeAppleIntelligence()',a);
assert.ok(a>=0&&b>a);
const window={Capacitor:{isNativePlatform:()=>true},webkit:{messageHandlers:{cantoriaAI:{
 postMessage(payload){window.__cantoriaAIReply({id:payload.id,result:{
  available:true,text:'SOL DO',lines:[],suggestion:'[]'
 }});}
}}}};
const ctx={window,Map,Number,Promise,Error,String,
 setTimeout:()=>123,clearTimeout:()=>{}};
vm.createContext(ctx);
vm.runInContext(script.slice(a,b)+'this.getNative=nativeAppleIntelligence;',ctx);
(async()=>{
 const nativePlugin=ctx.getNative();
 assert.ok(nativePlugin);
 assert.equal((await nativePlugin.availability()).available,true);
 assert.equal((await nativePlugin.recognize({image:'data:image/jpeg;base64,aA=='})).text,'SOL DO');
 assert.equal((await nativePlugin.improve({candidates:'[]'})).suggestion,'[]');
 delete window.webkit.messageHandlers.cantoriaAI;
 assert.equal(ctx.getNative(),null);
 console.log('OK: safe stock Capacitor startup, real native AI bridge, Classical OCR, WebKit roundtrip');
})().catch(e=>{console.error(e);process.exitCode=1;});
