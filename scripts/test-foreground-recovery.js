const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('audio-follow.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.ok(!html.includes("pagehide',()=>window.CantoriaAudioFollow?.stop()"),
 'Backgrounding Cantoria must never act as Stop');
assert.deepEqual(require('../release.json'),{version:'1.1',build:52});
new vm.Script(source);

let requests=0,stops=0,resumes=0,nextTimer=0;
const docEvents={},appEvents={},timers=new Map(),tracks=[],contexts=[];
class Track{
 constructor(){this.kind='audio';this.readyState='live';this.muted=false;this.events={};}
 addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
 emit(name){for(const fn of this.events[name]||[])fn();}
 stop(){this.readyState='ended';stops++;}
}
class Context{
 constructor(){this.state='running';this.sampleRate=44100;contexts.push(this);}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(b){b.fill(0);},getByteTimeDomainData(b){b.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){resumes++;this.state='running';}
}
const doc={hidden:false,querySelector(){return null;},querySelectorAll(){return [];},
 addEventListener(event,fn){docEvents[event]=fn;}};
const root={document:doc,AudioContext:Context,
 navigator:{mediaDevices:{async getUserMedia(){
  requests++;const track=new Track();tracks.push(track);
  return {getTracks(){return [track]},getAudioTracks(){return [track]}};
 }}},
 addEventListener(event,fn){appEvents[event]=fn;},
 setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},
 clearTimeout(id){timers.delete(id);},requestAnimationFrame(fn){fn();}
};
vm.runInNewContext(source,{window:root,module:{exports:{}}});
const follow=root.CantoriaAudioFollow;
follow.setTolerance(0); // Regression checks recovery with the original rapid two-frame detection.
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
(async()=>{
 follow.setScore('chant',[{id:'a',label:'SOL',page:0},
  {id:'b',label:'DO',page:0},{id:'c',label:'FA',page:1}],()=>{});
 await follow.microphone();
 assert.equal(requests,1);
 assert.equal(follow.step(1),true);
 assert.equal(follow.activeIndex,0);
 assert.equal(timers.size,1);
 doc.hidden=true;docEvents.visibilitychange();appEvents.pagehide();
 assert.equal(follow.mode,'mic');
 doc.hidden=false;docEvents.visibilitychange();appEvents.pageshow();appEvents.focus();
 await settle();
 assert.equal(requests,2,'Reopen capture even when old iOS track still reports live');
 assert.equal(tracks[0].readyState,'ended');
 assert.equal(tracks[1].readyState,'live');
 assert.equal(follow.activeIndex,0,'Do not rewind live score');
 assert.equal(follow.mode,'mic');
 assert.equal(timers.size,1,'No duplicate detection timers on repeated foreground events');
 tracks[0].emit('ended');await settle();
 assert.equal(requests,2,'Stale ended notifications must be ignored');
 doc.hidden=true;docEvents.visibilitychange();
 doc.hidden=false;docEvents.visibilitychange();
 await settle();
 assert.equal(requests,3,'Repeated background/foreground must work');
 assert.equal(follow.activeIndex,0);
 contexts[0].state='suspended';
 const next=timers.values().next().value;timers.clear();next();await settle();
 assert.ok(resumes>=1,'Suspended WebAudio should resume');
 follow.stop();
 const reports=[];
 await follow.startDiagnostic(report=>reports.push(report));
 const before=requests;
 doc.hidden=true;docEvents.visibilitychange();
 doc.hidden=false;docEvents.visibilitychange();
 await settle();
 assert.equal(requests,before+1,'Settings microphone also auto-recovers');
 assert.equal(follow.mode,'diagnostic');
 assert.ok(reports.some(item=>item.message?.includes('riattivato')));
 follow.stopDiagnostic();
 await follow.microphone();
 doc.hidden=true;docEvents.visibilitychange();
 doc.hidden=false;docEvents.visibilitychange();
 follow.stop();await settle();
 assert.equal(follow.mode,'idle','Manual Stop wins over pending foreground recovery');
 assert.equal(tracks.at(-1).readyState,'ended','Stale pending capture is closed');
 console.log('PASS: CANTORIA foreground mic capture, live position, timer dedup, diagnostic, manual stop');
})().catch(error=>{console.error(error);process.exitCode=1;});
