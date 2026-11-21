/* Cantoria: contextual harmonic key analysis. No key is asserted from
 * raw chord frequency alone. OCR indications remain provisional. */
(function (root) {
  'use strict';
  const ROOTS = {DO:0, RE:2, MI:4, FA:5, SOL:7, LA:9, SI:11};
  const NAMES = ['DO','DO#','RE','MIb','MI','FA','FA#','SOL','LAb','LA','SIb','SI'];
  const MAJOR = [{n:0,q:'M'},{n:2,q:'m'},{n:4,q:'m'},{n:5,q:'M'},{n:7,q:'M'},{n:9,q:'m'},{n:11,q:'dim'}];
  const MINOR = [{n:0,q:'m'},{n:2,q:'dim'},{n:3,q:'M'},{n:5,q:'m'},{n:7,q:'m'},{n:8,q:'M'},{n:10,q:'M'}];
  const mod = n => ((n%12)+12)%12;

  function parseChord(value) {
    const raw=String(value||'').trim().replace(/♯/g,'#').replace(/♭/g,'b');
    const m=raw.match(/^(SOL|DO|RE|MI|FA|LA|SI)(#|b)?(.*)$/i);
    if(!m) return null;
    const suffix=m[3]||'';
    // Reject OCR words which merely start with a note name.
    if(suffix && !/^(?:-|m(?!aj)|min|maj|dim|aug|sus|add|[0-9#b+°ø(/])/i.test(suffix))return null;
    let q='M';
    if(/^(?:-|m(?!aj)|min)/i.test(suffix))q='m';
    else if(/^(?:dim|°|ø)/i.test(suffix))q='dim';
    else if(/^(?:aug|\+)/i.test(suffix))q='aug';
    else if(/^(?:sus|[24](?![0-9]))/i.test(suffix))q='neutral';
    const pc=mod(ROOTS[m[1].toUpperCase()]+(m[2]==='#'?1:m[2]==='b'?-1:0));
    return {pc,q,raw};
  }
  function collect(song) {
    const sections=[],all=[];
    for(const section of song?.sections||[]) {
      const seq=[];
      const add=(list,weight=1)=>{
        if(!Array.isArray(list))return;
        for(const item of list) {
          const raw=typeof item==='string'?item:item?.chord||item?.symbol;
          const chord=parseChord(raw);
          if(!chord)continue;
          const flagged=typeof item==='object'&&!item?.verified&&(item?.needsReview||item?.unresolved);
          const e={...chord,w:flagged?weight*.55:weight,flagged:!!flagged};
          seq.push(e);all.push(e);
        }
      };
      add(section.chordsOnly,.9);
      for(const row of section.chordRows||[])add(row,.9);
      for(const line of section.lines||[]) {
        const anchors=Array.isArray(line.anchors)?[...line.anchors].sort((a,b)=>(a.slot||0)-(b.slot||0)):[];
        add(anchors,1);
      }
      if(seq.length)sections.push(seq);
    }
    return {sections,all};
  }
  function candidate(tonic,mode,sections,all) {
    const scale=mode==='major'?MAJOR:MINOR;
    const degree=(pc)=>mod(pc-tonic);
    const triad=pc=>scale.find(x=>x.n===degree(pc));
    let score=0,matched=0,total=0,starts=0,cadences=0,strongCadences=0;
    const progressions=[];
    for(const e of all) {
      const d=triad(e.pc),n=degree(e.pc);
      total+=e.w;
      if(!d){score-=2.5*e.w;continue;}
      matched+=e.w;
      if(e.q==='neutral')score+=.7*e.w;
      else if(e.q===d.q)score+=1.35*e.w;
      else if(mode==='minor'&&n===7&&e.q==='M'){score+=1.5*e.w;}
      else score-=1.1*e.w;
      if(n===0)score+=.65*e.w;
      if(n===7&&mode==='major'&&e.q==='M')score+=.2*e.w;
      if(n===7&&mode==='minor'&&e.q==='m')score-=.18*e.w;
    }
    for(const seq of sections) {
      if(seq[0].pc===tonic){score+=2.2;starts++;}
      if(seq.at(-1).pc===tonic)score+=2.9;
      for(let i=1;i<seq.length;i++){
        const previous=seq[i-1],current=seq[i];
        const a=degree(previous.pc),b=degree(current.pc);
        const weight=Math.min(previous.w,current.w);
        if(a===7&&b===0){
          const strong=previous.q==='M';
          const bonus=strong?4.2:(mode==='minor'&&previous.q==='m'?1.6:.3);
          score+=bonus*weight;
          if(strong||mode==='minor'&&previous.q==='m'){
            cadences++;
            if(strong)strongCadences++;
            if(progressions.length<4)progressions.push(previous.raw+' → '+current.raw);
          }
        }else if(mode==='major'&&a===5&&b===7){score+=1.25*weight;}
        else if(mode==='major'&&a===2&&b===7){score+=1.35*weight;}
        else if(mode==='major'&&a===5&&b===0){score+=1.1*weight;}
        else if(mode==='minor'&&a===5&&b===7&&current.q==='M'){score+=1.4*weight;}
        if(mode==='minor'&&i>=2&&degree(seq[i-2].pc)===8&&a===10&&b===0)score+=1.5*weight;
      }
    }
    return {key:NAMES[tonic]+(mode==='minor'?'-':''),mode,score:Math.round(score*10)/10,fit:total?matched/total:0,starts,cadences,strongCadences,progressions};
  }
  function analyze(song) {
    const {sections,all}=collect(song);
    const counts=new Map(),unique=new Set();
    for(const e of all){
      const id=NAMES[e.pc]+(e.q==='m'?'-':e.q==='dim'?'°':'');
      counts.set(id,(counts.get(id)||0)+1);
      unique.add(e.pc);
    }
    const ranked=[];
    for(let tonic=0;tonic<12;tonic++){
      ranked.push(candidate(tonic,'major',sections,all));
      ranked.push(candidate(tonic,'minor',sections,all));
    }
    ranked.sort((a,b)=>b.score-a.score);
    const best=ranked[0],runner=ranked[1],margin=best.score-runner.score;
    const observations=all.length;
    const reviewed=all.filter(x=>x.flagged).length;
    const countsSorted=[...counts].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
    const sufficient=observations>=6&&unique.size>=3&&best.fit>=.75;
    // An admissible pitch-class set is not proof of a tonal centre.
    // Require ordered cadence or repeated tonic starts AND a clear lead.
    const structural=best.cadences>=1||best.starts>=2;
    const decisive=sufficient&&structural&&margin>=5.5;
    const confidence=decisive&&margin>=13&&best.strongCadences>=2&&reviewed/observations<.25?'alta':decisive?'media':'bassa';
    return {
      status:!sufficient?'insufficient':decisive?'probable':'uncertain',
      key:decisive?best.key:'',
      preferred:best.key,
      alternative:runner.key,
      confidence,observations,reviewed,distinctRoots:unique.size,
      margin:Math.round(margin*10)/10,counts:countsSorted,
      candidates:ranked.slice(0,3),
      progressions:best.progressions,
      warning:'L’analisi degli accordi non sostituisce la verifica della melodia e delle cadenze sulla fonte originale.'
    };
  }
  const api={analyze,parseChord};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CantoriaHarmony=api;
})(typeof window!=='undefined'?window:globalThis);
