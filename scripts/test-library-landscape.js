const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);new vm.Script(script);
assert.deepEqual(require('../release.json'),{version:'1.1',build:48});
const a=script.indexOf('function libraryHTML()'),b=script.indexOf('function massDateDisplay(',a);
assert.ok(a>=0&&b>a);const library=script.slice(a,b);
assert.ok(library.includes('class="tiles library-song-list"'),'Library must have dedicated full-width wrapper');
const css=html.slice(html.indexOf('/* CANTORIA 1.1 (21):'),html.indexOf('</style>'));
for(const token of ['.tiles.library-song-list{','grid-template-columns:minmax(0,1fr)!important','grid-column:1/-1!important','@media(orientation:landscape)','row-gap:9px!important'])
 assert.ok(css.includes(token),'Missing CSS: '+token);
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={state:{filter:'',libraryAuthor:'',librarySort:'title-asc',libraryOpenId:null},
 store:{songs:[{id:'1',title:'Agnello di Dio',author:'Fontanelle',sections:[]},{id:'2',title:'Cristo Re',author:'RNS',sections:[{kind:'verse',lines:[]}]}]},
 escape,escapeAttr:escape,CATHOLIC_CORNER:'<svg></svg>',Intl};
vm.runInNewContext(library+'this.renderLibrary=libraryHTML;',ctx);
const collapsed=ctx.renderLibrary();
assert.equal((collapsed.match(/class="song-card library-song-card/g)||[]).length,2);
assert.equal((collapsed.match(/data-action="toggle-library-card"/g)||[]).length,2);
assert.ok(!collapsed.includes('data-action="read-song"'));
assert.ok(collapsed.includes('(Fontanelle)'));
ctx.state.libraryOpenId='1';const opened=ctx.renderLibrary();
for(const action of ['add-to-mass','export-song','card-pdf','read-song','ask-delete-song'])
 assert.equal((opened.match(new RegExp('data-action="'+action+'"','g'))||[]).length,1,action);
const mass=script.slice(script.indexOf('function massDetailHTML()'),script.indexOf('const OCR_JS_URL='));
assert.ok(mass.includes('data-action="read-mass-song"'),'Mass song behavior must not change');
console.log('PASS: Library renders single full-width column, compact collapsed card, four actions when expanded.');
