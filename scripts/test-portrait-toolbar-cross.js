const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);new vm.Script(script);
assert.deepEqual(require('../release.json'),{version:'1.1',build:43});
const marker='/* CANTORIA 1.1 (43): fixed portrait transport row and protected gold cross.';
assert.ok(html.includes(marker),'Missing build 43 layout override');
const css=html.slice(html.indexOf(marker),html.indexOf('</style>',html.indexOf(marker)));
const baseHidden=html.indexOf('.reader-layer .reader-toolbar .corner-ornament-cross{display:none;}');
const restored=html.lastIndexOf('.reader-layer .reader-toolbar .corner-ornament-cross{');
assert.ok(baseHidden>=0&&restored>baseHidden,'Restoration must override old hidden cross style');
for(const selector of [
 '.topbar-home .corner-ornament-cross',
 '.topbar-section .corner-ornament-cross',
 '.reader-layer .reader-toolbar .corner-ornament-cross'
])assert.ok(css.includes(selector),'Cross must remain visible on '+selector);
assert.ok(css.includes('display:block!important;visibility:visible!important;opacity:1!important'),
 'Explicitly restore the decorative cross despite legacy display:none');
assert.ok(css.includes('@media screen and (orientation:portrait)'),
 'Cover portrait iPhone and portrait iPad; do not alter landscape');
assert.ok(css.includes('margin-left:clamp(84px,21vw,101px)!important'),
 'Back on library/settings/masses must sit next to, but clear, corner');
assert.ok(css.includes('left:clamp(92px,23vw,113px)!important'),
 'Mass back must also clear corner');
const reader=script.slice(script.indexOf('function readerHTML(){'),script.indexOf('const CATHOLIC_CORNER ='));
const photo=script.slice(script.indexOf('function photoReaderHTML(song){'),script.indexOf('function readerHTML(){'));
for(const [name,markup] of [['reader',reader],['photo',photo]]){
 assert.ok(markup.includes('<header class="reader-toolbar">\${CATHOLIC_CORNER}'),name+' has decorative corner');
 const start=markup.indexOf('<div class="reader-toolbar-left">');
 const end=markup.indexOf(' </div>\n <div class="reader-title"',start);
 assert.ok(start>=0&&end>start,name+' has one compact left group before title');
 const buttons=markup.slice(start,end);
 const actions=['close-reader','follow-rewind','follow-play'];
 const indices=actions.map(a=>buttons.indexOf('data-action="'+a+'"'));
 assert.ok(indices.every(i=>i>=0)&&indices[0]<indices[1]&&indices[1]<indices[2],
  name+' has Back/Rewind/Play in one group and correct order');
 assert.equal((buttons.match(/<button /g)||[]).length,3,name+' has exactly three left buttons');
}
assert.ok(css.includes('.reader-layer.reader-portrait .reader-toolbar-left{')&&
 css.includes('flex-direction:row!important;flex-wrap:nowrap!important'),
 'Three transport buttons must never wrap or stack');
assert.ok(css.includes('.reader-layer.reader-portrait .reader-toolbar-left>.reader-back.app-back-btn,')&&
 css.includes('.reader-layer.reader-portrait .reader-toolbar-left>.reader-audio-btn{')&&
 css.includes('position:relative!important;top:auto!important;left:auto!important'),
 'Clear old absolute positions for both buttons and back');
assert.ok(css.includes('.reader-layer.reader-portrait .reader-title{')&&
 css.includes('top:calc(55px + env(safe-area-inset-top,0px))!important'),
 'Title must sit on a separate second row without overlapping the controls');
assert.ok(css.includes('top:calc(7px + env(safe-area-inset-top,0px))!important'),
 'Both transport rows and right actions must align with safe area');
assert.ok(css.includes('@media screen and (orientation:portrait) and (max-width:350px)'),
 'Fit compact iPhone widths without hiding the cross');
assert.ok(html.includes('<h2>CANTORIA 1.1 (43)</h2>'),'Latest build must be shown in release notes');
console.log('PASS: three portrait controls on one left row, optimized Back and visible gold crosses');
