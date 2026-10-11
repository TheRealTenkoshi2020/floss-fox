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
 const st=it.stated!==false,a=q===null?0:(Number.isInteger(it.assumed)&&it.assumed>=0&&it.assumed<=q?it.assumed:(st?0:q));
 return{code:it.code,qty:q,stated:a===0,assumed:a,src:Array.isArray(it.src)?it.src.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,200)):[]}}
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
function plainWhy(it,r){const f=fam(it.code),c=lab(it.code);if(f!=='solid')return`This is a ${f} thread, so there's no automatic brand swap. Buy the original DMC ${c} (set the brand to DMC).`;
 if(/Sullivans/.test(r.why||''))return`There's no Sullivans match on the chart. Buy DMC ${c} instead (set the brand to DMC).`;if(/Anchor/.test(r.why||''))return`There's no Anchor match on the chart. Buy DMC ${c} instead (set the brand to DMC).`;return r.why||'Needs a look.'}
function plan(p){const dest=p.buyBrand,threads=[];
 // Per-thread state (derived, deterministic): have | received | buy | awaiting | review
 p.items.forEach(it=>{const d=p.decisions[it.code],r=resolve(it,dest,d.anchor),req=it.qty,own=d.owned;const t={it,d,r,state:'review',why:'',q:0,rem:0,recv:0,recvOther:false};threads.push(t);
  const needsPick=dest==='anchor'&&fam(it.code)==='solid'&&!d.anchor&&(r.review||DMC[it.code].anchor.length>1);
  const K=(k,w)=>{t.kind=k;t.why=w};
  if(needsPick){K('match',r.review?'Sources disagree on the Anchor match for white. Choose the one you want in Details.':'Anchor has more than one possible match. Choose the one you want in Details.');return}
  if(d.status==='have'){if(req===null)K('amount',"Floss Fox can't tell whether you have enough until the amount needed is entered. Add it in Details.");else if(own!==null&&own<req)K('other',`You noted ${own} skein${own===1?'':'s'}, but the pattern needs ${req}. Choose Need to buy, or update what you have.`);else t.state='have';return}
  if(d.status==='check'){K('unsure',`Check your stash, then choose Have enough or Need to buy.${own!==null?` (You noted ${own}.)`:''}${req===null?" The amount needed isn't entered.":''}`);return}
  if(d.status!=='buy'){K('unchecked','Choose Have enough, Need to buy or Not sure.');return}
  if(!r.ok){K('other',plainWhy(it,r));return}
  if(req===null){K('amount','How many skeins does your pattern need? Add it in Details so this color can be checked off.');return}
  t.q=own===null?req:Math.ceil(req-own-1e-9);
  if(t.q<=0){t.kind='other';t.why=`You noted ${own}, which covers the ${req} needed. Choose Have enough instead?`;return}
  if(d.recv){if(d.recv.brand===dest&&d.recv.to===r.to)t.recv=d.recv.qty;else t.recvOther=true}
  t.rem=Math.max(0,Math.ceil(t.q-t.recv-1e-9));t.state=t.rem<=0?'received':'buy'});
 const groups={};threads.filter(t=>t.state==='buy').forEach(t=>{const g=groups[t.r.to]||(groups[t.r.to]={to:t.r.to,q:0,from:[],prov:new Set(),partial:false,recvd:0,ts:[]});g.q+=t.rem;g.from.push(t.it.code);g.prov.add(t.r.prov);g.partial=g.partial||t.d.owned!==null;g.recvd+=t.recv;g.ts.push(t)});
 const lines=Object.values(groups).map(g=>{const key=dest+':'+g.to,bought=!!p.purchased[key];if(bought)g.ts.forEach(t=>t.state='awaiting');return{...g,key,bought}});
 const by=st=>threads.filter(t=>st.includes(t.state));
 const sum={sufficient:by(['have','received']).length,toBuy:by(['buy']).length,awaiting:by(['awaiting']).length,review:by(['review']).length,total:threads.length};
 return{dest,threads,lines,review:by(['review']),have:by(['have','received']),sum,ready:sum.total>0&&sum.sufficient===sum.total}}
// Pip celebrates once per real not-ready -> ready transition (pose only, no bubble: the headline right beside it already says it).
const CEL=()=>{setTimeout(()=>{const f=document.getElementById('pCel');if(f){f.classList.remove('pip-cheer')}},4000);
 return`<span class="pcel pipfig pip-cheer" id="pCel" aria-hidden="true"><picture><source type="image/webp" srcset="assets/pip/pip-celebrating-160.webp 160w, assets/pip/pip-celebrating-320.webp 320w" sizes="64px"><img src="assets/pip/pip-celebrating-160.png" width="160" height="243" alt=""></picture></span>`};
const FL=()=>window.FlossFoxLinks||{buyLinks:()=>'',retailersFor:()=>[]};
const DISC=()=>`<p class="affdisc noprint"><b>Affiliate links:</b> Floss Fox may earn a small commission at no extra cost to you. <a href="about.html#affiliates">More info</a>${window.FLOSS_FOX_TEST_LINKS?' (Preview: test links, not tracked.)':''}</p>`;
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
function costLine(P){const p=PRICES[P.dest];let k=0,unpriced=0;P.lines.forEach(l=>{if(l.from.every(c=>fam(c)==='solid'))k+=l.q;else unpriced++});
 if(!P.lines.length)return'Nothing left to buy.';
 return`Rough cost of what's left to buy: ≈ ${rng(p.lo*k,p.hi*k)} USD for ${plural(P.lines.reduce((a,l)=>a+l.q,0),'skein')}${unpriced?` (plus ${plural(unpriced,'specialty thread')} with no price)`:''}. Colors that still need attention aren't included. Prices were checked ${PRICES.checked} and vary by store.`}
const lineTxt=(P,l)=>`${BRAND[P.dest]} ${disp(P.dest,l.to)} x${l.q} (for DMC ${l.from.map(lab).join(', ')}; ${[...l.prov].join('; ')}${l.partial?'; after subtracting what you have, rounded up to whole skeins':''}${l.recvd?`; ${l.recvd} already received`:''}${l.ts.some(t=>asmOf(t.it)>0)?'; includes an assumed amount':''})${l.from.length>1?' ⚠ note: several pattern colors share this thread':''}`;
const needTxt=it=>it.qty===null?'amount not entered':plural(it.qty,'skein')+asmTxt(it.qty,asmOf(it));
function planText(p){const P=plan(p),o=[`${APP_NAME} project: ${p.name}`,`Brand to buy: ${BRAND[P.dest]}`,readyText(P,p),summaryText(P),''];
 const tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),co=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy');
 o.push('NEED TO BUY:');if(!tb.length&&!co.length)o.push('- none');tb.forEach(l=>o.push('[ ] '+lineTxt(P,l)));co.forEach(t=>o.push(`[ ] DMC ${lab(t.it.code)}: amount not entered (add it to check this color off)`));
 o.push('','BOUGHT — CHECK IN WHEN IT ARRIVES (not counted as ready yet):');if(!aw.length)o.push('- none');aw.forEach(l=>o.push('[x] '+lineTxt(P,l)));
 o.push('','NEEDS ATTENTION (not on the buy list yet):');if(!P.review.length)o.push('- none');P.review.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (needs ${needTxt(x.it)}): ${(KIND[x.kind]||KIND.other)[1]}. ${x.why}`));
 o.push('','READY (you have enough or received it):');if(!P.have.length)o.push('- none');P.have.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (needs ${needTxt(x.it)}${x.d.owned!==null?`, you have ${x.d.owned}`:''}${x.state==='received'?`, received ${x.recv} ${BRAND[P.dest]} ${disp(P.dest,x.r.to)}`:', already had it'})`));
 if(p.notes)o.push('','Notes: '+p.notes);o.push('',costLine(P),'Color swatches and brand matches are approximate. Compare real thread before swapping.');return o.join('\n')}
