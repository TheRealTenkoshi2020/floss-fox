/* Floss Fox v2 (increment 2): read-only combined shopping plan for several projects.
   FlossFoxRequirementBridge.adapt -> FlossFoxCombinedPlan.calculate (with preflightIssues). Never writes projects or the collection.
   Estimates come from the existing FlossFoxSkeins.requirement (same input as the project page) and stay labelled "estimate".
   Only confirmed full skeins in My Thread Collection cover needs; unconfirmed or partial-only stock goes to Check first.
   Shared colors are summed first and stash is subtracted once. Demo projects are never offered. */
(function(){
if(typeof document==='undefined'||!window.FlossFoxCombinedPlan||!window.FlossFoxRequirementBridge||!window.FlossFoxProjects)return;
const $=id=>document.getElementById(id),P=window.FlossFoxProjects;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lab=c=>'DMC '+c+(DMC[c]?' '+DMC[c].name:'');
const WHY={'unknown-required-amount':'amount not known','missing-quantity':'no amount given','assumed-quantity':'amount assumed (1), not stated','assumed-portion':'part of the amount is assumed','partly-assumed':'part of the amount is assumed','assumed':'amount assumed, not stated','unknown':'amount not known','estimated-not-exact':'approximate estimate','community-estimate':'approximate estimate (2,100 full crosses per skein at 14ct, 2 strands, plus your settings)','unconfirmed-inventory':'your full-skein count isn\'t confirmed yet','partial-unmeasured':'you have a partial skein of unknown size','received-check-stash':'marked received in a project: check your collection','project-owned-differs-from-collection':'a project notes an owned amount: check your collection','have-decision-check-quantity':'marked "have enough" in a project','purchased-not-stock':'marked bought in a project: check your collection','specialty-or-nonfull-stitch':'blend, specialty thread or non-full stitches','stitch-count-not-reviewed':'stitch count not reviewed','invalid-stitch-count':'stitch count looks wrong','estimator-failed':'estimate failed','invalid-inventory':'collection entry looks wrong','inconsistent-required-amount':'amounts disagree','invalid-requirement':'amount looks wrong','invalid-required-amount':'amount looks wrong','partial-inconsistent':'partial skein data looks wrong'};
const ISS={'invalid-code':'a color that isn\'t a DMC number','duplicate-project-color':'the same color listed twice','invalid-requirement':'an amount that isn\'t a whole number of skeins','invalid-assumed-count':'an amount that can\'t be checked','brand-needs-review':'buys a brand other than DMC; this list shows original DMC colors only','demo-skipped':'is demo data, skipped','duplicate-project':'was selected twice','invalid-project':'couldn\'t be read'};
let last=null;
function resolver({project,item}){const r=FlossFoxSkeins.requirement(P.estimateInput(item),project.skeinEstimator,DMC,fam(item.code),project.buyBrand);return{amount:r.amount,source:r.source}}
function compute(ids){const all=P._store().projects,sel=all.filter(p=>ids.includes(p.id)&&!p.demo),names=Object.fromEntries(all.map(p=>[p.id,p.name||'Untitled project']));
 const a=FlossFoxRequirementBridge.adapt(JSON.parse(JSON.stringify(sel)),{validCodes:DMC,resolveEstimate:resolver});
 const coll=FlossFoxThreadsUI.data(),r=FlossFoxCombinedPlan.calculate(a.projects,{schema:1,threads:JSON.parse(JSON.stringify(coll.threads))},{validCodes:DMC,preflightIssues:a.issues});
 return{...r,names}}
const per=x=>x.projects.map(p=>`${p.name||'Untitled project'}: ${p.amount===null?'amount unknown':(p.source==='estimated'?'about '+(Math.round(p.amount*10)/10):p.amount)}`).join('; ');
const haveTxt=x=>x.listedFullSkeins?`You have ${x.confirmedFullSkeins===x.listedFullSkeins?x.listedFullSkeins+' confirmed':x.listedFullSkeins+' (not confirmed)'}${x.partialPresent?' + a partial':''}`:(x.partialPresent?'You have a partial only':'None in your collection');
const why=x=>[...new Set(x.reviewReasons.map(k=>WHY[k]||k))].join('; ');
const range=x=>x.maximumWholeSkeinsToBuy===null?(x.minimumWholeSkeinsToBuy?`buy at least ${x.minimumWholeSkeinsToBuy}`:'amount to buy unknown'):x.minimumWholeSkeinsToBuy===x.maximumWholeSkeinsToBuy?`buy ${x.maximumWholeSkeinsToBuy}`:`buy ${x.minimumWholeSkeinsToBuy} to ${x.maximumWholeSkeinsToBuy}`;
function text(r){const buy=r.rows.filter(x=>x.status==='buy'),rev=r.rows.filter(x=>x.status==='review'),o=[`Floss Fox shopping plan: ${r.summary.selectedProjects} project${r.summary.selectedProjects===1?'':'s'}`];
 o.push('',`NEED TO BUY${r.summary.canFinalize?` (${r.summary.exactBuyTotal} skeins)`:''}:`);buy.forEach(x=>o.push(`- ${lab(x.code)}: ${x.maximumWholeSkeinsToBuy} (${per(x)}; ${haveTxt(x)})`));if(!buy.length)o.push('- nothing');
 o.push('','CHECK FIRST:');rev.forEach(x=>o.push(`- ${lab(x.code)}: ${range(x)}. ${why(x)} (${per(x)}; ${haveTxt(x)})`));if(!rev.length)o.push('- nothing');
 r.issues.forEach(i=>o.push(`! ${r.names[i.projectId]||'A project'}${i.code?' (DMC '+i.code+')':''}: ${ISS[i.kind]||i.kind}`));
 if(!r.summary.canFinalize)o.push('','Not a final total: check the colors above first.');o.push('Covered by confirmed skeins: '+r.summary.covered+' color'+(r.summary.covered===1?'':'s')+'.');return o.join('\n')}
function draw(){const C=$('planCard'),projs=P._store().projects.filter(p=>!p.demo);
 C.innerHTML=`<h2>Plan shopping for several projects</h2><p class="hint">Pick projects. Colors they share are added up, and each confirmed skein you own is counted once. Nothing in your projects or collection changes.</p>
${projs.length?`<fieldset class="bkmode"><legend>Projects</legend>${projs.map(p=>`<label style="display:block"><input type="checkbox" data-plan="${esc(p.id)}"> ${esc(p.name||'Untitled project')} <span class="mut">(${p.items.length} color${p.items.length===1?'':'s'})</span></label>`).join('')}</fieldset>`:'<p>No projects yet.</p>'}
<div class="row"><button type="button" class="pri" id="planGo">Show shopping plan</button><button type="button" class="ghost" id="planClose">Close</button></div><div id="planOut" aria-live="polite"></div>`;
 $('planGo').onclick=()=>{const ids=[...C.querySelectorAll('[data-plan]:checked')].map(i=>i.dataset.plan);if(!ids.length){$('planOut').innerHTML='<p class="hint">Pick at least one project.</p>';return}last=compute(ids);show(last)};
 $('planClose').onclick=()=>{C.hidden=true;C.innerHTML='';$('planOpen').focus()}}
function show(r){const buy=r.rows.filter(x=>x.status==='buy'),rev=r.rows.filter(x=>x.status==='review'),O=$('planOut');
 const li=(x,b)=>`<li${b?` data-code="${esc(x.code)}"`:''}><b>${esc(lab(x.code))}</b>: ${b?`buy <b>${x.maximumWholeSkeinsToBuy}</b>`:esc(range(x))}<br><span class="hint">${b?'':esc(why(x))+'. '}${esc(per(x))}. ${esc(haveTxt(x))}.</span></li>`;
 O.innerHTML=`<h3 id="planBuyH">Need to buy${r.summary.canFinalize?` (${r.summary.exactBuyTotal} skein${r.summary.exactBuyTotal===1?'':'s'})`:''}</h3><ul id="planBuy">${buy.map(x=>li(x,true)).join('')||'<li>Nothing.</li>'}</ul>
<h3>Check first</h3><ul id="planCheck">${rev.map(x=>li(x,false)).join('')||'<li>Nothing.</li>'}</ul>
${r.issues.length?`<div class="errbox" id="planIssues"><ul>${r.issues.map(i=>`<li>${esc(r.names[i.projectId]||'A project')}${i.code?' (DMC '+esc(i.code)+')':''}: ${esc(ISS[i.kind]||i.kind)}.</li>`).join('')}</ul></div>`:''}
<p class="hint" id="planNote">${r.summary.canFinalize?'Every color is checked.':'<b>Not a final total</b>: check the colors under Check first.'} ${r.summary.covered} color${r.summary.covered===1?'':'s'} covered by confirmed skeins. Estimates are approximate. Bought or received thread is not subtracted until it's in your collection.</p>
<div class="row"><button type="button" class="sec" id="planCopy">Copy list</button><button type="button" class="ghost" id="planPrint">Print</button></div><p class="hint" id="planMsg" role="status"></p>`;
 // FF-SKEIN-DEV-PLANNER: use only confirmed final Need to buy rows, never Check first.
 if((window.FLOSS_FOX_ENV==='preview'||window.FLOSS_FOX_DIRECT_LINKS===true)&&window.FlossFoxSkeinPreviewUI){
  const needs=buy.map(x=>({brand:'dmc',code:x.code,
    family:typeof fam==='function'&&fam(x.code)==='solid'?'six-strand-cotton':'specialty',pack:'single-skein',
    qty:x.maximumWholeSkeinsToBuy,assumed:false,disputed:false}));
  const lis=[...O.querySelectorAll('#planBuy > li[data-code]')];
  if(lis.length===needs.length)FlossFoxSkeinPreviewUI.inline(lis.map((li,i)=>({li,need:needs[i]})));
 }
 $('planCopy').onclick=()=>{const t=text(r);(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>$('planMsg').textContent='Copied.',()=>$('planMsg').textContent='Copy failed. Select the list and copy it.')};
 $('planPrint').onclick=()=>{const w=window.open('','_blank');if(!w){$('planMsg').textContent='Printing was blocked by the browser.';return}w.document.write('<!doctype html><title>Floss Fox shopping plan</title><pre style="white-space:pre-wrap;font:14px/1.4 sans-serif"></pre>');w.document.querySelector('pre').textContent=text(r);w.document.close();w.focus();w.print()}}
$('planOpen').onclick=()=>{const C=$('planCard');C.hidden=false;draw();C.focus()};
window.FlossFoxPlanner={compute,text};
})();
