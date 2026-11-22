const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),vm=require('node:vm');
assert.deepEqual(require('../release.json'),{version:'1.1',build:44});
const prepare=fs.readFileSync('scripts/prepare-ios.sh','utf8');
const swift=fs.readFileSync('scripts/ios-background-mic.swift','utf8');
const js=fs.readFileSync('audio-follow.js','utf8');
new vm.Script(js);
assert.match(prepare,/python3 scripts\/ios-background-mic\.py/);
assert.match(swift,/AVAudioEngine\(\)/);
assert.match(swift,/installTap\(onBus: 0, bufferSize: 8192/);
assert.match(swift,/AVAudioSession\.sharedInstance\(\)/);
assert.match(swift,/\.record, mode: \.measurement/);
assert.match(swift,/bridge\?\.registerPluginInstance\(CantoriaBackgroundMicPlugin\(\)\)/);
assert.match(swift,/frames\.removeFirst\(1500\)/);
assert.match(swift,/guard generation == captureGeneration && recordingRequested/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cantoria-native-bg-'));
const delegate=path.join(dir,'AppDelegate.swift');
const storyboard=path.join(dir,'Main.storyboard');
const plist=path.join(dir,'Info.plist');
try{
 fs.writeFileSync(delegate,'import Capacitor\nclass AppDelegate {}\n');
 fs.writeFileSync(storyboard,'<viewController customClass="CAPBridgeViewController" customModule="Capacitor"></viewController>');
 let p=cp.spawnSync('python3',['-c','import plistlib,sys;plistlib.dump({"NSMicrophoneUsageDescription":"x"},open(sys.argv[1],"wb"))',plist],{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 const args=['scripts/ios-background-mic.py',delegate,storyboard,plist];
 p=cp.spawnSync('python3',args,{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr||p.stdout);
 const modified=fs.readFileSync(delegate,'utf8');
 assert.equal((modified.match(/CANTORIA_NATIVE_BACKGROUND_MIC_V40/g)||[]).length,1);
 assert.match(fs.readFileSync(storyboard,'utf8'),/CantoriaBridgeViewController/);
 assert.equal(cp.spawnSync('python3',['scripts/ios-background-mic.py','--verify',delegate,storyboard,plist]).status,0);
 assert.equal(cp.spawnSync('python3',args).status,0,'Native patch must be idempotent');
 assert.equal(fs.readFileSync(delegate,'utf8'),modified);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
let starts=0,stops=0,pulls=0,ensures=0;
let audioFrames=[],timerSeq=0;
const handlers={},docHandlers={},timers=new Map(),score=[];
const doc={hidden:false,querySelector(){return null;},querySelectorAll(){return [];},
 addEventListener(name,fn){docHandlers[name]=fn;}};
const native={
 async start(){starts++;return {running:true};},
 async stop(){stops++;return {running:false};},
 async ensure(){ensures++;return {running:true};},
 async pull({after,limit}){pulls++;return {
  frames:audioFrames.filter(x=>x.seq>after).slice(0,limit),
  firstSeq:audioFrames[0]?.seq??1,
  latestSeq:audioFrames.at(-1)?.seq??0,running:true,lastSampleAgeMs:100
 };}
};
const root={document:doc,Capacitor:{getPlatform(){return 'ios'},Plugins:{CantoriaBackgroundMic:native}},
 addEventListener(name,fn){handlers[name]=fn;},
 setTimeout(fn){const i=++timerSeq;timers.set(i,fn);return i;},
 clearTimeout(id){timers.delete(id);},requestAnimationFrame(fn){fn();}};
vm.runInNewContext(js,{window:root,module:{exports:{}}});
const follow=root.CantoriaAudioFollow;
let tickTime=100000;
function push(notes){
 const chroma=Array.from({length:12},(_,i)=>notes.includes(i)?1/notes.length:0);
 audioFrames.push({seq:audioFrames.length+1,at:tickTime,chroma,level:70});
 tickTime+=190;
}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();}
async function tick(){
 const first=timers.keys().next().value;
 if(first!==undefined){const fn=timers.get(first);timers.delete(first);fn();}
 await settle();
}
(async()=>{
 follow.setScore('song',[{id:'one',label:'SOL',page:0},
  {id:'two',label:'DO',page:0},{id:'three',label:'FA',page:1}],()=>score.push(follow.activeIndex));
 await follow.microphone();await settle();
 assert.equal(starts,1,'iOS must use AVAudioEngine instead of getUserMedia');
 assert.equal(follow.mode,'mic');
 push([7,11,2]);push([7,11,2]);await tick();
 assert.equal(follow.activeIndex,0,'Native first chord must advance the score');
 // JS/WebKit timers do not execute at all during app suspension.
 doc.hidden=true;docHandlers.visibilitychange();handlers.pagehide();
 push([0,4,7]);push([0,4,7]);push([5,9,0]);push([5,9,0]);
 assert.equal(stops,0,'Backgrounding is NEVER Stop for native audio');
 assert.equal(follow.activeIndex,0,'WebView may be fully suspended');
 doc.hidden=false;docHandlers.visibilitychange();await settle();await tick();
 assert.ok(ensures>=1,'Foreground verifies the native audio engine');
 assert.equal(follow.activeIndex,2,'Replay note profiles captured while WebView was suspended');
 assert.equal(stops,0,'Coming back must not release the microphone');
 follow.stop();await settle();
 assert.equal(stops,1,'Explicit Stop releases native capture');
 assert.equal(follow.mode,'idle');
 console.log('PASS: iOS background AVAudioEngine wiring, suspended WebView replay, no background Stop, explicit Stop');
})().catch(e=>{console.error(e);process.exitCode=1;});
