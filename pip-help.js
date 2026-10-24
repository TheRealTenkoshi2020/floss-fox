/* Pip everywhere (local, no AI, no network): one per-screen help table that feeds Ask Pip, the floating bubble,
   the import window, backup, the Fabric page and the "?" term chips. All wording comes from flow-strings.js (placeholders). */
(function(){'use strict';
/* New strings for the tab Ask Pip cards: PLACEHOLDERS for Pixel (see /workspace/ask-pip-tabs/STRINGS_FOR_PIXEL.md). */
window.FF_ASKTAB=window.FF_ASKTAB||{findNext:'Paste or import my list',projectsNext:'Create a project',shopNext:'Open my shopping list',settingsTitle:'Backup and settings',settingsBody:'Your projects and threads live only in this browser. Save a backup file now and then so you can restore them here or on another device.',settingsNext:'Export Backup (.json)'};
const S=()=>window.FF_STR||{},$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const vis=id=>{const e=$(id);return!!(e&&!e.hidden)};
const P=()=>window.FlossFoxProjects;
const FX=(t,v)=>typeof t==='function'?t(v||{}):t||'';
const H=()=>S().helpAlt||{};
const thN=()=>{const T=window.FlossFoxThreadsUI;try{return T?T.count({demo:false}):0}catch(e){return 0}};
const curProj=()=>{const p=P();if(!p||!p.openId)return null;const id=p.openId();return id?(p._store().projects.find(x=>x.id===id)||null):null};
const planOf=pr=>{try{return P().plan(pr)}catch(e){return null}};
const click=id=>{const e=$(id);if(e){e.scrollIntoView({block:'center'});e.click();return true}return false};
const focus=id=>{const e=$(id);if(e){e.scrollIntoView({block:'center'});e.focus();return true}return false};
/* "Do this next": label + action per screen (Pixel's notes), always an existing control */
function doNext(k){const e=entry(k)||{};switch(k){
 case'convert':{const t=($('inp')||{}).value;return t&&t.trim()?{label:H().findHasText,run:()=>click('go')}:{label:e.doNext,run:()=>click('sample')}}
 case'results':return{label:e.doNext,run:()=>{const n=$('newProjName');if(n&&!n.value.trim())return focus('newProjName');click('saveProj')}};
 case'threads':return{label:e.doNext,run:()=>{const t=$('thAdd');if(t&&t.value.trim())return click('thAddBtn');focus('thAdd')}};
 case'projects':{const last=P()&&P().lastProject();if(!last)return{label:e.doNext,run:()=>window.FFImportOpen&&window.FFImportOpen()};const nm=last.name.length>18?last.name.slice(0,18)+'…':last.name,l=FX(H().projectsHas,{name:nm});return{label:l.length<=28?l:H().projectsHasFallback,run:()=>P().openProject(last.id)}}
 case'project':{if($('pUseColl')&&thN())return{label:e.doNext,run:()=>click('pUseColl')};if(!thN())return{label:((S().compare||{}).emptyBtn),run:()=>P().showView('threads')};return{label:H().projectNextAlt,run:()=>click('pShop')}}
 case'readiness':{const pr=curProj(),pl=pr&&planOf(pr);if(pl&&pl.ready)return null;return{label:e.doNext,run:()=>click('f-att')}}
 case'shop':{const c=document.querySelector('#shopBody #pCopy')||document.querySelector('#shopBody details.shopextra summary');if(!c||!vis('shopBody'))return{label:(S().shopEmptyProjects),run:()=>P().showView('projects')};return{label:e.doNext,run:()=>{const d=c.closest('details');if(d)d.open=true;c.scrollIntoView({block:'center'});c.focus()}}}
 case'fabric':return{label:e.doNext,run:()=>focus('fcW')};
 case'import':return{label:e.doNext,run:()=>click('patFile')};
 case'backup':return{label:e.doNext,run:()=>click('backupBtn')};
 case'help':return{label:e.doNext,run:()=>window.FlossFoxTour&&window.FlossFoxTour.start()}}
 return null}
function screen(){
 if(/fabric\.html/.test(location.pathname)||document.body.dataset.ffScreen==='fabric')return'fabric';
 const d=$('ffPatternDialog');if(d&&d.open)return'import';
 if(vis('threadsView'))return'threads';
 if(vis('projectsView')){if(vis('projEdit')){const r=$('pReady');if(r&&!r.hidden){const b=r.getBoundingClientRect();if(b.top<innerHeight*0.5&&b.bottom>80)return'readiness'}return'project'}const b=$('backupBox');return b&&b.open?'backup':'projects'}
 if(vis('shopView'))return'shop';
 if(vis('helpView'))return'help';
 const r=$('results');return r&&!r.hidden?'results':'convert'}
const entry=k=>(S().help||{})[k]||null;
function topics(k){const t=((S().topics||{})[k]||[]);return k==='import'&&window.FF_PCHECK_HELP?t.concat([window.FF_PCHECK_HELP]):t}
function blockHtml(k){const e=entry(k);if(!e)return'';const nx=doNext(k);
 return`<div class="ffhelp" data-ffscreen="${k}"><p class="ffeli5"><b>${esc(e.title)}</b><br>${esc(e.eli5)}</p>${nx&&nx.label?`<div class="row"><button type="button" class="pri" data-ffnext="${k}">${esc(nx.label)}</button></div>`:''}${topics(k).map(([q,a])=>`<details class="fftopic"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`}
function bindBlock(root,onDo){root.querySelectorAll('[data-ffnext]').forEach(b=>b.onclick=()=>{const nx=doNext(b.dataset.ffnext);if(onDo)onDo();if(nx)nx.run()})}
const ACTIONS=new Proxy({},{get:(o,k)=>()=>{const nx=doNext(k);if(nx)nx.run()}});
/* floating bubble: tab first, then condition; rotate within a condition; one line per tab visit */
const B=k=>(S().bubble||{})[k],META=k=>((window.FF_P12_META||{})[k]||{}).pose;
const rot={};
function bubbleKeys(k){const pr=curProj();
 switch(k){
  case'threads':{const n=thN();return n?[['p12.bubble.threads.has.1',{n}],['p12.bubble.threads.has.2',{}]]:[['p12.bubble.threads.empty.1'],['p12.bubble.threads.empty.2']]}
  case'projects':case'backup':{const n=P()?P()._store().projects.length:0;return n?[['p12.bubble.projects.has.1'],['p12.bubble.projects.has.2',{n}]]:[['p12.bubble.projects.empty.1']]}
  case'project':case'readiness':{const pl=pr&&planOf(pr);if(!pl)return[];if(pl.ready)return[['p12.bubble.project.ready.1']];const n=((pl.sum&&pl.sum.checkFirst)||0);return n?[['p12.bubble.project.todo.1',{n}],['p12.bubble.project.todo.2']]:[['p12.bubble.project.todo.2']]}
  case'shop':{const pl=pr&&planOf(pr);if(!pl)return[['p12.bubble.shop.empty.1']];const tb=pl.lines.filter(l=>!l.bought).length,aw=pl.lines.filter(l=>l.bought).length;const rv=((pl.sum&&pl.sum.checkFirst)||0);return tb?[['p12.bubble.shop.has.1']]:aw?[['p12.bubble.shop.has.2']]:rv?[['p12.bubble.project.todo.1',{n:rv}]]:[['p12.bubble.shop.none.1']]}
  case'fabric':return[['p12.bubble.fabric.1'],['p12.bubble.fabric.2']];
  case'help':return[['p12.bubble.help.1'],['p12.bubble.help.2']];
  case'import':return[];}
 return[]}
function pickLine(k){const ks=bubbleKeys(k).filter(x=>B(x[0]));if(!ks.length)return null;const c=ks.map(x=>x[0]).join('|');rot[c]=(rot[c]===undefined?-1:rot[c])+1;const [key,v]=ks[rot[c]%ks.length];return{key,text:FX(B(key),v),pose:META(key)}}
let last=null,lastKey=null;function bubble(){const k=screen();const g=k==='readiness'?'project':k==='backup'?'projects':k;if(g===last)return;last=g;const Pp=window.FlossFoxPip;
 if(g==='convert'||g==='results'){lastKey=null;if(Pp&&Pp.screen)Pp.screen(null);return}
 const l=pickLine(g);lastKey=l&&l.key;if(g==='fabric'){fabricLine(l);return}if(!Pp||!Pp.screen)return;if(l)Pp.screen(g,l.text,l.pose);else Pp.screen(null)}
/* refresh the project/shop line when its condition changes (e.g. becomes ready), still one line per condition */
let lastCond='';function bubbleCond(){const g=last;if(!['project','shop','threads','projects'].includes(g))return;const c=bubbleKeys(g).map(x=>x[0]).join('|');if(c===lastCond)return;const first=!lastCond;lastCond=c;if(first)return;last=null;bubble()}
function fabricLine(l){const slot=$('ffFabricPip');if(!slot||!l)return;slot.querySelector('.ffpipline').textContent=l.text;slot.dataset.key=l.key}
/* Find floss results: one Next to save */
function findNext(){const w=$('findNext'),r=$('results');if(!w||!r)return;w.hidden=r.hidden;const b=$('findNextBtn');const l=(S().next||{}).find;if(b&&l&&b.textContent!==l+' →'){b.textContent=l+' →';b.onclick=()=>{const sb=$('saveBox');if(sb)sb.scrollIntoView({block:'center'});const n=$('newProjName');if(n)n.focus()}}}
/* Ask Pip card on the index tabs (the Fabric card pattern: bold heading, short explanation, one primary action).
   Body is Pixel's per-screen help (flow phases 1-2); the primary button runs the tab's main next step. */
const AT=()=>window.FF_ASKTAB||{};
function tabKey(){const k=screen();return k==='results'?'convert':k==='readiness'?'project':k==='backup'?'projects':vis('settingsView')?'settings':k}
function tabNext(k){const A=AT();switch(k){
 case'convert':return{label:A.findNext,run:()=>{const i=$('inp');if(i){i.scrollIntoView({block:'center'});i.focus()}}};
 case'projects':return{label:A.projectsNext,run:()=>click('newEmpty')};
 case'shop':{/* a list is showing: Pixel's existing step (Copy, download or print); otherwise open the latest project's list */const c=document.querySelector('#shopBody #pCopy')||document.querySelector('#shopBody details.shopextra summary');if(c&&vis('shopBody'))return doNext('shop');const last=P()&&P().lastProject();return{label:A.shopNext,run:()=>{if(last){P().open(last.id);click('pShop')}else P().showView('projects')}}}
 case'settings':return{label:A.settingsNext,run:()=>focus('settingsExport')};
 default:return doNext(k)}}
function tabBody(k){const e=k==='settings'?{title:AT().settingsTitle,eli5:AT().settingsBody}:entry(k);if(!e)return'';const nx=tabNext(k);
 return`<div class="ffhelp" data-ffscreen="${k}"><p class="ffeli5"><b>${esc(e.title||'')}</b><br>${esc(e.eli5||'')}</p>${nx&&nx.label?`<div class="row"><button type="button" class="pri" data-ffnext="${k}" data-fftabnext="${k}">${esc(nx.label)}</button></div>`:''}</div>`}
function tabBind(root,onDo){root.querySelectorAll('[data-fftabnext]').forEach(b=>b.onclick=()=>{const nx=tabNext(b.dataset.fftabnext);if(onDo)onDo();if(nx)nx.run()})}
/* "?" term chips */
let pop=null;
function closePop(back){if(!pop)return;const o=pop.owner;pop.remove();pop=null;if(o){o.setAttribute('aria-expanded','false');if(back)o.focus()}}
function chip(term){const t=(S().terms||{})[term];if(!t)return null;const b=document.createElement('button');b.type='button';b.className='ffterm';b.dataset.term=term;b.textContent='?';
 b.setAttribute('aria-label',(S().termChipLabel||'What does {term} mean?').replace('{term}',t[0]));b.setAttribute('aria-expanded','false');
 b.onclick=e=>{e.preventDefault();e.stopPropagation();const was=pop&&pop.owner===b;closePop(false);if(was)return;
  const p=document.createElement('span');p.className='fftermpop';p.setAttribute('role','note');p.id='ffTermPop';
  p.innerHTML=`<b>${esc(t[0])}</b> ${esc(t[1])} <button type="button" class="ghost small">${esc(S().termClose||'Got it')}</button>`;p.owner=b;b.after(p);pop=p;b.setAttribute('aria-expanded','true');
  p.querySelector('button').onclick=ev=>{ev.preventDefault();ev.stopPropagation();closePop(true)}};return b}
const CHIPS=[['#inpHint','dmc'],['label[for="thAdd"] b','skein'],['#patPaste','legend',true],['#pReady summary','readiness'],['#pReady .ff-rg-review h4, #pReviewH','attention'],
 ['label[for="fcCount"]','count'],['label[for="seStrands"]','strands']];
function chips(){for(const [sel,term,before] of CHIPS){const el=document.querySelector(sel);if(!el||el.dataset.ffchip)continue;
 if(before){const sum=el.closest('details')&&el.closest('details').querySelector('summary');if(!sum||sum.dataset.ffchip)continue;sum.dataset.ffchip='1';const c=chip(term);if(c)sum.append(' ',c);continue}
 el.dataset.ffchip='1';const c=chip(term);if(!c)continue;el.append(' ',c)}}
/* import window: Pip help inside the modal (Ask Pip is behind it) */
function importHelp(){const d=$('ffPatternDialog');if(!d||$('ffImportPip'))return;const h=d.querySelector('.pat-header');if(!h)return;
 const b=document.createElement('button');b.type='button';b.className='ghost';b.id='ffImportPip';b.textContent=S().pipHelpBtn||'Pip, how does this work?';b.setAttribute('aria-expanded','false');
 const box=document.createElement('div');box.id='ffImportPipBox';box.className='ffpipbox';box.hidden=true;box.innerHTML=blockHtml('import');bindBlock(box);
 b.onclick=()=>{box.hidden=!box.hidden;b.setAttribute('aria-expanded',String(!box.hidden))};h.after(b,box)}
/* backup: Pip line inside the backup box */
function backupHelp(){const bx=$('backupBox');if(!bx||$('ffBackupPip'))return;const sum=bx.querySelector('summary');const d=document.createElement('div');d.id='ffBackupPip';d.className='ffpipbox';d.innerHTML=blockHtml('backup');bindBlock(d);sum.after(d)}
/* Fabric page: its own Ask Pip entry (separate page, no tour.js) */
function fabricAsk(){if(screen()!=='fabric'||$('ffFabricAsk'))return;const nav=document.querySelector('.fcnav')||document.querySelector('nav');if(!nav)return;
 const b=document.createElement('button');b.type='button';b.id='ffFabricAsk';b.className='sec ffask';b.textContent=S().askPipFabric||'Ask Pip';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','ffFabricPanel');
 const p=document.createElement('section');p.id='ffFabricPanel';p.className='card ffpipbox';p.hidden=true;p.setAttribute('aria-label','Ask Pip');
 p.innerHTML=`<h2 tabindex="-1">${esc(S().askPipFabric||'Ask Pip')}</h2>${blockHtml('fabric')}<div class="row"><button type="button" class="ghost" data-ffclose>${esc(S().pipHelpClose||'Close')}</button></div>`;
 bindBlock(p);p.querySelector('[data-ffclose]').onclick=()=>{p.hidden=true;b.setAttribute('aria-expanded','false');b.focus()};
 b.onclick=()=>{p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden));if(!p.hidden)p.querySelector('h2').focus()};
 const slot=document.createElement('aside');slot.id='ffFabricPip';slot.className='ffpipslot noprint';slot.setAttribute('aria-label','Pip');
 slot.innerHTML='<picture><source type="image/webp" srcset="assets/pip/pip-needle-160.webp"><img src="assets/pip/pip-needle-160.png" width="64" height="94" alt=""></picture><p class="ffpipline" aria-live="polite"></p>';
 const wrap=document.createElement('div');wrap.className='ffaskrow';wrap.append(slot,b);nav.after(wrap,p);last=null}
function fillStr(){document.querySelectorAll('[data-ffs]').forEach(e=>{const v=S()[e.dataset.ffs];if(v&&e.dataset.ffsDone!==v){e.textContent=v;e.dataset.ffsDone=v}})}

/* Pip strip: the same bubble (text + pose from pip.js) shown under the tab bar on every tab except Find floss, where the full Pip already sits.
   Not interactive (no new touch targets), no animation under reduced motion, follows the Hide Pip preference. */
function strip(){const t=document.querySelector('header .t'),msg=$('pipMsg'),img=$('pipImg');if(!t||!msg)return;let st=$('pipStrip');
 if(!st){st=document.createElement('p');st.id='pipStrip';st.className='pipstrip noprint';st.setAttribute('aria-hidden','true');
  st.innerHTML='<img alt="" width="32" height="32" decoding="async"><span class="pipstripmsg"></span>';t.append(st)}
 const off=vis('convertView')||document.body.classList.contains('pip-hidden-all')||!msg.textContent.trim();st.hidden=off;t.classList.toggle('haspip',!off);t.parentElement.classList.toggle('haspip',!off);if(off)return;
 const tx=msg.textContent.trim(),m=st.querySelector('span');if(m.textContent!==tx){m.textContent=tx;st.classList.remove('pipstrip-in');void st.offsetWidth;st.classList.add('pipstrip-in')}
 const art=(img&&img.dataset.art)||'reassuring',im=st.querySelector('img'),src=`assets/pip/pip-${art}-160.png`;if(im.getAttribute('src')!==src)im.setAttribute('src',src)}
function tick(){try{fillStr();chips();importHelp();backupHelp();fabricAsk();findNext();bubble();bubbleCond();strip()}catch(e){}}
let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;tick()})}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});
document.addEventListener('click',e=>{if(pop&&!pop.contains(e.target))closePop(false);if(e.target.closest&&e.target.closest('nav.tabs,[data-ffgo],#shopBack,#thNext,#openSaved,#pClose'))tick()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pop)closePop(true)});
document.addEventListener('toggle',()=>tick(),true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
window.FFHelp={tabKey,tabNext,tabBody,tabBind,screen,entry,topics,blockHtml,bindBlock,ACTIONS,doNext,chip,tick,bubbleLine:()=>lastKey,_last:()=>last};
})();
