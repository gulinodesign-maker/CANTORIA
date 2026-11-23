const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline);new vm.Script(inline);
assert.deepEqual(require('../release.json'),{version:'1.1',build:54});
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
assert.ok(!wf.includes('run: bash scripts/verify-ios-launch.sh'),'No mandatory iPhone simulator in release');
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

/* Build 24: manual chord navigation and visual microphone capture state. */
assert.equal(audio.stepChordIndex(seq,-1,-1),-1);
assert.equal(audio.stepChordIndex(seq,-1,1),0);
assert.equal(audio.stepChordIndex(seq,0,-1),0);
assert.equal(audio.stepChordIndex(seq,2,-1),1);
assert.equal(audio.stepChordIndex(seq,2,1),3);
assert.equal(audio.stepChordIndex(seq,4,1),4);
assert.equal(audio.stepChordIndex([],0,1),0);
const reader=html.slice(html.indexOf('function readerHTML()'),html.indexOf('const CATHOLIC_CORNER ='));
for(const action of ['follow-prev-chord','follow-next-chord'])assert.equal((reader.match(new RegExp('data-action="'+action+'"','g'))||[]).length,0,'Remove chord toolbar arrow '+action);
assert.ok(!inline.includes("window.CantoriaAudioFollow?.step(action==='follow-prev-chord'?-1:1)"));
assert.ok(html.includes('reader-follow-btn[data-listening="true"]'));
assert.ok(html.includes('orientation:portrait')&&html.includes('.reader-chord-nav'));
const audioSource=fs.readFileSync('audio-follow.js','utf8');
const micButton={disabled:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v}};
const prevButton={disabled:false},nextButton={disabled:false};
const fakeDocument={
 querySelector(selector){if(selector==='#readerLayer .reader-follow-btn')return micButton;
  if(selector.includes('follow-prev-chord'))return prevButton;
  if(selector.includes('follow-next-chord'))return nextButton;return null;},
 querySelectorAll(){return [];}
};
let captured=0,stopped=0;
class FakeAudioContext{
 constructor(){this.state='running';this.sampleRate=44100;}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(b){b.fill(0);},getByteTimeDomainData(b){b.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){}
}
const fakeWindow={
 document:fakeDocument,AudioContext:FakeAudioContext,
 navigator:{mediaDevices:{async getUserMedia(){captured++;return {getTracks(){return [{stop(){stopped++}}]}};}}},
 setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(cb){cb();}
};
vm.runInNewContext(audioSource,{window:fakeWindow,module:{exports:{}}});
const follower=fakeWindow.CantoriaAudioFollow;
(async()=>{
 const pageHistory=[];
 follower.setScore('song-a',seq,page=>pageHistory.push(page));follower.refresh();
 assert.equal(follower.step(1),true);
 assert.equal(follower.activeIndex,0);
 assert.equal(follower.step(1),true);
 assert.equal(follower.activeIndex,1);
 assert.equal(follower.step(-1),true);
 assert.equal(follower.activeIndex,0);
 assert.equal(follower.step(-1),false);
 assert.equal(follower.activeIndex,0);
 assert.equal(micButton.dataset.listening,'false');
 await follower.microphone();
 assert.equal(captured,1);
 assert.equal(follower.mode,'mic');
 assert.equal(follower.activeIndex,-1,'The microphone arms the first chord instead of resuming a previous position');
 assert.equal(micButton.dataset.listening,'true');
 assert.equal(micButton.dataset.waiting,'true');
 assert.equal(micButton.attributes['aria-pressed'],'true');
 assert.equal(follower.step(1),true);
 assert.equal(follower.step(1),true);
 assert.equal(follower.step(1),true);
 assert.equal(follower.activeIndex,2);
 assert.equal(pageHistory.at(-1),1,'Manual stepping must advance to the next page');
 assert.equal(follower.mode,'mic','Manual stepping must not stop microphone capture');
 follower.stop();
 assert.equal(stopped,1);
 assert.equal(micButton.dataset.listening,'false');
 assert.equal(micButton.attributes['aria-pressed'],'false');
 follower.rewind();assert.equal(follower.activeIndex,-1);
 console.log('PASS: manual back/forward across score pages without stopping a live microphone');
})().catch(err=>{console.error(err);process.exitCode=1});

/* Build 25: recover actual microphone recognition when global matching is ambiguous. */
const actualDo=Array(12).fill(.001);for(const [note,level] of [[0,.27],[4,.25],[7,.16],[9,.28]])actualDo[note]=level;
const oldWinner=audio.recognizeChord(actualDo,['SOL','DO','LA-','FA','MI-','RE7']);
assert.notEqual(oldWinner.chord,'DO','Fixture must reproduce original global-ranking regression');
assert.equal(audio.recognizeExpectedChord(actualDo,'DO',['SOL','DO','LA-','FA','MI-','RE7']).chord,'DO',
 'Complete target triad must be accepted despite a higher-ranking unrelated template');
