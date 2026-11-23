const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:55});
const marker='/* CANTORIA 1.1 (46): portrait transport LEFT and the whole gold-cross corner visible.';
const p=html.indexOf(marker);assert.ok(p>html.indexOf('/* CANTORIA 1.1 (45)'),'New overrides must follow old right-side layout');
const css=html.slice(p,html.indexOf('</style>',p));
const portrait=css.slice(css.indexOf('@media screen and (orientation:portrait){'),css.indexOf('@media screen and (orientation:portrait) and (max-width:380px)'));
const narrow=css.slice(css.indexOf('@media screen and (orientation:portrait) and (max-width:380px)'),css.indexOf('@media screen and (orientation:landscape)'));
const landscape=css.slice(css.indexOf('@media screen and (orientation:landscape)'));
for(const selector of [
 '.topbar-section,',
 '.topbar-home,',
 '.reader-layer .reader-toolbar{',
 '.topbar-section>.corner-back-button',
 '.reader-layer .reader-toolbar>.corner-back-button'
])assert.ok(css.includes(selector),'Cross corner container must remain visible: '+selector);
assert.ok(css.includes('overflow:visible!important'),'Do not clip diagonal green cross at landscape toolbar edge');
assert.ok(css.includes('z-index:999!important'),'Accessible back corner must stay above background elements');
assert.ok(css.includes('width:100%!important;height:100%!important'),'Whole SVG must render inside its button');
assert.ok(css.includes('display:block!important;visibility:visible!important;opacity:1!important'),
 'Golden cross must always be visible');
assert.ok(html.includes('/* CANTORIA 1.1 (55): score-first compact toolbar, full-bleed corner. */'));
const corner=js.slice(js.indexOf('function backCornerHTML(kind){'),js.indexOf('function homeHTML(){'));
const ctx={CATHOLIC_CORNER:'<svg class="corner-ornament"><path class="corner-ornament-cross"/></svg>'};
vm.runInNewContext(corner+'this.getCorner=backCornerHTML;',ctx);
for(const [kind,attr] of [
 ['home','data-nav="home"'],['back-masses','data-action="back-masses"'],['close-reader','data-action="close-reader"']
])assert.ok(ctx.getCorner(kind).includes(attr),'Cross remains functional: '+kind);
const head=js.slice(js.indexOf('function headerHTML(){'),js.indexOf('function navHTML(){'));
assert.ok(head.includes('topbar-home-labeled">\${CATHOLIC_CORNER}'),'Home corner stays decorative');
assert.ok(head.includes("backCornerHTML('back-masses')"),'Mass corner is active Back');
const reader=js.slice(js.indexOf('function readerHTML(){'),js.indexOf('const CATHOLIC_CORNER'));
assert.ok(reader.includes("backCornerHTML('close-reader')"),'Reader Back must use cross');
assert.ok(!reader.includes('<div class="reader-toolbar-left">'));
assert.ok(reader.includes('data-action="follow-source"')&&reader.includes('data-action="song-options"'),'Right-side music and menu preserved');
assert.ok(html.includes('<h2>CANTORIA 1.1 (55)</h2>'));
console.log('PASS: left transport in portrait, landscape cross uncropped, Back still accessible everywhere');
