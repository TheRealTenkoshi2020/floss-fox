/* Kitting preview only. Does not reserve, move, remove or consume thread.
 * Use with existing allocation sidecar; caller supplies VERIFIED integer skein needs.
 * Unknown, assumed and partial-only needs remain unconfirmed; never fabricate stock.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxKitPreviewCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function preview({projectId,needs,collection,allocationCore,allocationData,knownCodes}){
 if(typeof projectId!=='string'||!projectId||!Array.isArray(needs)||!collection||!allocationCore||!allocationData)throw new TypeError('Missing kitting inputs');
 const rows=[],seen=new Set();
 for(const item of needs){
  const code=item&&item.code;
  if(typeof code!=='string'||!code||seen.has(code)||(knownCodes&&!Object.prototype.hasOwnProperty.call(knownCodes,code)))throw new TypeError('Invalid or duplicate kit color');
  seen.add(code);
  const verified=item.verified===true&&Number.isInteger(item.qty)&&item.qty>=1&&item.qty<=999&&item.brand==='dmc';
  const s=allocationCore.summary(allocationData,collection,code,projectId);
  const reserved=s.ownReserved;
  const requested=verified?item.qty:null;
  const unreserved=requested===null?null:Math.max(0,requested-reserved);
  const unallocated=s.unallocated;
  const canReserve=requested!==null&&!s.unknownStock&&!s.overallocated;
  rows.push({code,required:requested,reservedForThisProject:reserved,ownedTotal:s.owned,
   reservedElsewhere:s.othersReserved,unallocated,stillToReserve:unreserved,
   mayReserveNow:canReserve?Math.min(unreserved,unallocated):0,
   needsReview:!verified||s.unknownStock||s.overallocated,
   reviewReason:!verified?'requirement-not-verified':s.unknownStock?'stock-not-entered':s.overallocated?'inventory-allocation-conflict':null,
   storage:collection.threads&&collection.threads[code]&&collection.threads[code].storage||null});
 }
 return {rows,complete:rows.every(x=>!x.needsReview&&x.stillToReserve===0),notice:'Reserved is not packed, purchased, or consumed. Only an explicit physical action should confirm packing.'};
}
return {preview};
});
