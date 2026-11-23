const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);new vm.Script(script);
assert.deepEqual(require('../release.json'),{version:'1.1',build:51});
const start=script.indexOf('function homeHTML()'),stop=script.indexOf('function headerHTML()',start);
assert.ok(start>=0&&stop>start,'Home must have isolated template');
const view=vm.runInNewContext(script.slice(start,stop)+'homeHTML();',{});
const nav=Array.from(view.matchAll(/<button\b[^>]*\bdata-nav="([^"]+)"[^>]*>/g),x=>x[1]);
assert.deepEqual(nav,['capture','library','masses','settings'],'Home order must read left-right then top-bottom');
const names=Array.from(view.matchAll(/<strong>(Acquisisci|Biblioteca|Messe|Impostazioni)<\/strong>/g),x=>x[1]);
assert.deepEqual(names,['Acquisisci','Biblioteca','Messe','Impostazioni'],'Visible labels must follow the same order');
assert.equal(new Set(nav).size,4,'No duplicate or omitted home button');
const gear=view.match(/<button\b[^>]*data-nav="settings"[^>]*>[\s\S]*?<svg ([^>]+)>([\s\S]*?)<\/svg>/);
assert.ok(gear,'Settings must render an inline SVG gear');
assert.match(gear[1],/fill="none"/,'Settings cog is a clean outline icon');
assert.match(gear[1],/stroke="currentColor"/,'Gear color must follow the existing home theme');
assert.match(gear[2],/<path d="M28 7h8/,'Gear must have teeth, not the old slider symbol');
assert.match(gear[2],/<circle cx="32" cy="34" r="9"\/>/,'Gear must show a circular hub');
assert.ok(!gear[2].includes('M10 17h20m12'),'Old sliders must be removed');
const css=html.slice(0,html.indexOf('</style>'));
assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))')||
 css.includes('grid-template-columns:repeat(2,minmax(0,1fr));'),'Portrait must retain a 2-column grid');
assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))!important'),'Landscape must use the visual left-to-right order');
assert.ok(!/home-tile:nth-child/.test(css),'Tile colors should not depend on their new order');
for(const token of [
 '.home-tile[data-nav="capture"] .home-tile-icon',
 '.home-tile[data-nav="masses"] .home-tile-icon',
 '.home-tile[data-nav="settings"] .home-tile-icon',
 'background:rgba(23,68,55,.15)!important'
])assert.ok(css.includes(token),'Keep original semantic icon styling: '+token);
console.log('PASS: Home order capture/library/masses/settings, outlined Settings cog and position-independent styling');
