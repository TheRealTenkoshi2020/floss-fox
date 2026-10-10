// Floss Fox projects: saved locally in this browser. User-entered data lives in `store`;
// conversions, plans and price estimates are always recomputed and never stored.
(function(){
'use strict';
const KEY='flossfox.v1',SCHEMA=1,STATUSES=['have','check','buy'];
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
 anchor:(typeof d.anchor==='string'&&DMC[code].anchor.includes(d.anchor))?d.anchor:null};return out}
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
 // schema 1 is the first version; future migrations go here (ver 1 -> 2 ...).
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
function plan(p){const dest=p.buyBrand,buy=[],review=[],have=[];
 p.items.forEach(it=>{const d=p.decisions[it.code],r=resolve(it,dest,d.anchor),req=it.qty,own=d.owned;
  const row={it,d,r};
  if(d.status==='have'){if(own!==null&&req!==null&&own<req)review.push({...row,why:`marked Have, but recorded ${own} owned is less than ${req} needed`});else have.push(row);return}
  if(d.status==='check'){review.push({...row,why:`Check: confirm you have enough${own!==null?` (recorded ${own} owned)`:''}${req===null?'; quantity needed is UNKNOWN':''}`});return}
  if(d.status!=='buy'){review.push({...row,why:'not checked yet: choose Have, Check or Buy'});return}
  if(!r.ok){review.push({...row,why:r.why});return}
  if(req===null){review.push({...row,why:'Buy: quantity needed is UNKNOWN, so the amount to buy can\'t be worked out'});return}
  const q=own===null?req:Math.ceil(req-own-1e-9);
  if(q<=0){review.push({...row,why:`marked Buy, but recorded ${own} owned covers the ${req} needed; mark Have?`});return}
  buy.push({...row,q,partial:own!==null})});
 const groups={};buy.forEach(b=>{const g=groups[b.r.to]||(groups[b.r.to]={to:b.r.to,q:0,from:[],prov:new Set(),partial:false});g.q+=b.q;g.from.push(b.it.code);g.prov.add(b.r.prov);g.partial=g.partial||b.partial});
 const lines=Object.values(groups).map(g=>({...g,key:dest+':'+g.to,bought:!!p.purchased[dest+':'+g.to]}));
 return{dest,lines,review,have,ready:!lines.length&&!review.length&&have.length===p.items.length&&p.items.length>0}}
function costLine(P){const p=PRICES[P.dest];let k=0,unpriced=0;P.lines.forEach(l=>{if(l.from.every(c=>fam(c)==='solid'))k+=l.q;else unpriced++});
 if(!P.lines.length)return'No confirmed purchases yet.';
 return`Confirmed purchases: ${P.lines.reduce((a,l)=>a+l.q,0)} skein(s), est. ≈ ${rng(p.lo*k,p.hi*k)} USD${unpriced?` (+${unpriced} unpriced specialty line(s))`:''}. Items still in review are not included. Rough estimate (prices checked ${PRICES.checked}).`}
function planText(p){const P=plan(p),o=[`${APP_NAME} project: ${p.name}`,`Buying in: ${BRAND[P.dest]}`,readyText(P,p),''];
 o.push('TO BUY (confirmed):');if(!P.lines.length)o.push('- none');P.lines.forEach(l=>o.push(`[${l.bought?'x':' '}] ${BRAND[P.dest]} ${disp(P.dest,l.to)} x${l.q} (for DMC ${l.from.map(lab).join(', ')}; ${[...l.prov].join('; ')}${l.partial?'; after subtracting owned, rounded up to whole skeins':''})${l.from.length>1?' ⚠ several pattern colours share this thread':''}`));
 o.push('','NEEDS REVIEW (not on the buy list):');if(!P.review.length)o.push('- none');P.review.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (need ${x.it.qty===null?'UNKNOWN':x.it.qty}): ${x.why}`));
 o.push('','HAVE (you confirmed enough):');if(!P.have.length)o.push('- none');P.have.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (need ${x.it.qty===null?'UNKNOWN':x.it.qty}${x.d.owned!==null?`, owned ${x.d.owned}`:''})`));
 if(p.notes)o.push('','Notes: '+p.notes);o.push('',costLine(P));return o.join('\n')}
