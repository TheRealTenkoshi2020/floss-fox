/* FlossFox Smart Stash: verified all-or-nothing browser-local inventory writes.
 * Does not call replaceAll(), which mutates the in-memory collection before a save.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxSmartStashTransaction=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function snapshot(storage,threadAPI){return storage.getItem(threadAPI.KEY)}
// Mouse fix: compare through the app's own migrate() so saved data with a different key order (older builds, restores) is not reported as a conflict.
function canon(api,persisted){try{const m=api.core&&typeof api.core.migrate==='function'?api.core.migrate(persisted):null;if(m&&m.data&&m.data.threads)return JSON.stringify(m.data.threads)}catch(e){}return JSON.stringify(persisted.threads)}
function commit(storage,api,plan,expectedRaw,largeAcknowledged=false){
 if(!api||!api.canSave||!api.canSave()||api.isMem?.())return {ok:false,error:'Collection saving is unavailable or paused.'};
 if(!plan||!Array.isArray(plan.rows)||plan.errors?.length||!plan.changeCount)return{ok:false,error:'The review is incomplete.'};
 if(plan.large?.length&&!largeAcknowledged)return{ok:false,error:'Confirm large skein counts before saving.'};
 let before;try{before=storage.getItem(api.KEY)}catch{return{ok:false,error:'Browser storage is unavailable.'}}
 if(before!==expectedRaw)return{ok:false,error:'Your collection changed while you reviewed it. Reopen the review.'};
 let persisted=null;try{if(before!==null)persisted=JSON.parse(before)}catch{return{ok:false,error:'Saved collection is unreadable. No changes made.'}}
 const doc=clone(api.data());if(!doc||!doc.threads||typeof doc.threads!=='object')return{ok:false,error:'Collection data is invalid.'};
 // Safeguard against another tab changing storage before the review began.
 // The raw snapshot being current is insufficient if ThreadsUI still holds stale in-memory data.
 if((persisted===null&&Object.keys(doc.threads).length)||
    (persisted!==null&&(!persisted.threads||canon(api,persisted)!==JSON.stringify(doc.threads))))
   return{ok:false,error:'Your saved collection and this page disagree. Reload the page before importing.'};
 const now=new Date().toISOString(),next=doc.threads;
 for(const p of plan.rows){if(p.action==='unchanged')continue;
  if(!Object.prototype.hasOwnProperty.call(next,p.code))next[p.code]={n:0,partial:false,restock:false,updated:now};
  const old=next[p.code];let proposed={...old,n:p.after,updated:now};
  if(p.confirmed)proposed.confirmed=true;else delete proposed.confirmed;
  if(p.extrasToApply){const x=p.extrasToApply;proposed.partial=x.partial===true;proposed.restock=x.restock===true;
   if(x.storage&&typeof x.storage==='object')proposed.storage=x.storage;else delete proposed.storage}
  const e=api.core?.normEntry(p.code,proposed);if(!e)return{ok:false,error:`Invalid inventory entry ${p.code}.`};next[p.code]=e;
 }
 const after=JSON.stringify(doc);
 try{
  storage.setItem(api.KEY,after);
  if(storage.getItem(api.KEY)!==after)throw Error('Readback failed.');
 }catch(e){
  // If storage write was rejected, native setItem is atomic; do not make a second destructive write.
  try{if(storage.getItem(api.KEY)===before)return{ok:false,error:'Browser storage rejected the save; nothing changed.'};}catch(e){}
  // Rare readback mismatch: do not report success, and avoid overwriting unknown concurrent data.
  return{ok:false,error:'Save could not be verified. Reload the collection and inspect it.'};
 }
 api.reload();rootEvent();
 return{ok:true,changed:plan.changeCount,token:{before,after}};
}
function undo(storage,api,token){if(!token||typeof token.after!=='string'||(token.before!==null&&typeof token.before!=='string'))return{ok:false,error:'Invalid undo token.'};
 if(!api.canSave?.()||api.isMem?.())return{ok:false,error:'Saving is unavailable.'};
 let now;try{now=storage.getItem(api.KEY)}catch{return{ok:false,error:'Browser storage unavailable.'}}
 if(now!==token.after)return{ok:false,error:'Your collection changed since the import. Undo would overwrite newer work.'};
 try{if(token.before===null)storage.removeItem(api.KEY);else storage.setItem(api.KEY,token.before);
  if(storage.getItem(api.KEY)!==token.before)throw Error('Readback failed.');
 }catch{return{ok:false,error:'Undo could not be saved. Inspect your collection.'}}
 api.reload();rootEvent();return{ok:true};
}
function rootEvent(){try{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ff:data-saved',{detail:{area:'threads'}}))}catch(e){}}
return{snapshot,commit,undo};
});
