/* Floss Fox 1.5A "Where to buy your missing supplies" section.
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
const REASON={'quantity-unknown':'amount not entered','quantity-assumed':'amount only assumed (1 skein); add the real amount','substitution-unresolved':'substitute not chosen yet','malformed-need':'check this item'};
function link(L){const a=el('a',{href:L.href,target:'_blank',rel:L.rel,'data-merchant':L.merchantId,'data-level':L.level||'B',class:'wtblink'},L.label);
 a.appendChild(el('span',{class:'sr'},' (opens the retailer site in a new tab)'));return a}

function render(box,src,opts){
 if(!box)return null;box.textContent='';box.hidden=true;opts=opts||{};
 if(!O()||!CFG())return null;
 let r;try{r=O().select(src.needs,CFG(),ENV())}catch(e){return null}       // malformed config: shopping layer just stays off
 if(!r.layer)return r;                                                     // no eligible merchant: render nothing at all
 box.hidden=false;const s=el('section',{class:'wtb noprint','aria-labelledby':box.id+'-h','data-links':String(r.linkCount)});
 s.appendChild(el('h3',{id:box.id+'-h'},'Where to buy your missing supplies'));
 if(src.nothing){s.appendChild(el('p',{class:'hint'},'You have no confirmed items to buy.'));box.appendChild(s);return r}
 if(r.linkCount){const d=el('p',{class:'affdisc wtbdisc'},'Floss Fox may earn a commission if you buy through these links, at no extra cost to you. ');
  const m=el('a',{href:'about.html#affiliates'},'How links work');d.appendChild(m);s.appendChild(d)}
 if(r.merchants.some(m=>m.mock))s.appendChild(el('p',{class:'wtbmock'},'Preview only: sample shops with made-up .example addresses. Nothing is tracked and nothing earns a commission.'));
 if(r.categories.length){const c=el('div',{class:'wtbcats'});r.categories.forEach(k=>c.appendChild(link({...k,level:'B'})));
  c.appendChild(el('p',{class:'hint'},'Find your exact colors on the retailer\'s site.'));s.appendChild(c)}
 if(r.items.length){const ul=el('ul',{class:'wtblist'});
  r.items.forEach(it=>{const n=it.need,li=el('li',{'data-code':n.code});
   li.appendChild(el('b',null,`${BN[n.brand]} ${n.code}`));li.appendChild(document.createTextNode(` × ${n.qty}`));
   li.appendChild(el('small',{class:'mut'},` (for DMC ${n.from.map(labC).join(', ')})`));
   if(n.from.length>1)li.appendChild(el('div',{class:'warn small'},`⚠ ${n.from.length} pattern colors share this thread.`));
   const ex=it.links.filter(l=>l.level==='A');
   if(ex.length){const w=el('div',{class:'wtbrow'});ex.forEach(l=>w.appendChild(link(l)));li.appendChild(w)}
   else li.appendChild(el('div',{class:'hint'},it.note==='browse'?'No exact product link. Use a browse link above and check the color.':'No verified shopping link for this item yet.'));
   ul.appendChild(li)});s.appendChild(ul)}
 const rv=src.review.concat(r.review.map(x=>({label:`${BN[x.need.brand]||''} ${x.need.code}`.trim(),reason:x.reason})));
 if(rv.length){const h=el('div',{class:'wtbreview'});h.appendChild(el('p',null,'Check these items before shopping.'));const ul=el('ul');
  rv.forEach(x=>ul.appendChild(el('li',null,`${x.label}: ${REASON[x.reason]||'needs a check in your list first'}`)));h.appendChild(ul);s.appendChild(h)}
 s.appendChild(el('p',{class:'hint'},'Prefer another store? Your list works anywhere: print it or copy it. Links open the retailer\'s own site, which may set its own cookies.'));
 box.appendChild(s);return r}
window.FlossFoxShop={render,fromConverter,fromProject,
 anyEligible:()=>{try{return!!(O()&&CFG()&&O().select([],CFG(),ENV()).layer)}catch(e){return false}}};
})();