function readyText(P,p){if(!p.items.length)return'No threads in this project yet.';return P.ready?'Ready to start: you marked every thread as Have.':`Not ready yet: ${P.lines.length} thread(s) to buy, ${P.review.length} to review.`}

// ---- Rendering ----
function renderList(){const L=$('projList');$('projCount').textContent=store.projects.length?`(${store.projects.length})`:'';
 L.innerHTML=store.projects.length?store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated)).map(p=>{const P=plan(p);
  return`<li><span><b>${esc(p.name)}</b><br><small class="mut">${p.items.length} thread(s) · ${P.ready?'ready to start':`${P.lines.length} to buy, ${P.review.length} to review`} · updated ${esc(p.updated.slice(0,10))}</small></span><span class="row" style="margin:0"><button type="button" class="pri" data-open="${esc(p.id)}">Open</button><button type="button" class="sec" data-del="${esc(p.id)}">Delete</button></span></li>`}).join(''):'<li class="mut">No saved projects yet. Convert a list and choose "Save project", or start an empty one.</li>';
 L.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
 L.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delProject(b.dataset.del))}
function delProject(id){const p=proj(id);if(!p)return;if(!confirm(`Delete the project "${p.name}"? This can't be undone (unless you have a backup).`))return;
 store.projects=store.projects.filter(x=>x.id!==id);save();if(openId===id){openId=null;$('projEdit').hidden=true}renderList();pstatus(`Deleted "${p.name}".`)}
function openProject(id){openId=id;renderEditor();$('projEdit').hidden=false;$('projEdit').scrollIntoView({block:'start'});pstatus(`Opened "${proj(id).name}".`)}
function destCell(p,it){const d=p.decisions[it.code],dest=p.buyBrand,c=it.code,f=fam(c);
 if(dest==='anchor'&&f==='solid'&&DMC[c].anchor.length>1||dest==='anchor'&&(c==='WHITE'||c==='B5200')&&DMC[c].anchor.length){const disputed=c==='WHITE'||c==='B5200';
  return`<select id="anc-${esc(c)}" data-anc="${esc(c)}" aria-label="Anchor choice for DMC ${esc(lab(c))}">${disputed?'<option value="">Choose… (disputed)</option>':''}${DMC[c].anchor.map((a,i)=>`<option value="${esc(a)}"${(d.anchor||(!disputed&&i===0?a:''))===a?' selected':''}>Anchor ${esc(a)}${!disputed&&i===0&&!d.anchor?' (chart option 1)':''}</option>`).join('')}</select>${disputed?`<br><small class="warn">${esc(WHITE_DISPUTE)}</small>`:''}`}
 const r=resolve(it,dest,d.anchor);return r.ok?`<b>${BRAND[dest]} ${esc(disp(dest,r.to))}</b> <small class="mut">${esc(r.prov)}</small>`:`<span class="warn">${esc(r.why)}</span>`}
