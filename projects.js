// Floss Fox projects: saved locally in this browser. User-entered data lives in `store`;
// conversions, plans and price estimates are always recomputed and never stored.
(function(){
'use strict';
const KEY='flossfox.v1',SCHEMA=2,STATUSES=['have','check','buy'];
let store={schema:SCHEMA,projects:[]},canSave=true,openId=null,pendingRestore=null;
const nowISO=()=>new Date().toISOString();
const newId=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const str=(v,max)=>typeof v==='string'?v.slice(0,max):'';
function storeMsg(html){const el=$('storeMsg');el.innerHTML=html||'';el.hidden=!html}
function pstatus(t){$('projStatus').textContent=t}

// ---- Validation / migration (used for localStorage and backup restore) ----
function normItem(it){if(!it||typeof it!=='object'||typeof it.code!=='string'||!DMC[it.code])return null;
 const q=it.qty===null?null:(Number.isInteger(it.qty)&&it.qty>=1?it.qty:undefined);if(q===undefined)return null;
 return{code:it.code,qty:q,stated:it.stated!==false,src:Array.isArray(it.src)?it.src.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,200)):[]}}
function normDecision(code,d){d=d&&typeof d==='object'?d:{};const out={status:STATUSES.includes(d.status)?d.status:null,
 owned:(typeof d.owned==='number'&&isFinite(d.owned)&&d.owned>=0)?Math.round(d.owned*100)/100:null,
 anchor:(typeof d.anchor==='string'&&DMC[code].anchor.includes(d.anchor))?d.anchor:null,
 recv:null};const v=d.recv;
 if(v&&typeof v==='object'&&BRAND[v.brand]&&typeof v.to==='string'&&v.to.length<=20&&typeof v.qty==='number'&&isFinite(v.qty)&&v.qty>0&&v.qty<=1000)out.recv={brand:v.brand,to:v.to,qty:Math.round(v.qty*100)/100};return out}
function normProject(p){if(!p||typeof p!=='object'||typeof p.id!=='string'||!p.id||p.id.length>80||!Array.isArray(p.items))return null;
 const items=[],dec={};
 for(const raw of p.items){const it=normItem(raw);if(!it)return null;const ex=items.find(i=>i.code===it.code);
  if(ex){ex.qty=(ex.qty===null||it.qty===null)?null:ex.qty+it.qty;ex.src=ex.src.concat(it.src)}else items.push(it)}
 items.forEach(it=>dec[it.code]=normDecision(it.code,p.decisions&&p.decisions[it.code]));
 const purchased={};if(p.purchased&&typeof p.purchased==='object')for(const k of Object.keys(p.purchased))if(p.purchased[k]===true&&k.length<40)purchased[k]=true;
 return{id:p.id,name:str(p.name,100).trim()||'Untitled project',notes:str(p.notes,2000),buyBrand:BRAND[p.buyBrand]?p.buyBrand:'dmc',
  items,decisions:dec,purchased,created:str(p.created,40)||nowISO(),updated:str(p.updated,40)||nowISO()}}
function migrate(d){ // returns {data, skipped} or null if not Floss Fox data
 if(!d||typeof d!=='object'||!Array.isArray(d.projects))return null;
 const ver=d.schema===undefined?1:d.schema;if(typeof ver!=='number'||ver>SCHEMA)return{tooNew:true};
 // Migrations: v1 -> v2 adds decisions[code].recv (received purchase record, default null).
 // normProject/normDecision fill the default, so v1 data and v1 backups load unchanged otherwise.
 const seen=new Set(),projects=[];let skipped=0;
 for(const raw of d.projects){const p=normProject(raw);if(!p||seen.has(p.id)){skipped++;continue}seen.add(p.id);projects.push(p)}
 return{data:{schema:SCHEMA,projects},skipped}}

// ---- Storage ----
function load(){let raw;
 try{raw=localStorage.getItem(KEY)}catch(e){canSave=false;storeMsg('<b>Saving is unavailable in this browser</b> (private mode or storage blocked). Projects will only last until this tab closes. Use <b>Download backup</b> to keep them.');return}
 if(raw===null)return;let d;
 try{d=JSON.parse(raw)}catch(e){d=null}
 const m=d&&migrate(d);
 if(!m||m.tooNew){canSave=false;try{localStorage.setItem(KEY+'.unreadable-'+Date.now(),raw)}catch(e){}
  storeMsg(m&&m.tooNew?'<b>Your saved projects were made by a newer version of Floss Fox.</b> They are left untouched; saving is paused so nothing is overwritten. Reload the latest version of the page.':'<b>Saved project data couldn\'t be read.</b> It was left untouched (a copy was kept) and saving is paused so nothing is overwritten. You can restore a backup, or <button type="button" class="sec" id="resetStore">start fresh</button>.');
  const r=$('resetStore');if(r)r.onclick=()=>{if(confirm('Start fresh? The unreadable data stays in browser storage under a separate name, but Floss Fox will no longer show it.')){canSave=true;store={schema:SCHEMA,projects:[]};save();storeMsg('');renderList()}};return}
 store=m.data;if(m.skipped)storeMsg(`${m.skipped} saved project(s) were damaged and skipped.`)}
