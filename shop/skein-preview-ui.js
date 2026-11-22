/* Untracked direct store-link shopping row UI. Renders a link under EACH needed DMC color.
 * Takes read-only, already-aggregated requirements from existing Floss Fox planners.
 * Never changes project or inventory state. No affiliate pixels, requests or storage.
 * Only verified exact product pages are shown; unverified colors get no href (optional "not listed" note).
 */
(function(root){
 'use strict';
 const get=()=>root.FlossFoxSkeinPreview;
 const ASSUMED_NOTE='This amount is an estimate, so check your pattern before you buy.'; // placeholder for Pixel
 const DISC="These are plain store links, and Floss Fox doesn't earn anything from them. Before you order, double-check the color, thread type, amount and availability on the store's site.";
 const add=(parent,tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=text;parent.appendChild(e);return e};
 function pill(l){
  const a=document.createElement('a');a.className='ff-skein-pill';a.textContent=l.storeName;
  a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';a.dataset.store=l.storeId;a.dataset.match=l.type||'exact-product';a.dataset.kind='direct';a.dataset.tracked='false';
  a.setAttribute('aria-label',(l.label||('Buy DMC '+(l.code||'')+' at '+l.storeName))+', opens in a new tab');a.title=l.hint||'';
  return a;
 }
 function missingNotes(row,host){
  const S=get();if(!S||!S.stores)return;
  const have=new Set(row.links.map(l=>l.storeId));
  S.stores().forEach(s=>{if(!have.has(s.id))add(host,'small','ff-skein-off','Not listed at '+s.name)});
 }
 function attachPills(host,row,need){
  for(const l of row.links)host.appendChild(pill(l));
  missingNotes(row,host);
  if(need&&(need.assumed||row.assumed)){const m=add(host,'small','ff-skein-asm',ASSUMED_NOTE);m.id='ffAsm-'+row.code+'-'+Math.random().toString(36).slice(2,7);host.setAttribute('aria-describedby',m.id)}
 }
 function disclose(list,offline){
  if(!list||!list.parentElement)return;
  const prev=list.previousElementSibling;
  if(prev&&(prev.classList.contains('ff-skein-direct')||prev.classList.contains('ffstore')))return;
  const p=document.createElement('p');p.className='ff-skein-direct noprint';
  p.textContent=DISC+(offline?' Store pages need a connection.':'');
  list.parentElement.insertBefore(p,list);
 }
 function render(container,needs){
  if(!container||!(root.FLOSS_FOX_ENV==='preview'||root.FLOSS_FOX_DIRECT_LINKS===true)||!get())return 0;
  container.replaceChildren();
  const rows=get().rowsFor(needs,'direct');if(!rows.length)return 0;
  const section=add(container,'section','ff-skein-preview');
  section.setAttribute('aria-label','Test links for individual needed DMC skeins');
  add(section,'h3',null,'Shop the skeins you need');
  add(section,'p','ff-skein-note',DISC);
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
   add(section,'p','ff-skein-note','You\'re offline. Open store links once you\'re back online.');return rows.length;
  }
  const list=add(section,'ul','ff-skein-list');
  for(const row of rows){
   const item=add(list,'li','ff-skein-item');item.dataset.dmc=row.code;
   const head=add(item,'div','ff-skein-head');
   add(head,'strong',null,'DMC '+row.code);
   add(head,'span',null,row.qty+' skein'+(row.qty===1?'':'s')+' to buy');
   if(row.assumed)add(item,'p','ff-skein-asm',ASSUMED_NOTE);
   const actions=add(item,'div','ff-skein-actions');
   for(const l of row.links){
    const a=add(actions,'a','ff-skein-link','Buy at '+l.storeName);
    a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';a.dataset.store=l.storeId;
    a.dataset.match=l.type;a.dataset.kind='direct';a.dataset.tracked='false';
    a.setAttribute('aria-label',l.label+', opens in a new tab');a.title=l.hint;
   }
   if(!row.links.length)add(item,'p','ff-skein-off','Not listed at Hobby Lobby or Everything Cross Stitch yet.');
   else missingNotes(row,actions);
  }
  return rows.length;
 }
 // 2.0A inline: compact pill buttons attached directly to each Need to buy row.
 // items: [{li, need}] in the same order as the list. Returns number of rows that got buttons.
 function clearHost(h){
  if(!h)return;
  if(h.classList.contains('ff-buy-slot')||h.hasAttribute('data-ffbuyhost')){h.replaceChildren();return}
  h.querySelectorAll(':scope > .ff-skein-inline, :scope > .ff-buy-slot').forEach(e=>e.remove());
 }
 function inline(items){
  if(!(root.FLOSS_FOX_ENV==='preview'||root.FLOSS_FOX_DIRECT_LINKS===true)||!get()||!Array.isArray(items))return 0;
  items.forEach(x=>clearHost(x&&(x.li||x.host)));
  const rows=get().rowsFor(items.map(x=>x&&x.need),'direct');
  const by=new Map(rows.map(r=>[r.code,r]));let n=0;
  const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
  for(const x of items){
   const host=x&&(x.li||x.host);if(!host||!x.need)continue;const code=get().normalize(x.need.code);const row=code&&by.get(code);
   if(!row||!row.links.length||!get().eligible(x.need,'direct'))continue;
   const w=add(host,'div','ff-skein-inline noprint');w.dataset.dmc=row.code;
   w.setAttribute('role','group');w.setAttribute('aria-label','Store links for DMC '+row.code);
   attachPills(w,row,x.need);n++;
  }
  if(n){const first=items.find(x=>{const h=x&&(x.li||x.host);return h&&h.querySelector(':scope > .ff-skein-inline')});
  const list=first&&(first.li||first.host).parentElement;
  if(list)disclose(list,offline)}
  return n;
 }
 // Compact Buy control: one tap reveals the verified store links. Use on denser lists (Find floss results, project colors, restock).
 function buyToggle(items,opts){
  if(!(root.FLOSS_FOX_ENV==='preview'||root.FLOSS_FOX_DIRECT_LINKS===true)||!get()||!Array.isArray(items))return 0;
  opts=opts||{};
  items.forEach(x=>clearHost(x&&(x.li||x.host)));
  const rows=get().rowsFor(items.map(x=>x&&x.need),'direct');
  const by=new Map(rows.map(r=>[r.code,r]));let n=0;
  const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
  const prefix=opts.prefix||'ffBuy';
  for(const x of items){
   const host=x&&(x.li||x.host);if(!host||!x.need)continue;const code=get().normalize(x.need.code);const row=code&&by.get(code);
   if(!row||!row.links.length||!get().eligible(x.need,'direct'))continue;
   const slot=host.classList.contains('ff-buy-slot')||host.hasAttribute('data-ffbuyhost')?host:add(host,'div','ff-buy-slot noprint');
   if(!slot.classList.contains('ff-buy-slot'))slot.className=(slot.className+' ff-buy-slot noprint').trim();
   const id=(prefix+'-'+row.code).replace(/[^A-Za-z0-9_-]/g,'_');
   const btn=add(slot,'button','sec small ffcf-buybtn','Buy');
   btn.type='button';btn.setAttribute('data-ffbuy',id);btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',id);
   btn.setAttribute('aria-label','Buy DMC '+row.code+': choose a store');
   const w=add(slot,'div','ff-skein-inline ffsm-buy noprint');w.id=id;w.dataset.dmc=row.code;w.hidden=true;
   w.setAttribute('role','group');w.setAttribute('aria-label','Store links for DMC '+row.code);
   attachPills(w,row,x.need);n++;
  }
  if(n&&opts.disclose!==false){
   const list=opts.list||(function(){const first=items.find(x=>{const h=x&&(x.li||x.host);return h&&h.querySelector('.ffcf-buybtn')});const h=first&&(first.li||first.host);return h&&(h.closest('ul')||h.closest('table')||h.parentElement)})();
   if(list)disclose(list,offline);
  }
  return n;
 }
 if(typeof document!=='undefined'&&!root.__ffBuyToggleBound){
  root.__ffBuyToggleBound=true;
  document.addEventListener('click',e=>{
   const b=e.target&&e.target.closest&&e.target.closest('[data-ffbuy]');if(!b)return;
   const c=document.getElementById(b.getAttribute('data-ffbuy'));if(!c)return;
   const o=c.hidden;c.hidden=!o;b.setAttribute('aria-expanded',String(o));
   if(o){const a=c.querySelector('a');if(a)a.focus({preventScroll:true})}
  });
 }
 root.FlossFoxSkeinPreviewUI=Object.freeze({render,inline,buyToggle,pill});
})(typeof window!=='undefined'?window:null);