function renderEditor(){const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}const focusId=document.activeElement&&document.activeElement.id;
 E.innerHTML=`<div class="noprint"><div class="row" style="justify-content:space-between;margin-top:0"><h2 style="margin:0">Project</h2><span class="row" style="margin:0"><button type="button" class="sec" id="pClose">Close</button><button type="button" class="sec" id="pDelete">Delete project</button></span></div>
 <p><label for="pName"><b>Name</b></label><br><input type="text" id="pName" maxlength="100" value="${esc(p.name)}" style="width:100%"></p>
 <p><label for="pNotes"><b>Notes</b> <small class="mut">(optional)</small></label><br><textarea id="pNotes" class="pnotes" maxlength="2000" rows="2" style="width:100%" placeholder="e.g. threads are in the blue bag">${esc(p.notes)}</textarea></p>
 <p><label for="pDest"><b>Buy in:</b></label> <select id="pDest">${['dmc','sullivans','anchor'].map(k=>`<option value="${k}"${p.buyBrand===k?' selected':''}>${k==='dmc'?'DMC (original, no substitution)':BRAND[k]}</option>`).join('')}</select></p>
 <p class="hint"><b>Have</b> = you've confirmed you have enough. <b>Check</b> = you might, but the amount or suitability isn't confirmed. <b>Buy</b> = you need to buy it. "Owned" is optional, in skeins (0.5 for a partial). Floss Fox never assumes a full skein, and an unknown amount never counts as enough.</p>
 <div class="row"><button type="button" class="sec" id="pAllBuy">Mark all not-checked as Buy</button></div>
 <table class="ptable"><thead><tr><th>Pattern thread (original)</th><th>Needed</th><th>Have / Check / Buy</th><th>Owned</th><th>Will use</th></tr></thead><tbody>
 ${p.items.map(it=>{const d=p.decisions[it.code],c=esc(it.code),e=DMC[it.code],f=fam(it.code);return`<tr>
  <td>${sw(e.hex)}<b>DMC ${esc(lab(it.code))}</b>${f!=='solid'?` <span class="tag">${f}</span>`:''}<br><small class="mut">${esc(e.name)}${it.src.length?` · from "${it.src.map(esc).join('", "')}"`:''}</small><br><button type="button" class="sec small" id="rm-${c}" data-rm="${c}" aria-label="Remove DMC ${esc(lab(it.code))} from project">Remove</button></td>
  <td><span class="lbl">Needed (skeins)</span><input type="number" class="qbox" id="q-${c}" data-q="${c}" min="1" step="1" inputmode="numeric" value="${it.qty===null?'':it.qty}" ${it.qty===null?'disabled':''} aria-label="Skeins needed for DMC ${esc(lab(it.code))}">${it.stated===false&&it.qty!==null?' <small class="mut">(assumed)</small>':''}<br><label><input type="checkbox" id="u-${c}" data-unk="${c}" ${it.qty===null?'checked':''}> <span class="${it.qty===null?'unk':''}">Unknown</span></label></td>
  <td><span class="lbl">Have / Check / Buy</span><span class="seg" role="radiogroup" aria-label="Status for DMC ${esc(lab(it.code))}">${STATUSES.map(s=>`<label><input type="radio" name="st-${c}" id="st-${c}-${s}" value="${s}" data-st="${c}" ${d.status===s?'checked':''}><span>${s[0].toUpperCase()+s.slice(1)}</span></label>`).join('')}</span>${d.status?'':'<br><small class="warn">not checked</small>'}</td>
  <td><span class="lbl">Owned (skeins, optional)</span><input type="number" class="qbox" id="o-${c}" data-own="${c}" min="0" step="0.25" inputmode="decimal" value="${d.owned===null?'':d.owned}" placeholder="?" aria-label="Skeins owned of DMC ${esc(lab(it.code))} (optional)"></td>
  <td><span class="lbl">Will use</span>${destCell(p,it)}</td></tr>`}).join('')}</tbody></table>
 <p><label for="pAdd"><b>Add threads</b> <small class="mut">(same format as Quick convert)</small></label><br><textarea id="pAdd" rows="2" style="width:100%" placeholder="e.g. 3865 x2, 762"></textarea></p>
 <div class="row"><button type="button" class="sec" id="pAddBtn">Add to project</button></div><div id="pAddErr"></div></div>
 <div class="plan" id="pPlan"></div>`;
 bindEditor(p);renderPlan(p);if(focusId){const f=document.getElementById(focusId);if(f)f.focus()}}