function save(){if(!canSave){pstatus('Not saved: browser storage is unavailable or paused. Download a backup to keep your work.');return false}
 try{localStorage.setItem(KEY,JSON.stringify(store));return true}
 catch(e){const full=e&&(e.name==='QuotaExceededError'||e.code===22);pstatus(full?'Not saved: browser storage is full. Download a backup, then delete old projects.':'Not saved: browser storage refused the change. Download a backup to keep your work.');return false}}
const proj=id=>store.projects.find(p=>p.id===id);
function touch(p){p.updated=nowISO();save()}

// ---- Plan: derived only (never stored) ----
function plan(p){const dest=p.buyBrand,threads=[];
 // Per-thread state (derived, deterministic): have | received | buy | awaiting | review
 p.items.forEach(it=>{const d=p.decisions[it.code],r=resolve(it,dest,d.anchor),req=it.qty,own=d.owned;const t={it,d,r,state:'review',why:'',q:0,rem:0,recv:0,recvOther:false};threads.push(t);
  const needsPick=dest==='anchor'&&fam(it.code)==='solid'&&!d.anchor&&(r.review||DMC[it.code].anchor.length>1);
  if(needsPick){t.why=r.review?'disputed Anchor white mapping: choose which Anchor thread in Details (substitution not approved yet)':`several Anchor chart options: choose one in Details (substitution not approved yet)`;return}
  if(d.status==='have'){if(req===null)t.why='marked Have, but the quantity needed is UNKNOWN, so "enough" can\'t be confirmed. Enter the needed amount in Details';else if(own!==null&&own<req)t.why=`marked Have, but recorded ${own} owned is less than ${req} needed`;else t.state='have';return}
  if(d.status==='check'){t.why=`Check: confirm you have enough${own!==null?` (recorded ${own} owned)`:''}${req===null?'; quantity needed is UNKNOWN':''}`;return}
  if(d.status!=='buy'){t.why='not checked yet: choose Have, Check or Buy';return}
  if(!r.ok){t.why=r.why;return}
  if(req===null){t.why='Buy: quantity needed is UNKNOWN, so the amount to buy can\'t be worked out';return}
  t.q=own===null?req:Math.ceil(req-own-1e-9);
  if(t.q<=0){t.why=`marked Buy, but recorded ${own} owned covers the ${req} needed; mark Have?`;return}
  if(d.recv){if(d.recv.brand===dest&&d.recv.to===r.to)t.recv=d.recv.qty;else t.recvOther=true}
  t.rem=Math.max(0,Math.ceil(t.q-t.recv-1e-9));t.state=t.rem<=0?'received':'buy'});
 const groups={};threads.filter(t=>t.state==='buy').forEach(t=>{const g=groups[t.r.to]||(groups[t.r.to]={to:t.r.to,q:0,from:[],prov:new Set(),partial:false,recvd:0,ts:[]});g.q+=t.rem;g.from.push(t.it.code);g.prov.add(t.r.prov);g.partial=g.partial||t.d.owned!==null;g.recvd+=t.recv;g.ts.push(t)});
 const lines=Object.values(groups).map(g=>{const key=dest+':'+g.to,bought=!!p.purchased[key];if(bought)g.ts.forEach(t=>t.state='awaiting');return{...g,key,bought}});
 const by=st=>threads.filter(t=>st.includes(t.state));
 const sum={sufficient:by(['have','received']).length,toBuy:by(['buy']).length,awaiting:by(['awaiting']).length,review:by(['review']).length,total:threads.length};
 return{dest,threads,lines,review:by(['review']),have:by(['have','received']),sum,ready:sum.total>0&&sum.sufficient===sum.total}}
function costLine(P){const p=PRICES[P.dest];let k=0,unpriced=0;P.lines.forEach(l=>{if(l.from.every(c=>fam(c)==='solid'))k+=l.q;else unpriced++});
 if(!P.lines.length)return'No purchases left to make.';
 return`Still to buy or awaiting receipt: ${P.lines.reduce((a,l)=>a+l.q,0)} skein(s), est. ≈ ${rng(p.lo*k,p.hi*k)} USD${unpriced?` (+${unpriced} unpriced specialty line(s))`:''}. Items still in review are not included. Rough estimate (prices checked ${PRICES.checked}).`}
