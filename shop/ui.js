/* Floss Fox 2.0A (was 1.5A) "Where to buy your missing supplies" section.
   Read-only adapters turn the canonical plan into needs; FlossFoxOffers.select decides; this file only renders.
   DOM is built with textContent/setAttribute (no innerHTML for merchant or user strings). No trackers, no iframes, no prefetch. */
(function(){
'use strict';
const O=()=>window.FlossFoxOffers,CFG=()=>window.FLOSS_FOX_SHOP,ENV=()=>window.FLOSS_FOX_ENV==='preview'?'preview':'production';
const SPECIAL_WHITE=['WHITE','BLANC','B5200'];
const BN={dmc:'DMC',anchor:'Anchor',sullivans:'Sullivans'};
function familyOf(codes){try{return codes.every(c=>typeof fam==='function'&&fam(c)==='solid')?'six-strand-cotton':'specialty'}catch(e){return'unknown'}}
const dispC=(b,c)=>{try{return typeof disp==='function'?disp(b,c):c}catch(e){return c}};
const labC=c=>{try{return typeof lab==='function'?lab(c):c}catch(e){return c}};
// Quick converter: every grouped line is a need; unresolved colors are review items.
function fromConverter(L){
 const needs=L.lines.map(g=>({brand:L.dest,code:dispC(L.dest,g.to),family:familyOf(g.from),pack:'single-skein',qty:g.qty,assumed:!!g.asm,from:g.from.slice(),
  disputed:g.from.some(c=>SPECIAL_WHITE.includes(String(c).toUpperCase()))&&L.dest!=='dmc'}));
 const review=L.review.map(x=>({label:'DMC '+labC(x.it.code),reason:'unresolved'}));
 return{needs,review,nothing:!needs.length&&!review.length}}
// Saved project: only confirmed "to buy" lines (not bought-awaiting, not have/received). Review items stay review items.
function fromProject(p,P){
 const tb=P.lines.filter(l=>!l.bought);
 const needs=tb.map(l=>({brand:P.dest,code:dispC(P.dest,l.to),family:familyOf(l.from),pack:'single-skein',qty:l.q,from:l.from.slice(),
  assumed:(l.ts||[]).some(t=>typeof asmOf==='function'&&asmOf(t.it)>0),
  disputed:l.from.some(c=>SPECIAL_WHITE.includes(String(c).toUpperCase()))&&P.dest!=='dmc'}));
 const review=P.review.map(x=>({label:'DMC '+labC(x.it.code),reason:x.kind||'review'}));
 return{needs,review,nothing:!needs.length&&!review.length,awaiting:P.lines.length-tb.length}}

const el=(t,a,txt)=>{const e=document.createElement(t);if(a)Object.keys(a).forEach(k=>e.setAttribute(k,a[k]));if(txt!=null)e.textContent=txt;return e};
const REASON={'quantity-unknown':'amount not entered','quantity-assumed':'amount only assumed (1 skein); add the real amount','substitution-unresolved':'substitute not chosen yet','malformed-need':'check this item','not-cotton':'not 6-strand cotton'};
const SVGNS='http://www.w3.org/2000/svg';
function extIcon(){const s=document.createElementNS(SVGNS,'svg');s.setAttribute('class','wtbext');s.setAttribute('viewBox','0 0 16 16');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');
 const p=document.createElementNS(SVGNS,'path');p.setAttribute('d','M9 2h5v5M14 2 7 9M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5');p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.6');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');s.appendChild(p);return s}
function link(L){const a=el('a',{href:L.href,target:'_blank',rel:L.rel,'data-merchant':L.merchantId,'data-level':L.level||'B',class:'wtblink'});
 a.appendChild(el('span',null,L.label));a.appendChild(el('span',{class:'sr'},' (opens the retailer site in a new tab)'));a.appendChild(extIcon());return a}
const initials=n=>{const w=String(n||'').split(/\s+/).filter(Boolean);return((w[0]||'?')[0]+(w.length>1?w[1][0]:(w[0]||'')[1]||'')).toUpperCase()};
const natural=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true});
const famName=n=>{try{const f=n.brand==='dmc'&&typeof fam==='function'?fam(n.code):null;return f&&f!=='solid'?f+' thread':'specialty thread'}catch(e){return'specialty thread'}};
// Optional Pip line: at most one per page, dismissible, never when Pip is hidden. Flag kept next to the Pip key.
const PIPX=()=>(ENV()==='preview'?'flossfox-dev':'flossfox')+'.wtbpip.v1';
function pipLine(box,s,h3){
 try{if(localStorage.getItem(PIPX())==='dismissed')return}catch(e){}
 if(document.body.classList.contains('pip-hidden-all'))return;
 const other=[...document.querySelectorAll('.wtbpip')].some(p=>!box.contains(p));if(other)return;
 const d=el('div',{class:'wtbpip'});d.appendChild(el('img',{src:'assets/pip/pip-face-icon-64.png',width:'32',height:'32',alt:''}));
 d.appendChild(el('span',null,'Need to pick up supplies? Here are some places that carry them. Your list works anywhere.'));
 const x=el('button',{type:'button',class:'wtbpipx','aria-label':'Hide this tip'},'×');
 x.onclick=()=>{try{localStorage.setItem(PIPX(),'dismissed')}catch(e){}d.remove();h3.setAttribute('tabindex','-1');h3.focus()};d.appendChild(x);s.appendChild(d)}
