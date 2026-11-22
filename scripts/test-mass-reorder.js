const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(code);new vm.Script(code);
assert.deepEqual(require('../release.json'),{version:'1.1',build:42});
const detail=code.slice(code.indexOf('function massDetailHTML(){'),code.indexOf('const OCR_JS_URL=',code.indexOf('function massDetailHTML(){')));
for(const token of ['data-mass-reorder=','data-reorder-item=','mass-reorder-help'])
 assert.ok(detail.includes(token),'Missing Mass drag markup '+token);
assert.ok(detail.includes('!done?'),'Celebrated Mass must remain read-only');
const css=html.slice(html.indexOf('/* CANTORIA 1.1 (28):'));
for(const token of ['mass-song-ghost','mass-song-placeholder','mass-song-reordering','@media (prefers-reduced-motion:reduce)'])
 assert.ok(css.includes(token),token);
const pureStart=code.indexOf('function reorderedMassItems(');
const pureEnd=code.indexOf('function markCurrentMassSongUsed()',pureStart);
assert.ok(pureStart>0&&pureEnd>pureStart);
const helper=code.slice(pureStart,pureEnd);
const pure={};vm.runInNewContext(helper+'this.move=reorderedMassItems;',pure);
const items=[{id:'i1',title:'A',usedAt:'retained'},{id:'i2',title:'B'},{id:'i3',title:'C'}];
assert.deepEqual(Array.from(pure.move(items,'i1',2),x=>x.id),['i2','i3','i1']);
assert.deepEqual(Array.from(pure.move(items,'i3',0),x=>x.id),['i3','i1','i2']);
assert.equal(pure.move(items,'missing',1),null);
assert.equal(pure.move(items,'i2',-1),null);
assert.equal(pure.move(items,'i2',3),null);
assert.equal(pure.move(items,'i2',1)[1],items[1]);
assert.equal(items[0].usedAt,'retained','Used state must survive reordering');
assert.deepEqual(items.map(x=>x.id),['i1','i2','i3'],'Pure reorder must not mutate original');
const handlerStart=code.indexOf('function setupMassSongReorder()'),handlerEnd=code.indexOf('function setupLongPress()',handlerStart);
assert.ok(handlerStart>0&&handlerEnd>handlerStart);
const handlers=code.slice(handlerStart,handlerEnd);
for(const token of ['HOLD_MS=520','setTimeout(activate,HOLD_MS)','root.addEventListener(\'touchmove\'',
 'window.addEventListener(\'pointerup\'','window.addEventListener(\'pointercancel\'',
 'window.addEventListener(\'pagehide\'','saveStore(store)','if(!saveStore(store))','window.scrollBy(0,delta)','skipClickUntil'])
 assert.ok(handlers.includes(token),'Missing drag behavior '+token);
assert.ok(code.includes('setupMassSongReorder();'),'Long-press must be initialized');

const callbacks={root:{},window:{}};
const subscribe=where=>(name,callback,options)=>{(callbacks[where][name]??=[]).push({callback,options});};
let timers=[],frames=[],saves=[],messages=[],renders=0,now=10000,scrolls=0;
const later=fn=>{const timer={fn,cancelled:false};timers.push(timer);return timer;};
const scheduled=fn=>{frames.push(fn);return frames.length;};
const classList=()=>{const cls=new Set();return {
 add(x){cls.add(x);},remove(x){cls.delete(x);},contains(x){return cls.has(x);}
};};
const baseNode=()=>({classList:classList(),style:{},attributes:{},
 setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},
 remove(){this.removed=true;}});
const list=baseNode();
list.dataset={massReorder:'m1'};list.children=[];list.scrollHeight=100;list.clientHeight=100;
list.querySelectorAll=()=>list.children.slice();
list.insertBefore=(card,before)=>{
 const i=list.children.indexOf(card);if(i>=0)list.children.splice(i,1);
 const j=list.children.indexOf(before);list.children.splice(j<0?list.children.length:j,0,card);
 card.parentElement=list;
};
list.appendChild=card=>{
 const i=list.children.indexOf(card);if(i>=0)list.children.splice(i,1);
 list.children.push(card);card.parentElement=list;
};
Object.defineProperty(list,'lastElementChild',{get(){return list.children.at(-1)||null;}});
const makeCard=id=>{
 const card=baseNode();card.dataset={reorderItem:id};card.isConnected=true;
 card.getBoundingClientRect=()=>{
  const i=list.children.indexOf(card);
  return {left:50,top:100+i*100,width:300,height:80,right:350,bottom:180+i*100};
 };
 card.closest=selector=>{
  if(selector.startsWith('button,input'))return null;
  if(selector.startsWith('.mass-song-tiles[data-mass-reorder]'))return card;
  if(selector.startsWith('.mass-song-tiles,.mass-song-ghost'))return list;
  return null;
 };
 card.cloneNode=()=>baseNode();
 list.appendChild(card);return card;
};
const cards=['i1','i2','i3'].map(makeCard);
const document={body:{appendChild(el){this.ghost=el;}},documentElement:{clientHeight:800}};
const root={addEventListener:subscribe('root')};
const window={innerHeight:800,addEventListener:subscribe('window'),scrollBy(){scrolls++;},
 getComputedStyle(){return {overflowY:'visible'};}};