const lineTxt=(P,l)=>`${BRAND[P.dest]} ${disp(P.dest,l.to)} x${l.q} (for DMC ${l.from.map(lab).join(', ')}; ${[...l.prov].join('; ')}${l.partial?'; after subtracting owned, rounded up to whole skeins':''}${l.recvd?`; ${l.recvd} already received`:''})${l.from.length>1?' ⚠ several pattern colours share this thread':''}`;
function planText(p){const P=plan(p),o=[`${APP_NAME} project: ${p.name}`,`Buying in: ${BRAND[P.dest]}`,readyText(P,p),summaryText(P),''];
 const tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought);
 o.push('TO BUY:');if(!tb.length)o.push('- none');tb.forEach(l=>o.push('[ ] '+lineTxt(P,l)));
 o.push('','BOUGHT, AWAITING RECEIPT CHECK (not ready until confirmed):');if(!aw.length)o.push('- none');aw.forEach(l=>o.push('[x] '+lineTxt(P,l)));
 o.push('','NEEDS REVIEW (not on the buy list):');if(!P.review.length)o.push('- none');P.review.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (need ${x.it.qty===null?'UNKNOWN':x.it.qty}): ${x.why}`));
 o.push('','CONFIRMED SUFFICIENT:');if(!P.have.length)o.push('- none');P.have.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (need ${x.it.qty===null?'UNKNOWN':x.it.qty}${x.d.owned!==null?`, owned ${x.d.owned}`:''}${x.state==='received'?`, received ${x.recv} ${BRAND[P.dest]} ${disp(P.dest,x.r.to)}`:', already owned'})`));
 if(p.notes)o.push('','Notes: '+p.notes);o.push('',costLine(P));return o.join('\n')}
function summaryText(P){const s=P.sum;return`Confirmed sufficient ${s.sufficient} of ${s.total} · left to buy ${s.toBuy} · bought, awaiting confirmation ${s.awaiting} · needs review ${s.review}`}
function readyText(P,p){if(!p.items.length)return'No threads in this project yet.';return P.ready?'Ready to start: every thread is confirmed sufficient.':`Not ready yet: ${P.sum.toBuy} thread(s) to buy, ${P.sum.awaiting} bought awaiting confirmation, ${P.sum.review} to review.`}
function receive(p,key,n){const P=plan(p),l=P.lines.find(x=>x.key===key);if(!l)return'';let left=n;
 l.ts.forEach(t=>{const take=Math.min(left,t.rem);if(take>0){const prev=(t.d.recv&&t.d.recv.brand===P.dest&&t.d.recv.to===t.r.to)?t.d.recv.qty:0;t.d.recv={brand:P.dest,to:t.r.to,qty:prev+take};left-=take}});
 delete p.purchased[key];touch(p);return n>=l.q?`Received ${n}: ${BRAND[P.dest]} ${disp(P.dest,l.to)} is now confirmed sufficient.`:`Received ${n} of ${l.q}: ${l.q-n} still to buy (moved back to "To buy").`}

// ---- Rendering ----
function renderList(){const L=$('projList');$('projCount').textContent=store.projects.length?`(${store.projects.length})`:'';
 L.innerHTML=store.projects.length?store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated)).map(p=>{const P=plan(p);
  return`<li><span><b>${esc(p.name)}</b><br><small class="mut">${p.items.length} thread(s) · ${P.ready?'✓ ready to start':`${P.sum.toBuy} to buy, ${P.sum.awaiting} awaiting, ${P.sum.review} to review`} · updated ${esc(p.updated.slice(0,10))}</small></span><span class="row" style="margin:0"><button type="button" class="pri" data-open="${esc(p.id)}">Open</button><button type="button" class="sec" data-del="${esc(p.id)}">Delete</button></span></li>`}).join(''):'<li class="mut">No saved projects yet. Convert a list and choose "Save project", or start an empty one.</li>';
 L.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
 L.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delProject(b.dataset.del))}
function delProject(id){const p=proj(id);if(!p)return;if(!confirm(`Delete the project "${p.name}"? This can't be undone (unless you have a backup).`))return;
 store.projects=store.projects.filter(x=>x.id!==id);save();if(openId===id){openId=null;$('projEdit').hidden=true}renderList();pstatus(`Deleted "${p.name}".`)}
