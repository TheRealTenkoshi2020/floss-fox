/* Floss Fox 1.7: My Thread Collection.
   Core (pure, also used by tests/threads_unit.js in Node) + UI (browser only).
   Storage: its own key, <projects key>.threads.v1 (flossfox.threads.v1, or flossfox-dev.threads.v1 on the preview),
   so projects data (flossfox.v1) is never rewritten by the collection. Format:
   {schema:1, threads:{"310":{n:2, partial:false, restock:false, updated:"ISO"}}, demo?:{...same shape...}}
   demo = preview sample threads, kept in their own map so they are never merged into (or confused with) real entries. */
/* Quantities, kept apart everywhere: owned full skeins (collection n) | required skeins (project qty, stated or entered) |
   assumed (project assumed: the default 1 when no amount was given) | estimated (reserved for a future estimator; nothing generates it) |
   stitch counts (project stitchCount; never used as skeins).
   n = full skeins (whole number 0..999). partial = has an opened/partial skein. restock = user wants to buy more.
   Out of stock = n 0 and no partial (derived, never stored). */
(function(root){
const SCHEMA=2,MAXN=999;
function normalizeStorage(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return null;
 const clean=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
 const container=clean(s.container,60),slot=clean(s.slot,40);
 const medium=['bobbin','skein','bag','other'].includes(s.medium)?s.medium:'';
 return container||slot||medium?{container,slot,medium}:null;
}
function core(DMC){
 const known=c=>Object.prototype.hasOwnProperty.call(DMC,c);
 function normEntry(code,e){if(!known(code)||!e||typeof e!=='object')return null;
  const n=Number.isInteger(e.n)&&e.n>=0?Math.min(e.n,MAXN):null;if(n===null)return null;
  const storage=normalizeStorage(e.storage);return{n,partial:e.partial===true,restock:e.restock===true,updated:typeof e.updated==='string'?e.updated.slice(0,40):'',...(e.confirmed===true?{confirmed:true}:{}),...(storage?{storage}:{})}}
 // -> {data, skipped} | {tooNew:true} | null (not collection data)
 function migrate(d){if(!d||typeof d!=='object'||!d.threads||typeof d.threads!=='object'||Array.isArray(d.threads))return null;
  const v=d.schema===undefined?1:d.schema;if(typeof v!=='number'||v>SCHEMA)return{tooNew:true};
  const threads={},demo={};let skipped=0;for(const k of Object.keys(d.threads)){const e=normEntry(k,d.threads[k]);if(e)threads[k]=e;else skipped++}
  if(d.demo&&typeof d.demo==='object'&&!Array.isArray(d.demo))for(const k of Object.keys(d.demo)){const e=normEntry(k,d.demo[k]);if(e)demo[k]=e}
  return{data:Object.keys(demo).length?{schema:SCHEMA,threads,demo}:{schema:SCHEMA,threads},skipped}}
 const empty=()=>({schema:SCHEMA,threads:{}});
 const now=()=>new Date().toISOString();
 // add skeins (duplicates merge). items: [{code, qty|null}] from the parser; null/assumed -> 1
 function add(data,items,opts){let added=0,merged=0;const seen=new Set();const M=opts&&opts.demo?(data.demo||(data.demo={})):data.threads;
  for(const it of items){if(!known(it.code))continue;const q=Number.isInteger(it.qty)&&it.qty>0?it.qty:1;const e=M[it.code];
   const confirmed=Number.isInteger(it.qty)&&it.qty>0&&it.stated!==false&&!(it.assumed>0);
   if(e){e.n=Math.min(MAXN,e.n+q);e.updated=now();if(!confirmed)delete e.confirmed;if(!seen.has(it.code))merged++}else{M[it.code]={n:Math.min(MAXN,q),partial:false,restock:false,updated:now(),...(confirmed?{confirmed:true}:{})};added++}seen.add(it.code)}
  return{added,merged}}
 function step(data,code,d,opts){const e=(opts&&opts.demo?data.demo||{}:data.threads)[code];if(!e)return null;e.n=Math.max(0,Math.min(MAXN,e.n+d));e.confirmed=true;e.updated=now();return e.n}
 const state=e=>!e||(e.n===0&&!e.partial)?'out':e.n===0?'partial':'stock';
 // project color vs collection: owned | short | missing
 // owned = amount needed is stated and covered; unverified = owned but the amount needed is unknown or (partly) assumed
 function verdict(e,need,assumed){if(!e||state(e)==='out')return'missing';if(need===null||need===undefined)return'unverified';
  const a=assumed||0,stated=need-a;if(a>0)return e.n>=stated?'unverified':'short';return e.n>=need?(e.confirmed===true?'owned':'unverified'):'short'}
 // compares a project with the entries it is given: the whole collection by default, or (from projects.js allocE) the collection minus skeins set aside for other projects
 function compare(items,data,opts){const r={owned:[],unverified:[],short:[],missing:[]};const M=opts&&opts.demo?data.demo||{}:data.threads;
  for(const it of items){const e=M[it.code];const v=verdict(e,it.qty,it.assumed);r[v].push({code:it.code,need:it.qty,assumed:it.assumed||0,have:e?e.n:0,partial:!!(e&&e.partial)})}return r}
 return{SCHEMA,migrate,empty,add,step,state,verdict,compare,normEntry,normalizeStorage}}
const api={core};
if(typeof module==='object'&&module.exports){module.exports=api;return}
root.FlossFoxThreads=api;
if(typeof document==='undefined')return;

// ---------------- UI ----------------
const C=core(DMC),$=id=>document.getElementById(id);
const PK=(window.FlossFoxProjects&&FlossFoxProjects.KEY)||'flossfox.v1',KEY=PK.replace(/\.v1$/,'')+'.threads.v1',TIPKEY=PK.replace(/\.v1$/,'')+'.tips.v1';
let data=C.empty(),canSave=true,mem=false,q='',show='all';
let bulkStorageUndoState=null;
const msg=h=>{const m=$('thMsg');m.innerHTML=h||'';m.hidden=!h};
const say=t=>{$('thStatus').textContent=t};
function load(){let raw=null;try{raw=localStorage.getItem(KEY)}catch(e){canSave=false;mem=true;msg('<b>Saving is unavailable in this browser</b> (private mode or storage blocked). Your collection will only last until this tab closes.');return}
 if(raw===null)return;let d=null;try{d=JSON.parse(raw)}catch(e){}
 const m=d&&C.migrate(d);
 if(!m||m.tooNew){canSave=false;try{localStorage.setItem(KEY+'.unreadable-'+Date.now(),raw)}catch(e){}
  msg((m&&m.tooNew?'<b>Your thread collection was saved by a newer version of Floss Fox.</b> It is left untouched and saving is paused.':'<b>Your saved thread collection couldn\'t be read.</b> It was left as it was (a copy is kept in browser storage) and saving is paused, so nothing gets overwritten.')+' <button type="button" class="sec small" id="thReset">Start a new collection</button>');
  $('thReset').onclick=()=>{if(!confirm('Start a new, empty collection? The unreadable copy stays in browser storage under a separate name.'))return;canSave=true;data=C.empty();save();msg('');render()};return}
 data=m.data;if(m.skipped)msg(`${m.skipped} saved thread${m.skipped===1?'':'s'} couldn't be read and ${m.skipped===1?'was':'were'} skipped.`)}
function backupChanged(){window.dispatchEvent(new CustomEvent('ff:data-saved',{detail:{area:'threads'}}));}
function save(){bulkStorageUndoState=null;if(!canSave){if(!mem)say('Not saved: saving is paused (see the note above).');return false}
 try{localStorage.setItem(KEY,JSON.stringify(data));backupChanged();return true}catch(e){say(e&&(e.name==='QuotaExceededError'||e.code===22)?'Not saved: browser storage is full.':'Not saved: your browser blocked the save.');return false}}
const nm=c=>DMC[c].name.replace(/\b(vy|dk|lt|md|ul)\b/gi,m=>({vy:'very',dk:'dark',lt:'light',md:'medium',ul:'ultra'}[m.toLowerCase()]));
const ST={stock:'In stock',partial:'Partial skein only',out:'Out of stock'};
const thOpen=new Set();
const MM=x=>x&&x.dataset&&x.dataset.m==='d'?(data.demo||{}):data.threads;
function row(c,dm){const M=dm?data.demo:data.threads,e=M[c],s=C.state(e),id=(dm?'d_':'')+c.replace(/[^\w]/g,'_'),m=dm?' data-m="d"':'',L=esc(lab(c)),ox=thOpen.has(id);
 return`<li class="tcard th st-${s==='out'?'buy':s==='partial'?'awaiting':'have'}${dm?' demo':''}${ox?' thx':''}" data-code="${esc(c)}"${m} data-q="${esc((lab(c)+' '+nm(c)).toLowerCase())}">
 <div class="thtop">${sw(DMC[c].hex)}<button type="button" class="thname thtog" id="tx-${id}" data-tog="${id}" aria-expanded="${ox}" aria-controls="to-${id}" aria-label="Edit DMC ${L}"><b>DMC ${L}</b>${dm?' <span class="tag demotag">Demo</span>':''} <small class="mut">${esc(nm(c))}</small><br><small class="thst">${ST[s]}${e.restock?' · <b>restock</b>':''}</small><span class="thedit" aria-hidden="true">${ox?'Done':'Edit'}</span></button>
 <div class="stepper" role="group" aria-label="Full skeins of ${dm?'demo ':''}DMC ${L}"><button type="button" class="sec" id="tm-${id}"${m} data-step="-1" data-c="${esc(c)}" aria-label="One fewer skein of ${dm?'demo ':''}DMC ${L}"${e.n?'':' disabled'}>−</button><input type="number" class="thn" id="tn-${id}"${m} data-n="${esc(c)}" value="${e.n}" min="0" max="999" step="1" inputmode="numeric" aria-label="Full skeins of ${dm?'demo ':''}DMC ${L}"><button type="button" class="sec" id="tp-${id}"${m} data-step="1" data-c="${esc(c)}" aria-label="One more skein of ${dm?'demo ':''}DMC ${L}">+</button></div></div>
 <div class="thopts" id="to-${id}"><label><input type="checkbox" id="tpa-${id}"${m} data-part="${esc(c)}"${e.partial?' checked':''}> Partial skein</label><label><input type="checkbox" id="tr-${id}"${m} data-rs="${esc(c)}"${e.restock?' checked':''}> Restock</label><button type="button" class="ghost small"${m} data-del="${esc(c)}">Remove</button></div>${e.n>0&&e.confirmed!==true?`<p class="hint">Check this full-skein count before using it with Pip’s estimates. <button type="button" class="sec small" id="tv-${id}"${m} data-verify="${esc(c)}">Confirm ${e.n} full skein${e.n===1?'':'s'}</button></p>`:''}</li>`}
const byCode=(a,b)=>{const na=/^\d+$/.test(a)?+a:1e6,nb=/^\d+$/.test(b)?+b:1e6;return na-nb||a.localeCompare(b)};
function sorted(){return Object.keys(data.threads).sort(byCode)}
function render(){const V=$('threadsView');if(!V)return;const codes=sorted(),T=data.threads,D=Object.keys(data.demo||{}).sort(byCode);
 const sk=codes.reduce((a,c)=>a+T[c].n,0),out=codes.filter(c=>C.state(T[c])==='out').length,rs=codes.filter(c=>T[c].restock).length;
 $('thSum').innerHTML=(codes.length?`<b>${codes.length}</b> color${codes.length===1?'':'s'} · ${sk} full skein${sk===1?'':'s'}${out?` · ${out} out of stock`:''}${rs?` · ${rs} to restock`:''}`:'Your keepsake box is empty for now. Add the DMC numbers you own above to fill it.')+(D.length?` <span class="mut">(plus ${D.length} demo threads, counted separately)</span>`:'');
 $('thFilt').innerHTML=[['all','All'],['restock','Restock'],['out','Out of stock']].map(([k,l])=>`<button type="button" data-show="${k}" aria-pressed="${show===k}">${l}</button>`).join('');
 $('thList').innerHTML=codes.map(c=>row(c,false)).join('')+(D.length?`<li class="demohead" id="thDemoHead"><b>Demo threads</b> <span class="hint">Sample data for trying Floss Fox. Kept apart from your own threads and never added to them.</span> <button type="button" class="sec small" id="thRemoveDemo">Remove demo data</button></li>`+D.map(c=>row(c,true)).join(''):'');
 $('thTools').hidden=!codes.length&&!D.length;filter();bind();tip('threads');if(root.FlossFoxThreadLocationsUI)root.FlossFoxThreadLocationsUI.enhance();if(root.FlossFoxBulkStorageUI)root.FlossFoxBulkStorageUI.enhance()}
function filter(){const s=q.trim().toLowerCase().replace(/^dmc\s*/,'');let n=0;
 document.querySelectorAll('#thList .th').forEach(li=>{const c=li.dataset.code,e=MM(li)[c];const ok=(!s||li.dataset.q.includes(s)||lab(c).toLowerCase()===s)&&(show==='all'||show==='restock'&&e.restock||show==='out'&&C.state(e)==='out');li.hidden=!ok;if(ok)n++});
 const dh=$('thDemoHead');if(dh)dh.hidden=!!s||show!=='all';
 const nr=$('thNoRes'),tot=document.querySelectorAll('#thList .th').length;nr.hidden=!tot||!!n;nr.textContent=q?`No colors in your collection match “${q}”.`:'Nothing here right now.'}
const CAP=()=>(window.FlossFoxParse&&FlossFoxParse.SKEIN_CAP)||20;
// more than CAP full skeins of one color needs an explicit OK (it's usually a typo or a stitch count)
function okCap(c,k,M){M=M||data.threads;const cur=M[c]?M[c].n:0;if(k<=CAP()||k<=cur)return true;
 const yes=confirm(`${k} full skeins of DMC ${lab(c)}? That's more than ${CAP()} of one color. OK keeps ${k}.`);if(!yes)say(`Nothing changed: DMC ${lab(c)} stays at ${cur}.`);return yes}
function keepFocus(id){const f=document.getElementById(id);if(f){if(f.disabled){const o=document.getElementById(id.replace(/^tm-/,'tp-'));if(o)o.focus()}else f.focus()}}
const stamp=e=>{e.updated=new Date().toISOString()};
async function removeDemo(){const n=Object.keys(data.demo||{}).length,P=window.FlossFoxProjects,np=P?P._store().projects.filter(x=>x.demo).length:0;
 const ok=await FlossFoxConfirm.ask({pose:'thinking',title:'Remove the demo data?',
  body:`That clears ${n} demo thread${n===1?'':'s'} and ${np} demo project${np===1?'':'s'}. Your own threads and projects stay put.`});
 if(!ok)return;
 delete data.demo;save();const rp=P&&P.removeDemo?P.removeDemo():0;render();say(`Demo data removed (${n} threads, ${rp} project${rp===1?'':'s'}). Your own data is unchanged.`);$('thAdd').focus()}
function bind(){const L=$('thList');
 L.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{const k=b.dataset.tog,li=b.closest('li');if(thOpen.has(k))thOpen.delete(k);else thOpen.add(k);const o=thOpen.has(k);li.classList.toggle('thx',o);b.setAttribute('aria-expanded',o);const t=b.querySelector('.thedit');if(t)t.textContent=o?'Done':'Edit'});
 L.querySelectorAll('[data-n]').forEach(i=>i.onchange=()=>{const c=i.dataset.n,M=MM(i),v=i.value.trim(),e=M[c];
  if(!/^\d+$/.test(v)){say(`"${v}" isn't a whole number of skeins (0 or more), so nothing changed.`);i.value=e.n;return}
  const k=Math.min(999,+v);if(!okCap(c,k,M)){i.value=e.n;return}e.n=k;e.confirmed=true;stamp(e);save();render();keepFocus(i.id);say(`DMC ${lab(c)}: ${k} full skein${k===1?'':'s'}.`)});
 L.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const c=b.dataset.c,M=MM(b),id=b.id;if(+b.dataset.step>0&&!okCap(c,M[c].n+1,M))return;C.step(data,c,+b.dataset.step,{demo:b.dataset.m==='d'});save();render();keepFocus(id);say(`DMC ${lab(c)}: ${M[c].n} full skein${M[c].n===1?'':'s'}.`)});
 L.querySelectorAll('[data-part]').forEach(x=>x.onchange=()=>{const c=x.dataset.part,e=MM(x)[c];e.partial=x.checked;stamp(e);save();render();keepFocus(x.id)});
 L.querySelectorAll('[data-rs]').forEach(x=>x.onchange=()=>{const c=x.dataset.rs,e=MM(x)[c];e.restock=x.checked;stamp(e);save();render();keepFocus(x.id)});
 L.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{const c=b.dataset.verify,e=MM(b)[c];e.confirmed=true;stamp(e);save();render();keepFocus('tn-'+(b.dataset.m==='d'?'d_':'')+c.replace(/[^\w]/g,'_'));say(`Confirmed ${e.n} full skein${e.n===1?'':'s'} of DMC ${lab(c)}.`)});
 L.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const c=b.dataset.del,M=MM(b),demo=b.dataset.m==='d',L=lab(c);
  const ok=await FlossFoxConfirm.ask({pose:'worried',title:demo?`Remove demo DMC ${L}?`:`Remove DMC ${L} from your collection?`,
   body:demo?'Demo threads are just for trying Floss Fox. You can load them again anytime.':'Are you sure? You can add it back anytime.'});
  if(!ok)return;delete M[c];if(data.demo&&!Object.keys(data.demo).length)delete data.demo;save();render();say(`Removed DMC ${L}.`);$('thAdd').focus()});
 const rd=$('thRemoveDemo');if(rd)rd.onclick=removeDemo;
 $('thFilt').querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{show=b.dataset.show;render();const nb=$('thFilt').querySelector(`[data-show="${show}"]`);if(nb)nb.focus()})}
