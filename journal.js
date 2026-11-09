/* Phase 1 local event journal. Remembers what changed, on this device only: inventory amounts,
   project status (progress/completion) and shopping-list flags. No network, no AI, no new dependency.
   Storage: its own key, <projects key minus .v1>.journal.v1 (flossfox.journal.v1 in production). The data keys
   (flossfox.v1, .threads.v1) and automatic copies (.snapshots.v1/.snapmeta.v1) are only ever READ.
   Format: {schema:1, base:{sig,state}, cps:[{sig,last}], events:[Event]}
   Event: {id:"e<time36>-<rand>", t:ISO, k:"inventory"|"project"|"shopping", ref:{code}|{pid}|{pid,code}, from, to}
     inventory: from/to = {n, partial}       project: from/to = status ('planning'|'ready'|'progress'|'done'; null = absent)
     shopping:  from/to = true/false (thread restock flag when ref is {code}; project color set to Need to buy when ref is {pid,code})
   Events are derived by diffing the tracked state against the last recorded state ("base"), so a missed hook can
   never invent history, and every journaling step is wrapped so a failure is silently skipped, never a save error.
   Undo: a change that is reverted in the same session within UNDO_MS is folded into its event (and the event is
   removed when it nets to nothing), so Undo leaves no phantom history.
   Import/restore: data that changed outside a normal save (import, Undo last import, Restore a copy, another tab)
   is re-based silently (no events). If the restored state matches an earlier checkpoint, events recorded after
   that checkpoint are dropped. Backup files carry an optional "journal" array; importing merges by event id. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxJournalCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const J_MAX_ADDED=500,SCHEMA=1,MAX_EVENTS=500,MAX_CPS=12,UNDO_MS=10*60*1000,KINDS=['inventory','project','shopping'],PST=['planning','ready','progress','done'];
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(canon).join(',')+']';return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}'}
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return(h>>>0).toString(36)+'.'+s.length}
// Tracked projection of the user's real data (demo entries excluded).
function project(projectsStore,threadsData){const inv={},rs={},ps={},pb={};
 const th=obj(threadsData)&&obj(threadsData.threads)?threadsData.threads:{};
 for(const c of Object.keys(th)){const e=th[c];if(!obj(e))continue;inv[c]={n:Number.isInteger(e.n)?e.n:0,partial:e.partial===true};if(e.restock===true)rs[c]=true}
 const pr=obj(projectsStore)&&Array.isArray(projectsStore.projects)?projectsStore.projects:[];
 for(const p of pr){if(!obj(p)||p.demo===true||typeof p.id!=='string')continue;ps[p.id]=PST.includes(p.status)?p.status:'planning';
  const d=obj(p.decisions)?p.decisions:{},b=Object.keys(d).filter(c=>obj(d[c])&&d[c].status==='buy').sort();if(b.length)pb[p.id]=b}
 return{inv,rs,ps,pb}}
const sig=s=>hash(canon(s));
// Diff two projections into event bodies (no id/time yet).
function diff(a,b){const out=[],eq=(x,y)=>canon(x)===canon(y);
 const ia=a.inv||{},ib=b.inv||{};for(const c of new Set([...Object.keys(ia),...Object.keys(ib)]))if(!eq(ia[c]||null,ib[c]||null))out.push({k:'inventory',ref:{code:c},from:ia[c]||null,to:ib[c]||null});
 const ra=a.rs||{},rb=b.rs||{};for(const c of new Set([...Object.keys(ra),...Object.keys(rb)]))if(!!ra[c]!==!!rb[c])out.push({k:'shopping',ref:{code:c},from:!!ra[c],to:!!rb[c]});
 const pa=a.ps||{},pz=b.ps||{};for(const id of new Set([...Object.keys(pa),...Object.keys(pz)]))if((pa[id]||null)!==(pz[id]||null))out.push({k:'project',ref:{pid:id},from:pa[id]||null,to:pz[id]||null});
 const ba=a.pb||{},bb=b.pb||{};for(const id of new Set([...Object.keys(ba),...Object.keys(bb)])){const x=new Set(ba[id]||[]),y=new Set(bb[id]||[]);
  // a deleted (or newly added) project is a project event, not a run of shopping events
  if(!(id in pa&&id in pz))continue;
  for(const c of new Set([...x,...y]))if(x.has(c)!==y.has(c))out.push({k:'shopping',ref:{pid:id,code:c},from:x.has(c),to:y.has(c)})}
 return out}
const refKey=e=>e.k+'|'+canon(e.ref);
function validEvent(e){return obj(e)&&typeof e.id==='string'&&e.id.length>0&&e.id.length<=40&&typeof e.t==='string'&&!isNaN(Date.parse(e.t))&&KINDS.includes(e.k)&&obj(e.ref)&&'from'in e&&'to'in e&&canon(e).length<=600}
function empty(){return{schema:SCHEMA,base:null,cps:[],events:[]}}
// Reads a stored journal; anything unexpected becomes an empty journal (never throws).
function parse(raw){try{const j=typeof raw==='string'?JSON.parse(raw):raw;if(!obj(j)||j.schema!==SCHEMA)return empty();
 return{schema:SCHEMA,base:obj(j.base)&&typeof j.base.sig==='string'&&obj(j.base.state)?j.base:null,cps:Array.isArray(j.cps)?j.cps.filter(c=>obj(c)&&typeof c.sig==='string').slice(-MAX_CPS):[],events:Array.isArray(j.events)?dedupe(j.events.filter(validEvent)):[]}}catch(e){return empty()}}
function dedupe(evs){const seen=new Set(),out=[];for(const e of evs){if(seen.has(e.id))continue;seen.add(e.id);out.push(e)}
 out.sort((a,b)=>a.t<b.t?-1:a.t>b.t?1:0);return out.slice(-MAX_EVENTS)}
const lastId=j=>j.events.length?j.events[j.events.length-1].id:null;
function checkpoint(j,added){const s=j.base&&j.base.sig;if(!s)return;const c={sig:s,last:lastId(j)},old=j.cps.find(x=>x.sig===s),ids=new Set([...((old&&old.added)||[]),...(added||[])]);if(ids.size)c.added=[...ids].slice(-J_MAX_ADDED);j.cps=j.cps.filter(x=>x.sig!==s).concat([c]).slice(-MAX_CPS)}
/* Records the change from j.base to `state`. session: Set of event ids created by this page load (only those may be
   folded, so imported or older history is never rewritten). Returns the new journal. */
