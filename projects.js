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
 if(P.sum.checkFirst)return`<div class="empty shopdone" data-done="check">${PIC('reassuring','',631)}<b>Not complete yet</b>${cfNote(P.sum.checkFirst)} Check them in your stash, then choose Have enough or Need to buy.</div>`;
 if(stitchReady(p,P))return`<div class="empty shopdone" data-done="stitch">${PIC('cross-stitch','xstpip',728)}<b>${P.hasEstimates?'Thread plan covered':'Ready to start stitching!'}</b>${P.hasEstimates?'Every color is covered using your selected estimates. Actual thread use can vary.':'Every color is confirmed: you have enough of each one.'}</div>`;
 if(aw.length)return`<div class="empty shopdone" data-done="done">${PIC('presenting','',665)}<b>Shopping list done! Nice work.</b>${s2(aw.length)} ${aw.length===1?'is':'are'} bought but not checked in yet. Check each one in when it arrives${where==='shop'?' below':''}.</div>`;
 if(P.sum.total&&!P.ready||P.sum.total&&!stitchReady(p,P))return`<div class="empty shopdone" data-done="check">${PIC('reassuring','',631)}<b>Nothing left to buy</b>${P.sum.review?`${s2(P.sum.review)} still need${P.sum.review===1?'s':''} a quick check in your project before you're ready.`:'Some amounts are missing or assumed. Check them in your project to be sure you have enough.'}</div>`;
 return`<div class="empty shopdone" data-done="empty">${PIC('organizing','',566)}<b>Nothing to buy</b>Mark colors as Need to buy in your project to see them here.</div>`}
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
  items,decisions:dec,purchased,status:PSTAT.some(x=>x[0]===p.status)?p.status:'planning',...(p.skeinEstimator!==undefined?{skeinEstimator:SK.normalize(p.skeinEstimator)}:{}),...(p.demo===true?{demo:true}:{}),created:str(p.created,40)||nowISO(),updated:str(p.updated,40)||nowISO()}}
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
function edited(p){if(typeof undoBy!=='undefined')delete undoBy[p.id]}

// ---- Plan: derived only (never stored) ----
function plainWhy(it,r){const f=fam(it.code),c=lab(it.code);if(f!=='solid')return`This is a ${f} thread, so there's no automatic brand swap. Buy the original DMC ${c} (set the brand to DMC).`;
 if(/Sullivans/.test(r.why||''))return`There's no Sullivans match on the chart. Buy DMC ${c} instead (set the brand to DMC).`;if(/Anchor/.test(r.why||''))return`There's no Anchor match on the chart. Buy DMC ${c} instead (set the brand to DMC).`;return r.why||'Needs a look.'}
