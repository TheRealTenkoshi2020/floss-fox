/* Calm pass (layout only). Folds secondary tools behind native details toggles so each screen leads
   with its main actions. Moves existing nodes only: no data, storage or backup changes. Anything that
   scrolls to, focuses or opens a control inside a folded section unfolds it first, so deep links,
   search and guided steps still land. */
(function(){'use strict';
const d=document,$=id=>d.getElementById(id);
function openUp(el){let x=el&&el.closest?el.closest('details.ffcalm:not([open])'):null;while(x){x.open=true;x=x.parentElement&&x.parentElement.closest('details.ffcalm:not([open])')}}
const sv=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(){openUp(this);return sv.apply(this,arguments)};
const fo=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(){openUp(this);return fo.apply(this,arguments)};
d.addEventListener('toggle',e=>{const t=e.target;if(t&&t.open&&t.parentElement)openUp(t.parentElement)},true);
d.addEventListener('focusin',e=>openUp(e.target),true);
function hashOpen(){const h=location.hash.slice(1);if(!h)return;let t=null;try{t=$(decodeURIComponent(h))}catch(_){}if(t)openUp(t)}
addEventListener('hashchange',hashOpen);
function fold(id,title,sub,after){let w=$(id);if(!w){if(!after||!after.parentElement)return null;w=d.createElement('details');w.id=id;w.className='ffcalm noprint';const s=d.createElement('summary');s.textContent=title;if(sub){const m=d.createElement('small');m.className='mut ffcalm-sub';m.textContent=sub;s.append(' ',m)}w.append(s);after.after(w)}return w}
function put(w,nodes){if(!w)return;for(const n of nodes)if(n&&n.parentElement&&!w.contains(n))w.append(n);const kids=[...w.children].filter(c=>c.tagName!=='SUMMARY');const hide=!kids.length||kids.every(c=>c.hidden);if(w.hidden!==hide)w.hidden=hide}
let busy=false;
function arrange(){if(busy)return;busy=true;try{
 const card=$('thCard'),q=card&&card.querySelector('.thquick');
 if(q){put(fold('thMoreAdd','Add many threads at once','Import a list, photograph or scan threads, choose colors, review a list',q),[q.querySelector('.thmore'),card.querySelector('.ffau-import'),$('ffSmartStash')])}
 const tools=$('thTools');
 if(tools&&($('ffLibTools')||$('ffBulkPanel'))){put(fold('thMoreView','View, sort and organize','List or grid, sort, running low, storage',tools),[$('ffLibTools'),card&&card.querySelector('label.ff-bulk-browse'),$('ffBulkPanel')])}
 const foot=$('shopFoot');
 if(foot&&($('ffauShopStart')||$('shopSeveral'))){let w=$('shopMoreTrip');if(!w){w=fold('shopMoreTrip','Shopping for several projects','Combined list and planning',foot.firstElementChild||foot);if(w&&w.parentElement!==foot)foot.prepend(w)}put(w,[$('ffauShopStart'),$('shopSeveral')])}
}finally{busy=false}}
let tm=0;const later=()=>{if(!tm)tm=setTimeout(()=>{tm=0;arrange()},0)};
function start(){arrange();hashOpen();new MutationObserver(later).observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start);else start();
window.FlossFoxCalm={arrange,openUp};
})();
