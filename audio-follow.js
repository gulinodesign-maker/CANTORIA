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
  if(/7/.test(suffix))intervals=[...intervals,(/maj7|M7|7\+/.test(suffix)?11:10)];
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
 // The previous classifier searched EVERY chord in the song, then the strict cursor
 // rejected the winner whenever its label differed from the immediately next chord.
 // Check the expected harmony directly instead, without scanning for a later position.
 function recognizeExpectedChord(chroma,expected,allLabels=[]){
  const chord=parseChord(expected);
  if(!chord||!Array.isArray(chroma)||chroma.length!==12)return null;
  const values=chroma.map(v=>Math.max(0,Number(v)||0)),total=values.reduce((a,b)=>a+b,0);
  if(total<.005)return null;
  const triad=chord.intervals.slice(0,3).map(interval=>clampPitch(chord.root+interval));
  if(triad.length<3)return null;
  const peak=Math.max(...values)/total,threshold=Math.max(.045,peak*.12);
  const strengths=triad.map(pc=>values[pc]/total);
  const present=strengths.filter(value=>value>=threshold).length;
  const coverage=strengths.reduce((sum,value)=>sum+value,0);
  if(coverage<.52)return null;
  const globallyHeard=recognizeChord(chroma,allLabels);
  const other=globallyHeard&&parseChord(globallyHeard.chord);
  const sameTriad=other&&other.root===chord.root&&
    triad.every((pc,i)=>pc===clampPitch(other.root+(other.intervals[i]??999)));
  // Strong evidence from all three tones works even with extra harmonics.
  // If only two are audible (guitar/piano voicings), demand the target root,
  // a substantial combined energy and that competing harmony does not win.
  const twoTone=present>=2&&coverage>=.60&&strengths[0]>=threshold&&
    (!other||sameTriad||chordIdentity(other.label)===chordIdentity(chord.label));
  if(present<3&&!twoTone)return null;
  return {chord:chord.label,confidence:Math.min(1,coverage+.10*strengths[0]),coverage};
 }
 const DIAG_NOTES=['DO','DO#','RE','MIb','MI','FA','FA#','SOL','LAb','LA','SIb','SI'];
 const DIAG_CHORDS=DIAG_NOTES.flatMap(n=>[n,n+'-']);
 function diagnoseChroma(chroma){
  const hit=recognizeChord(chroma,DIAG_CHORDS);
  if(!hit)return null;
  const chord=parseChord(hit.chord),sum=chroma.reduce((a,v)=>a+Math.max(0,Number(v)||0),0);
  if(!chord||sum<.005)return null;
  const weights=chord.intervals.slice(0,3).map(v=>Math.max(0,chroma[clampPitch(chord.root+v)]||0)/sum);
  if(weights.filter(v=>v>=.10).length<2||weights.reduce((a,b)=>a+b,0)<.62||
    hit.confidence<.58||hit.margin<.085)return null;
  return {chord:hit.chord,match:Math.min(100,Math.round(hit.confidence*100)),margin:hit.margin};
 }
 // Positions are immutable events in the full score, not a search window in the visible page.
 function chordIdentity(label){return String(label||"").trim().toUpperCase().replace(/♯/g,"#").replace(/♭/g,"B").replace(/\s+/g,"");}
 function stepChordIndex(items,index,direction){
  if(!Array.isArray(items)||!items.length||!direction)return index;
  if(index<0)return direction>0?0:-1;
  return Math.max(0,Math.min(items.length-1,index+(direction>0?1:-1)));
 }
 function nextChordIndex(items,index,heard,freshAttack=false){
  const next=items?.[index+1],current=items?.[index];
  const wanted=typeof next==="string"?next:next?.label;
  const previous=typeof current==="string"?current:current?.label;
  if(!parseChord(wanted)||!parseChord(heard)||chordIdentity(wanted)!==chordIdentity(heard))return -1;
  if(index>=0&&chordIdentity(previous)===chordIdentity(wanted)&&!freshAttack)return -1;
  return index+1;
 }
 const player=typeof root.Audio==="function"?new root.Audio():null;
 let ctx=null,analyser=null,mediaNode=null,micNode=null,stream=null,trackURL=null;
 let preferredSource="none",mode="idle",timer=0,bins=null,wave=null,activeIndex=-1,activeName="",stableName="",stableCount=0,lastAdvance=0,seenAt=0,currentSongId="";
 let scoreItems=[],showPage=null,previousRms=0,silentFrames=0,releasedSinceLast=false,attackCount=0,lastMarkAttackCount=0,lastAttackAt=0;
 let chromaHistory=[];
 let diagSerial=0,diagCallback=null,diagLast="",diagStable="",diagFrames=0;
 const $=selector=>root.document?.querySelector(selector);
 function status(message){
  const element=$("#audioFollowStatus");
  if(element)element.textContent=message;
 }
 function resetListeningWindow(){chromaHistory=[];stableName="";stableCount=0;}
 function accumulatedChroma(chroma){
  // Silence must agree with the spectrum: some capture devices and AudioContext
  // configurations report near-zero time-domain samples while their FFT still
  // contains a valid pitched signal. Never discard that real chord evidence.
  const hasPitch=chroma.some(value=>value>.0001);
  if(!hasPitch){
   if(silentFrames>=3)resetListeningWindow();
   return chroma;
  }
  if(hasPitch){
   chromaHistory.push(chroma);
   if(chromaHistory.length>4)chromaHistory.shift();
  }
  if(!chromaHistory.length)return chroma;
  // Four recent FFT frames (~0.3 s) retain short arpeggios without delaying
  // the next chord with a long tail from the previous harmony.
  const average=Array(12).fill(0);
  for(const frame of chromaHistory)for(let i=0;i<12;i++)average[i]+=frame[i]/chromaHistory.length;
  // Prioritize the newest frame while retaining enough context for arpeggios.
  return average.map((v,i)=>.25*v+.75*chroma[i]);
 }
 function diagNotify(data){
  if(typeof diagCallback==="function")try{diagCallback(data);}catch(err){root.console?.warn?.("Cantoria diagnosi:",err);}
 }
 function diagNotes(chroma){
  return chroma.map((v,i)=>({label:DIAG_NOTES[i],level:Number(v)||0}))
    .filter(x=>x.level>=.08).sort((a,b)=>b.level-a.level).slice(0,5).map(x=>x.label);
 }
 function diagDetect(){
  if(mode!=="diagnostic"||!analyser)return;
  if(ctx.state==="suspended"){diagNotify({phase:"listening",message:"Audio sospeso: riprova il test.",chord:diagLast});timer=root.setTimeout(diagDetect,250);return;}
  analyser.getByteFrequencyData(bins);
  const low=Math.ceil(85*analyser.fftSize/ctx.sampleRate);
  const high=Math.min(bins.length-1,Math.floor(1400*analyser.fftSize/ctx.sampleRate));
  let spectralPeak=0;
  for(let i=low;i<=high;i++)spectralPeak=Math.max(spectralPeak,bins[i]);
  let rms=0,samples=0;
  if(wave&&typeof analyser.getByteTimeDomainData==="function"){
   analyser.getByteTimeDomainData(wave);
   for(let i=0;i<wave.length;i+=16){const v=(wave[i]-128)/128;rms+=v*v;samples++;}
   rms=Math.sqrt(rms/Math.max(1,samples));
  }
  const raw=chromaFromFFT(bins,ctx.sampleRate,analyser.fftSize);
  const guess=(spectralPeak>=65||rms>=.008)?diagnoseChroma(accumulatedChroma(raw)):null;
  if(guess?.chord&&guess.chord===diagStable)diagFrames++;
  else{diagStable=guess?.chord||"";diagFrames=guess?1:0;}
  if(guess&&diagFrames>=3)diagLast=guess.chord;
  const level=Math.max(0,Math.min(100,Math.round(Math.max(rms*520,Math.max(0,spectralPeak-45)*.7))));
  diagNotify({phase:"listening",level,chord:diagLast,guess:guess?.chord||"",
   match:guess?.match||0,notes:diagNotes(raw),
   message:level<3?"Nessun segnale audio: suona vicino al microfono.":
    diagLast&&guess?.chord===diagLast&&diagFrames>=3?"Accordo riconosciuto.":
    "Segnale presente: analisi dell’accordo in corso."});
  timer=root.setTimeout(diagDetect,180);
 }
 async function startDiagnostic(onUpdate){
  if(!root.navigator?.mediaDevices?.getUserMedia)throw new Error("Microfono non disponibile.");
  stop();
  const token=++diagSerial;
  diagCallback=typeof onUpdate==="function"?onUpdate:null;
  diagLast="";diagStable="";diagFrames=0;resetListeningWindow();mode="diagnostic";
  diagNotify({phase:"requesting",message:"Autorizza l’accesso al microfono.",level:0,chord:""});
  try{
   await ensureContext();
   if(token!==diagSerial)return;
   const mic=await root.navigator.mediaDevices.getUserMedia({audio:{
     echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
   if(token!==diagSerial){mic.getTracks().forEach(t=>t.stop());return;}
   stream=mic;
   micNode=ctx.createMediaStreamSource(stream);micNode.connect(analyser);
   diagNotify({phase:"listening",message:"Microfono attivo: suona un accordo (es. DO).",level:0,chord:""});
   diagDetect();
  }catch(err){if(token===diagSerial){stop();throw err;}}
 }
 function stopDiagnostic(){if(mode==="diagnostic")stop();}
 function sequence(){return scoreItems;}
 function setScore(songId,items,onPage){
  if(currentSongId&&currentSongId!==songId){activeIndex=-1;activeName="";lastAdvance=0;}
  currentSongId=String(songId||"");
  scoreItems=Array.isArray(items)?items.filter(x=>parseChord(x?.label)):[];
  showPage=typeof onPage==="function"?onPage:null;
  if(activeIndex>=scoreItems.length){activeIndex=-1;activeName="";}
  else if(activeIndex>=0)activeName=scoreItems[activeIndex].label;
 }
 function visibleLabels(){return Array.from(root.document?.querySelectorAll("#readerLayer .chord-label[data-follow-id]")||[]);}
 function activeLabel(){const id=scoreItems[activeIndex]?.id;return id?visibleLabels().find(el=>el.dataset.followId===id):null;}
 function syncControls(){
  const mic=$("#readerLayer .reader-follow-btn");
  const hint=$("#audioFollowStatus"),verification=$("#readerVerification");
  if(hint)hint.hidden=mode!=="mic";
  if(verification)verification.hidden=mode==="mic";
  if(mic&&!mic.disabled){
   const listening=mode==="mic"&&!!stream;
   mic.dataset.listening=String(listening);
   mic.dataset.waiting=String(listening&&activeIndex<0);
   mic.setAttribute("aria-pressed",String(listening));
   mic.setAttribute("aria-label",listening?"Microfono attivo, in ascolto":"Segui accordi");
   mic.setAttribute("title",listening?"Microfono attivo":"Segui accordi");
  }
  const previous=$("#readerLayer [data-action='follow-prev-chord']");
  const next=$("#readerLayer [data-action='follow-next-chord']");
  if(previous)previous.disabled=activeIndex<1||!scoreItems.length;
  if(next)next.disabled=!scoreItems.length||activeIndex>=scoreItems.length-1;
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
  const selected=scoreItems[activeIndex]?.id;
  const labels=visibleLabels(),rows=new Set(),activeRows=new Set();
  for(const el of labels){
   const active=!!selected&&el.dataset.followId===selected;
   el.classList.toggle("audio-chord-active",active);
   const row=el.closest(".music-row");
   if(row){rows.add(row);if(active)activeRows.add(row);}
  }
  for(const row of rows)row.classList.toggle("audio-row-active",activeRows.has(row));
  if(mode==="idle")status("Microfono inattivo.");
  syncControls();
 }
 function reset(songId=""){
  stop();currentSongId=String(songId||"");scoreItems=[];showPage=null;
  activeIndex=-1;activeName="";stableName="";stableCount=0;lastAdvance=0;
  attackCount=0;lastMarkAttackCount=0;previousRms=0;silentFrames=0;releasedSinceLast=false;
  resetListeningWindow();refresh();
 }
 function scrollToActive(){
  const el=activeLabel(),stage=$("#readerStage"),row=el?.closest(".music-row");
  if(!stage||!row)return;
  const a=row.getBoundingClientRect(),b=stage.getBoundingClientRect();
  const target=stage.scrollTop+(a.top-b.top)-stage.clientHeight*.35;
  if(Math.abs(target-stage.scrollTop)>24)stage.scrollTo({top:Math.max(0,target),behavior:"smooth"});
 }
 function mark(index){
  const item=scoreItems[index];if(!item)return;
  activeIndex=index;activeName=item.label;lastAdvance=Date.now();
  lastMarkAttackCount=attackCount;releasedSinceLast=false;
  resetListeningWindow();
  if(typeof showPage==="function")showPage(item.page);
  refresh();
  if(typeof root.requestAnimationFrame==="function")root.requestAnimationFrame(()=>{refresh();scrollToActive();});
  else scrollToActive();
  status((index===0?"Brano avviato · ":"Accordo: ")+item.label+" · "+(index+1)+" / "+scoreItems.length);
 }
 function step(direction){
  const index=stepChordIndex(scoreItems,activeIndex,direction);
  if(index<0||index===activeIndex)return false;
  // Manual correction adjusts only the score cursor; the audio source stays active.
  resetListeningWindow();
  mark(index);
  return true;
 }
 function match(chord){
  if(!scoreItems.length)return;
  const freshAttack=releasedSinceLast||attackCount>lastMarkAttackCount;
  const next=nextChordIndex(scoreItems,activeIndex,chord,freshAttack);
  if(next<0)return;
  // Distinct successive chords must react promptly; repeated identical
  // chords retain a longer guard and still require a new onset/release.
  const repeated=activeIndex>=0&&chordIdentity(scoreItems[activeIndex]?.label)===chordIdentity(scoreItems[activeIndex+1]?.label);
  if(activeIndex>=0&&Date.now()-lastAdvance<(repeated?320:130))return;
  mark(next);
 }
 function updateDynamics(){
  if(!wave||typeof analyser.getByteTimeDomainData!=="function")return;
  analyser.getByteTimeDomainData(wave);
  let sum=0,count=0;
  for(let i=0;i<wave.length;i+=16){const sample=(wave[i]-128)/128;sum+=sample*sample;count++;}
  const rms=Math.sqrt(sum/Math.max(1,count)),now=Date.now();
  if(rms<.009)silentFrames++;else silentFrames=0;
  // Do not flag a release here: some devices give near-zero PCM samples
  // even when the frequency analyser contains audible notes.
  if(rms>.012&&rms>previousRms*1.55&&rms-previousRms>.010&&now-lastAttackAt>280){
   attackCount++;lastAttackAt=now;
  }
  previousRms=rms;
 }
 function detect(){
  if(mode==="idle"||!analyser)return;
  if(mode==="player"&&player?.paused){status("Audio in pausa");return;}
  if(ctx.state==="suspended"){timer=root.setTimeout(detect,250);return;}
  analyser.getByteFrequencyData(bins);
  updateDynamics();
  const rawChroma=chromaFromFFT(bins,ctx.sampleRate,analyser.fftSize);
  if(silentFrames>=2&&!rawChroma.some(v=>v>.001))releasedSinceLast=true;
  const chroma=accumulatedChroma(rawChroma);
  const expected=sequence()[activeIndex+1]?.label;
  const prediction=recognizeExpectedChord(chroma,expected,sequence().map(x=>x.label));
  const name=prediction?prediction.chord:"";
  if(name&&name===stableName)stableCount++;
  else{stableName=name;stableCount=1;}
  // Two consecutive FFT readings confirm a chord without the ~500ms
  // delay previously imposed by three 155ms polling intervals.
  if(name&&stableCount>=2){match(name);seenAt=Date.now();}
  if(!name&&Date.now()-seenAt>2000&&mode==="mic")
   status(activeIndex<0?"In attesa del primo accordo: "+(scoreItems[0]?.label||"—"):"In ascolto · prossimo: "+(expected||"fine"));
  timer=root.setTimeout(detect,80);
 }
 async function ensureContext(){
  const AudioContext=root.AudioContext||root.webkitAudioContext;
  if(!AudioContext)throw new Error("Audio non supportato da questo dispositivo.");
  if(!ctx){ctx=new AudioContext();analyser=ctx.createAnalyser();analyser.fftSize=8192;analyser.smoothingTimeConstant=.34;bins=new Uint8Array(analyser.frequencyBinCount);wave=new Uint8Array(analyser.fftSize);}
  await ctx.resume();
 }
 function stop(){
  const wasDiag=mode==="diagnostic";
  diagSerial++;
  if(timer)root.clearTimeout(timer);timer=0;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  try{micNode?.disconnect();}catch(_){}
  micNode=null;
  if(player&&!player.paused)player.pause();
  mode="idle";resetListeningWindow();previousRms=0;silentFrames=0;releasedSinceLast=false;lastMarkAttackCount=attackCount;
  status("Rilevamento fermato.");syncControls();
  if(wasDiag)diagNotify({phase:"stopped",message:"Test interrotto.",level:0,chord:diagLast});
  diagCallback=null;
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
  if(!scoreItems.length)throw new Error("Questo brano non contiene accordi da seguire.");
  stop();await ensureContext();
  // Arming always begins at the very first chord; the score does not start
  // until a stable live match marks position zero.
  activeIndex=-1;activeName="";lastAdvance=0;resetListeningWindow();refresh();
  stream=await root.navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  micNode=ctx.createMediaStreamSource(stream);micNode.connect(analyser);
  mode="mic";preferredSource="mic";
  status("In attesa del primo accordo: "+scoreItems[0].label);
  syncControls();detect();
 }
 async function toggle(){
  if(mode!=="idle"){stop();return;}
  if(preferredSource==="mic")return microphone();
  if(player?.src)return play();
  return microphone();
 }
 function rewind(){
  if(player?.src)try{player.currentTime=0;}catch(_){}
  activeIndex=-1;activeName="";lastAdvance=0;attackCount=0;lastMarkAttackCount=0;previousRms=0;silentFrames=0;releasedSinceLast=false;resetListeningWindow();refresh();
  if(mode==="mic")status("In attesa del primo accordo: "+(scoreItems[0]?.label||"—"));
 }
 if(player)player.addEventListener("ended",()=>stop());
 const api={parseChord,chromaFromFFT,recognizeChord,recognizeExpectedChord,diagnoseChroma,startDiagnostic,stopDiagnostic,nextChordIndex,stepChordIndex,setScore,step,loadTrack,play,microphone,toggle,rewind,stop,reset,refresh,syncControls,get mode(){return mode;},get activeIndex(){return activeIndex;},get hasSource(){return preferredSource==="mic"||!!player?.src;}};
 root.CantoriaAudioFollow=api;
 if(typeof module!=="undefined"&&module.exports)module.exports={parseChord,chromaFromFFT,recognizeChord,recognizeExpectedChord,diagnoseChroma,nextChordIndex,stepChordIndex};
})(typeof window!=="undefined"?window:globalThis);
