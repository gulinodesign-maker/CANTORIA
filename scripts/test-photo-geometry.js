const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root={};
vm.runInNewContext(fs.readFileSync('score-ocr.js','utf8'),{globalThis:root,module:{exports:{}}});
vm.runInNewContext(fs.readFileSync('score-geometry.js','utf8'),{globalThis:root,module:{exports:{}}});
const {parseGeometry,extractRows}=root.CantoriaGeometry;

function word(text,x,y,width=String(text).length*11,confidence=98){
 return {text,bbox:{x0:x,y0:y,x1:x+width,y1:y+18},confidence};
}
const scan={lines:[
 {words:[word('STROFA',30,20,90)]},
 {words:[word('RE',34,56,30),word('s1-7',147,56,55,80),word('MI4',295,56,44),word('MI',360,56,31)]},
 {words:[word('Perché',35,87,89),word('avessimo',149,87,123),
  word('la',290,87,24),word('vita',325,87,58),word('per',390,87,44),word('lui.',443,87,45)]},
 {words:[word('RE',35,128,31),word('1A',150,128,39),word('MI4',290,128,44),word('MI',365,128,31)]},
 {words:[word('per',35,156,40),word('i',95,156,10),word('nostri',116,156,78),
  word('peccati,',212,156,110),word('per',347,156,40),word('noi.',400,156,47)]}
]};
const result=parseGeometry(scan),sections=result.sections;
assert.equal(sections.length,1);
assert.equal(sections[0].lines.length,2,'Chord lines must NOT leak into lyric lines');
const first=sections[0].lines[0];
assert.equal(first.originalText,'Perché avessimo la vita per lui.');
assert.deepEqual(Array.from(first.anchors,a=>a.chord),['RE','SI-7','MI4','MI']);
assert.deepEqual(Array.from(first.anchors,a=>a.sourceX),[34,147,295,360]);
assert.ok(first.anchors.every(a=>Number.isInteger(a.anchorCharacterIndex)));
assert.equal(first.anchors[1].anchorCharacterIndex,7);
assert.ok(first.anchors.every(a=>a.anchorMethod==='word-estimated'&&a.needsReview&&!a.verified));
assert.deepEqual(Array.from(sections[0].lines[1].anchors,a=>a.chord),['RE','LA','MI4','MI']);
assert.equal(result.diagnostics.totalRecognized,8);
assert.equal(result.diagnostics.totalAnchored,8);
assert.equal(result.diagnostics.estimated,8);

// Character-level boxes supersede interpolation and preserve modest musical anticipation.
const chars=[...'Benedetto'].map((ch,i)=>({text:ch,bbox:{x0:20+i*13,y0:100,x1:33+i*13,y1:119}}));
const exact=parseGeometry({lines:[
 {words:[word('STROFA',20,10,80)]},
 {words:[word('SOL2',46,69,65)]},
 {words:[{...word('Benedetto',20,100,117),symbols:chars},
   word('sei',160,100,43),word('Signore,',210,100,104)]}
]});
assert.equal(exact.sections[0].lines.length,1);
const anchor=exact.sections[0].lines[0].anchors[0];
assert.equal(anchor.anchorCharacterIndex,2);
assert.equal(anchor.sourceX,46);
assert.equal(anchor.sourceCharX,46);
assert.equal(anchor.anchorMethod,'character-box');
assert.equal(anchor.offsetX,0);
assert.ok(anchor.confidence>=0.95);
assert.equal(anchor.verified,false);

// Insufficient spatial evidence MUST NOT be replaced with guessed whitespace positions.
const noBoxes=parseGeometry({text:'STROFA\nRE MI\nDio è amore'});
assert.equal(noBoxes.hasGeometry,false);
assert.equal(noBoxes.sections.length,0);
assert.equal(extractRows({}).length,0);

// Italian lyric words that happen to be note names do not become a chord band.
const lyrics=parseGeometry({lines:[{words:[
 word('Mi',20,30),word('la',60,30),word('fa',100,30),word('sol',140,30)
]}]});
assert.equal(lyrics.sections[0].lines.length,1);
assert.equal(lyrics.sections[0].lines[0].anchors.length,0);

