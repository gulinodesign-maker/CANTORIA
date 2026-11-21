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
assert.equal(root.CantoriaOCR.chordName('MI/7'),'MI/7');
assert.equal(root.CantoriaOCR.chordFromOcr('M1/7'),'MI/7');
// Do not hallucinate which Italian note an isolated OCR "1" represents.
const oneRead=parseGeometry({lines:[
 {words:[word('FA',20,5,30),word('1',75,5,12),word('DO',140,5,32)]},
 {words:[word('Dio',20,31,35),word('è',65,31,15),word('amore',93,31,75)]}
]});
assert.equal(oneRead.sections[0].lines[0].anchors[1].chord,'?');
assert.equal(oneRead.sections[0].lines[0].anchors[1].sourceSymbol,'1');

// Regression for screenshot 20 Nov: "Sim M7" and "Sim MI/7" are chord
// rows and MUST NOT be shown as sung lyrics. Unknown suffixes are not guessed.
const photographedText=parseGeometry({lines:[
 {words:[word('STROFA',18,10,80)]},
 {words:[word('Sim',22,38,43),word('M7',116,38,28)]},
 {words:[word('questo',20,68,80),word('popolo',108,68,84),
   word('ti',208,68,23),word('eleva',241,68,68),
   word('la',320,68,22),word('sua',353,68,40),word('lode.',402,68,65)]},
 {words:[word('Sim',22,106,43),word('MI/7',116,106,54)]},
 {words:[word('questo',20,136,80),word('popolo',108,136,84),
   word('ti',208,136,23),word('eleva',241,136,68),
   word('la',320,136,22),word('sua',353,136,40),word('lode.',402,136,65)]},
 {words:[word('LA',20,173,29),word('RE',325,173,32)]},
 {words:[word('Benedetto',20,202,119),word('sei',151,202,40),
   word('Signore,',204,202,120),word('re',337,202,25),
   word('di',374,202,20),word('vittoria,',406,202,110),
   word('@',529,202,18)]},
 {words:[word('AUTO-SCROLL',20,238,150)]}
]});
const observed=photographedText.sections.flatMap(section=>section.lines);
assert.equal(observed.length,3);
assert.equal(observed[0].marked,'questo popolo ti eleva la sua lode.');
assert.equal(observed[1].marked,'questo popolo ti eleva la sua lode.');
assert.deepEqual(Array.from(observed[0].anchors,a=>a.chord),['SIm','?']);
assert.deepEqual(Array.from(observed[1].anchors,a=>a.chord),['SIm','MI/7']);
assert.equal(observed[0].anchors[1].sourceSymbol,'M7');
assert.equal(observed[1].anchors[1].sourceSymbol,'MI/7');
assert.equal(observed[0].anchors[1].unresolved,true);
assert.equal(observed[2].marked,'Benedetto sei Signore, re di vittoria,');
assert.equal(observed[2].originalOcrText,'Benedetto sei Signore, re di vittoria, @');
assert.equal(photographedText.diagnostics.ignoredArtifacts,2);
assert.ok(observed.every(line=>!line.marked.includes('@')&&!line.marked.includes('Sim M7')));
assert.ok(observed.every(line=>!line.marked.includes('AUTO-SCROLL')));
// The separated refrain marker is a section, not part of the sung text.
const withRefrain=parseGeometry({lines:[
 {words:[word('RIT',18,6,35),word('Ate',66,6,40),word('cantiamo',124,6,110),
 word('Cristo',247,6,71),word('Re',329,6,29)]}
]});
assert.equal(withRefrain.sections[0].name,'RITORNELLO');
assert.equal(withRefrain.sections[0].lines[0].marked,'Ate cantiamo Cristo Re');
assert.equal(withRefrain.sections[0].lines[0].originalOcrText,'RIT Ate cantiamo Cristo Re');
// Font-independent rendering needs no empty bar for a lyric without chords.
assert.ok(fs.readFileSync('index.html','utf8').includes("chords||!line.sourceRowId"));