function renderPlan(p){const P=plan(p),el=$('pPlan');
 el.innerHTML=`<h2 class="printonly">${esc(APP_NAME)}: ${esc(p.name)}</h2><p class="printonly">Buying in: ${esc(BRAND[P.dest])}</p>
 <p class="ready ${P.ready?'':'no'}" role="status" aria-live="polite">${esc(readyText(P,p))}</p>
 <h3>To buy (confirmed)</h3><ul>${P.lines.map(l=>`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}" ${l.bought?'checked':''}> <b>${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</b> × ${l.q} <small class="mut">(for DMC ${l.from.map(c=>esc(lab(c))).join(', ')} · ${[...l.prov].map(esc).join('; ')}${l.partial?' · after subtracting owned, rounded up':''})</small></label>${l.from.length>1?'<div class="warn small">⚠ Several pattern colours map to this one thread. Check that\'s what you want.</div>':''}</li>`).join('')||'<li class="mut">None yet.</li>'}</ul>
 <p class="hint">"Bought" ticks only track this shopping trip; they don't change what you own.</p>
 <h3>Needs review (not on the buy list)</h3><ul>${P.review.map(x=>`<li>DMC ${esc(lab(x.it.code))} · need ${x.it.qty===null?'<span class="unk">UNKNOWN</span>':x.it.qty}: ${esc(x.why)}</li>`).join('')||'<li class="mut">Nothing to review.</li>'}</ul>
 <h3>Have</h3><ul>${P.have.map(x=>`<li>DMC ${esc(lab(x.it.code))} · need ${x.it.qty===null?'<span class="unk">UNKNOWN</span>':x.it.qty}${x.d.owned!==null?` · owned ${x.d.owned}`:''}</li>`).join('')||'<li class="mut">None marked Have.</li>'}</ul>
 ${p.notes?`<p class="printonly"><b>Notes:</b> ${esc(p.notes)}</p>`:''}<div class="totals">${esc(costLine(P))}</div>
 <div class="row noprint"><button type="button" class="pri" id="pPrint">Print plan</button><button type="button" class="sec" id="pCopy">Copy as text</button><button type="button" class="sec" id="pCsv">Download CSV</button></div>
 <p id="pMsg" class="hint" role="status" aria-live="polite"></p><textarea id="pFallback" class="noprint" hidden readonly aria-label="Project plan text to copy" style="width:100%;min-height:120px"></textarea>`;
 el.querySelectorAll('[data-bought]').forEach(cb=>cb.onchange=()=>{if(cb.checked)p.purchased[cb.dataset.bought]=true;else delete p.purchased[cb.dataset.bought];touch(p);renderList()});
 $('pPrint').onclick=()=>print();$('pCopy').onclick=async()=>{const t=planText(p);try{if(!navigator.clipboard)throw 0;await navigator.clipboard.writeText(t);$('pMsg').textContent='✓ Copied to clipboard.';$('pFallback').hidden=true}catch(e){$('pMsg').textContent="Couldn't copy automatically. Select the text below and copy it.";const f=$('pFallback');f.value=t;f.hidden=false;f.focus();f.select()}};
 $('pCsv').onclick=()=>download(csv(p),safe(p.name)+'.csv','text/csv')}
function bindEditor(p){const E=$('projEdit'),re=()=>{touch(p);renderEditor();renderList()};
 $('pClose').onclick=()=>{openId=null;E.hidden=true};$('pDelete').onclick=()=>delProject(p.id);
 $('pName').onchange=()=>{p.name=$('pName').value.trim().slice(0,100)||'Untitled project';touch(p);renderList();renderPlan(p)};
 $('pNotes').onchange=()=>{p.notes=$('pNotes').value.slice(0,2000);touch(p);renderPlan(p)};
 $('pDest').onchange=()=>{p.buyBrand=$('pDest').value;re()};
 $('pAllBuy').onclick=()=>{let n=0;p.items.forEach(it=>{if(!p.decisions[it.code].status){p.decisions[it.code].status='buy';n++}});re();pstatus(`${n} thread(s) marked Buy.`)};
 E.querySelectorAll('[data-st]').forEach(r=>r.onchange=()=>{p.decisions[r.dataset.st].status=r.value;re()});
 E.querySelectorAll('[data-anc]').forEach(s=>s.onchange=()=>{p.decisions[s.dataset.anc].anchor=s.value||null;re()});
 E.querySelectorAll('[data-q]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),it=p.items.find(x=>x.code===i.dataset.q);
  if(!/^\d+$/.test(v)||+v<1){pstatus(`"${v}" isn't a whole number of skeins (1 or more). Unchanged. Tick Unknown if you don't know.`);i.value=it.qty===null?'':it.qty;return}it.qty=+v;it.stated=true;re()});
 E.querySelectorAll('[data-unk]').forEach(c=>c.onchange=()=>{const it=p.items.find(x=>x.code===c.dataset.unk);if(c.checked){it.qty=null;it.stated=true}else{it.qty=1;it.stated=false;pstatus('Quantity set to 1 (assumed). Enter the real number.')}re()});
 E.querySelectorAll('[data-own]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),d=p.decisions[i.dataset.own];
  if(v===''){d.owned=null;re();return}const n=Number(v);if(!isFinite(n)||n<0){pstatus(`"${v}" isn't a valid owned amount. Unchanged.`);i.value=d.owned===null?'':d.owned;return}d.owned=Math.round(n*100)/100;re()});
 E.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const c=b.dataset.rm;if(!confirm(`Remove DMC ${lab(c)} from this project?`))return;p.items=p.items.filter(x=>x.code!==c);delete p.decisions[c];re()});
 $('pAddBtn').onclick=()=>{const {items,errs}=parse($('pAdd').value);items.forEach(n=>{const ex=p.items.find(x=>x.code===n.code);
  if(ex){ex.qty=(ex.qty===null||n.qty===null)?null:ex.qty+n.qty;ex.src=ex.src.concat(n.src);ex.stated=ex.stated||n.stated}else{p.items.push({code:n.code,qty:n.qty,stated:n.stated,src:n.src});p.decisions[n.code]=normDecision(n.code,{})}});
  touch(p);renderEditor();renderList();$('pAddErr').innerHTML=errs.length?`<div class="errbox"><b>Couldn't add ${errs.length}:</b><ul>${errs.map(e=>`<li>"${esc(e.t)}": ${esc(e.why)}</li>`).join('')}</ul></div>`:'';if(errs.length)$('pAdd').value=errs.map(e=>e.t).join('\n');pstatus(`Added ${items.length} thread(s).`)}}

// ---- Export / backup / restore ----
const safe=n=>(n||'project').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'project';
function download(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function csv(p){const P=plan(p),q=v=>{v=v===null||v===undefined?'':String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const rows=[['project','dmc_code','dmc_name','needed_skeins','quantity_stated','status','owned_skeins','buy_in','will_use','source','to_buy_skeins','bought','issue']];
 p.items.forEach(it=>{const d=p.decisions[it.code],r=resolve(it,P.dest,d.anchor),line=P.lines.find(l=>l.from.includes(it.code)),rv=P.review.find(x=>x.it.code===it.code);
  rows.push([p.name,lab(it.code),DMC[it.code].name,it.qty===null?'UNKNOWN':it.qty,it.stated===false?'assumed':'yes',d.status||'not checked',d.owned===null?'':d.owned,BRAND[P.dest],r.ok?disp(P.dest,r.to):'',r.ok?r.prov:'',line?line.q+(line.from.length>1?' (shared line)':''):'',line?(line.bought?'yes':'no'):'',rv?rv.why:''])});
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
window.FlossFoxProjects={plan,planText,csv,_store:()=>store}; // for tests and debugging
})();
