const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new vm.Script(js);
assert.deepEqual(require('../release.json'),{version:'1.1',build:52});
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
for(const token of [
 '.reader-layer.reader-portrait .reader-toolbar-left{',
 'left:clamp(127px,29vw,148px)!important',
 'right:auto!important',
 'justify-content:flex-start!important',
 'flex-direction:row!important;flex-wrap:nowrap!important',
 'z-index:1000!important;pointer-events:auto!important'
])assert.ok(portrait.includes(token),'Rewind and Play must remain LEFT in portrait: '+token);
assert.ok(!portrait.includes('right:114px!important'),'Old right alignment must be overridden');
assert.ok(narrow.includes('left:clamp(117px,30vw,125px)!important'),
 'Small iPhones keep Rewind and Play immediately after cross');
assert.ok(landscape.includes('width:96px!important;min-width:96px!important')&&
 landscape.includes('height:78px!important;min-height:78px!important'),
 'Landscape corner must preserve full aspect ratio without cropping');
assert.ok(landscape.includes('margin-left:clamp(111px,11vw,140px)!important'),
 'Landscape transport must remain outside clickable corner');
assert.ok(landscape.includes('pointer-events:auto!important;z-index:1001!important'),
 'Landscape transport must remain tappable');
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
const left=reader.slice(reader.indexOf('<div class="reader-toolbar-left">'),reader.indexOf(' </div>\n <div class="reader-title"'));
assert.ok(left.indexOf('data-action="follow-rewind"')>=0&&left.indexOf('data-action="follow-play"')>left.indexOf('data-action="follow-rewind"'),'Rewind and Play in correct left order');
assert.ok(reader.includes('data-action="follow-source"')&&reader.includes('data-action="song-options"'),'Right-side music and menu preserved');
assert.ok(html.includes('<h2>CANTORIA 1.1 (52)</h2>'));
console.log('PASS: left transport in portrait, landscape cross uncropped, Back still accessible everywhere');