const mass={id:'m1',items:items.slice(),celebratedAt:null};
const state={view:'masses',songId:null,massId:'m1',modal:null};
const env={root,window,document,mass,state,store:{masses:[mass]},navigator:{},
 currentMass:()=>mass,reorderedMassItems:pure.move,
 render(){renders++;},notify(msg){messages.push(msg);},
 saveStore(){saves.push(mass.items.map(x=>x.id));return true;},
 setTimeout:later,clearTimeout:t=>{t.cancelled=true;},
 requestAnimationFrame:scheduled,cancelAnimationFrame(){},
 Date:{now(){return now;}},Math};
vm.runInNewContext(handlers+'setupMassSongReorder();',env);
const fire=(scope,name,e)=>{for(const h of callbacks[scope][name]||[])h.callback(e);};
const down=(card,pointerId=11,x=120,y=140)=>fire('root','pointerdown',{
 target:card,isPrimary:true,pointerType:'touch',pointerId,clientX:x,clientY:y});
const up=(id=11)=>fire('window','pointerup',{pointerId:id});
down(cards[0]);up();
assert.equal(saves.length,0,'Short tap cannot reorder');
assert.equal(renders,0,'Short tap does not rerender');
assert.equal(timers[0].cancelled,true,'Short tap cancels pending hold');
// Press, hold, drag to the bottom, release.
now+=1000;down(cards[0]);timers.at(-1).fn();
assert.ok(cards[0].classList.contains('mass-song-placeholder'),'Dragged card displays placeholder');
assert.ok(document.body.ghost?.classList.contains('mass-song-ghost'),'A finger-following ghost should appear');
let prevented=false;
fire('root','touchmove',{changedTouches:[{clientX:245,clientY:380}],cancelable:true,
 preventDefault(){prevented=true;}});
assert.equal(prevented,true,'Touch scrolling suppressed only during an active drag');
fire('window','pointermove',{pointerId:11,clientX:245,clientY:380,cancelable:true,preventDefault(){}});
assert.deepEqual(list.children.map(el=>el.dataset.reorderItem),['i2','i3','i1'],
 'Other cards must change position while the finger moves');
up();
assert.equal(document.body.ghost.removed,true);
assert.deepEqual(mass.items.map(x=>x.id),['i2','i3','i1']);
assert.equal(saves.length,1);
assert.equal(mass.items[2],items[0],'The original Mass item object is preserved');
assert.equal(mass.items[2].usedAt,'retained');
const click={target:cards[0],preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
fire('root','click',click);
assert.equal(click.prevented,true,'Click after dragging cannot open song');
now+=900;
const ordinary={target:cards[0],preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};
fire('root','click',ordinary);assert.ok(!ordinary.prevented,'Ordinary later taps still work');
// A saved/celebrated Mass must not permit another drag.
mass.celebratedAt='2026-11-21T10:00:00Z';down(cards[1]);
assert.equal(timers.length,2,'Archived cards must not start any hold timer');
mass.celebratedAt=null;
// Drag cancellation leaves previously saved ordering unchanged.
down(cards[1]);timers.at(-1).fn();
fire('window','pointercancel',{pointerId:11});
assert.deepEqual(mass.items.map(x=>x.id),['i2','i3','i1'],'Cancel must not mutate data');
assert.equal(saves.length,1);
// Failure to persist reverts the old order.
env.saveStore=()=>false; // callback is created in environment, so mutate the environment function.
now+=1000;down(cards[2]);timers.at(-1).fn();
fire('window','pointermove',{pointerId:11,clientX:120,clientY:110,cancelable:true,preventDefault(){}});
up();
assert.deepEqual(mass.items.map(x=>x.id),['i2','i3','i1'],'Failed save must restore prior order');
assert.ok(messages.some(x=>x.includes('Impossibile salvare')),'Save failure should be surfaced');
console.log('PASS: Mass long-press drag, live reorder, persisted order, normal taps, archives and rollback');
