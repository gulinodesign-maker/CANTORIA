/* CANTORIA 1.1 — Audio-to-chord follower (local Web Audio API; no AI/cloud).
   Harmonic recognition is indicative: a single melody may not reveal the chord.
   Sources: an audio file played in Cantoria or the device microphone.
*/
(function(root){
 "use strict";
 const NOTE={DO:0,RE:2,MI:4,FA:5,SOL:7,LA:9,SI:11};
 const clampPitch=n=>(n%12+12)%12;
 function parseChord(raw){
  const source=String(raw||"").trim().replace(/♯/g,"#").replace(/♭/g,"b").replace(/⁰/g,"0").replace(/¹/g,"1").replace(/²/g,"2").replace(/³/g,"3").replace(/⁴/g,"4").replace(/⁵/g,"5").replace(/⁶/g,"6").replace(/⁷/g,"7");
  // Imported songs may use C, D, E, F, G, A, B rather than DO..SI.
  // Keep the original chord label for display, but use its actual pitch.
  const italian=source.match(/^(SOL|DO|RE|MI|FA|LA|SI)(#|b)?(.*)$/i);
  const english=italian?null:source.match(/^([A-G])(#|b)?(.*)$/i);
  const match=italian||english;
  if(!match)return null;
  const basic=italian?NOTE[match[1].toUpperCase()]:({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[match[1].toUpperCase()];
  const rootPc=clampPitch(basic+(match[2]==="#"?1:match[2]==="b"?-1:0));
  const suffix=(match[3]||"").split("/")[0];
  // Refuse arbitrary text such as 'CANTO', 'DONA' or 'Gloria' as chords.
  if(suffix&&!/^(?:-|m(?!aj)|min|maj|M|dim|aug|sus|add|ø|°|[0-9+#()/-])[\da-zA-Z+#°()/-]*$/.test(suffix))return null;
  const minor=/^(?:-|min|m(?!aj))/i.test(suffix)&&!/^M(?:$|7|9|11|13)/.test(suffix);
  const sus=/(?:sus2|sus4)/i.exec(suffix)?.[0]?.toLowerCase()||
    (/^2(?:$|\/)/.test(suffix)?"sus2":/^4(?:$|\/)/.test(suffix)?"sus4":null);
  const diminished=/dim|°/i.test(suffix);
  let intervals=diminished?[0,3,6]:sus==="sus2"?[0,2,7]:sus==="sus4"?[0,5,7]:minor?[0,3,7]:[0,4,7];
  if(/7/.test(suffix))intervals=[...intervals,(/maj7|M7|7\+/.test(suffix)?11:10)];
  return {root:rootPc,minor,intervals,label:source};
 }
 function chromaFromFFT(bins,sampleRate,fftSize){
  const profile=new Float64Array(12);
  if(!bins?.length||!sampleRate||!fftSize)return Array.from(profile);
  const start=Math.ceil(67*fftSize/sampleRate);
  const last=Math.min(bins.length-1,Math.floor(1600*fftSize/sampleRate));
  // The previous bin gate was >77/255 while the settings meter reported
  // a sound as soon as it reached 65. Quieter real devices appeared deaf.
  // Estimate per-frame noise floor, then retain peaks above it.
  const samples=[];
  for(let i=start;i<=last;i+=5)samples.push(bins[i]||0);
  samples.sort((a,b)=>a-b);
  const floor=samples[Math.floor(samples.length*.4)]||0;
  const cutoff=Math.max(42,floor+11);
  for(let i=start;i<=last;i++){
   const level=bins[i]||0;
   if(level<cutoff)continue;
   if(i>start&&i<last&&level<bins[i-1]&&level<bins[i+1])continue;
   const freq=i*sampleRate/fftSize;
   const nearest=Math.round(69+12*Math.log2(freq/440));
   const ideal=440*Math.pow(2,(nearest-69)/12);
   const cents=1200*Math.log2(freq/ideal);
   if(Math.abs(cents)>56)continue;
   const strength=Math.max(0,(level-floor)/Math.max(1,255-floor));
   if(strength<.035)continue;
   profile[clampPitch(nearest)]+=strength*strength/Math.sqrt(Math.max(.45,freq/150));
  }
  const total=profile.reduce((sum,v)=>sum+v,0);
  if(total>0)for(let i=0;i<12;i++)profile[i]/=total;
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
  const present=weights.filter(v=>v>=.075).length;
  const coverage=weights.reduce((a,b)=>a+b,0);
  if(present<2||coverage<.54||hit.confidence<.54)return null;
  // A low margin is often normal for inversions and guitar harmonics.
  // Expose the lower confidence instead of blocking the chord entirely.
  const reliable=present>=3||hit.margin>=.025;
  if(!reliable)return null;
  return {chord:hit.chord,match:Math.min(100,Math.round(hit.confidence*100)),margin:hit.margin};
 }
 // Positions are immutable events in the full score, not a search window in the visible page.
 function chordIdentity(label){
  const chord=parseChord(label);
  return chord?chord.root+":"+chord.intervals.join(","):String(label||"").trim().toUpperCase().replace(/\s+/g,"");
 }
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
 // A live player must be able to rejoin at a nearby recognized harmony
 // when one chord was missed. Never infer passage of time from silence alone.
 function liveChordCandidate(items,index,chroma,elapsed=0){
  if(!Array.isArray(items)||!items.length||!Array.isArray(chroma))return null;
  const labels=items.map(x=>typeof x==="string"?x:x?.label);
  const first=index+1,expected=labels[first];
  const direct=recognizeExpectedChord(chroma,expected,labels);
  if(direct)return {index:first,prediction:direct,skipped:0};
  if(index<0||elapsed<1100)return null;
  const options=[],total=chroma.reduce((a,b)=>a+Math.max(0,Number(b)||0),0);
  if(total<.005)return null;
  const peak=Math.max(...chroma)/total;
  // At most two missed changes, never jump across a long unseen section.
  for(let i=first+1;i<=Math.min(items.length-1,index+3);i++){
   const chord=parseChord(labels[i]);
   if(!chord||chordIdentity(labels[i])===chordIdentity(labels[index]))continue;
   if(labels.slice(first,i).some(x=>chordIdentity(x)===chordIdentity(labels[i]))||
      labels.slice(i+1,Math.min(items.length,index+4)).some(x=>chordIdentity(x)===chordIdentity(labels[i])))continue;
   const prediction=recognizeExpectedChord(chroma,labels[i],labels);
   if(!prediction||prediction.coverage<.74)continue;
   const strengths=chord.intervals.slice(0,3).map(interval=>
    Math.max(0,Number(chroma[clampPitch(chord.root+interval)])||0)/total);
   if(strengths.filter(v=>v>=Math.max(.065,peak*.17)).length<3)continue;
   options.push({index:i,prediction,skipped:i-first});
  }
  options.sort((a,b)=>b.prediction.coverage-a.prediction.coverage);
  if(!options.length||(options[1]&&options[0].prediction.coverage-options[1].prediction.coverage<.09))return null;
  return options[0];
 }
 const player=typeof root.Audio==="function"?new root.Audio():null;
 let ctx=null,analyser=null,mediaNode=null,micNode=null,stream=null,trackURL=null;
 let preferredSource="none",mode="idle",timer=0,bins=null,wave=null,activeIndex=-1,activeName="",stableName="",stableCount=0,lastAdvance=0,seenAt=0,currentSongId="";
 let scoreItems=[],showPage=null,previousRms=0,silentFrames=0,releasedSinceLast=false,attackCount=0,lastMarkAttackCount=0,lastAttackAt=0;
 let chromaHistory=[],markedChroma=null;
 let diagSerial=0,diagCallback=null,diagLast="",diagStable="",diagFrames=0;
 let sessionSerial=0,micRecovery=null,lastMicRecovery=-Infinity,mutedSince=0,resumePromise=null,wakeLock=null,foregroundCaptureDirty=false;
 const $=selector=>root.document?.querySelector(selector);
 function status(message){
  const element=$("#audioFollowStatus");
  if(element)element.textContent=message;
 }
 function resetListeningWindow(){chromaHistory=[];stableName="";stableCount=0;}
 function audioTracks(){
  if(!stream)return [];
  if(typeof stream.getAudioTracks==="function")return stream.getAudioTracks();
  return typeof stream.getTracks==="function"?stream.getTracks().filter(t=>!t.kind||t.kind==="audio"):[];
 }
 function needsMicRecovery(){
  const tracks=audioTracks();
  if(!tracks.length||tracks.every(t=>t.readyState==="ended"))return true;
  if(tracks.every(t=>t.muted===true)){
   if(!mutedSince)mutedSince=Date.now();
   return Date.now()-mutedSince>=2500;
  }
  mutedSince=0;
  return false;
 }
 function releaseWakeLock(){
  const lock=wakeLock;wakeLock=null;
  if(lock?.release)Promise.resolve().then(()=>lock.release()).catch(()=>{});
 }
 function keepAwake(){
  if(mode!=="mic"||wakeLock||root.document?.hidden)return;
  const request=root.navigator?.wakeLock?.request;
  if(typeof request!=="function")return;
  const serial=sessionSerial;
  Promise.resolve().then(()=>request.call(root.navigator.wakeLock,"screen")).then(lock=>{
   if(serial!==sessionSerial||mode!=="mic"){lock?.release?.();return;}
   wakeLock=lock;
  }).catch(()=>{}); // Wake Lock is optional and not supported by all iOS WebViews.
 }
 function resumeAudio(){
  if(!ctx||ctx.state==="running"||resumePromise)return resumePromise;
  const serial=sessionSerial;
  resumePromise=Promise.resolve().then(()=>ctx.resume()).then(()=>{
   if(serial===sessionSerial&&(mode==="mic"||mode==="diagnostic"))status("Ascolto audio ripristinato.");
  }).catch(()=>{
   if(serial===sessionSerial)status("Audio sospeso da iOS: tieni lo schermo attivo e riavvia l’ascolto se necessario.");
  }).finally(()=>{resumePromise=null;});
  return resumePromise;
 }
 function bindMicrophoneTracks(captured,serial){
  for(const track of captured.getTracks?.()||[]){
   // Do not react to "ended" from the previous track after it was replaced.
   const current=()=>serial===sessionSerial&&stream===captured;
   track.addEventListener?.("ended",()=>{
    if(current()&&(mode==="mic"||mode==="diagnostic"))void recoverMicrophone();
   });
   track.addEventListener?.("mute",()=>{if(current())mutedSince=Date.now();});
   track.addEventListener?.("unmute",()=>{if(current())mutedSince=0;});
  }
 }
 function recoverMicrophone(force=false){
  const sourceMode=mode;
  if(sourceMode!=="mic"&&sourceMode!=="diagnostic")return null;
  if(micRecovery)return micRecovery;
  if(!force&&Date.now()-lastMicRecovery<3500)return null;
  lastMicRecovery=Date.now();
  const serial=sessionSerial,diagnosticSerial=diagSerial;
  const current=()=>serial===sessionSerial&&diagnosticSerial===diagSerial&&mode===sourceMode;
  if(sourceMode==="mic")status("Ripristino del microfono in corso...");
  else diagNotify({phase:"requesting",message:"Ripristino del microfono in corso..."});
  micRecovery=(async()=>{
   let captured=null;
   try{
    // A WebKit track can still say "live" while iOS has stopped delivering
    // samples. A foreground transition must reopen the actual capture.
    if(force){
     const old=stream;
     stream=null;
     try{micNode?.disconnect();}catch(_){}
     micNode=null;
     old?.getTracks?.().forEach(t=>t.stop());
    }
    // Do not block on a WebKit AudioContext whose resume() may be stalled.
    if(!ctx||ctx.state==="closed")await ensureContext();
    else if(ctx.state!=="running")void resumeAudio();
    if(!current())return;
    captured=await root.navigator.mediaDevices.getUserMedia({audio:{
     echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(!current()){captured.getTracks?.().forEach(t=>t.stop());return;}
    const nextAnalyser=ctx.createAnalyser();
    nextAnalyser.fftSize=8192;
    nextAnalyser.smoothingTimeConstant=sourceMode==="mic"?.34:.64;
    const nextNode=ctx.createMediaStreamSource(captured);
    nextNode.connect(nextAnalyser);
    const oldStream=stream,oldNode=micNode,oldAnalyser=analyser;
    if(mediaNode&&oldAnalyser){
     try{mediaNode.disconnect(oldAnalyser);}catch(_){}
     try{mediaNode.connect(nextAnalyser);}catch(_){}
    }
    stream=captured;micNode=nextNode;analyser=nextAnalyser;
    bins=new Uint8Array(analyser.frequencyBinCount);
    wave=new Uint8Array(analyser.fftSize);
    try{oldNode?.disconnect();}catch(_){}
    oldStream?.getTracks?.().forEach(t=>t.stop());
    mutedSince=0;resetListeningWindow();
    bindMicrophoneTracks(stream,serial);
    if(sourceMode==="mic"){
     status("Microfono riattivato · ascolto live in corso.");
     syncControls();keepAwake();
    }else{
     diagStable="";diagFrames=0;
     diagNotify({phase:"listening",level:0,chord:diagLast,
      message:"Microfono riattivato: suona un accordo."});
    }
   }catch(err){
    if(captured&&captured!==stream)captured.getTracks?.().forEach(t=>t.stop());
    if(current()){
     const msg="Microfono non disponibile: tocca Stop e riattiva l’ascolto. "+(err?.message||"");
     if(sourceMode==="mic"){status(msg);syncControls();}
     else diagNotify({phase:"error",message:msg,level:0,chord:diagLast});
    }
   }finally{
    if(serial===sessionSerial)micRecovery=null;
   }
  })();
  return micRecovery;
 }
 function onAudioBackground(){
  if(mode!=="mic"&&mode!=="diagnostic")return;
  foregroundCaptureDirty=true;
  releaseWakeLock();
 }
 function onAudioForeground(){
  if(root.document?.hidden||(mode!=="mic"&&mode!=="diagnostic"))return;
  const force=foregroundCaptureDirty;
  foregroundCaptureDirty=false;
  void resumeAudio();
  if(force||needsMicRecovery())void recoverMicrophone(force);
  if(timer){root.clearTimeout(timer);timer=0;}
  if(mode==="mic"){keepAwake();detect();}
  else diagDetect();
 }
 root.document?.addEventListener?.("visibilitychange",()=>{
  if(root.document.hidden)onAudioBackground();
  else onAudioForeground();
 });
 root.addEventListener?.("pagehide",onAudioBackground);
 root.addEventListener?.("blur",onAudioBackground);
 root.addEventListener?.("pageshow",onAudioForeground);
 root.addEventListener?.("focus",onAudioForeground);
("focus",onAudioForeground);
 function chordProfileChange(before,now){
  if(!Array.isArray(before)||!Array.isArray(now)||before.length!==12||now.length!==12)return 1;
  const a=before.reduce((sum,v)=>sum+Math.max(0,v||0),0)||1;
  const b=now.reduce((sum,v)=>sum+Math.max(0,v||0),0)||1;
  return now.reduce((sum,v,i)=>sum+Math.abs(Math.max(0,v||0)/b-Math.max(0,before[i]||0)/a),0)/2;
 }
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
  if(micRecovery){timer=root.setTimeout(diagDetect,180);return;}
  if(mode==="diagnostic"&&needsMicRecovery()){void recoverMicrophone();timer=root.setTimeout(diagDetect,180);return;}
  if(ctx.state!=="running"){void resumeAudio();diagNotify({phase:"listening",message:"Audio sospeso: ripristino in corso.",chord:diagLast});timer=root.setTimeout(diagDetect,250);return;}
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
  // Frequency evidence is the deciding factor: do not require a second,
  // stricter signal threshold than the chord detector itself.
  const sound=raw.some(v=>v>.001);
  const guess=sound?diagnoseChroma(accumulatedChroma(raw)):null;
  if(guess?.chord&&guess.chord===diagStable)diagFrames++;
  else{diagStable=guess?.chord||"";diagFrames=guess?1:0;}
  if(guess&&diagFrames>=2)diagLast=guess.chord;
  const level=Math.max(0,Math.min(100,Math.round(Math.max(rms*520,Math.max(0,spectralPeak-38)*.7))));
  diagNotify({phase:"listening",level,chord:diagLast,guess:guess?.chord||"",
   match:guess?.match||0,notes:diagNotes(raw),
   message:level<3&&!sound?"Nessun segnale audio: suona vicino al microfono.":
    diagLast&&guess?.chord===diagLast&&diagFrames>=2?"Accordo riconosciuto.":
    sound?"Note ricevute; attendi un accordo completo.":"Segnale presente ma note non individuate."});
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
   analyser.smoothingTimeConstant=.64;
   if(token!==diagSerial)return;
   const mic=await root.navigator.mediaDevices.getUserMedia({audio:{
     echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
   if(token!==diagSerial){mic.getTracks().forEach(t=>t.stop());return;}
   stream=mic;
   micNode=ctx.createMediaStreamSource(stream);micNode.connect(analyser);
   bindMicrophoneTracks(stream,sessionSerial);
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
  resetListeningWindow();markedChroma=null;refresh();
 }
 function scrollToActive(){
  const el=activeLabel(),stage=$("#readerStage"),row=el?.closest(".music-row");
  if(!stage||!row)return;
  const a=row.getBoundingClientRect(),b=stage.getBoundingClientRect();
  const target=stage.scrollTop+(a.top-b.top)-stage.clientHeight*.35;
  if(Math.abs(target-stage.scrollTop)>24)stage.scrollTo({top:Math.max(0,target),behavior:"smooth"});
 }
 function mark(index,chroma=null){
  const item=scoreItems[index];if(!item)return;
  activeIndex=index;activeName=item.label;lastAdvance=Date.now();
  markedChroma=chroma?Array.from(chroma):null;
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
  // Arrows remain available even if all notes are unrecognized.
  resetListeningWindow();mark(index);return true;
 }
 function match(candidate,chroma){
  if(!scoreItems.length||!candidate)return;
  const next=candidate.index,skipped=candidate.skipped||0;
  const freshAttack=releasedSinceLast||attackCount>lastMarkAttackCount;
  const repeated=activeIndex>=0&&chordIdentity(scoreItems[activeIndex]?.label)===chordIdentity(scoreItems[next]?.label);
  if(activeIndex>=0&&Date.now()-lastAdvance<(repeated?320:130))return;
  // A sustained chord must not accidentally trigger a future harmony.
  if(activeIndex>=0&&!freshAttack&&chordProfileChange(markedChroma,chroma)<(skipped?.18:.12))return;
  if(!skipped&&nextChordIndex(scoreItems,activeIndex,candidate.prediction.chord,freshAttack)!==next)return;
  mark(next,chroma);
  if(skipped)status("Live riallineato: "+scoreItems[next].label+
   " · "+skipped+" "+(skipped===1?"accordo saltato":"accordi saltati")+" · "+(next+1)+" / "+scoreItems.length);
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
  if((mode!=="mic"&&mode!=="player")||!analyser)return;
  try{
   if(mode==="player"&&player?.paused){status("Audio in pausa");return;}
   if(mode==="mic"&&micRecovery)return;
   if(mode==="mic"&&needsMicRecovery()){void recoverMicrophone();return;}
   if(ctx.state!=="running"){
    void resumeAudio();
    if(mode==="mic")status("Audio sospeso: ripristino dell’ascolto in corso...");
    return;
   }
   analyser.getByteFrequencyData(bins);
   updateDynamics();
   const rawChroma=chromaFromFFT(bins,ctx.sampleRate,analyser.fftSize);
   if(silentFrames>=2&&!rawChroma.some(v=>v>.001))releasedSinceLast=true;
   const chroma=accumulatedChroma(rawChroma);
   const candidate=liveChordCandidate(scoreItems,activeIndex,chroma,Date.now()-lastAdvance);
   const signature=candidate?candidate.index+":"+candidate.prediction.chord:"";
   if(signature&&signature===stableName)stableCount++;
   else{stableName=signature;stableCount=signature?1:0;}
   // Two frames for the next chord; four confident frames for resync.
   if(candidate&&stableCount>=(candidate.skipped?4:2)){
    match(candidate,chroma);seenAt=Date.now();
   }
   if(!signature&&Date.now()-seenAt>2000&&mode==="mic")
    status(activeIndex<0?"In attesa del primo accordo: "+(scoreItems[0]?.label||"—"):
     "Live in ascolto · prossimo: "+(scoreItems[activeIndex+1]?.label||"fine")+
     " · se necessario usa → per saltare un accordo");
  }catch(err){
   root.console?.warn?.("Cantoria ascolto live:",err);
   if(mode==="mic")status("Rilevamento audio momentaneamente interrotto · ripristino in corso...");
  }finally{
   // Preserve the detection loop through suspended audio / WebKit exceptions.
   if(mode==="mic"||mode==="player")timer=root.setTimeout(detect,80);
  }
 }
 async function ensureContext(){
  const AudioContext=root.AudioContext||root.webkitAudioContext;
  if(!AudioContext)throw new Error("Audio non supportato da questo dispositivo.");
  if(!ctx||ctx.state==="closed"){
   mediaNode=null;
   ctx=new AudioContext();analyser=ctx.createAnalyser();analyser.fftSize=8192;
   analyser.smoothingTimeConstant=.34;
   bins=new Uint8Array(analyser.frequencyBinCount);wave=new Uint8Array(analyser.fftSize);
  }
  if(ctx.state!=="running")await ctx.resume();
 }
 function stop(){
  const wasDiag=mode==="diagnostic";
  diagSerial++;sessionSerial++;lastMicRecovery=-Infinity;mutedSince=0;
  micRecovery=null;foregroundCaptureDirty=false;
  if(timer)root.clearTimeout(timer);timer=0;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  try{micNode?.disconnect();}catch(_){}
  micNode=null;releaseWakeLock();
  if(player&&!player.paused)player.pause();
  mode="idle";resetListeningWindow();markedChroma=null;previousRms=0;silentFrames=0;
  releasedSinceLast=false;lastMarkAttackCount=attackCount;
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
  if(!scoreItems.length)throw new Error("Questo brano non contiene accordi riconoscibili. Se è importato, verifica che le sigle siano presenti (DO o C, SOL o G) e crea prima la partitura se contiene solo una foto.");
  stop();const serial=sessionSerial;
  await ensureContext();
  if(serial!==sessionSerial)return;
  analyser.smoothingTimeConstant=.34;
  activeIndex=-1;activeName="";lastAdvance=0;resetListeningWindow();markedChroma=null;refresh();
  const captured=await root.navigator.mediaDevices.getUserMedia({audio:{
   echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  if(serial!==sessionSerial){captured.getTracks().forEach(t=>t.stop());return;}
  stream=captured;micNode=ctx.createMediaStreamSource(stream);micNode.connect(analyser);
  mode="mic";preferredSource="mic";bindMicrophoneTracks(stream,serial);
  status("In attesa del primo accordo: "+scoreItems[0].label);
  syncControls();keepAwake();detect();
 }
 async function toggle(){
  if(mode!=="idle"){stop();return;}
  if(preferredSource==="mic")return microphone();
  if(player?.src)return play();
  return microphone();
 }
 function rewind(){
  if(player?.src)try{player.currentTime=0;}catch(_){}
  activeIndex=-1;activeName="";lastAdvance=0;attackCount=0;lastMarkAttackCount=0;previousRms=0;silentFrames=0;releasedSinceLast=false;resetListeningWindow();markedChroma=null;refresh();
  if(mode==="mic")status("In attesa del primo accordo: "+(scoreItems[0]?.label||"—"));
 }
 if(player)player.addEventListener("ended",()=>stop());
 const api={parseChord,chromaFromFFT,recognizeChord,recognizeExpectedChord,diagnoseChroma,startDiagnostic,stopDiagnostic,nextChordIndex,stepChordIndex,liveChordCandidate,setScore,step,loadTrack,play,microphone,toggle,rewind,stop,reset,refresh,syncControls,get mode(){return mode;},get activeIndex(){return activeIndex;},get hasSource(){return preferredSource==="mic"||!!player?.src;}};
 root.CantoriaAudioFollow=api;
 if(typeof module!=="undefined"&&module.exports)module.exports={parseChord,chromaFromFFT,recognizeChord,recognizeExpectedChord,diagnoseChroma,nextChordIndex,stepChordIndex,liveChordCandidate};
})(typeof window!=="undefined"?window:globalThis);