function record(j,state,now,session,newId){j=parse(j);const s=sig(state);
 if(!j.base){j.base={sig:s,state};checkpoint(j);return j}
 if(j.base.sig===s)return j;
 for(const ev of diff(j.base.state,state)){const key=refKey(ev);let prev=null;
  for(let i=j.events.length-1;i>=0;i--)if(refKey(j.events[i])===key){prev=j.events[i];break}
  if(prev&&session&&session.has(prev.id)&&now-Date.parse(prev.t)<=UNDO_MS){
   if(canon(prev.from)===canon(ev.to))j.events=j.events.filter(x=>x!==prev);else prev.to=ev.to;continue}
  const e={id:newId(),t:new Date(now).toISOString(),k:ev.k,ref:ev.ref,from:ev.from,to:ev.to};j.events.push(e);if(session)session.add(e.id)}
 j.events=dedupe(j.events);j.base={sig:s,state};checkpoint(j);return j}
/* Silent re-base (import, restore, another tab). If `state` matches an earlier checkpoint, history recorded after it is dropped
   because those changes are no longer in the data. `incoming` = optional events from a backup file, merged by id. */
function rebase(j,state,incoming){j=parse(j);const s=sig(state);
 if(j.base&&j.base.sig!==s){const cp=j.cps.slice().reverse().find(c=>c.sig===s);
  if(cp){const k=j.cps.indexOf(cp),later=j.cps.slice(k+1),drop=new Set();later.forEach(c=>(c.added||[]).forEach(id=>drop.add(id)));
   const i=cp.last===null?-1:j.events.findIndex(e=>e.id===cp.last);if(cp.last===null||i>=0)j.events=j.events.slice(0,i+1);
   j.events=j.events.filter(e=>!drop.has(e.id));j.cps=j.cps.slice(0,k+1)}}
 let added=[];if(Array.isArray(incoming)){const have=new Set(j.events.map(e=>e.id)),inc=dedupe(incoming.filter(validEvent)).filter(e=>!have.has(e.id));added=inc.map(e=>e.id);j.events=dedupe(j.events.concat(inc))}
 j.base={sig:s,state};checkpoint(j,added);return j}
function exportEvents(j){return parse(j).events.map(e=>JSON.parse(JSON.stringify(e)))}
function newId(now){return'e'+now.toString(36)+'-'+Math.random().toString(36).slice(2,8)}
return{SCHEMA,MAX_EVENTS,UNDO_MS,project,diff,sig,parse,record,rebase,exportEvents,validEvent,dedupe,empty,newId};
});
/* Browser glue: listens to the existing ff:data-saved signal. Every step is in try/catch; a journal problem never
   blocks, delays or changes a save. */
(function(){
'use strict';
if(typeof window==='undefined'||!window.FlossFoxJournalCore||!window.FlossFoxProjects)return;
const J=window.FlossFoxJournalCore,P=window.FlossFoxProjects,KEY=P.KEY.replace(/\.v1$/,'')+'.journal.v1',session=new Set();let hold=false;
function live(){const T=window.FlossFoxThreadsUI;return J.project(P._store(),T&&T.data?T.data():null)}
function raw(){try{return localStorage.getItem(KEY)}catch(e){return null}}
function read(){return J.parse(raw())}
const hasData=s=>Object.keys(s.inv).length+Object.keys(s.ps).length>0;
// Writes only its own key, only when something changed, and never creates the key while nothing is saved (first visit stays fresh).
function write(j,s){try{const r=raw(),t=JSON.stringify(j);if(r===t||(r===null&&!hasData(s)))return false;localStorage.setItem(KEY,t);return true}catch(e){return false}}
function onSaved(){if(hold)return;try{const now=Date.now(),s=live();write(J.record(read(),s,now,session,()=>J.newId(now)),s)}catch(e){}}
function rebase(incoming){hold=false;try{const s=live();write(J.rebase(read(),s,incoming),s)}catch(e){}}
window.addEventListener('ff:data-saved',onSaved);
// Opening the app: anything changed outside a normal save (import/restore reloads, another tab) is a re-base, never an event.
try{if(P.canSave&&P.canSave())rebase()}catch(e){}
window.FlossFoxJournal={KEY,events:()=>read().events,exportEvents:()=>{try{return J.exportEvents(read())}catch(e){return[]}},hold:()=>{hold=true},rebase,_session:session};
})();
