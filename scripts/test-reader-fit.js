/* Screen-fit and chord-pill interaction regression.
   Pure mocks reproduce measurable DOM widths without changing the iOS app. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const editor=require('../score-editor.js');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Inline JavaScript must exist');
new vm.Script(js);

const start=js.indexOf('function fitSongToDisplay(){');
const end=js.indexOf('// Bind chord positions AFTER',start);
assert.ok(start>=0&&end>start,'Full-song fitting function missing');
const fitCode=js.slice(start,end);
const longest='Frutto della nostra terra, del lavoro di ogni uomo';
const song={sections:[
 {lines:[{marked:'Un sacrificio gradito a Te.'}]},
 {lines:[{marked:longest},{marked:'Benedetto sei il Signore'}]}
]};
let font='',layoutWidth=330;
const col={get clientWidth(){return layoutWidth;},querySelector(){return {}}};
const layer={
 classList:{contains(){return false;}},
 querySelector(sel){return sel==='.sheet-column'?col:null;},
 style:{setProperty(key,value){if(key==='--reader-font')font=value;}},
 dataset:{}
};
const ctx={document:{
 querySelector(sel){return sel==='#readerLayer'?layer:null;},
 createElement(tag){assert.equal(tag,'canvas');return {getContext(){return {font:'',measureText(text){return {width:text.length*11};}}}}}
},window:{CantoriaEditor:editor},currentSong(){return song;},
getComputedStyle(){return {marginLeft:'7px'}},
Math};
vm.createContext(ctx);vm.runInContext(fitCode,ctx);
vm.runInContext('fitSongToDisplay()',ctx);
const widest=Number(layer.dataset.longestWidth);
assert.equal(widest,longest.length*11,'Longest line must be measured across ALL sections');
const narrowFont=parseFloat(font);
assert.ok(narrowFont>0&&narrowFont<26);
assert.ok(widest*narrowFont/26<=layoutWidth-7-8,
 'The actual longest lyric must fit the usable column width');
layoutWidth=620;vm.runInContext('fitSongToDisplay()',ctx);
const wideFont=parseFloat(font);
assert.ok(wideFont>=narrowFont&&wideFont<=26);
assert.equal(font,wideFont.toFixed(2)+'px');
assert.ok(!html.includes('width:max-content!important'),'Reader must never grow beyond the viewport');
assert.ok(html.includes('overflow-x:hidden!important'));
assert.ok(html.includes('fitSongToDisplay();alignChords();'),'Fit MUST precede chord positioning');
assert.ok(html.includes('font-size:var(--reader-font)!important'));

const pstart=js.indexOf('function alignChords(scope=document){');
const pend=js.indexOf('function render(){',pstart);
assert.ok(pstart>=0&&pend>pstart);
const placementCode=js.slice(pstart,pend);
const makeLabel=(sourceRatio,baseWidth)=>({
 dataset:{sourceRatio:String(sourceRatio)},
 style:{},
 getBoundingClientRect(){return {width:baseWidth*((parseFloat(this.style.fontSize)||13)/13)}}
});
const labels=[makeLabel(.75,70),makeLabel(.8,70),makeLabel(.87,70),makeLabel(.93,70)];
const band={
 clientWidth:240,style:{},
 getBoundingClientRect(){return {left:0}},
 querySelectorAll(sel){assert.equal(sel,'.chord-label');return labels}
};
const row={querySelector(sel){return sel==='.chord-band'?band:null}};
const placementContext={
 document:{},
 getComputedStyle(){return {fontSize:'13px'}},
 Math,
 readerCharRect(){return null}
};
vm.createContext(placementContext);vm.runInContext(placementCode,placementContext);
vm.runInContext('alignChords(scope)',{...placementContext,scope:{querySelectorAll(){return [row]}}});
const positions=labels.map(label=>({
 x:parseFloat(label.style.left),
 width:label.getBoundingClientRect().width
})).sort((a,b)=>a.x-b.x);
assert.ok(positions.every(p=>p.x>=0&&p.x+p.width<=240.1),'All chords must stay in the pill');
for(let i=1;i<positions.length;i++)
 assert.ok(positions[i].x>=positions[i-1].x+positions[i-1].width-.11,
  'Chords cannot overlap, especially not vertically');
assert.equal(band.style.width,'100%');
assert.ok(labels.every(l=>l.style.top==='50%'),'Pill chord labels must be vertically centered');

for(const requirement of [
 'data-action="edit-band"','function chordBandEditModal(m)',
 "target.dataset.action==='edit-band'",
 '#readerPaper .chord-band[data-action="edit-band"]',
 "action==='select-band-chord'","action==='add-band-chord'",
 "if(m.ai===-1)row.push(chord)"
])assert.ok(html.includes(requirement),'Chord-pill interaction missing: '+requirement);
console.log('OK: global longest-phrase font, viewport fitting, chord collision, pill long-press editor');