// Regression from 20 Nov screenshot, "FRUTTO DELLA NOSTRA TERRA":
// mixed-case chord rows and noisy trailing OCR tokens must not become lyrics.
const fruit=parseGeometry({lines:[
 {words:[word('63',14,7,24),word('FRUTTO',40,7,70),word('DELLA',115,7,64),
   word('NOSTRA',186,7,73),word('TERRA',267,7,60),
   word('Francesco',340,7,95),word('Buttazzo',443,7,86)]},
 {words:[word('\\',20,37,11)]},
 {words:[word('TNS',20,57,36)]},
 {words:[word('Sol',23,87,36),word('Do',116,87,28),word('Sol',206,87,36),
   word('Re',309,87,29),word('dL',382,87,24)]},
 {words:[word('Frutto',23,118,76),word('della',111,118,58),
   word('nostra',180,118,72),word('terra,',258,118,70),
   word('del',340,118,35),word('lavoro',388,118,70),
   word('di',470,118,18),word('ogni',499,118,40),word('uomo',550,118,57)]},
 {words:[word('Mi-',23,156,40),word('Si-',115,156,35),word('Do',209,156,28),
   word('Re,',310,156,36),word('intro',403,156,47)]},
 {words:[word('Pane',23,185,54),word('della',88,185,58),
   word('nostra',150,185,68),word('vita,',225,185,57),
   word('cibo',291,185,48),word('della',346,185,57),word('quotidianità.',409,185,150)]},
 {words:[word('sol',23,230,35),word('Do',113,230,30),
   word('Sol',208,230,38),word('Re',309,230,31),word('~~',379,230,30)]},
 {words:[word('Tu',23,261,27),word('che',60,261,37),word('lo',108,261,19),
   word('prendevi',135,261,91),word('un',236,261,24),word('giorno,',272,261,84),
   word('lo',366,261,19),word('spezzavi',394,261,91),word('per',492,261,34),
   word('i',535,261,9),word('tuoi',555,261,45)]},
 {words:[word('Mi-',23,300,40),word('Si-',115,300,35),word('Do',209,300,28),
   word('Red',310,300,42),word('È',391,300,15)]},
 {words:[word('Oggi',23,334,54),word('vieni',87,334,50),word('in',149,334,19),
   word('questo',178,334,69),word('pane,',258,334,60),
   word('cibo',330,334,45),word('vero',383,334,50),word('dell’umanità.',445,334,151)]},
 {words:[word('RE',23,371,28),word('SOL',132,371,38),word('RE',301,371,29),
   word('MI-',430,371,41),word('SI-',545,371,35)]},
 {words:[word('E',23,400,16),word('sarò',48,400,48),word('pane',110,400,48),
   word('e',171,400,9),word('sarò',189,400,45),word('vino',241,400,44),
   word('nella',303,400,54),word('mia',365,400,32),word('vita,',406,400,49),
   word('nelle',465,400,50),word('tue',520,400,32),word('mani',560,400,46)]}
]});
const fruitLines=fruit.sections.flatMap(sec=>sec.lines);
assert.equal(fruitLines.length,5,'Every chord row must stay above its corresponding lyric row');
assert.ok(fruitLines.every(ln=>!/(?:Sol Do Sol Re|Mi- Si- Do|TNS|FRUTTO DELLA NOSTRA)/.test(ln.marked)));
assert.deepEqual(Array.from(fruitLines[0].anchors,a=>a.chord),['SOL','DO','SOL','RE','?']);
assert.deepEqual(Array.from(fruitLines[1].anchors,a=>a.chord),['MI-','SI-','DO','RE']);
assert.deepEqual(Array.from(fruitLines[2].anchors,a=>a.chord),['SOL','DO','SOL','RE']);
assert.deepEqual(Array.from(fruitLines[3].anchors,a=>a.chord),['MI-','SI-','DO','?','?']);
assert.deepEqual(Array.from(fruitLines[4].anchors,a=>a.chord),['RE','SOL','RE','MI-','SI-']);
assert.equal(fruit.diagnostics.titleCandidate,'63 FRUTTO DELLA NOSTRA TERRA Francesco Buttazzo');
assert.ok(fruit.diagnostics.ignoredArtifacts>=3);
assert.equal(fruitLines[0].anchors[0].sourceX,23,'Keep measured source coordinates');
assert.equal(fruitLines[0].anchors[4].sourceSymbol,'dL');
assert.equal(fruitLines[0].anchors[4].unresolved,true);
assert.ok(fruitLines[0].anchors.every(a=>Number.isInteger(a.anchorCharacterIndex)));
assert.ok(fruitLines[0].anchors.every(a=>a.needsReview),'Estimates require photo review');

// The same notes written as ordinary lowercase lyrics must not be stolen.
const sungNotes=parseGeometry({lines:[
 {words:[word('Mi',20,15),word('la',53,15),word('fa',87,15),word('sol',120,15)]},
 {words:[word('e',20,45),word('tu',43,45),word('sei',77,45),word('qui',118,45)]}
]});
assert.equal(sungNotes.sections[0].lines.length,2);
assert.equal(sungNotes.sections[0].lines[0].marked,'Mi la fa sol');

// No graphic artifacts should survive OCR, even when attached to real words.
const ornaments=parseGeometry({lines:[
 {words:[word('STROFA',20,10,90)]},
 {words:[word('Pane',20,50,45),word('della',75,50,55),word('quotidianità.',140,50,140),
   word('==',293,50,20),word('ge',330,50,21)]},
 {words:[word('Tu',20,89,30),word('che',60,89,35),word('lo',105,89,20),
   word('prendevi',135,89,85),word('T°',233,89,28),word('/',269,89,14)]},
 {words:[word('ma',20,128,29),word('«',58,128,11)]},
 {words:[word('Oggi',20,166,48),word('vieni',75,166,60),
   word('qui.',150,166,42),word('\\)',199,166,24),word('+',235,166,12)]},
 {words:[word('Frutto',20,206,70),word('della',103,206,57),
   word('terra',179,206,55),word('(',247,206,12),word('—',273,206,25)]}
]});
const cleanLines=ornaments.sections.flatMap(sec=>sec.lines);
assert.deepEqual(Array.from(cleanLines,l=>l.marked),[
 'Pane della quotidianità.','Tu che lo prendevi','Oggi vieni qui.','Frutto della terra'
]);
assert.ok(ornaments.diagnostics.ignoredArtifacts>=7);

