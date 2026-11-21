const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline);new vm.Script(inline);
assert.deepEqual(require('../release.json'),{version:'1.1',build:23});
assert.equal(require('../package.json').version,'1.1.0');
for(const text of ['releaseInfo.build','data-action="follow-source"','data-action="choose-section-text"','data-action="recognize-photo"','data-action="follow-play"','data-action="follow-rewind"','data-follow-chord=','audio-follow.js','library-action-icon','song-options-grid'])assert.ok(html.includes(text),text);
for(const text of ['Apple Intelligence','recognize-apple','cantoriaAI'])assert.ok(!html.includes(text),text);
const prep=fs.readFileSync('scripts/prepare-ios.sh','utf8');
assert.ok(!prep.includes('FoundationModels'));
assert.ok(prep.includes('NSMicrophoneUsageDescription'));
assert.ok(fs.readFileSync('sw.js','utf8').includes('audio-follow.js'));
const audio=require('../audio-follow.js');
assert.equal(audio.parseChord('SOL7').root,7);
assert.equal(audio.parseChord('LA-').minor,true);
assert.equal(audio.parseChord('REb').root,1);
const chroma=Array(12).fill(.002);for(const x of [7,11,2])chroma[x]=.32;
assert.equal(audio.recognizeChord(chroma,['DO','SOL','LA-','RE7']).chord,'SOL');
const wf=fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8');
assert.ok(wf.includes("require('./release.json').build"));
assert.ok(wf.indexOf('Block TestFlight release if iOS starts black')<wf.indexOf('Upload signed IPA to TestFlight'));
console.log('CANTORIA 1.1 (14): UI, audio, OCR and version validated.');

// 1.1 (5): precisely two audio buttons in reader topbar; follow before settings.
const bar=html.slice(html.indexOf('function readerHTML()'),html.indexOf('const CATHOLIC_CORNER ='));
assert.ok(bar.includes('reader-toolbar-left')&&bar.includes('reader-toolbar-right'));
assert.equal((bar.match(/data-action="follow-play"/g)||[]).length,1);
assert.equal((bar.match(/data-action="follow-rewind"/g)||[]).length,1);
assert.ok(bar.indexOf('data-action="follow-source"')<bar.indexOf('data-action="song-options"'));
assert.ok(!bar.includes('audio-follow-bar'));
const menu=html.slice(html.indexOf("if(m.type==='song-options')"),html.indexOf("if(m.type==='photo-source')"));
assert.ok(!menu.includes('Apri PDF')&&!menu.includes('song-options-open-pdf'));
for(const required of ['async function toggle()','function rewind()','function syncControls()'])assert.ok(fs.readFileSync('audio-follow.js','utf8').includes(required));
console.log('OK: compact toolbar and centered song settings.');

/* Build 23: chronological progression, no jumping and no double-counted sustained chords. */
const seq=[{id:'s0-l0-0',label:'SOL',page:0},{id:'s0-l0-1',label:'DO',page:0},
 {id:'s1-l0-0',label:'SOL',page:1},{id:'s1-l0-1',label:'SOL',page:1},
 {id:'s1-l0-2',label:'RE7',page:1}];
assert.equal(audio.nextChordIndex(seq,-1,'DO',true),-1,'First position cannot be skipped');
assert.equal(audio.nextChordIndex(seq,-1,'SOL',false),0);
assert.equal(audio.nextChordIndex(seq,0,'RE7',true),-1,'No jumping to a future page');
assert.equal(audio.nextChordIndex(seq,0,'DO',false),1);
assert.equal(audio.nextChordIndex(seq,1,'SOL',false),2);
assert.equal(audio.nextChordIndex(seq,2,'SOL',false),-1,'Sustained identical chord cannot advance');
assert.equal(audio.nextChordIndex(seq,2,'SOL',true),3,'New attack can advance identical chord');
assert.equal(audio.nextChordIndex(seq,3,'RE7',false),4);
assert.equal(audio.nextChordIndex([{label:'RE'},{label:'RE7'}],0,'RE',true),-1,'Extensions differ');
assert.ok(inline.includes('data-follow-id="s${si}-l${li}-${ai}"'));
assert.ok(inline.includes('followScoreSequence(song,state.shift)'));
const begin=inline.indexOf('function flatEntries(song)'),end=inline.indexOf('function photoReaderHTML(',begin);
assert.ok(begin>=0&&end>begin);
const layout={window:{innerWidth:950,innerHeight:470,CantoriaAudioFollow:{parseChord:audio.parseChord}},
 transposeChord:chord=>chord,Math};
vm.runInNewContext(inline.slice(begin,end)+'\nthis.follow=followScoreSequence;',layout);
const song={sections:[{name:'STROFA',kind:'verse',lines:Array.from({length:20},(_,i)=>({
 marked:'Canto',anchors:[{slot:0,chord:i%2?'DO':'SOL'}]}))},
 {name:'RITORNELLO',kind:'chorus',lines:[{marked:'Finale',anchors:[{slot:0,chord:'RE7'}]}]}]};
const full=layout.follow(song);
assert.equal(full.length,21);
assert.equal(new Set(full.map(x=>x.id)).size,21);
assert.ok(full.some(x=>x.page>0),'Landscape includes off-screen chords');
assert.equal(full[20].label,'RE7','Refrain after entire verse');
assert.ok(full.every((x,i)=>i===0||x.page>=full[i-1].page));
console.log('PASS: strict chronological audio follow, repeat attacks and cross-page sequence');
