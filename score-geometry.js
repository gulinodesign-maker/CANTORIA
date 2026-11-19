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
  function classifyChordRow(row) {
    const tokens=row.words.map(w=>({word:w,symbol:note(w.text)}));
    const valid=tokens.filter(t=>t.symbol);
    const uppercase=tokens.filter(t=>t.word.text===t.word.text.toUpperCase()&&
      /[A-Z]/.test(t.word.text)).length;
    // Never classify an ordinary lowercase lyric as a chord row.
    const likely=tokens.length===1?
      valid.length===1&&uppercase===1 :
      valid.length>=2&&valid.length/tokens.length>=0.6&&uppercase>=2;
    if(!likely)return null;
    return {row, chords:tokens.filter(t=>t.symbol).map(t=>({
      symbol:t.symbol, originalSymbol:t.word.text, bbox:t.word.bbox,
      confidence:t.word.confidence
    })), unresolved:tokens.filter(t=>!t.symbol).map(t=>({
      originalSymbol:t.word.text, bbox:t.word.bbox, confidence:t.word.confidence
    }))};
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
    const x=source.bbox.x0, halfHeight=(lyric.bbox.y1-lyric.bbox.y0)/2;
    const ranked=chars.map(c=>({c,d:Math.abs(c.bbox.x0-x)})).sort((a,b)=>a.d-b.d);
    const best=ranked[0], runner=ranked[1];
    if(!best)return {chord:source.symbol, sourceSymbol:source.originalSymbol,
      sourceX:x,sourceBBox:source.bbox,confidence:0,needsReview:true,
      anchorCharacterIndex:null,slot:null,unresolved:true};
    const width=Math.max(1,best.c.bbox.x1-best.c.bbox.x0);
    const gap=best.d/(width||1);
    const ambiguous=runner&&Math.abs(best.d-runner.d)<width*0.25;
    const wordOnly=!best.c.precise;
    const confidence=Math.max(0,Math.min(1,(source.confidence||0)/100))*
      (wordOnly?0.6:1)*(gap>2?0.35:gap>0.8?0.7:1)*(ambiguous?0.55:1);
    const before=lyric.text.slice(0,best.c.index);
    const priorWords=(before.match(/\\S+/g)||[]).length;
    const slot=Math.max(0,priorWords-(/\\S$/.test(before)?1:0));
    return {
      chord:source.symbol,symbol:source.symbol,sourceSymbol:source.originalSymbol,
      slot:Math.max(0,slot),anchorCharacterIndex:best.c.index,
      sourceX:x,sourceY:source.bbox.y0,sourceBBox:source.bbox,
      sourceCharX:best.c.bbox.x0,sourceCharWidth:width,
      offsetX:x-best.c.bbox.x0,
      anchorMethod:wordOnly?'word-estimated':'character-box',
      confidence:Number(confidence.toFixed(3)),
      verified:false,needsReview:wordOnly||gap>0.8||!!ambiguous||
        confidence<0.88||source.originalSymbol!==source.symbol,
      sourceLineBBox:lyric.bbox,
      sourceRowId:source.rowId||null
    };
  }
  function parseGeometry(data) {
    const rows=extractRows(data),sections=[];let current=null,pending=null;
    const diagnostics={totalRecognized:0,totalAnchored:0,unresolved:0,estimated:0,
      needsReview:0,sourceRows:rows.length,sourceMethod:'tesseract-bbox'};
    function ensure(){if(!current){current=section('STROFA',sections.length);sections.push(current);}return current;}
    function leftover() {
      if(!pending)return;
      const sec=ensure();
      const row=pending.row, items=pending.chords;
      if(!sec.lines.length&&!sec.chordsOnly){sec.chordsOnly=items.map(c=>c.symbol);
        sec.chordsOnlyGeometry=items.map(c=>({symbol:c.symbol,sourceX:c.bbox.x0,
          sourceBBox:c.bbox,sourceLineBBox:row.bbox,needsReview:true}));
      }else{(sec.chordRows||=[]).push(items.map(c=>c.symbol));
        (sec.chordRowsGeometry||=[]).push(items.map(c=>({symbol:c.symbol,
          sourceX:c.bbox.x0,sourceBBox:c.bbox,sourceLineBBox:row.bbox,needsReview:true})));}
      diagnostics.unresolved+=pending.unresolved.length;
      pending=null;
    }
    for(const row of rows){
      if(HEAD.test(row.text.trim())){
        leftover();current=section(row.text.trim().replace(/:\s*$/,''),sections.length);
        sections.push(current);continue;
      }
      const chordRow=classifyChordRow(row);
      if(chordRow){leftover();pending=chordRow;diagnostics.totalRecognized+=chordRow.chords.length;continue;}
      if(!pending&&!current&&rows[0]===row&&row.text.length<90&&rows.length>1){
        // Only propose a title; never silently discard it from the source.
        // Caller can set a title separately, so preserve as diagnostic.
        diagnostics.titleCandidate=row.text;
        continue;
      }
      const sec=ensure(),chars=charCoordinates(row);
      const anchors=pending?pending.chords.map(c=>bindChord({...c,rowId:pending.row.id},row,chars)):[];
      const uncertain=pending?pending.unresolved:[];
      diagnostics.totalAnchored+=anchors.length;
      diagnostics.unresolved+=uncertain.length;
      diagnostics.estimated+=anchors.filter(a=>a.anchorMethod==='word-estimated').length;
      diagnostics.needsReview+=anchors.filter(a=>a.needsReview).length+uncertain.length;
      sec.lines.push({id:'photo-line-'+sec.lines.length,marked:row.text,
        originalText:row.text,sourceLineBBox:row.bbox,
        sourceRowId:row.id,anchors,
        unresolvedChords:uncertain.map(c=>({...c,needsReview:true}))});
      pending=null;
    }
    leftover();
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
