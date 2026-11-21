const assert=require('node:assert/strict');
const fs=require('node:fs');
const harmony=require('../harmony-analysis.js');

function photo(rows,uncertain=false){
 return {photoData:'data:image/png;base64,AAAA',verified:false,sections:[{
  name:'STROFA',kind:'verse',
  lines:rows.map(row=>({marked:'Testo di prova',anchors:row.trim().split(/\s+/).map((chord,slot)=>({slot,chord,needsReview:uncertain}))}))
 }]};
}
const example=photo([
 'SOL DO SOL RE',
 'MI- SI- DO RE',
 'SOL DO SOL RE',
 'MI- SI- DO RE',
 'RE SOL RE MI- SI-',
 'DO RE MI- DO',
 'LA- RE SOL RE',
 'SOL DO SOL RE'
],true);
const detected=harmony.analyze(example);
assert.equal(detected.key,'SOL','Repeated V-I cadences indicate SOL, not RE');
assert.equal(detected.status,'probable');
assert.equal(detected.alternative,'MI-');
assert.equal(detected.counts[0].name,'RE','This test verifies that chord frequency must not decide the key');
assert.ok(detected.progressions.some(p=>p==='RE → SOL'));

const minor=photo(['MI- LA- SI7 MI-','DO SI7 MI-','SOL LA- SI7 MI-']);
assert.equal(harmony.analyze(minor).key,'MI-','Leading-tone V-i points to MI minor');

const other=photo(['RE SOL LA RE','SI- MI- LA RE']);
assert.equal(harmony.analyze(other).key,'RE','True RE-major cadences must still work');

const ambiguous=photo(['SOL MI- DO RE SI- LA-']);
assert.equal(harmony.analyze(ambiguous).status,'uncertain','Relative major/minor must not be invented');
assert.equal(harmony.analyze(ambiguous).key,'');
assert.equal(harmony.analyze(photo(['RE'])).status,'insufficient');

assert.equal(harmony.parseChord('SI-7').q,'m');
assert.equal(harmony.parseChord('MI7').q,'M');
assert.equal(harmony.parseChord('SOL2').q,'neutral');
assert.equal(harmony.parseChord('SOLAMENTE'),null);

const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
assert.ok(html.includes('<script src="./harmony-analysis.js"></script>'));
assert.ok(html.includes('data-action="show-key-analysis"'));
assert.ok(!html.includes('>⏮</button>'),'Rewind must use vector artwork');
const start=html.indexOf('function inferSongKey(song){'),end=html.indexOf('function describeTonality(song,shift=0){',start);
assert.ok(start>0&&end>start);
const getModel=new Function('window',html.slice(start,end)+';return {refreshDetectedKey,inferSongKey};');
const model=getModel({CantoriaHarmony:harmony});

const legacy=structuredClone(example);legacy.key='RE';
assert.equal(model.refreshDetectedKey(legacy),true);
assert.equal(legacy.key,'SOL','Previously guessed RE must be migrated to SOL');
assert.equal(legacy.keySource,'auto-harmony');

const manual=structuredClone(example);manual.key='RE';manual.keySource='manual';
assert.equal(model.refreshDetectedKey(manual),false,'Do not replace manual tonalities');
assert.equal(manual.key,'RE');

const unknown=structuredClone(ambiguous);unknown.key='RE';
model.refreshDetectedKey(unknown);
assert.equal(unknown.key,'','Unknown centre must be shown as unverified');
assert.equal(unknown.keySource,'needs-review');

console.log('Cantoria harmonic analysis and key migration tests passed');