function addNow(){const t=$('thAdd').value;if(!t.trim()){say('Type or paste DMC numbers first.');return}
 const r=parse(t);const big=r.items.filter(it=>(data.threads[it.code]?data.threads[it.code].n:0)+(Number.isInteger(it.qty)&&it.qty>0?it.qty:1)>CAP());
 if(big.length&&!confirm(`This would give you more than ${CAP()} full skeins of ${big.map(x=>'DMC '+lab(x.code)).join(', ')}. OK adds them anyway.`)){say('Nothing added.');return}
 const res=C.add(data,r.items),ok=save();
 $('thErr').innerHTML=r.errs.length?`<div class="errbox"><b>We had a little trouble reading ${r.errs.length} of those entries:</b><ul>${r.errs.map(e=>`<li>"${esc(e.t)}": ${esc(e.why)}.${(e.fixes||[]).filter(f=>!f.confirm).length?` <span class="mut">Did you mean ${e.fixes.filter(f=>!f.confirm).map(f=>`<i>${esc(f.label)}</i>`).join(' or ')}? Your collection counts skeins only (stitch counts aren't skeins).</span>`:''}</li>`).join('')}</ul>We've kept them right here in the box so you can check them and try again.</div>`:'';
 $('thAdd').value=r.errs.map(e=>e.t).join('\n');render();
 say(`${res.added?`Added ${res.added} new color${res.added===1?'':'s'}`:'No new colors'}${res.merged?`, added skeins to ${res.merged} you already had`:''}.${ok?'':' (Not saved in this browser.)'}`)}
