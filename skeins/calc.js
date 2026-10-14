/* Pip's Skein Estimator. Pure functions; no DOM, storage, network or AI.
   DMC cotton: 8m x 6 strands; usable 15/18; path 6/effectiveCount inches.
   The path/tail assumptions are approximate, not DMC coverage guarantees.
   Browser: FlossFoxSkeins. Node: require('./skeins/calc.js'). */
(function(root){
'use strict';
const MODEL='pip-dmc-full-cross-v1',VERSION=1,MAX_STITCHES=10000000;
const DEFAULTS=Object.freeze({version:VERSION,enabled:false,fabric:'aida',count:14,over:1,strands:2,extraPercent:20,fullCrosses:false});
const EXTRAS=[0,10,20,30,50];
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function wholeInput(value,min,max,label){
 const s=String(value==null?'':value).trim();
 if(!/^\d+$/.test(s))return{ok:false,error:`Enter a whole number for ${label}.`};
 const n=Number(s);return Number.isSafeInteger(n)&&n>=min&&n<=max?{ok:true,value:n}:{ok:false,error:`${label} must be between ${min} and ${max}.`};
}
function validate(s){
 if(!s||s.version!==VERSION)return{ok:false,error:'These estimator settings need to be reviewed in this version.'};
 if(typeof s.enabled!=='boolean'||typeof s.fullCrosses!=='boolean')return{ok:false,error:'Check the estimator choices.'};
 if(!['aida','even'].includes(s.fabric))return{ok:false,error:'Choose Aida or linen/evenweave.'};
 if(!Number.isInteger(s.count)||s.count<6||s.count>80||![1,2].includes(s.over))return{ok:false,error:'Check the fabric count and stitching over setting.'};
 if(s.fabric==='aida'&&s.over!==1)return{ok:false,error:'For this estimator, Aida uses one square per cross.'};
 if(s.count/s.over<6||s.count/s.over>40)return{ok:false,error:'This version estimates 6–40 full crosses per inch.'};
 if(!Number.isInteger(s.strands)||s.strands<1||s.strands>6)return{ok:false,error:'Choose 1–6 strands per finished stitch.'};
 if(!EXTRAS.includes(s.extraPercent))return{ok:false,error:'Choose one of the extra allowances shown.'};
 return{ok:true,value:{...s},effective:s.count/s.over};
}
// Preserve invalid/newer settings as invalid, rather than silently activating defaults.
// Flat bounded data only; no prototypes or nested objects from an import.
function normalize(s){
 if(s===undefined||s===null)return undefined;
 if(typeof s!=='object'||Array.isArray(s))return{version:0,enabled:true};
 const out={};for(const k of Object.keys(DEFAULTS)){
  const v=s[k];out[k]=typeof v==='string'?v.slice(0,40):typeof v==='number'||typeof v==='boolean'?v:null;
 }
 return out;
}
function ceilWhole(n){
 if(!Number.isFinite(n)||n<0)throw new RangeError('Invalid skein amount');
 if(n===0)return 0;
 const near=Math.round(n),tol=8*Number.EPSILON*Math.max(1,n);
 return Math.max(1,Math.ceil(Math.abs(n-near)<=tol?near:n));
}
function compute(n,s,strands){
 const valid=validate(s);if(!valid.ok)return{kind:'review',reason:valid.error};
 if(!Number.isInteger(n)||n<0||n>MAX_STITCHES)return{kind:'review',reason:'Enter the full-cross stitch count for this color.'};
 const ss=strands===undefined||strands===null?s.strands:strands;
 if(!Number.isInteger(ss)||ss<1||ss>6)return{kind:'review',reason:'Check this color’s strand instruction.'};
 const base=n*ss*(6/valid.effective)*0.0254/40,planning=base*(1+s.extraPercent/100);
 return{kind:'estimate',model:MODEL,base,planning,whole:ceilWhole(planning),strands:ss,effective:valid.effective,extraPercent:s.extraPercent};
}
function estimate(it,s,known,family){
 if(!s||s.enabled!==true)return{kind:'off'};
 if(it.countIncomplete===true)return{kind:'review',reason:'I can’t verify a complete count for every entry of this color. Enter or confirm the full total in Details.'};
 if(!known||!has(known,it.code)||family!=='solid'||(it.threadFamily&&!['cotton','solid','six-strand-cotton'].includes(it.threadFamily)))
  return{kind:'review',reason:'This version estimates standard DMC six-strand cotton only.'};
 if(it.blend||it.stitchType&&it.stitchType!=='full')return{kind:'review',reason:'This color has a stitch type outside the full-cross estimate.'};
 // Older parser rows do not retain stitch-type metadata: do not override an
 // explicit specialty instruction that is still visible in the original text.
 if((it.src||[]).some(t=>/\b(back\s?stitch(?:es)?|half[ -]stitch(?:es)?|tent[ -]stitch(?:es)?|blends?|french[ -]knots?|pearl[ -]cotton|silk|hand[ -]dyed|metallic)\b/i.test(t)))
  return{kind:'review',reason:'Check the specialty stitch or thread instruction in the original list.'};
 if(it.stitchType!=='full'&&s.fullCrosses!==true)return{kind:'review',reason:'Confirm that these counts describe full cross stitches.'};
 return compute(it.stitchCount,s,it.strandCount);
}
function requirement(it,s,known,family,dest){
 const e=estimate(it,s,known,family),assumed=Number.isInteger(it.assumed)?it.assumed:it.stated===false?(it.qty||0):0;
 // Any explicit portion of a supplied amount retains the existing requirement.
 if(it.qty!==null&&it.qty!==undefined&&it.qty-assumed>0)return{amount:it.qty,source:assumed?'partly-assumed':'stated',estimate:e};
 if(!s||s.enabled!==true)return{amount:it.qty,source:assumed?'assumed':'unknown',estimate:e};
 if(dest!=='dmc')return{amount:null,source:'unavailable',estimate:e,reason:'Pip’s DMC estimate cannot set quantities for another brand.'};
 return e.kind==='estimate'?{amount:e.planning,source:'estimated',estimate:e}:{amount:null,source:'unavailable',estimate:e,reason:e.reason};
}
const fingerprint=(it,s,e)=>[MODEL,it.stitchCount,s.fabric,s.count,s.over,e.strands,s.extraPercent].join('|');
function compareStock(amount,stock,partial){
 if(amount===null||!Number.isFinite(amount)||amount<0)return{kind:'check-first'};
 if(amount===0)return{kind:'covered',buy:0};
 if(stock===undefined||stock===null)return{kind:'check-first'};
 if(!Number.isFinite(stock)||stock<0)return{kind:'check-first'};
 const rem=amount-stock,tol=8*Number.EPSILON*Math.max(1,amount,stock);
 if(rem<=tol)return{kind:'covered',buy:0};
 return partial?{kind:'check-first',buyIgnoringPartial:ceilWhole(rem)}:{kind:'short',buy:ceilWhole(rem)};
}
function compareProject(items,s,known,fam,collection,dest){
 const result={owned:[],unverified:[],short:[],missing:[]};
 for(const it of items){
  const need=requirement(it,s,known,fam(it.code),dest),entry=collection[it.code];
  if(need.source!=='estimated'&&need.source!=='unavailable')continue;
  const verified=!!(entry&&entry.confirmed===true);
  const x={code:it.code,need:need.amount,assumed:0,estimated:need.source==='estimated',have:entry?entry.n:0,partial:!!(entry&&entry.partial),ownedConfirmed:verified||!entry};
  if(need.amount===0){result.owned.push(x);continue}
  if(need.source==='unavailable'){result.unverified.push(x);continue}
  if(entry&&entry.n>0&&!verified){result.unverified.push(x);continue}
  const verdict=compareStock(need.amount,entry?entry.n:0,x.partial);
  result[verdict.kind==='covered'?'owned':verdict.kind==='check-first'?'unverified':entry&&entry.n>0?'short':'missing'].push(x);
 }
 return result;
}
const fmt=n=>n===0?'0':n<0.01?'less than 0.01':String(Number(n.toFixed(2)));
const assumptions=s=>{const v=validate(s);return v.ok?`DMC cotton · full crosses · ${s.count}-count ${s.fabric==='aida'?'Aida':'linen/evenweave'} over ${s.over} · ${v.effective} stitches/inch · ${s.strands} strands by default · ${s.extraPercent}% extra`:v.error};
function text(p,known,fam){
 const s=p.skeinEstimator;if(!s||s.enabled!==true)return'';
 const rows=p.items.map(it=>({it,r:requirement(it,s,known,fam(it.code),p.buyBrand)}));
 const o=['PIP’S SKEIN ESTIMATES — complete pattern, approximate',assumptions(s)];
 for(const {it,r} of rows){const e=r.estimate;
  o.push(`DMC ${it.code}: ${e.kind==='estimate'?`about ${fmt(e.base)} skeins used; about ${fmt(e.planning)} with extra; ${e.whole} whole skeins before stock (${e.strands} strands)${r.source==='stated'||r.source==='partly-assumed'?'; supplied requirement retained':r.source==='unavailable'?'; shopping quantity unresolved':''}`:`Check first — ${r.reason||e.reason||'settings need review'}`}`);
 }
 const omitted=rows.filter(x=>x.r.estimate.kind!=='estimate').length;
 if(omitted)o.push(`${omitted} color(s) omitted: the estimate is incomplete.`);
 o.push('Actual use varies with tension, carries, isolated stitches, starts and unpicking. Ordinary tail waste is modeled; the selected extra is an additional contingency.');
 return o.join('\n');
}
const api={MODEL,VERSION,MAX_STITCHES,DEFAULTS,EXTRAS,wholeInput,validate,normalize,ceilWhole,compute,estimate,requirement,fingerprint,compareStock,compareProject,fmt,assumptions,text};
if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxSkeins=api;
})(typeof window!=='undefined'?window:this);
