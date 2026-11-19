/* Cantoria OCR assistito: testo e accordi, NON riconoscimento delle note sul pentagramma. */
(function (global) {
  'use strict';

  const NOTE = '(?:SOL|DO|RE|MI|FA|LA|SI)';
  const CHORD = new RegExp('^' + NOTE + '(?:#|b)?(?:maj|min|dim|aug|sus|add|[0-9+°()\-])*(?:/' + NOTE + '(?:#|b)?)?$', 'i');
  const HEADING = /^(INTRO(?:DUZIONE)?|STROFA(?:\s*\d+)?|RITORNELLO|CORO|REFRAIN|PONTE|BRIDGE|FINALE|OUTRO|CODA)\s*:?\s*$/i;
  const VERSION = '6.0.1';
  let loader = null;

  function chordToken(token) {
    const clean = String(token).replace(/^[\s[({]+|[\s\])},.;:]+$/g, '')
      .replace(/♯/g, '#').replace(/♭/g, 'b');
    return CHORD.test(clean) ? clean.toUpperCase() : null;
  }

  function sectionFromHeading(label, index) {
    const name = label.toUpperCase();
    const kind = /INTRO/.test(name) ? 'intro'
      : /RITORNELLO|CORO|REFRAIN/.test(name) ? 'chorus'
      : /FINALE|OUTRO|CODA/.test(name) ? 'outro' : 'verse';
    return { id: 'ocr-' + index, kind, name, lines: [], chordsOnly: [] };
  }

  function parse(text) {
    const sections = [];
    let section = null;
    let pendingChords = null;
    const ensureSection = () => {
      if (!section) {
        section = sectionFromHeading('STROFA', sections.length);
        sections.push(section);
      }
      return section;
    };
    const flushChords = () => {
      if (pendingChords) {
        ensureSection().chordsOnly.push(...pendingChords.items.map(x => x.chord));
        pendingChords = null;
      }
    };
    for (const original of String(text || '').replace(/\u00a0/g, ' ').split(/\r?\n/)) {
      const trimmed = original.trim();
      if (!trimmed) continue;
      if (trimmed.length > 350) continue; // Probable recognition noise.
      const heading = trimmed.match(HEADING);
      if (heading) {
        flushChords();
        section = sectionFromHeading(heading[1], sections.length);
        sections.push(section);
        continue;
      }

      const tokens = [...original.matchAll(/\S+/g)];
      const chordItems = tokens.map(m => ({ chord: chordToken(m[0]), start: m.index }));
      const looksLikeChordRow = chordItems.length > 0 && chordItems.every(x => !!x.chord)
        && (chordItems.length > 1 || /[0-9#b+\-]/i.test(chordItems[0].chord));
      if (looksLikeChordRow) {
        flushChords();
        pendingChords = { items: chordItems, width: Math.max(1, original.length) };
        continue;
      }

      const lyric = trimmed.replace(/\|/g, ' ').replace(/[\u0000-\u001f]/g, '');
      if (!lyric) continue;
      const lyricTokens = [...lyric.matchAll(/\S+/g)];
      if (!lyricTokens.length) continue;
      const anchors = [];
      if (pendingChords) {
        for (const item of pendingChords.items) {
          const proportion = item.start / pendingChords.width;
          const slot = Math.min(lyricTokens.length - 1, Math.max(0, Math.round(proportion * (lyricTokens.length - 1))));
          if (!anchors.some(anchor => anchor.slot === slot && anchor.chord === item.chord)) {
            anchors.push({ slot, chord: item.chord });
          }
        }
        anchors.sort((a, b) => a.slot - b.slot);
        pendingChords = null;
      }
      ensureSection().lines.push({ marked: lyric, anchors });
    }
    flushChords();
    return sections.filter(s => s.lines.length || s.chordsOnly.length);
  }

  function loadEngine() {
    if (global.Tesseract) return Promise.resolve();
    if (!loader) {
      loader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/' + VERSION + '/tesseract.min.js';
        script.async = true;
        script.onload = () => global.Tesseract ? resolve() : reject(new Error('Motore OCR non disponibile'));
        script.onerror = () => reject(new Error('Impossibile scaricare il motore OCR. Verifica la connessione.'));
        document.head.appendChild(script);
      }).catch(err => { loader = null; throw err; });
    }
    return loader;
  }

  async function recognize(imageData) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(imageData || ''))) {
      throw new Error('Fotografia non valida');
    }
    await loadEngine();
    let worker;
    try {
      worker = await global.Tesseract.createWorker('ita+eng', 1);
      await worker.setParameters({ preserve_interword_spaces: '1' });
      const result = await worker.recognize(imageData);
      return String(result?.data?.text || '').trim();
    } finally {
      if (worker) await worker.terminate();
    }
  }

  global.CantoriaOCR = Object.freeze({ parse, recognize });
})(window);
