const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Inline JS must exist');new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:34});
const start=js.indexOf('function removeLyricSelection('),end=js.indexOf('function syllableModalHTML(',start);
assert.ok(start>=0&&end>start);
const env={};vm.runInNewContext(js.slice(start,end)+'\nthis.del=removeLyricSelection;',env);
const apply=(line,slot,kind)=>env.del(line,slot,kind);
const original={marked:'Be|ne|det|to sei Si|gno|re,',
 anchors:[{slot:0,chord:'DO',verified:true},{slot:1,chord:'RE'},{slot:3,chord:'MI'},{slot:5,chord:'SOL',verified:true},{slot:6,chord:'FA'}]};
let result=apply(original,1,'syllable');
assert.equal(result.marked,'Be|det|to sei Si|gno|re,');
assert.deepEqual(Array.from(result.anchors,x=>x.slot),[0,2,4,5]);
assert.deepEqual(Array.from(result.anchors,x=>x.chord),['DO','MI','SOL','FA']);
assert.equal(result.removeLine,false);
assert.equal(result.removedText,'ne');
assert.equal(result.anchors[0].needsReview,true);
assert.equal(result.anchors[0].anchorCharacterIndex,null);
assert.equal(result.anchors[0].verified,false);
assert.equal(original.marked,'Be|ne|det|to sei Si|gno|re,','Deletion helper cannot mutate source');
result=apply(original,5,'word');
assert.equal(result.marked,'Be|ne|det|to sei');
assert.deepEqual(Array.from(result.anchors,x=>x.slot),[0,1,3]);
assert.deepEqual(Array.from(result.anchors,x=>x.chord),['DO','RE','MI']);
assert.equal(result.removedText,'Signore,');
const middle={marked:'A|gnel|lo di Di|o',anchors:[{slot:0,chord:'DO'},{slot:3,chord:'FA'},{slot:4,chord:'LA-'},{slot:5,chord:'SOL'}]};
result=apply(middle,3,'word');
assert.equal(result.marked,'A|gnel|lo Di|o');
assert.deepEqual(Array.from(result.anchors,x=>x.slot),[0,3,4]);
assert.deepEqual(Array.from(result.anchors,x=>x.chord),['DO','LA-','SOL']);
result=apply({marked:'Solo',anchors:[{slot:0,chord:'DO'}]},0,'word');
assert.equal(result.marked,'');assert.equal(result.removeLine,true);
assert.equal(result.anchors.length,0);
result=apply({marked:'Solo',anchors:[{slot:0,chord:'DO'}]},0,'syllable');
assert.equal(result.removeLine,true);
assert.throws(()=>apply(original,99,'word'),/Sillaba non trovata/);
assert.throws(()=>apply(original,0,'other'),/non valida/);

const dialog=js.slice(js.indexOf('function syllableModalHTML('),js.indexOf('function songInfoEditor('));
for(const token of ['id="syllableEditForm"','data-action="delete-lyric-syllable"',
 'data-action="delete-lyric-word"','Elimina sillaba','Elimina parola',
 'data-action="close-modal"'])assert.ok(dialog.includes(token),token);
const modal=js.slice(js.indexOf('function modalHTML()'),js.indexOf('function readerCharRect('));
for(const token of ["m.type==='delete-lyric-confirm'",'data-action="cancel-delete-lyric"',
 'data-action="confirm-delete-lyric"'])assert.ok(modal.includes(token),token);
const handlers=js.slice(js.indexOf("root.addEventListener('click',e=>{"),
 js.indexOf("root.addEventListener('submit',e=>{e.preventDefault();"));
for(const token of ["if(action==='delete-lyric-syllable'||action==='delete-lyric-word')",
 "if(action==='cancel-delete-lyric')","if(action==='confirm-delete-lyric')",
 "result.removeLine","sec.lines.splice(m.li,1)","line.anchors=result.anchors",
 "if(!saveStore(store)){sec.lines=previous;"])assert.ok(handlers.includes(token),token);
assert.ok(html.includes('/* CANTORIA 1.1 (29)'));
console.log('PASS: remove syllable or whole word, reindex chords, remove empty line, confirm and rollback.');