// Pip tips: inline (never over controls), existing poses only, once per view visit, dismissible, off with Pip hidden or tips off.
const TIPS={threads:['pointing',213,'Use <b>+</b> and <b>−</b> to count your skeins.','Count full skeins only. Tick <b>Partial skein</b> for an opened one, and <b>Restock</b> for colors you want to buy again. Your collection stays in this browser.'],
 compare:['helpful',214,'I can fill this project in from your threads.','Tap <b>Use my collection</b>: you\'ll see every change first, and you can undo it afterwards. Your collection itself never changes.']};
const tipSeen=new Set();
const dismissed=()=>{try{return JSON.parse(localStorage.getItem(TIPKEY)||'[]')}catch(e){return[]}};
function tip(name,host){const el=host||$('thTip');if(!el)return;el.innerHTML='';el.hidden=true;
 const pipHidden=window.FlossFoxPip&&FlossFoxPip.isHidden&&FlossFoxPip.isHidden(),off=window.FlossFoxTour&&FlossFoxTour.hintsOn&&!FlossFoxTour.hintsOn();
 if(pipHidden||off||tipSeen.has(name)||dismissed().includes(name))return;
 if(!host&&$('threadsView').hidden)return; // only when the view is on screen (no image is loaded for a hidden view)
 const [pose,h,text,more]=TIPS[name];el.hidden=false;
 el.innerHTML=`<picture><source type="image/webp" srcset="assets/pip/pip-${pose}-160.webp"><img src="assets/pip/pip-${pose}-160.png" width="160" height="${h}" alt="" data-pose="${pose}" decoding="async"></picture><div class="tiptx"><p><b>Pip:</b> ${text}</p><details class="tipmore"><summary>${name==='compare'?'More from Pip about this check':'More'}</summary><p>${more}</p></details></div><button type="button" class="ghost small" data-tipx="${name}" aria-label="Dismiss Pip's tip">Got it</button>`;
 el.querySelector('[data-tipx]').onclick=()=>{const d=dismissed();d.push(name);try{localStorage.setItem(TIPKEY,JSON.stringify(d))}catch(e){}el.hidden=true;el.innerHTML=''}}
