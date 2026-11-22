const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.deepEqual(require('../release.json'),{version:'1.1',build:45});
assert.ok(js);new vm.Script(js);
const marker='/* CANTORIA 1.1 (45) — back is the original cross ornament itself.';
const css=html.slice(html.indexOf(marker),html.indexOf('</style>',html.indexOf(marker)));
assert.ok(css.includes('@media screen and (orientation:portrait)'), 'Portrait-specific layout required');
for(const selector of [
 '.tiles.mass-song-tiles{',
 '.tiles.mass-song-tiles>.mass-song-card{',
 '.tiles.mass-song-tiles>.mass-song-card>.song-cover{',
 '.tiles.mass-song-tiles>.mass-song-card .song-cover .cover-content',
 '.tiles.mass-song-tiles>.mass-song-card .song-cover .cover-content>.cover-label'
])assert.ok(css.includes(selector),'Missing Mass portrait selector: '+selector);
assert.match(css,/\.tiles\.mass-song-tiles\{[^}]*display:grid!important;grid-template-columns:minmax\(0,1fr\)!important;/s,
 'Every Mass card is in a single full-width column, never two-up in portrait');
assert.match(css,/\.tiles\.mass-song-tiles>\.mass-song-card\{[^}]*grid-column:1\/-1!important;[^}]*width:100%!important;/s,
 'Card must occupy the whole available viewport width');
assert.ok(css.includes('padding:69px 12px 12px!important'),'Corner/buttons get their own top strip');
assert.ok(css.includes('width:100%!important;max-width:100%!important;')&&css.includes('padding:0!important;gap:2px!important'),
 'Text must have full inner card width, no 48px or 80px old side padding');
for(const property of ['white-space:normal!important','overflow-wrap:normal!important',
 'word-break:normal!important','text-wrap:wrap!important'])
 assert.ok(css.includes(property),'Titles must remain one line if they fit: '+property);
assert.ok(css.includes('top:12px!important'),'Card action buttons remain in top strip');
const code=js.slice(js.indexOf('function massDetailHTML(){'),js.indexOf('const OCR_JS_URL='));
assert.ok(code.includes('class="tiles mass-song-tiles"'));
assert.ok(code.includes('class="song-card mass-song-card'));
assert.ok(code.includes('class="cover-label">\${escape(title)}</div>'),'Title remains unchanged, not split with manual breaks');
assert.ok(code.includes('class="cover-author"'),'Preserve author');
assert.ok(code.includes('class="cover-liturgical"'),'Preserve liturgical function');
assert.ok(css.includes('text-align:center!important'),'Cards remain centered');
console.log('PASS: one Mass card per portrait row, title uses full width before wrapping, author and green role retained');
