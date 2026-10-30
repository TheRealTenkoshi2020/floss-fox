/* Phase 0 quick win (DEV PREVIEW): ask the browser to keep this site's storage, and keep the last 3 automatic
 * copies of the user's data on this device, with a Restore list in Settings > Backup.
 * Safety rules: a snapshot only ever writes its own key (PFX.snapshots.v1 / PFX.snapmeta.v1); any storage error is
 * caught and the real data keys are never touched except by an explicit, confirmed Restore, which first saves the
 * current data as a new snapshot so the Restore can be undone. */
(function(){
'use strict';
// ---- User-facing strings (heading, body, footer and Restore aria-label approved by Pixel; all wording lives here) ----
const STR={
 heading:'Automatic copies on this device',
 intro:'We keep up to 3 recent copies of your projects and thread collection in this browser. We save one when you open the app after changes, and before an import or restore. These copies are deleted if you clear this site\'s data, so keep saving backup files too.',
 none:'No automatic copies yet. One is made the next time you open Floss Fox after making changes.',
 listLabel:'Saved copies',
 item:'{when} · {projects}, {colors}',
 reason:{open:'when you opened the app',import:'before an import',restore:'before a restore',undo:'before undoing an import'},
 restoreBtn:'Restore this copy',
 confirm:'Restore the copy from {when}? Your current projects, thread collection and preferences will be replaced by this copy. Your current data is saved as a new copy first, so you can switch back.',
 noSafety:'Floss Fox couldn\'t save a copy of your current data first (storage is full or blocked), so nothing was changed. Save a backup file, then try again.',
 failed:'Restore failed: your browser blocked the save. Nothing was changed.',
 footer:'Your browser may clear Floss Fox data if space runs low. A backup file you save keeps a copy outside the browser.',
 restoreAria:'Restore the copy from {date}',
 saveFull:'The newest automatic copy couldn\'t be saved because browser storage is full. Your data is fine. Save a backup file to keep a copy.'
};
const P=window.FlossFoxProjects;if(!P||!P.rawSnapshot)return;
const PFX=P.KEY.replace(/\.v1$/,''),SNAPKEY=PFX+'.snapshots.v1',METAKEY=PFX+'.snapmeta.v1',MAX=3,MAX_CHARS=1000000; // total cap for all copies (~2 MB in UTF-16), leaves most of the ~5 MB origin quota for real data
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fill=(t,o)=>t.replace(/\{(\w+)\}/g,(m,k)=>o[k]!==undefined?o[k]:m),plural=(n,w)=>n+' '+w+(n===1?'':'s');
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return(h>>>0).toString(36)+'.'+s.length}
function readJSON(k,dflt){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?dflt:v}catch(e){return dflt}}
function list(){const a=readJSON(SNAPKEY,[]);return Array.isArray(a)?a.filter(s=>s&&s.keys&&typeof s.at==='string'):[]}
function meta(){const m=readJSON(METAKEY,{});return m&&typeof m==='object'&&!Array.isArray(m)?m:{}}
function setMeta(patch){try{localStorage.setItem(METAKEY,JSON.stringify(Object.assign(meta(),patch)));return true}catch(e){return false}}
function counts(keys){let p=0,c=0;try{p=(JSON.parse(keys[P.KEY]||'null')||{projects:[]}).projects.filter(x=>!x.demo).length}catch(e){}
 try{const tk=Object.keys(keys).find(k=>/\.threads\.v1$/.test(k));c=Object.keys((JSON.parse(keys[tk]||'null')||{threads:{}}).threads||{}).length}catch(e){}return{projects:p,colors:c}}
