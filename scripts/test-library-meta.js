const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'App script missing');
new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:23});

function pick(begin,end){
 const a=js.indexOf(begin),b=js.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,'Missing '+begin);
 return js.slice(a,b);
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const song={id:'song1',title:'Benedetto sei Signore',author:'Autore originale',key:'SOL',subtitle:'Canto di lode',verified:false,sections:[{name:'STROFA'}]};
const libraryContext={store:{songs:[song]},state:{filter:''},escape,escapeAttr:escape,CATHOLIC_CORNER:'<svg></svg>',inferSongKey:()=> 'SOL'};
vm.runInNewContext(pick('function libraryHTML(){','function massDateDisplay(')+'this.makeLibrary=libraryHTML;',libraryContext);
const libraryCollapsed=libraryContext.makeLibrary();
assert.ok(!libraryCollapsed.includes('data-action="add-to-mass"'),'Collapsed cards hide all actions');
assert.ok(!libraryCollapsed.includes('data-action="ask-delete-song"'),'Collapsed cards hide delete');
assert.ok(libraryCollapsed.includes('data-action="toggle-library-card"'));
libraryContext.state.libraryOpenId=song.id;
const library=libraryContext.makeLibrary();
assert.ok(library.includes('Benedetto sei Signore'));
assert.ok(library.includes('class="cover-author">(Autore originale)</div>'), 'Library credit should follow title in parentheses');
assert.ok(library.includes('library-card-actions-only'));
for(const label of ['Alla messa','Esporta','Crea PDF','Apri brano'])assert.ok(library.includes(label));
for(const missing of ['<div class="meta-row">','<span class="pill">','Da verificare','Canto di lode ·','Autore originale ·'])assert.ok(!library.includes(missing),'Unexpected card metadata: '+missing);
assert.equal((library.match(/data-action="(?:add-to-mass|export-song|card-pdf)"/g)||[]).length,3);

const modalContext={state:{modal:{type:'song-options'},shift:0,songMetaDraft:{songId:song.id,title:'Nuovo & titolo',author:'Autore modificato'}},currentSong:()=>song,escape,escapeAttr:escape,describeTonality:()=> 'SOL maggiore'};
vm.runInNewContext(pick('function modalHTML(){','function readerCharRect(')+'this.makeModal=modalHTML;',modalContext);
const menu=modalContext.makeModal();
const a=menu.indexOf('class="song-transport"'),b=menu.indexOf('class="song-meta-edit"'),c=menu.indexOf('class="song-options-grid"');
assert.ok(a>=0&&b>a&&c>b,'Title and author must immediately follow tonal controls');
assert.ok(!menu.includes('song-key-analysis-trigger'),'Obsolete tonality-analysis button should be absent');
assert.ok(!menu.includes('song-review-notice'),'Obsolete chord-review banner should be absent');
assert.equal((menu.match(/class="song-option-tile"/g)||[]).length,6,'Keep the 2x3 settings grid');
assert.ok(menu.includes('id="songTitleEdit"')&&menu.includes('id="songAuthorEdit"'));
assert.ok(menu.includes('value="Nuovo &amp; titolo"'));
assert.ok(menu.includes('value="Autore modificato"'));
modalContext.state.shift=1;
assert.ok(modalContext.makeModal().includes('value="Nuovo &amp; titolo"'),'Draft lost on transpose');

const handler=pick("  if(action==='save-song'){"," if(action==='show-key-analysis')");
const save=new Function('action','currentSong','state','root','saveStore','store','notify',handler);
const fields={querySelector:sel=>({value:sel==='#songTitleEdit'?'  Nuovo titolo  ':'  Mario Rossi  '})};
const state={modal:{type:'song-options'},songMetaDraft:{songId:song.id,title:'',author:''}};
let n=0;
save('save-song',()=>song,state,fields,()=>{n++;return true;},{},()=>{});
assert.equal(n,1);
assert.equal(song.title,'Nuovo titolo');
assert.equal(song.author,'Mario Rossi');
assert.equal(state.modal,null);
assert.equal(state.songMetaDraft,null);

const original={title:song.title,author:song.author,savedAt:song.savedAt};
save('save-song',()=>song,{modal:{type:'song-options'}},{querySelector:()=>({value:'    '})},
 ()=>{throw new Error('Invalid save was called');},{},()=>{});
assert.equal(song.title,original.title);
const failed={modal:{type:'song-options'}};
save('save-song',()=>song,failed,{querySelector:sel=>({value:sel==='#songTitleEdit'?'Different':'Different Author'})},()=>false,{},()=>{});
assert.deepEqual({title:song.title,author:song.author,savedAt:song.savedAt},original);
assert.equal(failed.modal.type,'song-options');
assert.ok(fs.readFileSync('sw.js','utf8').includes('cantoria-shell-v1.1-build23'));
assert.ok(html.includes('/* Cantoria 1.1 (6) — compact library cards'));
console.log('Cantoria build 6 library compactness and song metadata tests passed');

assert.ok(html.includes('/* Cantoria 1.1 (8): centered song-settings title */'));
assert.ok(html.includes('grid-template-columns:40px minmax(0,1fr) 40px!important'));
assert.ok(html.includes('.song-options-compact .song-options-header>h2{grid-column:2'));
assert.ok(html.includes('text-align:center!important'));
console.log('Centered modal header validated.');

const cleaned=html.slice(html.indexOf("if(m.type==='song-options')"),html.indexOf("if(m.type==='photo-source')"));
assert.ok(cleaned.includes('aria-label="Titolo del brano"'));
assert.ok(cleaned.includes('aria-label="Autore o compositore"'));
assert.ok(!cleaned.includes('<span>Titolo</span>'));
assert.ok(!cleaned.includes('<span>Autore</span>'));
assert.equal((cleaned.match(/class="song-option-tile"/g)||[]).length,6);
console.log('Visible title/author labels removed, accessible editable fields retained.');

const cardCSS=html.slice(html.indexOf('/* Cantoria 1.1 (10): truly centered library song title'));
assert.ok(cardCSS.includes('padding:11px 16px!important'),'Card must have symmetrical horizontal padding');
assert.ok(cardCSS.includes('place-items:center!important'),'Card content must center across its whole width');
assert.ok(cardCSS.includes('text-align:center!important'),'Title text must stay centered');
assert.ok(cardCSS.includes('width:100%!important'),'Title must fill the full card width');
console.log('Library song titles centered independently of decorative corner.');