function summaryText(P){const s=P.sum;return`${s.sufficient} of ${s.total} colors ready · ${s.toBuy} to buy · ${s.awaiting} bought, waiting to check in · ${s.review} need attention`}
function readyText(P,p){if(!p.items.length)return'No colors in this project yet.';return P.ready?"Ready to stitch: all your threads are accounted for.":`Not ready yet: ${s2(P.sum.toBuy)} to buy, ${P.sum.awaiting} bought (waiting to check in), ${P.sum.review} need attention.`}
const s2=n=>plural(n,'color');
function receive(p,key,n){const P=plan(p),l=P.lines.find(x=>x.key===key);if(!l)return'';let left=n;
 l.ts.forEach(t=>{const take=Math.min(left,t.rem);if(take>0){const prev=(t.d.recv&&t.d.recv.brand===P.dest&&t.d.recv.to===t.r.to)?t.d.recv.qty:0;t.d.recv={brand:P.dest,to:t.r.to,qty:prev+take};left-=take}});
 delete p.purchased[key];touch(p);const nm=`${BRAND[P.dest]} ${disp(P.dest,l.to)}`;return n>=l.q?`✓ ${nm} checked in: ${plural(n,'skein')} received. You have enough now.`:`${plural(n,'skein')} of ${nm} received. ${l.q-n} more still needed, so it's back on your shopping list.`}

// ---- Rendering ----
const foxSvg=cls=>{const l=document.querySelector('header .logo');return l?l.outerHTML.replace('class="logo"',`class="${cls}" aria-hidden="true"`).replace(/role="img" aria-label="[^"]*"/,''):''};
function renderList(){const L=$('projList');$('projCount').textContent=store.projects.length?`(${store.projects.length})`:'';
 L.innerHTML=store.projects.length?store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated)).map(p=>{const P=plan(p);
  return`<li><span><span class="pname">${esc(p.name)}</span><br><small class="mut">${s2(p.items.length)} · ${P.ready?'<b class="ok-msg">✓ Ready to stitch</b>':`${P.sum.sufficient} of ${P.sum.total} ready${P.sum.toBuy?` · ${P.sum.toBuy} to buy`:''}${P.sum.review?` · ${P.sum.review} need attention`:''}`} · updated ${esc(p.updated.slice(0,10))}</small></span><span class="row" style="margin:0"><button type="button" class="pri" data-open="${esc(p.id)}">Open<span class="sr"> ${esc(p.name)}</span></button><button type="button" class="ghost" data-del="${esc(p.id)}">Delete<span class="sr"> ${esc(p.name)}</span></button></span></li>`}).join('')+'<li class="storeline" style="display:block;border:0">Saved in this browser only. Open <b>Back up my projects</b> below to keep a copy.</li>'
  :`<li class="empty">${foxSvg('emptyfox')}<b>No projects yet</b>Paste your colors on the <i>Add colors</i> tab, then save them as a project to check what you have.<div class="row" style="justify-content:center"><button type="button" class="pri" id="emptyAdd">Add my colors</button></div></li>`;
 L.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
 L.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delProject(b.dataset.del));const ea=$('emptyAdd');if(ea)ea.onclick=()=>{showView('convert');$('inp').focus()}}
function delProject(id){const p=proj(id);if(!p)return;if(!confirm(`Delete the project "${p.name}"? This can't be undone unless you have a backup.`))return;
 store.projects=store.projects.filter(x=>x.id!==id);save();if(openId===id){openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false}renderList();pstatus(`Deleted "${p.name}".`)}
function openProject(id,m){if(openId!==id){expanded.clear();filt='all';query='';shopPanel=null}openId=id;mode=m||'edit';renderEditor();$('projEdit').hidden=false;$('projListCard').hidden=true;window.scrollTo(0,0);pstatus(`Opened "${proj(id).name}".`)}
function closeProject(){openId=null;mode='edit';$('projEdit').hidden=true;$('projListCard').hidden=false;renderList()}
function destCell(p,it){const d=p.decisions[it.code],dest=p.buyBrand,c=it.code,f=fam(c),L=esc(lab(c));
 if(dest==='anchor'&&f==='solid'&&DMC[c].anchor.length>1||dest==='anchor'&&(c==='WHITE'||c==='B5200')&&DMC[c].anchor.length){const disputed=c==='WHITE'||c==='B5200';
  return`<label class="flbl" for="anc-${esc(c)}">Choose the Anchor match</label><select id="anc-${esc(c)}" data-anc="${esc(c)}"><option value=""${d.anchor?'':' selected'}>Choose a match…</option>${DMC[c].anchor.map(a=>`<option value="${esc(a)}"${d.anchor===a?' selected':''}>Anchor ${esc(a)}</option>`).join('')}</select><p class="hint">${disputed?esc(WHITE_DISPUTE):'The chart lists more than one Anchor match for this color. Pick the one you want to use.'}</p>`}
 const r=resolve(it,dest,d.anchor);return`<span class="flbl">Brand match</span>`+(r.ok?`<b>${BRAND[dest]} ${esc(disp(dest,r.to))}</b> <small class="mut">(${esc(r.prov)})</small>`:`<span>${esc(plainWhy(it,r))}</span>`)}
