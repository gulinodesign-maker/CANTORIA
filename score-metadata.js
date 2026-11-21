/* CANTORIA — conservative local OCR recognition of song title and author.
   Reads visible header layout; never supplies a guessed author from lyrics. */
(function(root){
"use strict";
const MUSIC_HEADING=/^(?:intro(?:duzione)?|strofa(?:\s+\d+)?|ritornello|coro|refrain|ponte|finale|outro|coda)\s*:?(?:\s|$)/i;
const NOTE=/^(?:DO|RE|MI|FA|SOL|LA|SI)(?:[#b♯♭]?(?:\d+|[-+°]?)|m(?:aj|in)?\d*)$/i;
const METADATA_KEY=/^(?:(?:titolo|canto|brano|title)\s*[:–-]\s*)(.+)$/i;
const CREDIT=/^(?:(?:autore|compositore|author|musica|testo\s+e\s+musica|parole\s+e\s+musica|music(?:\s+by)?|testo|di)\s*(?:di)?\s*[:–-]?\s+)(.+)$/i;
const UI=/^(?:oggi|ieri|foto|photo|modifica|salva|condividi|seleziona|biblioteca|testflight|allegati|album|ritaglia|opzioni|scansione|immagine|documento|indietro|autoscroll|automatico)$/i;
const RELIGIOUS=/^(?:signore|cristo|ges[uù]|dio|padre|santo|santa|spirito|maria|pietà|pieta|re|mio|mia|alleluia|alleluja)$/i;
function clean(s){return String(s||'').normalize('NFC').replace(/\s+/g,' ').replace(/^[•·*]+|[•·*]+$/g,'').trim();}
function timeOrUI(s){return !s||UI.test(s)||/^\d{1,2}[:.]\d{2}(?:\s*[AP]M)?$/i.test(s)||/^\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}$/.test(s)||/^[<>▶■♫♪↑↓⇧⇩ ]+$/.test(s);}
function isMusic(s){
 const words=s.replace(/[,:;]+/g,' ').split(/\s+/).filter(Boolean);
 const chords=words.filter(w=>NOTE.test(w)).length;
 return MUSIC_HEADING.test(s)||(words.length>=2&&chords>=2&&chords/words.length>=.5)||
   (words.length>=9&&chords===0);
}
function properName(s){
 const words=clean(s).replace(/[.,;]+$/,'').split(/\s+/);
 if(words.length<2||words.length>5||words.some(w=>/\d/.test(w)))return false;
 const names=words.filter(w=>/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:['’][A-ZÀ-ÖØ-Þa-zà-öø-ÿ]+)?$/.test(w));
 if(names.length<2||names.length<words.length-1)return false;
 if(words.some(w=>RELIGIOUS.test(w)||NOTE.test(w)||UI.test(w)))return false;
 return words.every(w=>names.includes(w)||/^(?:de|del|della|di|da|van|von|le)$/i.test(w));
}
function titleLike(s){
 const x=clean(s);
 return x.length>=5&&x.length<=110&&x.split(/\s+/).length<=12&&!timeOrUI(x)&&
 !isMusic(x)&&!CREDIT.test(x)&&!/^(?:titolo|autore|testo|musica)\s*:?$/i.test(x)&&
 !/^[0-9#@]/.test(x)&&/[\p{L}]{3,}/u.test(x);
}
function metaRows(data){
 let rows=root.CantoriaGeometry?.extractRows?.(data)||[];
 if(!rows.length&&Array.isArray(data?.lines)){
  rows=data.lines.map((row,i)=>({id:'ocr-row-'+i,text:row.text||'',bbox:row.bbox||null,words:row.words||[]}));
 }
 return rows.map((row,i)=>({...row,id:row.id||'ocr-row-'+i,text:clean(row.text||row.words?.map(w=>w.text).join(' ')),height:Math.max(0,(row.bbox?.y1||0)-(row.bbox?.y0||0))}));
}
function analyze(data){
 const rows=metaRows(data||{});
 const scoreIndex=rows.findIndex(r=>isMusic(r.text));
 const limit=scoreIndex>=0?Math.min(scoreIndex,15):Math.min(rows.length,9);
 const header=rows.slice(0,limit);
 let title='',author='',titleIndex=-1,authorIndex=-1,confidence=0,source='';
 for(let i=0;i<header.length;i++){
  const x=header[i].text;
  const tm=x.match(METADATA_KEY),am=x.match(CREDIT);
  if(tm&&titleLike(tm[1])&&!title){title=clean(tm[1]);titleIndex=i;confidence=.96;source='explicit';}
  if(am&&properName(am[1])&&!author){author=clean(am[1]);authorIndex=i;confidence=Math.max(confidence,.93);source='explicit';}
 }
 // On printed hymn collections, a catalog number may precede an uppercase
 // title followed by the author's normal-cased name on the same line.
 if(!title){
  for(let i=0;i<header.length;i++){
   const x=header[i].text;
   const m=x.match(/^\d{1,3}\s+([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ\s'’\-]{4,}?)\s+([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+){1,3})$/);
   if(m&&titleLike(m[1])&&properName(m[2])){
    title=clean(m[1]).toLocaleLowerCase('it-IT').replace(/^\p{L}/u,l=>l.toLocaleUpperCase('it-IT'));
    author=clean(m[2]);titleIndex=i;authorIndex=i;confidence=.94;source='numbered-title';break;
   }
  }
 }
 // A prominent heading directly followed by a two/three-word personal name.
 // Source confidence comes from the layout pairing, not a catalogue lookup.
 if(!title||!author){
  let best=null;
  for(let i=0;i<header.length-1;i++){
   const t=header[i];
   if(!titleLike(t.text)||properName(t.text))continue;
   for(let j=i+1;j<=Math.min(i+2,header.length-1);j++){
    const a=header[j];
    if(!properName(a.text))continue;
    const gap=t.bbox&&a.bbox?a.bbox.y0-t.bbox.y1:20;
    const nearby=gap>=-6&&gap<=Math.max(100,t.height*3);
    if(!nearby)continue;
    const score= (t.height>=a.height*.85?2:0)+(t.height>a.height*1.17?1:0)+
      (j===i+1?2:0)+(i===0?1:0)+(t.text.split(/\s+/).length>=2?1:0);
    if(score>=4&&(!best||score>best.score))best={i,j,score};
   }
  }
  if(best){
   if(!title){title=header[best.i].text;titleIndex=best.i;}
   if(!author){author=header[best.j].text;authorIndex=best.j;}
   confidence=Math.max(confidence,.91);source=source||'header-pair';
  }
 }
 // If title is printed in a visibly larger font than the score, it can
 // stand alone. Never mistake an ordinary lyric line for such a heading.
 if(!title&&scoreIndex>=0){
  const ref=rows[scoreIndex]?.height||0;
  const candidates=header.filter(r=>titleLike(r.text)&&!properName(r.text)&&
   r.height>=Math.max(28,ref*1.35));
  if(candidates.length===1){title=candidates[0].text;titleIndex=rows.indexOf(candidates[0]);confidence=.8;source='large-heading';}
 }
 // Read explicit metadata from plain text only when word boxes are unavailable.
 if(!rows.length){
  const lines=String(data?.text||'').split(/\r?\n/).map(clean).slice(0,8);
  for(const line of lines){
   const t=line.match(METADATA_KEY),a=line.match(CREDIT);
   if(t&&titleLike(t[1]))title=clean(t[1]);
   if(a&&properName(a[1]))author=clean(a[1]);
  }
  if(title||author){confidence=.93;source='explicit-text';}
 }
 // Suppress metadata and screenshot controls preceding the score; never
 // suppress unverified sung lines or chords.
 const recognized=!!(title||author);
 const lastHeaderIndex=Math.max(titleIndex,authorIndex);
 const end=recognized?(scoreIndex>=0?scoreIndex:lastHeaderIndex+1):0;
 const excludedRowIds=end>0?rows.slice(0,end).filter(r=>!isMusic(r.text)).map(r=>r.id):[];
 return Object.freeze({title:title.slice(0,160),author:author.slice(0,160),
  confidence,source,excludedRowIds});
}
const api=Object.freeze({analyze,properName,titleLike});
root.CantoriaMetadata=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
