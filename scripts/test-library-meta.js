const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'App script missing');
new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:6});

function pick(begin,end){
 const a=js.indexOf(begin),b=js.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,'Missing '+begin);
 return js.slice(a,b);
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const song={id:'song1',title:'Benedetto sei Signore',author:'Autore originale',key:'SOL',subtitle:'Canto di lode',verified:false,sections:[{name:'STROFA'}]};
const libraryContext={store:{songs:[song]},state:{filter:''},escape,escapeAttr:escape,CATHOLIC_CORNER:'<svg></svg>',inferSongKey:()=> 'SOL'};
vm.runInNewContext(pick('function libraryHTML(){','function massDateDisplay(')+'this.makeLibrary=libraryHTML;',libraryContext);
const library=libraryContext.makeLibrary();
assert.ok(library.includes('Benedetto sei Signore'));
assert.ok(library.includes('library-card-actions-only'));
for(const label of ['Alla messa','Esporta','Crea PDF'])assert.ok(library.includes(label));
for(const missing of ['<div class="meta-row">','<span class="pill">','Da verificare','Canto di lode ·','Autore originale ·'])assert.ok(!library.includes(missing),'Unexpected card metadata: '+missing);
assert.equal((library.match(/data-action="(?:add-to-mass|export-song|card-pdf)"/g)||[]).length,3);

const modalContext={state:{modal:{type:'song-options'},shift:0,songMetaDraft:{songId:song.id,title:'Nuovo & titolo',author:'Autore modificato'}},currentSong:()=>song,escape,escapeAttr:escape,describeTonality:()=> 'SOL maggiore'};
vm.runInNewContext(pick('function modalHTML(){','function readerCharRect(')+'this.makeModal=modalHTML;',modalContext);
const menu=modalContext.makeModal();
const a=menu.indexOf('class="song-transport"'),b=menu.indexOf('class="song-meta-edit"'),c=menu.indexOf('class="song-key-analysis-trigger"');
assert.ok(a>=0&&b>a&&c>b,'Title and author must immediately follow tonal controls');
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
assert.ok(fs.readFileSync('sw.js','utf8').includes('cantoria-shell-v1.1-build6'));
assert.ok(html.includes('/* Cantoria 1.1 (6) — compact library cards'));
console.log('Cantoria build 6 library compactness and song metadata tests passed');