const expanded=new Set();let justOpened=null,filt='all',query='',mode='edit',shopPanel=null;
const sid=k=>k.replace(/[^\w-]/g,'_');
const KIND={amount:['✎','Add the amount'],match:['?','Confirm the color match'],unsure:['?','Not sure yet'],unchecked:['○','Not checked yet'],other:['!','Needs a look']};
function statInfo(t){if(t.state==='have')return['✓','You have enough'];if(t.state==='received')return['✓','Received: ready'];if(t.state==='buy')return['🛒',`Need to buy · ${plural(t.rem,'skein')}`];if(t.state==='awaiting')return['📦','Bought: check it in when it arrives'];return KIND[t.kind]||KIND.other}
const FILTERS=[['all','All'],['todo','Still to do'],['buy','Need to buy'],['att','Needs attention'],['ready','Ready']];
const inFilter=(t,f)=>f==='all'||(f==='todo'&&!['have','received'].includes(t.state))||(f==='buy'&&['buy','awaiting'].includes(t.state))||(f==='att'&&t.state==='review')||(f==='ready'&&['have','received'].includes(t.state));
const ABBR={vy:'very',dk:'dark',lt:'light',md:'medium',ul:'ultra',ult:'ultra',med:'medium'};
const cap=t=>{if(!t)return t;t=t.replace(/\b(vy|dk|lt|md|ul|ult|med)\b\.?/gi,m=>ABBR[m.replace('.','').toLowerCase()]);return t[0].toUpperCase()+t.slice(1)};
const STLBL={have:'Have enough',buy:'Need to buy',check:'Not sure'};
function card(p,P,t){const it=t.it,d=t.d,c=esc(it.code),e=DMC[it.code],f=fam(it.code),open=expanded.has(it.code),L=esc(lab(it.code)),si=statInfo(t);
 return`<li class="tcard st-${t.state}${t.kind?' k-'+t.kind:''}" id="card-${c}" data-code="${c}" data-search="${esc((lab(it.code)+' '+e.name+' '+(t.r.ok?t.r.to:'')).toLowerCase())}"><div class="main"><div class="top">
 <span class="bigsw" style="background:${e.hex}" title="Approximate DMC color"></span>
 <div class="ident"><div class="code">DMC ${L}${f!=='solid'?` <span class="tag">${f}</span>`:''}</div><div class="cname">${esc(cap(e.name))}${P.dest!=='dmc'&&t.r.ok?` · use <b>${BRAND[P.dest]} ${esc(disp(P.dest,t.r.to))}</b>`:''}</div>
 <div class="need">${it.qty===null?'<span class="unk">Amount needed: not entered</span>':`${plural(it.qty,'skein')} needed${asmTxt(it.qty,asmOf(it))}`}</div>
 <div class="stat ${t.state}${t.kind?' k-'+t.kind:''}"><span aria-hidden="true">${si[0]}</span> ${si[1]}</div></div>
 <button type="button" class="sec exp" id="x-${c}" data-exp="${c}" aria-expanded="${open}" aria-controls="det-${c}">${open?'Hide details':'Details'}<span class="sr"> for DMC ${L}</span></button></div>
 <div class="seg" role="radiogroup" aria-label="Do you have DMC ${L}?">${['have','buy','check'].map(s=>`<label><input type="radio" name="st-${c}" id="st-${c}-${s}" value="${s}" data-st="${c}" ${d.status===s?'checked':''}><span>${STLBL[s]}</span></label>`).join('')}</div></div>
 ${t.state==='review'?`<div class="why">${esc(t.why)}</div>`:''}${t.recvOther?'<div class="why">A thread you checked in for a different brand isn\'t counted here.</div>':''}
 <div class="tdet${justOpened===it.code?' anim':''}" id="det-${c}" ${open?'':'hidden'}>
  <div class="fldrow"><div class="fld"><label for="q-${c}">Amount needed (skeins)</label><input type="number" class="qbox" id="q-${c}" data-q="${c}" min="1" step="1" inputmode="numeric" value="${it.qty===null?'':it.qty}" ${it.qty===null?'disabled':''}><label class="inl"><input type="checkbox" id="u-${c}" data-unk="${c}" ${it.qty===null?'checked':''}> Not entered</label></div>
  <div class="fld"><label for="o-${c}">You already have (skeins, optional)</label><input type="number" class="qbox" id="o-${c}" data-own="${c}" min="0" step="0.25" inputmode="decimal" value="${d.owned===null?'':d.owned}" placeholder="?" aria-describedby="oh-${c}"><div class="hint" id="oh-${c}">Use 0.5 for a partly used skein. Leave empty if you're not sure.</div></div></div>
  <div class="fld">${destCell(p,it)}</div>
  ${it.src.length?`<div class="fld"><span class="flbl">From your list</span>"${it.src.map(esc).join('", "')}"</div>`:''}
  ${d.recv?`<div class="fld"><span class="flbl">Checked in</span>${d.recv.qty} × ${esc(BRAND[d.recv.brand])} ${esc(disp(d.recv.brand,d.recv.to))} <button type="button" class="sec small" id="rr-${c}" data-rr="${c}">Undo received</button></div>`:''}
  <div class="fld"><button type="button" class="ghost small" id="rm-${c}" data-rm="${c}">Remove this color<span class="sr"> (DMC ${L})</span></button></div></div></li>`}
function nextSteps(P){const k={};P.threads.forEach(t=>{if(t.state==='review')k[t.kind]=(k[t.kind]||0)+1});const s=P.sum,o=[];
 if(k.amount)o.push(['att',`${s2(k.amount)} need${k.amount===1?'s':''} an amount before your list is complete.`,k.amount===1?'Review it':'Review them','att']);
 if(k.match)o.push(['att',`You chose another brand for ${s2(k.match)}. Please confirm the match${k.match===1?'':'es'}.`,'Review','att']);
 if(k.unchecked)o.push(['att',`${s2(k.unchecked)} ${k.unchecked===1?"isn't":"aren't"} checked yet. Tap Have enough, Need to buy or Not sure.`,k.unchecked===1?'Show it':'Show them','att']);
 if(k.unsure)o.push(['att',`${s2(k.unsure)} marked Not sure. Check your stash when you can.`,k.unsure===1?'Show it':'Show them','att']);
 if(k.other)o.push(['att',`${s2(k.other)} need${k.other===1?'s':''} a second look.`,k.other===1?'Show it':'Show them','att']);
 if(s.awaiting)o.push(['wait',`${plural(s.awaiting,'thread')} ${s.awaiting===1?'was':'were'} bought but ${s.awaiting===1?"hasn't":"haven't"} been checked in yet.`,'Check them in','shop']);
 if(s.toBuy)o.push(['buy',`${s2(s.toBuy)} to buy.`,'Shop my list','shop']);return o}
