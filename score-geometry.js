/* Cantoria: geometry-first chord alignment.
   Coordinates are never inferred from spaces in an OCR text dump.
   Word-level OCR is not character-accurate; its candidates REQUIRE verification.
   Pure module, no network requests or external dependencies. */
(function (root) {
  "use strict";
  const HEAD = /^(INTRO(?:DUZIONE)?|STROFA(?:\s+(?:\d+|[IVX]+))?|RITORNELLO|CORO|REFRAIN|PONTE|BRIDGE|FINALE|OUTRO|CODA)\s*:?[\s]*$/i;
  function finite(n) { return Number.isFinite(n); }
  function box(b) {
    if (!b) return null;
    const a = [Number(b.x0),Number(b.y0),Number(b.x1),Number(b.y1)];
    if (!a.every(finite) || a[2] <= a[0] || a[3] <= a[1]) return null;
    return {x0:a[0],y0:a[1],x1:a[2],y1:a[3]};
  }
  function union(boxes) {
    const list = boxes.filter(Boolean);
    if (!list.length) return null;
    return {x0:Math.min(...list.map(b=>b.x0)), y0:Math.min(...list.map(b=>b.y0)),
      x1:Math.max(...list.map(b=>b.x1)), y1:Math.max(...list.map(b=>b.y1))};
  }
  function wordsFromLine(line) {
    return (Array.isArray(line.words)?line.words:[]).map(w=>({
      text:String(w.text||'').trim(), bbox:box(w.bbox),
      confidence:finite(Number(w.confidence))?Number(w.confidence):0,
      symbols:Array.isArray(w.symbols)?w.symbols.map(s=>({text:String(s.text||''),bbox:box(s.bbox)})):[]
    })).filter(w=>w.text&&w.bbox).sort((a,b)=>a.bbox.x0-b.bbox.x0);
  }
  function linesFromBlocks(blocks) {
    const lines=[];
    for(const block of blocks||[])for(const par of block.paragraphs||[])for(const line of par.lines||[])lines.push(line);
    return lines;
  }
  function groupLooseWords(words) {
    const clusters=[];
    for(const word of words.filter(w=>w.bbox).sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1))){
      const center=(word.bbox.y0+word.bbox.y1)/2, height=word.bbox.y1-word.bbox.y0;
      const bucket=clusters.find(c=>Math.abs(c.center-center)<Math.min(c.height,height)*0.48);
      if(bucket){bucket.words.push(word);bucket.center=(bucket.center*(bucket.words.length-1)+center)/bucket.words.length;}
      else clusters.push({center,height,words:[word]});
    }
    return clusters.map(c=>({words:c.words}));
  }
  function extractRows(data) {
    if(!data||typeof data!=='object')return [];
    let lines=Array.isArray(data.lines)&&data.lines.length?data.lines:linesFromBlocks(data.blocks);
    if(!lines.length&&Array.isArray(data.words))lines=groupLooseWords(data.words);
    return lines.map((line,index)=>{
      const words=wordsFromLine(line);
      const bbox=union(words.map(w=>w.bbox));
      return {id:'ocr-row-'+index, text:words.map(w=>w.text).join(' '), bbox, words,
        confidence:words.length?words.reduce((a,w)=>a+w.confidence,0)/words.length:0};
    }).filter(l=>l.words.length&&l.bbox).sort((a,b)=>a.bbox.y0-b.bbox.y0);
  }
  function section(name,index) {
    const n=String(name).toUpperCase();
    return {id:'photo-section-'+index,name:n,kind:/^INTRO/.test(n)?'intro':
      /RITORNELLO|CORO|REFRAIN/.test(n)?'chorus':
      /FINALE|OUTRO|CODA/.test(n)?'outro':'verse',lines:[]};
  }
  function note(name) {
    const a=root.CantoriaOCR;
    if(!a)return '';
    return a.chordName(name)||a.chordFromOcr?.(name)||'';
  }
  // Browser UI labels, watermarks and OCR punctuation are not sung lyrics.
  // Keep ordinary punctuation and hyphenation; strip ONLY known artefacts.
  const JUNK_SYMBOLS = /[@©®™�¤]/g;
  const JUNK_TOKEN = /^[@©®™�¤]+$/;
  const UI_LABEL = /^(?:AUTO[\s-]*SCROLL|SCORRIMENTO\s+AUTOMATICO)(?:\s+(?:ON|OFF|ATTIVO|DISATTIVO))?$/i;
  function isEditorialRow(row) {
    const text=row.text.trim();
    // Stray final pieces, such as "ma «", come from non-lyric marks on
    // photographed score borders and must not create a new sung line.
    return UI_LABEL.test(text)||/^[a-zà-ÿ]{1,3}\s*[«»]+$/i.test(text);
  }
  function isChordLikeToken(raw,symbol) {
    if(symbol)return true;
    const token=String(raw||'').replace(JUNK_SYMBOLS,'').trim();
    if(!token||token.length>13)return false;
    // Isolated I/1 are ambiguous but MAY belong to a real chord row.
    if(/^[iIl1]$/.test(token))return true;
    // An OCR-damaged symbol has a short note-like root or chord suffix.
    // Never classify entire ordinary Italian words by uppercase alone.
    if(/^(?:S[Il1]|M[Il1]|[Dd][Oo0]|[Rr][Ee]|[Ff][Aa]|[Ll][Aa]|[Ss][Oo0][Ll]|[Ss][Ii])(?:[#♯b♭0-9⁰¹²³⁴⁵⁶⁷⁸⁹+°/()-]|m|M|sus|maj|min|dim|add)*$/i.test(token))
      return true;
    return /^[A-Z]{1,2}[#♯b♭]?[0-9⁰¹²³⁴⁵⁶⁷⁸⁹+°/()-]{1,5}$/.test(token) ||
      /^(?:M|m|MI|Mi|SI|Si)\/[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]{1,2}$/.test(token);
  }
  function isLikelyLyricBelow(row,below) {
    if(!below||!row.bbox||!below.bbox||below.bbox.y0<=row.bbox.y0)return false;
    const words=below.words.filter(w=>!JUNK_TOKEN.test(w.text));
    const regular=words.filter(w=>!note(w.text)).length;
    return words.length>=2 && regular>=Math.ceil(words.length*0.6) &&
      words.some(w=>/[a-zà-öø-ÿ]{2,}/.test(w.text));
  }
  // Spurious OCR marks are NOT chords, lyrics or useful unknown notes.
  const OCR_MARK = /^[^A-Za-zÀ-ÿ0-9]+$/;
  const CHORD_ANNOTATION = /^(?:intro|rit(?:ornello)?|strofa|finale|outro|fine)[:,;.]?$/i;
  function isNumberedTitle(row) {
    // e.g. "63 FRUTTO DELLA NOSTRA TERRA Francesco Buttazzo".
    // Source titles belong to metadata, not the sung lyrics.
    return /^[0-9]{1,3}[ ]+/.test(row.text.trim()) && row.words.slice(1).filter(w=>/^[A-ZÀ-Ý]{3,}$/.test(w.text)).length>=3;
  }
  function classifyChordRow(row,nextRow) {
    const words=row.words.filter(w=>!JUNK_TOKEN.test(w.text)&&
      !OCR_MARK.test(w.text)&&!CHORD_ANNOTATION.test(w.text));
    if(!words.length||words.length>12)return null;
    // A standalone seventh is printed as "7" in some chord sheets.
    // Preserve it only inside a geometrically confirmed chord row.
    const tokens=words.map(w=>({word:w,symbol:note(w.text)||
      (w.text.trim()==='7'?'7':'')}));
    const valid=tokens.filter(t=>t.symbol);
    const uppercase=tokens.filter(t=>t.word.text===t.word.text.toUpperCase()&&
      /[A-Z]/.test(t.word.text)).length;
    // Printed chord sheets often show Title Case: "Sol Do Sol Re", or "Mi- Si- Do Re".
    // The old parser required two ALL-UPPERCASE chords, leaking such rows into lyrics.
    const capitalized=tokens.filter(t=>/^[A-ZÀ-Ý]/.test(t.word.text)).length;
    const belowIsLyric=isLikelyLyricBelow(row,nextRow);
    const allLookLikeChords=tokens.every(t=>isChordLikeToken(t.word.text,t.symbol));
    const hasStrongShape=tokens.some(t=>/[0-9⁰¹²³⁴⁵⁶⁷⁸⁹#♯♭+°/()-]/.test(t.word.text));
    const ratio=valid.length/tokens.length;
    const obvious=valid.length>=2&&ratio>=0.6&&uppercase>=2;
    // Geometry is essential when using title-case note names. Two or more
    // initial-cap note names above a real lyric row is strong evidence; ordinary
    // lowercase song text "Mi la fa sol" must stay lyrics.
    const titled=belowIsLyric&&valid.length>=2&&ratio>=0.55&&capitalized>=2;
    const contextual=belowIsLyric&&allLookLikeChords&&(
      (valid.length>=1&&(uppercase>=1||hasStrongShape))||
      (valid.length===0&&hasStrongShape&&uppercase>=1));
    const single=tokens.length===1&&valid.length===1&&uppercase===1;
    if(!(single||obvious||titled||contextual))return null;
    // Once the row has been positively classified as a chord row, every
    // unrecognized short plausible symbol stays in the chord band as '?'.
    // Do not invent its root, and never send it to the sung lyric line.
    const unresolved=tokens.filter(t=>!t.symbol).map(t=>({
      symbol:'?',unresolved:true,originalSymbol:t.word.text,
      bbox:t.word.bbox,confidence:0
    }));
    return {row,chords:valid.map(t=>({
      symbol:t.symbol,originalSymbol:t.word.text,bbox:t.word.bbox,
      confidence:t.word.confidence
    })),unresolved};
  }
  // Filter OCR graphic marks from the lyric layer, not from chord symbols.
  // Keep common sung punctuation (comma, apostrophe, period, ?, ! and
  // in-word hyphen), but discard scanner scratches, slashes, brackets, etc.
  function cleanLyricToken(raw) {
    const source=String(raw||'').normalize('NFC');
    if(!/[\p{L}\p{N}]/u.test(source))return '';
    let cleaned=source.replace(JUNK_SYMBOLS,'')
      .replace(/[^\p{L}\p{N}'’.,!?;:\-]/gu,'')
      .replace(/^[—–-]+|[—–-]+$/g,'');
    // A single 'T' read from 'T°' is still a scan artefact, not a word.
    if(/^[A-Z]$/.test(cleaned)&&/[°\\/~=+]/.test(source))return '';
    if(!/[\p{L}\p{N}]/u.test(cleaned))return '';
    return cleaned;
  }
  // Discard short machine noise, never a musical line with clear Italian words.
  function isBrokenOcrRow(row) {
    const tokens=row.words.map(w=>w.text.trim());
    if(tokens.length<3||tokens.length>7)return false;
    const digits=tokens.filter(x=>/^[0-9]{1,2}$/.test(x)).length;
    const consonantBlocks=tokens.filter(x=>/^[A-Z]{2,4}$/.test(x)&&!/[AEIOU]/.test(x)).length;
    const mixed=tokens.filter(x=>/^[a-z][A-Z]$/.test(x)).length;
    return digits>=1 && consonantBlocks>=1 && mixed>=1 &&
      !tokens.some(x=>/[À-ÿ,.!?;:'’]/.test(x));
  }
  function cleanLyricRow(row,diagnostics) {
    if(isEditorialRow(row)||isBrokenOcrRow(row)) {
      diagnostics.ignoredArtifacts++;
      return null;
    }
    const cleanedWords=[];
    for(let i=0;i<row.words.length;i++){
      const original=row.words[i],text=cleanLyricToken(original.text);
      if(text!==original.text)diagnostics.ignoredArtifacts++;
      if(!text)continue;
      // OCR endings like "quotidianità. == ge": the two-letter fragment
      // immediately after a removed decoration is not a lyric.
      const precededByMark=i>0&&!cleanLyricToken(row.words[i-1].text);
      if(i===row.words.length-1&&precededByMark&&/^[a-zà-ÿ]{1,2}$/i.test(text)
        &&row.words.slice(0,i-1).some(w=>/[.!?]$/.test(w.text))){
        diagnostics.ignoredArtifacts++;
        continue;
      }
      cleanedWords.push({...original,text,symbols:text===original.text?original.symbols:[]});
    }
    if(!cleanedWords.length)return null;
    return {...row,words:cleanedWords,
      text:cleanedWords.map(w=>w.text).join(' '),bbox:union(cleanedWords.map(w=>w.bbox)),
      originalOcrText:row.text};
  }
  function charCoordinates(row) {
    let offset=0;const chars=[];
    for(const word of row.words) {
      if(offset)offset++; // one normalised space between OCR words
      const text=word.text, symbols=word.symbols;
      let actual=null;
      if(symbols.length&&symbols.every(s=>s.bbox)&&
        symbols.map(s=>s.text).join('')===text){
        actual=[];
        let i=0;
        for(const sym of symbols)for(const chr of sym.text){
          actual.push({index:offset+i, char:chr, bbox:sym.bbox,precise:sym.text.length===1});
          i+=chr.length;
        }
      }
      if(actual?.length){chars.push(...actual);}
      else {
        // Interpolation is only a provisional point INSIDE a measured word box.
        // Never represent this as an exact character position.
        for(let i=0;i<text.length;i++){
          const w=(word.bbox.x1-word.bbox.x0)/text.length;
          chars.push({index:offset+i,char:text[i],precise:false,bbox:{
            x0:word.bbox.x0+w*i,y0:word.bbox.y0,
            x1:word.bbox.x0+w*(i+1),y1:word.bbox.y1}});
        }
      }
      offset+=text.length;
    }
    return chars;
  }
  function bindChord(source,lyric,chars) {
    const x=source.bbox.x0;
    const ranked=chars.map(c=>({c,d:Math.abs(c.bbox.x0-x)})).sort((a,b)=>a.d-b.d);
    const best=ranked[0], runner=ranked[1];
    if(!best)return {chord:source.symbol, sourceSymbol:source.originalSymbol,
      sourceX:x,sourceBBox:source.bbox,confidence:0,needsReview:true,
      anchorCharacterIndex:null,slot:null,unresolved:true};
    const width=Math.max(1,best.c.bbox.x1-best.c.bbox.x0);
    const gap=best.d/(width||1);
    const ambiguous=runner&&Math.abs(best.d-runner.d)<width*0.25;
    const wordOnly=!best.c.precise;
    const confidence=(source.unresolved?0:Math.max(0,Math.min(1,(source.confidence||0)/100)))*
      (wordOnly?0.6:1)*(gap>2?0.35:gap>0.8?0.7:1)*(ambiguous?0.55:1);
    const before=lyric.text.slice(0,best.c.index);
    const priorWords=(before.match(/\S+/g)||[]).length;
    const slot=Math.max(0,priorWords-(/\S$/.test(before)?1:0));
    return {
      chord:source.symbol,symbol:source.symbol,sourceSymbol:source.originalSymbol,
      slot:Math.max(0,slot),anchorCharacterIndex:best.c.index,
      sourceX:x,sourceY:source.bbox.y0,sourceBBox:source.bbox,
      sourceCharX:best.c.bbox.x0,sourceCharWidth:width,
      offsetX:x-best.c.bbox.x0,
      anchorMethod:wordOnly?'word-estimated':'character-box',
      confidence:Number(confidence.toFixed(3)),
      verified:false,unresolved:!!source.unresolved,
      needsReview:!!source.unresolved||wordOnly||gap>0.8||!!ambiguous||
        confidence<0.88||source.originalSymbol!==source.symbol,
      sourceLineBBox:lyric.bbox,
      sourceRowId:source.rowId||null
    };
  }
  function parseGeometry(data) {
    const rows=extractRows(data),sections=[];let current=null,pending=null;
    const diagnostics={totalRecognized:0,totalAnchored:0,unresolved:0,estimated:0,
      needsReview:0,ignoredArtifacts:0,sourceRows:rows.length,sourceMethod:'tesseract-bbox'};
    function ensure(){if(!current){current=section('STROFA',sections.length);sections.push(current);}return current;}
    function leftover() {
      if(!pending)return;
      const sec=ensure();
      const row=pending.row,items=[...pending.chords,...pending.unresolved]
        .sort((a,b)=>a.bbox.x0-b.bbox.x0);
      if(!sec.lines.length&&!sec.chordsOnly){sec.chordsOnly=items.map(c=>c.symbol);
        sec.chordsOnlyGeometry=items.map(c=>({symbol:c.symbol,sourceX:c.bbox.x0,
          sourceBBox:c.bbox,sourceLineBBox:row.bbox,needsReview:true}));
      }else{(sec.chordRows||=[]).push(items.map(c=>c.symbol));
        (sec.chordRowsGeometry||=[]).push(items.map(c=>({symbol:c.symbol,
          sourceX:c.bbox.x0,sourceBBox:c.bbox,sourceLineBBox:row.bbox,needsReview:true})));}
      diagnostics.unresolved+=pending.unresolved.length;
      pending=null;
    }
    for(let rowIndex=0;rowIndex<rows.length;rowIndex++){
      const row=rows[rowIndex],nextRow=rows[rowIndex+1];
      if(isEditorialRow(row)){diagnostics.ignoredArtifacts++;continue;}
      if(rowIndex===0&&isNumberedTitle(row)){
        diagnostics.titleCandidate=row.text.trim();
        diagnostics.ignoredArtifacts++;
        continue;
      }
      if(row.words.length===1&&OCR_MARK.test(row.text.trim())){
        diagnostics.ignoredArtifacts++;
        continue;
      }
      if(diagnostics.titleCandidate&&rowIndex<4&&row.words.length===1&&
        /^[A-Z]{2,3}$/.test(row.text.trim())&&!note(row.text.trim())){
        // OCR noise close to a numbered title, e.g. isolated "TNS".
        diagnostics.ignoredArtifacts++;
        continue;
      }
      if(HEAD.test(row.text.trim())){
        leftover();current=section(row.text.trim().replace(/:\s*$/,''),sections.length);
        sections.push(current);continue;
      }
      const chordRow=classifyChordRow(row,nextRow);
      if(chordRow){leftover();pending=chordRow;diagnostics.totalRecognized+=chordRow.chords.length;continue;}
      if(!pending&&!current&&rows[0]===row&&row.text.length<90&&rows.length>1){
        // Only propose a title; never silently discard it from the source.
        // Caller can set a title separately, so preserve as diagnostic.
        diagnostics.titleCandidate=row.text;
        // Do not drop a text row just because it resembles a title.
        // The user can remove or rename it after comparing the photo.
      }
      // Standalone RIT / RIT. at the beginning of a lyric is a SECTION label,
      // not a word the congregation is supposed to sing.
      let lyricSource=row;
      if(row.words.length>=3&&/^RIT(?:[.:])?$/i.test(row.words[0].text)){
        current=section('RITORNELLO',sections.length);sections.push(current);
        lyricSource={...row,words:row.words.slice(1)};
      }
      const lyric=cleanLyricRow(lyricSource,diagnostics);
      if(!lyric)continue;
      const sec=ensure(),chars=charCoordinates(lyric);
      const chordItems=pending?[...pending.chords,...pending.unresolved]
        .sort((a,b)=>a.bbox.x0-b.bbox.x0):[];
      const anchors=chordItems.map(c=>bindChord({...c,rowId:pending.row.id},lyric,chars));
      const uncertain=pending?pending.unresolved:[];
      diagnostics.totalAnchored+=anchors.filter(a=>!a.unresolved).length;
      diagnostics.unresolved+=uncertain.length;
      diagnostics.estimated+=anchors.filter(a=>a.anchorMethod==='word-estimated').length;
      diagnostics.needsReview+=anchors.filter(a=>a.needsReview).length;
      sec.lines.push({id:'photo-line-'+sec.lines.length,marked:lyric.text,
        originalText:lyric.text,originalOcrText:row.text,
        sourceLineBBox:row.bbox,sourceRowId:row.id,anchors,
        unresolvedChords:uncertain.map(c=>({...c,needsReview:true}))});
      pending=null;
    }
    leftover();
    // Repeat-aware section discovery. Only infer a refrain if multiple original
    // lyric phrases repeat (at least three independent matches) and both
    // intervening verse groups contain multiple lines. Never invent chords.
    if(sections.length===1 && sections[0].kind==='verse'){
      const all=sections[0].lines||[];
      const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
      let found=null;
      for(let size=Math.min(6,Math.floor(all.length/3));size>=3&&!found;size--){
        for(let j=size+3;j+size<=all.length-3;j++){
          const score=Array.from({length:size},(_,k)=>
            norm(all[k].marked)===norm(all[j+k].marked)).filter(Boolean).length;
          if(score>=3&&score===size){found={size,j,score};break;}
        }
      }
      if(found){
        const groups=[
          {name:'RITORNELLO',kind:'chorus',firstRefrain:true,lines:all.slice(0,found.size)},
          {name:'STROFA 1',kind:'verse',lines:all.slice(found.size,found.j)},
          {name:'RITORNELLO',kind:'chorus',lines:all.slice(found.j,found.j+found.size)},
          {name:'STROFA 2',kind:'verse',lines:all.slice(found.j+found.size)}
        ];
        if(groups.every(g=>g.lines.length>=3)){
          sections.splice(0,1,...groups.map((g,i)=>({
            ...section(g.name,i),...g,id:'photo-section-'+i
          })));
          diagnostics.refrainInferredFromRepeats=true;
          diagnostics.suggestedTitle=all[0].marked;
        }
      }
    }
    // An OCR response without word boxes MUST NOT produce fabricated anchors.
    const valid=rows.length>0&&sections.some(s=>s.lines?.length);
    if(diagnostics.totalAnchored>diagnostics.totalRecognized)
      throw new Error('Riconoscimento incoerente: più accordi associati che rilevati');
    return {sections:valid?sections:[],diagnostics,hasGeometry:rows.length>0};
  }
  const api=Object.freeze({parseGeometry,extractRows,charCoordinates});
  root.CantoriaGeometry=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
