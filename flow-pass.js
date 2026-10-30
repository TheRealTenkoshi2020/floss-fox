/* Flow pass (dev): short paths. Quick add on My threads, add owned colors from a project (count first, one Undo).
   Local only: reads and writes this browser's storage through the existing Floss Fox APIs. No network. */
(function(){'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=()=>window.FlossFoxThreadsUI,P=()=>window.FlossFoxProjects;
const colors=n=>`${n} color${n===1?'':'s'}`;
function status(t){const s=$('thStatus');if(s)s.textContent=t}
// ---- Item 4: one Undo for the last "add from projects", shown right where you tapped.
function offerUndo(n,host){document.querySelectorAll('.ffundo').forEach(e=>e.remove());if(!n)return;const h=host||$('thFromProj')||$('thStatus');if(!h)return;
 const w=document.createElement('div');w.className='ffundo row';w.innerHTML=`<span class="hint">Added ${colors(n)} to My threads.</span><button type="button" class="sec small" data-ffundo>Undo</button>`;
 (h.id==='thFromProj'?h.parentElement.insertBefore(w,h.nextSibling):h.after(w));w.querySelector('button').onclick=()=>{const r=T().undoFromProjects();w.remove();const m=r?`Took back ${colors(r)}. Everything else is as it was.`:'Nothing to take back.';status(m);const ps=$('projStatus');if(ps&&host&&host.closest('#projEdit'))ps.textContent=m;drawFrom();drawProjAdd()}}
// My threads: one button per recent project that has new Have enough colors.
function drawFrom(){const box=$('thFromProj'),t=T(),p=P();if(!box||!t||!p||!t.fromProjectsCount)return;const S=p._store();
 const ps=S.projects.filter(x=>!x.demo).sort((a,b)=>String(b.updated).localeCompare(String(a.updated))).map(x=>({x,n:t.fromProjectsCount([x.id])})).filter(o=>o.n).slice(0,3);
 box.hidden=!ps.length;box.innerHTML=ps.map(o=>`<button type="button" class="sec small fffrom" data-from="${esc(o.x.id)}" aria-label="Add ${colors(o.n)} you have from ${esc(o.x.name||'your project')}" title="${esc(o.x.name||'your project')}"><span aria-hidden="true">+ Add ${colors(o.n)} you have from </span><span class="fffname" aria-hidden="true">${esc(o.x.name||'your project')}</span></button>`).join('');
 box.querySelectorAll('[data-from]').forEach(b=>b.onclick=()=>{const r=t.addFromProjects([b.dataset.from]),n=r.added.length;status(n?`Added ${colors(n)} from ${S.projects.find(x=>x.id===b.dataset.from).name}. Colors already in your collection were left alone.`:'Nothing new to add.');drawFrom();offerUndo(n)})}
// Open project: "Put my N Have enough colors in My threads" under the compare box.
function drawProjAdd(){const host=$('pCmp'),t=T(),p=P();if(!host||!t||!p||!t.fromProjectsCount)return;const id=p.openId&&p.openId();let el=$('pToThreads');
 const pr=id&&p._store().projects.find(x=>x.id===id),n=pr&&!pr.demo?t.fromProjectsCount([id]):0;
 if(!n){if(el)el.remove();return}
 if(!el){el=document.createElement('div');el.id='pToThreads';el.className='row ffto';host.after(el)}
 const txt=`Put my ${colors(n)} marked Have enough in My threads`;if(el.dataset.n===String(n))return;el.dataset.n=String(n);
 el.innerHTML=`<button type="button" class="sec small" id="pToThreadsBtn">${esc(txt)}</button><span class="hint">Adds only colors not in your collection yet.</span>`;
 $('pToThreadsBtn').onclick=()=>{const r=t.addFromProjects([id]),k=r.added.length;const ps=$('projStatus');if(ps)ps.textContent=k?`Added ${colors(k)} to My threads.`:'Nothing new to add.';el.remove();offerUndo(k,host)}}
// ---- Item 5: one tap fills every missing amount with 1 skein, marked Estimated, with an Undo.
function drawFill(){const p=P();if(!p||!p.missingCount)return;const id=p.openId&&p.openId(),sum=$('pSummary');let el=$('pFill');
 const pr=id&&p._store().projects.find(x=>x.id===id),n=pr?p.missingCount(id):0;
 if(!sum||$('projEdit').hidden||!n){if(el&&!el.querySelector('[data-fillundo]'))el.remove();return}
 if(el&&el.dataset.n===String(n)&&sum.contains(el))return;if(el)el.remove();
 el=document.createElement('div');el.id='pFill';el.className='ffill noprint';el.dataset.n=String(n);
 el.innerHTML=`<span class="hint">${n===1?'1 color has':n+' colors have'} no amount yet, so we can’t count ${n===1?'it':'them'} for you.</span><button type="button" class="sec small" id="pFillBtn">Use 1 skein for ${n===1?'it':'each'} (Estimated)</button>`;
 (sum.querySelector('.stats')||sum.lastElementChild).after(el);
 $('pFillBtn').onclick=()=>{const k=p.fillMissing(id);const s=$('projStatus');if(s)s.textContent=`Filled ${colors(k)} with 1 skein each, marked Estimated. Change any of them in Details.`;
  const u=document.createElement('div');u.id='pFill';u.className='ffill ffundo noprint';u.innerHTML=`<span class="hint">Filled ${colors(k)} with 1 skein each, marked Estimated.</span><button type="button" class="sec small" data-fillundo>Undo</button>`;
  const sm=$('pSummary');(sm.querySelector('.stats')||sm.lastElementChild).after(u);u.querySelector('button').onclick=()=>{const r=p.undoFill();u.remove();const s2=$('projStatus');if(s2)s2.textContent=r?`Took back ${colors(r)}. Their amounts are unknown again.`:'Nothing to take back.';refresh()}}}
// ---- Item 1: keep the chosen tab in view in the one-row phone tabs.
function tabInView(){const n=document.querySelector('nav.tabs');if(!n||n.scrollWidth<=n.clientWidth)return;const a=n.querySelector('[aria-pressed=true]');if(a&&a.scrollIntoView){const r=a.getBoundingClientRect(),m=n.getBoundingClientRect();if(r.left<m.left||r.right>m.right)n.scrollLeft+=r.left-m.left-12}}
// ---- Item 6: Shopping opens your last-used project; the store note folds to one line.
let shopWasOpen=false;
/* Flow pass: a Shopping auto-pick should not leave the Projects tab sitting inside that project */let autoPicked=null;
function autoBackToList(){const p=P(),id=autoPicked;autoPicked=null;if(!id||!p||!p.openId||p.openId()!==id)return;setTimeout(()=>{const c=$('pClose');if(c&&c.offsetParent)c.click()},0)}
function shopAuto(){const v=$('shopView'),open=v&&!v.hidden;if(open&&!shopWasOpen){const sel=$('shopPick'),p=P();
  if(sel&&!sel.value&&p&&p._store){const ps=p._store().projects.slice().sort((a,b)=>String(b.updated).localeCompare(String(a.updated))),last=ps.find(x=>!x.demo)||ps[0];
   if(last&&[...sel.options].some(o=>o.value===last.id)){const pe=$('projEdit'),wasList=!(pe&&!pe.hidden&&p.openId&&p.openId());sel.value=last.id;sel.dispatchEvent(new Event('change',{bubbles:true}));autoPicked=wasList?last.id:null}}}
 shopWasOpen=!!open;
 document.querySelectorAll('#shopView p.ff-skein-direct').forEach(n=>{if(n.parentElement.classList.contains('ffstore'))return;const d=document.createElement('details');d.className='ffmore ffstore noprint';
  d.innerHTML='<summary>About these store links</summary>';n.before(d);d.appendChild(n)})}
// ---- Item 3: Enter adds (already), the box grows for a pasted list.
function grow(){const a=$('thAdd');if(!a)return;a.style.height='auto';a.style.height=Math.min(160,Math.max(44,a.scrollHeight+2))+'px'}
let q=0;function refresh(){if(q)return;q=requestAnimationFrame(()=>{q=0;drawFrom();drawProjAdd();drawFill();tabInView();shopAuto();FF.after.forEach(f=>{try{f()}catch(e){}})})}
const FF=window.FlossFoxFlow={offerUndo,refresh,after:[]};
function init(){{const t=$('tabProjects');if(t)t.addEventListener('click',autoBackToList)}{const sp=$('shopPick');if(sp)sp.addEventListener('input',()=>{autoPicked=null})}const a=$('thAdd');if(a)a.addEventListener('input',grow);
 const mo=new MutationObserver(refresh);{const e=$('projEdit');if(e)mo.observe(e,{childList:true,subtree:true})}['thList','pCmp','projEdit','projList','shopBody','shopCard'].forEach(i=>{const e=$(i);if(e)mo.observe(e,{childList:true})});
 ['threadsView','projectsView','shopView'].forEach(i=>{const e=$(i);if(e)mo.observe(e,{attributes:true,attributeFilter:['hidden']})});refresh()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* ci005-77 compact pass: Settings points to Help instead of repeating it (added by script to keep the Settings markup untouched for the Backup branch merge) */
(function(){function go(){const v=document.getElementById('settingsView');if(!v||document.getElementById('setHelpLink'))return;
 const p=document.createElement('p');p.className='ffhelplink noprint';p.innerHTML='<button type="button" class="ghost" id="setHelpLink">See how Floss Fox works in Help</button>';v.append(p);
 p.querySelector('button').onclick=()=>{const t=document.getElementById('tabHelp');if(t)t.click()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go()})();