const actualLa=Array(12).fill(.001);for(const note of [9,0,4])actualLa[note]=.32;
assert.equal(audio.recognizeExpectedChord(actualLa,'DO',['SOL','DO','LA-']),null,
 'Cannot accept an unrelated chord that shares only two target notes');
assert.equal(audio.recognizeExpectedChord(Array(12).fill(0),'DO',['DO']),null,'Silence is not a chord');
const actualRe=Array(12).fill(.001);for(const note of [2,6,9])actualRe[note]=.32;
assert.equal(audio.recognizeExpectedChord(actualRe,'RE7',['RE','RE7']).chord,'RE7',
 'A complete major triad supports a seventh-labelled target when the seventh is omitted');
assert.equal(audio.parseChord('FA7+').intervals.at(-1),11,'FA7+ must have a major seventh');
assert.ok(audioSource.includes('changeDrivenCandidate(scoreItems,activeIndex,chroma,markedChroma,Date.now()-lastAdvance'), 'Live follow must detect harmonic change without matching each next label');

// Integration: simulate frequency bins received by a live microphone over time.
let clock=0,notes=[392,494,587],scheduled=[],pages=[];
class LiveContext {
 constructor(){this.state='running';this.sampleRate=44100;}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(buffer){buffer.fill(0);for(const hz of notes)buffer[Math.round(hz*8192/44100)]=255;},
  getByteTimeDomainData(buffer){buffer.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){}
}
const liveWindow={
 document:fakeDocument,AudioContext:LiveContext,
 navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){}}]}};}}},
 setTimeout(fn){scheduled.push(fn);return scheduled.length;},
 clearTimeout(){},requestAnimationFrame(fn){fn();}
};
const clockDate={now(){return clock;}};
vm.runInNewContext(audioSource,{window:liveWindow,Date:clockDate,module:{exports:{}}});
const live=liveWindow.CantoriaAudioFollow;
const feed=ticks=>{for(let k=0;k<ticks;k++){clock+=160;const next=scheduled.shift();assert.ok(next,'Audio processing must remain scheduled');next();}};
(async()=>{
 live.setScore('synth',[
  {id:'first',label:'SOL',page:0},{id:'second',label:'DO',page:0},
  {id:'third',label:'LA-',page:1}],page=>pages.push(page));
 await live.microphone();
 feed(3);
 assert.equal(live.activeIndex,0,'First SOL from mic must be detected');
 notes=[294,370,440];feed(5);
 assert.equal(live.activeIndex,1,'New harmonic sound advances once even when it is not the next named chord');
 notes=[262,330,392,440];feed(5);
 assert.equal(live.activeIndex,2,'Next harmonic change advances the score to page 1');
 notes=[440,262,330];feed(5);
 assert.equal(live.activeIndex,2,'At the end of the score no extra step is possible');
 assert.equal(pages.at(-1),1);
 assert.equal(live.mode,'mic','Microphone must remain active');
 live.stop();
 console.log('PASS: synthesized microphone follows consecutive changes without strict chord-name matching');
})().catch(e=>{console.error(e);process.exitCode=1});

/* Build 26: mic starts at first chord and only then starts score; no upload UI. */
assert.ok(!html.includes('<strong>Carica audio</strong>'),'Remove upload option entirely');
assert.ok(!html.includes('id="audioTrackInput"'),'No audio file picker');
assert.ok(!html.includes("if(m.type==='follow-source')"),'Do not show a source-selection modal');
assert.ok(inline.includes("if(follower.mode==='mic'){follower.stop();return;}"));
assert.ok(inline.includes("follower.microphone().catch(err=>notify(err.message))"));
const reader26=inline.slice(inline.indexOf('function readerHTML()'),inline.indexOf('const CATHOLIC_CORNER ='));
assert.ok(reader26.includes(' </div>\n <div class="reader-title"'),'Reader title follows the left transport group directly without chord arrows');
assert.ok(reader26.includes('id="readerVerification"')&&reader26.includes('id="audioFollowStatus"'));
assert.ok(html.includes('/* CANTORIA 1.1 (26)'),'Responsive toolbar correction required');
assert.ok(audioSource.includes('accumulatedChroma('));
assert.ok(audioSource.includes('activeIndex=-1;activeName="";lastAdvance=0;resetListeningWindow();markedChroma=null;refresh();'));
assert.ok(audioSource.includes('In attesa del primo accordo: '));
const fullC=[.001,.001,.001,.001,.001,.001,.001,.001,.001,.001,.001,.001];
for(const n of [0,4,7])fullC[n]=.3;
assert.equal(audio.recognizeExpectedChord(fullC,'DO',['DO','LA-']).chord,'DO');
assert.equal(audio.recognizeExpectedChord(fullC,'SOL',['SOL','DO']),null);
console.log('PASS: the mic is armed from the first chord and the uploader is absent');
