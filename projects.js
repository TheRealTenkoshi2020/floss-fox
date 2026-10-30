// Floss Fox projects: saved locally in this browser. User-entered data lives in `store`;
// conversions, plans and price estimates are always recomputed and never stored.
(function(){
'use strict';
// Organizing Pip (sorting spools): empty / tidy-up states. Full width, bottom never cropped (spools are at the bottom).
const ORG=()=>PIC('organizing','',566);
// Shopping completion (display only: never changes Have/Check/Buy or any inventory status; same text with Pip hidden).
//  stitch : every color confirmed sufficient (have/received), no amount missing or assumed, nothing needing review -> CROSS-STITCH "Ready to start stitching!"
//  done   : nothing left to buy, some threads bought but not checked in yet -> PRESENTING "Shopping list done!" + check-in guidance
//  check  : nothing left to buy, but colors still need attention or amounts are missing/assumed -> REASSURING guidance
//  empty  : nothing on the list yet -> ORGANIZING
const pipOn=()=>!(window.FlossFoxPip&&FlossFoxPip.isHidden&&FlossFoxPip.isHidden());
const PIC=(pose,cls,h)=>pipOn()?`<picture class="orgpip ${cls||''}"><source type="image/webp" srcset="assets/pip/pip-${pose}-160.webp 160w, assets/pip/pip-${pose}-480.webp 480w" sizes="200px"><img src="assets/pip/pip-${pose}-480.png" width="480" height="${h}" alt="" loading="lazy" decoding="async" data-pose="${pose}"></picture>`:'';
const stitchReady=(p,P)=>P.ready&&P.sum.review===0&&P.threads.every(t=>t.req.amount!==null&&!['assumed','partly-assumed','unavailable'].includes(t.req.source));
function shopDone(p,P,tb,aw,where){if(tb.length)return'';
 if(P.sum.checkFirst)return`<div class="empty shopdone" data-done="check">${PIC('reassuring','',631)}<b>Not quite done yet</b>${cfNote(P.sum.checkFirst)} Give those colors a look in <a href="#threads" class="ffcf-thlink" data-ffthreads="1">My threads</a>, then come back here.</div>`;
 if(stitchReady(p,P))return`<div class="empty shopdone" data-done="stitch">${PIC('cross-stitch','xstpip',728)}<b>${P.hasEstimates?'Thread plan covered':'Ready to start stitching!'}</b>${P.hasEstimates?'Every color is covered using your selected estimates. Actual thread use can vary.':'Every color is confirmed. You have enough of each one.'}</div>`;
 if(aw.length)return`<div class="empty shopdone" data-done="done">${PIC('presenting','',665)}<b>Shopping list done! Nice work.</b>${s2(aw.length)} ${aw.length===1?'is':'are'} bought but not checked in yet. Check each one in when it arrives${where==='shop'?' below':''}.</div>`;
 if(P.sum.total&&!P.ready||P.sum.total&&!stitchReady(p,P))return`<div class="empty shopdone" data-done="check">${PIC('reassuring','',631)}<b>Nothing left to buy</b>${P.sum.review?`${s2(P.sum.review)} still need${P.sum.review===1?'s':''} a quick check in your project before you're ready.`:'Some amounts are missing or assumed. Check them in your project to be sure you have enough.'}</div>`;
 return`<div class="empty shopdone" data-done="empty">${PIC('organizing','',566)}<b>Nothing on your shopping list yet</b>Mark colors as Need to buy in your project and they'll show up here.</div>`}
const KEY='flossfox.v1',SCHEMA=2,STATUSES=['have','check','buy'];
const SK=window.FlossFoxSkeins;
// 1.7: optional project status (older data has none -> 'planning'; no schema change)
const PSTAT=[['planning','Planning'],['ready','Ready to stitch'],['progress','In progress'],['done','Completed']];
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
 const meta={};for(const k of ['stitchType','threadFamily'])if(typeof it[k]==='string')meta[k]=it[k].slice(0,40);
 if(it.strandCount!==undefined&&it.strandCount!==null)meta.strandCount=typeof it.strandCount==='number'?it.strandCount:0;
 if(it.blend)meta.blend=true;if(it.stitchCountReviewed===true)meta.stitchCountReviewed=true;
 return{code:it.code,qty:q,stated:a===0,assumed:a,src:Array.isArray(it.src)?it.src.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,200)):[],...meta,
 stitchCount:(v=>Number.isInteger(v)&&v>=0&&v<=10000000?v:null)(it.stitchCount!==undefined?it.stitchCount:it.stitches)}} // Stitch counts remain separate from supplied skeins. Older records default to null.
function normDecision(code,d){d=d&&typeof d==='object'?d:{};const out={status:STATUSES.includes(d.status)?d.status:null,
 owned:(typeof d.owned==='number'&&isFinite(d.owned)&&d.owned>=0)?Math.round(d.owned*100)/100:null,
 anchor:(typeof d.anchor==='string'&&DMC[code].anchor.includes(d.anchor))?d.anchor:null,
 recv:null,ownedSource:['user','collection','unverified'].includes(d.ownedSource)?d.ownedSource:null,ownedPartial:d.ownedPartial===true,
 estimateChecked:typeof d.estimateChecked==='string'?d.estimateChecked.slice(0,200):null};const v=d.recv;
 if(v&&typeof v==='object'&&BRAND[v.brand]&&typeof v.to==='string'&&v.to.length<=20&&typeof v.qty==='number'&&isFinite(v.qty)&&v.qty>0&&v.qty<=1000)out.recv={brand:v.brand,to:v.to,qty:Math.round(v.qty*100)/100};return out}
function normProject(p){if(!p||typeof p!=='object'||typeof p.id!=='string'||!p.id||p.id.length>80||!Array.isArray(p.items))return null;
 const items=[],dec={};
 for(const raw of p.items){const it=normItem(raw);if(!it)return null;const ex=items.find(i=>i.code===it.code);
  if(ex){ex.qty=(ex.qty===null||it.qty===null)?null:ex.qty+it.qty;ex.assumed=ex.qty===null?0:ex.assumed+it.assumed;ex.stated=ex.assumed===0;ex.src=ex.src.concat(it.src);
   ex.stitchCount=ex.stitchCount!==null&&it.stitchCount!==null&&ex.stitchCount+it.stitchCount<=10000000?ex.stitchCount+it.stitchCount:null;
   ex.stitchCountReviewed=ex.stitchCountReviewed===true&&it.stitchCountReviewed===true;
   if(ex.stitchType!==it.stitchType)ex.stitchType='mixed';if(ex.strandCount!==it.strandCount)ex.strandCount=0;if(ex.threadFamily!==it.threadFamily)ex.threadFamily='mixed';if(it.blend)ex.blend=true;
  }else items.push(it)}
 items.forEach(it=>dec[it.code]=normDecision(it.code,p.decisions&&p.decisions[it.code]));
 const purchased={};if(p.purchased&&typeof p.purchased==='object')for(const k of Object.keys(p.purchased))if(p.purchased[k]===true&&k.length<40)purchased[k]=true;
 return{id:p.id,name:str(p.name,100).trim()||'Untitled project',notes:str(p.notes,2000),buyBrand:BRAND[p.buyBrand]?p.buyBrand:'dmc',
  items,decisions:dec,purchased,status:PSTAT.some(x=>x[0]===p.status)?p.status:'planning',...(p.skeinEstimator!==undefined?{skeinEstimator:SK.normalize(p.skeinEstimator)}:{}),...(p.demo===true?{demo:true}:{}),...(()=>{/* optional, additive (dev pattern trust): only present when a pattern check left something to fix or undo */const T=window.FlossFoxPatternTrust,pc=p.pcheck&&typeof p.pcheck==='object'?(T?T.normPcheck(p.pcheck):JSON.parse(JSON.stringify(p.pcheck))):undefined;return pc?{pcheck:pc}:{}})(),created:str(p.created,40)||nowISO(),updated:str(p.updated,40)||nowISO()}}
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
 try{raw=localStorage.getItem(KEY)}catch(e){canSave=false;storeMsg('<b>Saving is unavailable in this browser</b> (private mode or blocked storage). Your projects will only last until you close this tab. Use <b>Download a backup</b> to keep them.');return}
 if(raw===null)return;let d;
 try{d=JSON.parse(raw)}catch(e){d=null}
 const m=d&&migrate(d);
 if(!m||m.tooNew){canSave=false;try{localStorage.setItem(KEY+'.unreadable-'+Date.now(),raw)}catch(e){}
  storeMsg(m&&m.tooNew?'<b>Your saved projects were made by a newer version of Floss Fox.</b> We\'ve left them untouched and paused saving so nothing gets overwritten. Reload the page to get the latest version.':'<b>We couldn\'t read your saved project data.</b> We\'ve left it untouched (a copy is kept) and paused saving so nothing gets overwritten. You can restore from a backup, or <button type="button" class="sec" id="resetStore">start fresh</button>.');
  const r=$('resetStore');if(r)r.onclick=()=>{if(confirm('Start fresh? The unreadable data stays in browser storage under a separate name, but Floss Fox won\'t show it anymore.')){canSave=true;store={schema:SCHEMA,projects:[]};save();storeMsg('');renderList()}};return}
 store=m.data;if(m.skipped)storeMsg(`${plural(m.skipped,'saved project')} ${m.skipped===1?'was':'were'} damaged, so we skipped ${m.skipped===1?'it':'them'}.`)}
function save(){if(!canSave){pstatus('Not saved: browser storage is unavailable or paused. Download a backup to keep your work.');return false}
 try{localStorage.setItem(KEY,JSON.stringify(store));window.dispatchEvent(new CustomEvent('ff:data-saved',{detail:{area:'projects'}}));return true}
 catch(e){const full=e&&(e.name==='QuotaExceededError'||e.code===22);pstatus(full?'Not saved: browser storage is full. Download a backup, then delete old projects.':'Not saved: your browser blocked the save. Download a backup to keep your work.');return false}}
const proj=id=>store.projects.find(p=>p.id===id);
let fillUndo=null;
function touch(p){p.updated=nowISO();save()}
function edited(p){if(typeof undoBy!=='undefined')delete undoBy[p.id]}

// ---- Plan: derived only (never stored) ----
function plainWhy(it,r){const f=fam(it.code),c=lab(it.code);if(f!=='solid')return`This is a ${f} thread, so there's no automatic brand swap. Buy the original DMC ${c} (set Brand to buy to DMC).`;
 if(/Sullivans/.test(r.why||''))return`There's no Sullivans match on the chart. Buy DMC ${c} instead (set Brand to buy to DMC).`;if(/Anchor/.test(r.why||''))return`There's no Anchor match on the chart. Buy DMC ${c} instead (set Brand to buy to DMC).`;return r.why||'Needs a look.'}
function estimateInput(it){
 if(it.stitchCountReviewed!==true&&it.stitchCount!=null&&it.src&&it.src.length>1&&it.src.some(src=>{const found=parse(src).items.find(x=>x.code===it.code);return!found||found.stitchCount==null}))return{...it,countIncomplete:true};
 return it;
}
const estimateProject=p=>({...p,items:p.items.map(estimateInput)});
const reqOf=(p,it)=>SK.requirement(estimateInput(it),p.skeinEstimator,DMC,fam(it.code),p.buyBrand);
const needOf=(p,it)=>{const r=reqOf(p,it);return r.amount===null?'amount not entered':r.source==='estimated'?`about ${SK.fmt(r.amount)} skeins (Pip estimate, including extra)`:plural(r.amount,'skein')+asmTxt(it.qty,asmOf(it))};
// ci005-67: readiness from My threads, derived when the plan is drawn (never saved). Reuses cmpPlan ("Use my collection") on colors
// with no decision yet (blank), so an explicit status always wins. Skeins set aside for other projects are not counted (allocations).
// Covered -> Have enough, short -> Need to buy the shortfall; owned with no amount set -> Have enough (Myke, Oct 26) unless partial/estimated/assumed.
// Missing and caution cases (not confirmed, partial, match to check) are left as they are.
// My threads minus skeins set aside for other projects (shared by the Shop overlay and the new-project auto-apply, ci005-69).
function allocE(p,T){let E=p.demo?(T.data().demo||{}):T.data().threads;
 if(!p.demo&&AL()){const data=ALS().read(),col=COL();E=Object.fromEntries(Object.entries(E).map(([c,e])=>{const a=AL().summary(data,col,c,p.id);return[c,a&&a.availableForProject!==null&&a.availableForProject<e.n?{...e,n:a.availableForProject}:e]}))}
 return E}
function collOverlay(p){const T=window.FlossFoxThreadsUI;if(!T||!T.core)return null;
 try{if(!p.items.some(it=>p.decisions[it.code]&&blank(p.decisions[it.code])))return null;const E=allocE(p,T);
  const {r,ch}=cmpPlan(p,T,E),o={},nu=new Set(r.unverified.filter(x=>(x.need===null||x.need===undefined)&&!x.estimated&&!x.partial&&!x.assumed&&x.have>0).map(x=>x.code));
  ch.forEach(c=>{if(!blank(p.decisions[c.code]))return;if(c.why==='owned'||c.why==='short')o[c.code]=c.to;else if(nu.has(c.code))o[c.code]={...c.to,status:'have'}});
  return Object.keys(o).length?o:null}catch(e){return null}}
function plan(p){const dest=p.buyBrand,threads=[],ov=collOverlay(p);
 // Per-thread state (derived, deterministic): have | received | buy | awaiting | review
 p.items.forEach(it=>{const d=ov&&ov[it.code]?{...p.decisions[it.code],...ov[it.code]}:p.decisions[it.code],r=resolve(it,dest,d.anchor),rq=reqOf(p,it),req=rq.amount,own=d.owned;const t={it,d,r,req:rq,estimated:rq.source==='estimated',state:'review',why:'',q:0,rem:0,recv:0,recvOther:false};threads.push(t);
  const needsPick=dest==='anchor'&&fam(it.code)==='solid'&&!d.anchor&&(r.review||DMC[it.code].anchor.length>1);
  const K=(k,w)=>{t.kind=k;t.why=w};
  if(needsPick){t.cau='match';K('match',r.review?'Sources disagree on the Anchor match for white. Choose the one you want in Details.':'The chart lists more than one Anchor match. Choose the one you want in Details.');return}
  if(d.status==='have'){if(t.estimated||rq.source==='unavailable'&&it.qty!==null&&asmOf(it)>0){t.state='have';t.recheck=!t.estimated||d.estimateChecked!==SK.fingerprint(it,p.skeinEstimator,rq.estimate);return}
   if(req===null){t.state='have';t.noAmt=true}else if(own!==null&&own<req)t.cau='have',K('other',`You noted ${own} skein${own===1?'':'s'}, but the pattern needs ${req}. Choose Need to buy, or update what you have.`);else t.state='have';return}
  if(d.status==='check'){K('unsure',`Check your threads, then choose Have enough or Need to buy.${own!==null?` (You noted ${own}.)`:''}${req===null?" The amount needed isn't entered.":''}`);return}
  if(d.status!=='buy'){K('unchecked','Choose Have enough, Need to buy or Not sure.');return}
  if(!r.ok){t.cau='match';K('other',plainWhy(it,r));return}
  if(req===null){K(rq.source==='unavailable'?'estimate':'amount',rq.reason||'How many skeins does your pattern need? Add it in Details so this color can be checked off.');return}
  if(t.estimated&&own!==null&&!['user','collection'].includes(d.ownedSource)){K('estimate','Check the recorded amount you own in Details before subtracting it from Pip’s estimate.');return}
  if(t.estimated){const v=SK.compareStock(req,own===null?0:own,d.ownedPartial);if(v.kind==='check-first'){t.cau='partial';K('estimate','You have a partial skein. Check its amount before buying more.');return}t.q=v.buy;
   if(t.q===0){t.state='have';return}
  }else t.q=own===null?req:Math.ceil(req-own-1e-9);
  if(t.q<=0){t.cau='have';t.kind='other';t.why=`You noted ${own}, which covers the ${req} needed. Choose Have enough instead?`;return}
  if(d.recv){if(d.recv.brand===dest&&d.recv.to===r.to)t.recv=d.recv.qty;else t.recvOther=true}
  t.rem=Math.max(0,Math.ceil(t.q-t.recv-1e-9));t.state=t.rem<=0?'received':'buy'});
 const groups={};threads.filter(t=>t.state==='buy').forEach(t=>{const g=groups[t.r.to]||(groups[t.r.to]={to:t.r.to,q:0,from:[],prov:new Set(),partial:false,recvd:0,ts:[]});g.q+=t.rem;g.from.push(t.it.code);g.prov.add(t.r.prov);g.partial=g.partial||t.d.owned!==null;g.recvd+=t.recv;g.ts.push(t)});
 const lines=Object.values(groups).map(g=>{const key=dest+':'+g.to,bought=!!p.purchased[key];if(bought)g.ts.forEach(t=>t.state='awaiting');return{...g,key,bought}});
 const by=st=>threads.filter(t=>st.includes(t.state));
 // Check first: colors not decided yet: Not sure (incl. 'owned, quantity not verified' from Use my collection), not checked,
 // Have enough with no amount entered, or a brand match to confirm. An explicit 'Have enough' with a known amount is the user's own check.
 // They are never on the buy list and never priced,
 // and while any remain the list is not complete (no "done"/"ready" states). Buy + no amount stays under Need to buy.
 const checkFirst=threads.filter(t=>t.state==='review'&&!(t.kind==='amount'&&t.d.status==='buy'));
 checkFirst.forEach(t=>{t.cf=true});
 const sum={sufficient:by(['have','received']).length,toBuy:by(['buy']).length,awaiting:by(['awaiting']).length,review:by(['review']).length,checkFirst:checkFirst.length,total:threads.length};
 return{dest,threads,lines,checkFirst,review:by(['review']),have:by(['have','received']),sum,hasEstimates:threads.some(t=>t.estimated),ready:sum.total>0&&sum.sufficient===sum.total&&!checkFirst.length}}
