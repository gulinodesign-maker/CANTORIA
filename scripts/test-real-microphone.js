const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const a=require('../audio-follow.js');
const code=fs.readFileSync('audio-follow.js','utf8');
assert.deepEqual(require('../release.json'),{version:'1.1',build:43});
const rate=44100,fft=8192;
const tones=[
 ['DO',[261.63,329.63,392]],['SOL',[196,246.94,293.66]],
 ['LA-',[220,261.63,329.63]],['RE4',[293.66,392,440]]
];
function binsFor(frequencies,level,partials=1){
 const bins=new Uint8Array(fft/2);
 for(const frequency of frequencies)for(let h=1;h<=partials;h++){
  const n=Math.round(frequency*h*fft/rate);
  if(n<bins.length)bins[n]=Math.max(bins[n],Math.round(level/Math.pow(h,.45)));
 }
 return bins;
}
for(const [label,frequencies] of tones){
 for(const level of [52,60,75]){
  const chroma=a.chromaFromFFT(binsFor(frequencies,level),rate,fft);
  const expected=a.recognizeExpectedChord(chroma,label,[label]);
  assert.equal(expected?.chord,a.parseChord(label).label,
    'Weak spectrum ('+level+'/255) must detect '+label);
  if(label==='DO'||label==='SOL'||label==='LA-')assert.ok(a.diagnoseChroma(chroma),
    'Settings must show chord for '+label+' at '+level+'/255');
 }
}
const withOvertones=a.chromaFromFFT(binsFor([130.81,164.81,196],120,4),rate,fft);
assert.equal(a.diagnoseChroma(withOvertones)?.chord,'DO','Piano/guitar harmonics must be recognized');
const single=a.chromaFromFFT(binsFor([261.63],95,4),rate,fft);
assert.equal(a.diagnoseChroma(single),null,'A single pitched note must not be labeled as a major chord');
assert.equal(a.diagnoseChroma(Array(12).fill(0)),null,'Silence is not a chord');

let samples=[261.63,329.63,392],amplitude=52,tasks=[],events=[],stops=0;
class AudioContext{
 constructor(){this.state='running';this.sampleRate=rate;}
 createAnalyser(){return {fftSize:fft,frequencyBinCount:fft/2,
  getByteFrequencyData(b){b.set(binsFor(samples,amplitude,4));},
  getByteTimeDomainData(b){b.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){}
}
const fake={AudioContext,document:{querySelector(){return null;},querySelectorAll(){return [];}},
 navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){stops++}}];}};}}},
 setTimeout(fn){tasks.push(fn);return tasks.length},clearTimeout(){},requestAnimationFrame(fn){fn()}};
vm.runInNewContext(code,{window:fake,module:{exports:{}}});
const live=fake.CantoriaAudioFollow;
(async()=>{
 await live.startDiagnostic(x=>events.push(x));
 assert.equal(live.mode,'diagnostic');
 for(let i=0;i<4;i++){const fn=tasks.shift();assert.ok(fn);fn();}
 assert.equal(events.at(-1).chord,'DO','Settings must display DO using quiet spectrum and harmonics');
 assert.ok(events.at(-1).level>0);
 assert.ok(events.at(-1).notes.includes('DO'));
 samples=[196,246.94,293.66];amplitude=59;
 for(let i=0;i<5;i++){const fn=tasks.shift();assert.ok(fn);fn();}
 assert.equal(events.at(-1).chord,'SOL','Settings must update from DO to SOL');
 samples=[];amplitude=0;
 for(let i=0;i<4;i++){const fn=tasks.shift();assert.ok(fn);fn();}
 assert.match(events.at(-1).message,/Nessun segnale/);
 live.stopDiagnostic();assert.equal(stops,1);assert.equal(live.mode,'idle');
 console.log('PASS: quiet microphone FFT and harmonic-rich chords detected in Settings');
})().catch(e=>{console.error(e);process.exitCode=1;});
