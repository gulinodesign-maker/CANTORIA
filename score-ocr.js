/* Cantoria: assisted photo-to-song transcription.
   OCR alone does not recognize musical notation, and anchors remain unverified.
   No data is sent from this module to any server. */
(function (root) {
  "use strict";
  const CHORD = /^(SOL|DO|RE|MI|FA|LA|SI)(?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add)?[0-9+\-°()]*)?(?:\/(?:(?:SOL|DO|RE|MI|FA|LA|SI)(?:#|b)?|[0-9]{1,2}))?$/i;
  const SECTION = /^(INTRO(?:DUZIONE)?|STROFA(?:\s+(?:\d+|[IVX]+))?|RITORNELLO|CORO|REFRAIN|PONTE|BRIDGE|FINALE|OUTRO|CODA)\s*:?\s*$/i;

  function chordName(token) {
    const s = String(token || "").replace(/♯/g, "#").replace(/♭/g, "b")
      .replace(/^[([{]+|[\])},;:.]+$/g, "").trim();
    if (!CHORD.test(s)) return "";
    const upperNote = (root, accidental) => root.toUpperCase() +
      (accidental ? (accidental.toLowerCase() === 'b' ? 'b' : '#') : '');
    return s.replace(/^(SOL|DO|RE|MI|FA|LA|SI)(#|b)?/i,
      (all, root, accidental) => upperNote(root, accidental))
      .replace(/\/(SOL|DO|RE|MI|FA|LA|SI)(#|b)?$/i,
        (all, root, accidental) => '/' + upperNote(root, accidental));
  }
  // OCR confuses similarly shaped characters in musical chord symbols.
  // Only repair these tokens in a row already identified as a chord row;
  // never modify ordinary Italian lyrics.
  function chordFromOcr(token) {
    const raw = String(token || "").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, digit =>
      "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(digit).toString());
    const normalized = raw.replace(/^S[1lI](?=[#b0-9+°()/\-]|$)/i, "SI")
      .replace(/^[1lI]A(?=[#b0-9+°()/\-]|$)/i, "LA")
      .replace(/^D0(?=[#b0-9+°()/\-]|$)/i, "DO")
      .replace(/^S0L/i, "SOL")
      .replace(/^M[1lI](?=[#b0-9+°()/\-]|$)/i, "MI")
      .replace(/\/S[1lI](?=[#b0-9+°()/\-]|$)/i, "/SI")
      .replace(/\/M[1lI](?=[#b0-9+°()/\-]|$)/i, "/MI")
      .replace(/\/D0(?=[#b0-9+°()/\-]|$)/i, "/DO");
    return chordName(normalized);
  }
  // Split glued chord symbols only when every piece is a real Italian chord.
  // The caller must confirm chord-row context before using these candidates
  // on photographed text: words in ordinary lyrics must not be segmented.
  function splitChordCluster(token) {
    const raw=String(token||'').trim().replace(/♯/g,'#').replace(/♭/g,'b');
    if(!raw||raw.length>36||chordName(raw))return [];
    // OCR often joins SOLDO, MI-LA-, FA7+DO, RE/LA DO, or SOL4RE.
    const starts=[...raw.matchAll(/SOL|DO|RE|MI|FA|LA|SI/gi)].map(m=>m.index);
    if(starts[0]!==0||starts.length<2||starts.length>7)return [];
    const candidates=[];
    function visit(offset,parts){
      if(parts.length>5)return;
      if(offset===raw.length){if(parts.length>=2)candidates.push(parts);return;}
      for(const stop of [...starts.filter(i=>i>offset),raw.length]){
        const text=raw.slice(offset,stop),symbol=chordName(text);
        if(symbol)visit(stop,[...parts,{chord:symbol,start:offset,end:stop,text}]);
      }
    }
    visit(0,[]);
    if(!candidates.length)return [];
    // Prefer valid slash chords over incorrectly splitting their bass note.
    candidates.sort((a,b)=>a.length-b.length||
      b.filter(x=>x.chord.includes('/')).length-a.filter(x=>x.chord.includes('/')).length);
    return candidates[0];
  }
  function readChordRow(words, original) {
    if (!words.length) return null;
    const items = words.flatMap(word => {
      const raw=word[0],whole=chordName(raw);
      if(whole)return [{chord:whole,start:word.index,source:raw}];
      const parts=splitChordCluster(raw);
      // Only uppercase merged chord rows: normal prose such as "dore" and
      // lowercase lyrics must never be classified as chord combinations.
      if(parts.length>=2&&raw===raw.toUpperCase()&&/[A-Z]{2}/.test(raw))
        return parts.map(p=>({chord:p.chord,start:word.index+p.start,source:p.text,split:true}));
      return [{chord:"",start:word.index,source:raw}];
    });
    const matched = items.filter(item => item.chord).length;
    if (matched < 1) return null;
    // A stray OCR token should not turn the whole chord row into lyrics.
    const likelyRow = (items.length >= 2 && matched >= 2 &&
      matched / items.length >= 0.6) ||
      (items.length === 1 && matched === 1 &&
        /^[A-Z]{2,4}(?:[#b0-9+\\-]|$)/.test(original.trim()));
    if (!likelyRow) return null;
    const recovered = items.map(item => ({
      chord: item.chord || chordFromOcr(item.source), start: item.start
    })).filter(item => item.chord);
    return recovered.length ? { text: original, items: recovered } : null;
  }
  function section(name, index) {
    const heading = String(name).toUpperCase();
    return {
      id: "photo-section-" + index,
      name: heading,
      kind: /^INTRO/.test(heading) ? "intro" :
        /RITORNELLO|CORO|REFRAIN/.test(heading) ? "chorus" :
        /FINALE|OUTRO|CODA/.test(heading) ? "outro" : "verse",
      lines: []
    };
  }
  function syllableCells(line) {
    const cells = [];
    for (const match of line.matchAll(/[^\s|]+/g)) {
      cells.push({ text: match[0], start: match.index });
    }
    return cells;
  }
  function anchorChords(chordRow, lyricRow) {
    const lyrics = lyricRow.trim();
    const cells = syllableCells(lyrics);
    if (!cells.length) return [];
    const firstCell = cells[0].start;
    const lyricIndent = lyricRow.length - lyricRow.trimStart().length;
    const chordIndent = chordRow.text.length - chordRow.text.trimStart().length;
    const anchors = [];
    for (const item of chordRow.items) {
      // Use preserved OCR columns, rather than spacing uniformly across words.
      const sourceColumn = item.start - chordIndent + lyricIndent;
      const target = Math.max(firstCell, sourceColumn);
      let slot = 0, distance = Infinity;
      for (let index = 0; index < cells.length; index++) {
        const d = Math.abs(cells[index].start - target);
        if (d < distance) { distance = d; slot = index; }
      }
      // Two chords on the same cell need manual attention. Preserve both labels.
      anchors.push({ slot, chord: item.chord });
    }
    return anchors.sort((a, b) => a.slot - b.slot);
  }
  function parse(source) {
    const raw = String(source || "").slice(0, 20000).replace(/\u00a0/g, " ").replace(/\t/g, "    ");
    const sections = [];
    let current = null, pending = null;
    function ensure() {
      if (!current) {
        current = section("STROFA", sections.length);
        sections.push(current);
      }
      return current;
    }
    function flushPending() {
      if (!pending) return;
      const sec = ensure();
      const chords = pending.items.map(x => x.chord);
      if (!sec.lines.length && !sec.chordsOnly) sec.chordsOnly = chords;
      else (sec.chordRows ||= []).push(chords);
      pending = null;
    }
    for (const original of raw.split(/\r?\n/)) {
      const text = original.trim();
      if (!text || text.length > 350) continue;
      const match = text.match(SECTION);
      if (match) {
        flushPending();
        current = section(match[1], sections.length);
        sections.push(current);
        continue;
      }
      const words = [...original.matchAll(/\S+/g)];
      const chordRow = readChordRow(words, original);
      if (chordRow) {
        flushPending();
        pending = chordRow;
        continue;
      }
      const cleaned = text.replace(/[\u0000-\u001f@©®™�¤]/g, "").trim();
      if (!cleaned || !syllableCells(cleaned).length) continue;
      ensure().lines.push({
        marked: cleaned,
        anchors: pending ? anchorChords(pending, original) : []
      });
      pending = null;
    }
    flushPending();
    return sections.filter(s => s.lines.length || s.chordsOnly?.length || s.chordRows?.length);
  }
  function stats(sections) {
    return (sections || []).reduce((a, s) => {
      a.sections++;
      a.lines += (s.lines || []).length;
      a.chords += (s.chordsOnly || []).length + (s.chordRows || []).flat().length +
        (s.lines || []).reduce((sum, line) => sum + (line.anchors || []).length, 0);
      return a;
    }, { sections: 0, lines: 0, chords: 0 });
  }
  const api = Object.freeze({ parse, stats, chordName, chordFromOcr, splitChordCluster, syllableCells });
  root.CantoriaOCR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
