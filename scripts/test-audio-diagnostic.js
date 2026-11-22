const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync('audio-follow.js','utf8');
const audio=require('../audio-follow.js');
const release=require('../release.json');
assert.deepEqual(release,{version:'1.1',build:46});
new vm.Script(source);
const inner=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inner,'Inline app script missing');new vm.Script(inner);
const settings=inner.slice(inner.indexOf('function settingsHTML()'),inner.indexOf('function appHTML()'));
for(const token of ['Diagnosi riconoscimento accordi','data-action="diagnostic-start"',
 'data-action="diagnostic-stop"','id="diagnosticChord"','id="diagnosticLevel"',
 'id="diagnosticNotes"','id="diagnosticMatch"'])assert.ok(settings.includes(token),token);
assert.ok(inner.includes('follower.startDiagnostic(updateDiagnosticPanel)'),'Settings start must call actual microphone diagnosis');
assert.ok(inner.includes('window.CantoriaAudioFollow?.stopDiagnostic()'),'Settings stop must close mic');
const reader=inner.slice(inner.indexOf('function readerHTML()'),inner.indexOf('const CATHOLIC_CORNER ='));
assert.ok(reader.includes('data-action="follow-play"'),'Playback toggle must remain');
assert.ok(!reader.includes('reader-chord-nav'),'Manual chord arrows removed from top bar');
assert.ok(reader.includes(' </div>\n <div class="reader-title"'),'Title follows compact transport controls');
const css=html.slice(html.indexOf('/* CANTORIA 1.1 (27)'));
assert.ok(css.includes('@media(orientation:landscape)'));
assert.ok(css.includes('/* CANTORIA 1.1 (45): iPad touch-safe corner, transport layout, refined compact Mass cards.'),'Reader layout protects corner decoration');
assert.ok(css.includes('left:clamp(115px,13vw,170px)!important'),'Mass back is moved right');
assert.ok(css.includes('left:clamp(91px,24vw,135px)!important'),'Portrait reader back clears cross');

const profile=(notes)=>Array.from({length:12},(_,i)=>notes.includes(i)?1/notes.length:.0001);
for(const [expected,notes] of [['DO',[0,4,7]],['LA-',[9,0,4]],['SOL',[7,11,2]],['RE-',[2,5,9]]]){
 assert.equal(audio.diagnoseChroma(profile(notes))?.chord,expected,expected+' triad should be recognized');
}
assert.equal(audio.diagnoseChroma(Array(12).fill(0)),null,'Silence must not yield a chord');
assert.equal(audio.diagnoseChroma(profile([0])),null,'Single note must not become a chord');

let tasks=[],received=[],stopped=0,requested=0,notes=[261.63,329.63,392];
class FakeContext{
 constructor(){this.state='running';this.sampleRate=44100;}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(buffer){buffer.fill(0);for(const hz of notes)buffer[Math.round(hz*8192/44100)]=255;},
  getByteTimeDomainData(buffer){buffer.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){}
}
const fakeWindow={
 document:{querySelector(){return null;},querySelectorAll(){return [];}},
 AudioContext:FakeContext,
 navigator:{mediaDevices:{async getUserMedia(){requested++;return {getTracks(){return [{stop(){stopped++}}];}};}}},
 setTimeout(fn){tasks.push(fn);return tasks.length;},clearTimeout(){},requestAnimationFrame(fn){fn();}
};
vm.runInNewContext(source,{window:fakeWindow,module:{exports:{}},Uint8Array,Float64Array});
const follower=fakeWindow.CantoriaAudioFollow;
(async()=>{
 await follower.startDiagnostic(report=>received.push(report));
 assert.equal(follower.mode,'diagnostic');
 assert.equal(requested,1);
 assert.equal(received[0].phase,'requesting');
 assert.equal(received[1].phase,'listening');
 for(let i=0;i<4;i++){const run=tasks.shift();assert.ok(run,'Expected next microphone frame');run();}
 const detected=received.find(x=>x.chord==='DO');
 assert.ok(detected,'DO major must be displayed after a stable chord');
 assert.deepEqual([...detected.notes],['DO','MI','SOL']);
 assert.ok(detected.level>0,'Signal meter must receive amplitude information');
 notes=[];for(let i=0;i<3;i++){const run=tasks.shift();assert.ok(run);run();}
 assert.ok(received.at(-1).message.includes('Nessun segnale'),'Silence must be diagnosed separately');
 follower.stopDiagnostic();
 assert.equal(follower.mode,'idle');assert.equal(stopped,1);
 assert.equal(received.at(-1).phase,'stopped');
 console.log('PASS: independent settings microphone test detects DO major, signal, notes, and releases mic');

 // A permission rejection must be reported and must leave the mic inactive.
 fakeWindow.navigator.mediaDevices.getUserMedia=async()=>{throw new Error('Permission denied');};
 await assert.rejects(follower.startDiagnostic(()=>{}),/Permission denied/);
 assert.equal(follower.mode,'idle');
 console.log('PASS: microphone permission failures are surfaced and session stops');
})().catch(err=>{console.error(err);process.exitCode=1;});
