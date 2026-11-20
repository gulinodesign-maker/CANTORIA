const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ocr=require('../score-ocr.js');

const score=[
 'INTRO','SOL       DO       LA-       RE',
 'STROFA','SOL             RE',
 'Be|ne|det|to sei Si|gno|re',
 'Tu sei la nostra luce',
 'RITORNELLO','DO           SOL',
 'A te can|tia|mo Cri|sto Re'
].join('\n');
const sections=ocr.parse(score);
assert.equal(sections.length,3);
assert.equal(sections[0].kind,'intro');
assert.deepEqual(sections[0].chordsOnly,['SOL','DO','LA-','RE']);
assert.equal(sections[1].kind,'verse');
assert.equal(sections[1].lines.length,2);
assert.equal(sections[1].lines[0].marked,'Be|ne|det|to sei Si|gno|re');
assert.equal(sections[1].lines[0].anchors.length,2);
assert.equal(sections[1].lines[1].anchors.length,0);
assert.equal(sections[2].kind,'chorus');
assert.equal(ocr.stats(sections).chords,8);
assert.ok(sections.every(s=>(s.lines||[]).every(l=>(l.anchors||[]).every(a=>a.slot>=0&&a.slot<ocr.syllableCells(l.marked).length))));
assert.equal(ocr.parse('').length,0);
assert.equal(ocr.parse('Mi hai salvato')[0].lines[0].marked,'Mi hai salvato');
assert.equal(ocr.parse('STROFA\nNon mi lasciare')[0].lines[0].anchors.length,0);
assert.equal(ocr.parse('STROFA\nDOmaj7  SOL/RE\nLa luce è con noi')[0].lines[0].anchors.length,2);
assert.equal(ocr.chordName('SOL7'),'SOL7');
assert.equal(ocr.chordName('LA-'),'LA-');
assert.equal(ocr.chordName('FA#m7'),'FA#m7');
assert.equal(ocr.chordName('MIb7'),'MIb7');
assert.equal(ocr.chordName('MI/7'),'MI/7');
assert.equal(ocr.chordFromOcr('M1/7'),'MI/7');
assert.equal(ocr.parse(['STROFA','MI/7 LA','Dio è amore @'].join(String.fromCharCode(10)))[0].lines[0].marked,'Dio è amore');
assert.equal(ocr.chordName('CANTO'),'');

// Real-world OCR regression: noisy chord rows must stay in coloured chord
// bands and must not be inserted as ordinary sung lyric text.
const photographed=ocr.parse([
 'STROFA',
 'LA    MI      RE     LA',
 'Dio ha mandato il suo Figlio Gesù',
 'RE    s1-7    MI4 MI',
 'Perché avessimo la vita per lui.',
 'RE   1A    MI4 MI',
 'per i nostri peccati, per noi.',
 'LA  i  MI   RE   MI7   LA',
 'Dio è amore, Dio è amore,'
].join('\n'));
assert.equal(photographed.length,1);
assert.equal(photographed[0].lines.length,4);
assert.deepEqual(
 photographed[0].lines[1].anchors.map(a=>a.chord),
 ['RE','SI-7','MI4','MI']
);
assert.deepEqual(
 photographed[0].lines[2].anchors.map(a=>a.chord),
 ['RE','LA','MI4','MI']
);
assert.deepEqual(
 photographed[0].lines[3].anchors.map(a=>a.chord),
 ['LA','MI','RE','MI7','LA']
);
assert.ok(photographed[0].lines.every(line=>!/(s1-7|MI4 MI|1A|MI7 LA)/.test(line.marked)));
assert.ok(photographed[0].lines.every(line=>
 line.anchors.every(a=>a.slot>=0&&a.slot<ocr.syllableCells(line.marked).length)
));
assert.equal(ocr.parse('LA i cantare')[0].lines[0].marked,'LA i cantare');

const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'Inline app script missing');
new vm.Script(match[1],{filename:'Cantoria inline app'});
assert.ok(html.includes('<script src="./score-ocr.js"></script>'));
assert.ok(html.includes('photoSectionsFromText'));
assert.ok(html.includes('convert-ocr-photo'));
assert.ok(html.includes('show-original-photo'));
assert.ok(html.includes('data-action="ask-delete-song"'));
assert.ok(html.includes("if(action==='delete-song')"));
assert.ok(html.includes("state.modal?.type!=='delete-song-confirm'"));
assert.ok(html.includes('data-action="show-release-notes"'));
assert.ok(html.includes("if(action==='reparse-photo')"));
assert.ok(html.includes('function alignChords(scope=document)'));

assert.ok(html.includes("if(added)for(const anchor of line.anchors)"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-ocr.js'));
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-ocr.js'"));
console.log('OK: photo-to-editable-score parser, syllable anchors, source photo and iOS packaging');