function renderEditor(){if(mode==='shop')return renderShop();const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}
 const focusId=document.activeElement&&document.activeElement.id,y=window.scrollY,P=plan(p);
 const unchecked=p.items.filter(it=>!p.decisions[it.code].status).length;
 E.innerHTML=`<div class="noprint"><div class="ptitle"><button type="button" class="ghost" id="pClose">← All projects</button><button type="button" class="pri" id="pShop"><span aria-hidden="true">🛒</span> Shop my list</button></div>
 <div class="fldrow" style="margin-top:var(--s3)"><div class="fld" style="flex:2 1 220px"><label for="pName">Project name</label><input type="text" id="pName" maxlength="100" value="${esc(p.name)}" style="width:100%"></div>
 <div class="fld" style="flex:1 1 180px"><label for="pDest">Brand to buy</label><select id="pDest" style="width:100%">${['dmc','sullivans','anchor'].map(k=>`<option value="${k}"${p.buyBrand===k?' selected':''}>${k==='dmc'?'DMC (same as pattern)':BRAND[k]}</option>`).join('')}</select></div></div>
 <details class="pmore"${p.notes?' open':''}><summary>Notes and project options</summary>
 <div class="fld"><label for="pNotes">Notes <small class="mut">(optional)</small></label><textarea id="pNotes" class="pnotes" maxlength="2000" rows="2" style="width:100%;min-height:72px;font-family:var(--font)" placeholder="e.g. threads are in the blue bag">${esc(p.notes)}</textarea></div>
 <div class="row"><button type="button" class="ghost" id="pDelete">Delete this project</button></div></details></div>
 <div id="pSum"></div>
 <section class="noprint" id="pThreads" aria-labelledby="pThreadsH"><h3 id="pThreadsH">Your colors</h3>
 <p class="hint">For each color, tap <b>Have enough</b>, <b>Need to buy</b> or <b>Not sure</b>. Open <b>Details</b> to add amounts or pick another brand. Swatches are approximate screen colors.</p>
 <div class="toolbar"><div class="searchrow"><label class="sr" for="pSearch">Find a color</label><input type="search" id="pSearch" placeholder="Find a color, e.g. 310 or black" value="${esc(query)}" autocomplete="off"><button type="button" class="sec" id="pSearchClear"${query?'':' hidden'}>Clear search</button></div>
 <div class="chipsf" role="group" aria-label="Show">${FILTERS.map(([k,l])=>`<button type="button" id="f-${k}" data-filt="${k}" aria-pressed="${filt===k}">${l} (${P.threads.filter(t=>inFilter(t,k)).length})</button>`).join('')}</div>
 ${unchecked?`<div><button type="button" class="sec" id="pAllBuy">Mark the ${unchecked} unchecked as Need to buy</button></div>`:'<button type="button" id="pAllBuy" hidden>Mark unchecked as Need to buy</button>'}</div>
 <p id="pFiltMsg" class="sr" role="status" aria-live="polite"></p>
 <ul class="cards" id="pCards">${P.threads.map(t=>card(p,P,t)).join('')}<li class="noresults" id="pNoRes" hidden></li></ul>
 <details class="pmore" id="pAddBox"><summary>Add more colors</summary><label for="pAdd" class="flbl">Paste colors to add (same format as the Add colors box)</label><textarea id="pAdd" rows="2" style="width:100%;min-height:72px" placeholder="e.g. 3865 x2, 762"></textarea>
 <div class="row"><button type="button" class="sec" id="pAddBtn">Add to project</button></div><div id="pAddErr"></div></details></section>
 <div class="plan" id="pPlan"></div>`;
 bindEditor(p);renderPlan(p,P);applyFilter(P);window.scrollTo(0,y);if(focusId){const f=document.getElementById(focusId);if(f)f.focus({preventScroll:true})}}
function applyFilter(P){const cards=[...document.querySelectorAll('#pCards .tcard')],q=query.trim().toLowerCase();let n=0;const map={};P.threads.forEach(t=>map[t.it.code]=t);
 cards.forEach(c=>{const t=map[c.dataset.code],show=inFilter(t,filt)&&(!q||c.dataset.search.includes(q));c.hidden=!show;if(show)n++});
 const nr=$('pNoRes');if(nr){nr.hidden=!!n||!cards.length;nr.innerHTML=n?'':`${q?`No colors match “${esc(query)}”${filt!=='all'?' in this view':''}.`:'Nothing here right now.'} <button type="button" class="sec small" id="pNoResClear">Show all colors</button>`;const b=$('pNoResClear');if(b)b.onclick=()=>{query='';filt='all';renderEditor()}}
 if(!cards.length&&nr){nr.hidden=false;nr.innerHTML='No colors in this project yet. Use <b>Add more colors</b> below.';const ab=$('pAddBox');if(ab)ab.open=true}
 const m=$('pFiltMsg');if(m)m.textContent=`Showing ${s2(n)}.`;const cb=$('pSearchClear');if(cb)cb.hidden=!query}