const cfWhy=t=>t.state==='have'?(t.it.qty===null?'marked Have enough, but the amount needed isn\'t entered':'marked Have enough, but the amount needed is assumed (1 skein), not from your pattern'):t.kind==='unsure'?'marked Not sure':t.kind==='unchecked'?'not checked yet':t.kind==='amount'?'amount needed not entered':t.kind==='estimate'?t.why:t.kind==='match'?'brand match to confirm':'needs a second look';
/* ci005-61: Check first rows get the Store Mode Buy chooser (same verified FlossFoxSkeinPreview links and fallbacks) plus quick status buttons.
   Buy is read-only: it never changes a status or marks anything bought. The link lookup needs a whole-number amount, so colors with no amount look up with 1 (links don't depend on it). */
const CFS={shopNote:n=>`${n===1?'This color still needs a look. Check it in':'These colors still need a look. Check them in'} <a href="#threads" class="ffcf-thlink" data-ffthreads="1">My threads</a>${n===1?', or buy it if you already know you need it.':', or buy any you already know you need.'}`,rowLab:t=>`DMC ${esc(lab(t.it.code))}${t.it.qty===null?' · amount not set yet':''}`,note:n=>n===1?'This color isn\'t on your list or in your cost estimate yet. Tap Have enough or Need to buy.':'These colors aren\'t on your list or in your cost estimate yet. Tap Have enough or Need to buy for each one.',buyNote:'This color isn\'t in your cost estimate yet. Opening a store won\'t mark it as Need to buy or Bought.',have:'Have enough',buy:'Need to buy'};
function cfLinks(P){const SPL=window.FlossFoxSkeinPreview,o={};if(!(window.FLOSS_FOX_ENV==='preview'||window.FLOSS_FOX_DIRECT_LINKS===true)||!SPL)return o;
 try{const nd=P.checkFirst.map(t=>({brand:P.dest,code:t.it.code,family:fam(t.it.code)==='solid'?'six-strand-cotton':'specialty',pack:'single-skein',qty:Number.isSafeInteger(t.it.qty)&&t.it.qty>=1?Math.min(t.it.qty,9999):1,assumed:true,disputed:['WHITE','BLANC','B5200'].includes(String(t.it.code).toUpperCase())&&P.dest!=='dmc'}));
  const by=new Map(SPL.rowsFor(nd,'direct').map(r=>[r.code,r]));P.checkFirst.forEach((t,i)=>{const n=nd[i],r=SPL.eligible(n,'direct')&&by.get(SPL.normalize(n.code));if(r&&r.links.length)o[t.it.code]=r.links})}catch(e){}return o}
const cfPill=l=>`<a class="ff-skein-pill" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-store="${esc(l.storeId)}" data-match="${esc(l.type)}" data-kind="direct" data-tracked="false" aria-label="${esc(l.label)} (opens in new tab)" title="${esc(l.hint)}">${esc(l.exact?l.storeName:'Search '+l.storeName)}</a>`;
function cfActs(t,L,pre,buyOnly){const c=esc(t.it.code),n=esc(lab(t.it.code)),id=pre+'-'+c.replace(/[^A-Za-z0-9_-]/g,'_');
 return`<div class="ffcf-acts noprint">${buyOnly?'':`<button type="button" class="sec small" data-cfst="${c}" data-v="have" aria-label="DMC ${n}: ${CFS.have}">${CFS.have}</button><button type="button" class="sec small" data-cfst="${c}" data-v="buy" aria-label="DMC ${n}: ${CFS.buy}">${CFS.buy}</button>`}${L?`<span class="ffcf-buyrow"><button type="button" class="sec small ffcf-buybtn" data-cfbuy="${id}" aria-expanded="false" aria-controls="${id}" aria-label="Buy DMC ${n}: choose a store">Buy</button></span>`:''}</div>${L?`<div class="ff-skein-inline ffsm-buy ffcf-buy noprint" id="${id}" role="group" aria-label="Store links for DMC ${n}" hidden><p class="hint ffcf-buynote">${CFS.buyNote}</p>${L.map(cfPill).join('')}</div>`:''}`}
function setStatus(p,code,v){const it=p.items.find(x=>x.code===code),d=p.decisions[code];if(!it||!d)return false;const rq=reqOf(p,it);d.status=v;d.estimateChecked=v==='have'&&rq.source==='estimated'?SK.fingerprint(it,p.skeinEstimator,rq.estimate):null;return true}
document.addEventListener('click',e=>{const a=e.target&&e.target.closest&&e.target.closest('[data-ffthreads]');if(a){e.preventDefault();showView('threads');return}});
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-cfbuy],[data-cfst]');if(!b)return;
 if(b.dataset.cfbuy){const c=document.getElementById(b.dataset.cfbuy);if(!c)return;const o=c.hidden;c.hidden=!o;b.setAttribute('aria-expanded',String(o));if(o){const a=c.querySelector('a');if(a)a.focus({preventScroll:true})}return}
 const p=openId&&proj(openId),li=b.closest('li'),nx=li&&(li.nextElementSibling||li.previousElementSibling),nxc=nx&&(nx.querySelector('[data-cfst]')||{dataset:{}}).dataset.cfst,ul=li&&li.parentElement&&li.parentElement.id;if(!p||!setStatus(p,b.dataset.cfst,b.dataset.v))return;const code=b.dataset.cfst,inStore=!!b.closest('#pStore'),inShop=!!b.closest('#shCheck');edited(p);touch(p);renderEditor();renderList();
 const m=$(inStore?'smSum':inShop?'shMsg':'pMsg');if(m)m.textContent=`DMC ${lab(code)}: ${b.dataset.v==='have'?CFS.have:CFS.buy}.`;const nb=nxc&&ul&&document.querySelector(`#${ul} [data-cfst="${CSS.escape(nxc)}"][data-v="have"]`);const f=nb||$(inStore?'smFind':inShop?'shH':'pCheckH')||$('pShopH');if(f)f.focus({preventScroll:true})});
const cfNote=n=>`${s2(n)} still need${n===1?'s':''} checking before this list is complete.`;
// Pip celebrates once per real not-ready -> ready transition (pose only, no bubble: the headline right beside it already says it).
const CEL=()=>{setTimeout(()=>{const f=document.getElementById('pCel');if(f){f.classList.remove('pip-cheer')}},4000);
 return`<span class="pcel pipfig pip-cheer" id="pCel" aria-hidden="true"><picture><source type="image/webp" srcset="assets/pip/pip-celebrating-160.webp 160w, assets/pip/pip-celebrating-320.webp 320w" sizes="64px"><img src="assets/pip/pip-celebrating-160.png" width="160" height="243" alt=""></picture></span>`};
const CAP=()=>(window.FlossFoxParse&&FlossFoxParse.SKEIN_CAP)||20;
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
// The estimate covers Need to buy only: check-first colors may already be owned, so pricing them would overstate the cost.
function costLine(P){const p=PRICES[P.dest];let k=0,unpriced=0;P.lines.forEach(l=>{if(l.from.every(c=>fam(c)==='solid'))k+=l.q;else unpriced++});const cf=P.sum.checkFirst;
 const cfT=cf?` Not included: ${s2(cf)} in Check first (you may already own ${cf===1?'it':'them'}), so the total may change.`:'';
 if(!P.lines.length)return(cf?'Nothing on your shopping list yet, so there\'s no cost to estimate.':'Nothing left to buy.')+cfT;
 return`Rough cost of Need to buy only: ≈ ${rng(p.lo*k,p.hi*k)} USD for ${plural(P.lines.reduce((a,l)=>a+l.q,0),'skein')}${unpriced?` (plus ${plural(unpriced,'specialty thread')} with no price)`:''}.${cfT||' Colors that still need attention aren\'t included.'} Prices were checked ${PRICES.checked} and vary by store.`}
const lineTxt=(P,l)=>`${BRAND[P.dest]} ${disp(P.dest,l.to)} x${l.q} (for DMC ${l.from.map(lab).join(', ')}; ${[...l.prov].join('; ')}${l.partial?'; after subtracting what you have, rounded up to whole skeins':''}${l.recvd?`; ${l.recvd} already received`:''}${l.ts.some(t=>t.estimated)?'; uses Pip estimates including extra':''}${l.ts.some(t=>!t.estimated&&asmOf(t.it)>0)?'; includes an assumed amount':''})${l.from.length>1?' ⚠ note: several pattern colors share this thread':''}`;
const needTxt=(it,p)=>p?needOf(p,it):it.qty===null?'amount not entered':plural(it.qty,'skein')+asmTxt(it.qty,asmOf(it));
function planText(p){const P=plan(p),o=[`${APP_NAME} project: ${p.name}`,`Brand to buy: ${BRAND[P.dest]}`,readyText(P,p),summaryText(P),...(P.sum.checkFirst?['NOTE: '+cfNote(P.sum.checkFirst)]:[]),''];
 const tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),co=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy');
 o.push('NEED TO BUY:');if(!tb.length&&!co.length)o.push('- none');tb.forEach(l=>o.push('[ ] '+lineTxt(P,l)));co.forEach(t=>o.push(`[ ] DMC ${lab(t.it.code)}: amount not entered (add it to check this color off)`));
 o.push('','CHECK FIRST (not on the buy list yet; you may already have these):');if(!P.checkFirst.length)o.push('- none');P.checkFirst.forEach(t=>o.push(`[?] DMC ${lab(t.it.code)} (needs ${needTxt(t.it,p)}): ${cfWhy(t)}`));
 o.push('','BOUGHT, CHECK IN WHEN IT ARRIVES (not counted as ready yet):');if(!aw.length)o.push('- none');aw.forEach(l=>o.push('[x] '+lineTxt(P,l)));
 const ra=P.review.filter(x=>!x.cf);o.push('','NEEDS ATTENTION (not on the buy list yet):');if(!ra.length)o.push('- none');ra.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (needs ${needTxt(x.it,p)}): ${(KIND[x.kind]||KIND.other)[1]}. ${x.why}`));
 const hv=P.have.filter(x=>!x.cf);o.push('','READY (you have enough or received it):');if(!hv.length)o.push('- none');hv.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (needs ${needTxt(x.it,p)}${x.d.owned!==null?`, you have ${x.d.owned}`:''}${x.state==='received'?`, received ${x.recv} ${BRAND[P.dest]} ${disp(P.dest,x.r.to)}`:', already had it'})`));
 if(p.notes)o.push('','Notes: '+p.notes);const estimates=SK.text(estimateProject(p),DMC,fam);if(estimates)o.push('',estimates);o.push('',costLine(P),'Color swatches and brand matches are approximate. Compare real thread before swapping.');return o.join('\n')}
function summaryText(P){const s=P.sum;return`${s.sufficient-P.have.filter(x=>x.cf).length} of ${s.total} colors ready · ${s.toBuy} to buy · ${s.awaiting} bought, waiting to check in · ${s.review} need attention${s.checkFirst?` · ${s.checkFirst} to check first`:''}`}
function readyText(P,p){if(!p.items.length)return'No colors in this project yet.';if(!P.ready&&!P.sum.toBuy&&!P.sum.awaiting&&P.sum.checkFirst)return`Not ready yet: ${cfNote(P.sum.checkFirst)}`;return P.ready?(P.hasEstimates?'Thread plan covered using Pip’s estimates. Actual use can vary.':"Ready to stitch: all your threads are accounted for."):`Not ready yet: ${s2(P.sum.toBuy)} to buy, ${P.sum.awaiting} bought (waiting to check in), ${P.sum.review} need attention.`}
const s2=n=>plural(n,'color');
function receive(p,key,n){const P=plan(p),l=P.lines.find(x=>x.key===key);if(!l)return'';let left=n;
 l.ts.forEach(t=>{const take=Math.min(left,t.rem);if(take>0){const prev=(t.d.recv&&t.d.recv.brand===P.dest&&t.d.recv.to===t.r.to)?t.d.recv.qty:0;p.decisions[t.it.code].recv={brand:P.dest,to:t.r.to,qty:prev+take};left-=take}});
 delete p.purchased[key];touch(p);const nm=`${BRAND[P.dest]} ${disp(P.dest,l.to)}`;return n>=l.q?`✓ ${nm} checked in: ${plural(n,'skein')} received. You have enough now.`:`${plural(n,'skein')} of ${nm} received. ${l.q-n} more still needed, so it's back on your shopping list.`}

// ---- Rendering ----
const foxSvg=cls=>{const l=document.querySelector('header .logo');return l?l.outerHTML.replace('class="logo"',`class="${cls}" aria-hidden="true"`).replace(/role="img" aria-label="[^"]*"/,''):''};
function renderList(){const L=$('projList');$('projCount').textContent=store.projects.length?`(${store.projects.length})`:'';
 L.innerHTML=store.projects.length?store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated)).map(p=>{const P=plan(p);
  return`<li><span><span class="pname">${esc(p.name)}</span>${p.demo?' <span class="tag demotag">Demo</span>':''}<br><small class="mut">${s2(p.items.length)}${(n=>n?` · <span class="stc">${n.toLocaleString('en-US')} stitches</span>`:'')(p.items.reduce((a,i)=>a+(i.stitchCount||0),0))} · <span class="pst">${esc((PSTAT.find(x=>x[0]===p.status)||PSTAT[0])[1])}</span> · ${P.ready?'<b class="ok-msg">✓ Ready to stitch</b>':`${P.sum.sufficient} of ${P.sum.total} ready${P.sum.toBuy?` · ${P.sum.toBuy} to buy`:''}${P.sum.review?` · ${P.sum.review} need attention`:''}`} · updated ${esc(p.updated.slice(0,10))}</small></span><span class="row" style="margin:0"><button type="button" class="sec" data-open="${esc(p.id)}">Open<span class="sr"> ${esc(p.name)}</span></button><button type="button" class="ghost" data-del="${esc(p.id)}">Delete<span class="sr"> ${esc(p.name)}</span></button></span></li>`}).join('')+'<li class="storeline" style="display:block;border:0">Saved in this browser only. Open <b>Download a backup</b> below to keep a copy.</li>'
  :`<li class="empty">${ORG()}<b>Every masterpiece begins with a single stitch</b>Paste your colors on the Find floss tab, then save them as a project to check what you have.<div class="row" style="justify-content:center"><button type="button" class="pri" id="emptyImport">${esc(FS('importLabel')||'Import a pattern (PDF)')}</button><button type="button" class="sec" id="emptyAdd">Add my colors</button></div></li>`;
 L.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
 L.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delProject(b.dataset.del));{const ol=$('projOpenLast');if(ol){const last=store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated))[0];ol.hidden=!last;if(last){const H=(window.FF_STR||{}).helpAlt||{},nm=last.name.length>18?last.name.slice(0,18)+'…':last.name,lb=FX(H.projectsHas,{name:nm});ol.textContent=lb&&lb.length<=28?lb:(H.projectsHasFallback||'Open my last project');ol.onclick=()=>openProject(last.id)}}}
 const ea=$('emptyAdd');if(ea)ea.onclick=()=>{showView('convert');$('inp').focus()};const ei=$('emptyImport');if(ei)ei.onclick=()=>window.FFImportOpen&&window.FFImportOpen()}
async function delProject(id){const p=proj(id);if(!p)return;
 const ok=await FlossFoxConfirm.ask({pose:'worried',title:`Delete "${p.name}"?`,
  body:"Are you sure? This removes the project from this browser, and it can't be undone unless you have a backup."+(kitCount(id)?` Its ${plural(kitCount(id),'set-aside skein')} go${kitCount(id)===1?'es':''} back to your free threads.`:''),go:'Delete'});
 if(!ok)return;
 {const S=ALS();if(S&&S.writable())S.read().allocations.filter(r=>r.projectId===id).forEach(r=>S.update({projectId:id,code:r.code,qty:0},{projects:store.projects,collection:COL()}))}
 store.projects=store.projects.filter(x=>x.id!==id);save();if(openId===id){openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false}ensureShop();renderList();pstatus(`Deleted "${p.name}".`)}
var kitFresh=false;
function openProject(id,m){kitFresh=true;{const pc=$('planCard');if(pc&&!pc.hidden){pc.hidden=true;pc.innerHTML=''}}if(openId!==id){expanded.clear();touched.clear();haveShown=false;filt='all';query='';shopPanel=null;if(typeof openSec==='object')for(const k in openSec)delete openSec[k]}openId=id;mode=m||'edit';{const pp=proj(id);if(pp)autoCmp(pp)}renderEditor();$('projEdit').hidden=false;$('projListCard').hidden=true;window.scrollTo(0,0);pstatus(`Back in the hoop: “${proj(id).name}”.`)}
function closeProject(){setTimeout(ensureShop);if(window.FlossFoxThreadsUI)FlossFoxThreadsUI.tipDone('compare');openId=null;mode='edit';$('projEdit').hidden=true;$('projListCard').hidden=false;renderList()}
function destCell(p,it){const d=p.decisions[it.code],dest=p.buyBrand,c=it.code,f=fam(c),L=esc(lab(c));
 if(dest==='anchor'&&f==='solid'&&DMC[c].anchor.length>1||dest==='anchor'&&(c==='WHITE'||c==='BLANC'||c==='B5200')&&DMC[c].anchor.length){const disputed=c==='WHITE'||c==='BLANC'||c==='B5200';
  return`<label class="flbl" for="anc-${esc(c)}">Choose the Anchor match</label><select id="anc-${esc(c)}" data-anc="${esc(c)}"><option value=""${d.anchor?'':' selected'}>Choose a match…</option>${DMC[c].anchor.map(a=>`<option value="${esc(a)}"${d.anchor===a?' selected':''}>Anchor ${esc(a)}</option>`).join('')}</select><p class="hint">${disputed?esc(WHITE_DISPUTE):'The chart lists more than one Anchor match for this color. Pick the one you want to use.'}</p>`}
 const r=resolve(it,dest,d.anchor);return`<span class="flbl">Brand match</span>`+(r.ok?`<b>${BRAND[dest]} ${esc(disp(dest,r.to))}</b> <small class="mut">(${esc(r.prov)})</small>`:`<span>${esc(plainWhy(it,r))}</span>`)}
