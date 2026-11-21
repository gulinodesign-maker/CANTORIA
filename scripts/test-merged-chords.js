const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ocr=require('../score-ocr.js');
assert.deepEqual(require('../release.json'),{version:'1.1',build:32});
for(const [raw,expected] of [
 ['SOLDO',['SOL','DO']],['SOLDO7',['SOL','DO7']],['MI-LA-',['MI-','LA-']],
 ['FA7+DO',['FA7+','DO']],['RE/LADO',['RE/LA','DO']],
 ['DOSOLRE',['DO','SOL','RE']],['SI7DO',['SI7','DO']]
]){
 const parts=ocr.splitChordCluster(raw);
 assert.deepEqual(parts.map(p=>p.chord),expected,raw);
 assert.equal(parts[0].start,0);
 assert.equal(parts.at(-1).end,raw.length);
 for(let i=1;i<parts.length;i++)assert.equal(parts[i-1].end,parts[i].start,'No invented spaces');
}
for(const raw of ['SOL7','DONA','SIGNORE','BENEDIZIONE','MAESTRO','SOLDOX','DO/MI'])
 assert.equal(ocr.splitChordCluster(raw).length,0,'Do not invent multiple chords in '+raw);
const plain=ocr.parse('STROFA\nSOLDO RE\nBenedetto sei Signore');
assert.deepEqual(plain[0].lines[0].anchors.map(a=>a.chord),['SOL','DO','RE']);
const lower=ocr.parse('STROFA\ndore mi\ncantiamo insieme');
assert.ok(lower[0].lines.some(l=>l.marked==='dore mi'),'Lowercase words cannot turn into chords');
const chordLine=ocr.parse('STROFA\nMI-LA-\nAgnello di Dio');
assert.deepEqual(chordLine[0].lines[0].anchors.map(a=>a.chord),['MI-','LA-']);

const win={CantoriaOCR:ocr};const geometrySource=fs.readFileSync('score-geometry.js','utf8');
new vm.Script(geometrySource);vm.runInNewContext(geometrySource,{window:win,module:{exports:{}}});
const geom=win.CantoriaGeometry;
function word(text,x0,x1,y0,symbols=false){
 const width=(x1-x0)/text.length;
 return {text,bbox:{x0,x1,y0,y1:y0+19},confidence:96,
  symbols:symbols?[...text].map((c,i)=>({text:c,bbox:{
   x0:x0+i*width,x1:x0+(i+1)*width,y0,y1:y0+19}})):[]};
}
const input={lines:[
 {words:[word('SOLDO',15,115,15,true),word('RE',170,205,15)]},
 {words:[word('Benedetto',15,95,55),word('sei',110,141,55),word('Signore',160,242,55)]}
]};
const parsed=geom.parseGeometry(input);
const line=parsed.sections[0].lines[0];
assert.equal(line.anchors.length,3);
assert.deepEqual(Array.from(line.anchors,a=>a.chord),['SOL','DO','RE']);
assert.equal(parsed.diagnostics.totalRecognized,3);
assert.equal(parsed.diagnostics.totalAnchored,3);
assert.equal(parsed.diagnostics.mergedChordsSeparated,2);
assert.ok(line.anchors[0].sourceBBox.x1<=line.anchors[1].sourceBBox.x0,'Split chords retain distinct horizontal boxes');
assert.ok(line.anchors[1].sourceBBox.x1<=line.anchors[2].sourceBBox.x0);
assert.ok(line.anchors[0].needsReview&&line.anchors[1].needsReview,'Inferred chord clusters require verification');
assert.ok(line.anchors.every(a=>Number.isFinite(a.sourceX)));
assert.ok(line.anchors[0].originalMergedSymbol==='SOLDO');
const interpolated={lines:[
 {words:[word('FA7+DO',10,142,10,false)]},
 {words:[word('Agnello',15,88,48),word('di',100,115,48),word('Dio',128,170,48)]}
]};
const guessed=geom.parseGeometry(interpolated);
assert.deepEqual(Array.from(guessed.sections[0].lines[0].anchors,x=>x.chord),['FA7+','DO']);
assert.ok(guessed.sections[0].lines[0].anchors[0].sourceBBox.x1<=guessed.sections[0].lines[0].anchors[1].sourceBBox.x0);
assert.equal(guessed.diagnostics.mergedChordsSeparated,2);
const preserved=geom.parseGeometry({lines:[{words:[word('Benedetto',10,110,12)]},
 {words:[word('signore',10,100,45),word('pietà',115,170,45)]}]});
assert.equal(preserved.diagnostics.mergedChordsSeparated,0,'Ordinary lyrics must never be split as chords');
console.log('PASS: merged chords split into distinct labels and OCR source boxes, lyrics untouched');
