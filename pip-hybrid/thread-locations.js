/* Floss Fox: local-only thread storage locations. No requests, no external code,
 * no inventory mutations except explicit user-approved storage metadata edits.
 * Single primary location per DMC color (not per individual skein).
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.FlossFoxThreadLocationsUI=api;if(typeof document!=='undefined')api.enhance();}
})(typeof window!=='undefined'?window:globalThis,function(root){
'use strict';
const MEDIUM={bobbin:'Bobbin',skein:'Skein',bag:'Bag',other:'Other'};
const key=(code,demo)=>`${demo?'demo:':'real:'}${code}`;
function getAPI(){return root.FlossFoxThreadsUI||null}
function normalize(storage,api){const core=api?.core?.normalizeStorage;return typeof core==='function'?core(storage):null}
function storageText(s){if(!s)return '';return [s.container,s.slot,s.medium?MEDIUM[s.medium]||'':''].filter(Boolean).join(' · ')}
function enhance(){
 if(typeof document==='undefined')return;
 const api=getAPI(),host=document.getElementById('thList');
 if(!api||!host)return;
 // Restore only after a successful render; no persisted UI state.
 host.querySelectorAll('li.th[data-code]').forEach(li=>{
  if(li.querySelector('.ff-storage'))return;
  const code=li.dataset.code,demo=li.dataset.m==='d',entry=(demo?api.data().demo||{}:api.data().threads||{})[code];
  if(!entry)return;
  const s=normalize(entry.storage,api);
  // Location is searchable via the existing find-a-color filtering logic.
  const base=li.dataset.q||'';li.dataset.q=[base,storageText(s)].join(' ').toLowerCase();
  const details=document.createElement('details');details.className='ff-storage';details.dataset.for=key(code,demo);
  const summary=document.createElement('summary');summary.textContent=s?'Stored: '+storageText(s):'Add a storage location';details.append(summary);
  const fieldset=document.createElement('div');fieldset.className='ff-storage-fields';
  function field(label,id,max,value){
   const wrap=document.createElement('label');wrap.className='ff-storage-field';wrap.textContent=label;
   const input=document.createElement('input');input.type='text';input.maxLength=max;input.value=value||'';input.id=`ff-${id}-${demo?'d-':''}${code.replace(/[^a-zA-Z0-9]/g,'_')}`;wrap.append(input);fieldset.append(wrap);return input;
  }
  const container=field('Box, binder, drawer or bag','container',60,s?.container);
  const slot=field('Section, row or compartment','slot',40,s?.slot);
  const mw=document.createElement('label');mw.className='ff-storage-field';mw.textContent='Stored as';
  const medium=document.createElement('select');medium.setAttribute('aria-label',`Storage format for DMC ${code}`);
  for(const [value,label] of [['','Not specified'],...Object.entries(MEDIUM)]){const o=document.createElement('option');o.value=value;o.textContent=label;medium.append(o)}
  medium.value=s?.medium||'';mw.append(medium);fieldset.append(mw);
  const buttons=document.createElement('div');buttons.className='ff-storage-actions';
  const save=document.createElement('button');save.type='button';save.className='sec';save.textContent='Save location';
  const clear=document.createElement('button');clear.type='button';clear.className='ghost';clear.textContent='Clear location';
  const info=document.createElement('p');info.className='hint';info.textContent='One storage location per color. Skein counts and partial-skein ticks don\'t change.';
  const canSave=api.canSave();save.disabled=!canSave;clear.disabled=!canSave||!s;
  if(!canSave)info.textContent='Saving is paused for this collection. Existing data will not be changed.';
  function commit(remove){
   const before=api.data(),e=(demo?before.demo||{}:before.threads||{})[code];
   if(!e||!api.canSave())return;
   const candidate=remove?null:normalize({container:container.value,slot:slot.value,medium:medium.value},api);
   if(!remove&&!candidate){document.getElementById('thStatus').textContent='Enter a box, slot or storage format, or choose Clear location.';return}
   // A null value explicitly clears an existing location. No change to n, confirmed or partial.
   if(typeof api.setStorageLocation==='function'){
    const r=api.setStorageLocation(code,candidate,{demo});
    if(!r?.ok){const st=document.getElementById('thStatus');if(st)st.textContent=`DMC ${code}: ${r?.error||'Location was not saved.'}`;return}
   }else{
    // Compatibility with pre-Sprint4 fixture and older development versions.
    // Only the new atomic API guarantees save success; never silently assume that fallback writes persisted.
    api.set(code,{storage:candidate,updated:new Date().toISOString()},{demo});
   }
   const updated=document.getElementById('thList')?.querySelector(`li.th[data-code="${CSS.escape(code)}"]${demo?'[data-m="d"]':':not([data-m="d"])'}`);
   if(updated){const d=updated.querySelector('.ff-storage');if(d){d.open=true;d.querySelector('summary')?.focus()}}
   const st=document.getElementById('thStatus');if(st)st.textContent=`DMC ${code} storage ${candidate?'saved':'cleared'}${demo?' (demo entry)':''}. Your skein count was not changed.`;
  }
  save.addEventListener('click',()=>commit(false));clear.addEventListener('click',()=>commit(true));
  buttons.append(save,clear);details.append(fieldset,buttons,info);li.append(details);
 });
 const finder=document.getElementById('thSearch');if(finder&&!finder.dataset.ffStorage){
  finder.dataset.ffStorage='1';finder.placeholder='Find DMC 310, Box 2, Row B…';
 }
 if(finder&&finder.value.trim())finder.dispatchEvent(new Event('input',{bubbles:true}));
}
return Object.freeze({enhance,storageText});
});