const expanded=new Set(),touched=new Set();let haveShown=false,justOpened=null,filt='all',query='',mode='edit',shopPanel=null;
const sid=k=>k.replace(/[^\w-]/g,'_');
const KIND={amount:['✎','Add the amount'],estimate:['?','Check the estimate or stock'],match:['?','Confirm the color match'],unsure:['?','Not sure yet'],unchecked:['○','Not checked yet'],other:['!','Needs a look']};
// Short visible caution notes (full sentence stays in Details). Wording pending Pixel.
const CAUT={match:'Check this match',estimate:'Amount is an estimate',partial:'Partial skein, check how much is left',have:'Check the amount you have',recv:'Another brand is checked in'};
function cautOf(t,d){if(t.cau&&t.state==='review')return CAUT[t.cau];if(t.recvOther)return CAUT.recv;if(t.estimated||t.state==='review'&&t.kind==='estimate')return CAUT.estimate;if(d&&d.ownedPartial&&t.state!=='have'&&t.state!=='received')return CAUT.partial;return''}
function statInfo(t){if(t.state==='have')return['✓','You have enough'];if(t.state==='received')return['✓','Received: ready'];if(t.state==='buy')return['🛒',`Need to buy · ${plural(t.rem,'skein')}`];if(t.state==='awaiting')return['📦','Bought: check it in when it arrives'];return KIND[t.kind]||KIND.other}
const FILTERS=[['all','All'],['todo','Not ready yet'],['buy','Need to buy'],['att','Needs attention'],['ready','Ready']];
const inFilter=(t,f)=>f==='all'||(f==='todo'&&!['have','received'].includes(t.state))||(f==='buy'&&['buy','awaiting'].includes(t.state))||(f==='att'&&t.state==='review')||(f==='ready'&&['have','received'].includes(t.state));
const ABBR={vy:'very',dk:'dark',lt:'light',md:'medium',ul:'ultra',ult:'ultra',med:'medium'};
const cap=t=>{if(!t)return t;t=t.replace(/\b(vy|dk|lt|md|ul|ult|med)\b\.?/gi,m=>ABBR[m.replace('.','').toLowerCase()]);return t[0].toUpperCase()+t.slice(1)};
const STLBL={have:'Have enough',buy:'Need to buy',check:'Not sure'};
function card(p,P,t){const it=t.it,d=t.d,c=esc(it.code),e=DMC[it.code],f=fam(it.code),open=expanded.has(it.code),L=esc(lab(it.code)),si=statInfo(t);
 const cmp=!open&&!touched.has(it.code)&&(t.state==='have'||t.state==='buy');
 return`<li class="tcard st-${t.state}${t.kind?' k-'+t.kind:''}${cmp?' cmp':''}" id="card-${c}" data-code="${c}" data-search="${esc((lab(it.code)+' '+e.name+' '+(t.r.ok?t.r.to:'')).toLowerCase())}"><div class="main"><div class="top">
 <span class="bigsw" style="background:${e.hex}" title="Approximate DMC color"></span>
 <div class="ident"><div class="code">DMC ${L}${f!=='solid'?` <span class="tag">${f}</span>`:''}</div><div class="cname">${esc(cap(e.name))}${P.dest!=='dmc'&&t.r.ok?` · use <b>${BRAND[P.dest]} ${esc(disp(P.dest,t.r.to))}</b>`:''}</div>
 <div class="need">${needOf(p,it)==='amount not entered'?'<span class="unk">Amount needed: not entered</span>':`${esc((n=>{const m=/^(\d[\d,]* skeins?)(.*)$/.exec(n);return m?m[1]+' needed'+m[2]:n+' needed'})(needOf(p,it)))}`}${it.stitchCount!==null&&it.stitchCount!==undefined?` <span class="stc">· ${it.stitchCount.toLocaleString('en-US')} stitches</span>`:''}${t.recheck?'<span class="skein-note">We kept your Have enough choice. Re-check the amount after changing counts or settings.</span>':''}</div>
 <div class="stat ${t.state}${t.kind?' k-'+t.kind:''}"><span aria-hidden="true">${si[0]}</span> ${si[1]}</div></div>
 <button type="button" class="sec exp" id="x-${c}" data-exp="${c}" aria-expanded="${open}" aria-controls="det-${c}">${open?'Hide details':'Details'}<span class="sr"> for DMC ${L}</span></button></div>
 <div class="seg" role="radiogroup" aria-label="Do you have DMC ${L}?">${['have','buy','check'].map(s=>`<label><input type="radio" name="st-${c}" id="st-${c}-${s}" value="${s}" data-st="${c}" ${d.status===s?'checked':''}><span>${STLBL[s]}</span></label>`).join('')}</div></div>
 ${(k=>k?`<div class="caut" id="cau-${c}">${esc(k)}</div>`:'')((k=>k===CAUT.match&&si[1]===KIND.match[1]?'':k)(cautOf(t,d)))}
 <div class="tdet${justOpened===it.code?' anim':''}" id="det-${c}" ${open?'':'hidden'}>${t.state==='review'?`<p class="why">${esc(t.why)}</p>`:''}${t.recvOther?'<p class="why">A thread you checked in for a different brand isn\'t counted here.</p>':''}
  <div class="fldrow"><div class="fld"><label for="q-${c}">Amount needed (skeins)</label><input type="number" class="qbox" id="q-${c}" data-q="${c}" min="1" step="1" inputmode="numeric" value="${it.qty===null?'':it.qty}" ${it.qty===null?'disabled':''}><label class="inl"><input type="checkbox" id="u-${c}" data-unk="${c}" ${it.qty===null?'checked':''}> Not entered</label></div>
  <div class="fld"><label for="o-${c}">You already have (skeins, optional)</label><input type="number" class="qbox" id="o-${c}" data-own="${c}" min="0" step="0.25" inputmode="decimal" value="${d.owned===null?'':d.owned}" placeholder="?" aria-describedby="oh-${c}"><div class="hint" id="oh-${c}">Use 0.5 for a partly used skein. Leave empty if you're not sure.${d.ownedPartial?' Your collection also has a partial skein of unknown size. Enter a checked total to include it.':''}</div>${t.estimated&&d.owned!==null&&!['user','collection'].includes(d.ownedSource)?`<button type="button" class="sec small" data-own-confirm="${c}">Confirm this amount${d.ownedPartial?' without the partial':''}</button>`:''}</div></div>
  <div class="fldrow"><div class="fld"><label for="sc-${c}">Full-cross count for this color</label><input type="number" class="qbox skein-count" id="sc-${c}" data-stitches="${c}" min="0" max="10000000" step="1" inputmode="numeric" value="${it.stitchCount==null?'':it.stitchCount}" placeholder="Not given">${estimateInput(it).countIncomplete?`<button type="button" class="sec small" data-count-confirm="${c}">Confirm this is the complete count</button>`:''}</div>
  <div class="fld"><label for="ss-${c}">Pattern’s strands (optional)</label><select id="ss-${c}" data-strands="${c}"><option value="">Use project default</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}"${it.strandCount===n?' selected':''}>${n} strands</option>`).join('')}</select></div>
  <div class="fld"><label for="sy-${c}">Stitch type</label><select id="sy-${c}" data-stitch-type="${c}">${[['','Use project confirmation'],['full','Full crosses'],['half','Half stitches'],['back','Backstitch'],['blend','Blended colors'],['fractional','Fractional / other']].map(([k,l])=>`<option value="${k}"${(it.stitchType||'')===k?' selected':''}>${l}</option>`).join('')}</select></div></div>
  <div class="fld">${destCell(p,it)}</div>
  ${it.src.length?`<div class="fld"><span class="flbl">From your list</span>"${it.src.map(esc).join('", "')}"</div>`:''}
  ${d.recv?`<div class="fld"><span class="flbl">Checked in</span>${d.recv.qty} × ${esc(BRAND[d.recv.brand])} ${esc(disp(d.recv.brand,d.recv.to))} <button type="button" class="sec small" id="rr-${c}" data-rr="${c}">Undo check-in</button></div>`:''}
  <div class="fld"><button type="button" class="ghost small" id="rm-${c}" data-rm="${c}">Remove this color<span class="sr"> (DMC ${L})</span></button></div></div></li>`}
function nextSteps(P){const k={};P.threads.forEach(t=>{if(t.state==='review')k[t.kind]=(k[t.kind]||0)+1});const s=P.sum,o=[];
 if(k.amount)o.push(['att',`${s2(k.amount)} need${k.amount===1?'s':''} an amount before your list is complete.`,k.amount===1?'Review it':'Review them','att']);
 if(k.estimate)o.push(['att',`${s2(k.estimate)} need${k.estimate===1?'s':''} a count, settings or stock check for Pip’s estimate.`,'Review','att']);
 if(k.match)o.push(['att',`You chose another brand for ${s2(k.match)}. Please confirm the match${k.match===1?'':'es'}.`,'Review','att']);
 if(k.unchecked)o.push(['att',`${s2(k.unchecked)} ${k.unchecked===1?"isn't":"aren't"} checked yet. Tap Have enough, Need to buy or Not sure.`,k.unchecked===1?'Show it':'Show them','att']);
 if(k.unsure)o.push(['att',`${s2(k.unsure)} marked Not sure. Check your threads when you can.`,k.unsure===1?'Show it':'Show them','att']);
 if(k.other)o.push(['att',`${s2(k.other)} need${k.other===1?'s':''} a second look.`,k.other===1?'Show it':'Show them','att']);
 if(s.awaiting)o.push(['wait',`${plural(s.awaiting,'thread')} ${s.awaiting===1?'was':'were'} bought but ${s.awaiting===1?"hasn't":"haven't"} been checked in yet.`,'Check them in','shop']);
 if(s.toBuy)o.push(['buy',`${s2(s.toBuy)} to buy.`,'Shop my list','shop']);return o}
// 1.7: compare with My Thread Collection. This box, its Apply button, the new-project auto-apply and the Shop overlay all compare with
// allocE(): the whole collection minus skeins set aside for OTHER projects (this project's own set-asides still count). cmpA falls back to the whole collection on error.
function cmpA(p,T){let E=null;try{E=T.core?allocE(p,T):null}catch(e){E=null}return cmpPlan(p,T,E||undefined)}
// Buckets: owned (verified: amount needed is stated and covered) | unverified (owned, but amount needed unknown or assumed) | short | missing.
// "Use my collection" shows a preview first and can be undone; it changes only this project's Have/Need choices, never the collection.
const STW={have:'Have enough',buy:'Need to buy',check:'Not sure'},stWord=d=>d.status?STW[d.status]:'Not checked',ownWord=d=>d.owned===null?'Not entered':plural(d.owned,'skein');
let cmpPreview=null;const undoBy={};
// compact preview line, e.g. "Will mark 13 Have enough, 4 Not sure, 2 Need to buy"
const prevSum=ch=>{const n={have:0,check:0,buy:0};ch.forEach(c=>{n[c.to.status]++});const o=n2=>Object.entries(n2).filter(([,v])=>v).map(([k,v])=>`${v} ${STW[k]}`);
 const extra=ch.filter(c=>c.from.status===c.to.status).length;return`Will mark ${o(n).join(', ')}${extra?` (${extra} only update “you already have”)`:''}.`};
function cmpPlan(p,T,E){const r=E?T.core.compare(p.items,p.demo?{demo:E,threads:{}}:{threads:E},{demo:!!p.demo}):T.compare(p.items,{demo:!!p.demo}),ch=[];
 const entries=E||(p.demo?(T.data().demo||{}):T.data().threads),er=SK.compareProject(p.items.map(estimateInput),p.skeinEstimator,DMC,fam,entries,p.buyBrand),changed=new Set(Object.values(er).flat().map(x=>x.code));
 for(const k in r)r[k]=r[k].filter(x=>!changed.has(x.code)).concat(er[k]);
 const want=(x,status,owned,why)=>{const d=p.decisions[x.code],ownedSource=(x.ownedConfirmed===true||entries[x.code]&&entries[x.code].confirmed===true)?'collection':'unverified',ownedPartial=!!x.partial;
  if(d.status!==status||d.owned!==owned||d.ownedSource!==ownedSource||d.ownedPartial!==ownedPartial)ch.push({code:x.code,from:{status:d.status,owned:d.owned,ownedSource:d.ownedSource,ownedPartial:d.ownedPartial,estimateChecked:d.estimateChecked},to:{status,owned,ownedSource,ownedPartial,estimateChecked:x.estimated&&status==='have'?SK.fingerprint(p.items.find(i=>i.code===x.code),p.skeinEstimator,reqOf(p,p.items.find(i=>i.code===x.code)).estimate):null},why})};
 r.owned.forEach(x=>want(x,'have',x.have,'owned'));r.unverified.forEach(x=>want(x,'check',x.have,'owned, amount not confirmed'));
 r.short.forEach(x=>want(x,'buy',x.have,'short'));r.missing.forEach(x=>want(x,'buy',x.estimated?0:null,'missing'));return{r,ch}}
function renderCmp(p){const el=$('pCmp'),T=window.FlossFoxThreadsUI;if(!el||!T)return;const n=T.count({demo:!!p.demo});
 if(!p.items.length){el.innerHTML='';return}
 const U=undoBy[p.id],undoBtn=U?`<div class="row"><button type="button" class="sec" id="pUndoColl">Undo “Use my collection”</button><span class="hint">Puts back the ${s2(U.length)} it changed.</span></div>`:'';
 if(!n){el.innerHTML=`<div class="pcmp"><b>Compare with my thread collection</b><p class="hint">${p.demo?'There are no demo threads in the collection.':`Your collection is empty. Add the threads you own in <button type="button" class="ghost small" id="pGoThreads">My Thread Collection</button>, then come back here.`}</p>${undoBtn}</div>`;const g=$('pGoThreads');if(g)g.onclick=()=>showView('threads');bindUndo(p);return}
 const {r,ch}=cmpA(p,T),need=x=>x.need===null||x.need===undefined?'amount needed not entered':x.estimated?`estimated need about ${SK.fmt(x.need)} skeins with extra`:x.assumed>=x.need?`amount needed not given (assumed ${plural(x.need,'skein')})`:`need ${plural(x.need,'skein')}`;
 const L=a=>a.map(x=>`DMC ${esc(lab(x.code))} (${need(x)}, have ${plural(x.have,'skein')}${x.partial?' + a partial':''})`).join(', ');
 el.innerHTML=`<details class="pcmp" id="pCmpBox"${secOpen('pCmpBox',cmpPreview===p.id)}><summary><b>Compared with my ${p.demo?'demo threads':'thread collection'}</b><div class="cnt"><span id="cmpOwned">✓ <b>${r.owned.length}</b> owned</span><span id="cmpUnver">? <b>${r.unverified.length}</b> owned, amount not confirmed</span><span id="cmpShort">◐ <b>${r.short.length}</b> short</span><span id="cmpMissing">✗ <b>${r.missing.length}</b> missing</span></div></summary>
 ${r.unverified.length?`<p class="small"><b>Color owned, amount not confirmed:</b> ${L(r.unverified)}. Add the amount your pattern needs to check it.</p>`:''}
 ${r.short.length?`<p class="small"><b>Short:</b> ${L(r.short)}</p>`:''}${r.missing.length?`<p class="small"><b>Missing:</b> ${r.missing.map(x=>'DMC '+esc(lab(x.code))).join(', ')}</p>`:''}
 <p class="hint">Each project is checked against your whole collection, minus any skeins set aside for other projects.</p>
 <div id="pCmpTip" class="piptip" hidden></div>
 ${cmpPreview===p.id?`<div class="notes cmpprev" id="pCmpPrev">${ch.length?`<p id="pPrevSum"><b>${esc(prevSum(ch))}</b></p><p class="hint">Your thread collection won't change, and you can undo this afterwards.</p><div class="row"><button type="button" class="pri" id="pApplyColl">Apply these changes</button><button type="button" class="ghost" id="pCancelColl">Cancel</button></div><details id="pPrevAll"><summary>Show all ${ch.length} changes</summary><ul>${ch.map(c=>`<li>DMC ${esc(lab(c.code))} (${esc(c.why)}): ${stWord(c.from)} → <b>${stWord(c.to)}</b>${c.from.owned!==c.to.owned?`; you already have: ${ownWord(c.from)} → ${ownWord(c.to)}`:''}</li>`).join('')}</ul></details>`:`<p><b>Nothing to change: this project already matches your collection.</b></p><div class="row"><button type="button" class="ghost" id="pCancelColl">Close</button></div>`}</div>`
  :`<div class="row"><button type="button" class="sec" id="pUseColl">Use my collection for this project…</button></div><p class="hint">Shows what would change first. Owned colors become <b>Have enough</b> only when the amount needed is known; otherwise <b>Not sure</b>. Short and missing colors become <b>Need to buy</b>.</p>`}</details>${undoBtn}`;
 if(T.tip)T.tip('compare',$('pCmpTip'));
 const u=$('pUseColl');if(u)u.onclick=()=>{cmpPreview=p.id;renderCmp(p);const pv=$('pCmpPrev');if(pv){pv.scrollIntoView({block:'nearest'});const b=$('pApplyColl')||$('pCancelColl');b.focus()}};
 const c=$('pCancelColl');if(c)c.onclick=()=>{cmpPreview=null;renderCmp(p);$('pUseColl').focus()};
 const a=$('pApplyColl');if(a)a.onclick=()=>{if(a.disabled)return;a.disabled=true;const now=cmpA(p,T).ch;
  now.forEach(x=>Object.assign(p.decisions[x.code],x.to));undoBy[p.id]=now;cmpPreview=null;
  touch(p);renderEditor();renderList();if(T.tipDone)T.tipDone('compare');const o=$('pUndoColl');if(o)o.focus();pstatus(`Used your collection: changed ${s2(now.length)}. You can undo this.`)};
 bindUndo(p)}
/* ---- First-time flow (a): Pip checks My threads automatically. Same engine as "Use my collection" (cmpPlan); only colors with no
   decision yet are filled in (never overwrites a user's choice), and it's undoable. Projects created before AUTO_SINCE are only OFFERED. ---- */
const FS=k=>(window.FF_STR||{})[k]||'',FC=(k,v)=>{const t=((window.FF_STR||{}).compare||{})[k];return typeof t==='function'?t(v||{}):t||''},FX=(t,v)=>typeof t==='function'?t(v||{}):t||'',fill=(t,o)=>String(t).replace(/\{(\w+)\}/g,(m,k)=>o[k]!==undefined?o[k]:m);
const AUTO_SINCE='2026-10-30T14:30:00.000Z',autoBan={},blank=f=>f.status===null&&f.owned===null&&!f.ownedSource&&!f.ownedPartial;
const AUTOKEY=()=>KEY.replace(/\.v1$/,'')+'.autocmp-off.v1',autoOff=()=>{try{return JSON.parse(localStorage.getItem(AUTOKEY())||'[]')}catch(e){return[]}};
const AUTOHID=()=>KEY.replace(/\.v1$/,'')+'.autocmp-hidden.v1',autoHid=()=>{try{return JSON.parse(localStorage.getItem(AUTOHID())||'[]')}catch(e){return[]}};
function setAutoHid(id){try{const a=autoHid();if(!a.includes(id)){a.push(id);localStorage.setItem(AUTOHID(),JSON.stringify(a.slice(-200)))}}catch(e){}}
function setAutoOff(id){try{const a=autoOff();if(!a.includes(id)){a.push(id);localStorage.setItem(AUTOKEY(),JSON.stringify(a.slice(-200)))}}catch(e){}}
function autoPlan(p){const T=window.FlossFoxThreadsUI;if(!T||!p.items.length||!T.count({demo:!!p.demo}))return null;let E=null;try{E=T.core?allocE(p,T):null}catch(e){E=null}const {r,ch}=cmpPlan(p,T,E||undefined);
 const safe=ch.filter(c=>blank(c.from));return{have:r.owned.length,total:p.items.length,safe,all:ch.length,u:safe.filter(c=>c.to.status==='check').length,b:safe.filter(c=>c.to.status==='buy').length}}
function autoCmp(p){if(window.FF_NO_AUTOCMP)return; /* test-only hook for legacy suites that drive Use my collection by hand */if(autoBan[p.id]&&autoBan[p.id].kind!=='offer')return;const T=window.FlossFoxThreadsUI;if(!T||!p.items.length)return;
 const fresh=String(p.created||'')>=AUTO_SINCE&&!autoOff().includes(p.id);
 if(!T.count({demo:!!p.demo})){if(fresh&&!p.demo&&!autoHid().includes(p.id)){autoBan[p.id]={kind:'empty'};setTimeout(()=>window.FlossFoxPip&&FlossFoxPip.react&&FlossFoxPip.react('pipA.cmp.empty',{},'#pAuto',{siteAnnounces:true}),0)}return}
 const a=autoPlan(p);if(!a)return;
 if(!a.safe.length){if(fresh&&!autoHid().includes(p.id)){autoBan[p.id]={kind:'nothing'};setTimeout(()=>window.FlossFoxPip&&FlossFoxPip.react&&FlossFoxPip.react('pipA.cmp.nothing',{},'#pAuto',{id:p.id,siteAnnounces:true}),0)}else delete autoBan[p.id];return}
 if(!fresh){autoBan[p.id]=Object.assign({kind:'offer'},a);return}
 applyAuto(p,a)}
function applyAuto(p,a){a.safe.forEach(x=>Object.assign(p.decisions[x.code],x.to));undoBy[p.id]=(undoBy[p.id]||[]).concat(a.safe);autoBan[p.id]=Object.assign({kind:'done'},a);touch(p);setTimeout(()=>window.FlossFoxPip&&FlossFoxPip.react&&FlossFoxPip.react('pipA.cmp.done',{have:a.have,total:a.total,u:a.u},'#pAuto',{id:p.id,siteAnnounces:true}),0)}
function autoHead(b){return b.total===1?FC(b.have?'oneHave':'oneNot'):b.have?FC('many',b):FC('none',b)}
var autoMore={};   // in-memory only, like openSec
function renderAuto(p){const el=$('pAuto');if(!el)return;const b=autoBan[p.id];if(!b||b.kind==='hidden'){el.hidden=true;el.innerHTML='';return}el.hidden=false;
 const hide=`<button type="button" class="ghost" id="pAutoHide">${esc(FS('autoDismiss'))}</button>`;
 el.innerHTML=b.kind==='undone'?`<p>${esc(FC('undone',{n:b.n}))}</p><div class="row">${hide}</div>`
  :b.kind==='empty'?`<p>${esc(FC('empty'))}</p><div class="row"><button type="button" class="sec" id="pAutoThreads">${esc(FC('emptyBtn'))}</button>${hide}</div>`
  :b.kind==='nothing'?`<p>${esc(FC('nothing'))}</p><div class="row">${hide}</div>`
  :b.kind==='offer'?`<p><b>${esc(FS('autoOffer'))}</b></p><div class="row"><button type="button" class="pri" id="pAutoApply">${esc(FS('autoApply'))}</button>${hide}</div>`
  :`<p><b>${esc(autoHead(b))}</b></p>
   ${undoBy[p.id]?`<div class="row"><button type="button" class="sec" id="pAutoUndo" aria-label="${esc(FC('undoAria'))}">${esc(FC('undo'))}</button>${hide}</div>`:`<div class="row">${hide}</div>`}
   <button type="button" class="ghost small" id="pAutoMore" aria-expanded="${!!autoMore[p.id]}" aria-controls="pAutoDet">${autoMore[p.id]?'Hide details':'See what Pip filled in'}</button>
   <div id="pAutoDet"${autoMore[p.id]?'':' hidden'}>${b.safe&&b.safe.length?`<p class="small">${esc(FC('filled',{n:b.safe.length}))}</p>`:''}${b.u?`<p class="small">${esc(FC('unsure',b))}</p>`:''}${b.b?`<p class="small">${esc(FC('buy',b))}</p>`:''}<p class="hint">${esc(FC('same'))} ${esc(FC('reserved'))}</p>${undoBy[p.id]?`<p class="hint">${esc(FC('undoHint'))}</p>`:''}</div>`;
 const mo=$('pAutoMore');if(mo)mo.onclick=()=>{autoMore[p.id]=!autoMore[p.id];const o=autoMore[p.id],dd=$('pAutoDet');dd.hidden=!o;mo.setAttribute('aria-expanded',String(o));mo.textContent=o?'Hide details':'See what Pip filled in'};
 const h=$('pAutoHide');if(h)h.onclick=()=>{if(b.kind==='offer')setAutoOff(p.id);else setAutoHid(p.id);autoBan[p.id]={kind:'hidden'};el.hidden=true;el.innerHTML=''};
 const gt=$('pAutoThreads');if(gt)gt.onclick=()=>showView('threads');
 const ap=$('pAutoApply');if(ap)ap.onclick=()=>{const a=autoPlan(p);if(!a||!a.safe.length){autoBan[p.id]={kind:'nothing'};renderEditor();return}applyAuto(p,a);renderEditor();renderList();const u=$('pAutoUndo');if(u)u.focus();pstatus(autoHead(a))};
 const u=$('pAutoUndo');if(u)u.onclick=()=>{const U=undoBy[p.id]||[];U.forEach(x=>{const d=p.decisions[x.code];if(d)Object.assign(d,x.from)});delete undoBy[p.id];touch(p);setAutoOff(p.id);autoBan[p.id]={kind:'undone',n:U.length};renderEditor();renderList();pstatus(FC('undone',{n:U.length}));if(window.FlossFoxPip&&FlossFoxPip.react)FlossFoxPip.react('pipA.cmp.undo',{n:U.length},'#pAuto',{siteAnnounces:true});const hh=$('pAutoHide');if(hh)hh.focus()}}
function bindUndo(p){const b=$('pUndoColl');if(!b)return;b.onclick=()=>{const U=undoBy[p.id];if(!U)return;if(autoBan[p.id]&&autoBan[p.id].kind==='done'){setAutoOff(p.id);autoBan[p.id]={kind:'undone',n:U.length}}
 U.forEach(x=>{const d=p.decisions[x.code];if(d)Object.assign(d,x.from)});delete undoBy[p.id];touch(p);renderEditor();renderList();const u=$('pUseColl');if(u)u.focus();pstatus(FC('undone',{n:U.length})||`Undone: ${s2(U.length)} put back as ${U.length===1?'it was':'they were'}.`)}}
/* ---- User-facing strings for the project step strip (functional labels; Pixel may replace). See /workspace/ci005/STRINGS_FOR_PIXEL.md ---- */
const FLOW_STR={review:'Review colors',cmp:'Check my threads',ready:'Readiness',shop:'Shopping list',done:'(done)',
 tip:{review:owned=>`Next: pick Have enough, Need to buy or Not sure for each color${owned?'':'. Or add the threads you own to My Thread Collection first, then compare'}.`,
  cmp:()=>'Next: compare these colors with your thread collection, then choose for any color that\'s still undecided.',
  shop:(o,n)=>`Next: open your shopping list (${n} to buy).`,
  /* FF-1956 split by state (wording from Pixel's handoff note) */ready:(o,n,ready,aw,cf)=>ready?'You have enough of every color. Ready to stitch!':cf?`Next: look over the ${s2(cf)} still to check in Readiness${n&&n!=='0 colors'?`, then shop for the ${n} to buy`:''}.`:aw?'Next: check in the threads you bought when they arrive.':'Next: sort out the colors under Needs attention.'}};
// 2.0A connected workflow: one strip that walks pattern -> compare -> readiness -> shopping using the existing sections (no new calculations).
function renderFlow(p,P){const unchecked=p.items.filter(it=>!(p.decisions[it.code]||{}).status).length;const el=$('pFlow');if(!el)return;if(!p.items.length){el.hidden=true;return}el.hidden=false;
 const T=window.FlossFoxThreadsUI,owned=T?T.count({demo:!!p.demo}):0,toBuy=P.lines.filter(l=>!l.bought).length;
 const next=unchecked?(owned?'cmp':'review'):P.sum.checkFirst?'ready':toBuy?'shop':'ready';
 const F=FLOW_STR,st=[['review',F.review,!unchecked],['cmp',F.cmp,!unchecked],['ready',F.ready,P.ready],['shop',F.shop,!unchecked&&!toBuy]];
 const tip=F.tip[next](owned,s2(toBuy),P.ready,P.sum.awaiting,P.sum.checkFirst);
 el.innerHTML=`<ol>${st.map(([k,l,d],i)=>`<li><button type="button" class="pfstep${d?' done':''}" data-flow="${k}"${k===next?' aria-current="step"':''}><span class="pfn" aria-hidden="true">${d?'✓':i+1}</span>${l}${d?`<span class="sr"> ${F.done}</span>`:''}</button></li>`).join('')}</ol><p class="hint pftip">${esc(tip)}</p>`;
 el.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>{const k=b.dataset.flow;if(k==='shop')return showView('shop');if(k==='ready'){const r=$('pReady'),d=r&&r.querySelector('details');if(d&&!r.hidden){d.open=true;r.scrollIntoView({block:'start'});const sm=d.querySelector('summary');if(sm)sm.focus({preventScroll:true});return}}const t=k==='review'?$('pThreads'):k==='cmp'?($('pCmp').firstElementChild||$('pThreads')):$('pSummary');if(k==='cmp'&&t&&t.tagName==='DETAILS'){t.open=true;openSec[t.id]=true}if(t){t.scrollIntoView({block:'start'});const h=t.querySelector('h3,h2,b,button');if(h&&!h.matches('button')){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}}})}
/* Flow phase 3: folded project sections keep the open/closed state the user chose while the page re-renders. */
var openSec={},revSeen={};const secOpen=(id,def)=>((id in openSec)?openSec[id]:def)?' open':'';
document.addEventListener('click',e=>{const sm=e.target&&e.target.closest&&e.target.closest('summary');const d=sm&&sm.parentElement;if(d&&/^p(Details|AwBox|ReviewBox|HaveBox|CmpBox|SumMore)$/.test(d.id))openSec[d.id]=!d.open},true);
// ---- Phase 3: Store Mode (view only) and kitting (set-aside sidecar) ----
let storeOn=false,storeSort='number',storeQ='',kitUndo=null,ALS_=null;
const AL=()=>window.FlossFoxAllocations,ALKEY=KEY.replace(/\.v1$/,'')+'.allocations.v1';
function ALS(){if(!ALS_&&AL()){let ls=null;try{ls=localStorage}catch(e){}ALS_=ls?AL().storage(ls,ALKEY):AL().storage({getItem:()=>{throw 0},setItem:()=>{throw 0}},ALKEY)}return ALS_}
const COL=()=>{const T=window.FlossFoxThreadsUI;return{threads:T?T.data().threads:{}}};
function renderStore(p,P){const box=$('pStore'),pl=$('pPlan');if(!box||!pl)return;pl.classList.toggle('ffstore-on',storeOn);box.hidden=!storeOn;if(!storeOn){box.innerHTML='';return}
 const SM=window.FlossFoxStoreModeCore;if(!SM){box.innerHTML='';return}
 const nm=l=>l.from.length===1&&DMC[l.from[0]]?cap(DMC[l.from[0]].name):'';
 const ix=c=>{const i=p.items.findIndex(x=>x.code===c);return i<0?1e9:i},po=l=>Math.min(...l.from.map(ix)),lines=P.lines.slice().sort((x,y)=>po(x)-po(y));
 let v;try{v=SM.prepare(lines.map(l=>({key:l.key,to:disp(P.dest,l.to),q:l.q,bought:l.bought,brand:BRAND[P.dest],name:nm(l)})),{sort:storeSort,query:storeQ})}catch(e){box.innerHTML='<p class="warn">Store mode couldn\'t read this list. Your full list is still here.</p>';return}
 const hex=k=>{const l=P.lines.find(x=>x.key===k),c=l&&l.from[0];return c&&DMC[c]?DMC[c].hex:'#ccc'};
 // Buy: reuses the verified per-color store links (FlossFoxSkeinPreview, same as Need to buy pills). Read-only, never marks bought.
 const SPL=window.FlossFoxSkeinPreview,buyL={};
 if((window.FLOSS_FOX_ENV==='preview'||window.FLOSS_FOX_DIRECT_LINKS===true)&&SPL&&window.FlossFoxShop){try{const tb=P.lines.filter(l=>!l.bought),nd=FlossFoxShop.fromProject(p,P).needs,rows=SPL.rowsFor(nd,'direct'),by=new Map(rows.map(r=>[r.code,r]));
  tb.forEach((l,i)=>{const n=nd[i],c=n&&SPL.normalize(n.code),r=c&&by.get(c);if(r&&r.links.length&&SPL.eligible(n,'direct'))buyL[l.key]=r.links})}catch(e){}}
 const pill=l=>`<a class="ff-skein-pill" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-store="${esc(l.storeId)}" data-match="${esc(l.type)}" data-kind="direct" data-tracked="false" aria-label="${esc(l.label)} (opens in new tab)" title="${esc(l.hint)}">${esc(l.exact?l.storeName:'Search '+l.storeName)}</a>`;
 const buyB=x=>{const L=buyL[x.key];return L?`<button type="button" class="sec" data-smbuy="${esc(x.key)}" aria-expanded="false" aria-controls="smBuy-${esc(x.key)}" aria-label="Buy ${esc(x.brand)} ${esc(x.code)}: choose a store">Buy</button>`:''};
 const buyC=x=>{const L=buyL[x.key];return L?`<div class="ff-skein-inline ffsm-buy noprint" id="smBuy-${esc(x.key)}" role="group" aria-label="Store links for ${esc(x.brand)} ${esc(x.code)}" hidden>${L.map(pill).join('')}</div>`:''};
 const cfL=cfLinks(P),cfR=P.checkFirst.filter(t=>!storeQ||lab(t.it.code).toLowerCase().includes(storeQ.trim().toLowerCase())),anyBuy=v.remaining.some(x=>buyL[x.key])||cfR.some(t=>cfL[t.it.code]);
 const row=(x,b)=>`<li class="ffsm-row"><span class="bigsw" style="background:${hex(x.key)}" aria-hidden="true"></span><span class="ffsm-txt"><b class="ffsm-code">${esc(x.brand)} ${esc(x.code)}</b> <span class="ffsm-q">× ${x.quantity}</span>${x.name?`<small class="mut"> ${esc(x.name)}</small>`:''}</span>${b?`<button type="button" class="ghost small" data-smu="${esc(x.key)}" aria-label="Undo bought for ${esc(x.brand)} ${esc(x.code)}">Undo</button>`:`<span class="ffsm-acts">${buyB(x)}<button type="button" class="pri" data-smb="${esc(x.key)}" aria-label="Bought ${esc(x.brand)} ${esc(x.code)}">Bought</button></span>${buyC(x)}`}</li>`;
 box.innerHTML=`<h3 id="pStoreH" tabindex="-1">Store mode</h3><p class="hint">Big and simple for the store aisle. Bought doesn't add threads to your collection, so check them in once they're home.</p>
 <div class="ffsm-tools"><label for="smSort">Sort by</label> <select id="smSort"><option value="number"${storeSort==='number'?' selected':''}>Color number</option><option value="pattern"${storeSort==='pattern'?' selected':''}>Pattern order</option><option value="name"${storeSort==='name'?' selected':''}>Color name</option></select>
 <label class="sr" for="smFind">Find a thread</label><input type="search" id="smFind" placeholder="Find a number, like 310" autocomplete="off" value="${esc(storeQ)}"></div>
 <p class="shopsum" id="smSum" role="status" aria-live="polite">${v.counts.remaining?`${v.counts.remaining} to find, ${v.counts.purchased} bought.`:!v.counts.purchased&&P.checkFirst.length?cfNote(P.checkFirst.length):'Everything on this list is bought.'}</p>
 <h4>Still to find (${v.remaining.length})</h4>${anyBuy?`<p class="ff-skein-direct noprint" id="smBuyNote">These are plain store links, and Floss Fox doesn't earn anything from them. Before you order, double-check the color, thread type, amount and availability on the store's site.${typeof navigator!=='undefined'&&navigator.onLine===false?' Store pages need a connection.':''}</p>`:''}${v.remaining.length?`<ul class="ffsm-list" id="smLeft">${v.remaining.map(x=>row(x,false)).join('')}</ul>`:`<p class="hint">${storeQ?'Nothing left matches that search.':'Nothing left to find.'}</p>`}
 ${cfR.length?`<h4 id="smCheckH">Check first (${cfR.length})</h4><p class="hint">${CFS.shopNote(cfR.length)}</p><ul class="ffsm-list" id="smCheck">${cfR.map(t=>`<li class="ffsm-row"><span class="bigsw" style="background:${DMC[t.it.code]?DMC[t.it.code].hex:'#ccc'}" aria-hidden="true"></span><span class="ffsm-txt"><b class="ffsm-code">${CFS.rowLab(t)}</b></span>${cfActs(t,cfL[t.it.code],'cfm',1)}</li>`).join('')}</ul>`:''}
 ${v.purchased.length?`<h4>Bought (${v.purchased.length})</h4><ul class="ffsm-list ffsm-done" id="smDone">${v.purchased.map(x=>row(x,true)).join('')}</ul>`:''}`;
 const re=(msg,f)=>{renderEditor();renderList();const m=$('smSum');if(m&&msg)m.textContent=msg;const e=f&&$(f);if(e)e.focus({preventScroll:true})};
 box.querySelectorAll('[data-smb]').forEach(b=>b.onclick=()=>{p.purchased[b.dataset.smb]=true;touch(p);re('Marked as bought. Check it in once it\'s home.','smFind')});
 box.querySelectorAll('[data-smbuy]').forEach(b=>b.onclick=()=>{const c=$('smBuy-'+b.dataset.smbuy);if(!c)return;const o=c.hidden;c.hidden=!o;b.setAttribute('aria-expanded',String(o));if(o){const a=c.querySelector('a');if(a)a.focus({preventScroll:true})}});
 box.querySelectorAll('[data-smu]').forEach(b=>b.onclick=()=>{delete p.purchased[b.dataset.smu];touch(p);re('Moved back to Still to find.','smFind')});
 $('smSort').onchange=e=>{storeSort=e.target.value;renderStore(p,plan(p));$('smSort').focus()};
 $('smFind').oninput=e=>{storeQ=e.target.value;const pos=e.target.selectionStart;renderStore(p,plan(p));const f=$('smFind');f.focus();try{f.setSelectionRange(pos,pos)}catch(_){}}}
function kitNeeds(p){return p.items.map(it=>{const rq=reqOf(p,it),ok=rq.source!=='estimated'&&rq.source!=='unavailable'&&rq.source!=='unknown'&&asmOf(it)===0&&Number.isInteger(rq.amount)&&rq.amount>=1;return{code:it.code,qty:ok?rq.amount:null,verified:ok,brand:'dmc'}})}
function renderKit(p){const host=$('shopFoot');if(!host||!AL()||!window.FlossFoxKitPreviewCore)return;let sec=$('pKit');if(!sec){sec=document.createElement('details');sec.id='pKit';sec.className='psec noprint';host.before(sec)}sec.hidden=false;
 const S=ALS(),wr=S.writable(),data=S.read(),col=COL(),nk=kitNeeds(p);
 const extra=[...new Set(data.allocations.filter(r=>r.projectId===p.id&&!p.items.some(i=>i.code===r.code)).map(r=>r.code))];
 let pv;try{pv=FlossFoxKitPreviewCore.preview({projectId:p.id,needs:nk.concat(extra.map(code=>({code,qty:null,verified:false,brand:'dmc'}))),collection:col,allocationCore:AL(),allocationData:data})}catch(e){sec.innerHTML='<summary><h3>Kit this project</h3></summary><p class="warn">We couldn\'t read the kit for this project. Nothing was changed.</p>';return}
 const req=pv.rows.reduce((a,r)=>a+(r.required||0),0),got=pv.rows.reduce((a,r)=>a+Math.min(r.reservedForThisProject,r.required||0),0),can=pv.rows.filter(r=>r.mayReserveNow>0);
 const why=r=>r.reviewReason==='inventory-allocation-conflict'?`More is set aside than you have. You have ${r.ownedTotal} and ${r.reservedForThisProject+r.reservedElsewhere} are set aside, so lower one to fix it.`:r.reviewReason==='stock-not-entered'?'Add how many you have in Threads first.':extra.includes(r.code)?'Not in this project anymore.':'Amount not confirmed yet, so none is set aside.';
 const L=c=>DMC[c]?lab(c):c,rowH=r=>`<li class="ffkit-row" data-kit="${esc(r.code)}"><span class="bigsw" style="background:${DMC[r.code]?DMC[r.code].hex:'#ccc'}" aria-hidden="true"></span><span><b>DMC ${esc(L(r.code))}</b> · ${r.required===null?'need not confirmed':'need '+r.required} · set aside ${r.reservedForThisProject}${r.ownedTotal===null?'':` · you have ${r.ownedTotal}${r.reservedElsewhere?` (${r.reservedElsewhere} for other projects)`:''}`}${r.needsReview?`<br><small class="mut">${esc(why(r))}</small>`:''}</span>${wr&&!p.demo?`<span class="ffkit-acts">${r.mayReserveNow>0?`<button type="button" class="sec small" data-kadd="${esc(r.code)}">Set aside ${r.mayReserveNow}</button>`:''}${r.reservedForThisProject>0?`<button type="button" class="ghost small" data-krel="${esc(r.code)}">Release</button>`:''}</span>`:''}</li>`;
 const open=kitFresh?false:sec.open;kitFresh=false;
 {const g=$('pKitGo');if(g){g.textContent='Kit this project (in Shop)';g.removeAttribute('aria-describedby');g.onclick=()=>{showView('shop');setTimeout(()=>{const k=$('pKit');if(!k)return;k.hidden=false;k.open=true;k.scrollIntoView({block:'start'});const sm=k.querySelector('summary');if(sm)sm.focus({preventScroll:true})},60)}}}
 sec.innerHTML=`<summary><h3 id="pKitH">Kit this project (${got} of ${req} skeins set aside)</h3></summary>
 <p class="hint">Set aside threads from your collection for this project, so no other project counts the same skein. Setting aside doesn't buy, pack or use anything.</p>
 ${p.demo?'<p class="hint">This is the sample project, so nothing is set aside for it.</p>':!wr?'<p class="warn">This set-aside list was saved by a newer Floss Fox or is damaged, so it\'s read-only here. Nothing was changed.</p>':can.length>1?`<div class="row"><button type="button" class="sec" id="kAll">Set aside all I can (${can.reduce((a,r)=>a+r.mayReserveNow,0)})</button></div>`:''}
 <p id="kMsg" role="status" aria-live="polite" class="ok-msg">${kitUndo&&kitUndo.id===p.id?`${esc(kitUndo.msg)} <button type="button" class="ghost small" id="kUndo">Undo</button>`:''}</p>
 <ul class="ffkit-list">${pv.rows.map(rowH).join('')}</ul>`;sec.open=open||!!(kitUndo&&kitUndo.id===p.id);
 const ctx={projects:store.projects,collection:col};
 const apply=(changes,msg)=>{const prev=changes.map(([code])=>[code,(data.allocations.find(r=>r.projectId===p.id&&r.code===code)||{qty:0}).qty]);
  for(const [code,qty] of changes){const r=S.update({projectId:p.id,code,qty},ctx);if(!r.ok){for(const [c,q] of prev)S.update({projectId:p.id,code:c,qty:q},ctx);kitUndo=null;renderKit(p);$('kMsg').textContent=r.reason==='insufficient-unallocated-stock'?'Not enough free skeins for that. Nothing changed.':'That couldn\'t be saved. Nothing changed.';return}}
  kitUndo={id:p.id,prev,msg};if(window.FlossFoxBackupUI&&FlossFoxBackupUI.refresh)try{FlossFoxBackupUI.refresh()}catch(e){}renderKit(p);const u=$('kUndo');if(u)u.focus({preventScroll:true})};
 sec.querySelectorAll('[data-kadd]').forEach(b=>b.onclick=()=>{const r=pv.rows.find(x=>x.code===b.dataset.kadd);apply([[r.code,r.reservedForThisProject+r.mayReserveNow]],`Set aside ${plural(r.mayReserveNow,'skein')} of DMC ${L(r.code)}.`)});
 sec.querySelectorAll('[data-krel]').forEach(b=>b.onclick=()=>{const r=pv.rows.find(x=>x.code===b.dataset.krel);apply([[r.code,0]],`Released ${plural(r.reservedForThisProject,'skein')} of DMC ${L(r.code)}.`)});
 {const a=$('kAll');if(a)a.onclick=()=>{const n=can.reduce((x,r)=>x+r.mayReserveNow,0);apply(can.map(r=>[r.code,r.reservedForThisProject+r.mayReserveNow]),`Set aside ${plural(n,'skein')} across ${plural(can.length,'color')}.`)}}
 {const u=$('kUndo');if(u)u.onclick=()=>{const k=kitUndo;kitUndo=null;let ok=true;for(const [c,q] of k.prev){if(!S.update({projectId:p.id,code:c,qty:q},ctx).ok)ok=false}renderKit(p);$('kMsg').textContent=ok?'Undone. Set-aside amounts are back to how they were.':'Part of the undo couldn\'t be saved. Check the amounts above.'}}}
const kitCount=id=>{const S=ALS();return S?S.read().allocations.filter(r=>r.projectId===id).reduce((a,r)=>a+r.qty,0):0};
function renderEditor(){if(mode==='shop')return renderShop();const y=window.scrollY;{const sb=$('shopBody');if(sb)sb.textContent=''}const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}
 const focusId=document.activeElement&&document.activeElement.id,P=plan(p);
 const unchecked=p.items.filter(it=>!p.decisions[it.code].status).length;
 E.innerHTML=`<div class="noprint"><div class="ptitle"><button type="button" class="ghost" id="pClose">← All projects</button><button type="button" class="pri" id="pShop"><span aria-hidden="true">🛒</span> Shop my list</button></div><p class="ffsaved" id="pSaved">${canSave?esc(FX(FS('savedBadge'),{time:new Date(p.updated).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})})):''}</p>
 <h2 class="ptname" id="pTitle">${esc(p.name)}</h2><nav class="pflow" id="pFlow" aria-label="Project steps"></nav><div class="ffbanner" id="pAuto" role="status" hidden></div></div><div id="pSum"></div><div id="pReady" class="noprint"></div><div id="pTrust" class="noprint"></div>
 <div class="noprint"><details class="pmore" id="pDetails"${secOpen('pDetails',!String(p.name||'').trim()||(document.activeElement&&!!document.activeElement.closest&&!!document.activeElement.closest('#pDetails')))}><summary>Project details</summary><div class="fldrow" style="margin-top:var(--s3)"><div class="fld" style="flex:2 1 220px"><label for="pName">Project name</label><input type="text" id="pName" maxlength="100" value="${esc(p.name)}" style="width:100%"></div>
 <div class="fld" style="flex:1 1 160px"><label for="pStatus">Status</label><select id="pStatus" style="width:100%">${PSTAT.map(([k,l])=>`<option value="${k}"${(p.status||'planning')===k?' selected':''}>${l}</option>`).join('')}</select></div>
 <div class="fld" style="flex:1 1 180px"><label for="pDest">Brand to buy</label><select id="pDest" style="width:100%">${['dmc','sullivans','anchor'].map(k=>`<option value="${k}"${p.buyBrand===k?' selected':''}>${k==='dmc'?'DMC (same as pattern)':BRAND[k]}</option>`).join('')}</select></div></div>
 <div class="fld"><label for="pNotes">Notes <small class="mut">(optional)</small></label><textarea id="pNotes" class="pnotes" maxlength="2000" rows="2" style="width:100%;min-height:72px;font-family:var(--font)" placeholder="e.g. threads are in the blue bag">${esc(p.notes)}</textarea></div>
 <div class="row"><button type="button" class="ghost" id="pDelete">Delete this project</button></div></details></div>
 ${window.FlossFoxSkeinsUI.html(estimateProject(p),DMC,fam,lsGet(KEY.replace(/\.v1$/,'')+'.fabric.v1'),pipOn())}<div id="pCmp" class="noprint"></div><div class="row noprint ffkitgo" id="pKitGoRow"><button type="button" class="sec" id="pKitGo">Kit this project (in Shop)</button></div>
 <section class="noprint" id="pThreads" aria-labelledby="pThreadsH"><h3 id="pThreadsH">Colors for this piece</h3>
 <p class="hint">For each color, tap <b>Have enough</b>, <b>Need to buy</b> or <b>Not sure</b>. Colors you've already answered show a short row. Open <b>Details</b> to change the answer, add amounts or pick another brand. Swatches are approximate screen colors.</p>
 <div class="toolbar"><div class="searchrow"><label class="sr" for="pSearch">Find a color</label><input type="search" id="pSearch" placeholder="Find a color, e.g. 310 or black" value="${esc(query)}" autocomplete="off"><button type="button" class="sec" id="pSearchClear"${query?'':' hidden'}>Clear search</button></div>
 <div class="chipsf" role="group" aria-label="Show">${FILTERS.map(([k,l])=>`<button type="button" id="f-${k}" data-filt="${k}" aria-pressed="${filt===k}">${l} (${P.threads.filter(t=>inFilter(t,k)).length})</button>`).join('')}</div>
 ${unchecked?`<div><button type="button" class="sec" id="pAllBuy">Mark the ${unchecked} unchecked as Need to buy</button></div>`:'<button type="button" id="pAllBuy" hidden>Mark unchecked as Need to buy</button>'}</div>
 <p id="pFiltMsg" class="sr" role="status" aria-live="polite"></p>
 <ul class="cards" id="pCards">${P.threads.map(t=>card(p,P,t)).join('')}<li class="noresults" id="pNoRes" hidden></li></ul>
 <details class="pmore" id="pAddBox"><summary>Add more colors</summary><label for="pAdd" class="flbl">Paste colors to add (same format as on Find My Floss)</label><textarea id="pAdd" rows="2" style="width:100%;min-height:72px" placeholder="e.g. 3865 x2, 762"></textarea>
 <div class="row"><button type="button" class="sec" id="pAddBtn">Add to project</button></div><div id="pAddErr"></div></details><div class="ffnext"><button type="button" class="pri" id="pNext" data-ffgo="shop">${esc(FS('next').ready)} →</button></div></section>
 <div class="plan" id="pPlan"></div>`;
 bindEditor(p);renderAuto(p);renderKit(p);E.querySelectorAll('[data-ffgo]').forEach(b=>b.onclick=()=>{if(b.dataset.ffgo==='ready'){const r=$('pReady');if(r){r.scrollIntoView({block:'start'});const sm=r.querySelector('summary');if(sm)sm.focus({preventScroll:true})}return}showView('shop')});window.FlossFoxSkeinsUI.bind(E,p,x=>{edited(x);touch(x)},message=>{renderEditor();renderList();pstatus(message);const se=$('pSkein');if(se)se.open=true;const b=$('seSave');if(b)b.focus({preventScroll:true})});renderCmp(p);renderPlan(p,P);if(window.FlossFoxPatternTrustUI)try{FlossFoxPatternTrustUI.mountProject($('pTrust'),p,(msg,fid)=>{touch(p);renderEditor();renderList();pstatus(msg);const f=document.getElementById(fid);if(f){if(f.tabIndex<0)f.tabIndex=-1;f.focus()}})}catch(e){}mountShop(p);applyFilter(P);window.scrollTo(0,y);if(focusId){const f=document.getElementById(focusId);if(f)f.focus({preventScroll:true})}}
function applyFilter(P){const cards=[...document.querySelectorAll('#pCards .tcard')],q=query.trim().toLowerCase();let n=0;const map={};P.threads.forEach(t=>map[t.it.code]=t);
 const tuckable=filt==='all'&&!q?cards.filter(c=>c.classList.contains('cmp')&&map[c.dataset.code]&&map[c.dataset.code].state==='have'):[],tuck=tuckable.length>=3&&!haveShown&&!document.documentElement.classList.contains('ffall');
 cards.forEach(c=>{const t=map[c.dataset.code],show=inFilter(t,filt)&&(!q||c.dataset.search.includes(q))&&!(tuck&&tuckable.includes(c));c.hidden=!show;if(show)n++});
 {let g=$('pHaveTogRow');const ul=$('pCards');if(tuckable.length>=3&&ul){if(!g){g=document.createElement('li');g.id='pHaveTogRow';g.className='phavetog';ul.insertBefore(g,ul.firstChild)}
  g.hidden=false;g.innerHTML=`<button type="button" class="sec" id="pHaveTog" aria-expanded="${!tuck}">${tuck?`Show the ${tuckable.length} colors you have enough of`:`Hide the ${tuckable.length} colors you have enough of`}</button>`;
  $('pHaveTog').onclick=()=>{haveShown=!haveShown;applyFilter(P);const b=$('pHaveTog');if(b)b.focus({preventScroll:true})};if(tuck)n++}else if(g)g.hidden=true}
 const nr=$('pNoRes');if(nr){nr.hidden=!!n||!cards.length;nr.innerHTML=n?'':`${q?`No colors match “${esc(query)}”${filt!=='all'?' in this view':''}.`:'Nothing here right now.'} <button type="button" class="sec small" id="pNoResClear">Show all colors</button>`;const b=$('pNoResClear');if(b)b.onclick=()=>{query='';filt='all';renderEditor()}}
 if(!cards.length&&nr){nr.hidden=false;nr.innerHTML='No colors in this project yet. Use <b>Add more colors</b> below.';const ab=$('pAddBox');if(ab)ab.open=true}
 const m=$('pFiltMsg');if(m)m.textContent=`Showing ${s2(n)}.`;const cb=$('pSearchClear');if(cb)cb.hidden=!query}
function renderPlan(p,P){P=P||plan(p);const cel=!!(window.FlossFoxPip&&FlossFoxPip.projectReady(p.id,P.ready));if(cel&&FlossFoxPip.react)setTimeout(()=>FlossFoxPip.react('pipA.ready',{},()=>[...document.querySelectorAll('p.headline')].find(e=>e.offsetParent),{siteAnnounces:true}),0);const s=P.sum,tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),pct=s.total?Math.round(100*s.sufficient/s.total):0;
 const skeins=P.lines.reduce((a,l)=>a+l.q,0),colorOnly=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').length;
 const isAsm=l=>l.ts.some(t=>!t.estimated&&asmOf(t.it)>0);const li=l=>`<b>${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</b> × ${l.q}${isAsm(l)?FF_EST.badge:''} <small class="mut">(for DMC ${l.from.map(c=>esc(lab(c))).join(', ')} · ${[...l.prov].map(esc).join('; ')}${l.partial?' · after subtracting what you have':''}${l.recvd?` · ${l.recvd} already received`:''}${l.ts.some(t=>t.estimated)?' · includes Pip estimates':''}${l.ts.some(t=>!t.estimated&&asmOf(t.it)>0)?' · includes an assumed amount':''})</small>`;
 const mw=l=>l.from.length>1?'<div class="hint">Note: several pattern colors use this one thread. Check that\'s what you want.</div>':'';
 const steps=nextSteps(P).filter(x=>x[3]!=='shop');   // Shop my list is already the header button
 $('pSum').innerHTML=`<h2 class="printonly">${esc(APP_NAME)}: ${esc(p.name)}</h2><p class="printonly">Brand to buy: ${esc(BRAND[P.dest])}</p>${SK.text(estimateProject(p),DMC,fam)?`<pre class="printonly skein-print">${esc(SK.text(estimateProject(p),DMC,fam))}</pre>`:''}
 <section class="psum" id="pSummary" data-ready="${P.ready}" aria-labelledby="pSumH"><h2 class="sr" id="pSumH">How this piece is coming along</h2>
 <p class="headline" role="status" aria-live="polite">${P.ready?`${cel?CEL():foxSvg('fox')}<span>${P.hasEstimates?'Your thread plan is covered using Pip’s estimates.':"All your threads are accounted for. Your hoop is ready!"}<span class="sr" id="sSuf">${s.sufficient} of ${s.total}</span></span>`:`<span><span id="sSuf">${s.sufficient} of ${s.total}</span> colors ready</span>`}</p>
 ${s.total?`<div class="bar" role="progressbar" aria-label="Colors ready" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.sufficient}" aria-valuetext="${s.sufficient} of ${s.total} colors ready"><span style="width:${pct}%"></span></div>`:''}
 ${P.ready?`<p class="skeins">${s.total} of ${s2(s.total)} have enough or have been checked in. Happy stitching! 🧵</p>`:''}<ul class="stats"${P.ready?' hidden':''}><li><b id="sBuy">${s.toBuy+P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').length}</b>to buy</li><li><b id="sAw">${s.awaiting}</b>bought, waiting to check in</li><li><b id="sRev">${s.review}</b>need attention</li>${s.checkFirst?`<li><b id="sCf">${s.checkFirst}</b>to check first</li>`:''}</ul>
 ${(n=>n?`<p class="skeins">${s2(n)} use${n===1?'s':''} an assumed amount (1 skein for each line with no amount). Check against your pattern in Details.</p>`:'')(P.threads.filter(t=>['assumed','partly-assumed'].includes(t.req.source)&&t.req.amount!==null).length)}${skeins||colorOnly?`<p class="skeins">Skeins still to get: <b>${skeins}</b>${colorOnly?` · plus ${s2(colorOnly)} with no amount entered, so the total isn't complete`:''}</p>`:''}
 ${steps.length?`<ul class="next noprint">${steps.map(([c,t,b,a],i)=>`<li class="${c}"><span>${esc(t)}</span><button type="button" class="sec small" id="ns-${i}" data-ns="${a}">${b}</button></li>`).join('')}</ul>`:''}
 <nav class="jump noprint" aria-label="Jump to"${P.ready?' hidden':''}><a href="#pThreads">Your colors</a><a href="#pReviewH">Needs attention (${s.review})</a><a href="#pShopH">Shopping list (${P.lines.length})</a></nav></section>`;
 $('pPlan').innerHTML=`<div class="noprint ffstore-bar"><button type="button" class="sec" id="pStoreBtn" aria-pressed="${storeOn}">${storeOn?'Back to full list':'<span aria-hidden="true">🧺</span> Store mode'}</button></div><div id="pStore" class="noprint" hidden></div><h3 id="pShopH" tabindex="-1">Shopping list</h3><h4>Need to buy</h4>${FF_EST.line(tb.filter(isAsm).length,'pEstSum')}<ul>${tb.map(l=>`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}"> ${li(l)}</label>${mw(l)}</li>`).join('')}${P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').map(t=>`<li>DMC ${esc(lab(t.it.code))} · <span class="unk">amount not entered</span>. Add it to check this color off.</li>`).join('')||''}</ul>${tb.length||colorOnly?'':(P.checkFirst.length?'<p class="mut">Nothing on your shopping list just yet. Once you\'ve checked your threads, we\'ll help you see what\'s still missing.</p>':'')}
 ${P.checkFirst.length?`<h4 id="pCheckH">Check first (${P.checkFirst.length})</h4><p class="cfnote" id="pCfNote">${CFS.shopNote(P.checkFirst.length)}</p><ul id="pCheck">${(L=>P.checkFirst.map(t=>`<li>${CFS.rowLab(t)}${cfActs(t,L[t.it.code],'cfb',1)}</li>`).join(''))(cfLinks(P))}</ul>`:''}${shopDone(p,P,tb,aw,'plan')}
 <details class="psec" id="pAwBox"${secOpen('pAwBox',!!aw.length)}><summary><h4>Bought: check in when it arrives (${aw.length})</h4></summary><p class="hint">Ticking a thread as bought doesn't count it as ready. Check it in once you have it in hand.</p><ul>${aw.map(l=>{const k=sid(l.key);return`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}" checked> ${li(l)}</label>${mw(l)}
  <div class="noprint"><button type="button" class="sec small" id="rb-${k}" data-rb="${esc(l.key)}">I received this thread…</button>
  <div class="rform" id="rf-${k}" hidden><label for="rq-${k}">How many skeins of ${BRAND[P.dest]} ${esc(disp(P.dest,l.to))} arrived? (${l.q} still needed)</label><br><input type="number" id="rq-${k}" min="1" step="1" inputmode="numeric" class="qbox"> <button type="button" class="pri small" id="rc-${k}" data-rc="${esc(l.key)}">Save</button> <button type="button" class="ghost small" data-rx="${k}">Cancel</button></div></div></li>`}).join('')||'<li class="mut">Nothing waiting to check in.</li>'}</ul></details>
 <details class="psec" id="pReviewBox"${((n)=>{if(n>(revSeen[p.id]||0))delete openSec.pReviewBox;revSeen[p.id]=n;return secOpen('pReviewBox',n>0)})(P.review.length)}><summary><h3 id="pReviewH" tabindex="-1">Needs attention (${P.review.length})</h3></summary><ul>${P.review.map(x=>`<li>DMC ${esc(lab(x.it.code))} · needs ${esc(needOf(p,x.it))}: <b>${(KIND[x.kind]||KIND.other)[1]}.</b> ${esc(x.why)}</li>`).join('')||'<li class="mut">Nothing needs attention.</li>'}</ul></details>
 <details class="psec" id="pHaveBox"${secOpen('pHaveBox',!!P.ready)}><summary><h3>Ready (${P.have.length})</h3></summary><ul>${P.have.map(x=>`<li>DMC ${esc(lab(x.it.code))} · needs ${esc(needOf(p,x.it))}${x.d.owned!==null?` · you have ${x.d.owned}`:''} · ${x.state==='received'?`received ${x.recv} ${BRAND[P.dest]} ${esc(disp(P.dest,x.r.to))}`:'already had it'}</li>`).join('')||'<li class="mut">Nothing ready yet.</li>'}</ul></details>
 ${p.notes?`<p class="printonly"><b>Notes:</b> ${esc(p.notes)}</p>`:''}<div class="totals">${esc(costLine(P))}</div>
 <div class="row noprint"><button type="button" class="pri" id="pPrint">Print</button><button type="button" class="sec" id="pCopy">Copy as text</button><button type="button" class="sec" id="pCsv">Download spreadsheet (CSV)</button></div>
 <p id="pMsg" class="hint" role="status" aria-live="polite"></p><textarea id="pFallback" class="noprint" hidden readonly aria-label="Project text to copy" style="width:100%;min-height:120px"></textarea>`;
 {const w=document.createElement('div');w.id='pWtb';w.hidden=true;$('pPlan').appendChild(w);if(window.FlossFoxShop)FlossFoxShop.render(w,FlossFoxShop.fromProject(p,P),{context:'project'})}   // read-only consumer of the plan
 if((window.FLOSS_FOX_ENV==='preview'||window.FLOSS_FOX_DIRECT_LINKS===true)&&window.FlossFoxSkeinPreviewUI&&window.FlossFoxShop){   // 2.0A: inline store pills on each Need to buy row
  const nd=FlossFoxShop.fromProject(p,P).needs,ul=$('pPlan').querySelector('ul');
  if(ul){const lis=[...ul.children].filter(x=>{const c=x.querySelector(':scope > label > [data-bought]');return c&&!c.checked});
   if(lis.length===nd.length)FlossFoxSkeinPreviewUI.inline(lis.map((li,i)=>({li,need:nd[i]})))}}
 const el=$('pPlan'),re=msg=>{renderEditor();renderList();if(msg)$('pMsg').textContent=msg};
 $('pSum').querySelectorAll('[data-ns]').forEach(b=>b.onclick=()=>{if(b.dataset.ns==='shop')showView('shop');else{filt='att';query='';renderEditor();$('pThreads').scrollIntoView();const f=$('f-att');if(f)f.focus({preventScroll:true})}});
 el.querySelectorAll('[data-bought]').forEach(cb=>cb.onchange=()=>{if(cb.checked)p.purchased[cb.dataset.bought]=true;else delete p.purchased[cb.dataset.bought];touch(p);re(cb.checked?'Marked as bought. Check it in when you have it.':'Moved back to Need to buy.')});
 el.querySelectorAll('[data-rb]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rb);$('rf-'+k).hidden=false;$('rq-'+k).focus()});
 el.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{$('rf-'+b.dataset.rx).hidden=true});
 el.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rc),v=$('rq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('pMsg').textContent='Enter how many whole skeins arrived (1 or more). Nothing changed.';$('rq-'+k).focus();return}const L0=plan(p).lines.find(x=>x.key===b.dataset.rc),full=!!L0&&+v>=L0.q;re(receive(p,b.dataset.rc,+v));if(window.FlossFoxPip&&FlossFoxPip.react)FlossFoxPip.react('pipA.checkin',{full},'#pMsg',{siteAnnounces:true})});
 renderStore(p,P);$('pStoreBtn').onclick=()=>{storeOn=!storeOn;renderEditor();const f=$(storeOn?'pStoreH':'pStoreBtn');if(f)f.focus({preventScroll:true})};
 renderFlow(p,P);
 if(window.FlossFoxPipReadinessUI&&FlossFoxPipReadinessUI.renderInto)FlossFoxPipReadinessUI.renderInto($('pReady'),p,P);
 bindOut(p,'p')}
function bindOut(p,pre){$(pre+'Print').onclick=()=>print();$(pre+'Copy').onclick=async()=>{const t=planText(p),m=$(pre+'Msg'),f=$(pre+'Fallback');try{if(!navigator.clipboard)throw 0;await navigator.clipboard.writeText(t);m.textContent='✓ Copied. Paste it into a note or message.';f.hidden=true;if(window.FlossFoxPip)FlossFoxPip.saved(m)}catch(e){m.textContent="Couldn't copy automatically. Select the text below and copy it.";f.value=t;f.hidden=false;f.focus();f.select()}};
 $(pre+'Csv').onclick=()=>{download(csv(p),safe(p.name)+'.csv','text/csv');$(pre+'Msg').textContent='Spreadsheet file downloaded.'}}
// Shopping list tab: the project's #pPlan (shopping list and everything after it) lives in #shopView, not in the Projects view.
function mountShop(p){const sb=$('shopBody'),pl=$('pPlan');if(!sb)return;if(pl&&p){sb.appendChild(pl);$('shopProj').textContent='For project: '+p.name}
 document.querySelectorAll('#projEdit nav.jump a[href^="#"]').forEach(x=>{const id=x.getAttribute('href').slice(1);if(sb.querySelector('#'+id))x.onclick=e=>{e.preventDefault();showView('shop');const t=$(id);if(t){t.scrollIntoView();t.focus({preventScroll:true})}}});shopState()}
function shopPicker(){const h=$('shopPickRow');if(!h)return;const ps=store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated));h.hidden=!ps.length;if(!ps.length){h.innerHTML='';return}
 h.innerHTML=`<label for="shopPick">${esc(FS('shopPickLabel'))}</label><select id="shopPick">${openId&&proj(openId)?'':`<option value="" selected>${esc(FS('shopPickNone'))}</option>`}${ps.map(x=>`<option value="${esc(x.id)}"${x.id===openId?' selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
 $('shopPick').onchange=e=>{const id=e.target.value;if(!id||!proj(id))return;if(openId!==id){expanded.clear();touched.clear();haveShown=false;filt='all';query='';shopPanel=null}const sw=openId!==id;openId=id;mode='edit';{const pp=proj(id);if(pp)autoCmp(pp)}if(sw){const sb=$('shopBody');if(sb)sb.textContent=''}ensureShop();const s=$('shopPick');if(s)s.focus()}}