function renderPlan(p,P){P=P||plan(p);const cel=!!(window.FlossFoxPip&&FlossFoxPip.projectReady(p.id,P.ready));const s=P.sum,tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),pct=s.total?Math.round(100*s.sufficient/s.total):0;
 const skeins=P.lines.reduce((a,l)=>a+l.q,0),colorOnly=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').length;
 const li=l=>`<b>${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</b> × ${l.q} <small class="mut">(for DMC ${l.from.map(c=>esc(lab(c))).join(', ')} · ${[...l.prov].map(esc).join('; ')}${l.partial?' · after subtracting what you have':''}${l.recvd?` · ${l.recvd} already received`:''}${l.ts.some(t=>asmOf(t.it)>0)?' · includes an assumed amount':''})</small>`;
 const mw=l=>l.from.length>1?'<div class="hint">Note: several pattern colors use this one thread. Check that\'s what you want.</div>':'';
 const steps=nextSteps(P);
 $('pSum').innerHTML=`<h2 class="printonly">${esc(APP_NAME)}: ${esc(p.name)}</h2><p class="printonly">Brand to buy: ${esc(BRAND[P.dest])}</p>
 <section class="psum" id="pSummary" data-ready="${P.ready}" aria-labelledby="pSumH"><h2 class="sr" id="pSumH">Project summary</h2>
 <p class="headline" role="status" aria-live="polite">${P.ready?`${cel?CEL():foxSvg('fox')}<span>All your threads are accounted for. You're ready to stitch!<span class="sr" id="sSuf">${s.sufficient} of ${s.total}</span></span>`:`<span><span id="sSuf">${s.sufficient} of ${s.total}</span> colors ready</span>`}</p>
 ${s.total?`<div class="bar" role="progressbar" aria-label="Colors ready" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.sufficient}" aria-valuetext="${s.sufficient} of ${s.total} colors ready"><span style="width:${pct}%"></span></div>`:''}
 ${P.ready?`<p class="skeins">${s.total} of ${s2(s.total)} have enough or have been checked in. Happy stitching! 🧵</p>`:''}<ul class="stats"${P.ready?' hidden':''}><li><b id="sBuy">${s.toBuy}</b>to buy</li><li><b id="sAw">${s.awaiting}</b>bought, waiting to check in</li><li><b id="sRev">${s.review}</b>need attention</li></ul>
 ${(n=>n?`<p class="skeins">${s2(n)} use${n===1?'s':''} an assumed amount (1 skein for each line with no amount). Check against your pattern in Details.</p>`:'')(p.items.filter(it=>it.qty!==null&&asmOf(it)>0).length)}${skeins||colorOnly?`<p class="skeins">Skeins still to get: <b>${skeins}</b>${colorOnly?` · plus ${s2(colorOnly)} with no amount entered, so the total isn't complete`:''}</p>`:''}
 ${steps.length?`<ul class="next noprint">${steps.map(([c,t,b,a],i)=>`<li class="${c}"><span>${esc(t)}</span><button type="button" class="sec small" id="ns-${i}" data-ns="${a}">${b}</button></li>`).join('')}</ul>`:''}
 <nav class="jump noprint" aria-label="Jump to"${P.ready?' hidden':''}><a href="#pThreads">Your colors</a><a href="#pReviewH">Needs attention (${s.review})</a><a href="#pShopH">Shopping list (${P.lines.length})</a></nav></section>`;
 $('pPlan').innerHTML=`<h3 id="pShopH" tabindex="-1">Shopping list</h3><h4>Need to buy</h4>${tb.length&&FL().retailersFor(P.dest,'310').length?DISC():''}<ul>${tb.map(l=>`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}"> ${li(l)}</label>${FL().buyLinks(P.dest,disp(P.dest,l.to))}${mw(l)}</li>`).join('')}${P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').map(t=>`<li>DMC ${esc(lab(t.it.code))} · <span class="unk">amount not entered</span>. Add it to check this color off.</li>`).join('')||(tb.length?'':'<li class="mut">Nothing left to buy.</li>')}</ul>
 <h4>Bought: check in when it arrives</h4><p class="hint">Ticking a thread as bought doesn't count it as ready. Check it in once you have it in hand.</p><ul>${aw.map(l=>{const k=sid(l.key);return`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}" checked> ${li(l)}</label>${mw(l)}
  <div class="noprint"><button type="button" class="sec small" id="rb-${k}" data-rb="${esc(l.key)}">I received this thread…</button>
  <div class="rform" id="rf-${k}" hidden><label for="rq-${k}">How many skeins of ${BRAND[P.dest]} ${esc(disp(P.dest,l.to))} arrived? (${l.q} still needed)</label><br><input type="number" id="rq-${k}" min="1" step="1" inputmode="numeric" class="qbox"> <button type="button" class="pri small" id="rc-${k}" data-rc="${esc(l.key)}">Save</button> <button type="button" class="ghost small" data-rx="${k}">Cancel</button></div></div></li>`}).join('')||'<li class="mut">Nothing waiting.</li>'}</ul>
 <h3 id="pReviewH" tabindex="-1">Needs attention</h3><ul>${P.review.map(x=>`<li>DMC ${esc(lab(x.it.code))} · needs ${x.it.qty===null?'<span class="unk">amount not entered</span>':plural(x.it.qty,'skein')}: <b>${(KIND[x.kind]||KIND.other)[1]}.</b> ${esc(x.why)}</li>`).join('')||'<li class="mut">Nothing needs attention.</li>'}</ul>
 <h3>Ready</h3><ul>${P.have.map(x=>`<li>DMC ${esc(lab(x.it.code))} · needs ${x.it.qty===null?'<span class="unk">amount not entered</span>':plural(x.it.qty,'skein')}${x.d.owned!==null?` · you have ${x.d.owned}`:''} · ${x.state==='received'?`received ${x.recv} ${BRAND[P.dest]} ${esc(disp(P.dest,x.r.to))}`:'already had it'}</li>`).join('')||'<li class="mut">None yet.</li>'}</ul>
 ${p.notes?`<p class="printonly"><b>Notes:</b> ${esc(p.notes)}</p>`:''}<div class="totals">${esc(costLine(P))}</div>
 <div class="row noprint"><button type="button" class="pri" id="pPrint">Print</button><button type="button" class="sec" id="pCopy">Copy as text</button><button type="button" class="sec" id="pCsv">Download spreadsheet (CSV)</button></div>
 <p id="pMsg" class="hint" role="status" aria-live="polite"></p><textarea id="pFallback" class="noprint" hidden readonly aria-label="Project text to copy" style="width:100%;min-height:120px"></textarea>`;
 const el=$('pPlan'),re=msg=>{renderEditor();renderList();if(msg)$('pMsg').textContent=msg};
 $('pSum').querySelectorAll('[data-ns]').forEach(b=>b.onclick=()=>{if(b.dataset.ns==='shop')openShop(p);else{filt='att';query='';renderEditor();$('pThreads').scrollIntoView();const f=$('f-att');if(f)f.focus({preventScroll:true})}});
 el.querySelectorAll('[data-bought]').forEach(cb=>cb.onchange=()=>{if(cb.checked)p.purchased[cb.dataset.bought]=true;else delete p.purchased[cb.dataset.bought];touch(p);re(cb.checked?'Marked as bought. Check it in when you have it.':'Moved back to Need to buy.')});
 el.querySelectorAll('[data-rb]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rb);$('rf-'+k).hidden=false;$('rq-'+k).focus()});
 el.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{$('rf-'+b.dataset.rx).hidden=true});
 el.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rc),v=$('rq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('pMsg').textContent='Enter how many whole skeins arrived (1 or more). Nothing changed.';$('rq-'+k).focus();return}re(receive(p,b.dataset.rc,+v))});
 bindOut(p,'p')}
function bindOut(p,pre){$(pre+'Print').onclick=()=>print();$(pre+'Copy').onclick=async()=>{const t=planText(p),m=$(pre+'Msg'),f=$(pre+'Fallback');try{if(!navigator.clipboard)throw 0;await navigator.clipboard.writeText(t);m.textContent='✓ Copied. Paste it into a note or message.';f.hidden=true}catch(e){m.textContent="Couldn't copy automatically. Select the text below and copy it.";f.value=t;f.hidden=false;f.focus();f.select()}};
 $(pre+'Csv').onclick=()=>{download(csv(p),safe(p.name)+'.csv','text/csv');$(pre+'Msg').textContent='Spreadsheet file downloaded.'}}
function openShop(p){mode='shop';shopPanel=null;query='';renderEditor();window.scrollTo(0,0);const h=$('shH');if(h)h.focus({preventScroll:true})}
function renderShop(){const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}const focusId=document.activeElement&&document.activeElement.id,y=window.scrollY,P=plan(p);
 const tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),co=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy'),done=P.have,need=P.sum.toBuy+co.length;
 const swatches=l=>`<span class="bigsw" style="background:${DMC[l.from[0]].hex}" title="Approximate color"></span>`;
 const panel=(l,k)=>{if(!shopPanel||shopPanel.key!==l.key)return'';if(shopPanel.step==='choose')return`<div class="panel" role="group" aria-label="Where is it?"><p>Where is it?</p><div class="acts"><button type="button" class="pri" id="sw-${k}" data-sw="${esc(l.key)}">I have it with me</button><button type="button" class="sec" id="sd-${k}" data-sd="${esc(l.key)}">Waiting for delivery</button><button type="button" class="ghost" data-sc="1">Cancel</button></div></div>`;
  return`<div class="panel"><label for="sq-${k}"><b>How many skeins did you get?</b> (${l.q} needed)</label><div class="acts"><input type="number" id="sq-${k}" min="1" step="1" inputmode="numeric" class="qbox" aria-describedby="sqh-${k}"><button type="button" class="pri" id="ss-${k}" data-ss="${esc(l.key)}">Save</button><button type="button" class="ghost" data-sc="1">Cancel</button></div><div class="hint" id="sqh-${k}">Enter only what you actually have in hand.</div></div>`};
 const sc=(l,awaiting)=>{const k=sid(l.key);return`<li class="scard" id="sh-${k}" data-q="${esc((disp(P.dest,l.to)+' '+l.from.map(c=>lab(c)+' '+DMC[c].name).join(' ')).toLowerCase())}"><div class="top">${swatches(l)}<div><div class="code">${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</div>${P.dest!=='dmc'||l.from.length>1?`<div class="for">for DMC ${l.from.map(c=>esc(lab(c))).join(', ')}</div>`:`<div class="for">${esc(cap(DMC[l.from[0]].name))}</div>`}</div><div class="qty">${plural(l.q,'skein')}${l.recvd?`<br><small class="mut">${l.recvd} received</small>`:''}</div></div>
  ${awaiting?`<div class="stat awaiting"><span aria-hidden="true">📦</span> Bought: check it in when it arrives</div><div class="acts"><button type="button" class="pri" id="sr-${k}" data-sr="${esc(l.key)}">I received it</button><button type="button" class="ghost" id="su-${k}" data-su="${esc(l.key)}">Not bought after all</button></div>`
   :`${FL().buyLinks(P.dest,disp(P.dest,l.to))}<div class="acts"><button type="button" class="pri" id="sb-${k}" data-sb="${esc(l.key)}" aria-expanded="${!!(shopPanel&&shopPanel.key===l.key)}">Bought it</button></div>`}${panel(l,k)}</li>`};
 E.innerHTML=`<div class="shophead"><div class="ptitle"><button type="button" class="ghost" id="shBack">← Back to project</button><span class="mut">${esc(p.name)} · ${esc(BRAND[P.dest])}</span></div>
 <h2 id="shH" tabindex="-1">Shopping list</h2>
 <p class="shopsum" role="status" aria-live="polite">${need?`You still need ${s2(need)}.`:(aw.length?'Everything is bought. Check threads in as they arrive.':'Nothing left to buy.')}</p>
 ${P.lines.length||co.length?`<p class="hint">Skeins still to get: <b>${P.lines.reduce((a,l)=>a+l.q,0)}</b>${co.length?` · ${s2(co.length)} with no amount entered`:''}</p>`:''}
 ${P.lines.length+co.length>6?`<div class="searchrow"><label class="sr" for="shSearch">Find a thread</label><input type="search" id="shSearch" placeholder="Find a thread, e.g. 310" autocomplete="off"><button type="button" class="sec" id="shSearchClear" hidden>Clear</button></div>`:''}</div>
 ${P.sum.review-co.length>0?(n=>`<p class="hint">${s2(n)} still need${n===1?'s':''} attention in your project, so ${n===1?"it isn't":"they aren't"} on this list yet.</p>`)(P.sum.review-co.length):''}
 ${tb.length&&FL().retailersFor(P.dest,'310').length?DISC():''}
 <p id="shMsg" class="ok-msg" role="status" aria-live="polite"></p>
 <ul class="shoplist" id="shList">${tb.map(l=>sc(l,false)).join('')}${co.map(t=>`<li class="scard" data-q="${esc((lab(t.it.code)+' '+DMC[t.it.code].name).toLowerCase())}"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${esc(cap(DMC[t.it.code].name))}</div></div><div class="qty unk" style="font-size:.85rem">Amount not entered</div></div><p class="hint">Add the amount in your project to check this color off.</p></li>`).join('')}<li class="noresults" id="shNoRes" hidden></li></ul>
 ${!tb.length&&!co.length?`<div class="empty">${foxSvg('emptyfox')}<b>${aw.length?'All bought!':'Nothing to buy'}</b>${aw.length?'Check threads in below as they arrive.':P.ready?"You're ready to stitch.":'Mark colors as Need to buy in your project to see them here.'}</div>`:''}
 ${aw.length?`<h3>Bought: check in when it arrives (${aw.length})</h3><ul class="shoplist" id="shAw">${aw.map(l=>sc(l,true)).join('')}</ul>`:''}
 <details class="donebox"${done.length&&!tb.length?' open':''}><summary>Done (${done.length})</summary><ul class="shoplist">${done.map(t=>`<li class="scard"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${t.state==='received'?`Received ${t.recv} × ${BRAND[P.dest]} ${esc(disp(P.dest,t.r.to))}`:'You have enough'}</div></div></div>${t.state==='received'?`<div class="acts"><button type="button" class="ghost" id="sx-${esc(t.it.code)}" data-sx="${esc(t.it.code)}">Undo received</button></div>`:''}</li>`).join('')||'<li class="mut" style="list-style:none">Nothing yet.</li>'}</ul></details>
 <details class="shopextra"><summary>Copy, download or print</summary><div class="row"><button type="button" class="sec" id="sCopy">Copy as text</button><button type="button" class="sec" id="sCsv">Download spreadsheet (CSV)</button><button type="button" class="sec" id="sPrint">Print</button></div><p id="sMsg" class="hint" role="status" aria-live="polite"></p><textarea id="sFallback" hidden readonly aria-label="Shopping list text to copy" style="width:100%;min-height:120px"></textarea></details>`;
 const re=msg=>{renderEditor();renderList();if(msg)$('shMsg').textContent=msg};
 $('shBack').onclick=()=>{mode='edit';query='';renderEditor();window.scrollTo(0,0)};
 E.querySelectorAll('[data-sb]').forEach(b=>b.onclick=()=>{shopPanel={key:b.dataset.sb,step:'choose'};renderShop();const f=$('sw-'+sid(b.dataset.sb));if(f)f.focus({preventScroll:true})});
 E.querySelectorAll('[data-sc]').forEach(b=>b.onclick=()=>{const k=shopPanel&&shopPanel.key;shopPanel=null;renderShop();const f=k&&($('sb-'+sid(k))||$('sr-'+sid(k)));if(f)f.focus({preventScroll:true})});
 E.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{shopPanel={key:b.dataset.sw,step:'amount'};renderShop();$('sq-'+sid(b.dataset.sw)).focus({preventScroll:true})});
 E.querySelectorAll('[data-sr]').forEach(b=>b.onclick=()=>{shopPanel={key:b.dataset.sr,step:'amount'};renderShop();$('sq-'+sid(b.dataset.sr)).focus({preventScroll:true})});
 E.querySelectorAll('[data-sd]').forEach(b=>b.onclick=()=>{p.purchased[b.dataset.sd]=true;shopPanel=null;touch(p);re('Marked as bought. Check it in when it arrives.')});
 E.querySelectorAll('[data-su]').forEach(b=>b.onclick=()=>{delete p.purchased[b.dataset.su];touch(p);re('Moved back to your shopping list.')});
 E.querySelectorAll('[data-ss]').forEach(b=>b.onclick=()=>{if(b.disabled)return;const k=sid(b.dataset.ss),v=$('sq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('shMsg').textContent='Enter how many whole skeins you got (1 or more). Nothing changed.';$('sq-'+k).focus();return}b.disabled=true;shopPanel=null;re(receive(p,b.dataset.ss,+v))});
 E.querySelectorAll('[data-sx]').forEach(b=>b.onclick=()=>{const c=b.dataset.sx;if(!confirm(`Undo checking in DMC ${lab(c)}? It goes back on your shopping list.`))return;p.decisions[c].recv=null;touch(p);re(`DMC ${lab(c)} is back on your shopping list.`)});
 const ss=$('shSearch');if(ss){const run=()=>{const q=ss.value.trim().toLowerCase();let n=0;E.querySelectorAll('#shList .scard').forEach(c=>{const sh=!q||c.dataset.q.includes(q);c.hidden=!sh;if(sh)n++});const nr=$('shNoRes');nr.hidden=!q||!!n;nr.textContent=`Nothing on your list matches “${ss.value}”.`;$('shSearchClear').hidden=!q};ss.oninput=run;$('shSearchClear').onclick=()=>{ss.value='';run();ss.focus()}}
 bindOut(p,'s');window.scrollTo(0,y);if(focusId){const f=document.getElementById(focusId);if(f)f.focus({preventScroll:true})}}
function bindEditor(p){const E=$('projEdit'),re=()=>{touch(p);renderEditor();renderList()};
 $('pClose').onclick=closeProject;$('pShop').onclick=()=>openShop(p);$('pDelete').onclick=()=>delProject(p.id);
 $('pName').onchange=()=>{p.name=$('pName').value.trim().slice(0,100)||'Untitled project';touch(p);renderList();renderPlan(p)};
 $('pNotes').onchange=()=>{p.notes=$('pNotes').value.slice(0,2000);touch(p);renderPlan(p)};
 $('pDest').onchange=()=>{p.buyBrand=$('pDest').value;re()};
 $('pSearch').oninput=()=>{query=$('pSearch').value;applyFilter(plan(p))};$('pSearchClear').onclick=()=>{query='';$('pSearch').value='';applyFilter(plan(p));$('pSearch').focus()};
 E.querySelectorAll('[data-filt]').forEach(b=>b.onclick=()=>{filt=b.dataset.filt;E.querySelectorAll('[data-filt]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyFilter(plan(p))});
 $('pAllBuy').onclick=()=>{let n=0;p.items.forEach(it=>{if(!p.decisions[it.code].status){p.decisions[it.code].status='buy';n++}});re();pstatus(`${s2(n)} marked Need to buy.`)};
 E.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>{const c=b.dataset.exp;if(expanded.has(c))expanded.delete(c);else{expanded.add(c);justOpened=c}renderEditor();justOpened=null});
 E.querySelectorAll('[data-st]').forEach(r=>r.onchange=()=>{p.decisions[r.dataset.st].status=r.value;re()});
 E.querySelectorAll('[data-anc]').forEach(s=>s.onchange=()=>{p.decisions[s.dataset.anc].anchor=s.value||null;re()});
 E.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{const c=b.dataset.rr;if(!confirm(`Undo checking in DMC ${lab(c)}? It goes back on your shopping list.`))return;p.decisions[c].recv=null;re();pstatus('Check-in undone.')});
 E.querySelectorAll('[data-q]').forEach(i=>{if(i.tagName!=='INPUT')return;i.onchange=()=>{const v=i.value.trim(),it=p.items.find(x=>x.code===i.dataset.q);
  if(!/^\d+$/.test(v)||+v<1){pstatus(`"${v}" isn't a whole number of skeins (1 or more), so nothing changed. Tick "Not entered" if you don't know.`);i.value=it.qty===null?'':it.qty;return}it.qty=+v;it.stated=true;it.assumed=0;re()}});
 E.querySelectorAll('[data-unk]').forEach(c=>c.onchange=()=>{const it=p.items.find(x=>x.code===c.dataset.unk);if(c.checked){it.qty=null;it.stated=true;it.assumed=0}else{it.qty=1;it.stated=false;it.assumed=1;pstatus('Amount set to 1 skein (assumed). Change it to the real number.')}re()});
 E.querySelectorAll('[data-own]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),d=p.decisions[i.dataset.own];
  if(v===''){d.owned=null;re();return}const n=Number(v);if(!isFinite(n)||n<0){pstatus(`"${v}" isn't a valid amount, so nothing changed.`);i.value=d.owned===null?'':d.owned;return}d.owned=Math.round(n*100)/100;re()});
 E.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const c=b.dataset.rm;if(!confirm(`Remove DMC ${lab(c)} from this project?`))return;p.items=p.items.filter(x=>x.code!==c);delete p.decisions[c];expanded.delete(c);re()});
 $('pAddBtn').onclick=()=>{const {items,errs}=parse($('pAdd').value);items.forEach(n=>{const ex=p.items.find(x=>x.code===n.code);
  if(ex){ex.qty=(ex.qty===null||n.qty===null)?null:ex.qty+n.qty;ex.src=ex.src.concat(n.src);ex.assumed=ex.qty===null?0:asmOf(ex)+asmOf(n);ex.stated=ex.assumed===0}else{p.items.push({code:n.code,qty:n.qty,stated:n.stated,assumed:asmOf(n),src:n.src});p.decisions[n.code]=normDecision(n.code,{})}});
  touch(p);renderEditor();renderList();$('pAddBox').open=true;$('pAddErr').innerHTML=errs.length?`<div class="errbox"><b>${errs.length} couldn't be added:</b><ul>${errs.map(e=>`<li>"${esc(e.t)}": ${esc(e.why)}</li>`).join('')}</ul></div>`:'';if(errs.length)$('pAdd').value=errs.map(e=>e.t).join('\n');pstatus(`Added ${s2(items.length)}.`)}}