function estimateInput(it){
 if(it.stitchCountReviewed!==true&&it.stitchCount!=null&&it.src&&it.src.length>1&&it.src.some(src=>{const found=parse(src).items.find(x=>x.code===it.code);return!found||found.stitchCount==null}))return{...it,countIncomplete:true};
 return it;
}
const estimateProject=p=>({...p,items:p.items.map(estimateInput)});
const reqOf=(p,it)=>SK.requirement(estimateInput(it),p.skeinEstimator,DMC,fam(it.code),p.buyBrand);
const needOf=(p,it)=>{const r=reqOf(p,it);return r.amount===null?'amount not entered':r.source==='estimated'?`about ${SK.fmt(r.amount)} skeins (Pip estimate, including extra)`:plural(r.amount,'skein')+asmTxt(it.qty,asmOf(it))};
function plan(p){const dest=p.buyBrand,threads=[];
 // Per-thread state (derived, deterministic): have | received | buy | awaiting | review
 p.items.forEach(it=>{const d=p.decisions[it.code],r=resolve(it,dest,d.anchor),rq=reqOf(p,it),req=rq.amount,own=d.owned;const t={it,d,r,req:rq,estimated:rq.source==='estimated',state:'review',why:'',q:0,rem:0,recv:0,recvOther:false};threads.push(t);
  const needsPick=dest==='anchor'&&fam(it.code)==='solid'&&!d.anchor&&(r.review||DMC[it.code].anchor.length>1);
  const K=(k,w)=>{t.kind=k;t.why=w};
  if(needsPick){K('match',r.review?'Sources disagree on the Anchor match for white. Choose the one you want in Details.':'Anchor has more than one possible match. Choose the one you want in Details.');return}
  if(d.status==='have'){if(t.estimated||rq.source==='unavailable'&&it.qty!==null&&asmOf(it)>0){t.state='have';t.recheck=!t.estimated||d.estimateChecked!==SK.fingerprint(it,p.skeinEstimator,rq.estimate);return}
   if(req===null)K(rq.source==='unavailable'?'estimate':'amount',rq.reason||"Floss Fox can't tell whether you have enough until the amount needed is entered. Add it in Details.");else if(own!==null&&own<req)K('other',`You noted ${own} skein${own===1?'':'s'}, but the pattern needs ${req}. Choose Need to buy, or update what you have.`);else t.state='have';return}
  if(d.status==='check'){K('unsure',`Check your stash, then choose Have enough or Need to buy.${own!==null?` (You noted ${own}.)`:''}${req===null?" The amount needed isn't entered.":''}`);return}
  if(d.status!=='buy'){K('unchecked','Choose Have enough, Need to buy or Not sure.');return}
  if(!r.ok){K('other',plainWhy(it,r));return}
  if(req===null){K(rq.source==='unavailable'?'estimate':'amount',rq.reason||'How many skeins does your pattern need? Add it in Details so this color can be checked off.');return}
  if(t.estimated&&own!==null&&!['user','collection'].includes(d.ownedSource)){K('estimate','Check the recorded amount you own in Details before subtracting it from Pip’s estimate.');return}
  if(t.estimated){const v=SK.compareStock(req,own===null?0:own,d.ownedPartial);if(v.kind==='check-first'){K('estimate','You have a partial skein. Check its amount before buying more.');return}t.q=v.buy;
   if(t.q===0){t.state='have';return}
  }else t.q=own===null?req:Math.ceil(req-own-1e-9);
  if(t.q<=0){t.kind='other';t.why=`You noted ${own}, which covers the ${req} needed. Choose Have enough instead?`;return}
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
const cfNote=n=>`${s2(n)} still need${n===1?'s':''} checking before this list is complete.`;
// Pip celebrates once per real not-ready -> ready transition (pose only, no bubble: the headline right beside it already says it).
const CEL=()=>{setTimeout(()=>{const f=document.getElementById('pCel');if(f){f.classList.remove('pip-cheer')}},4000);
 return`<span class="pcel pipfig pip-cheer" id="pCel" aria-hidden="true"><picture><source type="image/webp" srcset="assets/pip/pip-celebrating-160.webp 160w, assets/pip/pip-celebrating-320.webp 320w" sizes="64px"><img src="assets/pip/pip-celebrating-160.png" width="160" height="243" alt=""></picture></span>`};
const CAP=()=>(window.FlossFoxParse&&FlossFoxParse.SKEIN_CAP)||20;
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
// The estimate covers Need to buy only: check-first colors may already be owned, so pricing them would overstate the cost.
function costLine(P){const p=PRICES[P.dest];let k=0,unpriced=0;P.lines.forEach(l=>{if(l.from.every(c=>fam(c)==='solid'))k+=l.q;else unpriced++});const cf=P.sum.checkFirst;
 const cfT=cf?` Not included: ${s2(cf)} in Check first (you may already own ${cf===1?'it':'them'}), so the total may change.`:'';
 if(!P.lines.length)return(cf?'Nothing confirmed to buy yet.':'Nothing left to buy.')+cfT;
 return`Rough cost of Need to buy only: ≈ ${rng(p.lo*k,p.hi*k)} USD for ${plural(P.lines.reduce((a,l)=>a+l.q,0),'skein')}${unpriced?` (plus ${plural(unpriced,'specialty thread')} with no price)`:''}.${cfT||' Colors that still need attention aren\'t included.'} Prices were checked ${PRICES.checked} and vary by store.`}
const lineTxt=(P,l)=>`${BRAND[P.dest]} ${disp(P.dest,l.to)} x${l.q} (for DMC ${l.from.map(lab).join(', ')}; ${[...l.prov].join('; ')}${l.partial?'; after subtracting what you have, rounded up to whole skeins':''}${l.recvd?`; ${l.recvd} already received`:''}${l.ts.some(t=>t.estimated)?'; uses Pip estimates including extra':''}${l.ts.some(t=>!t.estimated&&asmOf(t.it)>0)?'; includes an assumed amount':''})${l.from.length>1?' ⚠ note: several pattern colors share this thread':''}`;
const needTxt=(it,p)=>p?needOf(p,it):it.qty===null?'amount not entered':plural(it.qty,'skein')+asmTxt(it.qty,asmOf(it));
function planText(p){const P=plan(p),o=[`${APP_NAME} project: ${p.name}`,`Brand to buy: ${BRAND[P.dest]}`,readyText(P,p),summaryText(P),...(P.sum.checkFirst?['NOTE: '+cfNote(P.sum.checkFirst)]:[]),''];
 const tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),co=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy');
 o.push('NEED TO BUY:');if(!tb.length&&!co.length)o.push('- none');tb.forEach(l=>o.push('[ ] '+lineTxt(P,l)));co.forEach(t=>o.push(`[ ] DMC ${lab(t.it.code)}: amount not entered (add it to check this color off)`));
 o.push('','CHECK FIRST (not on the buy list yet; you may already have these):');if(!P.checkFirst.length)o.push('- none');P.checkFirst.forEach(t=>o.push(`[?] DMC ${lab(t.it.code)} (needs ${needTxt(t.it,p)}): ${cfWhy(t)}`));
 o.push('','BOUGHT — CHECK IN WHEN IT ARRIVES (not counted as ready yet):');if(!aw.length)o.push('- none');aw.forEach(l=>o.push('[x] '+lineTxt(P,l)));
 const ra=P.review.filter(x=>!x.cf);o.push('','NEEDS ATTENTION (not on the buy list yet):');if(!ra.length)o.push('- none');ra.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (needs ${needTxt(x.it,p)}): ${(KIND[x.kind]||KIND.other)[1]}. ${x.why}`));
 const hv=P.have.filter(x=>!x.cf);o.push('','READY (you have enough or received it):');if(!hv.length)o.push('- none');hv.forEach(x=>o.push(`- DMC ${lab(x.it.code)} (needs ${needTxt(x.it,p)}${x.d.owned!==null?`, you have ${x.d.owned}`:''}${x.state==='received'?`, received ${x.recv} ${BRAND[P.dest]} ${disp(P.dest,x.r.to)}`:', already had it'})`));
 if(p.notes)o.push('','Notes: '+p.notes);const estimates=SK.text(estimateProject(p),DMC,fam);if(estimates)o.push('',estimates);o.push('',costLine(P),'Color swatches and brand matches are approximate. Compare real thread before swapping.');return o.join('\n')}
function summaryText(P){const s=P.sum;return`${s.sufficient-P.have.filter(x=>x.cf).length} of ${s.total} colors ready · ${s.toBuy} to buy · ${s.awaiting} bought, waiting to check in · ${s.review} need attention${s.checkFirst?` · ${s.checkFirst} to check first`:''}`}
function readyText(P,p){if(!p.items.length)return'No colors in this project yet.';if(!P.ready&&!P.sum.toBuy&&!P.sum.awaiting&&P.sum.checkFirst)return`Not ready yet: ${cfNote(P.sum.checkFirst)}`;return P.ready?(P.hasEstimates?'Thread plan covered using Pip’s estimates. Actual use can vary.':"Ready to stitch: all your threads are accounted for."):`Not ready yet: ${s2(P.sum.toBuy)} to buy, ${P.sum.awaiting} bought (waiting to check in), ${P.sum.review} need attention.`}
const s2=n=>plural(n,'color');
function receive(p,key,n){const P=plan(p),l=P.lines.find(x=>x.key===key);if(!l)return'';let left=n;
 l.ts.forEach(t=>{const take=Math.min(left,t.rem);if(take>0){const prev=(t.d.recv&&t.d.recv.brand===P.dest&&t.d.recv.to===t.r.to)?t.d.recv.qty:0;t.d.recv={brand:P.dest,to:t.r.to,qty:prev+take};left-=take}});
 delete p.purchased[key];touch(p);const nm=`${BRAND[P.dest]} ${disp(P.dest,l.to)}`;return n>=l.q?`✓ ${nm} checked in: ${plural(n,'skein')} received. You have enough now.`:`${plural(n,'skein')} of ${nm} received. ${l.q-n} more still needed, so it's back on your shopping list.`}

// ---- Rendering ----
const foxSvg=cls=>{const l=document.querySelector('header .logo');return l?l.outerHTML.replace('class="logo"',`class="${cls}" aria-hidden="true"`).replace(/role="img" aria-label="[^"]*"/,''):''};
function renderList(){const L=$('projList');$('projCount').textContent=store.projects.length?`(${store.projects.length})`:'';
 L.innerHTML=store.projects.length?store.projects.slice().sort((a,b)=>b.updated.localeCompare(a.updated)).map(p=>{const P=plan(p);
  return`<li><span><span class="pname">${esc(p.name)}</span>${p.demo?' <span class="tag demotag">Demo</span>':''}<br><small class="mut">${s2(p.items.length)}${(n=>n?` · <span class="stc">${n.toLocaleString('en-US')} stitches</span>`:'')(p.items.reduce((a,i)=>a+(i.stitchCount||0),0))} · <span class="pst">${esc((PSTAT.find(x=>x[0]===p.status)||PSTAT[0])[1])}</span> · ${P.ready?'<b class="ok-msg">✓ Ready to stitch</b>':`${P.sum.sufficient} of ${P.sum.total} ready${P.sum.toBuy?` · ${P.sum.toBuy} to buy`:''}${P.sum.review?` · ${P.sum.review} need attention`:''}`} · updated ${esc(p.updated.slice(0,10))}</small></span><span class="row" style="margin:0"><button type="button" class="pri" data-open="${esc(p.id)}">Open<span class="sr"> ${esc(p.name)}</span></button><button type="button" class="ghost" data-del="${esc(p.id)}">Delete<span class="sr"> ${esc(p.name)}</span></button></span></li>`}).join('')+'<li class="storeline" style="display:block;border:0">Saved in this browser only. Open <b>Back up my projects</b> below to keep a copy.</li>'
  :`<li class="empty">${ORG()}<b>No projects yet</b>Paste your colors on the <i>Find My Floss</i> tab, then save them as a project to check what you have.<div class="row" style="justify-content:center"><button type="button" class="pri" id="emptyAdd">Add my colors</button></div></li>`;
 L.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.open));
 L.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delProject(b.dataset.del));const ea=$('emptyAdd');if(ea)ea.onclick=()=>{showView('convert');$('inp').focus()}}
async function delProject(id){const p=proj(id);if(!p)return;
 const ok=await FlossFoxConfirm.ask({pose:'thinking',title:`Wave goodbye to "${p.name}"?`,
  body:"Pip tilts their head. Are you sure? This can't be undone unless you have a backup.",go:'Delete'});
 if(!ok)return;
 store.projects=store.projects.filter(x=>x.id!==id);save();if(openId===id){openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false}ensureShop();renderList();pstatus(`Deleted "${p.name}".`)}
function openProject(id,m){{const pc=$('planCard');if(pc&&!pc.hidden){pc.hidden=true;pc.innerHTML=''}}if(openId!==id){expanded.clear();filt='all';query='';shopPanel=null}openId=id;mode=m||'edit';renderEditor();$('projEdit').hidden=false;$('projListCard').hidden=true;window.scrollTo(0,0);pstatus(`Opened "${proj(id).name}".`)}
function closeProject(){setTimeout(ensureShop);if(window.FlossFoxThreadsUI)FlossFoxThreadsUI.tipDone('compare');openId=null;mode='edit';$('projEdit').hidden=true;$('projListCard').hidden=false;renderList()}
function destCell(p,it){const d=p.decisions[it.code],dest=p.buyBrand,c=it.code,f=fam(c),L=esc(lab(c));
 if(dest==='anchor'&&f==='solid'&&DMC[c].anchor.length>1||dest==='anchor'&&(c==='WHITE'||c==='B5200')&&DMC[c].anchor.length){const disputed=c==='WHITE'||c==='B5200';
  return`<label class="flbl" for="anc-${esc(c)}">Choose the Anchor match</label><select id="anc-${esc(c)}" data-anc="${esc(c)}"><option value=""${d.anchor?'':' selected'}>Choose a match…</option>${DMC[c].anchor.map(a=>`<option value="${esc(a)}"${d.anchor===a?' selected':''}>Anchor ${esc(a)}</option>`).join('')}</select><p class="hint">${disputed?esc(WHITE_DISPUTE):'The chart lists more than one Anchor match for this color. Pick the one you want to use.'}</p>`}
 const r=resolve(it,dest,d.anchor);return`<span class="flbl">Brand match</span>`+(r.ok?`<b>${BRAND[dest]} ${esc(disp(dest,r.to))}</b> <small class="mut">(${esc(r.prov)})</small>`:`<span>${esc(plainWhy(it,r))}</span>`)}
const expanded=new Set();let justOpened=null,filt='all',query='',mode='edit',shopPanel=null;
const sid=k=>k.replace(/[^\w-]/g,'_');
const KIND={amount:['✎','Add the amount'],estimate:['?','Check the estimate or stock'],match:['?','Confirm the color match'],unsure:['?','Not sure yet'],unchecked:['○','Not checked yet'],other:['!','Needs a look']};
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
 <div class="need">${needOf(p,it)==='amount not entered'?'<span class="unk">Amount needed: not entered</span>':`${esc((n=>{const m=/^(\d[\d,]* skeins?)(.*)$/.exec(n);return m?m[1]+' needed'+m[2]:n+' needed'})(needOf(p,it)))}`}${it.stitchCount!==null&&it.stitchCount!==undefined?` <span class="stc">· ${it.stitchCount.toLocaleString('en-US')} stitches</span>`:''}${t.recheck?'<span class="skein-note">Your Have enough choice was kept. Re-check the quantity after changing counts or settings.</span>':''}</div>
 <div class="stat ${t.state}${t.kind?' k-'+t.kind:''}"><span aria-hidden="true">${si[0]}</span> ${si[1]}</div></div>
 <button type="button" class="sec exp" id="x-${c}" data-exp="${c}" aria-expanded="${open}" aria-controls="det-${c}">${open?'Hide details':'Details'}<span class="sr"> for DMC ${L}</span></button></div>
 <div class="seg" role="radiogroup" aria-label="Do you have DMC ${L}?">${['have','buy','check'].map(s=>`<label><input type="radio" name="st-${c}" id="st-${c}-${s}" value="${s}" data-st="${c}" ${d.status===s?'checked':''}><span>${STLBL[s]}</span></label>`).join('')}</div></div>
 ${t.state==='review'?`<div class="why">${esc(t.why)}</div>`:''}${t.recvOther?'<div class="why">A thread you checked in for a different brand isn\'t counted here.</div>':''}
 <div class="tdet${justOpened===it.code?' anim':''}" id="det-${c}" ${open?'':'hidden'}>
  <div class="fldrow"><div class="fld"><label for="q-${c}">Amount needed (skeins)</label><input type="number" class="qbox" id="q-${c}" data-q="${c}" min="1" step="1" inputmode="numeric" value="${it.qty===null?'':it.qty}" ${it.qty===null?'disabled':''}><label class="inl"><input type="checkbox" id="u-${c}" data-unk="${c}" ${it.qty===null?'checked':''}> Not entered</label></div>
  <div class="fld"><label for="o-${c}">You already have (skeins, optional)</label><input type="number" class="qbox" id="o-${c}" data-own="${c}" min="0" step="0.25" inputmode="decimal" value="${d.owned===null?'':d.owned}" placeholder="?" aria-describedby="oh-${c}"><div class="hint" id="oh-${c}">Use 0.5 for a partly used skein. Leave empty if you're not sure.${d.ownedPartial?' Your collection also has an unmeasured partial; enter a checked total to include it.':''}</div>${t.estimated&&d.owned!==null&&!['user','collection'].includes(d.ownedSource)?`<button type="button" class="sec small" data-own-confirm="${c}">Confirm this amount${d.ownedPartial?' without the partial':''}</button>`:''}</div></div>
  <div class="fldrow"><div class="fld"><label for="sc-${c}">Full-cross count for this color</label><input type="number" class="qbox skein-count" id="sc-${c}" data-stitches="${c}" min="0" max="10000000" step="1" inputmode="numeric" value="${it.stitchCount==null?'':it.stitchCount}" placeholder="Not given">${estimateInput(it).countIncomplete?`<button type="button" class="sec small" data-count-confirm="${c}">Confirm this is the complete count</button>`:''}</div>
  <div class="fld"><label for="ss-${c}">Pattern’s strands (optional)</label><select id="ss-${c}" data-strands="${c}"><option value="">Use project default</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}"${it.strandCount===n?' selected':''}>${n} strands</option>`).join('')}</select></div>
  <div class="fld"><label for="sy-${c}">Stitch type</label><select id="sy-${c}" data-stitch-type="${c}">${[['','Use project confirmation'],['full','Full crosses'],['half','Half stitches'],['back','Backstitch'],['blend','Blended colors'],['fractional','Fractional / other']].map(([k,l])=>`<option value="${k}"${(it.stitchType||'')===k?' selected':''}>${l}</option>`).join('')}</select></div></div>
  <div class="fld">${destCell(p,it)}</div>
  ${it.src.length?`<div class="fld"><span class="flbl">From your list</span>"${it.src.map(esc).join('", "')}"</div>`:''}
  ${d.recv?`<div class="fld"><span class="flbl">Checked in</span>${d.recv.qty} × ${esc(BRAND[d.recv.brand])} ${esc(disp(d.recv.brand,d.recv.to))} <button type="button" class="sec small" id="rr-${c}" data-rr="${c}">Undo received</button></div>`:''}
  <div class="fld"><button type="button" class="ghost small" id="rm-${c}" data-rm="${c}">Remove this color<span class="sr"> (DMC ${L})</span></button></div></div></li>`}
function nextSteps(P){const k={};P.threads.forEach(t=>{if(t.state==='review')k[t.kind]=(k[t.kind]||0)+1});const s=P.sum,o=[];
 if(k.amount)o.push(['att',`${s2(k.amount)} need${k.amount===1?'s':''} an amount before your list is complete.`,k.amount===1?'Review it':'Review them','att']);
 if(k.estimate)o.push(['att',`${s2(k.estimate)} need${k.estimate===1?'s':''} a count, settings or stock check for Pip’s estimate.`,'Review','att']);
 if(k.match)o.push(['att',`You chose another brand for ${s2(k.match)}. Please confirm the match${k.match===1?'':'es'}.`,'Review','att']);
 if(k.unchecked)o.push(['att',`${s2(k.unchecked)} ${k.unchecked===1?"isn't":"aren't"} checked yet. Tap Have enough, Need to buy or Not sure.`,k.unchecked===1?'Show it':'Show them','att']);
 if(k.unsure)o.push(['att',`${s2(k.unsure)} marked Not sure. Check your stash when you can.`,k.unsure===1?'Show it':'Show them','att']);
 if(k.other)o.push(['att',`${s2(k.other)} need${k.other===1?'s':''} a second look.`,k.other===1?'Show it':'Show them','att']);
 if(s.awaiting)o.push(['wait',`${plural(s.awaiting,'thread')} ${s.awaiting===1?'was':'were'} bought but ${s.awaiting===1?"hasn't":"haven't"} been checked in yet.`,'Check them in','shop']);
 if(s.toBuy)o.push(['buy',`${s2(s.toBuy)} to buy.`,'Shop my list','shop']);return o}
// 1.7: compare with My Thread Collection. Each project is compared with the whole collection on its own (nothing is reserved).
// Buckets: owned (verified: amount needed is stated and covered) | unverified (owned, but amount needed unknown or assumed) | short | missing.
// "Use my collection" shows a preview first and can be undone; it changes only this project's Have/Need choices, never the collection.
const STW={have:'Have enough',buy:'Need to buy',check:'Not sure'},stWord=d=>d.status?STW[d.status]:'Not checked',ownWord=d=>d.owned===null?'—':plural(d.owned,'skein');
let cmpPreview=null;const undoBy={};
// compact preview line, e.g. "Will mark 13 Have enough, 4 Not sure, 2 Need to buy"
const prevSum=ch=>{const n={have:0,check:0,buy:0};ch.forEach(c=>{n[c.to.status]++});const o=n2=>Object.entries(n2).filter(([,v])=>v).map(([k,v])=>`${v} ${STW[k]}`);
 const extra=ch.filter(c=>c.from.status===c.to.status).length;return`Will mark ${o(n).join(', ')}${extra?` (${extra} only update “you already have”)`:''}.`};
function cmpPlan(p,T){const r=T.compare(p.items,{demo:!!p.demo}),ch=[];
 const entries=p.demo?(T.data().demo||{}):T.data().threads,er=SK.compareProject(p.items.map(estimateInput),p.skeinEstimator,DMC,fam,entries,p.buyBrand),changed=new Set(Object.values(er).flat().map(x=>x.code));
 for(const k in r)r[k]=r[k].filter(x=>!changed.has(x.code)).concat(er[k]);
 const want=(x,status,owned,why)=>{const d=p.decisions[x.code],ownedSource=(x.ownedConfirmed===true||entries[x.code]&&entries[x.code].confirmed===true)?'collection':'unverified',ownedPartial=!!x.partial;
  if(d.status!==status||d.owned!==owned||d.ownedSource!==ownedSource||d.ownedPartial!==ownedPartial)ch.push({code:x.code,from:{status:d.status,owned:d.owned,ownedSource:d.ownedSource,ownedPartial:d.ownedPartial,estimateChecked:d.estimateChecked},to:{status,owned,ownedSource,ownedPartial,estimateChecked:x.estimated&&status==='have'?SK.fingerprint(p.items.find(i=>i.code===x.code),p.skeinEstimator,reqOf(p,p.items.find(i=>i.code===x.code)).estimate):null},why})};
 r.owned.forEach(x=>want(x,'have',x.have,'owned'));r.unverified.forEach(x=>want(x,'check',x.have,'owned, quantity not verified'));
 r.short.forEach(x=>want(x,'buy',x.have,'short'));r.missing.forEach(x=>want(x,'buy',x.estimated?0:null,'missing'));return{r,ch}}
function renderCmp(p){const el=$('pCmp'),T=window.FlossFoxThreadsUI;if(!el||!T)return;const n=T.count({demo:!!p.demo});
 if(!p.items.length){el.innerHTML='';return}
 const U=undoBy[p.id],undoBtn=U?`<div class="row"><button type="button" class="sec" id="pUndoColl">Undo “Use my collection”</button><span class="hint">Puts back the ${s2(U.length)} it changed.</span></div>`:'';
 if(!n){el.innerHTML=`<div class="pcmp"><b>Compare with my thread collection</b><p class="hint">${p.demo?'There are no demo threads in the collection.':`Your collection is empty. Add the threads you own in <button type="button" class="ghost small" id="pGoThreads">My Thread Collection</button>, then come back here.`}</p>${undoBtn}</div>`;const g=$('pGoThreads');if(g)g.onclick=()=>showView('threads');bindUndo(p);return}
 const {r,ch}=cmpPlan(p,T),need=x=>x.need===null||x.need===undefined?'amount needed not entered':x.estimated?`estimated need about ${SK.fmt(x.need)} skeins with extra`:x.assumed>=x.need?`amount needed not given (assumed ${plural(x.need,'skein')})`:`need ${plural(x.need,'skein')}`;
 const L=a=>a.map(x=>`DMC ${esc(lab(x.code))} (${need(x)}, have ${plural(x.have,'skein')}${x.partial?' + a partial':''})`).join(', ');
 el.innerHTML=`<div class="pcmp" id="pCmpBox"><b>Compared with my ${p.demo?'demo threads':'thread collection'}</b><div class="cnt"><span id="cmpOwned">✓ <b>${r.owned.length}</b> owned</span><span id="cmpUnver">? <b>${r.unverified.length}</b> owned, quantity not verified</span><span id="cmpShort">◐ <b>${r.short.length}</b> short</span><span id="cmpMissing">✗ <b>${r.missing.length}</b> missing</span></div>
 ${r.unverified.length?`<p class="small"><b>Color owned, quantity not verified:</b> ${L(r.unverified)}. Add the amount your pattern needs to check it.</p>`:''}
 ${r.short.length?`<p class="small"><b>Short:</b> ${L(r.short)}</p>`:''}${r.missing.length?`<p class="small"><b>Missing:</b> ${r.missing.map(x=>'DMC '+esc(lab(x.code))).join(', ')}</p>`:''}
 <p class="hint">Each project is checked against your whole collection; floss isn't reserved between projects.</p>
 <div id="pCmpTip" class="piptip" hidden></div>
 ${cmpPreview===p.id?`<div class="notes cmpprev" id="pCmpPrev">${ch.length?`<p id="pPrevSum"><b>${esc(prevSum(ch))}</b></p><p class="hint">Your thread collection is not changed. You can undo this afterwards.</p><div class="row"><button type="button" class="pri" id="pApplyColl">Apply these changes</button><button type="button" class="ghost" id="pCancelColl">Cancel</button></div><details id="pPrevAll"><summary>Show all ${ch.length} changes</summary><ul>${ch.map(c=>`<li>DMC ${esc(lab(c.code))} (${esc(c.why)}): ${stWord(c.from)} → <b>${stWord(c.to)}</b>${c.from.owned!==c.to.owned?`; you already have: ${ownWord(c.from)} → ${ownWord(c.to)}`:''}</li>`).join('')}</ul></details>`:`<p><b>Nothing to change: this project already matches your collection.</b></p><div class="row"><button type="button" class="ghost" id="pCancelColl">Close</button></div>`}</div>`
  :`<div class="row"><button type="button" class="sec" id="pUseColl">Use my collection for this project…</button></div><p class="hint">Shows what would change first. Owned colors become <b>Have enough</b> only when the amount needed is known; otherwise <b>Not sure</b>. Short and missing colors become <b>Need to buy</b>.</p>`}${undoBtn}</div>`;
 if(T.tip)T.tip('compare',$('pCmpTip'));
 const u=$('pUseColl');if(u)u.onclick=()=>{cmpPreview=p.id;renderCmp(p);const pv=$('pCmpPrev');if(pv){pv.scrollIntoView({block:'nearest'});const b=$('pApplyColl')||$('pCancelColl');b.focus()}};
 const c=$('pCancelColl');if(c)c.onclick=()=>{cmpPreview=null;renderCmp(p);$('pUseColl').focus()};
 const a=$('pApplyColl');if(a)a.onclick=()=>{if(a.disabled)return;a.disabled=true;const now=cmpPlan(p,T).ch;
  now.forEach(x=>Object.assign(p.decisions[x.code],x.to));undoBy[p.id]=now;cmpPreview=null;
  touch(p);renderEditor();renderList();if(T.tipDone)T.tipDone('compare');const o=$('pUndoColl');if(o)o.focus();pstatus(`Used your collection: changed ${s2(now.length)}. You can undo this.`)};
 bindUndo(p)}
function bindUndo(p){const b=$('pUndoColl');if(!b)return;b.onclick=()=>{const U=undoBy[p.id];if(!U)return;
 U.forEach(x=>{const d=p.decisions[x.code];if(d)Object.assign(d,x.from)});delete undoBy[p.id];touch(p);renderEditor();renderList();const u=$('pUseColl');if(u)u.focus();pstatus(`Undone: ${s2(U.length)} put back as they were.`)}}
function renderEditor(){if(mode==='shop')return renderShop();{const sb=$('shopBody');if(sb)sb.textContent=''}const p=proj(openId),E=$('projEdit');if(!p){E.hidden=true;return}
 const focusId=document.activeElement&&document.activeElement.id,y=window.scrollY,P=plan(p);
 const unchecked=p.items.filter(it=>!p.decisions[it.code].status).length;
 E.innerHTML=`<div class="noprint"><div class="ptitle"><button type="button" class="ghost" id="pClose">← All projects</button><button type="button" class="pri" id="pShop"><span aria-hidden="true">🛒</span> Shop my list</button></div>
 <div class="fldrow" style="margin-top:var(--s3)"><div class="fld" style="flex:2 1 220px"><label for="pName">Project name</label><input type="text" id="pName" maxlength="100" value="${esc(p.name)}" style="width:100%"></div>
 <div class="fld" style="flex:1 1 160px"><label for="pStatus">Status</label><select id="pStatus" style="width:100%">${PSTAT.map(([k,l])=>`<option value="${k}"${(p.status||'planning')===k?' selected':''}>${l}</option>`).join('')}</select></div>
 <div class="fld" style="flex:1 1 180px"><label for="pDest">Brand to buy</label><select id="pDest" style="width:100%">${['dmc','sullivans','anchor'].map(k=>`<option value="${k}"${p.buyBrand===k?' selected':''}>${k==='dmc'?'DMC (same as pattern)':BRAND[k]}</option>`).join('')}</select></div></div>
 <details class="pmore"${p.notes?' open':''}><summary>Notes and project options</summary>
 <div class="fld"><label for="pNotes">Notes <small class="mut">(optional)</small></label><textarea id="pNotes" class="pnotes" maxlength="2000" rows="2" style="width:100%;min-height:72px;font-family:var(--font)" placeholder="e.g. threads are in the blue bag">${esc(p.notes)}</textarea></div>
 <div class="row"><button type="button" class="ghost" id="pDelete">Delete this project</button></div></details></div>
 ${window.FlossFoxSkeinsUI.html(estimateProject(p),DMC,fam,lsGet(KEY.replace(/\.v1$/,'')+'.fabric.v1'),pipOn())}<div id="pCmp" class="noprint"></div><div id="pSum"></div>
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
 bindEditor(p);window.FlossFoxSkeinsUI.bind(E,p,x=>{edited(x);touch(x)},message=>{renderEditor();renderList();pstatus(message);const se=$('pSkein');if(se)se.open=true;const b=$('seSave');if(b)b.focus({preventScroll:true})});renderCmp(p);renderPlan(p,P);mountShop(p);applyFilter(P);window.scrollTo(0,y);if(focusId){const f=document.getElementById(focusId);if(f)f.focus({preventScroll:true})}}
