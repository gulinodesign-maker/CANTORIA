const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('audio-follow.js','utf8');
const release=require('../release.json');assert.deepEqual(release,{version:'1.1',build:36});
assert.ok(source.includes('stableCount>=(candidate.skipped?4:2)'),'Audio follow must lock after two consecutive detections');
assert.ok(source.includes('root.setTimeout(detect,80)'),'Poll interval should be 80 ms');
assert.ok(source.includes('lastAdvance<(repeated?320:130)'),'Guard for fast transitions must depend on repetition');
assert.ok(source.includes('smoothingTimeConstant=.34'),'FFT must avoid excessive historic smoothing');
assert.ok(source.includes('chromaHistory.length>4'),'Rolling chord memory must not delay follow-up chord');
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
 setTimeout(fn,ms){assert.equal(ms,80,'Audio follow must run at fast cadence');timers.push(fn);return timers.length;},
 clearTimeout(){},requestAnimationFrame(fn){fn();}
};
vm.runInNewContext(source,{window,Date:{now(){return now;}},module:{exports:{}}});
const follow=window.CantoriaAudioFollow;
function frame(){now+=80;const fn=timers.shift();assert.ok(fn,'Microphone frame must be scheduled');fn();}
(async()=>{
 const pages=[];
 follow.setScore('track',[
  {id:'sol',label:'SOL',page:0},{id:'do',label:'DO',page:0},
  {id:'la',label:'LA-',page:1},{id:'re',label:'RE',page:1}],page=>pages.push(page));
 await follow.microphone();
 assert.equal(follow.activeIndex,-1);
 frame();assert.equal(follow.activeIndex,0,'Initial SOL should be accepted after two frames');
 const solAt=now;
 notes=[262,330,392];frame();frame();
 assert.equal(follow.activeIndex,1,'DO should be recognized quickly after SOL');
 assert.ok(now-solAt<=240,'New chord detection must happen in at most 240ms');
 const doAt=now;
 notes=[440,262,330];frame();frame();
 assert.equal(follow.activeIndex,2,'LA minor must be recognized immediately after DO');
 assert.ok(now-doAt<=240);
 assert.equal(pages.at(-1),1);
 notes=[262,330,392];frame();frame();
 assert.equal(follow.activeIndex,2,'Wrong DO must not jump ahead to RE');
 notes=[294,370,440];frame();frame();
 assert.equal(follow.activeIndex,3,'RE should follow after prior wrong chord is ignored');
 assert.equal(follow.mode,'mic');
 follow.stop();assert.equal(tracksStopped,1);
 console.log('PASS: two-frame microphone lock, rapid consecutive chords, strict order, page switching');
})().catch(error=>{console.error(error);process.exitCode=1;});
