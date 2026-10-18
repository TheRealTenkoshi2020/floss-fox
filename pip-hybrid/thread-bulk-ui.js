/* Floss Fox: bulk organize existing DMC collection — entirely browser-local.
 * One primary storage location PER COLOR, not per skein. No network, no AI, no demo edits.
 */
(function(root){'use strict';
const $=id=>document.getElementById(id),K=root.FlossFoxBulkStorageCore;
if(!K||typeof document==='undefined')return;
const selected=new Set();let preview=null,scope='*';
const API=()=>root.FlossFoxThreadsUI;
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n}
function button(txt,fn,cls='sec'){const b=node('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b}
function realRows(){return [...document.querySelectorAll('#thList li.th[data-code]:not([data-m="d"])')]}
function getRowEntry(li){return API()?.data()?.threads?.[li.dataset.code]||null}
function storage(e){return K.normalize(e?.storage)}
function selectValue(s){return String(s||'').toLocaleLowerCase('en-US')}
function findScopeOptions(){const names=new Map();let empty=false;
 for(const e of Object.values(API()?.data()?.threads||{})){const s=storage(e);if(!s?.container)empty=true;else if(!names.has(selectValue(s.container)))names.set(selectValue(s.container),s.container)}
 return {names:[...names.entries()].sort((a,b)=>a[1].localeCompare(b[1])),empty};
}
function rebuildScopes(){const select=$('ffBulkScope');if(!select)return;
 const previous=scope,options=findScopeOptions();select.replaceChildren();
 for(const [value,label] of [['*','All storage locations'],['?','No container assigned'],...options.names.map(([k,v])=>['box:'+k,v])]){
  const o=node('option',null,label);o.value=value;select.append(o)}
 scope=[...select.options].some(o=>o.value===previous)?previous:'*';select.value=scope;
}
function activeFilter(){const b=document.querySelector('#thFilt [aria-pressed="true"]');return b?.dataset.show||'all'}
function updateVisibility(){const search=$('thSearch')?.value.trim().toLowerCase().replace(/^dmc\s*/,'')||'',status=activeFilter();let visible=0;
 document.querySelectorAll('#thList li.th[data-code]').forEach(li=>{
  const e=getRowEntry(li)||((API()?.data()?.demo||{})[li.dataset.code]);const loc=storage(e);
  const code=li.dataset.code||'';
  const passesSearch=!search||(li.dataset.q||'').toLowerCase().includes(search)||code.toLowerCase()===search;
  const passesStatus=status==='all'||status==='restock'&&!!e?.restock||status==='out'&&(!e?.n&&!e?.partial);
  const passesScope=scope==='*'||(li.dataset.m!=='d'&&(scope==='?'?!loc?.container:selectValue(loc?.container)==scope.slice(4)));
  li.hidden=!(passesSearch&&passesStatus&&passesScope);
  if(!li.hidden)visible++;
 });
 const demoHeader=$('thDemoHead');if(demoHeader)demoHeader.hidden=scope!=='*'||!!search||status!=='all';
 const no=$('thNoRes');if(no){no.hidden=visible!==0;no.textContent=visible===0?'No threads match these search and storage filters.':''}
 return visible;
}
function clearReview(){preview=null;const target=$('ffBulkPreview');if(target){target.hidden=true;target.replaceChildren()}}
function setMessage(s){const n=$('ffBulkMessage');if(n)n.textContent=s}
function toggleSelectionUI(){const panel=$('ffBulkPanel'),on=!!panel?.open;
 realRows().forEach(li=>{
  const lbl=li.querySelector('.ff-bulk-pick');if(lbl)lbl.hidden=!on;
 });
 if(on)rebuildSelectionUI();
}
function selectionChanged(){clearReview();rebuildSelectionUI()}
function rebuildSelectionUI(){const count=$('ffBulkCount');if(count){const hidden=realRows().filter(li=>selected.has(li.dataset.code)&&li.hidden).length;
 count.textContent=`${selected.size} selected${hidden?` (${hidden} outside the current filter)`:''}. Demo threads aren't included.`;}
 for(const li of realRows()){
  const cb=li.querySelector('.ff-bulk-pick input');if(cb)cb.checked=selected.has(li.dataset.code);
 }
 const all=$('ffBulkUndo');if(all)all.disabled=!API()?.bulkCanUndo?.();
}
function buildPicker(li){if(li.querySelector('.ff-bulk-pick'))return;const code=li.dataset.code;
 const label=node('label','ff-bulk-pick');label.hidden=!$('ffBulkPanel')?.open;
 const input=node('input');input.type='checkbox';input.checked=selected.has(code);input.setAttribute('aria-label',`Select DMC ${code} to organize`);
 input.addEventListener('change',()=>{if(input.checked){if(selected.size>=K.MAX_SELECTED){input.checked=false;setMessage(`Select at most ${K.MAX_SELECTED} colors.`);return}selected.add(code)}else selected.delete(code);selectionChanged()});
 label.append(input,node('span',null,'Select to organize'));
 const loc=li.querySelector('.ff-storage');if(loc)loc.before(label);else li.append(label);
}
function field(parent,labelText,id,type='text',max=60){const l=node('label',null,labelText),el=node(type);el.id=id;
 if(type==='input'){el.type='text';el.maxLength=max;el.autocomplete='off'}l.append(el);parent.append(l);return el}
function populate(){const view=$('threadsView');if(!view||!API())return;
 const tools=$('thTools');if(!tools)return;
 if(!$('ffBulkScope')){const label=node('label','ff-bulk-browse','Browse by storage container');const sel=node('select');sel.id='ffBulkScope';label.append(sel);
 sel.addEventListener('change',()=>{scope=sel.value;clearReview();updateVisibility();rebuildSelectionUI()});tools.after(label)}
 if(!$('ffBulkPanel')){
  const p=node('details','ff-bulk');p.id='ffBulkPanel';const summary=node('summary',null,'Organize several colors');p.append(summary);
  p.append(node('p',null,'Pick colors below, review the storage changes, then confirm. Skein counts, partial skeins and shopping choices won\'t change. Demo colors can\'t be selected.'));
  const actions=node('div','ff-bulk-actions');
  actions.append(button('Select visible colors',()=>{const codes=realRows().filter(li=>!li.hidden).map(li=>li.dataset.code);if(selected.size+codes.filter(c=>!selected.has(c)).length>K.MAX_SELECTED){setMessage('Too many colors selected. Narrow your search first.');return}codes.forEach(c=>selected.add(c));selectionChanged()}));
  actions.append(button('Unselect visible',()=>{realRows().filter(li=>!li.hidden).forEach(li=>selected.delete(li.dataset.code));selectionChanged()},'ghost'));
  actions.append(button('Clear all selections',()=>{selected.clear();selectionChanged()},'ghost'));p.append(actions);
  const count=node('p',null,'0 selected');count.id='ffBulkCount';p.append(count);
  const grid=node('div','ff-bulk-grid');
  const actionLabel=node('label',null,'What should change?'),action=node('select');action.id='ffBulkMode';
  for(const [v,label] of [['replace','Replace complete location'],['move','Move to a different container (keep slot and format)'],['clear','Clear storage locations']]){const o=node('option',null,label);o.value=v;action.append(o)}
  actionLabel.append(action);grid.append(actionLabel);
  const container=field(grid,'Container (e.g. Box 2)','ffBulkContainer','input',60);
  const slot=field(grid,'Slot, section or row','ffBulkSlot','input',40);
  const ml=node('label',null,'Stored as'),medium=node('select');medium.id='ffBulkMedium';for(const [v,l] of [['','Not specified'],['bobbin','Bobbin'],['skein','Skein'],['bag','Bag'],['other','Other']]){const o=node('option',null,l);o.value=v;medium.append(o)}ml.append(medium);grid.append(ml);p.append(grid);
  const explain=node('p',null,'Replace clears the old slot and format if you leave them blank. Move only changes the container name and keeps existing slots and formats.');explain.id='ffBulkExplainer';p.append(explain);
  const config=()=>({mode:action.value,storage:{container:container.value,slot:slot.value,medium:medium.value}});
  function syncMode(){const move=action.value==='move',clear=action.value==='clear';container.disabled=clear;slot.disabled=move||clear;medium.disabled=move||clear;explain.textContent=clear?'Clears storage locations from the selected colors only. Skein counts don\'t change.':move?'Only the container changes. The existing slot and storage format are kept.':'The whole location is replaced. Leaving slot or format blank erases the old ones.';clearReview()}
  [container,slot,medium].forEach(x=>{x.addEventListener('input',clearReview);x.addEventListener('change',clearReview)});action.addEventListener('change',syncMode);
  p.append(button('Review location changes',()=>{
    try{preview=API().bulkStoragePreview([...selected],config());if(!preview.changes.length){setMessage('No changes needed: the selected colors already match this location.');clearReview();return}
    const area=$('ffBulkPreview');area.hidden=false;area.replaceChildren();area.append(node('p',null,`Review ${preview.changes.length} changes (${preview.unchanged} unchanged):`));
    const list=node('ul');for(const r of preview.changes){list.append(node('li',null,`DMC ${r.code}: ${K.display(r.before)} → ${K.display(r.after)}`))}area.append(list);
    const commit=button(`Confirm ${preview.changes.length} location changes`,()=>{
      const saved=API().bulkStorageApply([...selected],config(),preview.signature);
      if(!saved.ok){clearReview();setMessage(`Not saved: ${saved.error||'Couldn\'t apply these locations.'}`);return}
      clearReview();selected.clear();enhance();setMessage(`Saved ${saved.changed} storage location${saved.changed===1?'':'s'} on this device. Counts and other details didn't change.`);
    },'pri');area.append(commit,button('Cancel preview',()=>{clearReview();setMessage('No changes applied.')},'ghost'));
    commit.focus();setMessage('Review all affected DMC colors before confirming.');
    }catch(e){clearReview();setMessage(e.message||'Couldn\'t build the review. Nothing was changed.');}
  },'sec'));
  const review=node('section','ff-bulk-preview');review.id='ffBulkPreview';review.hidden=true;review.setAttribute('aria-label','Proposed storage changes');p.append(review);
  const undo=button('Undo last storage change',()=>{const r=API()?.bulkStorageUndo?.();if(r?.ok){clearReview();selected.clear();enhance();setMessage(`Undid ${r.changed} storage change${r.changed===1?'':'s'}. Everything else was left alone.`)}else setMessage(r?.error||'Undo is no longer available.');},'ghost');undo.id='ffBulkUndo';undo.disabled=true;p.append(undo);
  const message=node('p');message.id='ffBulkMessage';message.setAttribute('role','status');message.setAttribute('aria-live','polite');p.append(message);
  const list=$('thList');list.before(p);p.addEventListener('toggle',toggleSelectionUI);syncMode();
 }
}
function enhance(){if(!$('threadsView')||!API())return;
 populate();rebuildScopes();
 const codes=new Set(Object.keys(API().data().threads||{}));for(const c of [...selected])if(!codes.has(c))selected.delete(c);
 realRows().forEach(buildPicker);
 // Existing location enhancer owns the DMC-name search metadata; re-run if necessary.
 updateVisibility();toggleSelectionUI();rebuildSelectionUI();
 const finder=$('thSearch');if(finder&&!finder.dataset.ffBulk){finder.dataset.ffBulk='1';finder.addEventListener('input',()=>{updateVisibility();rebuildSelectionUI()})}
}
const api=Object.freeze({enhance});root.FlossFoxBulkStorageUI=api;
enhance();
})(typeof window!=='undefined'?window:globalThis);