function leaveView(){tipSeen.add('threads')}
load();

// All storage writes are atomic (whole collection in a single localStorage write).
// The single-color editor calls this instead of mutating in-memory data first.
function setStorageLocation(code,storage,opts){
 if(!canSave)return{ok:false,error:'Collection saving is paused or unavailable.'};
 const demo=!!(opts&&opts.demo),map=demo?(data.demo||{}):data.threads;
 if(!Object.prototype.hasOwnProperty.call(map,code))return{ok:false,error:'That thread is no longer in your collection.'};
 const e={...map[code],updated:new Date().toISOString()};
 const normalized=C.normalizeStorage(storage);
 if(normalized)e.storage=normalized;else delete e.storage;
 const nextMap={...map,[code]:e};
 const next=demo?{...data,demo:nextMap}:{...data,threads:nextMap};
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch(e){return{ok:false,error:'Your browser blocked the save. Nothing was applied.'}}
 data=next;bulkStorageUndoState=null;backupChanged();render();return{ok:true};
}

// Bulk storage updates: single localStorage transaction; last-batch undo is session-only.
// This API never modifies n/partial/confirmed/restock, does not touch demo entries,
// and never sends any inventory over the network.
function bulkStoragePreview(codes,change){
 const B=root.FlossFoxBulkStorageCore;
 if(!B)throw new Error('Bulk storage helper is unavailable.');
 return B.prepare(data.threads,codes,change);
}
function bulkStorageApply(codes,change,expected){
 if(!canSave)return{ok:false,error:'Collection saving is paused or unavailable.'};
 let candidate;try{candidate=bulkStoragePreview(codes,change)}catch(e){return{ok:false,error:e.message}}
 if(candidate.signature!==expected)return{ok:false,error:'Your collection or selection has changed. Review the locations again.'};
 if(!candidate.changes.length)return{ok:false,error:'No location changes are needed.'};
 const B=root.FlossFoxBulkStorageCore,at=new Date().toISOString();
 const next={...data,threads:B.applyCopy(data.threads,candidate,at)};
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch(e){return{ok:false,error:'Your browser blocked the save. Nothing was applied.'}}
 data=next;bulkStorageUndoState={changes:candidate.changes,at};backupChanged();render();
 return{ok:true,changed:candidate.changes.length};
}
function bulkStorageUndo(){
 const undo=bulkStorageUndoState;
 if(!undo)return{ok:false,error:'There\'s no storage change to undo.'};
 if(!canSave)return{ok:false,error:'Saving is paused, so the undo can\'t be saved.'};
 const B=root.FlossFoxBulkStorageCore;
 for(const c of undo.changes){const e=data.threads[c.code];
  if(!e||e.updated!==undo.at||!B.equal(B.normalize(e.storage),c.after)){
   bulkStorageUndoState=null;
   return{ok:false,error:'One of these threads changed since then, so undoing isn\'t safe anymore.'};
  }
 }
 const next={...data,threads:B.reverseCopy(data.threads,undo.changes)};
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch(e){return{ok:false,error:'Your browser blocked the undo. Nothing was changed.'}}
 data=next;bulkStorageUndoState=null;backupChanged();render();return{ok:true,changed:undo.changes.length};
}