function applyFilter(P){const cards=[...document.querySelectorAll('#pCards .tcard')],q=query.trim().toLowerCase();let n=0;const map={};P.threads.forEach(t=>map[t.it.code]=t);
 cards.forEach(c=>{const t=map[c.dataset.code],show=inFilter(t,filt)&&(!q||c.dataset.search.includes(q));c.hidden=!show;if(show)n++});
 const nr=$('pNoRes');if(nr){nr.hidden=!!n||!cards.length;nr.innerHTML=n?'':`${q?`No colors match “${esc(query)}”${filt!=='all'?' in this view':''}.`:'Nothing here right now.'} <button type="button" class="sec small" id="pNoResClear">Show all colors</button>`;const b=$('pNoResClear');if(b)b.onclick=()=>{query='';filt='all';renderEditor()}}
 if(!cards.length&&nr){nr.hidden=false;nr.innerHTML='No colors in this project yet. Use <b>Add more colors</b> below.';const ab=$('pAddBox');if(ab)ab.open=true}
 const m=$('pFiltMsg');if(m)m.textContent=`Showing ${s2(n)}.`;const cb=$('pSearchClear');if(cb)cb.hidden=!query}
function renderPlan(p,P){P=P||plan(p);const cel=!!(window.FlossFoxPip&&FlossFoxPip.projectReady(p.id,P.ready));const s=P.sum,tb=P.lines.filter(l=>!l.bought),aw=P.lines.filter(l=>l.bought),pct=s.total?Math.round(100*s.sufficient/s.total):0;
 const skeins=P.lines.reduce((a,l)=>a+l.q,0),colorOnly=P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').length;
 const li=l=>`<b>${BRAND[P.dest]} ${esc(disp(P.dest,l.to))}</b> × ${l.q} <small class="mut">(for DMC ${l.from.map(c=>esc(lab(c))).join(', ')} · ${[...l.prov].map(esc).join('; ')}${l.partial?' · after subtracting what you have':''}${l.recvd?` · ${l.recvd} already received`:''}${l.ts.some(t=>t.estimated)?' · includes Pip estimates':''}${l.ts.some(t=>!t.estimated&&asmOf(t.it)>0)?' · includes an assumed amount':''})</small>`;
 const mw=l=>l.from.length>1?'<div class="hint">Note: several pattern colors use this one thread. Check that\'s what you want.</div>':'';
 const steps=nextSteps(P);
 $('pSum').innerHTML=`<h2 class="printonly">${esc(APP_NAME)}: ${esc(p.name)}</h2><p class="printonly">Brand to buy: ${esc(BRAND[P.dest])}</p>${SK.text(estimateProject(p),DMC,fam)?`<pre class="printonly skein-print">${esc(SK.text(estimateProject(p),DMC,fam))}</pre>`:''}
 <section class="psum" id="pSummary" data-ready="${P.ready}" aria-labelledby="pSumH"><h2 class="sr" id="pSumH">Project summary</h2>
 <p class="headline" role="status" aria-live="polite">${P.ready?`${cel?CEL():foxSvg('fox')}<span>${P.hasEstimates?'Your thread plan is covered using Pip’s estimates.':"All your threads are accounted for. You're ready to stitch!"}<span class="sr" id="sSuf">${s.sufficient} of ${s.total}</span></span>`:`<span><span id="sSuf">${s.sufficient} of ${s.total}</span> colors ready</span>`}</p>
 ${s.total?`<div class="bar" role="progressbar" aria-label="Colors ready" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.sufficient}" aria-valuetext="${s.sufficient} of ${s.total} colors ready"><span style="width:${pct}%"></span></div>`:''}
 ${P.ready?`<p class="skeins">${s.total} of ${s2(s.total)} have enough or have been checked in. Happy stitching! 🧵</p>`:''}<ul class="stats"${P.ready?' hidden':''}><li><b id="sBuy">${s.toBuy}</b>to buy</li><li><b id="sAw">${s.awaiting}</b>bought, waiting to check in</li><li><b id="sRev">${s.review}</b>need attention</li>${s.checkFirst?`<li><b id="sCf">${s.checkFirst}</b>to check first</li>`:''}</ul>
 ${(n=>n?`<p class="skeins">${s2(n)} use${n===1?'s':''} an assumed amount (1 skein for each line with no amount). Check against your pattern in Details.</p>`:'')(P.threads.filter(t=>['assumed','partly-assumed'].includes(t.req.source)&&t.req.amount!==null).length)}${skeins||colorOnly?`<p class="skeins">Skeins still to get: <b>${skeins}</b>${colorOnly?` · plus ${s2(colorOnly)} with no amount entered, so the total isn't complete`:''}</p>`:''}
 ${steps.length?`<ul class="next noprint">${steps.map(([c,t,b,a],i)=>`<li class="${c}"><span>${esc(t)}</span><button type="button" class="sec small" id="ns-${i}" data-ns="${a}">${b}</button></li>`).join('')}</ul>`:''}
 <nav class="jump noprint" aria-label="Jump to"${P.ready?' hidden':''}><a href="#pThreads">Your colors</a><a href="#pReviewH">Needs attention (${s.review})</a><a href="#pShopH">Shopping list (${P.lines.length})</a></nav></section>`;
 $('pPlan').innerHTML=`<h3 id="pShopH" tabindex="-1">Shopping list</h3><h4>Need to buy</h4><ul>${tb.map(l=>`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}"> ${li(l)}</label>${mw(l)}</li>`).join('')}${P.threads.filter(t=>t.kind==='amount'&&t.d.status==='buy').map(t=>`<li>DMC ${esc(lab(t.it.code))} · <span class="unk">amount not entered</span>. Add it to check this color off.</li>`).join('')||''}</ul>${tb.length||colorOnly?'':(P.checkFirst.length?'<p class="mut">Nothing confirmed to buy yet.</p>':'')}
 ${P.checkFirst.length?`<h4 id="pCheckH">Check first (${P.checkFirst.length})</h4><p class="cfnote" id="pCfNote"><b>${cfNote(P.checkFirst.length)}</b> These colors aren't on the buy list or in the estimate. Check your stash, then choose Have enough or Need to buy.</p><ul id="pCheck">${P.checkFirst.map(t=>`<li>DMC ${esc(lab(t.it.code))} · needs ${t.it.qty===null?'<span class="unk">amount not entered</span>':esc(needTxt(t.it,p))}: ${esc(cfWhy(t))}</li>`).join('')}</ul>`:''}${shopDone(p,P,tb,aw,'plan')}
 <h4>Bought: check in when it arrives</h4><p class="hint">Ticking a thread as bought doesn't count it as ready. Check it in once you have it in hand.</p><ul>${aw.map(l=>{const k=sid(l.key);return`<li><label><input type="checkbox" id="pb-${esc(l.key)}" data-bought="${esc(l.key)}" checked> ${li(l)}</label>${mw(l)}
  <div class="noprint"><button type="button" class="sec small" id="rb-${k}" data-rb="${esc(l.key)}">I received this thread…</button>
  <div class="rform" id="rf-${k}" hidden><label for="rq-${k}">How many skeins of ${BRAND[P.dest]} ${esc(disp(P.dest,l.to))} arrived? (${l.q} still needed)</label><br><input type="number" id="rq-${k}" min="1" step="1" inputmode="numeric" class="qbox"> <button type="button" class="pri small" id="rc-${k}" data-rc="${esc(l.key)}">Save</button> <button type="button" class="ghost small" data-rx="${k}">Cancel</button></div></div></li>`}).join('')||'<li class="mut">Nothing waiting.</li>'}</ul>
 <h3 id="pReviewH" tabindex="-1">Needs attention</h3><ul>${P.review.map(x=>`<li>DMC ${esc(lab(x.it.code))} · needs ${esc(needOf(p,x.it))}: <b>${(KIND[x.kind]||KIND.other)[1]}.</b> ${esc(x.why)}</li>`).join('')||'<li class="mut">Nothing needs attention.</li>'}</ul>
 <h3>Ready</h3><ul>${P.have.map(x=>`<li>DMC ${esc(lab(x.it.code))} · needs ${esc(needOf(p,x.it))}${x.d.owned!==null?` · you have ${x.d.owned}`:''} · ${x.state==='received'?`received ${x.recv} ${BRAND[P.dest]} ${esc(disp(P.dest,x.r.to))}`:'already had it'}</li>`).join('')||'<li class="mut">None yet.</li>'}</ul>
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
 el.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{const k=sid(b.dataset.rc),v=$('rq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('pMsg').textContent='Enter how many whole skeins arrived (1 or more). Nothing changed.';$('rq-'+k).focus();return}re(receive(p,b.dataset.rc,+v))});
 bindOut(p,'p')}
function bindOut(p,pre){$(pre+'Print').onclick=()=>print();$(pre+'Copy').onclick=async()=>{const t=planText(p),m=$(pre+'Msg'),f=$(pre+'Fallback');try{if(!navigator.clipboard)throw 0;await navigator.clipboard.writeText(t);m.textContent='✓ Copied. Paste it into a note or message.';f.hidden=true;if(window.FlossFoxPip)FlossFoxPip.saved(m)}catch(e){m.textContent="Couldn't copy automatically. Select the text below and copy it.";f.value=t;f.hidden=false;f.focus();f.select()}};
 $(pre+'Csv').onclick=()=>{download(csv(p),safe(p.name)+'.csv','text/csv');$(pre+'Msg').textContent='Spreadsheet file downloaded.'}}
// Shopping list tab: the project's #pPlan (shopping list and everything after it) lives in #shopView, not in the Projects view.
function mountShop(p){const sb=$('shopBody'),pl=$('pPlan');if(!sb)return;if(pl&&p){sb.appendChild(pl);$('shopProj').textContent='For project: '+p.name}
 document.querySelectorAll('#projEdit nav.jump a[href^="#"]').forEach(x=>{const id=x.getAttribute('href').slice(1);if(sb.querySelector('#'+id))x.onclick=e=>{e.preventDefault();showView('shop');const t=$(id);if(t){t.scrollIntoView();t.focus({preventScroll:true})}}});shopState()}
function shopState(){const sb=$('shopBody'),p=openId&&proj(openId),has=!!(p&&sb&&sb.querySelector('#pPlan'));$('shopEmpty').hidden=has;sb.hidden=!has;$('shopProj').hidden=!has;
 const n=has?sb.querySelectorAll('#pPlan > ul:first-of-type [data-bought]:not(:checked)').length:0;$('shopCount').textContent=n?`(${n})`:''}
function ensureShop(){const p=openId&&proj(openId);if(!p){const sb=$('shopBody');if(sb)sb.textContent='';shopState();return}if(!$('shopBody').querySelector('#pPlan')||mode==='shop'){const m=mode;mode='edit';renderEditor();mode=m;if(m==='shop')renderEditor()}shopState()}
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
 <h2 id="shH" tabindex="-1">Shopping list</h2>
 <p class="shopsum" role="status" aria-live="polite">${need?`You still need ${s2(need)}.`:P.sum.checkFirst?'Nothing confirmed to buy yet.':(aw.length?'Everything is bought. Check threads in as they arrive.':'Nothing left to buy.')}${P.sum.checkFirst?` <b class="cfnote">${cfNote(P.sum.checkFirst)}</b>`:''}</p>
 ${P.lines.length||co.length?`<p class="hint">Skeins still to get: <b>${P.lines.reduce((a,l)=>a+l.q,0)}</b>${co.length?` · ${s2(co.length)} with no amount entered`:''}</p>`:''}
 ${P.lines.length+co.length>6?`<div class="searchrow"><label class="sr" for="shSearch">Find a thread</label><input type="search" id="shSearch" placeholder="Find a thread, e.g. 310" autocomplete="off"><button type="button" class="sec" id="shSearchClear" hidden>Clear</button></div>`:''}</div>
 ${(n=>n>0?`<p class="hint">${s2(n)} still need${n===1?'s':''} attention in your project, so ${n===1?"it isn't":"they aren't"} on this list yet.</p>`:'')(P.review.filter(t=>!t.cf).length-co.length)}
 
 <p id="shMsg" class="ok-msg" role="status" aria-live="polite"></p>
 <ul class="shoplist" id="shList">${tb.map(l=>sc(l,false)).join('')}${co.map(t=>`<li class="scard" data-q="${esc((lab(t.it.code)+' '+DMC[t.it.code].name).toLowerCase())}"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${esc(cap(DMC[t.it.code].name))}</div></div><div class="qty unk" style="font-size:.85rem">Amount not entered</div></div><p class="hint">Add the amount in your project to check this color off.</p></li>`).join('')}<li class="noresults" id="shNoRes" hidden></li></ul>
 ${P.checkFirst.length?`<h3 id="shCheckH">Check first (${P.checkFirst.length})</h3><p class="hint">Not on the buy list or in the estimate: you may already have these.</p><ul class="shoplist" id="shCheck">${P.checkFirst.map(t=>`<li class="scard"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${esc(cfWhy(t))}</div></div></div></li>`).join('')}</ul>`:''}
 ${!co.length?shopDone(p,P,tb,aw,'shop'):''}
 ${aw.length?`<h3>Bought: check in when it arrives (${aw.length})</h3><ul class="shoplist" id="shAw">${aw.map(l=>sc(l,true)).join('')}</ul>`:''}
 <details class="donebox"${done.length&&!tb.length?' open':''}><summary>Done (${done.length})</summary><ul class="shoplist">${done.map(t=>`<li class="scard"><div class="top"><span class="bigsw" style="background:${DMC[t.it.code].hex}"></span><div><div class="code">DMC ${esc(lab(t.it.code))}</div><div class="for">${t.state==='received'?`Received ${t.recv} × ${BRAND[P.dest]} ${esc(disp(P.dest,t.r.to))}`:'You have enough'}</div></div></div>${t.state==='received'?`<div class="acts"><button type="button" class="ghost" id="sx-${esc(t.it.code)}" data-sx="${esc(t.it.code)}">Undo received</button></div>`:''}</li>`).join('')||'<li class="mut" style="list-style:none">Nothing yet.</li>'}</ul></details>
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
 E.querySelectorAll('[data-ss]').forEach(b=>b.onclick=()=>{if(b.disabled)return;const k=sid(b.dataset.ss),v=$('sq-'+k).value.trim();if(!/^\d+$/.test(v)||+v<1){$('shMsg').textContent='Enter how many whole skeins you got (1 or more). Nothing changed.';$('sq-'+k).focus();return}b.disabled=true;shopPanel=null;re(receive(p,b.dataset.ss,+v))});
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
 E.querySelectorAll('[data-st]').forEach(r=>r.onchange=()=>{const it=p.items.find(x=>x.code===r.dataset.st),d=p.decisions[r.dataset.st],rq=reqOf(p,it);d.status=r.value;d.estimateChecked=r.value==='have'&&rq.source==='estimated'?SK.fingerprint(it,p.skeinEstimator,rq.estimate):null;re()});
 E.querySelectorAll('[data-stitches]').forEach(i=>i.onchange=()=>{const it=p.items.find(x=>x.code===i.dataset.stitches),v=i.value.trim();if(!v){it.stitchCount=null;it.stitchCountReviewed=false;re();return}const parsed=SK.wholeInput(v,0,SK.MAX_STITCHES,'stitch count');if(!parsed.ok){pstatus(parsed.error);i.value=it.stitchCount==null?'':it.stitchCount;return}it.stitchCount=parsed.value;it.stitchCountReviewed=true;re()});
 E.querySelectorAll('[data-count-confirm]').forEach(b=>b.onclick=()=>{p.items.find(x=>x.code===b.dataset.countConfirm).stitchCountReviewed=true;re()});
 E.querySelectorAll('[data-strands]').forEach(i=>i.onchange=()=>{const it=p.items.find(x=>x.code===i.dataset.strands);if(i.value)it.strandCount=Number(i.value);else delete it.strandCount;re()});
 E.querySelectorAll('[data-stitch-type]').forEach(i=>i.onchange=()=>{const it=p.items.find(x=>x.code===i.dataset.stitchType);if(i.value)it.stitchType=i.value;else delete it.stitchType;re()});
 E.querySelectorAll('[data-own-confirm]').forEach(b=>b.onclick=()=>{p.decisions[b.dataset.ownConfirm].ownedSource='user';re()});
 E.querySelectorAll('[data-anc]').forEach(s=>s.onchange=()=>{p.decisions[s.dataset.anc].anchor=s.value||null;re()});
 E.querySelectorAll('[data-rr]').forEach(b=>b.onclick=()=>{const c=b.dataset.rr;if(!confirm(`Undo checking in DMC ${lab(c)}? It goes back on your shopping list.`))return;p.decisions[c].recv=null;re();pstatus('Check-in undone.')});
 E.querySelectorAll('[data-q]').forEach(i=>{if(i.tagName!=='INPUT')return;i.onchange=()=>{const v=i.value.trim(),it=p.items.find(x=>x.code===i.dataset.q);
  if(!/^\d+$/.test(v)||+v<1){pstatus(`"${v}" isn't a whole number of skeins (1 or more), so nothing changed. Tick "Not entered" if you don't know.`);i.value=it.qty===null?'':it.qty;return}
  if(+v>CAP()&&!confirm(`${v} skeins of DMC ${lab(it.code)} is a lot (more than ${CAP()}). Is that really skeins, not a stitch count? OK keeps ${v} skeins.`)){pstatus(`Kept ${it.qty===null?'the amount as not entered':plural(it.qty,'skein')}. Stitch counts go in your pasted list, e.g. "310 1160 stitches".`);i.value=it.qty===null?'':it.qty;return}it.qty=+v;it.stated=true;it.assumed=0;re()}});
 E.querySelectorAll('[data-unk]').forEach(c=>c.onchange=()=>{const it=p.items.find(x=>x.code===c.dataset.unk);if(c.checked){it.qty=null;it.stated=true;it.assumed=0}else{it.qty=1;it.stated=false;it.assumed=1;pstatus('Amount set to 1 skein (assumed). Change it to the real number.')}re()});
 E.querySelectorAll('[data-own]').forEach(i=>i.onchange=()=>{const v=i.value.trim(),d=p.decisions[i.dataset.own];
  if(v===''){d.owned=null;d.ownedSource=null;d.ownedPartial=false;re();return}const n=Number(v);if(!isFinite(n)||n<0){pstatus(`"${v}" isn't a valid amount, so nothing changed.`);i.value=d.owned===null?'':d.owned;return}if(n>CAP()&&!confirm(`You have ${n} skeins of DMC ${lab(i.dataset.own)}? That's more than ${CAP()}. OK keeps ${n}.`)){i.value=d.owned===null?'':d.owned;pstatus('Nothing changed.');return}d.owned=Math.round(n*100)/100;d.ownedSource='user';d.ownedPartial=false;re()});
 E.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{const c=b.dataset.rm,L=lab(c);
  const ok=await FlossFoxConfirm.ask({pose:'thinking',title:`Wave goodbye to DMC ${L}?`,
   body:'Pip tilts their head. Are you sure? It leaves this project (your collection is unchanged).'});
  if(!ok)return;p.items=p.items.filter(x=>x.code!==c);delete p.decisions[c];expanded.delete(c);re()});
 $('pAddBtn').onclick=()=>{const {items,errs}=parse($('pAdd').value);items.forEach(n=>{const ex=p.items.find(x=>x.code===n.code);
  if(ex){ex.qty=(ex.qty===null||n.qty===null)?null:ex.qty+n.qty;ex.src=ex.src.concat(n.src);ex.stitchCountReviewed=false;ex.assumed=ex.qty===null?0:asmOf(ex)+asmOf(n);ex.stated=ex.assumed===0;ex.stitchCount=ex.stitchCount!=null&&n.stitchCount!=null&&ex.stitchCount+n.stitchCount<=SK.MAX_STITCHES?ex.stitchCount+n.stitchCount:null}else{p.items.push({code:n.code,qty:n.qty,stated:n.stated,assumed:asmOf(n),src:n.src,stitchCount:n.stitchCount||null});p.decisions[n.code]=normDecision(n.code,{})}});
  touch(p);renderEditor();renderList();$('pAddBox').open=true;$('pAddErr').innerHTML=errs.length?`<div class="errbox"><b>${errs.length} couldn't be added:</b><ul>${errs.map(e=>`<li>"${esc(e.t)}": ${esc(e.why)}</li>`).join('')}</ul></div>`:'';if(errs.length)$('pAdd').value=errs.map(e=>e.t).join('\n');pstatus(`Added ${s2(items.length)}.`);if(items.length&&window.FlossFoxPip)FlossFoxPip.saved($('pMsg'),`Added ${s2(items.length)}`)}}

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
const PFX=KEY.replace(/\.v1$/,''),PREKEY=PFX+'.preimport.v1',BK_VERSION=1;
const PREF_KEYS={pip:PFX+'.pip.v1',hints:PFX+'.hints.v1',tips:PFX+'.tips.v1',fabric:PFX+'.fabric.v1'};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const TUI=()=>window.FlossFoxThreadsUI;
function fullBackup(){const T=TUI(),prefs={};for(const k in PREF_KEYS){const v=lsGet(PREF_KEYS[k]);if(v!==null)prefs[k]=v}
 return{app:'floss-fox',kind:'full-backup',version:BK_VERSION,schema:SCHEMA,exported:nowISO(),projects:store.projects.filter(p=>!p.demo),threads:T?T.exportData():{schema:1,threads:{}},prefs}}
function backup(){const d=fullBackup(),nt=Object.keys(d.threads.threads).length;download(JSON.stringify(d,null,2),'floss-fox-backup-'+nowISO().slice(0,10)+'.json','application/json');
 pstatus(`Backup downloaded with ${d.projects.length} project(s) and ${nt} thread color${nt===1?'':'s'}. Keep the file somewhere safe.`)}
const PREF_OK={pip:v=>v==='shown'||v==='hidden',hints:v=>v==='on'||v==='off',tips:v=>{try{const a=JSON.parse(v);return Array.isArray(a)&&a.every(x=>typeof x==='string')}catch(e){return false}},fabric:v=>{try{const o=JSON.parse(v);return!!o&&typeof o==='object'&&!Array.isArray(o)}catch(e){return false}}};
// returns {projects, threads|null, prefs, skipped, full} or {err}
function checkBackup(d){if(!d||typeof d!=='object'||d.app!=='floss-fox')return{err:'bad'};
 const full=d.kind==='full-backup';if(d.kind!==undefined&&!full)return{err:'bad'};
 if(full&&(typeof d.version!=='number'||d.version>BK_VERSION))return{err:typeof d.version==='number'?'new':'bad'};
 const m=migrate(d);if(!m)return{err:'bad'};if(m.tooNew)return{err:'new'};let threads=null,tsk=0,prefs={};
 if(full){const T=TUI();if(!T)return{err:'bad'};const tm=T.core.migrate(d.threads);if(!tm)return{err:'bad'};if(tm.tooNew)return{err:'new'};threads=tm.data.threads;tsk=tm.skipped;
  if(d.prefs&&typeof d.prefs==='object')for(const k in PREF_KEYS)if(typeof d.prefs[k]==='string'&&PREF_OK[k](d.prefs[k]))prefs[k]=d.prefs[k]}
 return{projects:m.data.projects,threads,prefs,skipped:m.skipped+tsk,full}}
function snapshot(){const keys=[KEY,TUI()?TUI().KEY:PFX+'.threads.v1',...Object.values(PREF_KEYS)],o={};keys.forEach(k=>{o[k]=lsGet(k)});return{at:nowISO(),keys:o}}
function undoImportRow(){const el=$('undoImport');if(!el)return;let s=null;try{s=JSON.parse(lsGet(PREKEY)||'null')}catch(e){}
 if(!s||!s.keys){el.hidden=true;el.innerHTML='';return}el.hidden=false;
 el.innerHTML=`<span class="hint">Your data from before the last import (${esc(new Date(s.at).toLocaleString())}) is kept in this browser.</span> <button type="button" class="sec small" id="undoImportBtn">Undo last import</button>`;
 $('undoImportBtn').onclick=()=>{if(!confirm('Undo the last import? Your projects, thread collection and preferences go back to exactly how they were before it. Anything changed since the import is lost.'))return;
  try{for(const k in s.keys){if(s.keys[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,s.keys[k])}localStorage.removeItem(PREKEY)}catch(e){pstatus('Undo failed: browser storage refused the change. Nothing else was changed.');return}
  location.hash='#projects';location.reload()}}
const RPIP=p=>`<picture><source type="image/webp" srcset="assets/pip/pip-${p}-160.webp"><img class="rpip" data-pose="${p}" src="assets/pip/pip-${p}-160.png" width="160" height="240" alt=""></picture>`;
function restoreFile(file){const R=$('restorePanel');if(!file)return;$('backupBox').open=true;if(file.size>5e6){R.hidden=false;R.innerHTML='<b class="warn">That file is too large to be a Floss Fox backup. Nothing was changed.</b>';return}
 R.hidden=false;R.innerHTML=RPIP('thinking')+'<p>Let me check this backup…</p>'; // shown only while the file is really being read and checked
 file.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){d=null}const c=checkBackup(d);
  if(c.err){pendingRestore=null;R.hidden=false;R.innerHTML=RPIP('puzzled')+`<b class="warn">${c.err==='new'?'This backup was made by a newer version of Floss Fox and can\'t be restored here. Nothing was changed.':'This file isn\'t a valid Floss Fox backup (it may be damaged or from another app). Nothing was changed.'}</b>`;pstatus('Restore failed: nothing changed.');return}
  pendingRestore=c.projects;const clash=pendingRestore.filter(p=>proj(p.id)).length,T=TUI(),mine=T?T.data().threads:{};
  const nt=c.threads?Object.keys(c.threads).length:0,tclash=c.threads?Object.keys(c.threads).filter(k=>mine[k]).length:0,np=Object.keys(c.prefs).length;
  R.innerHTML=RPIP('presenting')+`<p><b>I checked it. Backup contains ${pendingRestore.length} project(s)</b>${c.full?` and <b>${nt} thread color${nt===1?'':'s'}</b>${np?` plus ${np} preference${np===1?'':'s'}`:''}`:' (an older projects-only backup: your thread collection is not touched)'}${c.skipped?`; ${c.skipped} damaged or duplicate entr${c.skipped>1?'ies were':'y was'} skipped`:''}. ${clash?`${clash} project(s) already exist here (same project).`:'None of the projects already exist here.'}${c.full&&tclash?` ${tclash} color(s) are already in your collection.`:''}</p>
  <fieldset id="imodeSet"><legend>How to import:</legend><label><input type="radio" name="imode" value="merge" checked> <b>Merge</b>: add what's new, keep everything you already have${c.full?' (your skein counts are kept for colors you already have)':''}</label><br><label><input type="radio" name="imode" value="replace"> <b>Replace</b>: make my ${c.full?'projects and thread collection':'projects'} exactly match the backup</label></fieldset>
  ${clash?`<fieldset id="rmodeSet"><legend>When merging, for projects that already exist:</legend><label><input type="radio" name="rmode" value="replace" checked> Replace mine with the backup version</label><br><label><input type="radio" name="rmode" value="skip"> Keep mine, skip those</label><br><label><input type="radio" name="rmode" value="copy"> Keep both (import as a renamed copy)</label></fieldset>`:''}
  <p class="hint">A copy of your current data is kept first, so you can undo the import.</p>
  <div class="row"><button type="button" class="pri" id="rGo">Restore</button><button type="button" class="sec" id="rCancel">Cancel</button></div>`;
  $('rCancel').onclick=()=>{pendingRestore=null;R.hidden=true;pstatus('Restore cancelled.')};
  $('rGo').onclick=()=>{const im=(document.querySelector('input[name=imode]:checked')||{}).value||'merge';
   if(im==='replace'&&!confirm(`Replace your data with this backup? Your ${store.projects.filter(p=>!p.demo).length} project(s)${c.full?` and ${Object.keys(mine).length} thread color(s)`:''} will be replaced by the backup's ${pendingRestore.length} project(s)${c.full?` and ${nt} color(s)`:''}. You can undo this afterwards.`))return;
   try{localStorage.setItem(PREKEY,JSON.stringify(snapshot()))}catch(e){if(!confirm('A safety copy of your current data couldn\'t be saved in this browser (storage full or blocked), so this import can\'t be undone. Import anyway?'))return}
   let add=0,rep=0,skip=0,cp=0,ta=0;
   if(im==='replace'){store.projects=store.projects.filter(p=>p.demo).concat(pendingRestore);rep=pendingRestore.length}
   else{const modeEl=document.querySelector('input[name=rmode]:checked'),mode=modeEl?modeEl.value:'replace';
    pendingRestore.forEach(p=>{const i=store.projects.findIndex(x=>x.id===p.id);if(i<0){store.projects.push(p);add++}else if(mode==='replace'){store.projects[i]=p;rep++}else if(mode==='skip')skip++;else{store.projects.push({...p,id:newId(),name:(p.name+' (restored copy)').slice(0,100)});cp++}})}
   let tok=true;
   if(c.full&&T){if(im==='replace'){tok=T.replaceAll({threads:c.threads});ta=nt}else{const merged=Object.assign({},c.threads,mine);ta=Object.keys(c.threads).filter(k=>!mine[k]).length;tok=T.replaceAll({threads:merged})}
    if(im==='replace')for(const k in c.prefs){try{localStorage.setItem(PREF_KEYS[k],c.prefs[k])}catch(e){}}}
   pendingRestore=null;R.hidden=true;const ok=save()&&tok;renderList();if(openId&&proj(openId))renderEditor();undoImportRow();
   pstatus(`Restore ${ok?'done':'applied but NOT saved'} (${im}): ${add} added, ${rep} replaced, ${skip} skipped, ${cp} copied${c.full?`; ${ta} thread color(s) ${im==='replace'?'restored':'added'}`:''}.`);if(ok&&window.FlossFoxPip)FlossFoxPip.saved($('projStatus'))}})
  .catch(()=>{R.hidden=false;R.innerHTML='<b class="warn">Couldn\'t read that file. Nothing was changed.</b>'})}

