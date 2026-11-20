/* Cantoria 0.6.6: editable lyrics, safe musical anchors, vintage chord-band palette.
   All transformations are local and independent from OCR and rendering. */
(function(root){
 "use strict";
 const PALETTE=Object.freeze([
  Object.freeze({label:'Grigio perla',value:'#e5e5df'}),
  Object.freeze({label:'Grigio salvia',value:'#dfe4dc'}),
  Object.freeze({label:'Grigio caldo',value:'#e8e2da'}),
  Object.freeze({label:'Grigio azzurro',value:'#dee4e8'}),
  Object.freeze({label:'Grigio pietra',value:'#d8dad6'}),
  Object.freeze({label:'Grigio lino',value:'#ede8e0'})
 ]);
 const DEFAULTS=Object.freeze({
  intro:'#dee4e8',verse:'#e5e5df',chorus:'#e8e2da',outro:'#dfe4dc'
 });
 const KINDS=['intro','verse','chorus','outro'];
 function safeBandColor(value){
  return PALETTE.some(p=>p.value===value)?value:null;
 }
 function bandColor(song,kind){
  const k=KINDS.includes(kind)?kind:'verse';
  return safeBandColor(song?.bandColors?.[k])||DEFAULTS[k];
 }
 function setBandColor(song,kind,color){
  if(!song||!KINDS.includes(kind)||!safeBandColor(color))
   throw new Error('Colore o sezione non validi');
  song.bandColors={...(song.bandColors||{}),[kind]:color};
  return color;
 }
 // A single row can override the palette inherited from Intro/Strofa/
 // Ritornello/Finale. Keep overrides in the song, not in transient DOM state.
 function rowBandOverride(song,si,li,rowIndex){
  const section=song?.sections?.[si];
  if(!section)return null;
  if(Number.isInteger(rowIndex)){
   if(rowIndex===-1)return safeBandColor(section.chordsOnlyBandColor);
   return Array.isArray(section.chordRowsBandColors)?
    safeBandColor(section.chordRowsBandColors[rowIndex]):null;
  }
  return Number.isInteger(li)?safeBandColor(section.lines?.[li]?.bandColor):null;
 }
 function rowBandColor(song,si,li,rowIndex){
  const section=song?.sections?.[si];
  if(!section)return bandColor(song,'verse');
  return rowBandOverride(song,si,li,rowIndex)||bandColor(song,section.kind);
 }
 function setRowBandColor(song,si,li,rowIndex,color){
  const section=song?.sections?.[si];
  if(!section||!(color===''||safeBandColor(color)))
   throw new Error('Colore o riga musicale non validi');
  if(Number.isInteger(rowIndex)){
   if(rowIndex===-1){
    if(!Array.isArray(section.chordsOnly))
     throw new Error('Introduzione non disponibile');
    if(color)section.chordsOnlyBandColor=color;
    else delete section.chordsOnlyBandColor;
    return;
   }
   if(!Array.isArray(section.chordRows?.[rowIndex]))
    throw new Error('Riga degli accordi non disponibile');
   if(!Array.isArray(section.chordRowsBandColors))section.chordRowsBandColors=[];
   if(color)section.chordRowsBandColors[rowIndex]=color;
   else delete section.chordRowsBandColors[rowIndex];
   return;
  }
  const line=Number.isInteger(li)?section.lines?.[li]:null;
  if(!line)throw new Error('Riga del canto non disponibile');
  if(color)line.bandColor=color;
  else delete line.bandColor;
 }
 function visibleLyric(marked){return String(marked||'').replace(/\|/g,'');}
 function syllableCount(marked){
  let total=0;
  for(const chunk of String(marked).split(/(\s+)/)){
   if(!chunk||/^\s+$/.test(chunk))continue;
   for(const part of chunk.split('|'))if(part)total++;
  }
  return total;
 }
 function normalizeLyricInput(raw){
  const text=String(raw||'').normalize('NFC').replace(/\u00a0/g,' ').trim();
  if(!text||text.length>350||/[\r\n\u0000-\u001f]/.test(text))
   throw new Error('Scrivi una riga di testo valida (massimo 350 caratteri).');
  return text;
 }
 function editLine(line,input){
  if(!line||!Array.isArray(line.anchors))throw new Error('Riga non disponibile');
  const next=normalizeLyricInput(input);
  if(visibleLyric(line.marked)===next)return false;
  const count=syllableCount(next);
  if(!count)throw new Error('La riga deve contenere parole');
  line.marked=next;
  line.textEdited=true;
  for(const anchor of line.anchors){
   // Preserve original source geometry for provenance. Edited lyrics cannot
   // truthfully reuse an OCR index; anchors remain on the nearest existing
   // musical cell and are flagged for verification rather than re-guessed.
   if(!Number.isInteger(anchor.slot)||anchor.slot<0)anchor.slot=0;
   if(anchor.slot>=count)anchor.slot=count-1;
   anchor.anchorCharacterIndex=null;
   anchor.offsetX=null;
   anchor.sourceCharWidth=null;
   anchor.verified=false;
   anchor.needsReview=true;
  }
  return true;
 }
 function editSection(section,input){
  if(!section||!Array.isArray(section.lines))throw new Error('Sezione non disponibile');
  const rows=String(input||'').replace(/\r\n/g,'\n').split('\n');
  if(rows.length!==section.lines.length)
   throw new Error('Mantieni '+section.lines.length+' righe: gli accordi devono restare sulle rispettive frasi.');
  const backups=section.lines.map(line=>({
   ...line,anchors:(line.anchors||[]).map(a=>({...a}))
  }));
  let changed=0;
  try{
   rows.forEach((text,i)=>{if(editLine(section.lines[i],text))changed++;});
  }catch(err){
   backups.forEach((b,i)=>Object.assign(section.lines[i],b));
   throw err;
  }
  return changed;
 }
 const api=Object.freeze({PALETTE,DEFAULTS,bandColor,setBandColor,
  rowBandOverride,rowBandColor,setRowBandColor,
  visibleLyric,normalizeLyricInput,syllableCount,editLine,editSection});
 root.CantoriaEditor=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