function openProject(id){if(openId!==id){expanded.clear();filt='all'}openId=id;renderEditor();$('projEdit').hidden=false;$('projEdit').scrollIntoView({block:'start'});pstatus(`Opened "${proj(id).name}".`)}
function destCell(p,it){const d=p.decisions[it.code],dest=p.buyBrand,c=it.code,f=fam(c);
 if(dest==='anchor'&&f==='solid'&&DMC[c].anchor.length>1||dest==='anchor'&&(c==='WHITE'||c==='B5200')&&DMC[c].anchor.length){const disputed=c==='WHITE'||c==='B5200';
  return`<select id="anc-${esc(c)}" data-anc="${esc(c)}" aria-label="Anchor choice for DMC ${esc(lab(c))}"><option value=""${d.anchor?'':' selected'}>Choose…${disputed?' (disputed)':' (not approved yet)'}</option>${DMC[c].anchor.map(a=>`<option value="${esc(a)}"${d.anchor===a?' selected':''}>Anchor ${esc(a)}</option>`).join('')}</select>${disputed?`<br><small class="warn">${esc(WHITE_DISPUTE)}</small>`:''}`}
 const r=resolve(it,dest,d.anchor);return r.ok?`<b>${BRAND[dest]} ${esc(disp(dest,r.to))}</b> <small class="mut">${esc(r.prov)}</small>`:`<span class="warn">${esc(r.why)}</span>`}
const expanded=new Set();let filt='all';
const sid=k=>k.replace(/[^\w-]/g,'_');
const IND={have:['✓','Have: confirmed'],received:['✓','Received: confirmed'],buy:['🛒','Buy'],awaiting:['⏳','Bought: confirm on arrival'],review:['⚠','Needs review']};
function card(p,P,t){const it=t.it,d=t.d,c=esc(it.code),e=DMC[it.code],f=fam(it.code),open=expanded.has(it.code),L=esc(lab(it.code));
 const ind=IND[t.state],qty=t.state==='buy'||t.state==='awaiting'?` ${t.rem}`:'';
 return`<li class="tcard st-${t.state}" id="card-${c}"><div class="thead">
 <span class="tname">${sw(e.hex)}<b>DMC ${L}</b>${f!=='solid'?` <span class="tag">${f}</span>`:''}${P.dest!=='dmc'&&t.r.ok?` <span class="mut">→ ${BRAND[P.dest]} ${esc(disp(P.dest,t.r.to))}</span>`:''}<br><small>Need ${it.qty===null?'<span class="unk">UNKNOWN</span>':it.qty}${it.stated===false&&it.qty!==null?' (assumed)':''}</small></span>
 <span class="ind"><span aria-hidden="true">${ind[0]}</span> ${ind[1]}${qty}</span>
 <span class="seg" role="radiogroup" aria-label="Status for DMC ${L}">${STATUSES.map(s=>`<label><input type="radio" name="st-${c}" id="st-${c}-${s}" value="${s}" data-st="${c}" ${d.status===s?'checked':''}><span>${s[0].toUpperCase()+s.slice(1)}</span></label>`).join('')}</span>
 <button type="button" class="sec exp" id="x-${c}" data-exp="${c}" aria-expanded="${open}" aria-controls="det-${c}">${open?'Hide details':'Details'} <span aria-hidden="true">${open?'▾':'▸'}</span><span class="sr"> for DMC ${L}</span></button></div>
 ${t.state==='review'?`<div class="why">${esc(t.why)}</div>`:''}${t.recvOther?'<div class="why">A receipt recorded for a different brand/thread is not counted.</div>':''}
 <div class="tdet" id="det-${c}" ${open?'':'hidden'}>
  <div class="fld"><label for="q-${c}">Needed (skeins)</label><input type="number" class="qbox" id="q-${c}" data-q="${c}" min="1" step="1" inputmode="numeric" value="${it.qty===null?'':it.qty}" ${it.qty===null?'disabled':''}> <label class="inl"><input type="checkbox" id="u-${c}" data-unk="${c}" ${it.qty===null?'checked':''}> <span class="${it.qty===null?'unk':''}">Unknown</span></label></div>
  <div class="fld"><label for="o-${c}">Owned (skeins, optional)</label><input type="number" class="qbox" id="o-${c}" data-own="${c}" min="0" step="0.25" inputmode="decimal" value="${d.owned===null?'':d.owned}" placeholder="?"></div>
  <div class="fld"><span class="flbl">Will use</span>${destCell(p,it)}</div>
  ${it.src.length?`<div class="fld"><small class="mut">From your list: "${it.src.map(esc).join('", "')}"</small></div>`:''}
  ${d.recv?`<div class="fld"><small>Received record: ${d.recv.qty} × ${esc(BRAND[d.recv.brand])} ${esc(disp(d.recv.brand,d.recv.to))}</small> <button type="button" class="sec small" id="rr-${c}" data-rr="${c}">Clear received record</button></div>`:''}
  <div class="fld"><button type="button" class="sec small" id="rm-${c}" data-rm="${c}" aria-label="Remove DMC ${L} from project">Remove thread</button></div></div></li>`}
