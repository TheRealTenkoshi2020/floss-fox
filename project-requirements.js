/* Floss Fox v2 independent, read-only project requirement adapter.
 * Built for the observed Floss Fox schema 2 project items and current estimator.
 * Never equate stitchCount with skeins; assumes nothing about an unexamined estimator API.
 * Optional resolver: ({project,item}) => {amount:number|null,source:'estimated'|'unavailable'|string}
 * In production, Mouse supplies a wrapper around FlossFoxSkeins.requirement.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxRequirementBridge=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const goodNum=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=9999;
const goodInt=n=>Number.isInteger(n)&&n>=0;
const normal=x=>typeof x==='string'?x.trim().toUpperCase():'';
const E=(kind,projectId,code)=>({kind,projectId,code});
function adapt(projects,opts={}){
 if(!Array.isArray(projects))throw new TypeError('projects array required');
 if(!opts.validCodes||typeof opts.validCodes!=='object')throw new TypeError('validCodes required');
 const resolver=opts.resolveEstimate;
 const issues=[],out=[],seen=new Set();
 for(let pi=0;pi<projects.length;pi++){
  const p=projects[pi];if(!p||!Array.isArray(p.items)||typeof p.id!=='string'||!p.id){issues.push(E('invalid-project',String(pi),''));continue}
  if(p.demo===true){issues.push(E('demo-skipped',p.id,''));continue}
  if(seen.has(p.id)){issues.push(E('duplicate-project',p.id,''));continue}seen.add(p.id);
  const items=[],local=new Set();
  for(const raw of p.items){
   const code=normal(raw&&raw.code);
   if(!code||!own(opts.validCodes,code)){issues.push(E('invalid-code',p.id,code));continue}
   if(local.has(code)){issues.push(E('duplicate-project-color',p.id,code));continue}local.add(code);
   const q=raw.qty, a=raw.assumed===undefined?(raw.stated===false&&goodInt(q)?q:0):raw.assumed;
   const count=raw.stitchCount;
   const meta={code,source:'unknown',amount:null,knownMinimum:0,stitchCount:goodInt(count)&&count<=1e7?count:null,reviewReasons:[]};
   if(count!==null&&count!==undefined&&meta.stitchCount===null)meta.reviewReasons.push('invalid-stitch-count');
   if(q!==null&&(!Number.isInteger(q)||q<1||q>9999)){issues.push(E('invalid-requirement',p.id,code));continue}
   if(!goodInt(a)||(q!==null&&a>q)||(q===null&&a!==0)){issues.push(E('invalid-assumed-count',p.id,code));continue}
   if(q!==null&&a===0&&raw.stated!==false){meta.source='stated';meta.amount=q;meta.knownMinimum=q}
   else if(q!==null&&a>0&&a<q){meta.source='partly-assumed';meta.knownMinimum=q-a;meta.reviewReasons.push('assumed-portion')}
   else{
    meta.source=q===null?'unknown':'assumed';meta.reviewReasons.push(q===null?'missing-quantity':'assumed-quantity');
    if(typeof resolver==='function'){
     let r;try{const safeItem=meta.stitchCount!==null&&raw.stitchCountReviewed!==true&&Array.isArray(raw.src)&&raw.src.length>1?{...raw,countIncomplete:true}:raw;r=resolver({project:p,item:safeItem})}catch(e){meta.reviewReasons.push('estimator-failed')}
     if(r&&r.source==='estimated'&&goodNum(r.amount)){
      meta.amount=r.amount;meta.source='estimated';meta.reviewReasons.push('community-estimate');
     }
    }
   }
   if(raw.blend===true||raw.threadFamily&&raw.threadFamily!=='solid'||raw.stitchType&&raw.stitchType!=='full')meta.reviewReasons.push('specialty-or-nonfull-stitch');
   if(raw.stitchCountReviewed===false&&meta.stitchCount!==null)meta.reviewReasons.push('stitch-count-not-reviewed');
   items.push(meta);
  }
  out.push({id:p.id,name:typeof p.name==='string'?p.name.slice(0,100):'',items,decisions:p.decisions||{},purchased:p.purchased||{},buyBrand:p.buyBrand||'dmc',status:p.status||'planning'});
 }
 return{projects:out,issues,notice:'Read-only preparation. Estimated, missing and assumed amounts require review.'};
}
return{adapt};
});