function shopState(){shopPicker();const sb=$('shopBody'),p=openId&&proj(openId),has=!!(p&&sb&&sb.querySelector('#pPlan'));{const k=$('pKit');if(k)k.hidden=!has}$('shopEmpty').hidden=has;sb.hidden=!has;$('shopProj').hidden=!has||!!$('shopPick');{const sv=$('shopSeveral');if(sv)sv.hidden=!store.projects.length}{const nx=$('shopBack');if(nx){nx.hidden=!has;nx.textContent=FS('next').shop}}
 const n=has?sb.querySelectorAll('#pPlan > ul:first-of-type [data-bought]:not(:checked)').length:0;$('shopCount').textContent=n?`(${n})`:''}
// ci005-67: redraw when My threads (or what's set aside) changed since the Shop was drawn, so the derived readiness catches up with no reload.
let shopColl=null;const collSig=()=>{try{const T=window.FlossFoxThreadsUI;return JSON.stringify(T?T.data():null)+(AL()?JSON.stringify(ALS().read()):'')}catch(e){return null}};
function ensureShop(){const p=openId&&proj(openId);if(!p){const sb=$('shopBody');if(sb)sb.textContent='';shopState();return}const cs=collSig(),stale=cs!==shopColl;shopColl=cs;if(!$('shopBody').querySelector('#pPlan')||mode==='shop'||stale){const m=mode;mode='edit';renderEditor();mode=m;if(m==='shop')renderEditor()}shopState()}
function openShop(p){mode='shop';shopPanel=null;query='';renderEditor();window.scrollTo(0,0);const h=$('shH');if(h)h.focus({preventScroll:true})}
function renderShop(){const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}const focusId=document.activeElement&&document.activeElement.id,y=window.scrollY,P=plan(p);
 const tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),co=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy'),done=P.have.filter(t=>!t.cf),need=P.sum.toBuy+co.length;
 const swatches=l=>`<span class="bigsw" style="background:${DMC[l.from[0]].hex}" title="Approximate color"></span>`;
 const panel=(l,k)=>{if(!shopPanel||shopPanel.key!==l.key)return'';if(shopPanel.step==='choose')return`<div class="panel" role="group" aria-label="Where is it?"><p>Where is it?</p><div class="acts"><button type="button" class="pri" id="sw-${k}" data-sw="${esc(l.key)}">I have it with me</button><button type="button" class="sec" id="sd-${k}" data-sd="${esc(l.key)}">Waiting for delivery</button><button type="button" class="ghost" data-sc="1">Cancel</button></div></div>`;
  return`<div class="panel"><label for="sq-${k}"><b>How many skeins did you get?</b> (${l.q} needed)</label><div class="acts"><input type="number" id="sq-${k}" min="1" step="1" inputmode="numeric" class="qbox" aria-describedby="sqh-${k}"><button type="button" class="pri" id="ss-${k}" data-ss="${esc(l.key)}">Save</button><button type="button" class="ghost" data-sc="1">Cancel</button></div><div class="hint" id="sqh-${k}">Enter only what you actually have in hand.</div></div>`};
 const sc=(l,awaiting)=>{const k=sid(l.key);return`<li class="scard" id="sh-${k}" data-q="${esc((disp(P.dest,l.to)+' '+l.from.map(c=>lab(c)+' '+DMC[c].name).join(' ')).toLowerCase())}"><div class="top">${swatches(l)}<div><div class="code">${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</div>${P.dest!=='dmc'||l.from.length>1?`<div class="for">for DMC ${l.from.map(c=>esc(lab(c))).join(', ')}</div>`:`<div class="for">${esc(cap(DMC[l.from[0]].name))}</div>`}</div><div class="qty">${plural(l.q,'skein')}${l.recvd?`<br><small class="mut">${l.recvd} received</small>`:''}</div></div>
  ${awaiting?`<div class="stat awaiting"><span aria-hidden="true">📦</span> Bought: check it in when it arrives</div><div class="acts"><button type="button" class="pri" id="sr-${k}" data-sr="${esc(l.key)}">I received it</button><button type="button" class="ghost" id="su-${k}" data-su="${esc(l.key)}">Not bought after all</button></div>`
   :`<div class="acts"><button type="button" class="pri" id="sb-${k}" data-sb="${esc(l.key)}" aria-expanded="${!!(shopPanel&&shopPanel.key===l.key)}">Bought it</button></div>`}${panel(l,k)}</li>`};
 E.innerHTML=`<div class="shophead"><div class="ptitle"><button type="button" class="ghost" id="shBack">← Back to project</button><span class="mut">${esc(p.name)} · ${esc(BRAND[P.dest])}</span></div>
 <h2 id="shH" tabindex="-1">Shopping list</h2><p class="ffsub mut small">Gathered gently, at your pace</p>
 <p class="shopsum" role="status" aria-live="polite">${need?`You still need ${s2(need)}.`:P.sum.checkFirst?'Nothing on your shopping list just yet. Once you\'ve checked your threads, we\'ll help you see what\'s still missing.':(aw.length?'Everything is bought. Check threads in as they arrive.':'Nothing left to buy.')}${P.sum.checkFirst?` <b class="cfnote">${cfNote(P.sum.checkFirst)}</b>`:''}</p>
 ${P.lines.length||co.length?`<p class="hint">Skeins still to get: <b>${P.lines.reduce((a,l)=>a+l.q,0)}</b>${co.length?` · ${s2(co.length)} with no amount entered`:''}</p>`:''}
 ${P.lines.length+co.length>6?`<div class="searchrow"><label class="sr" for="shSearch">Find a thread</label><input type="search" id="shSearch" placeholder="Find a thread, e.g. 310" autocomplete="off"><button type="button" class="sec" id="shSearchClear" hidden>Clear</button></div>`:''}</div>
 ${(n=>n>0?`<p class="hint">${s2(n)} still need${n===1?'s':''} attention in your project, so ${n===1?"it isn't":"they aren't"} on this list yet.</p>`:'')(P.review.filter(t=>!t.cf).length-co.length)}
 
 <p id="shMsg" class="ok-msg" role="status" aria-live="polite"></p>
 <ul class="shoplist" id="shList">${tb.map(l=>sc(l,false)).join('')}${co.map(t=>`<li class="scard" data-q="${esc((lab(t.it.code)+' '+DMC[t.it.code].name).toLowerCase())}"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${esc(cap(DMC[t.it.code].name))}</div></div><div class="qty unk" style="font-size:.85rem">Amount not entered</div></div><p class="hint">Add the amount in your project to check this color off.</p></li>`).join('')}<li class="noresults" id="shNoRes" hidden></li></ul>
 ${P.checkFirst.length?`<h3 id="shCheckH">Check first (${P.checkFirst.length})</h3><p class="hint">${CFS.shopNote(P.checkFirst.length)}</p><ul class="shoplist" id="shCheck">${(L=>P.checkFirst.map(t=>`<li class="scard"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">${CFS.rowLab(t)}</div></div></div>${cfActs(t,L[t.it.code],'cfs',1)}</li>`).join(''))(cfLinks(P))}</ul>`:''}
 ${!co.length?shopDone(p,P,tb,aw,'shop'):''}
 ${aw.length?`<h3>Bought: check in when it arrives (${aw.length})</h3><ul class="shoplist" id="shAw">${aw.map(l=>sc(l,true)).join('')}</ul>`:''}
 <details class="donebox"${done.length&&!tb.length?' open':''}><summary>Done (${done.length})</summary><ul class="shoplist">${done.map(t=>`<li class="scard"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${t.state==='received'?`Received ${t.recv} × ${BRAND[P.dest]} ${esc(disp(P.dest,t.r.to))}`:'You have enough'}</div></div></div>${t.state==='received'?`<div class="acts"><button type="button" class="ghost" id="sx-${esc(t.it.code)}" data-sx="${esc(t.it.code)}">Undo check-in</button></div>`:''}</li>`).join('')||'<li class="mut" style="list-style:none">Nothing yet.</li>'}</ul></details>
 <details class="shopextra"><summary>Copy, download or print</summary><div class="row"><button type="button" class="sec" id="sCopy">Copy as text</button><button type="button" class="sec" id="sCsv">Download spreadsheet (CSV)</button><button type="button" class="sec" id="sPrint">Print</button></div><p id="sMsg" class="hint" role="status" aria-live="polite"></p><textarea id="sFallback" hidden readonly aria-label="Shopping list text to copy" style="width:100%;min-height:120px"></textarea></details>`;
 {const w=document.createElement('div');w.id='shWtb';w.hidden=true;const a=$('shAw');(a||$('shList')).after(w);if(window.FlossFoxShop)FlossFoxShop.render(w,FlossFoxShop.fromProject(p,P),{context:'shop'})}
 const re=msg=>{renderEditor();renderList();if(msg)$('shMsg').textContent=msg};
 $('shBack').onclick=()=>{mode='edit';query='';renderEditor();window.scrollTo(0,0)};
 E.querySelectorAll('[data-sb]').forEach(b=>b.onclick=()=>{shopPanel={key:b.dataset.sb,step:'choose'};renderShop();const f=$('sw-'+sid(b.dataset.sb));if(f)f.focus({preventScroll:true})});
 E.querySelectorAll('[data-sc]').forEach(b=>b.onclick=()=>{const k=shopPanel&&shopPanel.key;shopPanel=null;renderShop();const f=k&&($('sb-'+sid(k))||$('sr-'+sid(k)));if(f)f.focus({preventScroll:true})});
 E.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{shopPanel={key:b.dataset.sw,step:'amount'};renderShop();$('sq-'+sid(b.dataset.sw)).focus({preventScroll:true})});
 E.querySelectorAll('[data-sr]').forEach(b=>b.onclick=()=>{shopPanel={key:b.dataset.sr,step:'amount'};renderShop();$('sq-'+sid(b.dataset.sr)).focus({preventScroll:true})});
 E.querySelectorAll('[data-sd]').forEach(b=>b.onclick=()=>{p.purchased[b.dataset.sd]=true;shopPanel=null;touch(p);re('Marked as bought. Check it in when it arrives.')});
 E.querySelectorAll('[data-su]').forEach(b=>b.onclick=()=>{delete p.purchased[b.dataset.su];touch(p);re('Moved back to your shopping list.')});
 E.querySelectorAll('[data-ss]').forEach(b=>b.onclick=()=>{if(b.disabled)return;const k=sid(b.dataset.ss),v=$('sq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('shMsg').textContent='Enter how many whole skeins you got (1 or more). Nothing changed.';$('sq-'+k).focus();return}b.disabled=true;shopPanel=null;const L0=plan(p).lines.find(x=>x.key===b.dataset.ss),full=!!L0&&+v>=L0.q;re(receive(p,b.dataset.ss,+v));if(window.FlossFoxPip&&FlossFoxPip.react)FlossFoxPip.react('pipA.checkin',{full},'#shMsg',{siteAnnounces:true})});
 E.querySelectorAll('[data-sx]').forEach(b=>b.onclick=()=>{const c=b.dataset.sx;if(!confirm(`Undo checking in DMC ${lab(c)}? It goes back on your shopping list.`))return;p.decisions[c].recv=null;touch(p);re(`DMC ${lab(c)} is back on your shopping list.`)});
 const ss=$('shSearch');if(ss){const run=()=>{const q=ss.value.trim().toLowerCase();let n=0;E.querySelectorAll('#shList .scard').forEach(c=>{const sh=!q||c.dataset.q.includes(q);c.hidden=!sh;if(sh)n++});const nr=$('shNoRes');nr.hidden=!q||!!n;nr.textContent=`Nothing on your list matches “${ss.value}”.`;$('shSearchClear').hidden=!q};ss.oninput=run;$('shSearchClear').onclick=()=>{ss.value='';run();ss.focus()}}
 bindOut(p,'s');window.scrollTo(0,y);if(focusId){const f=document.getElementById(focusId);if(f)f.focus({preventScroll:true})}}
function bindEditor(p){const E=$('projEdit'),re=()=>{edited(p);touch(p);renderEditor();renderList()};
 $('pClose').onclick=closeProject;$('pShop').onclick=()=>showView('shop');$('pDelete').onclick=()=>delProject(p.id);
 $('pName').onchange=()=>{p.name=$('pName').value.trim().slice(0,100)||'Untitled project';touch(p);renderList();renderPlan(p)};
 $('pNotes').onchange=()=>{p.notes=$('pNotes').value.slice(0,2000);touch(p);renderPlan(p)};
 $('pDest').onchange=()=>{p.buyBrand=$('pDest').value;re()};
 $('pStatus').onchange=()=>{p.status=$('pStatus').value;touch(p);renderList();pstatus(`Status: ${$('pStatus').selectedOptions[0].textContent}.`)};
 $('pSearch').oninput=()=>{query=$('pSearch').value;applyFilter(plan(p))};$('pSearchClear').onclick=()=>{query='';$('pSearch').value='';applyFilter(plan(p));$('pSearch').focus()};
 E.querySelectorAll('[data-filt]').forEach(b=>b.onclick=()=>{filt=b.dataset.filt;E.querySelectorAll('[data-filt]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));applyFilter(plan(p))});
 $('pAllBuy').onclick=()=>{let n=0;p.items.forEach(it=>{if(!p.decisions[it.code].status){p.decisions[it.code].status='buy';n++}});re();pstatus(`${s2(n)} marked Need to buy.`)};
 E.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>{const c=b.dataset.exp;if(expanded.has(c))expanded.delete(c);else{expanded.add(c);justOpened=c}renderEditor();justOpened=null});
 E.querySelectorAll('[data-st]').forEach(r=>r.onchange=()=>{touched.add(r.dataset.st);const it=p.items.find(x=>x.code===r.dataset.st),d=p.decisions[r.dataset.st],rq=reqOf(p,it);d.status=r.value;d.estimateChecked=r.value==='have'&&rq.source==='estimated'?SK.fingerprint(it,p.skeinEstimator,rq.estimate):null;re()});
 E.querySelectorAll('[data-stitches]').forEach(i=>i.onchange=()=>{const it=p.items.find(x=>x.code===i.dataset.stitches),v=i.value.trim();if(!v){it.stitchCount=null;it.stitchCountReviewed=false;re();return}const parsed=SK.wholeInput(v,0,SK.MAX_STITCHES,'stitch count');if(!parsed.ok){pstatus(parsed.error);i.value=it.stitchCount==null?'':it.stitchCount;return}it.stitchCount=parsed.value;it.stitchCountReviewed=true;re()});
 E.querySelectorAll('[data-count-confirm]').forEach(b=>b.onclick=()=>{p.items.find(x=>x.code===b.dataset.countConfirm).stitchCountReviewed=true;re()});
 E.querySelectorAll('[data-strands]').forEach(i=>i.onchange=()=>{const it=p.items.find(x=>x.code===i.dataset.strands);if(i.value)it.strandCount=Number(i.value);else delete it.strandCount;re()});
 E.querySelectorAll('[data-stitch-type]').forEach(i=>i.onchange=()=>{const it=p.items.find(x=>x.code===i.dataset.stitchType);if(i.value)it.stitchType=i.value;else delete it.stitchType;re()});
 E.querySelectorAll('[data-own-confirm]').forEach(b=>b.onclick=()=>{p.decisions[b.dataset.ownConfirm].ownedSource='user';re()});
 E.querySelectorAll('[data-anc]').forEach(s=>s.onchange=()=>{p.decisions[s.dataset.anc].anchor=s.value||null;re()});
 E.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{const c=b.dataset.rr;if(!confirm(`Undo checking in DMC ${lab(c)}? It goes back on your shopping list.`))return;p.decisions[c].recv=null;re();pstatus('Check-in undone.')});
 E.querySelectorAll('[data-q]').forEach(i=>{if(i.tagName!=='INPUT')return;i.onchange=()=>{const v=i.value.trim(),it=p.items.find(x=>x.code===i.dataset.q);
  if(!/^\d+$/.test(v)||+v<1){pstatus(`"${v}" isn't a whole number of skeins (1 or more), so nothing changed. Tick "Not entered" if you don't know.`);i.value=it.qty===null?'':it.qty;return}
  if(+v>CAP()&&!confirm(`${v} skeins of DMC ${lab(it.code)} is a lot (more than ${CAP()}). Is that really skeins, not a stitch count? OK keeps ${v} skeins.`)){pstatus(`Kept ${it.qty===null?'the amount as not entered':plural(it.qty,'skein')}. Stitch counts go in the Full-cross count box in Details, or in your pasted list, like "310 1160 stitches".`);i.value=it.qty===null?'':it.qty;return}it.qty=+v;it.stated=true;it.assumed=0;re()}});
 E.querySelectorAll('[data-unk]').forEach(c=>c.onchange=()=>{const it=p.items.find(x=>x.code===c.dataset.unk);if(c.checked){it.qty=null;it.stated=true;it.assumed=0}else{it.qty=1;it.stated=false;it.assumed=1;pstatus('Amount set to 1 skein (assumed). Change it to the real number.')}re()});
 E.querySelectorAll('[data-own]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),d=p.decisions[i.dataset.own];
  if(v===''){d.owned=null;d.ownedSource=null;d.ownedPartial=false;re();return}const n=Number(v);if(!isFinite(n)||n<0){pstatus(`"${v}" isn't a valid amount, so nothing changed.`);i.value=d.owned===null?'':d.owned;return}if(n>CAP()&&!confirm(`You have ${n} skeins of DMC ${lab(i.dataset.own)}? That's more than ${CAP()}. OK keeps ${n}.`)){i.value=d.owned===null?'':d.owned;pstatus('Nothing changed.');return}d.owned=Math.round(n*100)/100;d.ownedSource='user';d.ownedPartial=false;re()});
 E.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{const c=b.dataset.rm,L=lab(c);
  const ok=await FlossFoxConfirm.ask({pose:'thinking',title:`Remove DMC ${L} from this project?`,
   body:'Are you sure? It only leaves this project. Your thread collection doesn\'t change.'});
  if(!ok)return;p.items=p.items.filter(x=>x.code!==c);delete p.decisions[c];expanded.delete(c);re()});
 $('pAddBtn').onclick=()=>{const {items,errs}=parse($('pAdd').value);items.forEach(n=>{const ex=p.items.find(x=>x.code===n.code);
  if(ex){ex.qty=(ex.qty===null||n.qty===null)?null:ex.qty+n.qty;ex.src=ex.src.concat(n.src);ex.stitchCountReviewed=false;ex.assumed=ex.qty===null?0:asmOf(ex)+asmOf(n);ex.stated=ex.assumed===0;ex.stitchCount=ex.stitchCount!=null&&n.stitchCount!=null&&ex.stitchCount+n.stitchCount<=SK.MAX_STITCHES?ex.stitchCount+n.stitchCount:null}else{p.items.push({code:n.code,qty:n.qty,stated:n.stated,assumed:asmOf(n),src:n.src,stitchCount:n.stitchCount||null});p.decisions[n.code]=normDecision(n.code,{})}});
  touch(p);renderEditor();renderList();$('pAddBox').open=true;$('pAddErr').innerHTML=errs.length?`<div class="errbox"><b>We couldn't add ${errs.length}. They're still in the box so you can fix them:</b><ul>${errs.map(e=>`<li>"${esc(e.t)}": ${esc(e.why)}</li>`).join('')}</ul></div>`:'';if(errs.length)$('pAdd').value=errs.map(e=>e.t).join('\n');pstatus(`Added ${s2(items.length)}.`);if(items.length&&window.FlossFoxPip)FlossFoxPip.saved($('pMsg'),`Added ${s2(items.length)}`)}}

// ---- Export / backup / restore ----
const safe=n=>(n||'project').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'project';
function download(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function csv(p){const P=plan(p),extra=!!(p.skeinEstimator&&p.skeinEstimator.enabled===true),q=v=>{v=v===null||v===undefined?'':String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const SN={have:'confirmed sufficient (owned)',received:'confirmed sufficient (received)',buy:'to buy',awaiting:'bought, awaiting confirmation',review:'needs review'};
 const rows=[['project','dmc_code','dmc_name','needed_skeins','quantity_stated','status','owned_skeins','buy_in','will_use','source','to_buy_skeins','bought','received_skeins','readiness','issue','assumed_skeins','stitch_count','shopping_section',...(extra?['quantity_source','supplied_skeins','pip_estimated_usage_skeins','pip_planning_skeins','pip_assumptions','stitch_type','strands_per_cross']:[])]];
 P.threads.forEach(t=>{const it=t.it,d=t.d,r=t.r,line=P.lines.find(l=>l.from.includes(it.code));
  const e=t.req.estimate;rows.push([p.name,lab(it.code),DMC[it.code].name,t.req.amount===null?'UNKNOWN':t.req.amount,t.estimated?'estimated':t.req.source==='unavailable'?'unknown':(a=>a===0?'yes':a>=it.qty?'assumed':'partly assumed')(asmOf(it)),d.status||'not checked',d.owned===null?'':d.owned,BRAND[P.dest],r.ok?disp(P.dest,r.to):'',r.ok?r.prov:'',line?t.rem+(line.from.length>1?` (shared line total ${line.q})`:''):'',line?(line.bought?'yes':'no'):'',t.recv||'',t.cf?'check first':SN[t.state],t.cf?cfWhy(t):t.why,t.estimated||it.qty===null?'':asmOf(it),it.stitchCount==null?'':it.stitchCount,t.cf?'check first':t.state==='buy'||t.kind==='amount'&&d.status==='buy'?'need to buy':t.state==='awaiting'?'bought':t.state==='review'?'needs attention':'ready',...(extra?[t.req.source,it.qty,e.kind==='estimate'?e.base:'',e.kind==='estimate'?e.planning:'',SK.assumptions(p.skeinEstimator),it.stitchType||'',e.kind==='estimate'?e.strands:it.strandCount||'']:[])])});
 if(P.sum.checkFirst)rows.push([p.name,'','NOTE: '+cfNote(P.sum.checkFirst)+' The estimate covers Need to buy only.',...Array(rows[0].length-3).fill('')]);
 return rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n'}
// Full backup, version 1: projects (top-level array, so 1.6 can still restore the projects) + thread collection + small prefs.
// Demo items are never exported. Old project-only backups (no kind) are still accepted.
const PFX=KEY.replace(/\.v1$/,''),PREKEY=PFX+'.preimport.v1',BK_VERSION=2; // P3: optional 'allocations' field (own schema, fails closed); kept at v2 so older builds still restore projects and threads
const PREF_KEYS={pip:PFX+'.pip.v1',hints:PFX+'.hints.v1',tips:PFX+'.tips.v1',fabric:PFX+'.fabric.v1',backup:PFX+'.backup-prefs.v1'};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const TUI=()=>window.FlossFoxThreadsUI;
function fullBackup(){const T=TUI(),prefs={};for(const k in PREF_KEYS){const v=lsGet(PREF_KEYS[k]);if(v!==null)prefs[k]=v}
 return{app:'floss-fox',kind:'full-backup',version:BK_VERSION,schema:SCHEMA,exported:nowISO(),projects:store.projects.filter(p=>!p.demo),threads:T?T.exportData():{schema:1,threads:{}},prefs,...((S=>S&&S.writable()?{allocations:S.read()}:{})(ALS()))}}
function backup(){const d=fullBackup(),nt=Object.keys(d.threads.threads).length;download(JSON.stringify(d,null,2),'floss-fox-backup-'+nowISO().slice(0,10)+'.json','application/json');
 pstatus(`Backup downloaded with ${plural(d.projects.length,'project')} and ${plural(nt,'thread color')}. Keep the file somewhere safe, the way you'd keep a favorite pattern.`)}
const PREF_OK={backup:v=>!!(window.FlossFoxBackupCore&&FlossFoxBackupCore.validPrefsString(v)),pip:v=>v==='shown'||v==='hidden',hints:v=>v==='on'||v==='off',tips:v=>{try{const a=JSON.parse(v);return Array.isArray(a)&&a.every(x=>typeof x==='string')}catch(e){return false}},fabric:v=>{try{const o=JSON.parse(v);return!!o&&typeof o==='object'&&!Array.isArray(o)}catch(e){return false}}};
// returns {projects, threads|null, prefs, skipped, full} or {err}
function checkBackup(d){if(!d||typeof d!=='object'||d.app!=='floss-fox')return{err:'bad'};
 const full=d.kind==='full-backup';if(d.kind!==undefined&&!full)return{err:'bad'};
 if(full&&(typeof d.version!=='number'||d.version>BK_VERSION))return{err:typeof d.version==='number'?'new':'bad'};
 const m=migrate(d);if(!m)return{err:'bad'};if(m.tooNew)return{err:'new'};let threads=null,tsk=0,prefs={};
 if(full){const T=TUI();if(!T)return{err:'bad'};const tm=T.core.migrate(d.threads);if(!tm)return{err:'bad'};if(tm.tooNew)return{err:'new'};threads=tm.data.threads;tsk=tm.skipped;
  if(d.prefs&&typeof d.prefs==='object')for(const k in PREF_KEYS)if(typeof d.prefs[k]==='string'&&PREF_OK[k](d.prefs[k]))prefs[k]=d.prefs[k]}
 let allocations=null;if(full&&d.allocations!==undefined){if(!AL())return{err:'bad'};const v=AL().validate(d.allocations);if(!v.ok)return{err:v.reason==='future-schema'?'new':'bad'};const ids=new Set(m.data.projects.map(x=>x.id));if(v.data.allocations.some(r=>!ids.has(r.projectId)))return{err:'bad'};allocations=v.data}
 return{projects:m.data.projects,threads,prefs,skipped:m.skipped+tsk,full,allocations}}
function snapshot(){const keys=[KEY,ALKEY,TUI()?TUI().KEY:PFX+'.threads.v1',...Object.values(PREF_KEYS)],o={};keys.forEach(k=>{o[k]=lsGet(k)});return{at:nowISO(),keys:o}}
function undoImportRow(){const el=$('undoImport');if(!el)return;let s=null;try{s=JSON.parse(lsGet(PREKEY)||'null')}catch(e){}
 if(!s||!s.keys){el.hidden=true;el.innerHTML='';return}el.hidden=false;
 el.innerHTML=`<span class="hint">Your data from before the last import (${esc(new Date(s.at).toLocaleString())}) is kept in this browser.</span> <button type="button" class="sec small" id="undoImportBtn">Undo last import</button>`;
 $('undoImportBtn').onclick=()=>{if(!confirm('Undo the last import? Your projects, thread collection and preferences go back to exactly how they were before it. Anything changed since the import is lost.'))return;if(window.FlossFoxSnapshots)FlossFoxSnapshots.take('undo',{force:true});
  try{for(const k in s.keys){if(s.keys[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,s.keys[k])}localStorage.removeItem(PREKEY)}catch(e){pstatus('Undo failed: your browser blocked the save. Nothing else was changed.');return}
  location.hash='#projects';location.reload()}}
const RPIP=p=>`<picture><source type="image/webp" srcset="assets/pip/pip-${p}-160.webp"><img class="rpip" data-pose="${p}" src="assets/pip/pip-${p}-160.png" width="160" height="240" alt=""></picture>`;
function restoreFile(file){const R=$('restorePanel');if(!file)return;$('backupBox').open=true;if(file.size>5e6){R.hidden=false;R.innerHTML='<b class="warn">That file is too large to be a Floss Fox backup. Nothing was changed.</b>';return}
 R.hidden=false;R.innerHTML=RPIP('magnifier')+'<p>Let me check this backup…</p>'; // shown only while the file is really being read and checked
 file.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){d=null}const c=checkBackup(d);
  if(c.err){pendingRestore=null;R.hidden=false;R.innerHTML=RPIP('puzzled')+`<b class="warn">${c.err==='new'?'This backup was made by a newer version of Floss Fox and can\'t be restored here. Nothing was changed.':'This file isn\'t a valid Floss Fox backup (it may be damaged or from another app). Nothing was changed.'}</b>`;pstatus('Restore failed. Nothing was changed.');return}
  pendingRestore=c.projects;const clash=pendingRestore.filter(p=>proj(p.id)).length,T=TUI(),mine=T?T.data().threads:{};
  const nt=c.threads?Object.keys(c.threads).length:0,tclash=c.threads?Object.keys(c.threads).filter(k=>mine[k]).length:0,np=Object.keys(c.prefs).length;
  R.innerHTML=RPIP('presenting')+`<p><b>I checked it. This backup has ${plural(pendingRestore.length,'project')}</b>${c.full?` and <b>${nt} thread color${nt===1?'':'s'}</b>${np?` plus ${np} preference${np===1?'':'s'}`:''}`:' (an older projects-only backup, so your thread collection won\'t be touched)'}${c.skipped?`; ${c.skipped} damaged or duplicate entr${c.skipped>1?'ies were':'y was'} skipped`:''}. ${clash?`${plural(clash,'project')} already exist${clash===1?'s':''} here (same project).`:'None of the projects already exist here.'}${c.full&&tclash?` ${plural(tclash,'color')} ${tclash===1?'is':'are'} already in your collection.`:''}</p>
  <fieldset id="imodeSet"><legend>How to import:</legend><label><input type="radio" name="imode" value="merge" checked> <b>Merge</b>: add what's new, keep everything you already have${c.full?' (your skein counts are kept for colors you already have)':''}</label><br><label><input type="radio" name="imode" value="replace"> <b>Replace</b>: make my ${c.full?'projects and thread collection':'projects'} exactly match the backup</label></fieldset>
  ${clash?`<fieldset id="rmodeSet"><legend>When merging, for projects that already exist:</legend><label><input type="radio" name="rmode" value="replace" checked> Replace mine with the backup version</label><br><label><input type="radio" name="rmode" value="skip"> Keep mine, skip those</label><br><label><input type="radio" name="rmode" value="copy"> Keep both (import as a renamed copy)</label></fieldset>`:''}
  <p class="hint">A copy of your current data is kept first, so you can undo the import.</p>
  <div class="row"><button type="button" class="pri" id="rGo">Restore</button><button type="button" class="sec" id="rCancel">Cancel</button></div>`;
  $('rCancel').onclick=()=>{pendingRestore=null;R.hidden=true;pstatus('Restore canceled.')};
  $('rGo').onclick=()=>{const im=(document.querySelector('input[name=imode]:checked')||{}).value||'merge';
   if(im==='replace'&&!confirm(`Replace your data with this backup? Your ${plural(store.projects.filter(p=>!p.demo).length,'project')}${c.full?` and ${Object.keys(mine).length} thread color${Object.keys(mine).length===1?'':'s'}`:''} will be replaced by the backup's ${plural(pendingRestore.length,'project')}${c.full?` and ${plural(nt,'color')}`:''}. You can undo this afterwards.`))return;
   const modeEl0=document.querySelector('input[name=rmode]:checked'),cmode=modeEl0?modeEl0.value:'replace',copyMap={},S=ALS();
   if(im==='merge'&&cmode==='copy')pendingRestore.forEach(x=>{if(proj(x.id))copyMap[x.id]=newId()});
   let alNext=null;if(S&&AL()&&window.FlossFoxAllocationBackup){const cur=S.read(),pr=FlossFoxAllocationBackup.prepare({current:cur,incoming:c.allocations,mode:im,collisionMode:cmode,incomingProjectIds:pendingRestore.map(x=>x.id),existingProjectIds:store.projects.filter(x=>!x.demo).map(x=>x.id),copyIdMap:copyMap});
    if(!pr.ok){pstatus('We stopped the restore because the set-aside threads in this backup don\'t fit. Nothing was changed.');return}
    if(JSON.stringify(pr.data)!==JSON.stringify(cur)){if(!S.writable()){pstatus('We stopped the restore because your set-aside list is read-only here. Nothing was changed.');return}alNext=pr.data}}
   if(window.FlossFoxSnapshots)FlossFoxSnapshots.take('import',{force:true});
   try{localStorage.setItem(PREKEY,JSON.stringify(snapshot()))}catch(e){if(!confirm('A safety copy of your current data couldn\'t be saved in this browser (storage full or blocked), so this import can\'t be undone. Import anyway?'))return}
   let add=0,rep=0,skip=0,cp=0,ta=0;
   if(im==='replace'){store.projects=store.projects.filter(p=>p.demo).concat(pendingRestore);rep=pendingRestore.length}
   else{const modeEl=document.querySelector('input[name=rmode]:checked'),mode=modeEl?modeEl.value:'replace';
    pendingRestore.forEach(p=>{const i=store.projects.findIndex(x=>x.id===p.id);if(i<0){store.projects.push(p);add++}else if(mode==='replace'){store.projects[i]=p;rep++}else if(mode==='skip')skip++;else{store.projects.push({...p,id:copyMap[p.id]||newId(),name:(p.name+' (restored copy)').slice(0,100)});cp++}})}
   let tok=true;
   if(c.full&&T){if(im==='replace'){tok=T.replaceAll({threads:c.threads});ta=nt}else{const merged=Object.assign({},c.threads,mine);ta=Object.keys(c.threads).filter(k=>!mine[k]).length;tok=T.replaceAll({threads:merged})}
    if(im==='replace')for(const k in c.prefs){try{localStorage.setItem(PREF_KEYS[k],c.prefs[k])}catch(e){}}}
   let aok=true;if(alNext){const r=S.replace(alNext);aok=r.ok;if(!aok){let s0=null;try{s0=JSON.parse(lsGet(PREKEY)||'null')}catch(e){}try{if(s0&&s0.keys)for(const k in s0.keys){if(s0.keys[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,s0.keys[k])}}catch(e){}pstatus('The restore failed while saving set-aside threads, so everything was put back how it was.');setTimeout(()=>{location.hash='#projects';location.reload()},1500);return}}
   pendingRestore=null;R.hidden=true;const ok=save()&&tok;renderList();if(openId&&proj(openId))renderEditor();undoImportRow();if(window.FlossFoxBackupUI)FlossFoxBackupUI.refresh();
   pstatus(`Restore ${ok?'done':'applied but NOT saved'} (${im}): ${add} added, ${rep} replaced, ${skip} skipped, ${cp} copied${c.full?`; ${ta} thread color${ta===1?'':'s'} ${im==='replace'?'restored':'added'}`:''}.`);if(ok&&window.FlossFoxPip)FlossFoxPip.saved($('projStatus'))}})
  .catch(()=>{R.hidden=false;R.innerHTML='<b class="warn">Couldn\'t read that file. Nothing was changed.</b>'})}

// ---- Wiring ----
let pipFirstPending=false;function pipFirstTry(){const P=window.FlossFoxPip;if(!pipFirstPending||!P||!P.firstProject)return;let seen=false;try{seen=!!localStorage.getItem(P.FIRST_KEY)}catch(e){seen=true}if(seen||P.firstProject($('projList')||$('projectsView')))pipFirstPending=false}
function showView(v,fromHash){if(v==='projects'&&pipFirstPending)setTimeout(pipFirstTry,350);{const pc=$('planCard');if(pc&&!pc.hidden){pc.hidden=true;pc.innerHTML=''}}if(!fromHash&&location.hash!=='#'+v)history.pushState(null,'','#'+v);const V={convert:['convertView','tabConvert'],threads:['threadsView','tabThreads'],projects:['projectsView','tabProjects'],help:['helpView','tabHelp'],shop:['shopView','tabShop'],settings:['settingsView','tabSettings']};
 const T=window.FlossFoxThreadsUI;if(T&&!$('threadsView').hidden&&v!=='threads')T.leaveView();if(T&&!$('projectsView').hidden&&v!=='projects')T.tipDone('compare');
 for(const k in V){if(!$(V[k][0])||!$(V[k][1]))continue;const on=k===v;$(V[k][0]).hidden=!on;const t=$(V[k][1]);t.setAttribute('aria-pressed',String(on));if(on)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')}
 if(v==='threads'&&T)T.render();if(v==='shop')ensureShop();if(v==='projects'){renderList();if(openId&&proj(openId)){renderEditor();$('projEdit').hidden=false;$('projListCard').hidden=true}else{$('projEdit').hidden=true;$('projListCard').hidden=false}}window.scrollTo(0,0)}
$('tabConvert').onclick=()=>showView('convert');$('tabProjects').onclick=()=>showView('projects');$('tabThreads').onclick=()=>showView('threads');$('tabHelp').onclick=()=>showView('help');if($('tabSettings'))$('tabSettings').onclick=()=>showView('settings');addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(['convert','threads','projects','shop','help','settings'].includes(v))showView(v,true)});addEventListener('popstate',()=>{const v=location.hash.slice(1)||'convert';if(['convert','threads','projects','shop','help','settings'].includes(v))showView(v,true)});$('tabShop').onclick=()=>showView('shop');$('shopGoProj').onclick=()=>showView('projects');{const si=$('shopEmptyImport');if(si)si.onclick=()=>window.FFImportOpen&&window.FFImportOpen()}
{const g=(id,f)=>{const e=$(id);if(e)e.onclick=f};g('shopEmptyPaste',()=>{showView('convert');$('inp').focus()});
 g('shopSeveral',()=>{showView('projects');closeProject();const b=$('planOpen');if(b)b.click()});g('shopBack',()=>{showView('projects')});
 g('thNext',()=>{if(store.projects.length)showView('projects');else{showView('convert');const r=document.querySelector('#convertView .pat-launch');if(r)r.focus()}});
 const tn=()=>{const b=$('thNext');if(b)b.textContent=(store.projects.length?FS('nextThreadsHasProj'):FS('nextThreads'))+' →'};tn();$('tabThreads').addEventListener('click',tn)}
$('newEmpty').onclick=()=>{if($('newEmpty').disabled)return;$('newEmpty').disabled=true;setTimeout(()=>$('newEmpty').disabled=false,600);const p={id:newId(),name:FS('defaultName')||'My project',notes:'',buyBrand:'dmc',status:'planning',items:[],decisions:{},purchased:{},created:nowISO(),updated:nowISO()};store.projects.push(p);save();renderList();openProject(p.id)};
$('backupBtn').onclick=backup;undoImportRow();$('restoreFile').onchange=e=>{const f=e.target.files[0];if(f&&$('settingsView')&&!$('settingsView').hidden)showView('projects');restoreFile(f);e.target.value=''};
let saving=false;
$('saveProj').onclick=()=>{if(saving)return;if(!state.items.length){$('copymsg').textContent='Nothing to save yet. Add a few colors first, then this project can take shape.';return}saving=true;setTimeout(()=>saving=false,800);
 const ex=window.isExample&&window.isExample();
 const p={id:newId(),name:($('newProjName').value.trim()||(ex?'Example project':FS('defaultName')||'My project')).slice(0,100),notes:'',buyBrand:$('dest').value,status:'planning',items:state.items.map(i=>({code:i.code,qty:i.qty,stated:i.stated!==false,assumed:asmOf(i),src:i.src.slice(),stitchCount:i.stitchCount||null})),decisions:{},purchased:{},created:nowISO(),updated:nowISO(),...(ex?{demo:true}:{})/* FF-QA-01: the untouched Try-an-example list saves as a Demo project (kept out of backups, planner and real-stash comparisons) */};
 p.items.forEach(i=>p.decisions[i.code]=normDecision(i.code,{anchor:choice[i.code]||null}));store.projects.push(p);const ok=save();
 $('copymsg').innerHTML=(ok?`<span class="ffsaved">${esc(FX(FS('savedOk'),{name:p.name}))}</span> <span class="ffrename"><label for="savedName">${esc(FS('nameLabel'))}</label> <input type="text" id="savedName" maxlength="100" value="${esc(p.name)}" placeholder="${esc(FS('namePlaceholder'))}" aria-describedby="savedNameHint"><button type="button" class="ghost small" id="savedRename">${esc(FS('rename'))}</button></span><span class="hint" id="savedNameHint">${esc(FS('nameHint'))}</span>`:esc(FS('savedFail')||"Saved for now only: this browser isn't letting Floss Fox store projects, so download a backup from My Projects."))+` <button type="button" class="pri small" id="openSaved">${esc(FS('next').review)} →</button>`;
 {const rn=$('savedRename');if(rn)rn.onclick=()=>{const v=$('savedName').value.trim().slice(0,100);if(!v)return;p.name=v;touch(p);renderList();const b=$('copymsg').querySelector('.ffsaved');if(b)b.textContent=FX(FS('savedOk'),{name:v})}}
 $('newProjName').value='';renderList();
 $('openSaved').onclick=()=>{showView('projects');openProject(p.id)};if(ok&&window.FlossFoxPip){/* Pip A: the save bubble replaces the small saved wink; the wink still runs when the bubble doesn't show */if(store.projects.length===1&&FlossFoxPip.firstProject)pipFirstPending=true; /* new-15: first-project moment waits for the Projects view (never on Shopping) */if(!(FlossFoxPip.react&&FlossFoxPip.react('pipA.save.ok',{},$('copymsg'),{siteAnnounces:true})))FlossFoxPip.saved($('copymsg'))}};
load();renderList();
window.FlossFoxProjects={_caut:CAUT,openId:()=>openId,lastProject:()=>store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated))[0]||null,openProject:id=>openProject(id),estimateInput,plan,planText,csv,migrate,backup,fullBackup,downloadBackupText:download,restoreFile,checkBackup,rawSnapshot:snapshot,PREKEY,_store:()=>store,KEY,canSave:()=>canSave,
 replaceAll:data=>{store={schema:SCHEMA,projects:data.projects};canSave=true;storeMsg('');openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false;const ok=save();renderList();return ok},
 removeDemo:()=>{const n=store.projects.filter(x=>x.demo).length;store.projects=store.projects.filter(x=>!x.demo);if(openId&&!proj(openId)){openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false}save();renderList();return n},showView,open:id=>{showView('projects');openProject(id)},missingCount:id=>{const p=proj(id);return p?p.items.filter(i=>i.qty===null).length:0},
 fillMissing:id=>{const p=proj(id);if(!p)return 0;const c=p.items.filter(i=>i.qty===null);c.forEach(i=>{i.qty=1;i.stated=false;i.assumed=1});if(c.length){fillUndo={id,codes:c.map(i=>i.code)};touch(p);if(openId===id)renderEditor()}return c.length},
 undoFill:()=>{const u=fillUndo;fillUndo=null;const p=u&&proj(u.id);if(!p)return 0;let n=0;u.codes.forEach(code=>{const i=p.items.find(x=>x.code===code);if(i&&i.qty===1&&i.assumed===1){i.qty=null;i.stated=true;i.assumed=0;n++}});touch(p);if(openId===u.id)renderEditor();return n},
 add:p=>{const m=normProject(p);if(!m)return null;store.projects.push(m);save();renderList();return m.id}}; // for tests and debugging
})();