function renderEditor(){const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}const focusId=document.activeElement&&document.activeElement.id;const P=plan(p);
 const shown=P.threads.filter(t=>filt==='all'||!['have','received'].includes(t.state));
 E.innerHTML=`<div class="noprint"><div class="row" style="justify-content:space-between;margin-top:0"><h2 style="margin:0">Project</h2><span class="row" style="margin:0"><button type="button" class="sec" id="pClose">Close</button><button type="button" class="sec" id="pDelete">Delete project</button></span></div>
 <p><label for="pName"><b>Name</b></label><br><input type="text" id="pName" maxlength="100" value="${esc(p.name)}" style="width:100%"></p>
 <details class="pmore"${p.notes?' open':''}><summary>Notes and brand</summary>
 <p><label for="pNotes"><b>Notes</b> <small class="mut">(optional)</small></label><br><textarea id="pNotes" class="pnotes" maxlength="2000" rows="2" style="width:100%" placeholder="e.g. threads are in the blue bag">${esc(p.notes)}</textarea></p></details>
 <p><label for="pDest"><b>Buy in:</b></label> <select id="pDest">${['dmc','sullivans','anchor'].map(k=>`<option value="${k}"${p.buyBrand===k?' selected':''}>${k==='dmc'?'DMC (original, no substitution)':BRAND[k]}</option>`).join('')}</select></p></div>
 <div id="pSum"></div>
 <div class="noprint" id="pThreads"><h3>Threads</h3>
 <p class="hint"><b>Have</b> = you've confirmed you have enough. <b>Check</b> = you might, but the amount or suitability isn't confirmed. <b>Buy</b> = you need to buy it. Open <b>Details</b> for owned amount, substitution and actions. Floss Fox never assumes a full skein, and an unknown amount never counts as enough.</p>
 <div class="row"><span role="group" aria-label="Filter threads" class="row" style="margin:0"><button type="button" class="sec" id="fAll" aria-pressed="${filt==='all'}">All (${P.threads.length})</button><button type="button" class="sec" id="fOpen" aria-pressed="${filt==='open'}">Not ready (${P.threads.length-P.sum.sufficient})</button></span><button type="button" class="sec" id="pAllBuy">Mark all not-checked as Buy</button></div>
 <ul class="cards">${shown.map(t=>card(p,P,t)).join('')||'<li class="mut">Nothing to show.</li>'}</ul>
 <p><label for="pAdd"><b>Add threads</b> <small class="mut">(same format as Quick convert)</small></label><br><textarea id="pAdd" rows="2" style="width:100%" placeholder="e.g. 3865 x2, 762"></textarea></p>
 <div class="row"><button type="button" class="sec" id="pAddBtn">Add to project</button></div><div id="pAddErr"></div></div>
 <div class="plan" id="pPlan"></div>`;
 bindEditor(p);renderPlan(p,P);if(focusId){const f=document.getElementById(focusId);if(f)f.focus()}}