// ---- Wiring ----
function showView(v,fromHash){{const pc=$('planCard');if(pc&&!pc.hidden){pc.hidden=true;pc.innerHTML=''}}if(!fromHash&&location.hash!=='#'+v)history.pushState(null,'','#'+v);const V={convert:['convertView','tabConvert'],threads:['threadsView','tabThreads'],projects:['projectsView','tabProjects'],help:['helpView','tabHelp'],shop:['shopView','tabShop']};
 const T=window.FlossFoxThreadsUI;if(T&&!$('threadsView').hidden&&v!=='threads')T.leaveView();if(T&&!$('projectsView').hidden&&v!=='projects')T.tipDone('compare');
 for(const k in V){const on=k===v;$(V[k][0]).hidden=!on;const t=$(V[k][1]);t.setAttribute('aria-pressed',String(on));if(on)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current')}
 if(v==='threads'&&T)T.render();if(v==='shop')ensureShop();if(v==='projects'){renderList();if(openId&&proj(openId)){renderEditor();$('projEdit').hidden=false;$('projListCard').hidden=true}else{$('projEdit').hidden=true;$('projListCard').hidden=false}}window.scrollTo(0,0)}
$('tabConvert').onclick=()=>showView('convert');$('tabProjects').onclick=()=>showView('projects');$('tabThreads').onclick=()=>showView('threads');$('tabHelp').onclick=()=>showView('help');addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(['convert','threads','projects','shop','help'].includes(v))showView(v,true)});addEventListener('popstate',()=>{const v=location.hash.slice(1)||'convert';if(['convert','threads','projects','shop','help'].includes(v))showView(v,true)});$('tabShop').onclick=()=>showView('shop');$('shopGoProj').onclick=()=>showView('projects');
$('newEmpty').onclick=()=>{if($('newEmpty').disabled)return;$('newEmpty').disabled=true;setTimeout(()=>$('newEmpty').disabled=false,600);const p={id:newId(),name:'Untitled project',notes:'',buyBrand:'dmc',status:'planning',items:[],decisions:{},purchased:{},created:nowISO(),updated:nowISO()};store.projects.push(p);save();renderList();openProject(p.id)};
$('backupBtn').onclick=backup;undoImportRow();$('restoreFile').onchange=e=>{restoreFile(e.target.files[0]);e.target.value=''};
let saving=false;
$('saveProj').onclick=()=>{if(saving)return;if(!state.items.length){$('copymsg').textContent='Nothing to save yet. Add your colors first.';return}saving=true;setTimeout(()=>saving=false,800);
 const ex=window.isExample&&window.isExample();
 const p={id:newId(),name:($('newProjName').value.trim()||(ex?'Example project':'Untitled project')).slice(0,100),notes:'',buyBrand:$('dest').value,status:'planning',items:state.items.map(i=>({code:i.code,qty:i.qty,stated:i.stated!==false,assumed:asmOf(i),src:i.src.slice(),stitchCount:i.stitchCount||null})),decisions:{},purchased:{},created:nowISO(),updated:nowISO()};
 p.items.forEach(i=>p.decisions[i.code]=normDecision(i.code,{anchor:choice[i.code]||null}));store.projects.push(p);const ok=save();
 $('copymsg').innerHTML=(ok?`✓ Saved "${esc(p.name)}" in this browser.`:`Saved for now only: this browser isn't letting Floss Fox store projects, so download a backup from My projects.`)+` <button type="button" class="pri small" id="openSaved">Check what you have →</button>`;$('newProjName').value='';renderList();
 $('openSaved').onclick=()=>{showView('projects');openProject(p.id)};if(ok&&window.FlossFoxPip)FlossFoxPip.saved($('copymsg'))};
load();renderList();
window.FlossFoxProjects={estimateInput,plan,planText,csv,migrate,backup,restoreFile,checkBackup,PREKEY,_store:()=>store,KEY,canSave:()=>canSave,
 replaceAll:data=>{store={schema:SCHEMA,projects:data.projects};canSave=true;storeMsg('');openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false;const ok=save();renderList();return ok},
 removeDemo:()=>{const n=store.projects.filter(x=>x.demo).length;store.projects=store.projects.filter(x=>!x.demo);if(openId&&!proj(openId)){openId=null;$('projEdit').hidden=true;$('projListCard').hidden=false}save();renderList();return n},showView,open:id=>{showView('projects');openProject(id)},add:p=>{const m=normProject(p);if(!m)return null;store.projects.push(m);save();renderList();return m.id}}; // for tests and debugging
})();
