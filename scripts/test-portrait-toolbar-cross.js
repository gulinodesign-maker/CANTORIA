const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:45});
const marker='/* CANTORIA 1.1 (45): iPad touch-safe corner, transport layout, refined compact Mass cards.';
const index=html.indexOf(marker);
assert.ok(index>0,'Build45 CSS must override older iPad/tablet positions');
const css=html.slice(index,html.indexOf('</style>',index));
for(const selector of [
 '.topbar-section>.corner-back-button',
 '.reader-layer .reader-toolbar>.corner-back-button',
 '.reader-layer.reader-portrait .reader-toolbar-left{',
 '.reader-layer.reader-portrait .reader-toolbar-right{',
 '.reader-layer.reader-landscape .reader-toolbar-left{',
 '.reader-layer.reader-landscape .reader-toolbar-left>.reader-audio-btn{'
]) assert.ok(css.includes(selector),'Missing '+selector);
for(const rule of [
 '-webkit-clip-path:none!important;clip-path:none!important',
 'pointer-events:auto!important;touch-action:manipulation!important',
 'z-index:999!important',
 'min-width:110px!important;min-height:104px!important',
 'width:clamp(116px,15vw,140px)!important;height:112px!important',
 'pointer-events:none!important;z-index:0!important',
 'display:block!important;visibility:visible!important;opacity:1!important'
])assert.ok(css.includes(rule),'iPad cross must remain a large accessible hit target: '+rule);
assert.ok(css.indexOf('clip-path:none!important')>0,'Override older clipped area on iPad');
assert.ok(css.includes('right:114px!important'),'Portrait Rewind/Play must sit at right beside music/menu');
assert.ok(css.includes('right:96px!important'),'Even narrow iPhones must fit transport on the right');
assert.ok(css.includes('right:10px!important'),'Music/menu anchor to right edge');
assert.ok(css.includes('margin-left:clamp(129px,13vw,160px)!important'),
 'Landscape Rewind/Play must not sit under top-left green corner');
assert.ok(css.includes('z-index:1001!important;pointer-events:auto!important'),
 'Landscape Rewind/Play must remain clickable');
const corner=js.slice(js.indexOf('function backCornerHTML(kind){'),js.indexOf('function homeHTML(){'));
assert.ok(corner.includes('class="corner-back-button"'),'Gold cross remains a real clickable button');
assert.ok(corner.includes('aria-label="Torna indietro"'),'Screen readers must announce Back');
assert.ok(corner.includes("const attr=kind==='home'"),'Home navigation still wired');
const ctx={CATHOLIC_CORNER:'<svg class="corner-ornament"><path class="corner-ornament-cross"></path></svg>'};
vm.runInNewContext(corner+'this.corner=backCornerHTML;',ctx);
for(const [kind,attr] of [
 ['home','data-nav="home"'],['back-masses','data-action="back-masses"'],
 ['close-reader','data-action="close-reader"']
])assert.ok(ctx.corner(kind).includes(attr),'Corner navigation mismatch '+kind);
const header=js.slice(js.indexOf('function headerHTML(){'),js.indexOf('function navHTML(){'));
assert.ok(header.includes('topbar-home-labeled">\${CATHOLIC_CORNER}'),
 'Home cross must remain only decorative');
assert.ok(header.includes("backCornerHTML('back-masses')"),'Mass corner returns to list');
const reader=js.slice(js.indexOf('function readerHTML(){'),js.indexOf('const CATHOLIC_CORNER'));
assert.ok(reader.includes("backCornerHTML('close-reader')"),'Score reader closes from the cross');
assert.ok(reader.includes('data-action="follow-rewind"')&&reader.includes('data-action="follow-play"'),
 'Preserve both transport buttons');
assert.ok(html.includes('<h2>CANTORIA 1.1 (45)</h2>'));
console.log('PASS: iPad cross full touch target, portrait transport far-right, landscape clear of cross and tappable');