function renderPlan(p,P){P=P||plan(p);const s=P.sum,tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought);
 const li=l=>`<b>${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</b> × ${l.q} <small class="mut">(for DMC ${l.from.map(c=>esc(lab(c))).join(', ')} · ${[...l.prov].map(esc).join('; ')}${l.partial?' · after subtracting owned, rounded up':''}${l.recvd?` · ${l.recvd} already received`:''})</small>`;
 const mw=l=>l.from.length>1?'<div class="warn small">⚠ Several pattern colours map to this one thread. Check that\'s what you want.</div>':'';
 $('pSum').innerHTML=`<h2 class="printonly">${esc(APP_NAME)}: ${esc(p.name)}</h2><p class="printonly">Buying in: ${esc(BRAND[P.dest])}</p>
 <div class="psum" id="pSummary"><p class="ready ${P.ready?'':'no'}" role="status" aria-live="polite"><span aria-hidden="true">${P.ready?'✓':'✗'}</span> ${esc(readyText(P,p))}</p>
 <dl class="sumgrid"><div><dt>Confirmed sufficient</dt><dd id="sSuf">${s.sufficient} / ${s.total}</dd></div><div><dt>Left to buy</dt><dd id="sBuy">${s.toBuy}</dd></div><div><dt>Bought, awaiting check</dt><dd id="sAw">${s.awaiting}</dd></div><div><dt>Needs review</dt><dd id="sRev">${s.review}</dd></div></dl>
 <nav class="jump noprint" aria-label="Jump to"><a href="#pThreads">Threads</a><a href="#pReviewH">Needs review (${s.review})</a><a href="#pShopH">Shopping list (${P.lines.length})</a></nav></div>`;
 $('pPlan').innerHTML=`<h3 id="pShopH" tabindex="-1">Shopping list</h3><h4>To buy</h4><ul>${tb.map(l=>`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}"> ${li(l)}</label>${mw(l)}</li>`).join('')||'<li class="mut">Nothing left to buy.</li>'}</ul>
 <h4>Bought, awaiting receipt check</h4><p class="hint">Ticking "bought" is shopping progress only. A thread counts as ready only after you confirm what actually arrived.</p><ul>${aw.map(l=>{const k=sid(l.key);return`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}" checked> ${li(l)}</label>${mw(l)}
  <div class="noprint"><button type="button" class="sec small" id="rb-${k}" data-rb="${esc(l.key)}">Mark received and ready…</button>
  <div class="rform" id="rf-${k}" hidden><label for="rq-${k}">How many skeins of ${BRAND[P.dest]} ${esc(disp(P.dest,l.to))} actually arrived? (${l.q} outstanding)</label><br><input type="number" id="rq-${k}" min="1" step="1" inputmode="numeric" class="qbox"> <button type="button" class="pri small" id="rc-${k}" data-rc="${esc(l.key)}">Confirm received</button> <button type="button" class="sec small" data-rx="${k}">Cancel</button></div></div></li>`}).join('')||'<li class="mut">None.</li>'}</ul>
 <h3 id="pReviewH" tabindex="-1">Needs review (not on the buy list)</h3><ul>${P.review.map(x=>`<li>DMC ${esc(lab(x.it.code))} · need ${x.it.qty===null?'<span class="unk">UNKNOWN</span>':x.it.qty}: ${esc(x.why)}</li>`).join('')||'<li class="mut">Nothing to review.</li>'}</ul>
 <h3>Confirmed sufficient</h3><ul>${P.have.map(x=>`<li>DMC ${esc(lab(x.it.code))} · need ${x.it.qty===null?'<span class="unk">UNKNOWN</span>':x.it.qty}${x.d.owned!==null?` · owned ${x.d.owned}`:''} · ${x.state==='received'?`received ${x.recv} ${BRAND[P.dest]} ${esc(disp(P.dest,x.r.to))}`:'already owned'}</li>`).join('')||'<li class="mut">None yet.</li>'}</ul>
 ${p.notes?`<p class="printonly"><b>Notes:</b> ${esc(p.notes)}</p>`:''}<div class="totals">${esc(costLine(P))}</div>
 <div class="row noprint"><button type="button" class="pri" id="pPrint">Print plan</button><button type="button" class="sec" id="pCopy">Copy as text</button><button type="button" class="sec" id="pCsv">Download CSV</button></div>
 <p id="pMsg" class="hint" role="status" aria-live="polite"></p><textarea id="pFallback" class="noprint" hidden readonly aria-label="Project plan text to copy" style="width:100%;min-height:120px"></textarea>`;
 const el=$('pPlan'),re=msg=>{renderEditor();renderList();if(msg)$('pMsg').textContent=msg};
 el.querySelectorAll('[data-bought]').forEach(cb=>cb.onchange=()=>{if(cb.checked)p.purchased[cb.dataset.bought]=true;else delete p.purchased[cb.dataset.bought];touch(p);re(cb.checked?'Marked bought. Confirm the amount when it arrives.':'Moved back to To buy.')});
 el.querySelectorAll('[data-rb]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rb);$('rf-'+k).hidden=false;$('rq-'+k).focus()});
 el.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{$('rf-'+b.dataset.rx).hidden=true});
 el.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rc),v=$('rq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('pMsg').textContent='Enter the whole number of skeins that actually arrived (1 or more). Nothing changed.';return}re(receive(p,b.dataset.rc,+v))});
 $('pPrint').onclick=()=>print();$('pCopy').onclick=async()=>{const t=planText(p);try{if(!navigator.clipboard)throw 0;await navigator.clipboard.writeText(t);$('pMsg').textContent='✓ Copied to clipboard.';$('pFallback').hidden=true}catch(e){$('pMsg').textContent="Couldn't copy automatically. Select the text below and copy it.";const f=$('pFallback');f.value=t;f.hidden=false;f.focus();f.select()}};
 $('pCsv').onclick=()=>download(csv(p),safe(p.name)+'.csv','text/csv')}
function bindEditor(p){const E=$('projEdit'),re=()=>{touch(p);renderEditor();renderList()};
 $('pClose').onclick=()=>{openId=null;E.hidden=true};$('pDelete').onclick=()=>delProject(p.id);
 $('pName').onchange=()=>{p.name=$('pName').value.trim().slice(0,100)||'Untitled project';touch(p);renderList();renderPlan(p)};
 $('pNotes').onchange=()=>{p.notes=$('pNotes').value.slice(0,2000);touch(p);renderPlan(p)};
 $('pDest').onchange=()=>{p.buyBrand=$('pDest').value;re()};
 $('fAll').onclick=()=>{filt='all';renderEditor()};$('fOpen').onclick=()=>{filt='open';renderEditor()};
 $('pAllBuy').onclick=()=>{let n=0;p.items.forEach(it=>{if(!p.decisions[it.code].status){p.decisions[it.code].status='buy';n++}});re();pstatus(`${n} thread(s) marked Buy.`)};
 E.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>{const c=b.dataset.exp;if(expanded.has(c))expanded.delete(c);else expanded.add(c);renderEditor()});
 E.querySelectorAll('[data-st]').forEach(r=>r.onchange=()=>{p.decisions[r.dataset.st].status=r.value;re()});
 E.querySelectorAll('[data-anc]').forEach(s=>s.onchange=()=>{p.decisions[s.dataset.anc].anchor=s.value||null;re()});
 E.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{p.decisions[b.dataset.rr].recv=null;re();pstatus('Received record cleared.')});
 E.querySelectorAll('[data-q]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),it=p.items.find(x=>x.code===i.dataset.q);
  if(!/^\d+$/.test(v)||+v<1){pstatus(`"${v}" isn't a whole number of skeins (1 or more). Unchanged. Tick Unknown if you don't know.`);i.value=it.qty===null?'':it.qty;return}it.qty=+v;it.stated=true;re()});
 E.querySelectorAll('[data-unk]').forEach(c=>c.onchange=()=>{const it=p.items.find(x=>x.code===c.dataset.unk);if(c.checked){it.qty=null;it.stated=true}else{it.qty=1;it.stated=false;pstatus('Quantity set to 1 (assumed). Enter the real number.')}re()});
 E.querySelectorAll('[data-own]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),d=p.decisions[i.dataset.own];
  if(v===''){d.owned=null;re();return}const n=Number(v);if(!isFinite(n)||n<0){pstatus(`"${v}" isn't a valid owned amount. Unchanged.`);i.value=d.owned===null?'':d.owned;return}d.owned=Math.round(n*100)/100;re()});
 E.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const c=b.dataset.rm;if(!confirm(`Remove DMC ${lab(c)} from this project?`))return;p.items=p.items.filter(x=>x.code!==c);delete p.decisions[c];expanded.delete(c);re()});
 $('pAddBtn').onclick=()=>{const {items,errs}=parse($('pAdd').value);items.forEach(n=>{const ex=p.items.find(x=>x.code===n.code);
  if(ex){ex.qty=(ex.qty===null||n.qty===null)?null:ex.qty+n.qty;ex.src=ex.src.concat(n.src);ex.stated=ex.stated||n.stated}else{p.items.push({code:n.code,qty:n.qty,stated:n.stated,src:n.src});p.decisions[n.code]=normDecision(n.code,{})}});
  touch(p);renderEditor();renderList();$('pAddErr').innerHTML=errs.length?`<div class="errbox"><b>Couldn't add ${errs.length}:</b><ul>${errs.map(e=>`<li>"${esc(e.t)}": ${esc(e.why)}</li>`).join('')}</ul></div>`:'';if(errs.length)$('pAdd').value=errs.map(e=>e.t).join('\n');pstatus(`Added ${items.length} thread(s).`)}}

