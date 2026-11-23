const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('audio-follow.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.deepEqual(require('../release.json'),{version:'1.1',build:51});
new vm.Script(source);
const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline);new vm.Script(inline);
const storage=new Map();
const localStorage={
 getItem(key){return storage.has(key)?storage.get(key):null;},
 setItem(key,value){storage.set(key,String(value));}
};
function newFollower(){
 const root={localStorage};
 vm.runInNewContext(source,{window:root,module:{exports:{}}});
 return root.CantoriaAudioFollow;
}
const f=newFollower();
assert.equal(f.getTolerance(),65,'A balanced but conservative default is needed');
assert.equal(f.toleranceProfile().frames,4,'Default should require multiple stable frames, not two');
assert.equal(f.toleranceProfile(0).frames,2,'Fastest setting retains responsiveness');
assert.equal(f.toleranceProfile(100).frames,5,'High tolerance rejects fleeting changes');
assert.ok(f.toleranceProfile(100).novelty>f.toleranceProfile(0).novelty);
assert.ok(f.toleranceProfile(100).attackNovelty>f.toleranceProfile(0).attackNovelty);
assert.ok(f.toleranceProfile(100).interval>f.toleranceProfile(0).interval);
assert.equal(f.setTolerance(90),90);
assert.equal(storage.get('cantoria.followTolerance.v1'),'90','Save the value to persistent local storage');
assert.equal(newFollower().getTolerance(),90,'Reloading the app must restore the setting');
assert.equal(f.setTolerance(-100),0);
assert.equal(f.setTolerance(500),100);
const ui=inline.slice(inline.indexOf('function followToleranceLabel('),inline.indexOf('function appHTML()'));
assert.ok(ui.includes('id="audioFollowTolerance"'),'The actual range input must render in settings');
const ctx={window:{CantoriaAudioFollow:f}};
vm.runInNewContext(ui+'this.view=settingsHTML;this.name=followToleranceLabel;',ctx);
let rendered=ctx.view();
assert.ok(rendered.includes('type="range" min="0" max="100" step="5"'));
assert.ok(rendered.includes('value="100"'),'The form reads the stored audio tolerance');
assert.ok(rendered.includes('Più reattivo')&&rendered.includes('Più prudente'));
assert.ok(rendered.includes('100% · Molto prudente'),'Show a clear qualitative description');
assert.equal(ctx.name(65),'Equilibrato');
const input=inline.slice(inline.indexOf("root.addEventListener('input'"),inline.indexOf("root.addEventListener('change'"));
assert.ok(input.includes("e.target.id==='audioFollowTolerance'"),'Changing the slider must be handled');
assert.ok(input.includes('window.CantoriaAudioFollow?.setTolerance?.(e.target.value)'),'Slider changes live engine, not just text');
assert.ok(input.includes("label.textContent=level+'% · '+followToleranceLabel(level)"),'Visible value must update while dragging');
const row=(pitches)=>Array.from({length:12},(_,i)=>pitches.includes(i)?1/3:0);
const prev=row([7,11,2]);
const slight=prev.slice();slight[7]-=.1;slight[6]+=.1; // variation without a different chord
const strong=row([0,4,7]); // SOL to DO major
const score=[{label:'SOL'},{label:'DO'}];
const detect=f.changeDrivenCandidate;
assert.ok(detect(score,0,slight,prev,800,false,true,0),'Fast setting can react to a new attack with modest novelty');
assert.equal(detect(score,0,slight,prev,800,false,true,100),null,
 'High tolerance must reject a brief spectral fluctuation or accidental strum');
assert.equal(detect(score,0,strong,prev,800,false,true,100)?.index,1,
 'High tolerance still accepts a clear true harmonic change');
assert.equal(detect(score,0,strong,prev,170,false,true,100),null,
 'High tolerance blocks immediately repeated advances after the previous mark');
const nativeCall=source.includes('attackCount>lastMarkAttackCount,tolerance');
assert.ok(nativeCall,'Both native mic and Web audio must use the same configured tolerance');
assert.equal((source.match(/attackCount>lastMarkAttackCount,tolerance/g)||[]).length,2);
assert.equal((source.match(/stableCount>=Math\.max\(candidate\.skipped\?4:2,toleranceProfile\(\)\.frames\)/g)||[]).length,2);
assert.ok(html.includes('/* CANTORIA 1.1 (50): live harmonic-change tolerance'));
assert.ok(html.includes('<h2>CANTORIA 1.1 (51)</h2>'));
console.log('PASS: tolerance slider changes live and native detection, suppresses false changes, persists safely, allows real chords');
