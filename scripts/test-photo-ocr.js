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
assert.equal(ocr.chordName('FA#m7'),'FA#M7');
assert.equal(ocr.chordName('CANTO'),'');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'Inline app script missing');
new vm.Script(match[1],{filename:'Cantoria inline app'});
assert.ok(html.includes('<script src="./score-ocr.js"></script>'));
assert.ok(html.includes('photoSectionsFromText'));
assert.ok(html.includes('convert-ocr-photo'));
assert.ok(html.includes('show-original-photo'));
assert.ok(html.includes("if(added)for(const anchor of line.anchors)"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-ocr.js'));
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-ocr.js'"));
console.log('OK: photo-to-editable-score parser, syllable anchors, source photo and iOS packaging');
