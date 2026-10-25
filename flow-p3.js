/* Floss Fox flow phase 3: the screen itself shows the next step.
   - One primary (filled) button per screen, chosen from the current state. Other main buttons on that screen become secondary.
   - Empty states sit next to the controls they explain.
   - Every disabled control gets a short reason next to it (aria-describedby).
   Display only: never reads or writes saved data, storage keys or the schema. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const vis=e=>!!(e&&(e.offsetParent||e.getClientRects().length));
const T={ /* minimal plain wording, listed for Pixel in /workspace/flow-p3/STRINGS_FOR_PIXEL.md */
 thEmpty:'No threads here yet. Type the DMC numbers you own in the box above, then tap Add to my collection.',
 shopPick:'Pick a project above to see what goes in its basket.',
 undoWhy:'Nothing to undo yet.',
 clearWhy:'No location saved yet.',
 overWhy:'On Aida, you always stitch over 1 square.',
 importWhy:'Choose a PDF or paste a color key first.',
 fileName:'Choose a PDF',pasteName:'Pattern color key'};
const hide=(e,v)=>{if(e&&e.hidden!==v)e.hidden=v};
/* swap without the color transition, so the button never shows a half-faded (low-contrast) state */
function swap(el,add,rem){if(el.classList.contains(add)&&!el.classList.contains(rem))return;el.style.transition='none';el.classList.add(add);el.classList.remove(rem);void el.offsetWidth;requestAnimationFrame(()=>{el.style.transition=''})}
function setPri(el,on){if(!el)return;if(on)swap(el,'pri','sec');else if(el.classList.contains('pri'))swap(el,'sec','pri')}
/* make `pick` the only primary among `group` (elements that are missing or hidden are skipped) */
function one(group,pick){group.filter(Boolean).forEach(e=>setPri(e,e===pick));if(pick)pick.dataset.ffPrimary='1';group.filter(e=>e&&e!==pick).forEach(e=>{delete e.dataset.ffPrimary})}
function note(el,id,text,show){if(!el)return;let n=$(id);if(!n){n=document.createElement('small');n.id=id;n.className='hint ffwhy';el.after(n)}if(n.textContent!==text)n.textContent=text;hide(n,!show);
 const d=(el.getAttribute('aria-describedby')||'').split(' ').filter(x=>x&&x!==id);if(show)d.push(id);if(d.length)el.setAttribute('aria-describedby',d.join(' '));else el.removeAttribute('aria-describedby')}
function convert(){const inp=$('inp'),go=$('go'),imp=document.querySelector('#convertView .pat-launch');if(!go)return;
 const has=!!(inp&&inp.value.trim());one([go,imp],has?go:imp);
 const r=$('results');if(r&&!r.hidden){const pr=document.querySelector('#shopcard button[onclick="print()"]');one([pr,$('findNextBtn'),$('saveProj')],$('saveProj'))}}
function threads(){const add=$('thAddBtn'),nx=$('thNext');if(!add)return;const list=$('thList');const n=list?list.querySelectorAll(':scope > li:not(.noresults)').length:0;
 const typed=!!(($('thAdd')||{}).value||'').trim();one([add,nx],(!n||typed)?add:nx);
 note(list,'thEmptyMsg',T.thEmpty,!n&&!($('thSearch')&&$('thSearch').value));}
function projects(){const card=$('projListCard');if(!card||!vis(card))return;
 const last=$('projOpenLast'),ei=$('emptyImport');const others=[...card.querySelectorAll('button.pri')].filter(b=>!b.closest('#restorePanel,#backupBox,.ffconfirm'));
 one([...new Set([last,ei,...others])],vis(last)?last:(vis(ei)?ei:null))}
