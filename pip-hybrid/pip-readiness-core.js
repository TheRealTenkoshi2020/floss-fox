/* Pip Project Readiness: pure read-only view of the existing Floss Fox plan.
 * The plan() function in projects.js remains the sole source of project verdicts.
 * Never writes to projects/inventory and never converts stitches into skeins.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPipReadiness=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const states=new Set(['have','received','buy','awaiting','review']);
const clean=s=>typeof s==='string'?s.trim():'';
const num=n=>Number.isSafeInteger(n)&&n>=0?n:null;
function summarize(project,plan,storageMap={}){
 if(!project||!plan||!Array.isArray(plan.threads)||!plan.sum)throw new TypeError('Project plan unavailable');
 const expected=plan.threads.length;
 const grouped={have:[],received:[],buy:[],awaiting:[],review:[]};
 for(const t of plan.threads){
  if(!t||!states.has(t.state)||!t.it||typeof t.it.code!=='string')throw new TypeError('Unexpected project plan row');
  const code=t.it.code,storage=Object.prototype.hasOwnProperty.call(storageMap,code)?storageMap[code]?.storage:null;
  const where=storage&&typeof storage.container==='string'||storage&&typeof storage.slot==='string'? [storage.container,storage.slot].filter(s=>typeof s==='string'&&s.trim()).join(' · '):'';
  const kind=clean(t.kind),reason=clean(t.why);
  grouped[t.state].push({code,state:t.state,kind,reason,remaining:t.state==='buy'?num(t.rem):null,location:where.slice(0,110),estimated:!!t.estimated});
 }
 const count=Object.values(grouped).reduce((n,a)=>n+a.length,0);
 if(count!==expected)throw new TypeError('Inconsistent plan counts');
 // Cross-check displayed fact counts against the existing planner: refuse mismatched reports.
 const sum=plan.sum;
 if(sum.total!==count||sum.sufficient!==grouped.have.length+grouped.received.length||sum.toBuy!==grouped.buy.length||sum.awaiting!==grouped.awaiting.length||sum.review!==grouped.review.length)throw new TypeError('Planner summary differs from project rows');
 const ready=plan.ready===true;
 if(ready&&(sum.total===0||sum.sufficient!==sum.total))throw new TypeError('Planner readiness inconsistent');
 return{projectId:clean(project.id),name:clean(project.name)||'Untitled project',total:count,ready,hasEstimates:!!plan.hasEstimates,counts:{ready:sum.sufficient,toBuy:sum.toBuy,awaiting:sum.awaiting,review:sum.review,checkFirst:num(sum.checkFirst)||0},groups:grouped,notice:'This is based on your saved project choices and current plan. It isn\'t a physical check of your threads, and the same skeins aren\'t reserved across projects.'};
}
function toText(r,{maxItems=12}={}){
 const nm=r.name,counts=r.counts;
 if(r.total===0)return `${nm}: No thread colors added yet. Add a pattern color list first.`;
 let out=`${nm}: ${r.ready?'Ready according to this project’s saved thread plan.':'Not ready yet according to the current plan.'} ${counts.ready} of ${r.total} colors accounted for; ${counts.toBuy} need buying; ${counts.awaiting} bought and awaiting check-in; ${counts.review} need attention.`;
 if(r.hasEstimates)out+=' Some quantities depend on provisional thread estimates; actual usage can vary.';
 const labels=[['review','Check first'],['buy','Need to buy'],['awaiting','Waiting to check in'],['have','Have enough'],['received','Received']];
 let shown=0;
 for(const [category,label] of labels){const rows=r.groups[category];if(!rows.length)continue;
  const slots=Math.max(0,maxItems-shown);if(!slots)break;
  out+=`\n${label}: `+rows.slice(0,slots).map(t=>`DMC ${t.code}${t.remaining!==null?' ('+t.remaining+' to buy)':''}${t.location?' [stored: '+t.location+']':''}${t.reason?': '+t.reason:''}`).join('; ');
  shown+=Math.min(slots,rows.length);
 }
 if(shown<r.total)out+=`\nShowing ${shown} of ${r.total} colors. Open this project to see the full details.`;
 return out+'\n'+r.notice;
}
return Object.freeze({summarize,toText});
});
