const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:51});
const hStart=js.indexOf('function headerHTML(){'),hEnd=js.indexOf('function navHTML(){');
const lStart=js.indexOf('function massesHTML(){'),lEnd=js.indexOf('function massDetailHTML(){');
assert.ok(hStart>0&&hEnd>hStart&&lStart>hEnd&&lEnd>lStart);
const planned={id:'m1',name:'Messa futura',date:'2026-11-29',items:[{id:'a',songId:'s1'}]};
const past={id:'m2',name:'Messa celebrata',date:'2026-11-22',celebratedAt:'2026-11-22T10:00:00Z',items:[{id:'b',songId:'s1',archiveTitle:'Canto archiviato'}]};
const state={view:'masses',massId:null};
const ctx={state,releaseInfo:{version:'1.1',build:51},
 store:{songs:[{id:'s1',title:'Un canto che non deve apparire nella card'}],masses:[planned,past]},
 escape:x=>String(x),escapeAttr:x=>String(x),massDateDisplay:date=>date?date.slice(8)+'/'+date.slice(5,7)+'/'+date.slice(0,4):'Data da definire',
 CATHOLIC_CORNER:'<svg class="corner-ornament"><path class="corner-ornament-cross"/></svg>',
 backCornerHTML:kind=>'<button class="corner-back-button" data-nav="'+kind+'"></button>',
 currentMass(){return null}};
vm.runInNewContext(js.slice(hStart,hEnd)+'this.header=headerHTML;',ctx);
vm.runInNewContext(js.slice(lStart,lEnd)+'this.list=massesHTML;',ctx);
const header=ctx.header(),list=ctx.list();
assert.ok(header.includes('class="topbar topbar-section topbar-standard topbar-masses"'),'Dedicated compact Mass list header');
assert.ok(header.includes('class="header-section-title">Messe'),'Keep centered title');
assert.ok(!header.includes('data-action="create-mass"'),'No create button in header');
assert.ok(header.includes('class="corner-back-button"'),'Original corner Back remains');
const headerDetail=js.slice(hStart,hEnd);
assert.ok(headerDetail.includes('topbar-mass-detail'),'Mass detail uses its own compact header');
assert.ok(headerDetail.includes('mass-topbar-name')&&headerDetail.includes('mass-topbar-date'),'Mass detail keeps name and date');
assert.ok(list.includes('class="mass-list-action-row"'),'Create button comes after the header');
assert.equal((list.match(/data-action="create-mass"/g)||[]).length,1,'Exactly one create button, centered in body');
assert.ok(list.indexOf('mass-list-action-row')<list.indexOf('In programma'),'Create button goes before Mass records');
assert.equal((list.match(/class="mass-card mass-record-card/g)||[]).length,2);
assert.equal((list.match(/class="mass-record-corner"/g)||[]).length,2,'All planned and historical cards get a gold cross');
assert.equal((list.match(/class="corner-ornament-cross"/g)||[]).length,2,'Original decorative gold cross on every record');
assert.ok(list.includes('mass-planned-card')&&list.includes('mass-history-card'),'Both card types get consistent styling');
assert.ok(list.includes('class="mass-record-date">29/11/2026'),'Date is preserved in planned card');
assert.ok(list.includes('Celebrata · 22/11/2026'),'Date and status are preserved in archived card');
assert.equal((list.match(/class="mass-count"/g)||[]).length,2,'Count remains on summary cards, not detail topbar');
assert.ok(!list.includes('Un canto che non deve apparire nella card'),'Never show live song previews');
assert.ok(!list.includes('Canto archiviato'),'Never show historical song previews');
assert.ok(!list.includes('class="mass-history-songs"'),'No preview paragraph');
assert.ok(list.includes('data-action="reuse-mass"'),'Reuse still works for historical Mass');
assert.equal((list.match(/data-action="ask-delete-mass"/g)||[]).length,2,'Delete actions preserved');
assert.equal((list.match(/data-action="open-mass"/g)||[]).length,2,'Tap whole record opens Mass');
const marker='/* CANTORIA 1.1 (48): compact Mass headers and elegant summary cards with a right cross.';
const pos=html.indexOf(marker);
assert.ok(pos>0,'Build48 overrides must exist');
const css=html.slice(pos,html.indexOf('</style>',pos));
for(const rule of [
 '.topbar-section.topbar-standard.topbar-masses{',
 'height:calc(57px + env(safe-area-inset-top,0px))!important',
 '.topbar-section.topbar-mass-detail{',
 'height:calc(65px + env(safe-area-inset-top,0px))!important',
 '.section-workspace>.mass-list-action-row{',
 'justify-content:center!important',
 '.mass-list-action-row>.mass-create-btn{',
 '.mass-record-card>.mass-record-corner>.corner-ornament{',
 '.mass-record-card>.mass-delete-btn{',
 '.mass-record-card .mass-card-controls{'
])assert.ok(css.includes(rule),'Missing build 50 layout '+rule);
assert.ok(css.includes('@media screen and (orientation:portrait)')&&css.includes('@media screen and (orientation:landscape)'),
 'Both device orientations must be covered');
assert.ok(html.includes('<h2>CANTORIA 1.1 (51)</h2>'));
const finalMarker='/* CANTORIA 1.1 (49): Mass list cards, gold cross LEFT and delete X RIGHT.';
const finalPos=html.indexOf(finalMarker);
assert.ok(finalPos>pos,'Build49 inversion must override Build48');
const finalCss=html.slice(finalPos,html.indexOf('</style>',finalPos));
assert.match(finalCss,/\.mass-record-card>\.mass-record-corner\{[^}]*left:0!important;right:auto!important;top:0!important;[^}]*transform:none!important;/s,'Corner is at LEFT without mirroring');
assert.match(finalCss,/\.mass-record-card>\.mass-delete-btn\{[^}]*left:auto!important;right:11px!important;top:11px!important;/s,'X is at RIGHT');
assert.ok(finalCss.includes('pointer-events:none!important'),'Decorative cross never intercepts taps');
assert.ok(finalCss.includes('z-index:5!important;pointer-events:auto!important'),'Delete button remains clickable');
assert.ok(finalCss.includes('.mass-record-card .eyebrow{'),'Celebrated date clears left cross');
assert.ok(finalCss.includes('.mass-record-card .mass-record-title-row{'),'Title clears left cross');
console.log('PASS: Mass cards gold cross LEFT, delete X RIGHT, no song previews, all actions retained');