// ---- Export / backup / restore ----
const safe=n=>(n||'project').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'project';
function download(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function csv(p){const P=plan(p),q=v=>{v=v===null||v===undefined?'':String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const SN={have:'confirmed sufficient (owned)',received:'confirmed sufficient (received)',buy:'to buy',awaiting:'bought, awaiting confirmation',review:'needs review'};
 const rows=[['project','dmc_code','dmc_name','needed_skeins','quantity_stated','status','owned_skeins','buy_in','will_use','source','to_buy_skeins','bought','received_skeins','readiness','issue']];
 P.threads.forEach(t=>{const it=t.it,d=t.d,r=t.r,line=P.lines.find(l=>l.from.includes(it.code));
  rows.push([p.name,lab(it.code),DMC[it.code].name,it.qty===null?'UNKNOWN':it.qty,it.stated===false?'assumed':'yes',d.status||'not checked',d.owned===null?'':d.owned,BRAND[P.dest],r.ok?disp(P.dest,r.to):'',r.ok?r.prov:'',line?t.rem+(line.from.length>1?` (shared line total ${line.q})`:''):'',line?(line.bought?'yes':'no'):'',t.recv||'',SN[t.state],t.why])});
 return rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n'}
function backup(){const d={app:'floss-fox',schema:SCHEMA,exported:nowISO(),projects:store.projects};download(JSON.stringify(d,null,2),'floss-fox-backup-'+nowISO().slice(0,10)+'.json','application/json');pstatus(`Backup downloaded with ${store.projects.length} project(s). Keep the file somewhere safe.`)}
function restoreFile(file){const R=$('restorePanel');if(!file)return;if(file.size>5e6){R.hidden=false;R.innerHTML='<b class="warn">That file is too large to be a Floss Fox backup.</b>';return}
 file.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){d=null}const m=d&&d.app==='floss-fox'?migrate(d):null;
  if(!m||m.tooNew){pendingRestore=null;R.hidden=false;R.innerHTML=`<b class="warn">${m&&m.tooNew?'This backup was made by a newer version of Floss Fox and can\'t be restored here.':'This file isn\'t a valid Floss Fox backup. Nothing was changed.'}</b>`;pstatus('Restore failed: nothing changed.');return}
  pendingRestore=m.data.projects;const clash=pendingRestore.filter(p=>proj(p.id)).length;R.hidden=false;
  R.innerHTML=`<p><b>Backup contains ${pendingRestore.length} project(s)</b>${m.skipped?`; ${m.skipped} damaged or duplicate entr${m.skipped>1?'ies were':'y was'} skipped`:''}. ${clash?`${clash} already exist here (same project).`:'None of them already exist here.'}</p>
  ${clash?`<fieldset><legend>For projects that already exist:</legend><label><input type="radio" name="rmode" value="replace" checked> Replace mine with the backup version</label><br><label><input type="radio" name="rmode" value="skip"> Keep mine, skip those</label><br><label><input type="radio" name="rmode" value="copy"> Keep both (import as a renamed copy)</label></fieldset>`:''}
  <div class="row"><button type="button" class="pri" id="rGo">Restore</button><button type="button" class="sec" id="rCancel">Cancel</button></div>`;
  $('rCancel').onclick=()=>{pendingRestore=null;R.hidden=true;pstatus('Restore cancelled.')};
  $('rGo').onclick=()=>{const modeEl=document.querySelector('input[name=rmode]:checked'),mode=modeEl?modeEl.value:'replace';let add=0,rep=0,skip=0,cp=0;
   pendingRestore.forEach(p=>{const i=store.projects.findIndex(x=>x.id===p.id);if(i<0){store.projects.push(p);add++}else if(mode==='replace'){store.projects[i]=p;rep++}else if(mode==='skip')skip++;else{store.projects.push({...p,id:newId(),name:(p.name+' (restored copy)').slice(0,100)});cp++}});
   pendingRestore=null;R.hidden=true;const ok=save();renderList();if(openId)renderEditor();pstatus(`Restore ${ok?'done':'applied but NOT saved'}: ${add} added, ${rep} replaced, ${skip} skipped, ${cp} copied.`)}})
  .catch(()=>{R.hidden=false;R.innerHTML='<b class="warn">Couldn\'t read that file.</b>'})}

