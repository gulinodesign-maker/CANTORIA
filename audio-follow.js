/* CANTORIA 1.1 — Audio-to-chord follower (local Web Audio API; no AI/cloud).
   Harmonic recognition is indicative: a single melody may not reveal the chord.
   Sources: an audio file played in Cantoria or the device microphone.
*/
(function(root){
 "use strict";
 const NOTE={DO:0,RE:2,MI:4,FA:5,SOL:7,LA:9,SI:11};
 const clampPitch=n=>(n%12+12)%12;
 function parseChord(raw){
  const s=String(raw||"").trim().replace(/♯/g,"#").replace(/♭/g,"b");
  const match=s.match(/^(SOL|DO|RE|MI|FA|LA|SI)(#|b)?(.*)$/i);
  if(!match)return null;
  const rootPc=clampPitch(NOTE[match[1].toUpperCase()]+(match[2]==="#"?1:match[2]==="b"?-1:0));
  const suffix=(match[3]||"").split("/")[0];
  const minor=/^(?:-|m(?!aj)|min)/i.test(suffix);
  const sus=/(?:sus2|sus4)/i.exec(suffix)?.[0]?.toLowerCase();
  const diminished=/dim|°/i.test(suffix);
  let intervals= diminished?[0,3,6]:sus==="sus2"?[0,2,7]:sus==="sus4"?[0,5,7]:minor?[0,3,7]:[0,4,7];
  if(/7/.test(suffix))intervals=[...intervals,(/maj7|M7/.test(suffix)?11:10)];
  return {root:rootPc,minor,intervals,label:s};
 }
 function chromaFromFFT(bins,sampleRate,fftSize){
  const profile=new Float64Array(12);
  for(let i=Math.ceil(83*fftSize/sampleRate);i<bins.length;i++){
   const freq=i*sampleRate/fftSize;
   if(freq>1800)break;
   const level=Math.max(0,(bins[i]-48)/207);
   if(level<.14)continue;
   const nearest=Math.round(69+12*Math.log2(freq/440));
   const ideal=440*Math.pow(2,(nearest-69)/12);
   const cents=1200*Math.log2(freq/ideal);
   if(Math.abs(cents)>42)continue;
   const pc=clampPitch(nearest);
   profile[pc]+=level*level/Math.sqrt(freq/150);
  }
  const sum=profile.reduce((a,b)=>a+b,0);
  if(sum>0)for(let i=0;i<12;i++)profile[i]/=sum;
  return Array.from(profile);
 }
 function recognizeChord(chroma,allowed){
  if(!Array.isArray(chroma)||chroma.length!==12||!allowed?.length)return null;
  const total=chroma.reduce((a,b)=>a+Math.max(0,Number(b)||0),0);
  if(total<.005)return null;
  let best=null,second=-Infinity;
  for(const label of new Set(allowed)){
   const chord=parseChord(label);
   if(!chord)continue;
   const notes=chord.intervals.map(interval=>clampPitch(chord.root+interval));
   const relevance=notes.reduce((sum,n)=>sum+Math.max(0,chroma[n]||0),0)/total;
   const bass=Math.max(0,chroma[chord.root]||0)/total;
   const score=relevance+(.10*bass)-(.025*Math.max(0,notes.length-3));
   if(!best||score>best.score){if(best)second=Math.max(second,best.score);best={label:chord.label,score};}
   else if(score>second)second=score;
  }
  if(!best||best.score<.43)return null;
  return {chord:best.label,confidence:Math.min(1,Math.max(0,best.score)),margin:best.score-second};
 }
 const player=typeof root.Audio==="function"?new root.Audio():null;
 let ctx=null,analyser=null,mediaNode=null,micNode=null,stream=null,trackURL=null;
 let preferredSource="none",mode="idle",timer=0,bins=null,activeIndex=-1,activeName="",stableName="",stableCount=0,lastAdvance=0,seenAt=0,currentSongId="";
 const $=selector=>root.document?.querySelector(selector);
 function status(message){
  const element=$("#audioFollowStatus");
  if(element)element.textContent=message;
 }
 function sequence(){return Array.from(root.document?.querySelectorAll("#readerLayer .chord-label[data-follow-chord]")||[]).filter(el=>parseChord(el.dataset.followChord));}
 function syncControls(){
  const play=$("#readerLayer .reader-play-toggle");
  if(play&&!play.disabled){
   const running=mode!=="idle";
   // Preserve the toolbar SVG instead of replacing it with emoji/text glyphs.
   const icon=play.querySelector(".reader-transport-svg path");
   if(icon)icon.setAttribute("d",running?"M6 6h12v12H6z":"M7 4v16l13-8z");
   else play.textContent=running?"■":"▶";
   play.setAttribute("aria-label",running?"Stop":"Play");
   play.setAttribute("title",running?"Stop":"Play");
   play.dataset.playing=String(running);
  }
 }
 function refresh(){
  const rows=sequence();
  rows.forEach((el,i)=>{el.classList.toggle("audio-chord-active",i===activeIndex);el.closest(".music-row")?.classList.toggle("audio-row-active",i===activeIndex);});
  if(mode==="idle")status("Carica un audio oppure ascolta dal microfono.");syncControls();
 }
 function reset(songId=""){
  stop();currentSongId=songId;activeIndex=-1;activeName="";stableName="";stableCount=0;lastAdvance=0;refresh();
 }
 function mark(index,chord){
  const rows=sequence();if(index<0||!rows[index])return;
  for(const item of rows){item.classList.remove("audio-chord-active");item.closest(".music-row")?.classList.remove("audio-row-active");}
  const el=rows[index];el.classList.add("audio-chord-active");el.closest(".music-row")?.classList.add("audio-row-active");
  activeIndex=index;activeName=chord;lastAdvance=Date.now();
  const stage=$("#readerStage"),row=el.closest(".music-row");
  if(stage&&row){
   const a=row.getBoundingClientRect(),b=stage.getBoundingClientRect();
   const target=stage.scrollTop+(a.top-b.top)-stage.clientHeight*.35;
   if(Math.abs(target-stage.scrollTop)>24)stage.scrollTo({top:Math.max(0,target),behavior:"smooth"});
  }
  status("Accordo: "+chord+" · scorrimento attivo");
 }
 function match(chord){
  const rows=sequence();if(!rows.length||chord===activeName)return;
  const key=parseChord(chord);
  if(!key)return;
  const start=Math.max(0,activeIndex+1),windowSize=activeIndex<0?8:14;
  let next=-1;
  for(let i=start;i<Math.min(rows.length,start+windowSize);i++){
   const target=parseChord(rows[i].dataset.followChord);
   if(target&&target.root===key.root&&target.minor===key.minor){next=i;break;}
  }
  if(next<0)return;
  if(activeIndex>=0&&Date.now()-lastAdvance<450)return;
  mark(next,chord);
 }
 function detect(){
  if(mode==="idle"||!analyser)return;
  if(mode==="player"&&player?.paused){status("Audio in pausa");return;}
  if(ctx.state==="suspended"){timer=root.setTimeout(detect,250);return;}
  analyser.getByteFrequencyData(bins);
  const chroma=chromaFromFFT(bins,ctx.sampleRate,analyser.fftSize);
  const labels=sequence().map(x=>x.dataset.followChord);
  const prediction=recognizeChord(chroma,labels);
  const name=prediction&&prediction.confidence>=.46?prediction.chord:"";
  if(name&&name===stableName)stableCount++;
  else {stableName=name;stableCount=1;}
  if(name&&stableCount>=3){match(name);seenAt=Date.now();}
  if(!name&&Date.now()-seenAt>2000)status(mode==="mic"?"In ascolto…":"Riproduzione…");
  timer=root.setTimeout(detect,155);
 }
 async function ensureContext(){
  const AudioContext=root.AudioContext||root.webkitAudioContext;
  if(!AudioContext)throw new Error("Audio non supportato da questo dispositivo.");
  if(!ctx){ctx=new AudioContext();analyser=ctx.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=.72;bins=new Uint8Array(analyser.frequencyBinCount);}
  await ctx.resume();
 }
 function stop(){
  if(timer)root.clearTimeout(timer);timer=0;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  try{micNode?.disconnect();}catch(_){}
  micNode=null;
  if(player&&!player.paused)player.pause();
  mode="idle";stableName="";stableCount=0;
  status("Rilevamento fermato.");syncControls();
 }
 async function loadTrack(file){
  if(!file||(!file.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)))throw new Error("Scegli un file audio supportato.");
  if(file.size>150*1024*1024)throw new Error("File audio troppo grande.");
  if(!player)throw new Error("Player audio non disponibile.");
  stop();if(trackURL)URL.revokeObjectURL(trackURL);
  trackURL=URL.createObjectURL(file);player.src=trackURL;player.load();preferredSource="file";syncControls();
  status("Pronto: "+file.name+" · premi ▶");
 }
 async function play(){
  if(!player?.src)throw new Error("Carica prima un file audio.");
  if(mode==="player"&&!player.paused){player.pause();status("Audio in pausa");return;}
  stop();await ensureContext();
  if(!mediaNode){mediaNode=ctx.createMediaElementSource(player);mediaNode.connect(analyser);mediaNode.connect(ctx.destination);}
  await player.play();mode="player";preferredSource="file";status("Riproduzione e riconoscimento…");syncControls();detect();
 }
 async function microphone(){
  if(!root.navigator?.mediaDevices?.getUserMedia)throw new Error("Il microfono non è disponibile.");
  stop();await ensureContext();
  stream=await root.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  micNode=ctx.createMediaStreamSource(stream);micNode.connect(analyser);
  mode="mic";preferredSource="mic";status("Ascolto dal microfono…");syncControls();detect();
 }
 async function toggle(){
  if(mode!=="idle"){stop();return;}
  if(preferredSource==="mic")return microphone();
  if(player?.src)return play();
  throw new Error("Seleziona audio o microfono dal tasto Segui.");
 }
 function rewind(){
  if(player?.src)try{player.currentTime=0;}catch(_){}
  activeIndex=-1;activeName="";stableName="";stableCount=0;lastAdvance=0;refresh();
 }
 if(player)player.addEventListener("ended",()=>stop());
 const api={parseChord,chromaFromFFT,recognizeChord,loadTrack,play,microphone,toggle,rewind,stop,reset,refresh,syncControls,get mode(){return mode;},get hasSource(){return preferredSource==="mic"||!!player?.src;}};
 root.CantoriaAudioFollow=api;
 if(typeof module!=="undefined"&&module.exports)module.exports={parseChord,chromaFromFFT,recognizeChord};
})(typeof window!=="undefined"?window:globalThis);
