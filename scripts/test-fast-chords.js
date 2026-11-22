const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('audio-follow.js','utf8');
const release=require('../release.json');assert.deepEqual(release,{version:'1.1',build:47});
assert.ok(source.includes('changeDrivenCandidate(scoreItems,activeIndex,chroma,markedChroma'),'Mic and background must follow changes');
assert.ok(source.includes('stableCount>=(candidate.skipped?4:2)'),'Two-frame agreement guards against noise');
assert.ok(source.includes('root.setTimeout(detect,80)'),'Web mic polling stays fast');
assert.ok(source.includes('chromaHistory.length>4'),'Keep recent but bounded chord memory');
let now=1000,timers=[],notes=[392,494,587],tracksStopped=0;
class Context{
 constructor(){this.state='running';this.sampleRate=44100;}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(b){b.fill(0);for(const hz of notes)b[Math.round(hz*8192/44100)]=255;},
  getByteTimeDomainData(b){b.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){}
}
const window={
 document:{querySelector(){return null;},querySelectorAll(){return [];}},
 AudioContext:Context,
 navigator:{mediaDevices:{async getUserMedia(){return {getTracks(){return [{stop(){tracksStopped++;}}];}};}}},
 setTimeout(fn,ms){assert.equal(ms,80);timers.push(fn);return timers.length;},
 clearTimeout(){},requestAnimationFrame(fn){fn();}
};
vm.runInNewContext(source,{window,Date:{now(){return now;}},module:{exports:{}}});
const follow=window.CantoriaAudioFollow;
function frame(){now+=80;const fn=timers.shift();assert.ok(fn,'Mic loop must continue');fn();}
(async()=>{
 const pages=[];
 follow.setScore('track',[
  {id:'sol',label:'SOL',page:0},{id:'do',label:'DO',page:0},
  {id:'la',label:'LA-',page:1},{id:'re',label:'RE',page:1}],page=>pages.push(page));
 await follow.microphone();
 frame();assert.equal(follow.activeIndex,0,'Recognize only the first SOL');
 // Sustaining an identical harmony cannot move the cursor.
 for(let i=0;i<10;i++)frame();
 assert.equal(follow.activeIndex,0,'Repeated FFT samples must not trigger false steps');
 const solAt=now;
 notes=[262,330,392];frame();frame();frame();
 assert.equal(follow.activeIndex,1,'DO chord change must advance');
 assert.ok(now-solAt<=240,'Confirmed change in at most 240 ms');
 notes=[440,262,330];frame();frame();frame();
 assert.equal(follow.activeIndex,2,'LA minor changes harmony from DO');
 assert.equal(pages.at(-1),1,'Score page follows harmonic changes');
 // New live mode intentionally advances even if the sound is NOT the
 // precise next printed chord, to avoid getting stuck during a service.
 notes=[262,330,392];frame();frame();frame();
 assert.equal(follow.activeIndex,3,'Any confirmed new harmony advances one score event');
 for(let i=0;i<6;i++)frame();
 assert.equal(follow.activeIndex,3,'A held chord does not advance again');
 follow.stop();assert.equal(tracksStopped,1);
 console.log('PASS: first chord anchors score; fast stable harmonic changes drive successive steps without name matching');
})().catch(error=>{console.error(error);process.exitCode=1;});