// Regression from the photographed hymn: an isolated "i" may stand for
// different notes, so retain a visible '?' in the chord band, not lyric text.
const damaged=parseGeometry({lines:[
 {words:[word('STROFA',20,10,90)]},
 {words:[word('i',25,43,11),word('FA',90,43,27),word('DO',148,43,27)]},
 {words:[word('ci',20,70,18),word('ha',45,70,23),word('dato',76,70,47),
   word('la',132,70,20),word('vita,',165,70,53)]},
 {words:[word('RE',25,110,28),word('m1⁴',90,110,40),word('Mi',148,110,29)]},
 {words:[word('per',20,139,26),word('sempre',51,139,74),word('noi',135,139,31)]}
]});
assert.equal(damaged.sections[0].lines.length,2,'Keep all chord rows out of lyric text');
assert.equal(damaged.sections[0].lines[0].marked,'ci ha dato la vita,');
assert.deepEqual(Array.from(damaged.sections[0].lines[0].anchors,a=>a.chord),['?','FA','DO']);
const unknown=damaged.sections[0].lines[0].anchors[0];
assert.equal(unknown.sourceSymbol,'i');
assert.equal(unknown.unresolved,true);
assert.equal(unknown.confidence,0);
assert.equal(unknown.needsReview,true);
assert.equal(unknown.verified,false);
assert.ok(Number.isFinite(unknown.sourceX));
assert.deepEqual(Array.from(damaged.sections[0].lines[1].anchors,a=>a.chord),['RE','MI4','MI']);
assert.equal(damaged.diagnostics.totalRecognized,5);
assert.equal(damaged.diagnostics.unresolved,1);
assert.equal(damaged.diagnostics.totalAnchored,5);
assert.equal(damaged.diagnostics.needsReview,6);
assert.equal(root.CantoriaOCR.chordFromOcr('s1-7'),'SI-7');
assert.equal(root.CantoriaOCR.chordFromOcr('m1⁴'),'MI4');
assert.equal(root.CantoriaOCR.chordFromOcr('DO/S1'),'DO/SI');
assert.equal(root.CantoriaOCR.chordName('DO/si'),'DO/SI');
assert.equal(root.CantoriaOCR.chordName('Mi4'),'MI4');
// Do not hallucinate which Italian note an isolated OCR "1" represents.
const oneRead=parseGeometry({lines:[
 {words:[word('FA',20,5,30),word('1',75,5,12),word('DO',140,5,32)]},
 {words:[word('Dio',20,31,35),word('è',65,31,15),word('amore',93,31,75)]}
]});
assert.equal(oneRead.sections[0].lines[0].anchors[1].chord,'?');
assert.equal(oneRead.sections[0].lines[0].anchors[1].sourceSymbol,'1');

// Character index survives renderer font and scale changes; never distribute evenly.
const html=fs.readFileSync('index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>')));
new vm.Script(script);
assert.ok(html.includes('readerCharRect'));
assert.ok(html.includes('data-char-index'));
assert.ok(html.includes('chord.sourceX-source.x0')===false); // No hard-coded x distribution
assert.ok(html.includes("data-offset-x"));
assert.ok(html.includes('style.left=x'));
assert.ok(html.includes('song.geometryDiagnostics'));
assert.ok(html.includes("worker.recognize(image, {}, {text:true,blocks:true})"));
assert.ok(html.includes('photoParserVersion'));
assert.ok(html.includes('Simbolo musicale non riconosciuto'));
assert.ok(html.includes('<script src="./score-geometry.js"></script>'));
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-geometry.js'"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-geometry.js'));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('ITSAppUsesNonExemptEncryption bool false'));
assert.ok(fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8').includes('Verify archived export compliance declaration'));
console.log('OK: spatial OCR anchors, ambiguity flags, source boxes, responsive/PDF model wiring');