window.FlossFoxThreadsUI={setStorageLocation,bulkStoragePreview,bulkStorageApply,bulkStorageUndo,bulkCanUndo:()=>!!bulkStorageUndoState,render,data:()=>data,KEY,TIPKEY,tip,tipDone:n=>tipSeen.add(n),reload:()=>{data=C.empty();canSave=true;mem=false;msg('');load();render()},canSave:()=>canSave,
 compare:(items,o)=>C.compare(items,data,o),count:o=>Object.keys(o&&o.demo?data.demo||{}:data.threads).length,core:C,leaveView,removeDemo,
 exportData:()=>({schema:C.SCHEMA,threads:JSON.parse(JSON.stringify(data.threads))}),replaceAll:d=>{const keep=data.demo;data={schema:C.SCHEMA,threads:d.threads};if(keep)data.demo=keep;canSave=true;mem=false;msg('');const ok=save();render();return ok},
 addItems:(items,o)=>{const r=C.add(data,items,o);const ok=save();render();return{...r,saved:ok}},set:(code,f,o)=>{const e=(o&&o.demo?data.demo||{}:data.threads)[code];if(!e)return;Object.assign(e,f);save();render()}};
$('thAddBtn').onclick=addNow;$('thAdd').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!/\n/.test($('thAdd').value)){e.preventDefault();addNow()}});
$('thSearch').oninput=()=>{q=$('thSearch').value;filter()};
/* Flow pass item 4: add the colors a project says you have enough of. Shows the count first, never touches colors already
   in the collection, skips demo projects, and keeps one Undo that removes exactly what it added (if you haven't changed it since). */
