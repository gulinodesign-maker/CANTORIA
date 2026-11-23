(function(){'use strict';
const names={DO:0,RE:2,MI:4,FA:5,SOL:7,LA:9,SI:11};
const parseChord=value=>{
 const m=String(value||'').toUpperCase().replaceAll('♯','#').replaceAll('♭','B').match(/^(DO|RE|MI|FA|SOL|LA|SI)(#|B)?(.*)$/);
 if(!m)return null;
 const root=(names[m[1]]+(m[2]==='#'?1:m[2]==='B'?-1:0)+12)%12,tail=m[3]||'';
 let intervals=/DIM|°/.test(tail)?[0,3,6]:/AUG|\+/.test(tail)?[0,4,8]:/MIN|^-|^M(?!AJ)/.test(tail)?[0,3,7]:[0,4,7];
 if(/SUS2/.test(tail))intervals=[0,2,7];
 if(/SUS4/.test(tail))intervals=[0,5,7];
 if(/7/.test(tail))intervals.push(/MAJ7|7M/.test(tail)?11:10);
 return [...new Set(intervals.map(n=>(n+root)%12))];
};
const plugin=()=>{
 const c=window.Capacitor;
 if(!c)return null;
 if(c.Plugins?.CantoriaMIDI)return c.Plugins.CantoriaMIDI;
 if(typeof c.registerPlugin==='function')return c.registerPlugin('CantoriaMIDI');
 if(typeof c.nativePromise==='function')return {pull:args=>c.nativePromise('CantoriaMIDI','pull',args||{})};
 return null;
};
let native=null,webAccess=null,seq=0,connected=false,deviceName='',running=false,score=[],songID=null,cursor=0,pageCallback=null,armed=null,bindings={},pollBusy=false;
let candidate=-1,candidateAt=0,lastAdvance=0,split=60,splitSamples=[],lastHarmony='',lastHarmonyAt=0;
const active=new Map(),sustain=new Set(),pedal=new Map();
try{bindings=JSON.parse(localStorage.getItem('cantoria-midi-bindings')||'{}')}catch(_){}
const time=()=>Date.now(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function isPlaying(){return running;}
function status(){
 const dot=document.getElementById('midiConnectionLed'),el=document.getElementById('midiConnectionStatus');
 if(dot){dot.classList.toggle('connected',connected);dot.setAttribute('aria-label',connected?'MIDI connesso':'MIDI disconnesso');}
 if(el)el.textContent=connected?'Tastiera MIDI connessa'+(deviceName?' · '+deviceName:''):'Tastiera USB MIDI non rilevata';
 const btn=document.querySelector('.reader-follow-btn');
 if(btn){btn.classList.toggle('midi-connected',connected);btn.classList.toggle('midi-active',running);btn.setAttribute('aria-pressed',String(running));btn.title=running?'Pausa MIDI':connected?'Play MIDI · tastiera collegata':'Collega una tastiera USB MIDI';btn.textContent=running?'Ⅱ':'▶';}
 document.getElementById('readerLayer')?.classList.toggle('midi-play-mode',running);
}
function highlight(){
 document.querySelectorAll('.audio-chord-active,.midi-chord-current').forEach(e=>e.classList.remove('audio-chord-active','midi-chord-current'));
 const item=score[cursor];if(!item)return;
 const el=[...document.querySelectorAll('[data-follow-id]')].find(x=>x.dataset.followId===item.id);
 if(el)el.classList.add('midi-chord-current');
}
function setCursor(index){
 if(index<0||index>=score.length)return false;
 cursor=index;candidate=-1;candidateAt=0;lastHarmony='';lastHarmonyAt=0;active.clear();sustain.clear();lastAdvance=time();
 const item=score[cursor];if(item&&typeof pageCallback==='function')pageCallback(item.page);
 highlight();return true;
}
function notesForHarmony(){
 const t=time(),notes=[...active].filter(([key,v])=>t-v.at<12000).map(([key,v])=>({note:v.note,at:v.at,channel:v.channel})).sort((a,b)=>a.note-b.note);
 if(notes.length<2)return [];
 // Infer a split only when there are separate low and high note clusters.
 const gaps=notes.slice(1).map((n,i)=>({gap:n.note-notes[i].note,index:i}));
 const gap=gaps.filter(x=>x.gap>=5&&x.index>=1&&x.index<notes.length-2).sort((a,b)=>b.gap-a.gap)[0];
 if(gap){const proposed=(notes[gap.index].note+notes[gap.index+1].note)/2;splitSamples.push(proposed);if(splitSamples.length>14)splitSamples.shift();const sorted=[...splitSamples].sort((a,b)=>a-b);split=clamp(sorted[Math.floor(sorted.length/2)],45,76);}
 let low=notes.filter(x=>x.note<=split);
 if(low.length<2){low=notes.slice(0,Math.min(4,Math.max(2,Math.ceil(notes.length*.6))));}
 // Prefer bass notes and simultaneous chord tones; melody-only high notes must not drive changes.
 return low;
}
function evaluate(){
 if(!running||!connected||cursor>=score.length-1)return;
 const t=time(),notes=notesForHarmony();
 if(notes.length<2)return;
 const pcs=new Set(notes.map(x=>x.note%12));
 const bass=notes[0].note%12;
 const current=parseChord(score[cursor]?.label);
 const possible=[];
 for(let index=cursor;index<Math.min(score.length,cursor+4);index++){
  const chord=parseChord(score[index].label);if(!chord)continue;
  const hits=chord.filter(pc=>pcs.has(pc)).length;
  const extras=[...pcs].filter(pc=>!chord.includes(pc)).length;
  const confidence=hits/chord.length-.14*extras+(chord.includes(bass)?.12:0);
  possible.push({index,hits,confidence,chord});
 }
 possible.sort((a,b)=>b.confidence-a.confidence||a.index-b.index);
 const best=possible[0],present=possible.find(x=>x.index===cursor);
 if(!best||best.index<=cursor||best.hits<2||best.confidence<.66)return;
 // Never advance on a pitch set also explained by the current chord.
 if(present&&best.confidence-present.confidence<.17)return;
 if(candidate!==best.index){candidate=best.index;candidateAt=t;return;}
 if(t-candidateAt<90||t-lastAdvance<140)return;
 setCursor(best.index);
}
function noteKey(channel,note){return channel+':'+note;}
function midiEvent(e){
 const note=Number(e.note),channel=Number(e.channel)||0,on=e.on===true||e.type==='noteOn'||e.type==='noteon'||e.type==='note_on';
 if(!Number.isInteger(note)||note<0||note>127)return;
 if(armed&&on){
  const old=Object.keys(bindings).find(k=>bindings[k]?.note===note&&bindings[k]?.channel===channel&&k!==armed.key);
  if(old)delete bindings[old];
  bindings[armed.key]={note,channel};
  try{localStorage.setItem('cantoria-midi-bindings',JSON.stringify(bindings));}catch(_){}
  const done=armed.done;armed=null;active.delete(noteKey(channel,note));done?.();return;
 }
 const command=Object.entries(bindings).find(([,v])=>Number(v.note)===note&&Number(v.channel)===channel);
 if(command){
  if(on){const key=command[0];const selector=key.startsWith('nav:')?'[data-nav="'+key.slice(4)+'"]':'[data-action="'+key+'"]';document.querySelector(selector)?.click();}
  return;
 }
 const key=noteKey(channel,note);
 if(on){active.set(key,{note,channel,at:time()});sustain.delete(key);}
 else if(pedal.get(channel)){sustain.add(key);}
 else{active.delete(key);sustain.delete(key);}
 evaluate();
}
function controlEvent(e){
 const channel=Number(e.channel)||0,controller=Number(e.controller);
 if(controller===64){const down=Number(e.value)>=64;pedal.set(channel,down);if(!down){for(const key of sustain){if(key.startsWith(channel+':')){active.delete(key);sustain.delete(key);}}}}
 if(controller===120||controller===123){for(const key of active.keys())if(key.startsWith(channel+':'))active.delete(key);}
}
function receive(e){if(e.type==='cc'||e.type==='controlChange')controlEvent(e);else midiEvent(e);}
async function setupWebMIDI(){
 if(!navigator.requestMIDIAccess||webAccess)return;
 try{
  webAccess=await navigator.requestMIDIAccess({sysex:false});
  const refresh=()=>{let count=0;for(const input of webAccess.inputs.values()){if(input.state==='connected'){count++;input.onmidimessage=event=>{const [s,n,v]=event.data||[];const kind=s&240,ch=s&15;if(kind===144||kind===128)receive({note:n,channel:ch,on:kind===144&&v>0});else if(kind===176)receive({type:'cc',channel:ch,controller:n,value:v});};deviceName=input.name||'';}}connected=count>0;status();};
  webAccess.onstatechange=refresh;refresh();
 }catch(_){}
}
async function poll(){
 if(pollBusy)return;pollBusy=true;
 try{
  native ||=plugin();
  if(native){
   const response=await native.pull({after:seq});
   connected=response.connected===true;deviceName=connected?(response.deviceName||''):'';if(!connected){active.clear();if(running){running=false;}}
   for(const e of response.events||[]){seq=Math.max(seq,e.seq||0);receive(e);}
  }else if(!webAccess){await setupWebMIDI();}
  status();
 }catch(err){connected=false;status();if(!webAccess)await setupWebMIDI();}
 finally{pollBusy=false;}
}
setInterval(poll,35);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
window.CantoriaMIDIFollow={
 parseChord,isPlaying,get connected(){return connected;},
 setScore(id,items,callback){if(songID!==id){songID=id;cursor=0;candidate=-1;}score=items||[];pageCallback=callback;cursor=clamp(cursor,0,Math.max(0,score.length-1));highlight();},
 refresh(){status();highlight();},reset(){running=false;active.clear();cursor=0;status();},
 rewind(){setCursor(0);},seekToChord(id){const i=score.findIndex(x=>x.id===id);return setCursor(i);},
 async toggle(){await poll();if(!connected)throw Error('Nessuna tastiera MIDI collegata. Controlla il cavo USB e la connessione iOS.');running=!running;candidate=-1;active.clear();status();},
 stop(){running=false;active.clear();status();},
 arm(key,done){armed={key,done};poll();},cancelArm(){armed=null;},
 unbind(key){delete bindings[key];try{localStorage.setItem('cantoria-midi-bindings',JSON.stringify(bindings));}catch(_){}},
};
})();