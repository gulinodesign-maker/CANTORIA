/* CANTORIA 1.1 (51) — local, offline liturgical calendar and colour palette.
 * Seasons are calculated from the civil date; a local or transferred feast can
 * differ from the general calendar and is deliberately left overridable per Mass.
 */
(function(global){
'use strict';
const COLORS={
 green:{name:'Verde',primary:'#174638',accent:'#174638',secondary:'#326353',ink:'#FFFFFF',soft:'rgba(23,70,56,.15)',border:'#A9BCAD'},
 violet:{name:'Viola',primary:'#754696',accent:'#754696',secondary:'#8B62A4',ink:'#FFFFFF',soft:'rgba(117,70,150,.15)',border:'#BB9ACB'},
 morello:{name:'Morello',primary:'#67416F',accent:'#67416F',secondary:'#795482',ink:'#FFFFFF',soft:'rgba(103,65,111,.15)',border:'#B5A0BA'},
 white:{name:'Bianco',primary:'#F2EDE0',accent:'#7D6338',secondary:'#DAD1BC',ink:'#2E291E',soft:'rgba(176,146,86,.15)',border:'#C8B78E'},
 red:{name:'Rosso',primary:'#AC3442',accent:'#9B303C',secondary:'#C05863',ink:'#FFFFFF',soft:'rgba(172,52,66,.15)',border:'#D4A1A5'},
 rose:{name:'Rosa',primary:'#D58FA5',accent:'#89445D',secondary:'#E0A7B7',ink:'#30222A',soft:'rgba(181,91,123,.15)',border:'#D2A1B4'},
 black:{name:'Nero',primary:'#34353A',accent:'#34353A',secondary:'#55565B',ink:'#FFFFFF',soft:'rgba(52,53,58,.15)',border:'#ADADB1'}
};
const SEASONS=[
 {id:'all',label:"Tutto l'anno"},
 {id:'advent',label:'Avvento'},
 {id:'christmas',label:'Natale'},
 {id:'lent',label:'Quaresima'},
 {id:'easter',label:'Tempo pasquale'},
 {id:'pentecost',label:'Pentecoste'},
 {id:'afterPentecost',label:'Dopo Pentecoste'},
 {id:'ordinary',label:'Tempo Ordinario'}
];
const MOMENTS=['Ingresso','Atto penitenziale','Gloria','Salmo','Alleluia','Offertorio','Santo','Agnello di Dio','Comunione','Ringraziamento','Canto finale'];
function day(value){
 if(value instanceof Date && Number.isFinite(value.getTime()))
  return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
 if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)){
  const [y,m,d]=value.split('-').map(Number),result=new Date(y,m-1,d,12);
  if(result.getFullYear()===y&&result.getMonth()===m-1&&result.getDate()===d)return result;
 }
 return day(new Date());
}
function asKey(value){const d=day(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function plus(d,n){const x=day(d);x.setDate(x.getDate()+n);return x;}
function nthSundayOnOrAfter(d){return plus(d,(7-day(d).getDay())%7);}
function lastSundayBefore(d){const previous=plus(d,-1);return plus(previous,-previous.getDay());}
function sundayOfMonth(y,month,ordinal){return plus(nthSundayOnOrAfter(new Date(y,month-1,1,12)),7*(ordinal-1));}
function easter(year){
 // Gregorian computus, valid for modern Gregorian-calendar dates.
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
 const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
 const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7;
 const m=Math.floor((a+11*h+22*l)/451);
 const month=Math.floor((h+l-7*m+114)/31);
 return new Date(year,month-1,((h+l-7*m+114)%31)+1,12);
}
function romanAdvent(year){return nthSundayOnOrAfter(new Date(year,10,27,12));}
function ambrosianAdvent(year){return plus(romanAdvent(year),-14);}
function afterEpiphany(year){return nthSundayOnOrAfter(new Date(year,0,7,12));}
function special(y,m,d){
 const mm=String(m).padStart(2,'0'),dd=String(d).padStart(2,'0');
 const fixed={
  '01-01':['Maria Santissima Madre di Dio','white'],'01-06':['Epifania del Signore','white'],
  '02-02':['Presentazione del Signore','white'],
  '03-19':['San Giuseppe','white'],'03-25':['Annunciazione del Signore','white'],
  '06-24':['Natività di San Giovanni Battista','white'],'06-29':['Santi Pietro e Paolo','red'],
  '08-15':['Assunzione della Beata Vergine Maria','white'],
  '09-14':['Esaltazione della Santa Croce','red'],
  '11-01':['Tutti i Santi','white'],'11-02':['Commemorazione dei fedeli defunti','violet'],
  '12-08':['Immacolata Concezione','white'],'12-26':['Santo Stefano protomartire','red']
 };
 return fixed[mm+'-'+dd]||null;
}
function forDate(value,rite='roman'){
 const date=day(value),y=date.getFullYear(),key=asKey(date),amb=rite==='ambrosian';
 const e=easter(y),offset=Math.round((date.getTime()-e.getTime())/86400000);
 const advent=amb?ambrosianAdvent(y):romanAdvent(y),christmas=new Date(y,11,25,12);
 const yearBeginning=afterEpiphany(y);
 const lentStart=amb?plus(e,-42):plus(e,-46);
 const pentecost=plus(e,49),dedication=sundayOfMonth(y,10,3);
 let id='ordinary',label='Tempo Ordinario',color='green',celebration='';
 if(amb){
  if(date>=christmas||date<=yearBeginning){id='christmas';label='Tempo di Natale';color='white';}
  else if(date>=advent){id='advent';label='Tempo di Avvento';color='morello';}
  else if(date>=lentStart&&date<e){id='lent';label='Tempo di Quaresima';color='morello';}
  else if(date>=e&&date<pentecost){id='easter';label='Tempo pasquale';color='white';}
  else if(date>=pentecost&&date<dedication){id='afterPentecost';label='Tempo dopo Pentecoste';color='red';}
  else if(date>=dedication&&date<advent){id='ordinary';label='Tempo dopo la Dedicazione';color='green';}
  else{id='ordinary';label="Tempo dopo l'Epifania";color='green';}
 }else{
  if(date>=christmas||date<=yearBeginning){id='christmas';label='Tempo di Natale';color='white';}
  else if(date>=advent){id='advent';label='Tempo di Avvento';color='violet';}
  else if(date>=lentStart&&date<e){id='lent';label='Tempo di Quaresima';color='violet';}
  else if(date>=e&&date<pentecost){id='easter';label='Tempo pasquale';color='white';}
  else{id='ordinary';label='Tempo Ordinario';color='green';}
 }
 if(offset===49){id='pentecost';label='Pentecoste';color='red';celebration='Domenica di Pentecoste';}
 else if(offset===0){id='easter';label='Tempo pasquale';color='white';celebration='Domenica di Pasqua';}
 else if(offset===-7){color='red';celebration='Domenica delle Palme';}
 else if(offset===-3){color=amb?'red':'white';celebration='Giovedì Santo';}
 else if(offset===-2){color='red';celebration='Venerdì Santo';}
 else if(offset===-1){color=amb?'morello':'violet';celebration='Sabato Santo (senza Messa diurna)';}
 else if(offset===56){color='white';celebration='Santissima Trinità';}
 else if(offset===63){color=amb?'red':'white';celebration='Corpus Domini';}
 else if(offset===68){color=amb?'red':'white';celebration='Sacratissimo Cuore di Gesù';}
 else if(amb&&asKey(date)===asKey(dedication)){color='white';celebration='Dedicazione della Cattedrale';}
 else if(asKey(date)===asKey(lastSundayBefore(advent))){color='white';celebration='Cristo Re dell’universo';}
 else if(!amb&&id==='advent'&&asKey(date)===asKey(plus(advent,14))){color='rose';celebration='III domenica di Avvento (rosa facoltativo)';}
 else if(!amb&&id==='lent'&&asKey(date)===asKey(plus(e,-21))){color='rose';celebration='IV domenica di Quaresima (rosa facoltativo)';}
 // Fixed celebrations are a general-calendar aid, not an exhaustive local ordo.
 const fixed=special(y,date.getMonth()+1,date.getDate());
 if(fixed && !celebration && id!=='lent' && id!=='easter' && id!=='pentecost'){
  celebration=fixed[0];color=fixed[1]==='violet'&&amb?'morello':fixed[1];
 }
 return {date:key,rite:amb?'ambrosian':'roman',season:id,label,color,celebration,
  periodLabel:celebration||label,
  isSolemnity:!!celebration && !/rosa facoltativo/.test(celebration),
  note:'Indicazione del calendario generale: le celebrazioni proprie o trasferite possono richiedere un colore diverso.'};
}
function theme(el,color){
 if(!el||!el.style)return;
 const name=COLORS[color]?color:'green',p=COLORS[name];
 el.style.setProperty('--liturgical-primary',p.primary);
 el.style.setProperty('--liturgical-accent',p.accent);
 el.style.setProperty('--liturgical-secondary',p.secondary);
 el.style.setProperty('--liturgical-on-primary',p.ink);
 el.style.setProperty('--liturgical-soft',p.soft);
 el.style.setProperty('--liturgical-border',p.border);
 el.style.setProperty('--forest',p.accent);
 el.style.setProperty('--forest-2',p.secondary);
 el.dataset.liturgicalColor=name;
}
function roleNotes(ctx){
 const roman=ctx.rite==='roman',penitential=ctx.season==='lent'||ctx.season==='advent';
 return {
  skipGloria:roman&&penitential&&!ctx.isSolemnity,
  skipAlleluia:roman&&ctx.season==='lent',
  hint:ctx.season==='lent'?'Privilegia canti di conversione e penitenza.':
   ctx.season==='advent'?'Privilegia canti di attesa e speranza.':
   ctx.season==='christmas'?'Privilegia i canti natalizi.':
   ctx.season==='easter'?'Privilegia i canti della Risurrezione.':
   ctx.season==='pentecost'?'Privilegia i canti allo Spirito Santo.':
   ctx.season==='afterPentecost'?'Privilegia canti allo Spirito Santo, alla missione e alla vita della Chiesa.':
   'Privilegia canti adatti alle letture e al momento della Messa.'
 };
}
function score(song,ctx,moment){
 const seasons=Array.isArray(song?.liturgicalSeasons)?song.liturgicalSeasons:[];
 const role=String(song?.liturgicalRole||song?.liturgicalFunction||'').toLowerCase().trim();
 const target=String(moment||'').toLowerCase().trim();
 let value=0;
 if(target&&role===target)value+=4;
 else if(role&&target&&role!==target)value-=2;
 if(seasons.includes('all'))value+=1;
 else if(seasons.length){
  if(seasons.includes(ctx.season)||(ctx.season==='pentecost'&&seasons.includes('easter'))||
   (ctx.season==='afterPentecost'&&seasons.includes('ordinary')))value+=6;
  else value-=4;
 }
 return value;
}
const API={COLORS,SEASONS,MOMENTS,asKey,plus,easter,romanAdvent,ambrosianAdvent,forDate,theme,roleNotes,score};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
global.CantoriaLiturgical=API;
})(typeof window!=='undefined'?window:globalThis);
