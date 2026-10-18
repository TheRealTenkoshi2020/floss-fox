/* Untracked preview-only shopping row UI. Renders a link under EACH needed DMC color.
 * Takes read-only, already-aggregated requirements from existing Floss Fox planners.
 * Never changes project or inventory state. No affiliate pixels, requests or storage.
 */
(function(root){
 'use strict';
 const get=()=>root.FlossFoxSkeinPreview;
 const add=(parent,tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=text;parent.appendChild(e);return e};
 function render(container,needs){
  if(!container||!(root.FLOSS_FOX_ENV==='preview'||root.FLOSS_FOX_DIRECT_LINKS===true)||!get())return 0;
  container.replaceChildren();
  const rows=get().rowsFor(needs,'direct');if(!rows.length)return 0;
  const section=add(container,'section','ff-skein-preview');
  section.setAttribute('aria-label','Test links for individual needed DMC skeins');
  add(section,'h3',null,'Shop the skeins you need');
  add(section,'p','ff-skein-note','Untracked test links only. Verify the color, thread type, quantity and availability on the retailer website before ordering.');
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
   add(section,'p','ff-skein-note','You\'re offline. Open store links once you\'re back online.');return rows.length;
  }
  const list=add(section,'ul','ff-skein-list');
  for(const row of rows){
   const item=add(list,'li','ff-skein-item');item.dataset.dmc=row.code;
   const head=add(item,'div','ff-skein-head');
   add(head,'strong',null,'DMC '+row.code);
   add(head,'span',null,row.qty+' skein'+(row.qty===1?'':'s')+' to buy');
   const actions=add(item,'div','ff-skein-actions');
   for(const l of row.links){
    const a=add(actions,'a','ff-skein-link',l.exact?'View skein · '+l.storeName:'Find color · '+l.storeName);
    a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';a.dataset.store=l.storeId;
    a.dataset.match=l.type;
    a.setAttribute('aria-label',l.label+' (opens in new tab)');
    a.title=l.hint;
    if(!l.exact)add(a,'small',null,'Catalog / quick order: enter '+row.code);
   }
  }
  return rows.length;
 }
 // 2.0A inline: compact pill buttons attached directly to each Need to buy row.
 // items: [{li, need}] in the same order as the list. Returns number of rows that got buttons.
 function inline(items){
  if(!(root.FLOSS_FOX_ENV==='preview'||root.FLOSS_FOX_DIRECT_LINKS===true)||!get()||!Array.isArray(items))return 0;
  items.forEach(x=>{if(x&&x.li)x.li.querySelectorAll(':scope > .ff-skein-inline').forEach(e=>e.remove())});
  const rows=get().rowsFor(items.map(x=>x&&x.need),'direct');
  const by=new Map(rows.map(r=>[r.code,r]));let n=0;
  const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
  for(const x of items){
   if(!x||!x.li||!x.need)continue;const code=get().normalize(x.need.code);const row=code&&by.get(code);
   if(!row||!row.links.length||!get().eligible(x.need,'direct'))continue;
   const w=add(x.li,'div','ff-skein-inline noprint');w.dataset.dmc=row.code;
   w.setAttribute('role','group');w.setAttribute('aria-label','Store links for DMC '+row.code+' (untracked test links)');
   for(const l of row.links){
    const a=add(w,'a','ff-skein-pill',(l.exact?'View skein':'Find color')+' · '+l.storeName);
    a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';a.dataset.store=l.storeId;a.dataset.match=l.type;a.dataset.kind='direct';a.dataset.tracked='false';
    a.setAttribute('aria-label',l.label+' (opens in new tab)');a.title=l.hint;
   }
   n++;
  }
  // One short disclosure per list: these are direct (untracked) links, kept apart from any future affiliate path.
  const first=items.find(x=>x&&x.li&&x.li.querySelector(':scope > .ff-skein-inline'));
  const list=first&&first.li.parentElement;
  if(list&&list.parentElement){const prev=list.previousElementSibling;
   if(!(prev&&prev.classList.contains('ff-skein-direct'))){const p=document.createElement('p');p.className='ff-skein-direct noprint';p.textContent='Direct store links. Floss Fox earns nothing from these.'+(offline?' Store pages need a connection.':'');list.parentElement.insertBefore(p,list)}}
  return n;
 }
 root.FlossFoxSkeinPreviewUI=Object.freeze({render,inline});
})(typeof window!=='undefined'?window:null);
