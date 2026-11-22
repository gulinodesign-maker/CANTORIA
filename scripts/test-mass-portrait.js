const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:50});
const marker='/* CANTORIA 1.1 (45): iPad touch-safe corner, transport layout, refined compact Mass cards.';
const idx=html.indexOf(marker);assert.ok(idx>=0);
const css=html.slice(idx,html.indexOf('</style>',idx));
assert.ok(css.includes('@media screen and (orientation:portrait)'),
 'Portrait Mass list must have its own compact layout');
assert.match(css,/\.tiles\.mass-song-tiles\{[^}]*display:grid!important;grid-template-columns:minmax\(0,1fr\)!important;/s,
 'All Mass cards must be full width in one column');
assert.match(css,/\.tiles\.mass-song-tiles>\.mass-song-card\{[^}]*grid-column:1\/-1!important;width:100%!important;/s,
 'Card must occupy the single full-width row');
assert.ok(css.includes('min-height:78px!important;height:auto!important'),
 'No enormous fixed card height in portrait');
assert.ok(css.includes('padding:8px 9px!important'),
 'Remove the old 69px empty padding above title');
assert.ok(css.includes('grid-template-columns:clamp(58px,8.5vw,74px) minmax(0,1fr) 100px!important'),
 'Cross at left, flexible center text, buttons at right');
assert.ok(css.includes('grid-column:2!important;grid-row:1!important'),
 'Title/author/role must align vertically centered next to actions');
for(const rule of ['white-space:normal!important','overflow-wrap:normal!important',
 'word-break:normal!important','text-wrap:wrap!important','hyphens:none!important'])
 assert.ok(css.includes(rule),'Do not split titles unnecessarily: '+rule);
assert.ok(css.includes('top:50%!important;transform:translateY(-50%)!important'),
 'Mass card buttons must be vertically centered');
for(const rule of ['border:1px solid #d9c9a8!important',
 'border-radius:19px!important',
 'box-shadow:0 3px 12px rgba(22,66,52,.075)!important',
 'background:linear-gradient(110deg,#fbf7ed 0%,#fffaf1 55%,#f9f3e8 100%)!important',
 'color:#3e966d!important'])
 assert.ok(css.includes(rule),'Retain polished green/ivory/gold design: '+rule);
const block=js.slice(js.indexOf('function massDetailHTML(){'),js.indexOf('const OCR_JS_URL='));
assert.ok(block.includes('class="tiles mass-song-tiles"'));
assert.ok(block.includes('class="cover-label">\${escape(title)}</div>'),'Keep titles intact');
assert.ok(block.includes('class="cover-author"'),'Keep composer text');
assert.ok(block.includes('class="cover-liturgical"'),'Keep green liturgical role');
assert.ok(block.includes('data-action="read-mass-song"'),'Whole card opens song');
assert.ok(block.includes('data-reorder-item='),'Keep drag-to-reorder');
assert.ok(block.includes('data-action="ask-remove-mass-item"'),'Keep removal');
assert.ok(block.includes('data-action="reset-mass-item-used"'),'Keep used-song reset');
console.log('PASS: compact single-column Mass cards, no dead space, elegant palette, title and actions preserved');