// ---- Wiring ----
function showView(v){const proj=v==='projects';$('convertView').hidden=proj;$('projectsView').hidden=!proj;$('tabConvert').setAttribute('aria-pressed',String(!proj));$('tabProjects').setAttribute('aria-pressed',String(proj));if(proj)renderList()}
$('tabConvert').onclick=()=>showView('convert');$('tabProjects').onclick=()=>showView('projects');
$('newEmpty').onclick=()=>{const p={id:newId(),name:'Untitled project',notes:'',buyBrand:'dmc',items:[],decisions:{},purchased:{},created:nowISO(),updated:nowISO()};store.projects.push(p);save();renderList();openProject(p.id)};
$('backupBtn').onclick=backup;$('restoreFile').onchange=e=>{restoreFile(e.target.files[0]);e.target.value=''};
$('saveProj').onclick=()=>{if(!state.items.length){$('copymsg').textContent='Nothing to save: convert a list first.';return}
 const p={id:newId(),name:($('newProjName').value.trim()||'Untitled project').slice(0,100),notes:'',buyBrand:$('dest').value,items:state.items.map(i=>({code:i.code,qty:i.qty,stated:i.stated!==false,src:i.src.slice()})),decisions:{},purchased:{},created:nowISO(),updated:nowISO()};
 p.items.forEach(i=>p.decisions[i.code]=normDecision(i.code,{anchor:choice[i.code]||null}));store.projects.push(p);const ok=save();
 $('copymsg').textContent=ok?`✓ Saved "${p.name}" in this browser. Open it in My projects to mark Have / Check / Buy.`:`Saved for this session only: browser storage isn't available. Use My projects → Download backup.`;renderList()};
load();renderList();
window.FlossFoxProjects={plan,planText,csv,migrate,_store:()=>store}; // for tests and debugging
})();
