const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:31});
const sections=[
 ['homeHTML','headerHTML'],['libraryHTML','massDateDisplay'],
 ['massesHTML','massDetailHTML'],['captureHTML','settingsHTML'],
 ['settingsHTML','appHTML']
];
for(const [begin,end] of sections){
 const a=js.indexOf('function '+begin+'('),b=js.indexOf('function '+end+'(',a);
 assert.ok(a>=0&&b>a,'Missing '+begin);
 const body=js.slice(a,b);
 assert.ok(!body.includes('class="page-heading"'),'Duplicated page heading in '+begin);
 assert.ok(!body.includes('<h1>'),'Page title outside topbar in '+begin);
}
assert.ok(js.includes('class="topbar topbar-home topbar-home-labeled"'));
assert.ok(js.includes('home-topbar-title">Cantoria</h1>'));
assert.ok(js.includes("capture:'Acquisisci un canto'"));
assert.ok(js.includes("titles[state.view]||'Cantoria'"));
assert.ok(js.includes('class="header-build"'),'Build number should appear with Settings title in topbar');
const l=js.slice(js.indexOf('function libraryHTML()'),js.indexOf('function massDateDisplay('));
assert.ok(l.includes('class="library-find-row"'));
for(const id of ['id="search"','id="libraryAuthorFilter"','id="librarySort"'])assert.ok(l.includes(id),id);
const css=html.slice(html.indexOf('/* Cantoria 1.1 (17):'));
assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'));
assert.ok(css.includes('.library-find-row .library-filter-bar{display:contents!important}'));
assert.ok(css.includes('height:48px!important'));
assert.ok(css.includes('@media screen and (orientation:landscape)'));
assert.ok(css.includes('.section-workspace{padding-top:5px!important;'),'Landscape workspace must have compact padding');
const cap=js.slice(js.indexOf('function captureHTML()'),js.indexOf('function settingsHTML()'));
assert.ok(!html.includes('📷'),'No skeuomorphic camera emoji anywhere');
assert.equal((cap.match(/<svg class="flat-ui-icon"/g)||[]).length,3);
for(const input of ['photoCameraInput','photoLibraryInput','songImportCaptureInput'])assert.ok(cap.includes('for="'+input+'"'));
console.log('OK: all titles in topbars, equal 3-column library filters, non-skeuomorphic SVG icons, landscape compactness');
