const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:33});
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const songs=[
 {id:'2',title:'Zefiro',author:'Zara'},
 {id:'1',title:'Alleluia',author:'Bruno'},
 {id:'3',title:'Canto',author:'Bruno'},
 {id:'4',title:'Benedetto',author:''},
 {id:'5',title:'Amore',author:'Adele'}
];
const ctx={store:{songs},state:{filter:'',librarySort:'title-asc',libraryAuthor:''},escape,escapeAttr:escape,CATHOLIC_CORNER:'<svg></svg>',Intl};
const start=js.indexOf('function libraryHTML(){'),end=js.indexOf('function massDateDisplay(',start);
assert.ok(start>=0&&end>start);
vm.runInNewContext(js.slice(start,end)+'this.makeLibrary=libraryHTML;',ctx);
function titles(html){
 return [...html.matchAll(/data-action="toggle-library-card" data-song="([^"]+)"/g)].map(x=>x[1]);
}
assert.deepEqual(titles(ctx.makeLibrary()),['1','5','4','3','2']);
ctx.state.librarySort='title-desc';
assert.deepEqual(titles(ctx.makeLibrary()),['2','3','4','5','1']);
ctx.state.librarySort='author-asc';
assert.deepEqual(titles(ctx.makeLibrary()),['5','1','3','2','4'],'Uncredited songs last');
ctx.state.librarySort='author-desc';
assert.deepEqual(titles(ctx.makeLibrary()),['2','1','3','5','4']);
ctx.state.libraryAuthor='Bruno';ctx.state.librarySort='title-asc';
assert.deepEqual(titles(ctx.makeLibrary()),['1','3']);
ctx.state.libraryAuthor='';ctx.state.filter='zara';
assert.deepEqual(titles(ctx.makeLibrary()),['2'],'Search matches author');
ctx.state.filter='cAntO';
assert.deepEqual(titles(ctx.makeLibrary()),['3'],'Search matches title');
ctx.state.filter='';
const library=ctx.makeLibrary();
for(const id of ['libraryAuthorFilter','librarySort'])assert.ok(library.includes('id="'+id+'"'));
for(const option of ['Titolo A–Z','Titolo Z–A','Autore A–Z','Autore Z–A'])assert.ok(library.includes(option));
const capstart=js.indexOf('function captureHTML()'),capend=js.indexOf('function settingsHTML()',capstart);
const capture=js.slice(capstart,capend);
assert.ok(capture.includes('id="songImportCaptureInput"'));
assert.ok(capture.includes('for="songImportCaptureInput"'));
assert.ok(capture.includes('for="photoCameraInput"'));
assert.ok(capture.includes('for="photoLibraryInput"'));
assert.ok(js.includes("if(e.target.id==='songImportCaptureInput')"),'Only Capture may import song files');
assert.ok(!library.includes('id="songImportInput"'),'No hidden file import in Library');
assert.ok(!library.includes('class="library-import"'),'No Import/Add action strip in Library');
assert.ok(!library.includes('data-nav="capture"'),'No Add Song button in Library');
assert.ok(capture.includes('Scatta una foto')&&capture.includes('Scegli una foto')&&capture.includes('Importa brano'),'Exactly the three Capture choices');
assert.ok(js.includes("if(e.target.id==='libraryAuthorFilter')"));
assert.ok(js.includes("if(e.target.id==='librarySort')"));
assert.ok(html.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'));
console.log('OK: alphabetic title/author sorting, author filter, and Capture-only import');
