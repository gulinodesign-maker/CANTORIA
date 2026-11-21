/* OCR title/author extraction without hallucinating metadata from sung lines. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('../score-ocr.js');
const geometry=require('../score-geometry.js');
const metadata=require('../score-metadata.js');
function row(text,y,height=20){
 return {words:text.split(/\s+/).map((word,i)=>({
  text:word,bbox:{x0:20+i*84,y0:y,x1:20+i*84+Math.max(10,word.length*7),y1:y+height},
  confidence:95
 }))};
}
const screenshot={lines:[
 row('Oji',18),row('10:05',49),
 row('Signore pietà',150,54),
 row('Francesco Buttazzo',228,38),
 row('↓',285),
 row('Intro: DO RE- DO FA DO FA SOL FA',345,19),
 row('Signore che sei venuto a perdonare',393),
 row('LA- MI- FA DO',455),
 row('abbi pietà di noi abbi pietà di noi',490)
]};
const found=metadata.analyze(screenshot);
assert.equal(found.title,'Signore pietà');
assert.equal(found.author,'Francesco Buttazzo');
assert.equal(found.source,'header-pair');
assert.equal(found.excludedRowIds.length,5);
const parsed=geometry.parseGeometry(screenshot,{excludedRowIds:found.excludedRowIds});
assert.ok(parsed.sections.some(s=>s.lines.some(l=>l.marked.includes('Signore che sei'))));
assert.ok(!parsed.sections.some(s=>s.lines.some(l=>/Francesco|Buttazzo|Oji/.test(l.marked))),
 'Photo title, composer and gallery controls are not sung lines');
assert.ok(parsed.diagnostics.totalAnchored>=3,'Music chord recognition stays intact');
const explicit=metadata.analyze({lines:[
 row('Titolo: Signore pietà',20),
 row('Autore: Francesco Buttazzo',70),
 row('DO RE- DO FA',135),
 row('abbi pietà di noi',180)
]});
assert.equal(explicit.title,'Signore pietà');
assert.equal(explicit.author,'Francesco Buttazzo');
const numbered=metadata.analyze({lines:[
 row('63 FRUTTO DELLA NOSTRA TERRA Francesco Buttazzo',24),
 row('SOL DO SOL RE',100),row('Frutto della nostra terra',137)
]});
assert.equal(numbered.title,'Frutto della nostra terra');
assert.equal(numbered.author,'Francesco Buttazzo');
const noMetadata=metadata.analyze({lines:[
 row('DO RE- DO FA',24),
 row('Signore che sei venuto a perdonare',59),
 row('LA- MI- FA DO',105),
 row('abbi pietà di noi',144)
]});
assert.equal(noMetadata.title,'');
assert.equal(noMetadata.author,'');
assert.deepEqual(noMetadata.excludedRowIds,[]);
assert.equal(metadata.properName('Francesco Buttazzo'),true);
assert.equal(metadata.properName('Signore pietà'),false);
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes("window.CantoriaMetadata?.analyze(result.data)"));
assert.ok(html.includes("state.geometryDraft=window.CantoriaGeometry?.parseGeometry(result.data,{excludedRowIds:metadata?.excludedRowIds||[]})"));
assert.ok(html.includes('id="photoSongAuthor"')&&html.includes('name="photoSongAuthor"'));
assert.ok(html.includes("const author=String(f.get('photoSongAuthor')"));
assert.ok(html.includes('recognizePhotoText();}'),'Photo selection should start scanning immediately');
assert.ok(html.includes('<script src="./score-metadata.js"></script>'));
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-metadata.js'"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-metadata.js'));
assert.equal(require('../release.json').version,'1.1');
assert.ok(require('../release.json').build>=11,'Expected build at least 11');
console.log('OK: photo title and composer detection, no lyric contamination, no fabricated metadata, iOS bundled.');
