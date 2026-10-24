/* Backup reminder policy and file writer. Pure/injected APIs, no user-data writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxBackupCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAY=86400000,WEEK=7*DAY;
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const time=v=>v===null||Number.isSafeInteger(v)&&v>=0;
const defaults=()=>({schema:1,enabled:false,weeks:2,majorEdits:true});
const emptyState=()=>({schema:1,enabledSince:null,lastConfirmedAt:null,snoozedUntil:null,majorToken:null});
function prefs(d){if(!object(d)||d.schema!==1||typeof d.enabled!=='boolean'||!Number.isInteger(d.weeks)||d.weeks<1||d.weeks>52||typeof d.majorEdits!=='boolean')return null;return{schema:1,enabled:d.enabled,weeks:d.weeks,majorEdits:d.majorEdits};}
function state(d){if(!object(d)||d.schema!==1||!['enabledSince','lastConfirmedAt','snoozedUntil'].every(k=>time(d[k]))||!(d.majorToken===null||typeof d.majorToken==='string'&&d.majorToken.length>0&&d.majorToken.length<=100))return null;return{schema:1,enabledSince:d.enabledSince,lastConfirmedAt:d.lastConfirmedAt,snoozedUntil:d.snoozedUntil,majorToken:d.majorToken};}
function validPrefsString(s){try{return typeof s==='string'&&s.length<=1024&&!!prefs(JSON.parse(s));}catch(e){return false;}}
function reminder(p,s,now,hasData){
 if(!p.enabled||!hasData)return{due:false,reason:'off-or-empty'};
 if(s.snoozedUntil!==null&&s.snoozedUntil>now)return{due:false,reason:'snoozed'};
 if(p.majorEdits&&s.majorToken)return{due:true,reason:'major-edit'};
 const from=s.lastConfirmedAt===null?s.enabledSince:s.lastConfirmedAt;
 if(from===null)return{due:false,reason:'not-started'};
 return{due:now-from>=p.weeks*WEEK,reason:'interval'};
}
const inventoryEntry=e=>e?JSON.stringify([e.n,e.partial===true,e.restock===true,e.confirmed===true,e.storage||null]):null;
function majorChange(before,after){
 let changedColors=0,skeinChanges=0;
 for(const k of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){
  const a=before&&before[k],b=after&&after[k];
  if(inventoryEntry(a)!==inventoryEntry(b))changedColors++;
  const n=e=>e&&Number.isInteger(e.n)&&e.n>=0?e.n:0;
  skeinChanges+=Math.abs(n(a)-n(b));
 }
 return{major:changedColors>=10||skeinChanges>=20,changedColors,skeinChanges};
}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
function revision(backup){return canonical({projects:backup.projects,threads:backup.threads,prefs:backup.prefs});}
async function writeFile(text,{mode='download',picker=null,download,filename}={}){
 if(mode==='save'&&typeof picker==='function'){
  let writer;
  try{const handle=await picker({suggestedName:filename,types:[{description:'Floss Fox JSON backup',accept:{'application/json':['.json']}}]});writer=await handle.createWritable();await writer.write(text);await writer.close();return{status:'file-written'};}
  catch(e){if(writer&&typeof writer.abort==='function')try{await writer.abort();}catch(ignore){}return{status:e&&e.name==='AbortError'?'canceled':'failed',error:e};}
 }
 if(typeof download!=='function')return{status:'failed',error:new Error('Downloads are unavailable')};
 try{download(text,filename,'application/json');return{status:'download-started'};}catch(e){return{status:'failed',error:e};}
}
return{DAY,WEEK,defaults,emptyState,prefs,state,validPrefsString,reminder,majorChange,canonical,revision,writeFile};
});
