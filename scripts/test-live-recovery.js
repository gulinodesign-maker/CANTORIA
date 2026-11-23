const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('audio-follow.js','utf8');
assert.deepEqual(require('../release.json'),{version:'1.1',build:53});
new vm.Script(source);
const audio=require('../audio-follow.js');
const profile=(pcs)=>Array.from({length:12},(_,i)=>pcs.includes(i)?1/pcs.length:0);
const seq=['SOL','DO','FA','LA-','RE'].map((label,i)=>({label,id:'a'+i,page:i>=3?1:0}));
const fa=profile([5,9,0]);
assert.equal(audio.liveChordCandidate(seq,-1,fa,10000),null,'First chord must never be skipped');
assert.equal(audio.liveChordCandidate(seq,0,fa,500),null,'Do not jump during a held chord');
const resync=audio.liveChordCandidate(seq,0,fa,1800);
assert.equal(resync?.index,2,'After missing DO the live engine must rejoin at FA');
assert.equal(resync?.skipped,1);
assert.equal(audio.liveChordCandidate(seq,0,profile([7,11,2]),5000),null,'Do not advance on sustained SOL');
assert.equal(audio.liveChordCandidate(seq,0,profile([0,4,7]),0)?.index,1,'Immediate next chord remains preferred');
const repeated=['SOL','DO','FA','FA','RE'].map(label=>({label}));
assert.equal(audio.liveChordCandidate(repeated,0,fa,1800),null,'Ambiguous duplicated future chords must not trigger an arbitrary jump');
assert.equal(audio.liveChordCandidate(seq,0,profile([0]),12000),null,'Time alone or a single note must not advance the score');

let now=1000,notes=[392,494,587],frames=[],streams=[],requests=0,stopCount=0,resumes=0,firstContext=null,onceThrow=false;
class Track{
 constructor(){this.kind='audio';this.readyState='live';this.muted=false;this.listeners={};}
 addEventListener(event,cb){(this.listeners[event]||=([])).push(cb);}
 emit(event){for(const cb of this.listeners[event]||[])cb();}
 stop(){this.readyState='ended';stopCount++;}
}
class Context{
 constructor(){this.state='running';this.sampleRate=44100;firstContext=this;}
 createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,
  getByteFrequencyData(b){if(onceThrow){onceThrow=false;throw Error('Transient FFT error');}
   b.fill(0);for(const hz of notes)b[Math.round(hz*8192/44100)]=255;},
  getByteTimeDomainData(b){b.fill(128);}};}
 createMediaStreamSource(){return {connect(){},disconnect(){}};}
 async resume(){resumes++;this.state='running';}
}
const handlers={},docHandlers={},status={textContent:''};
const root={
 AudioContext:Context,
 navigator:{mediaDevices:{async getUserMedia(){requests++;const track=new Track(),stream={getTracks(){return [track]},getAudioTracks(){return [track]}};streams.push({track,stream});return stream;}}},
 document:{hidden:false,querySelector(selector){return selector==='#audioFollowStatus'?status:null;},querySelectorAll(){return [];},addEventListener(ev,fn){docHandlers[ev]=fn;}},
 addEventListener(ev,fn){handlers[ev]=fn;},
 setTimeout(fn,ms){assert.equal(ms,80,'Live listening must continue at 80ms');frames.push(fn);return frames.length;},
 clearTimeout(){},requestAnimationFrame(fn){fn();}
};
vm.runInNewContext(source,{window:root,Date:{now(){return now;}},module:{exports:{}}});
const follow=root.CantoriaAudioFollow;
follow.setTolerance(0); // Regression checks recovery with the original rapid two-frame detection.
const tick=()=>{now+=80;const fn=frames.shift();assert.ok(fn,'Live loop must still be scheduled');fn();};
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
(async()=>{
 follow.setScore('song',seq,()=>{});
 await follow.microphone();
 assert.equal(requests,1);assert.equal(follow.mode,'mic');
 tick();assert.equal(follow.activeIndex,0,'Start on initial SOL');
 // A WebKit exception must not terminate microphone polling.
 onceThrow=true;tick();tick();assert.equal(follow.mode,'mic');
 // Suspended iOS AudioContext is automatically resumed and keeps the cursor.
 firstContext.state='suspended';tick();await flush();
 assert.ok(resumes>=1,'Web Audio context must resume');
 assert.equal(follow.activeIndex,0);
 // A musical change advances exactly one event, even if it is not the next printed chord.
 now+=1500;notes=[349,440,523];
 for(let i=0;i<6;i++)tick();
 assert.equal(follow.activeIndex,1,'A change to FA advances one event without matching printed DO');
 // Ended iOS microphone track triggers reacquisition without resetting the song.
 const old=streams[0].track;
 old.readyState='ended';old.emit('ended');await flush();
 assert.equal(requests,2,'Microphone must be reobtained when track ends');
 assert.equal(follow.mode,'mic');assert.equal(follow.activeIndex,1);
 notes=[440,262,330];tick();tick();
 assert.equal(follow.activeIndex,2,'New harmony advances after mic recovery');
 // A long live performance with no recognisable chords must never stop the loop.
 notes=[];for(let i=0;i<320;i++)tick();
 assert.equal(follow.mode,'mic');
 assert.equal(follow.activeIndex,2,'Silence must not fabricate score progression');
 assert.equal(follow.step(1),true,'Manual skip stays available in live mode');
 assert.equal(follow.activeIndex,3);
 follow.stop();assert.equal(follow.mode,'idle');assert.ok(stopCount>=1);
 assert.ok(!frames.length||typeof frames[0]==='function');
 console.log('PASS: long-lived microphone auto-recovers from iOS suspension/track end, advances on harmonic changes, does not advance on silence');
})().catch(e=>{console.error(e);process.exitCode=1});
