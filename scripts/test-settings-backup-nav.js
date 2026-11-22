const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:49});
const pkg=require('../package.json');
assert.equal(pkg.dependencies['@capacitor/filesystem'],'8.0.0');
assert.equal(pkg.dependencies['@capacitor/share'],'8.0.0');
assert.ok(!html.includes('Modello musicale'));
const settingsA=js.indexOf('function settingsHTML()'),settingsB=js.indexOf('function appHTML()',settingsA);
assert.ok(settingsA>=0&&settingsB>settingsA);
const sc={};
vm.runInNewContext(js.slice(settingsA,settingsB)+'this.settings=settingsHTML;',sc);
const settings=sc.settings();
for(const marker of ['settings-backup-actions','data-action="backup"','for="backupInput"'])assert.ok(settings.includes(marker));
assert.ok(!settings.includes('Modello musicale'));
const css=html.slice(html.indexOf('/* CANTORIA 1.1 (22):'));
assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'));
assert.ok(css.includes('width:100%!important'));
assert.ok(css.includes('.corner-back-button'),'Corner is the universal back control');
assert.ok(css.includes('.topbar-create-mass'));
const sourceHeader=js.slice(js.indexOf('function headerHTML()'),js.indexOf('function navHTML()'));
const ctx={
 state:{view:'masses',massId:null},releaseInfo:{version:'1.1',build:49},
 CATHOLIC_CORNER:'<svg class="corner-ornament"></svg>',backCornerHTML:kind=>kind==='home'?'<button class="corner-back-button" data-nav="home"></button>':'<button class="corner-back-button" data-action="'+kind+'"></button>',escape:s=>s,massDateDisplay:()=>'',currentMass(){return null}
};
vm.runInNewContext(sourceHeader+'this.head=headerHTML;',ctx);
let top=ctx.head();
assert.ok(!top.includes('data-action="create-mass"'),'Creation button moves below the gold topbar');
assert.ok(top.includes('data-nav="home"'),'Back to home must be in the top left');
assert.ok(top.indexOf('class="corner-back-button"')<top.indexOf('class="header-section-title"'));
ctx.state.view='settings';top=ctx.head();
assert.ok(top.includes('Versione 1.1 (49)'));
assert.ok(!top.includes('create-mass'));
ctx.state.view='masses';ctx.state.massId='m1';ctx.currentMass=()=>({name:'Messa 1',items:[],date:'',celebratedAt:null});
top=ctx.head();
assert.ok(top.includes('data-action="back-masses"'));
assert.ok(!top.includes('data-nav="home"'),'A detail back button must return to the Mass list');
const massA=js.indexOf('function massesHTML()'),massB=js.indexOf('function massDetailHTML()',massA);
assert.ok(js.slice(massA,massB).includes('data-action="create-mass"'),'Mass create button is centered below the topbar');
assert.equal((html.match(/class="reader-back app-back-btn"/g)||[]).length,0);
assert.equal((html.match(/backCornerHTML\('close-reader'\)/g)||[]).length,2,'Both reader types use the cross as Back');
const a=js.indexOf('async function exportJSON(store){'),b=js.indexOf('function importJSON(',a);
assert.ok(a>=0&&b>a);
let output,shared;
const files={
 async writeFile(options){output=options;return {uri:'file:///tmp/Cantoria-backup.json'};},
 async getUri(){throw Error('URI present');}
};
const share={async share(options){shared=options;}};
const env={
 window:{Capacitor:{isNativePlatform:()=>true,Plugins:{Filesystem:files,Share:share}}},
 navigator:{},Date,JSON,Error,File,Blob,URL,setTimeout
};
vm.runInNewContext(js.slice(a,b)+'this.exportBackup=exportJSON;',env);
(async()=>{
 const data={songs:[{id:'song1',title:'Signore pietà'}],masses:[{id:'m1',name:'Messa'}]};
 await env.exportBackup(data);
 assert.equal(output.directory,'CACHE');
 assert.equal(output.encoding,'utf8');
 assert.deepEqual(JSON.parse(output.data),data);
 assert.ok(output.path.startsWith('Cantoria-backup-')&&output.path.endsWith('.json'));
 assert.deepEqual([...shared.files],['file:///tmp/Cantoria-backup.json']);
 assert.equal(shared.title,'Backup Cantoria');
 assert.ok(js.includes("exportJSON(store).catch(err=>"),'Errors must be shown to the user');
 console.log('PASS: native backup shares a valid JSON file; equal buttons; unified back; Mass action top-right');
})().catch(err=>{console.error(err);process.exitCode=1;});
