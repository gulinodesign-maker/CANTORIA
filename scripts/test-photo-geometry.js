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
assert.ok(html.includes('<script src="./score-geometry.js"></script>'));
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-geometry.js'"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-geometry.js'));
console.log('OK: spatial OCR anchors, ambiguity flags, source boxes, responsive/PDF model wiring');
