const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(code);new vm.Script(code);
assert.deepEqual(require('../release.json'),{version:'1.1',build:49});
const marker='/* CANTORIA 1.1 (35): 15% green Home icon backgrounds and centered Mass heading. */';
assert.equal(html.split(marker).length,2,'Missing build 35 design override');
const css=html.slice(html.indexOf(marker),html.indexOf('</style>',html.indexOf(marker)));
for(const selector of [
 '.home-grid .home-tile .home-tile-icon',
 '.home-grid .home-tile[data-nav="capture"] .home-tile-icon',
 '.home-grid .home-tile[data-nav="masses"] .home-tile-icon',
 '.topbar-section.topbar-mass-detail .mass-topbar-title-block',
 '.topbar-section.topbar-mass-detail .mass-topbar-name',
 '.topbar-section.topbar-mass-detail .mass-topbar-date'
])assert.ok(css.includes(selector),'Missing CSS override '+selector);
assert.ok(css.includes('background:rgba(23,68,55,.15)!important'),'Must use 15% opacity in background, not opacity on icon');
assert.ok(!/^\s*opacity\s*:/m.test(css),'Do not make icon artwork/text translucent');
assert.ok(css.includes('align-items:center!important') && css.includes('text-align:center!important'),'Mass header must be centered');
assert.ok(css.includes('margin-inline:auto!important'),'Title still centered after removing count');
assert.ok(css.includes('margin-inline:auto!important'),'Header block must center in viewport');
const start=code.indexOf('function headerHTML()'),end=code.indexOf('function navHTML()',start);
assert.ok(start>=0&&end>start);
const state={view:'masses',massId:'m1'};
const ctx={state,currentMass:()=>({id:'m1',name:'Messa 1',date:'2026-11-22',items:[{songId:'s1'}]}),massDateDisplay:()=> '22/11/2026',CATHOLIC_CORNER:'<svg></svg>',backCornerHTML:kind=>'<button class="corner-back-button" data-action="'+kind+'"></button>',escape:x=>String(x),releaseInfo:{version:'1.1',build:49}};
vm.runInNewContext(code.slice(start,end)+'this.header=headerHTML;',ctx);
const header=ctx.header();
for(const token of ['class="mass-topbar-title-block"','class="mass-topbar-name">Messa 1','class="mass-topbar-date">22/11/2026'])
 assert.ok(header.includes(token),'Missing Mass header '+token);
assert.ok(header.includes('data-action="back-masses"'),'Back button must remain');
assert.ok(!header.includes('SCALETTA')&&!header.includes('1 canto'),'No overline or count on Mass top bar');
console.log('PASS: Home icons unchanged; Mass title/date centered with Back and without count/overline');