// ---- Export / backup / restore ----
const safe=n=>(n||'project').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'project';
function download(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function csv(p){const P=plan(p),q=v=>{v=v===null||v===undefined?'':String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const SN={have:'confirmed sufficient (owned)',received:'confirmed sufficient (received)',buy:'to buy',awaiting:'bought, awaiting confirmation',review:'needs review'};
 const rows=[['project','dmc_code','dmc_name','needed_skeins','quantity_stated','status','owned_skeins','buy_in','will_use','source','to_buy_skeins','bought','received_skeins','readiness','issue','assumed_skeins']];
 P.threads.forEach(t=>{const it=t.it,d=t.d,r=t.r,line=P.lines.find(l=>l.from.includes(it.code));
  rows.push([p.name,lab(it.code),DMC[it.code].name,it.qty===null?'UNKNOWN':it.qty,(a=>a===0?'yes':a>=it.qty?'assumed':'partly assumed')(asmOf(it)),d.status||'not checked',d.owned===null?'':d.owned,BRAND[P.dest],r.ok?disp(P.dest,r.to):'',r.ok?r.prov:'',line?t.rem+(line.from.length>1?` (shared line total ${line.q})`:''):'',line?(line.bought?'yes':'no'):'',t.recv||'',SN[t.state],t.why,it.qty===null?'':asmOf(it)])});
 return rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n'}
function backup(){const d={app:'floss-fox',schema:SCHEMA,exported:nowISO(),projects:store.projects};download(JSON.stringify(d,null,2),'floss-fox-backup-'+nowISO().slice(0,10)+'.json','application/json');pstatus(`Backup downloaded with ${store.projects.length} project(s). Keep the file somewhere safe.`)}
const RPIP=p=>`<picture><source type="image/webp" srcset="assets/pip/pip-${p}-160.webp"><img class="rpip" data-pose="${p}" src="assets/pip/pip-${p}-160.png" width="160" height="240" alt=""></picture>`;
function restoreFile(file){const R=$('restorePanel');if(!file)return;$('backupBox').open=true;if(file.size>5e6){R.hidden=false;R.innerHTML='<b class="warn">That file is too large to be a Floss Fox backup.</b>';return}
 R.hidden=false;R.innerHTML=RPIP('thinking')+'<p>Let me check this backup…</p>'; // shown only while the file is really being read and checked
 file.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){d=null}const m=d&&d.app==='floss-fox'?migrate(d):null;
  if(!m||m.tooNew){pendingRestore=null;R.hidden=false;R.innerHTML=RPIP('puzzled')+`<b class="warn">${m&&m.tooNew?'This backup was made by a newer version of Floss Fox and can\'t be restored here.':'This file isn\'t a valid Floss Fox backup. Nothing was changed.'}</b>`;pstatus('Restore failed: nothing changed.');return}
  pendingRestore=m.data.projects;const clash=pendingRestore.filter(p=>proj(p.id)).length;R.hidden=false;
  R.innerHTML=RPIP('thinking')+`<p><b>I checked it. Backup contains ${pendingRestore.length} project(s)</b>${m.skipped?`; ${m.skipped} damaged or duplicate entr${m.skipped>1?'ies were':'y was'} skipped`:''}. ${clash?`${clash} already exist here (same project).`:'None of them already exist here.'}</p>
  ${clash?`<fieldset><legend>For projects that already exist:</legend><label><input type="radio" name="rmode" value="replace" checked> Replace mine with the backup version</label><br><label><input type="radio" name="rmode" value="skip"> Keep mine, skip those</label><br><label><input type="radio" name="rmode" value="copy"> Keep both (import as a renamed copy)</label></fieldset>`:''}
  <div class="row"><button type="button" class="pri" id="rGo">Restore</button><button type="button" class="sec" id="rCancel">Cancel</button></div>`;
  $('rCancel').onclick=()=>{pendingRestore=null;R.hidden=true;pstatus('Restore cancelled.')};
  $('rGo').onclick=()=>{const modeEl=document.querySelector('input[name=rmode]:checked'),mode=modeEl?modeEl.value:'replace';let add=0,rep=0,skip=0,cp=0;
   pendingRestore.forEach(p=>{const i=store.projects.findIndex(x=>x.id===p.id);if(i<0){store.projects.push(p);add++}else if(mode==='replace'){store.projects[i]=p;rep++}else if(mode==='skip')skip++;else{store.projects.push({...p,id:newId(),name:(p.name+' (restored copy)').slice(0,100)});cp++}});
   pendingRestore=null;R.hidden=true;const ok=save();renderList();if(openId)renderEditor();pstatus(`Restore ${ok?'done':'applied but NOT saved'}: ${add} added, ${rep} replaced, ${skip} skipped, ${cp} copied.`)}})
  .catch(()=>{R.hidden=false;R.innerHTML='<b class="warn">Couldn\'t read that file.</b>'})}

