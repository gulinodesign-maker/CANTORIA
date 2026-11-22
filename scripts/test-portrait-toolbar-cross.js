const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:44});
const marker='/* CANTORIA 1.1 (44) — back is the original cross ornament itself.';
assert.ok(html.includes(marker),'New corner navigation CSS required');
const css=html.slice(html.indexOf(marker),html.indexOf('</style>',html.indexOf(marker));
for(const rule of ['.corner-back-button','clip-path:polygon(', 'z-index:50!important',
 'touch-action:manipulation!important','pointer-events:none!important',
 '.topbar-section .corner-back-button .corner-ornament-cross',
 '.reader-layer .reader-toolbar .corner-back-button .corner-ornament-cross',
 'display:block!important;visibility:visible!important;opacity:1!important'])
 assert.ok(css.includes(rule),'Missing safe clickable cross styling: '+rule);
const mark=js.indexOf('function backCornerHTML(kind){');
const end=js.indexOf('function homeHTML(){',mark);
assert.ok(mark>=0&&end>mark,'Accessible corner button helper required');
const ctx={CATHOLIC_CORNER:'<svg class="corner-ornament"><path class="corner-ornament-cross"></path></svg>'};
vm.runInNewContext(js.slice(mark,end)+'this.make=backCornerHTML;',ctx);
assert.ok(ctx.make('home').includes('data-nav="home"'),'Secondary screens must return Home');
assert.ok(ctx.make('back-masses').includes('data-action="back-masses"'),'Mass detail must return to Mass list');
assert.ok(ctx.make('close-reader').includes('data-action="close-reader"'),'Reader must use normal close path');
for(const kind of ['home','back-masses','close-reader']){
 const dom=ctx.make(kind);
 assert.ok(dom.includes('<button type="button" class="corner-back-button"'),'A real accessible button is required');
 assert.ok(dom.includes('aria-label="Torna indietro"'),'VoiceOver must announce navigation');
 assert.ok(dom.includes('corner-ornament-cross'),'Gold cross must not change');
}
const head=js.slice(js.indexOf('function headerHTML(){'),js.indexOf('function navHTML(){'));
assert.ok(head.includes('topbar-home-labeled">\${CATHOLIC_CORNER}'),'Home cross stays decorative');
assert.ok(head.includes("backCornerHTML('back-masses')"),'Mass uses interactive ornament');
assert.ok(head.includes("backCornerHTML('home')"),'Library, Acquisisci, settings and mass overview use corner');
const photo=js.slice(js.indexOf('function photoReaderHTML(song){'),js.indexOf('function readerHTML(){'));
const reader=js.slice(js.indexOf('function readerHTML(){'),js.indexOf('const CATHOLIC_CORNER'));
for(const [name,code] of [['photo reader',photo],['score reader',reader]]){
 assert.ok(code.includes("backCornerHTML('close-reader')"),name+' uses cross to close');
 assert.ok(!code.includes('reader-back app-back-btn'),name+' has no separate Back arrow');
 const l=code.slice(code.indexOf('<div class="reader-toolbar-left">'),code.indexOf(' </div>\n <div class="reader-title"'));
 assert.ok(l.includes('data-action="follow-rewind"')&&l.includes('data-action="follow-play"'),name+' keeps Rewind and Play');
 assert.equal((l.match(/<button /g)||[]).length,2,name+' left row only contains Rewind and Play');
}
const click=js.slice(js.indexOf("root.addEventListener('click'"),js.indexOf("root.addEventListener('submit'"));
assert.ok(click.includes("if(action==='close-reader')"),'Click handler closes the reader and persists Mass used state');
assert.ok(click.includes("if(action==='back-masses')"),'Click handler keeps Mass navigation');
assert.ok(click.includes('if(el.dataset.nav){state.massId=null;go(el.dataset.nav);return;}'),
 'Click handler supports Home through corner data-nav');
assert.equal((html.match(/class="app-back-btn"/g)||[]).length,0,'Old arrow Back buttons removed');
assert.equal((html.match(/class="reader-back app-back-btn"/g)||[]).length,0);
assert.ok(html.includes('<h2>CANTORIA 1.1 (44)</h2>'));
console.log('PASS: clickable gold-cross corner Back on all secondary screens, decorative on Home and cards, no arrow buttons');
