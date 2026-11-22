const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);new vm.Script(source);
assert.deepEqual(require('../release.json'),{version:'1.1',build:36});
const audio=require('../audio-follow.js');
for(const [label,root,minor] of [
 ['G',7,false],['C',0,false],['Am',9,true],['F#m',6,true],['Bb',10,false],
 ['SOL2',7,false],['RE4',2,false],['RE⁴',2,false],['FA7+',5,false],['Cmaj7',0,false]
]){
 const parsed=audio.parseChord(label);
 assert.ok(parsed,'Imported chord must parse: '+label);
 assert.equal(parsed.root,root,label);
 assert.equal(parsed.minor,minor,label);
}
assert.deepEqual(audio.parseChord('SOL2').intervals,[0,2,7],'SOL2 must be suspended second');
assert.deepEqual(audio.parseChord('RE⁴').intervals,[0,5,7],'RE⁴ must be suspended fourth');
assert.deepEqual(audio.parseChord('CM7').intervals,[0,4,7,11],'CM7 is major seventh');
assert.equal(audio.parseChord('DONA'),null,'Ordinary words cannot be parsed as chords');
assert.equal(audio.nextChordIndex([{label:'RE⁴'}],-1,'RE4',true),0,'Superscript and ASCII must match');
assert.equal(audio.nextChordIndex([{label:'C'},{label:'DO'}],0,'C',false),-1,'Identical harmonies in alternate notation require a new attack');
assert.equal(audio.nextChordIndex([{label:'C'},{label:'DO'}],0,'DO',true),1);

const lines=[
 {marked:'La voce canta',anchors:[{slot:0,chord:'G'},{slot:1,chord:'C'},{slot:2,chord:'Am'}]},
 {marked:'Vieni Signore',anchors:[{slot:0,chord:'SOL2'},{slot:1,chord:'RE⁴'}]}
];
const payload={format:'cantoria-song',formatVersion:1,song:{
 title:'Brano importato da altra applicazione',source:'import',verified:false,
 sections:[{name:'STROFA',kind:'verse',lines}]
}};
const ctx={structuredClone,window:{innerWidth:980,innerHeight:520,CantoriaAudioFollow:audio},
 CANTORIA_FILE_VERSION:1,
 store:{songs:[],masses:[]},persist(){this.saved=(this.saved||0)+1;},
 refreshDetectedKey(){},makeId(){return 'imported-id-1';},
 NOTE_NAMES:['DO','DO#','RE','MIb','MI','FA','FA#','SOL','LAb','LA','SIb','SI'],
 SEMITONE:{DO:0,RE:2,MI:4,FA:5,SOL:7,LA:9,SI:11},
 state:{shift:0},Math,Number,String,Array};
function fragment(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[
 fragment('function parseSyllables(','function chordLineCount('),
 fragment('function importSongFile(text){','function makeId()'),
 fragment('function flatEntries(song)','function pageList(song){')
].join('\n');
ctx.pageList=song=>{
 const items=ctx.flatEntries(song);
 return [[items.slice(0,1)],[items.slice(1)]];
};
vm.runInNewContext(code+'\nthis.imported=importSongFile;this.follow=followScoreSequence;this.flatEntries=flatEntries;this.transpose=transposeChord;',ctx);
const imported=ctx.imported(JSON.stringify(payload));
assert.equal(imported.id,'imported-id-1');
assert.equal(ctx.store.songs.length,1);
assert.equal(ctx.store.songs[0].source,'import','Imported origin must not block microphone follow');
assert.equal(imported.sections[0].lines[0].anchors.length,3);
const seq=Array.from(ctx.follow(imported),e=>({id:e.id,label:e.label,page:e.page}));
assert.deepEqual(seq.map(e=>e.label),['G','C','Am','SOL2','RE⁴']);
assert.ok(seq.some(e=>e.page===1),'Imported score must follow offscreen pages');
assert.equal(new Set(seq.map(e=>e.id)).size,seq.length);
assert.equal(audio.parseChord(ctx.transpose('C/G',2)).root,2,'English slash chords must transpose');
assert.equal(audio.parseChord(ctx.transpose('Am',2)).root,11);
assert.equal(audio.parseChord(ctx.transpose('F#m',2)).minor,true);

let frames=[],notes=[196,246.94,293.66],waveFill=128,now=1000,stopped=0;
class MockAudioContext {
 constructor(){this.state='running';this.sampleRate=44100;}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(b){b.fill(0);for(const hz of notes)b[Math.round(hz*8192/44100)]=58;},
  getByteTimeDomainData(b){b.fill(waveFill);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){}
}
const fake={
 document:{querySelector(){return null;},querySelectorAll(){return [];}},
 AudioContext:MockAudioContext,
 navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){stopped++}}]}};}}},
 setTimeout(fn){frames.push(fn);return frames.length;},clearTimeout(){},
 requestAnimationFrame(fn){fn();}
};
const audioSource=fs.readFileSync('audio-follow.js','utf8');
vm.runInNewContext(audioSource,{window:fake,Date:{now(){return now;}},module:{exports:{}}});
const follower=fake.CantoriaAudioFollow;
(async()=>{
 const pages=[];
 follower.setScore(imported.id,seq,page=>pages.push(page));
 await follower.microphone();
 assert.equal(follower.mode,'mic');
 assert.equal(follower.activeIndex,-1);
 function frame(){now+=80;const fn=frames.shift();assert.ok(fn);fn();}
 frame();frame();
 assert.equal(follower.activeIndex,0,'Imported G must start from microphone using weak real-time FFT');
 notes=[261.63,329.63,392];frame();frame();
 assert.equal(follower.activeIndex,1,'Imported C must follow G');
 notes=[220,261.63,329.63];frame();frame();
 assert.equal(follower.activeIndex,2,'Imported Am must follow C');
 notes=[196,220,293.66];frame();frame();
 assert.equal(follower.activeIndex,3,'Imported SOL2 must recognize suspended second');
 // SOL2 and RE4 share the same pitch classes; a fresh attack distinguishes them.
 notes=[293.66,392,440];waveFill=169;frame();frame();
 assert.equal(follower.activeIndex,4,'Imported RE⁴ must recognize suspended fourth');
 assert.equal(pages.at(-1),1);
 follower.stop();assert.equal(stopped,1);
 console.log('PASS: imported Cantoria song with English and suspended chords follows via microphone');
})().catch(err=>{console.error(err);process.exitCode=1;});
