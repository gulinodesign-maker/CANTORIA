const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const editor=require('../score-editor.js');

assert.equal(editor.PALETTE.length,9);
assert.ok(editor.PALETTE.some(p=>p.value==='#bfd7e7'));
assert.ok(editor.PALETTE.some(p=>p.value==='#ffc9a5'));
assert.equal(editor.bandColor({},'verse'),'#e5e5df');
const song={sections:[],bandColors:{}};
editor.setBandColor(song,'intro','#dfe4dc');
editor.setBandColor(song,'chorus','#e8e2da');
assert.equal(editor.bandColor(song,'intro'),'#dfe4dc');
assert.equal(editor.bandColor(JSON.parse(JSON.stringify(song)),'chorus'),'#e8e2da');
assert.throws(()=>editor.setBandColor(song,'verse','url(https://invalid.example)'),/Colore/);
assert.throws(()=>editor.setBandColor(song,'bridge','#e5e5df'),/Colore/);

const colorSong={
 bandColors:{verse:'#e8e2da',intro:'#dee4e8',outro:'#dfe4dc'},
 sections:[
  {kind:'intro',chordsOnly:['SOL','DO'],lines:[]},
  {kind:'verse',lines:[
   {marked:'Primo verso',anchors:[]},{marked:'Secondo verso',anchors:[]}
  ]},
  {kind:'outro',lines:[],chordRows:[['RE','SOL'],['DO']]}
 ]
};
assert.equal(editor.rowBandColor(colorSong,1,0),'#e8e2da');
editor.setRowBandColor(colorSong,1,0,undefined,'#e5e5df');
assert.equal(editor.rowBandColor(colorSong,1,0),'#e5e5df');
assert.equal(editor.rowBandColor(colorSong,1,1),'#e8e2da','Only ONE pill changes');
editor.setRowBandColor(colorSong,0,undefined,-1,'#d8dad6');
assert.equal(editor.rowBandColor(colorSong,0,undefined,-1),'#d8dad6');
editor.setRowBandColor(colorSong,2,undefined,0,'#e8e2da');
assert.equal(editor.rowBandColor(colorSong,2,undefined,0),'#e8e2da');
assert.equal(editor.rowBandColor(colorSong,2,undefined,1),'#dfe4dc');
const persistedColor=JSON.parse(JSON.stringify(colorSong));
assert.equal(editor.rowBandColor(persistedColor,1,0),'#e5e5df',
 'Per-pill color must survive export/import/reopen');
assert.equal(editor.rowBandColor(persistedColor,0,undefined,-1),'#d8dad6');
editor.setRowBandColor(colorSong,1,0,undefined,'');
assert.equal(editor.rowBandColor(colorSong,1,0),'#e8e2da',
 'Reset restores section theme without affecting other rows');
assert.equal(editor.rowBandOverride(colorSong,1,0),null);
assert.throws(()=>editor.setRowBandColor(colorSong,1,0,undefined,'red'),/Colore/);
assert.throws(()=>editor.setRowBandColor(colorSong,1,99,undefined,'#e5e5df'),/Riga/);
assert.throws(()=>editor.setRowBandColor(colorSong,2,undefined,9,'#e5e5df'),/Riga/);

assert.equal(editor.visibleLyric('Be|ne|det|to sei Si|gno|re'),'Benedetto sei Signore');

const line={marked:'Be|ne|det|to sei Si|gno|re',anchors:[
 {slot:2,chord:'SOL2',sourceX:90,anchorCharacterIndex:4,sourceCharWidth:12,offsetX:2,verified:true,needsReview:false},
 {slot:6,chord:'SOL',sourceX:279,anchorCharacterIndex:16,sourceCharWidth:12,offsetX:4,verified:true,needsReview:false}
]};
assert.equal(editor.editLine(line,'Benedetto sei Signore'),false,
 'Opening the editor without changes must preserve syllable anchors');
assert.equal(line.marked,'Be|ne|det|to sei Si|gno|re');
assert.equal(line.anchors[0].verified,true);
assert.equal(editor.editLine(line,'Benedetto sei il Signore'),true);
assert.equal(line.marked,'Benedetto sei il Signore');
assert.deepEqual(line.anchors.map(a=>a.chord),['SOL2','SOL']);
assert.deepEqual(line.anchors.map(a=>a.sourceX),[90,279]);
assert.ok(line.anchors.every(a=>a.needsReview&&!a.verified&&a.anchorCharacterIndex===null));
assert.ok(line.anchors.every(a=>a.slot>=0&&a.slot<editor.syllableCount(line.marked)));
assert.equal(editor.editLine(line,'Re'),true);
assert.ok(line.anchors.every(a=>a.slot===0));
assert.throws(()=>editor.editLine(line,'  '),/riga/);
assert.throws(()=>editor.editLine(line,'troppo\ntesto'),/riga/);

const section={name:'STROFA',lines:[
 {marked:'Tu sei qui',anchors:[{slot:1,chord:'DO',sourceX:88}]},
 {marked:'Nella mia vita',anchors:[{slot:2,chord:'RE',sourceX:173}]}
]};
const changed=editor.editSection(section,'Tu sei con me\nNella tua vita');
assert.equal(changed,2);
assert.equal(section.lines[0].marked,'Tu sei con me');
assert.equal(section.lines[1].marked,'Nella tua vita');
assert.equal(section.lines[0].anchors[0].chord,'DO');
const backup=JSON.stringify(section);
assert.throws(()=>editor.editSection(section,'Testo errato\n'),/riga/);
assert.equal(JSON.stringify(section),backup,'Invalid section must roll back completely');
assert.throws(()=>editor.editSection(section,'Una sola riga'),/Mantieni/);

const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'Inline script missing');
new vm.Script(match[1]);
for(const tag of ['score-editor.js','lyricEditForm','sectionTextEditForm','bandColorsForm',
 'data-action="choose-section-text"','data-action="band-colors"','data-section="${si}" data-line="${li}"']){
 assert.ok(html.includes(tag),tag+' not wired');
}
assert.ok(!html.includes('fitReaderRows()'),'Per-row font shrinking must be removed');
assert.ok(!html.includes('font-=.5'),'Old font reducing loop must be removed');
assert.ok(html.includes('font-size:var(--reader-font)!important'),
 'Every lyric line must have the same font size');
assert.ok(html.includes('a.unresolved?\'<span class="unresolved-spot"'),
 'OCR question marks should not appear as chord text');
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-editor.js'"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-editor.js'));
assert.ok(html.includes('function rowBandColorModal(m)'), 'Row-specific color picker is wired');
assert.ok(html.includes("m.type==='row-band-color'"));
assert.ok(html.includes("editor.setRowBandColor(song,m.si,m.li,m.rowIndex,color)"));
assert.ok(html.includes("action==='reset-row-band-color'"));
assert.ok(html.includes('data-action="apply-row-band-color"'));
console.log('OK: lyric editing, musical anchors, sections, palette, uniform text and iOS assets');
