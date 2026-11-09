/* Recent changes (read-only view of the Phase 1 journal, DEV PREVIEW). Shows inventory, project status and
   shopping-list changes newest first under Settings. It only READS the journal through FlossFoxJournal.events()
   and the projects store; it never writes any storage key, never records events, and has no network use.
   Codes are shown as codes; no color names are looked up or guessed. All text goes in via textContent. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxRecentCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ST={planning:'Planning',ready:'Ready to stitch',progress:'In progress',done:'Completed'},KIND={inventory:'Threads',project:'Project',shopping:'Shopping'};
const LIMITS='Only the latest 500 changes are kept, on this device only. A change you undo or redo within 10 minutes in the same visit may be combined or removed. Changes made in another open tab may be missing. This is a helpful reminder, not a complete history.';
const EMPTY='No changes yet. When you change your threads, a project\'s status or your shopping list, it will show up here.';
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),code=v=>typeof v==='string'&&v.length>0&&v.length<=40;
function amount(x){const n=Number.isInteger(x.n)&&x.n>=0?x.n:0,p=x.partial===true;if(!n&&p)return'a partial skein';return(n===1?'1 skein':n+' skeins')+(p?' plus a partial':'')}
function text(e,ctx){const r=e.ref;
 if(e.k==='inventory'){if(!code(r.code))return null;const f=obj(e.from)?e.from:null,t=obj(e.to)?e.to:null,c='Floss '+r.code;
  if(!f&&t)return c+' added to My threads ('+amount(t)+')';if(f&&!t)return c+' removed from My threads (was '+amount(f)+')';if(f&&t)return c+': '+amount(f)+' → '+amount(t);return null}
 if(e.k==='project'){if(!code(r.pid))return null;const f=e.from,t=e.to;if((f!==null&&!ST[f])||(t!==null&&!ST[t]))return null;
  const nm=ctx.projectName(r.pid),name=typeof nm==='string'&&nm.trim()?nm:'A project no longer saved';
  if(f===null&&t)return name+' was added ('+ST[t]+')';if(f&&t===null)return name+' was removed';if(f&&t)return name+': '+ST[f]+' → '+ST[t];return null}
 if(e.k==='shopping'){if(typeof e.to!=='boolean'||!code(r.code))return null;
  if('pid'in r){if(!code(r.pid))return null;const nm=ctx.projectName(r.pid),name=typeof nm==='string'&&nm.trim()?nm:'A project no longer saved';
   return name+': floss '+r.code+(e.to?' marked Need to buy':' no longer marked Need to buy')}
  return'Floss '+r.code+(e.to?' added to your shopping list':' taken off your shopping list')}
 return null}
function describe(events,ctx){ctx=ctx||{};const c={projectName:typeof ctx.projectName==='function'?id=>{try{return ctx.projectName(id)}catch(e){return null}}:()=>null,
  fmtDate:typeof ctx.fmtDate==='function'?ctx.fmtDate:t=>new Date(t).toLocaleString()};
 const items=[];let skipped=0;
 for(const e of Array.isArray(events)?events:[]){try{
  if(!obj(e)||typeof e.id!=='string'||typeof e.t!=='string'||isNaN(Date.parse(e.t))||!KIND[e.k]||!obj(e.ref)){skipped++;continue}
  const s=text(e,c);if(!s){skipped++;continue}let when;try{when=String(c.fmtDate(e.t))}catch(x){when=e.t}
  items.push({id:e.id,t:e.t,kind:KIND[e.k],text:s,when})}catch(x){skipped++}}
 items.sort((a,b)=>a.t<b.t?1:a.t>b.t?-1:0);return{items,skipped}}
return{describe,LIMITS,EMPTY};
});
(function(){
'use strict';
if(typeof window==='undefined'||typeof document==='undefined'||!window.FlossFoxRecentCore)return;
const R=window.FlossFoxRecentCore,PAGE=25;
function el(t,cls,txt){const e=document.createElement(t);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function events(){try{const J=window.FlossFoxJournal;return J&&typeof J.events==='function'?J.events():[]}catch(e){return null}}
function projectName(id){const P=window.FlossFoxProjects;const s=P&&P._store?P._store():null;const p=s&&Array.isArray(s.projects)?s.projects.find(x=>x&&x.id===id&&!x.demo):null;return p&&typeof p.name==='string'?p.name:null}
function render(box){let shown=PAGE;const list=box.querySelector('.rclist'),more=box.querySelector('.rcmore'),msg=box.querySelector('.rcmsg');
 const evs=events();let res;try{res=R.describe(evs||[],{projectName,fmtDate:t=>new Date(t).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})})}catch(e){res={items:[],skipped:0}}
 function draw(){list.textContent='';res.items.slice(0,shown).forEach(it=>{const li=el('li');const w=el('time','rcwhen',it.when);w.setAttribute('datetime',it.t);li.append(el('span','rckind',it.kind),w,el('span','rctext',it.text));list.append(li)});
  more.hidden=res.items.length<=shown;more.textContent='Show more ('+(res.items.length-shown)+' older)'}
 msg.textContent=evs===null?'Recent changes could not be read right now. Your threads and projects are not affected.':res.items.length?(res.skipped?res.skipped+(res.skipped===1?' entry':' entries')+' could not be shown.':''):R.EMPTY;
 msg.hidden=!msg.textContent;more.onclick=()=>{shown+=PAGE;draw()};draw()}
function mount(){const v=document.getElementById('settingsView'),card=v&&v.querySelector('.card');if(!card||document.getElementById('recentChanges'))return;
 const d=el('details','rcbox');d.id='recentChanges';const s=el('summary',null,'Recent changes');d.append(s,el('p','hint rclimits',R.LIMITS));
 const msg=el('p','rcmsg');msg.setAttribute('role','status');const list=el('ul','rclist');list.setAttribute('aria-label','Recent changes, newest first');
 const more=el('button','sec small rcmore');more.type='button';more.hidden=true;d.append(msg,list,more);
 const snap=document.getElementById('snapBox');if(snap&&snap.parentNode===card)snap.after(d);else card.append(d);
 d.addEventListener('toggle',()=>{if(d.open)render(d)});
 document.getElementById('tabSettings')?.addEventListener('click',()=>{if(d.open)render(d)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.FlossFoxRecentChanges={render:()=>{const d=document.getElementById('recentChanges');if(d)render(d)}};
})();
