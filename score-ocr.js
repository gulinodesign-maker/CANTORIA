/* Cantoria: assisted photo-to-song transcription.
   OCR alone does not recognize musical notation, and anchors remain unverified.
   No data is sent from this module to any server. */
(function (root) {
  "use strict";
  const CHORD = /^(SOL|DO|RE|MI|FA|LA|SI)(?:#|b)?(?:(?:maj|min|dim|aug|sus|add)?[0-9+\-°()]*)?(?:\/(?:SOL|DO|RE|MI|FA|LA|SI)(?:#|b)?)?$/i;
  const SECTION = /^(INTRO(?:DUZIONE)?|STROFA(?:\s+(?:\d+|[IVX]+))?|RITORNELLO|CORO|REFRAIN|PONTE|BRIDGE|FINALE|OUTRO|CODA)\s*:?\s*$/i;

  function chordName(token) {
    const s = String(token || "").replace(/♯/g, "#").replace(/♭/g, "b")
      .replace(/^[([{]+|[\])},;:.]+$/g, "").trim();
    return CHORD.test(s) ? s.toUpperCase() : "";
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
      const found = words.map(word => ({ chord: chordName(word[0]), start: word.index }));
      const chordRow = found.length && found.every(word => word.chord) &&
        (found.length > 1 || /^[A-Z]{2,4}(?:[#b0-9+\-]|$)/.test(text));
      if (chordRow) {
        flushPending();
        pending = { text: original, items: found };
        continue;
      }
      const cleaned = text.replace(/[\u0000-\u001f]/g, "");
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
  const api = Object.freeze({ parse, stats, chordName, syllableCells });
  root.CantoriaOCR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
