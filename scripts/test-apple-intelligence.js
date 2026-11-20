const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const native=fs.readFileSync('native/CantoriaIntelligencePlugin.swift','utf8');
const prepare=fs.readFileSync('scripts/prepare-ios.sh','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Cantoria web application must include inline JS');
new vm.Script(js);

for(const item of [
  'photo-analysis-actions','data-action="recognize-photo"',
  'data-action="recognize-apple"',"recognizePhotoText(false,'apple')",
  "mode==='apple'","native.recognize({image})",
  "await improvePhotoWithApple()",'state.appleAIAvailable',
  'setTimeout(probeAppleIntelligence,900)',
  "result=await worker.recognize(image, {}, {text:true,blocks:true})"
])assert.ok(html.includes(item),'Required dual-mode UI or OCR logic missing: '+item);
assert.ok(!html.includes('data-action="improve-photo-apple"'),
  'The old third AI button must not be shown');
assert.ok(html.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),
  'The two analysis buttons should be side by side');
assert.ok(html.includes('(!state.appleAIAvailable||state.ocrBusy||state.appleAIBusy)'),
  'Native AI button must be disabled when device model is unavailable');

for(const source of [
  '@objc(CantoriaIntelligencePlugin)','CAPBridgedPlugin',
  'CAPPluginMethod(name: "availability"','CAPPluginMethod(name: "recognize"',
  'CAPPluginMethod(name: "improve"','VNRecognizeTextRequest()',
  'SystemLanguageModel.default.availability','LanguageModelSession(instructions:',
  'text.boundingBox(for: range)','text.boundingBox(for: charRange)',
  'bridge?.registerPluginInstance(CantoriaIntelligencePlugin())',
  '@objc(CantoriaBridgeViewController)', 'override func capacitorDidLoad()'
])assert.ok(native.includes(source),'Native iOS feature missing: '+source);
assert.ok(prepare.includes('ios/App/App/AppDelegate.swift'),
  'Register inside already-compiled AppDelegate, not an uncompiled Swift file');
assert.ok(prepare.includes("'import Capacitor'"));
assert.ok(prepare.includes("'import FoundationModels"));
assert.ok(prepare.includes("import Vision"));
assert.ok(prepare.includes('CantoriaBridgeViewController: CAPBridgeViewController'));
assert.ok(prepare.includes('AppDelegate.swift in Sources'));
assert.ok(prepare.includes('customClass="CantoriaBridgeViewController"'));
assert.ok(prepare.includes('Unexpected storyboard bridge class'));
assert.ok(prepare.includes("xml.replace(old, 'customClass=\"CantoriaBridgeViewController\"'"),
  'Storyboard class must be replaced with its explicit Obj-C name');
assert.ok(prepare.includes('Refusing module-qualified storyboard class'),
  'Build must reject a module-qualified native controller');
assert.ok(!prepare.includes('CantoriaIntelligenceBootstrap.register'),
  'Do not register after WebView load: JS plugin headers would be missing');
assert.ok(!prepare.includes('cp native/CantoriaViewController.swift'),
  'Black-screen prototype must never be copied again');

// The model can only propose corrections to submitted OCR anchors.
const a=js.indexOf('function proposedAppleCorrections(');
const b=js.indexOf('async function improvePhotoWithApple()',a);
assert.ok(a>=0&&b>a);
const context={
 state:{geometryDraft:{sections:[{lines:[{anchors:[
  {chord:'?',verified:false,unresolved:true,sourceX:17},
  {chord:'SOL',verified:true,sourceX:44}
 ]}]}]}},
 window:{CantoriaOCR:require('../score-ocr.js')},
 String,Number,Set,JSON
};
if(!context.window.CantoriaOCR?.chordName){
 const root={};vm.runInNewContext(fs.readFileSync('score-ocr.js','utf8'),{
  globalThis:root,module:{exports:{}}
 });context.window.CantoriaOCR=root.CantoriaOCR;
}
vm.createContext(context);
vm.runInContext(js.slice(a,b)+'this.testProposals=proposedAppleCorrections;',context);
const rows=JSON.stringify([
 {si:0,li:0,ai:0,chord:'MI/7',reason:'Lettura del simbolo'},
 {si:0,li:0,ai:1,chord:'RE7',reason:'Provare a cambiare accordo verificato'},
 {si:0,li:0,ai:99,chord:'DO',reason:'Indice inesistente'}
]);
const proposals=context.testProposals(rows,new Set(['0:0:0']));
assert.equal(proposals.length,1);
assert.equal(proposals[0].after,'MI/7');
assert.equal(proposals[0].before,'?');
assert.equal(context.state.geometryDraft.sections[0].lines[0].anchors[0].chord,'?',
 'AI suggestions must NOT automatically overwrite the source score');
assert.equal(context.testProposals('[]',new Set(['0:0:0'])).length,0);
assert.equal(context.testProposals('Questo non è JSON',new Set(['0:0:0'])).length,0);

// Apple Vision returns measured word/character boxes in the existing OCR shape.
const root={};vm.runInNewContext(fs.readFileSync('score-ocr.js','utf8'),{globalThis:root,module:{exports:{}}});
vm.runInNewContext(fs.readFileSync('score-geometry.js','utf8'),{globalThis:root,module:{exports:{}}});
const word=(text,x,y,width)=>({
 text,confidence:98,
 bbox:{x0:x,y0:y,x1:x+width,y1:y+18},
 symbols:[...text].map((ch,i)=>({
  text:ch,bbox:{x0:x+i*12,y0:y,x1:x+(i+1)*12,y1:y+18}
 }))
});
const vision={text:'SOL2 RE\nBenedetto sei Signore',
 lines:[
  {words:[word('SOL2',44,25,55),word('RE',208,25,30)]},
  {words:[word('Benedetto',20,64,116),word('sei',150,64,38),word('Signore',205,64,105)]}
 ]};
const result=root.CantoriaGeometry.parseGeometry(vision);
assert.equal(result.hasGeometry,true);
assert.equal(result.sections[0].lines.length,1);
assert.deepEqual(Array.from(result.sections[0].lines[0].anchors,a=>a.chord),['SOL2','RE']);
assert.ok(result.sections[0].lines[0].anchors.every(a=>Number.isFinite(a.sourceX)));
console.log('OK: dual scan modes, gated native AI, safe registration and source-anchored Vision OCR');
