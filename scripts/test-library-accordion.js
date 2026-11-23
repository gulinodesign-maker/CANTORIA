const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:52});
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const songs=[{id:'1',title:'Signore pietà',author:'Francesco Buttazzo',sections:[{kind:'verse',lines:[]}]},{id:'2',title:'Gloria',author:'',sections:[]}];
const ctx={state:{filter:'',libraryAuthor:'',librarySort:'title-asc',libraryOpenId:null},store:{songs},escape,escapeAttr:escape,CATHOLIC_CORNER:'<svg></svg>',Intl};
const a=js.indexOf('function libraryHTML()'),b=js.indexOf('function massDateDisplay(',a);
assert.ok(a>=0&&b>a);vm.runInNewContext(js.slice(a,b)+'this.makeLibrary=libraryHTML;',ctx);
let collapsed=ctx.makeLibrary();
assert.equal((collapsed.match(/data-action="toggle-library-card"/g)||[]).length,2);
assert.equal((collapsed.match(/aria-expanded="false"/g)||[]).length,2);
for(const action of ['add-to-mass','export-song','card-pdf','read-song','ask-delete-song'])
 assert.ok(!collapsed.includes('data-action="'+action+'"'),'Collapsed card shows '+action);
assert.ok(collapsed.includes('<div class="cover-author">(Francesco Buttazzo)</div>'));
ctx.state.libraryOpenId='1';const opened=ctx.makeLibrary();
assert.equal((opened.match(/aria-expanded="true"/g)||[]).length,1);
assert.equal((opened.match(/aria-expanded="false"/g)||[]).length,1);
for(const action of ['add-to-mass','export-song','card-pdf','read-song','ask-delete-song'])
 assert.equal((opened.match(new RegExp('data-action="'+action+'"','g'))||[]).length,1,action);
assert.ok(opened.includes('>Apri brano</span>'),'Fourth action must open song');
const n=opened.indexOf('class="cover-label">Signore pietà');
const author=opened.indexOf('(Francesco Buttazzo)');
assert.ok(n>=0&&author>n,'Title appears above parenthesized author');
ctx.state.libraryOpenId=null;
assert.ok(!ctx.makeLibrary().includes('data-action="read-song"'),'Closing hides open button');
ctx.state.libraryOpenId='2';
const emptyAuthor=ctx.makeLibrary();
assert.ok(!emptyAuthor.includes('class="cover-author">()</div>'));
const css=html.slice(html.indexOf('/* CANTORIA 1.1 (20):'));
for(const marker of ['library-card-collapsed','min-height:62px!important','repeat(4,minmax(0,1fr))!important','@media(orientation:landscape)'])
 assert.ok(css.includes(marker),'Missing responsive compact card CSS '+marker);
const events=js.slice(js.indexOf("root.addEventListener('click',e=>{"),js.indexOf("root.addEventListener('keydown',e=>{"));
assert.ok(events.includes("if(action==='toggle-library-card')"),'Click should toggle, not open reader');
assert.ok(js.includes("state.libraryOpenId=state.libraryOpenId===card.dataset.song?null:card.dataset.song"),'Keyboard should toggle');
const mass=js.slice(js.indexOf('function massDetailHTML()'),js.indexOf('const OCR_JS_URL='));
assert.ok(mass.includes('data-action="read-mass-song"'),'Mass behavior must remain unchanged');
console.log('OK: compact closed cards, four aligned actions, one open card at a time, keyboard and Mass isolation.');