function dataSig(keys){return hash(JSON.stringify(keys))}
function hasData(keys){const c=counts(keys);return c.projects>0||c.colors>0}
// Takes a snapshot. Returns {ok, skipped?, reason?}. Never throws, never writes anything but SNAPKEY/METAKEY.
function take(reason,opts){opts=opts||{};try{
 const s=P.rawSnapshot(),sig=dataSig(s.keys),arr=list();
 if(!hasData(s.keys))return{ok:false,skipped:'empty'};
 // Already have a copy of exactly this data: an open adds nothing; an import/restore moves that copy to the top with the new label (no duplicate).
 const dup=arr.findIndex(x=>x&&x.sig===sig);
 if(dup>=0&&!opts.force)return{ok:false,skipped:'same'};
 const item={at:s.at,reason:String(reason||'open'),sig,counts:counts(s.keys),keys:s.keys};
 if(dup>=0)arr.splice(dup,1);
 if(JSON.stringify(item).length>MAX_CHARS){setMeta({lastError:'too-large',lastErrorAt:new Date().toISOString()});return{ok:false,skipped:'too-large'}}
 let next=[item].concat(arr).slice(0,MAX);while(next.length>1&&JSON.stringify(next).length>MAX_CHARS)next=next.slice(0,-1);
 while(next.length){try{localStorage.setItem(SNAPKEY,JSON.stringify(next));setMeta({lastError:null});return{ok:true,kept:next.length}}catch(e){next=next.slice(0,next.length-1)}}
 setMeta({lastError:'quota',lastErrorAt:new Date().toISOString()});return{ok:false,skipped:'quota'}
}catch(e){return{ok:false,skipped:'error'}}}
// Quietly ask the browser to keep storage. Feature-detected; never awaited by anything; result recorded only.
function askPersist(){try{const S=navigator.storage;if(!S||typeof S.persist!=='function')return Promise.resolve(setMeta({persist:'unsupported'})&&null);
 const chk=typeof S.persisted==='function'?S.persisted():Promise.resolve(false);
 return chk.then(already=>already?true:S.persist()).then(g=>{setMeta({persist:g?'granted':'denied',persistAt:new Date().toISOString()});render();return g}).catch(()=>{setMeta({persist:'error'});return null})}catch(e){return Promise.resolve(null)}}
function restore(i){const arr=list(),s=arr[i];if(!s)return false;const when=fmt(s.at);
 if(!confirm(fill(STR.confirm,{when})))return false;
 const r=take('restore',{force:true});if(!r.ok&&r.skipped!=='same'&&r.skipped!=='empty'){status(STR.noSafety);return false}
 const prev={};try{for(const k in s.keys)prev[k]=localStorage.getItem(k)}catch(e){status(STR.failed);return false}
 try{for(const k in s.keys){if(s.keys[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,s.keys[k])}}
 catch(e){try{for(const k in prev){if(prev[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,prev[k])}}catch(e2){}status(STR.failed);return false}
 setMeta({restoredAt:new Date().toISOString()});location.hash='#settings';location.reload();return true}
function fmt(at){return new Date(at).toLocaleString([], {year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function status(msg){const el=$('snapStatus');if(el)el.textContent=msg}
function render(){const box=$('snapBox');if(!box)return;const arr=list(),m=meta();
 const rows=arr.map((s,i)=>{const c=s.counts||counts(s.keys),when=esc(fmt(s.at));
  return `<li><span>${esc(fill(STR.item,{when:fmt(s.at),projects:plural(c.projects,'project'),colors:plural(c.colors,'thread color')}))} <span class="mut">(${esc(STR.reason[s.reason]||STR.reason.open)})</span></span> <button type="button" class="sec small" data-snap="${i}" aria-label="${esc(fill(STR.restoreAria,{date:fmt(s.at)}))}">${esc(STR.restoreBtn)}</button></li>`}).join('');
 box.innerHTML=`<h3>${esc(STR.heading)}</h3><p class="hint">${esc(STR.intro)}</p>${arr.length?`<ul class="snaplist" aria-label="${esc(STR.listLabel)}">${rows}</ul>`:`<p class="hint">${esc(STR.none)}</p>`}<p class=\"hint\">${esc(STR.footer)}</p>${m.lastError?`<p class="hint warn">${esc(STR.saveFull)}</p>`:''}<p class="hint" id="snapStatus" role="status" aria-live="polite"></p>`;
 box.querySelectorAll('button[data-snap]').forEach(b=>b.onclick=()=>restore(+b.dataset.snap))}
window.FlossFoxSnapshots={take,list,restore,askPersist,render,SNAPKEY,METAKEY,STR,_meta:meta};
take('open');render();
// Only ask for persistent storage once the user has data worth keeping.
if(hasData(P.rawSnapshot().keys))askPersist();
})();