const haveNew=p=>{const seen=new Set();return(p&&!p.demo?p.items:[]).filter(it=>{const d=p.decisions[it.code];if(!d||!(d.status==='have'||d.recv)||data.threads[it.code]||seen.has(it.code))return false;seen.add(it.code);return true})};
let fromUndo=null;
function addFromProjects(ids){const P=window.FlossFoxProjects&&FlossFoxProjects._store();if(!P)return{added:[]};const added={};
 P.projects.filter(p=>!p.demo&&(!ids||ids.includes(p.id))).forEach(p=>haveNew(p).forEach(it=>{if(data.threads[it.code])return;const d=p.decisions[it.code],ex=d.owned!==null&&d.owned!==undefined,own=ex?Math.floor(d.owned):(it.qty||1);data.threads[it.code]={n:Math.min(999,own),partial:ex&&d.owned%1>0,restock:false,updated:new Date().toISOString(),...(ex&&d.ownedSource!=='unverified'?{confirmed:true}:{})};added[it.code]=JSON.stringify(data.threads[it.code])}));
 const codes=Object.keys(added);if(codes.length){fromUndo=added;save();render()}return{added:codes}}
function undoFromProjects(){if(!fromUndo)return 0;let n=0;for(const [c,snap] of Object.entries(fromUndo))if(data.threads[c]&&JSON.stringify(data.threads[c])===snap){delete data.threads[c];n++}fromUndo=null;save();render();return n}
function fromProjectsCount(ids){const P=window.FlossFoxProjects&&FlossFoxProjects._store();if(!P)return 0;const s=new Set();P.projects.filter(p=>!p.demo&&(!ids||ids.includes(p.id))).forEach(p=>haveNew(p).forEach(it=>s.add(it.code)));return s.size}
Object.assign(window.FlossFoxThreadsUI,{addFromProjects,undoFromProjects,fromProjectsCount,canUndoFrom:()=>!!fromUndo});
$('thImport').onclick=()=>{const r=addFromProjects(null),a=r.added.length;
 say(a?`Added ${a} color${a===1?'':'s'} you marked Have enough (or received) in your projects. Colors already in your collection were left alone.`:'Nothing new to add from your projects.');if(window.FlossFoxFlow)FlossFoxFlow.offerUndo(a)};
const bk=$('thBackup');if(bk)bk.onclick=()=>{const P=window.FlossFoxProjects;if(P&&P.backup){P.backup();say('Backup downloaded (projects and thread collection).')}};
const rs=$('thRestore');if(rs)rs.onclick=()=>{const P=window.FlossFoxProjects;if(!P)return;P.showView('projects');$('backupBox').open=true;$('backupBox').scrollIntoView({block:'nearest'});$('restoreFile').click()};
render();
})(this);