// ---- Wiring ----
function showView(v){const V={convert:['convertView','tabConvert'],projects:['projectsView','tabProjects'],help:['helpView','tabHelp']};
 for(const k in V){const on=k===v;$(V[k][0]).hidden=!on;const t=$(V[k][1]);t.setAttribute('aria-pressed',String(on));if(on)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')}
 if(v==='projects'){renderList();if(openId&&proj(openId)){renderEditor();$('projEdit').hidden=false;$('projListCard').hidden=true}else{$('projEdit').hidden=true;$('projListCard').hidden=false}}window.scrollTo(0,0)}
$('tabConvert').onclick=()=>showView('convert');$('tabProjects').onclick=()=>showView('projects');$('tabHelp').onclick=()=>showView('help');
$('newEmpty').onclick=()=>{if($('newEmpty').disabled)return;$('newEmpty').disabled=true;setTimeout(()=>$('newEmpty').disabled=false,600);const p={id:newId(),name:'Untitled project',notes:'',buyBrand:'dmc',items:[],decisions:{},purchased:{},created:nowISO(),updated:nowISO()};store.projects.push(p);save();renderList();openProject(p.id)};
$('backupBtn').onclick=backup;$('restoreFile').onchange=e=>{restoreFile(e.target.files[0]);e.target.value=''};
let saving=false;
$('saveProj').onclick=()=>{if(saving)return;if(!state.items.length){$('copymsg').textContent='Nothing to save yet. Add your colors first.';return}saving=true;setTimeout(()=>saving=false,800);
 const ex=window.isExample&&window.isExample();
 const p={id:newId(),name:($('newProjName').value.trim()||(ex?'Example project':'Untitled project')).slice(0,100),notes:'',buyBrand:$('dest').value,items:state.items.map(i=>({code:i.code,qty:i.qty,stated:i.stated!==false,assumed:asmOf(i),src:i.src.slice()})),decisions:{},purchased:{},created:nowISO(),updated:nowISO()};
 p.items.forEach(i=>p.decisions[i.code]=normDecision(i.code,{anchor:choice[i.code]||null}));store.projects.push(p);const ok=save();
 $('copymsg').innerHTML=(ok?`✓ Saved "${esc(p.name)}" in this browser.`:`Saved for now only: this browser isn't letting Floss Fox store projects, so download a backup from My projects.`)+` <button type="button" class="pri small" id="openSaved">Check what you have →</button>`;$('newProjName').value='';renderList();
 $('openSaved').onclick=()=>{showView('projects');openProject(p.id)}};
load();renderList();
window.FlossFoxProjects={plan,planText,csv,migrate,_store:()=>store}; // for tests and debugging
})();