const COPY={converter:'copy',project:'pCopy',shop:'sCopy'};
function altRow(s,ctx){const w=el('div',{class:'wtbalt'});w.appendChild(el('h4',null,'Prefer another store? Copy or print your list'));const r=el('div',{class:'row'});
 const p=el('button',{type:'button',class:'pri'},'Print list');p.onclick=()=>print();
 const c=el('button',{type:'button',class:'sec'},'Copy as text');c.onclick=()=>{const b=document.getElementById(COPY[ctx]||'copy');if(b)b.click()};
 r.appendChild(p);r.appendChild(c);w.appendChild(r);s.appendChild(w)}
const LIVE=new Map();   // box -> [src,opts], so the section can redraw when the connection changes
function render(box,src,opts){
 if(!box)return null;box.textContent='';box.hidden=true;opts=opts||{};LIVE.set(box,[src,opts]);
 if(!O()||!CFG())return null;
 let r;try{r=O().select(src.needs,CFG(),ENV())}catch(e){return null}       // malformed config: shopping layer just stays off
 if(!r.layer)return r;                                                     // no eligible merchant: render nothing at all
 const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
 box.hidden=false;const s=el('section',{class:'wtb noprint','aria-labelledby':box.id+'-h','data-links':String(offline?0:r.linkCount)});
 s.appendChild(el('p',{class:'wtbeyebrow'},'Optional'));const h3=el('h3',{id:box.id+'-h'},'Where to buy your missing supplies');s.appendChild(h3);
 if(src.nothing){s.appendChild(el('p',{class:'hint'},'You have no confirmed items to buy.'));altRow(s,opts.context);box.appendChild(s);return r}
 pipLine(box,s,h3);
 if(r.merchants.some(m=>m.mock))s.appendChild(el('p',{class:'wtbmock'},'Preview only: sample shops with made-up .example addresses. Nothing is tracked and nothing earns a commission.'));
 // group by retailer (render only; r.merchants is already A-Z from the selector)
 const by=new Map(r.merchants.map(m=>[m.merchantId,{m,exact:[],cat:[]}]));
 r.items.forEach(it=>it.links.filter(l=>l.level==='A').forEach(l=>{const g=by.get(l.merchantId);if(g)g.exact.push({...l,code:it.need.code})}));
 r.categories.forEach(c=>{const g=by.get(c.merchantId);if(g)g.cat.push(c)});
 const groups=[...by.values()].filter(g=>g.exact.length||g.cat.length);
 const none=r.items.filter(it=>!it.links.some(l=>l.level==='A')).map(it=>it.need).concat(r.review.map(x=>x.need)).filter(n=>n&&BN[n.brand]).map(n=>`${BN[n.brand]} ${n.code}`);   // no exact link (browse-only, specialty, review), listed by code
 if(offline){s.appendChild(el('p',{class:'wtbnone'},'You\'re offline. Store links need a connection; your list still works.'))}
 else if(groups.length){
  const d=el('p',{class:'affdisc wtbdisc'},'Floss Fox may earn a commission if you buy through these links, at no extra cost to you. ');d.appendChild(el('a',{href:'about.html#affiliates'},'How links work'));s.appendChild(d);
  s.appendChild(el('p',{class:'wtbsort'},'Retailers are listed A to Z.'));
  const ul=el('ul',{class:'wtbstores'});
  groups.forEach(g=>{const li=el('li',{class:'wtbstore','data-merchant':g.m.merchantId}),hd=el('div',{class:'wtbshead'});
   hd.appendChild(el('span',{class:'wtblogo','aria-hidden':'true'},initials(g.m.displayName)));hd.appendChild(el('h4',null,g.m.displayName));
   if(ENV()==='preview')hd.appendChild(el('span',{class:'wtbbadge'},'Preview: not live'));li.appendChild(hd);
   if(g.exact.length){const x=el('ul');g.exact.sort((a,b)=>natural(a.code,b.code)).forEach(l=>{const i=el('li');i.appendChild(link(l));x.appendChild(i)});li.appendChild(x)}
   g.cat.forEach(c=>li.appendChild(link({...c,level:'B'})));
   if(g.cat.length)li.appendChild(el('p',{class:'hint'},'Find your exact colors on the retailer\'s site.'));
   ul.appendChild(li)});
  s.appendChild(ul)}
 if(!offline&&none.length)s.appendChild(el('p',{class:'wtbnone'},'No verified shopping link yet: '+[...new Set(none)].sort(natural).join(', ')));
 const spec=r.items.filter(it=>it.need.family!=='six-strand-cotton').map(it=>({label:`${BN[it.need.brand]} ${it.need.code}`,reason:'not-cotton',kind:famName(it.need)}));
 const rv=src.review.concat(r.review.map(x=>({label:`${BN[x.need.brand]||''} ${x.need.code}`.trim(),reason:x.reason})),spec);
 if(rv.length){const h=el('div',{class:'wtbreview',role:'group','aria-labelledby':box.id+'-rv'});h.appendChild(el('h4',{id:box.id+'-rv'},'Check these items before shopping'));const ul=el('ul');
  rv.forEach(x=>ul.appendChild(el('li',null,`${x.label}: ${x.kind?x.kind+', ':''}${REASON[x.reason]||'needs a check in your list first'}`)));h.appendChild(ul);s.appendChild(h)}
 altRow(s,opts.context);
 box.appendChild(s);return r}
function redraw(){LIVE.forEach((a,box)=>{if(!box.isConnected){LIVE.delete(box);return}render(box,a[0],a[1])})}
if(typeof window!=='undefined'){window.addEventListener('online',redraw);window.addEventListener('offline',redraw)}
window.FlossFoxShop={render,fromConverter,fromProject,
 anyEligible:()=>{try{return!!(O()&&CFG()&&O().select([],CFG(),ENV()).layer)}catch(e){return false}}};
})();
