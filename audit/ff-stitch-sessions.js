/* FlossFox local-first stitching sessions; deliberate recorded consumption is separate
   from shopping/purchasing and NEVER silently debits physical inventory. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxAuditSessionsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const CAP=2000;const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const ISO=/^\d{4}-\d{2}-\d{2}$/;
 const goodDay=s=>typeof s==='string'&&ISO.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 function normalize(raw){if(!isObj(raw))throw Error('Invalid session.');let {id,projectId,date,stitches,minutes,notes,usage}=raw;
  if(typeof id!=='string'||!/^[\w-]{1,80}$/.test(id)||typeof projectId!=='string'||!projectId||projectId.length>80||!goodDay(date))throw Error('Invalid session identity or date.');
  const optional=(v,max,label)=>{if(v===null||v===undefined||v==='')return null;if(!Number.isInteger(v)||v<0||v>max)throw Error('Invalid '+label);return v};
  stitches=optional(stitches,10000000,'stitch count');minutes=optional(minutes,1440,'minutes');notes=typeof notes==='string'?notes.trim().slice(0,500):'';
  if(usage===undefined)usage=[];if(!Array.isArray(usage)||usage.length>40)throw Error('Too much thread usage.');const seen=new Set();usage=usage.map(u=>{if(!isObj(u)||typeof u.code!=='string'||!/^[A-Za-z0-9]{1,12}$/.test(u.code)||['constructor','prototype'].includes(u.code)||seen.has(u.code)||!Number.isFinite(u.skeins)||u.skeins<=0||u.skeins>99||Math.abs(Math.round(u.skeins*100)-u.skeins*100)>1e-6)throw Error('Invalid thread usage.');seen.add(u.code);return{code:u.code,skeins:u.skeins}});
  if(stitches===null&&minutes===null&&!notes&&!usage.length)throw Error('Enter at least one session detail.');return{id,projectId,date,stitches,minutes,notes,usage,...(raw.archived===true?{archived:true}:{})};}
 function validate(data){if(!isObj(data)||data.schema!==1||!Array.isArray(data.sessions)||data.sessions.length>CAP)throw Error('Unsupported or oversized session data.');const seen=new Set();const sessions=data.sessions.map(v=>{const s=normalize(v);if(seen.has(s.id))throw Error('Repeated session ID.');seen.add(s.id);return s});return{schema:1,sessions};}
 function empty(){return{schema:1,sessions:[]}}
 function summary(data,projectId){const sessions=validate(data).sessions.filter(s=>!projectId||s.projectId===projectId&&!s.archived),usage={};let stitches=0,minutes=0,stitchSessions=0,timedSessions=0;for(const s of sessions){if(s.stitches!==null){stitches+=s.stitches;stitchSessions++}if(s.minutes!==null){minutes+=s.minutes;timedSessions++}for(const u of s.usage)usage[u.code]=Math.round(((usage[u.code]||0)+u.skeins)*100)/100;}return{sessions:sessions.length,stitches,minutes,stitchSessions,timedSessions,usage};}
 // Prepare before the surrounding project/stash transaction starts. Replacing a
 // project replaces its sessions; copied projects receive independent session IDs.
 function prepareRestore(current,payload,{mode='merge',copyMap={},skipIds=[],replaceIds=[],projectIds=null}={}){
  if(!['merge','replace'].includes(mode))throw Error('Invalid session restore mode.');
  const old=validate(current),inc=validate(payload),skipped=new Set(skipIds),replaced=new Set(replaceIds);
  const known=projectIds===null?null:new Set(projectIds),has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  if(known&&inc.sessions.some(s=>!s.archived&&!known.has(s.projectId)))throw Error('A session refers to a project missing from this backup.');
  const sessions=mode==='replace'?[]:old.sessions.filter(s=>s.archived||!replaced.has(s.projectId));
  const used=new Map(sessions.map(s=>[s.id,s]));
  for(const original of inc.sessions){
   if(!original.archived&&skipped.has(original.projectId))continue;
   const mapped=!original.archived&&has(copyMap,original.projectId)?copyMap[original.projectId]:null;
   const s={...original,projectId:mapped||original.projectId};
   if(mapped)s.id=original.id.slice(0,54)+'-'+mapped.slice(-16);
   if(used.has(s.id)&&JSON.stringify(used.get(s.id))===JSON.stringify(s))continue;
   if(used.has(s.id)){const base=s.id.slice(0,66);let n=1;while(used.has(base+'-restore-'+n))n++;s.id=base+'-restore-'+n;}
   used.set(s.id,s);sessions.push(s);
  }
  return validate({schema:1,sessions});
 }
 function create(storage,key){if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||!key)throw Error('Storage unavailable.');
  function read(){let raw;try{raw=storage.getItem(key)}catch(e){return{ok:false,error:'Browser storage is unavailable.',data:empty()}}if(raw===null)return{ok:true,data:empty(),raw:null};try{return{ok:true,data:validate(JSON.parse(raw)),raw}}catch(e){return{ok:false,error:'Stored session data cannot be read. Nothing was overwritten.',data:empty()}}}
  function save(next,expectedRaw){const cur=read();if(!cur.ok)return{ok:false,error:cur.error};if(expectedRaw!==undefined&&cur.raw!==expectedRaw)return{ok:false,error:'Another tab changed your sessions. Reload before saving.'};let valid;try{valid=validate(next)}catch(e){return{ok:false,error:e.message}}const after=JSON.stringify(valid);let before;try{before=storage.getItem(key)}catch(e){return{ok:false,error:'Browser storage became unavailable. No sessions were changed.'}}if(before!==cur.raw)return{ok:false,error:'Another tab changed your sessions. Reload before saving.'};try{storage.setItem(key,after);if(storage.getItem(key)!==after)throw Error('Readback failed');return{ok:true,data:valid}}catch(e){let back=false;try{if(before===null)storage.removeItem(key);else storage.setItem(key,before);back=storage.getItem(key)===before}catch(ignore){}return{ok:false,error:back?'Could not save stitching sessions. Your previous sessions were kept.':'The session save could not be verified. Reload and check your journal before adding more entries.'}}}
  function add(item){const old=read();if(!old.ok)return old;let s;try{s=normalize(item)}catch(e){return{ok:false,error:e.message}}if(old.data.sessions.some(x=>x.id===s.id))return{ok:false,error:'Session already exists.'};return save({schema:1,sessions:old.data.sessions.concat(s)},old.raw)}
  function remove(id){const old=read();if(!old.ok)return old;const a=old.data.sessions.filter(s=>s.id!==id);if(a.length===old.data.sessions.length)return{ok:false,error:'Session not found.'};return save({schema:1,sessions:a},old.raw)}
  function exportForBackup(){const r=read();if(!r.ok)throw Error(r.error);return r.data}
  function restore(payload,options={}){const old=read();if(!old.ok)return old;try{return save(prepareRestore(old.data,payload,options),old.raw)}catch(e){return{ok:false,error:e.message}}}
  return{key,read,save,add,remove,exportForBackup,restore,summary:(id)=>{const r=read();return r.ok?{ok:true,...summary(r.data,id)}:r},list:(id)=>{const r=read();return r.ok?{ok:true,sessions:r.data.sessions.filter(s=>s.projectId===id&&!s.archived).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))}:r}};
 }
 return{normalize,validate,summary,empty,prepareRestore,create,CAP};
});
(function(root){'use strict';if(!root.document||!root.FlossFoxProjects||!root.FlossFoxAuditSessionsCore)return;const p=root.FlossFoxProjects,storage=(()=>{try{return root.localStorage}catch(e){return null}})();if(!storage)return;const key=p.KEY.replace(/\.v1$/,'')+'.stitch-sessions.v1';root.FlossFoxAuditSessions=root.FlossFoxAuditSessionsCore.create(storage,key);root.FlossFoxAuditSessions.KEY=key;})(typeof globalThis!=='undefined'?globalThis:this);