function project(){const E=$('projEdit');if(!E||E.hidden||!$('pThreads'))return;
 const shop=$('pShop'),nr=document.querySelector('#pNextReady button'),nx=$('pNext'),pr=$('pPrint'),ns=$('ns-0');
 const unchecked=!!$('pAllBuy')&&!$('pAllBuy').hidden,toBuy=+((($('sBuy')||{}).textContent)||0),ready=($('pSummary')||{}).dataset&&$('pSummary').dataset.ready==='true';
 const apply=$('pAutoApply'),use=$('pUseColl');
 let pick=null;if(vis(apply))pick=apply;else if(unchecked&&vis(use))pick=use;else if(!unchecked&&toBuy>0)pick=shop;else if(!ready&&ns)pick=ns;
 one([shop,nr,nx,pr,ns,use,apply],pick);
 const t=$('pTitle'),n=$('pName');if(t&&n&&document.activeElement===n&&t.textContent!==n.value)t.textContent=n.value}
function shop(){const v=$('shopView');if(!v||v.hidden)return;const empty=$('shopEmpty'),pick=$('shopPick');if(!empty)return;
 const choose=!!(pick&&!pick.value&&!empty.hidden);
 ['shopEmptyImport','shopEmptyPaste'].forEach(id=>{hide($(id),choose)});
 const h=empty.querySelector('h2'),p=empty.querySelector('p');hide(h,choose);hide(p,choose);
 note(empty.querySelector('.row'),'shopPickMsg',T.shopPick,choose);if($('shopPickMsg')){const m=$('shopPickMsg');if(m.parentElement!==empty||m.nextElementSibling!==empty.querySelector('.row'))empty.insertBefore(m,empty.querySelector('.row'))}
 one([$('shopEmptyImport'),$('shopEmptyPaste'),$('shopGoProj')],choose?null:$('shopEmptyImport'))}
function disabled(){const u=$('ffBulkUndo');if(u)note(u,'ffBulkUndoWhy',T.undoWhy,u.disabled&&vis(u));
 document.querySelectorAll('.ff-storage-actions').forEach((r,i)=>{const c=[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Clear location');if(!c)return;const paused=r.querySelector('button')&&r.querySelector('button').disabled;if(!c.id)c.id='ffClearLoc'+i;note(c,c.id+'Why',T.clearWhy,c.disabled&&!paused)});
 const o=$('seOver');if(o)note(o,'seOverWhy',T.overWhy,o.disabled);
 const ci=$('patImport'),pw=$('patWhy');if(ci&&pw){const d=(ci.getAttribute('aria-describedby')||'');if(!/\bpatWhy\b/.test(d))ci.setAttribute('aria-describedby',(d+' patWhy').trim());note(pw,'patImportWhy',T.importWhy,ci.disabled&&!pw.textContent.trim())}
 const f=$('patFile');if(f&&!f.getAttribute('aria-label'))f.setAttribute('aria-label',T.fileName);
 const pa=$('patPaste');if(pa&&!pa.getAttribute('aria-label'))pa.setAttribute('aria-label',T.pasteName)}
let busy=false;function run(){if(busy)return;busy=true;try{convert();threads();projects();project();shop();disabled()}catch(e){}finally{busy=false}}
let q=0;const kick=()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;run()})};
new MutationObserver(kick).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','open']});
document.addEventListener('input',kick,true);document.addEventListener('change',kick,true);
/* jump links into folded sections open them first */
document.addEventListener('click',e=>{const a=e.target&&e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;const t=document.getElementById(a.getAttribute('href').slice(1));const d=t&&t.closest('details');if(d&&!d.open)d.open=true},true);
/* printing shows every folded project section, then puts them back */
let shut=[];addEventListener('beforeprint',()=>{shut=[...document.querySelectorAll('#projEdit details:not([open]),#shopBody details.psec:not([open])')];shut.forEach(d=>d.open=true)});
addEventListener('afterprint',()=>{shut.forEach(d=>d.open=false);shut=[]});
window.FlossFoxFlowP3={run,T};run();
})();
