/* Pure helper for integrating allocations into Floss Fox backup restore.
 * The host owns atomic-ish localStorage snapshot/rollback and UI confirmation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxAllocationBackup=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const AL=typeof module==='object'&&module.exports?require('./allocations'):globalThis.FlossFoxAllocations;
 const empty=()=>AL.empty();
 function prepare({current,incoming,mode,collisionMode='replace',incomingProjectIds=[],existingProjectIds=[],copyIdMap={},knownCodes}={}){
  const incomingHasAllocations=incoming!==null && incoming!==undefined;
  const c=AL.validate(current,knownCodes), b=AL.validate(incomingHasAllocations?incoming:empty(),knownCodes);
  if(!c.ok)return{ok:false,reason:'current-'+c.reason};if(!b.ok)return{ok:false,reason:'incoming-'+b.reason};
  if(!['merge','replace'].includes(mode))return{ok:false,reason:'invalid-mode'};
  if(!['replace','skip','copy'].includes(collisionMode))return{ok:false,reason:'invalid-collision-mode'};
  // Old backups have no allocations field; MERGE must not clear any local reservations.
  if(mode==='merge'&&!incomingHasAllocations)return{ok:true,data:c.data};
  const inc=new Set(incomingProjectIds), existed=new Set(existingProjectIds);
  const rows=[];
  if(mode==='merge'){
    for(const r of c.data.allocations){
      const collided=inc.has(r.projectId)&&existed.has(r.projectId);
      if(collided&&collisionMode==='replace')continue;
      rows.push({...r});
    }
  }
  for(const r of b.data.allocations){
    // An allocation may refer to a deleted project from the sender's backup.
    // Do not silently import dangling references.
    if(!inc.has(r.projectId))return{ok:false,reason:'incoming-orphan'};
    const collided=mode==='merge'&&existed.has(r.projectId);
    if(collided&&collisionMode==='skip')continue;
    let projectId=r.projectId;
    if(collided&&collisionMode==='copy'){
      projectId=copyIdMap[r.projectId];
      if(typeof projectId!=='string'||!projectId||projectId===r.projectId||existed.has(projectId)||inc.has(projectId))return{ok:false,reason:'missing-copy-id-map'};
    }
    rows.push({...r,projectId});
  }
  const check=AL.validate({schema:AL.SCHEMA,allocations:rows},knownCodes);
  return check.ok?{ok:true,data:check.data}:check;
 }
 return{prepare};
});
