const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.deepEqual(require('../release.json'),{version:'1.1',build:44});
assert.ok(js);new vm.Script(js);
const cap=js.slice(js.indexOf('function captureHTML(){'),js.indexOf('function updateDiagnosticPanel('));
const ctx={state:{photoURL:'data:image/png;base64,AABB',photoTitle:'Ti esalto',photoAuthor:'Test',
 photoLiturgicalRole:'Santo'},escapeAttr:v=>String(v),photoOcrFormHTML:()=>''};
vm.runInNewContext(cap+'this.capture=captureHTML;',ctx);
const rendered=ctx.capture();
assert.ok(rendered.includes('id="photoSongLiturgicalRole"'),'Photo acquisition shows liturgical role field');
assert.ok(rendered.includes('name="photoSongLiturgicalRole"'),'Role must submit with photo form');
assert.ok(rendered.includes('<option value="Santo" selected>'),'Selected role survives renders during OCR');
assert.ok(rendered.includes('<option value="Comunione"'),'Offer meaningful Catholic liturgical choices');
assert.ok(js.includes("liturgicalRole:String(f.get('photoSongLiturgicalRole')||'').trim().slice(0,90)"),
 'New song must store acquisition classification');
assert.ok(js.includes("state.photoLiturgicalRole=e.target.value"),'Preserve selection when OCR rerenders');
assert.ok(js.includes("state.photoLiturgicalRole=''"),'New photo clears stale selection');
const lib=js.slice(js.indexOf('function libraryHTML()'),js.indexOf('function massDateDisplay('));
const mass=js.slice(js.indexOf('function massDetailHTML()'),js.indexOf('const OCR_JS_URL='));
for(const body of [lib,mass])assert.ok(body.includes('<div class="cover-liturgical">'),
 'Both card types show the role in green');
assert.ok(html.includes('color:#217348!important'),'Liturgical role must be green');
const reader=js.slice(js.indexOf('function readerHTML()'),js.indexOf('const CATHOLIC_CORNER'));
assert.ok(!reader.includes('reader-chord-nav'),'Manual previous/next chord arrows must be gone');
assert.ok(reader.includes('reader-back app-back-btn'),'Main back control must remain');
assert.ok(html.includes('height:calc(80px + env(safe-area-inset-top,0px))!important'),
 'Landscape Mass header must be lower than the old 86-115 px');
console.log('PASS: acquire liturgical role, persist, render both cards, protect corner and compact Mass header');
