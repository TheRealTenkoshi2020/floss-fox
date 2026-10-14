/* Floss Fox multi-project preview v2 — purely derived, DMC source codes only.
 * Input: project-requirements.js output projects and collection {schema:1,threads:{code:{n,partial,confirmed?}}}.
 * Bounds are planning scenarios, not a statistical confidence interval. No stock mutation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxCombinedPlan=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const ceil=n=>Math.max(0,Math.ceil(n-1e-9));
const byCode=(a,b)=>{const na=/^\d+$/.test(a)?+a:Infinity,nb=/^\d+$/.test(b)?+b:Infinity;return na-nb||a.localeCompare(b)};
function calculate(projects,collection,opts={}){
 if(!Array.isArray(projects))throw new TypeError('projects array required');
 if(!collection||typeof collection!=='object'||Array.isArray(collection))throw new TypeError('collection required');
 if(!opts.validCodes||typeof opts.validCodes!=='object')throw new TypeError('DMC color chart required');
 const collectionRows=collection.threads||collection;
 if(!collectionRows||typeof collectionRows!=='object'||Array.isArray(collectionRows))throw new TypeError('threads map required');
 const issues=Array.isArray(opts.preflightIssues)?opts.preflightIssues.map(x=>({...x,stage:'adapter'})):[],map=new Map(),seenProjects=new Set();
 for(const p of projects){
  if(!p||!Array.isArray(p.items)||typeof p.id!=='string'||!p.id){issues.push({kind:'invalid-project'});continue}
  if(seenProjects.has(p.id)){issues.push({kind:'duplicate-project',projectId:p.id});continue}seenProjects.add(p.id);
  if(p.buyBrand&&p.buyBrand!=='dmc')issues.push({kind:'brand-needs-review',projectId:p.id,buyBrand:p.buyBrand});
  const locally=new Set();
  for(const item of p.items){
   const code=typeof item?.code==='string'?item.code.trim().toUpperCase():'';
   if(!own(opts.validCodes,code)){issues.push({kind:'invalid-color',projectId:p.id,code});continue}
   if(locally.has(code)){issues.push({kind:'duplicate-project-color',projectId:p.id,code});continue}locally.add(code);
   if(!map.has(code))map.set(code,{code,neededScenario:0,knownMinimum:0,unknown:false,review:new Set(),sources:[],projects:[]});
   const row=map.get(code);
   const amount=item.amount, min=item.knownMinimum;
   if(!finite(min)||min<0||min>9999){issues.push({kind:'bad-known-minimum',projectId:p.id,code});row.unknown=true;row.review.add('invalid-requirement');continue}
   row.knownMinimum+=min;
   if(amount===null){row.unknown=true;row.review.add('unknown-required-amount')}
   else if(!finite(amount)||amount<=0||amount>9999){row.unknown=true;row.review.add('invalid-required-amount');issues.push({kind:'bad-amount',projectId:p.id,code})}
   else{row.neededScenario+=amount;if(amount<min)row.review.add('inconsistent-required-amount')}
   if(item.source!=='stated')row.review.add(item.source==='estimated'?'estimated-not-exact':item.source||'unverified-source');
   if(Array.isArray(item.reviewReasons))item.reviewReasons.forEach(x=>row.review.add(x));
   const d=p.decisions&&own(p.decisions,code)?p.decisions[code]:null;
   if(d&&d.recv)row.review.add('received-check-stash');
   if(d&&d.owned!==null&&d.owned!==undefined)row.review.add('project-owned-differs-from-collection');
   if(d&&d.status==='have')row.review.add('have-decision-check-quantity');
   if(p.purchased&&(own(p.purchased,'dmc:'+code)||Object.keys(p.purchased).some(k=>k.startsWith('anchor:')||k.startsWith('sullivans:'))))row.review.add('purchased-not-stock');
   row.sources.push(item.source);row.projects.push({id:p.id,name:p.name,amount,source:item.source});
  }
 }
 const rows=[];
 for(const row of [...map.values()].sort((a,b)=>byCode(a.code,b.code))){
  const e=own(collectionRows,row.code)?collectionRows[row.code]:null;
  const n=e&&Number.isInteger(e.n)&&e.n>=0&&e.n<=999?e.n:0;
  if(e&&(!Number.isInteger(e.n)||e.n<0||e.n>999))row.review.add('invalid-inventory');
  const fullConfirmed= !e || n===0 || e.confirmed===true;
  if(n>0&&!fullConfirmed)row.review.add('unconfirmed-inventory');
  const hasPartial=!!(e&&e.partial===true);
  let partMin=0,partMax=0;
  if(hasPartial){
   if(finite(e.partialFraction)&&e.partialFraction>0&&e.partialFraction<1&&e.partialVerified===true){partMin=e.partialFraction;partMax=e.partialFraction}
   else{partMax=null} // Unknown fraction is strictly less than one complete skein.
  }
  if(e&&e.partialFraction!==undefined&&!hasPartial)row.review.add('partial-inconsistent');
  const stashLow=fullConfirmed?n:0,stashHigh=n;
  const minGap=Math.max(0,row.knownMinimum-stashHigh);
  const minAdditional=hasPartial&&partMax===null?Math.floor(minGap+1e-9):ceil(minGap-(partMax||0));
  if(hasPartial&&partMax===null&&row.unknown===false&&row.neededScenario>stashHigh+1e-9)row.review.add('partial-unmeasured');
  if(hasPartial&&partMax===null&&row.unknown===true)row.review.add('partial-unmeasured');
  const scenarioNeed=row.unknown?null:row.neededScenario;
  const maxAdditional=scenarioNeed===null?null:ceil(scenarioNeed-stashLow-partMin);
  const review=row.review.size>0;
  const status=review?'review':maxAdditional>0?'buy':'covered';
  rows.push({code:row.code,status,sourceType:row.sources,knownMinimum:round(row.knownMinimum),scenarioRequired:scenarioNeed===null?null:round(scenarioNeed),listedFullSkeins:n,confirmedFullSkeins:fullConfirmed?n:0,partialPresent:hasPartial,minimumWholeSkeinsToBuy:minAdditional,maximumWholeSkeinsToBuy:maxAdditional,requiresReview:review,reviewReasons:[...row.review].sort(),projects:row.projects});
 }
 const summary={selectedProjects:seenProjects.size,colors:rows.length,covered:rows.filter(x=>x.status==='covered').length,buy:rows.filter(x=>x.status==='buy').length,review:rows.filter(x=>x.status==='review').length};
 summary.canFinalize=issues.length===0&&summary.review===0&&rows.length>0;
 summary.exactBuyTotal=summary.canFinalize?rows.reduce((a,r)=>a+r.maximumWholeSkeinsToBuy,0):null;
 summary.provisionalMin=rows.reduce((a,r)=>a+r.minimumWholeSkeinsToBuy,0);
 summary.provisionalMax=rows.some(r=>r.maximumWholeSkeinsToBuy===null)?null:rows.reduce((a,r)=>a+r.maximumWholeSkeinsToBuy,0);
 return{rows,issues,summary,notice:'Selected projects only. No purchases, receipts, or cross-brand equivalences are subtracted. Planning quantities are not guaranteed actual thread consumption.'};
}
function round(n){return Math.round((n+Number.EPSILON)*1e6)/1e6}
return{calculate};
});
