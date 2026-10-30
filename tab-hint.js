/* Tab row scroll hint (phones): soft edge fade + small chevron on the side(s) that have more tabs.
 * Visual only: CSS pseudo-elements, so not in the accessibility tree or tab order (keyboard focus already scrolls tabs into view). Writes no data. */
(function(){
 'use strict';
 const nav=document.querySelector('nav.tabs');if(!nav)return;
 if(nav.dataset.tabhint)return;nav.dataset.tabhint='1';
 const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function upd(){const max=nav.scrollWidth-nav.clientWidth,x=Math.abs(nav.scrollLeft),over=max>2;
  nav.classList.toggle('th-l',over&&x>2);nav.classList.toggle('th-r',over&&x<max-2)}
 const step=dir=>nav.scrollBy({left:dir*Math.max(80,nav.clientWidth*0.6),behavior:reduce()?'auto':'smooth'});
 // The fades are ::before/::after on the nav, so a tap on them targets the nav itself (never a tab).
 nav.addEventListener('click',e=>{if(e.target!==nav)return;const r=nav.getBoundingClientRect();
  if(nav.classList.contains('th-l')&&e.clientX<r.left+30)step(-1);else if(nav.classList.contains('th-r')&&e.clientX>r.right-30)step(1)});
 nav.addEventListener('scroll',upd,{passive:true});window.addEventListener('resize',upd);
 if(window.ResizeObserver)new ResizeObserver(upd).observe(nav);
 window.addEventListener('load',upd);upd();
 window.FlossFoxTabHint={update:upd};
})();