// Character index survives renderer font and scale changes; never distribute evenly.
const html=fs.readFileSync('index.html','utf8');
const script=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>')));
new vm.Script(script);
assert.ok(html.includes('readerCharRect'));
assert.ok(html.includes('data-char-index'));
assert.ok(html.includes('chord.sourceX-source.x0')===false); // No hard-coded x distribution
assert.ok(html.includes("data-offset-x"));
assert.ok(html.includes("p.label.style.left=Math.max(0,p.x)"));
assert.ok(html.includes('song.geometryDiagnostics'));
assert.ok(html.includes("maxWidth=Math.max(24,band.clientWidth)"));
assert.ok(html.includes("fitSongToDisplay();alignChords();"));
assert.ok(!html.includes('lanes*laneHeight'));
assert.ok(html.includes('data-action="save-song"'));
assert.ok(html.includes('data-action="edit-chord-only"'));
assert.ok(html.includes('data-action="recognize-photo"'));
assert.ok(!html.includes('data-action="recognize-apple"'));
assert.ok(!html.includes('class="photo-analysis-actions"'));
assert.ok(!html.includes('data-action="improve-photo-apple"'));
assert.ok(html.includes("worker.recognize(image,{}, {text:true,blocks:true})"));
assert.ok(html.includes('photoParserVersion'));
assert.ok(html.includes('Simbolo musicale non riconosciuto'));
assert.ok(html.includes('<script src="./score-geometry.js"></script>'));
assert.ok(fs.readFileSync('sw.js','utf8').includes("'./score-geometry.js'"));
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('score-geometry.js'));
assert.ok(!fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('cp native/CantoriaViewController.swift'));
assert.ok(!html.includes('render();probeAppleIntelligence()'), 'Native model probe must not run at startup');
assert.ok(fs.readFileSync('scripts/prepare-ios.sh','utf8').includes('ITSAppUsesNonExemptEncryption bool false'));
assert.ok(fs.readFileSync('.github/workflows/ios-testflight-auto.yml','utf8').includes('Verify archived export compliance declaration'));
// Source regression: opening four-line refrain repeats after a four-line verse,
// and a final second verse follows. Source image has NO printed headings.
const ch=[
 'Ti esalto Dio mio re','canterò in eterno a Te',
 'io voglio lodarti Signor','e benedirti alleluja.'
];
const v1=[
 'Il Signore è degno di ogni lode','non si può misurar la sua grandezza',
 'Ogni vivente proclami la sua gloria,','la sua opera è giustizia e verità.'
];
const v2=[
 'Il Signore è paziente e pietoso,','lento all’ira e ricco di grazia;',
 'tenerezza ha per ogni creatura,','il Signore è buono verso tutti.'
];
const chordRows=[
 ['DO','SOL','DO','LA-'],['RE-','DO','SOL7'],
 ['DO','LA-','RE-','SOL7'],['DO','SOL7','DO'],
 ['FA','DO','SOL','DO'],['FA','DO','SOL','7'],
 ['LA-','FA6','DO','FA'],['DO','SOL','DO']
];
const allLyrics=[...ch,...v1,...ch,...v2];
const scanRows=[];
allLyrics.forEach((text,i)=>{
 const chords=chordRows[i%8];
 const cy=20+i*52;
 scanRows.push({words:chords.map((c,j)=>word(c,40+j*123,cy,Math.max(15,c.length*12)))});
 scanRows.push({words:text.split(/\s+/).map((t,j)=>word(t,25+j*62,cy+20,Math.max(16,t.length*8)))});
 if(i===6)scanRows.push({words:[
  word('pO',35,cy+40),word('5',80,cy+40),word('oa',112,cy+40),
  word('SOG',156,cy+40),word('BD',212,cy+40)
 ]});
});
const photoReference=parseGeometry({lines:scanRows});
assert.deepEqual(Array.from(photoReference.sections,s=>s.name),
 ['RITORNELLO','STROFA 1','RITORNELLO','STROFA 2']);
assert.deepEqual(Array.from(photoReference.sections,s=>s.lines.length),[4,4,4,4]);
assert.equal(photoReference.sections[0].firstRefrain,true);
assert.equal(photoReference.sections[0].kind,'chorus');
assert.equal(photoReference.sections[2].kind,'chorus');
assert.equal(photoReference.diagnostics.refrainInferredFromRepeats,true);
assert.equal(photoReference.diagnostics.suggestedTitle,'Ti esalto Dio mio re');
assert.ok(!photoReference.sections.some(s=>s.lines.some(l=>l.marked.includes('SOG'))));
assert.deepEqual(Array.from(photoReference.sections[1].lines[1].anchors,a=>a.chord),
 ['FA','DO','SOL','7']);

console.log('OK: spatial OCR anchors, ambiguity flags, source boxes, responsive/PDF model wiring');
