/* FlossFox Smart Stash UI. Progressive enhancement in My Thread Collection.
 * All user-controlled strings are inserted as text nodes, never innerHTML.
 * Premium cards are an honest locked preview until entitlement + detection are available.
 */
(function(root){'use strict';
if(typeof document==='undefined')return;
const C=root.FlossFoxSmartStashCore,X=root.FlossFoxSmartStashTransaction,T=root.FlossFoxThreadsUI;
const card=document.querySelector('#threadsView #thCard'),quick=card?.querySelector('.thquick');
if(!card||!quick||!C||!X||!T||typeof DMC!=='object')return;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const btn=(text,fn,cls='sec')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b};
const label=(text,control)=>{const l=el('label');l.append(el('span',null,text),control);return l};
const status=el('p','ffss-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
const box=el('section','ffss');box.id='ffSmartStash';box.setAttribute('aria-labelledby','ffssTitle');
box.append(el('p','ffss-kicker','SMART STASH'),el('h3',null,'Fill your thread collection faster'));
box.querySelector('h3').id='ffssTitle';box.append(el('p','ffss-intro','Import a list, select lots of colors, or use your existing manual entry. Your threads stay on this device.'));
const choices=el('div','ffss-choices');box.append(choices);
const panel=el('div','ffss-panel');panel.hidden=true;box.append(panel,status);
const action=(title,subtitle,fn,premium)=>{const b=el('button','ffss-choice'+(premium?' ffss-premium':''));b.type='button';b.append(el('b',null,title),el('small',null,subtitle));b.addEventListener('click',fn);choices.append(b);return b};
let scannerCleanup=null;
// Committed build-config.js may mark scanners free (no localStorage flag). The entitlement bridge stays in the tree for later.
const FREE_TEST=(()=>{const B=root.FlossFoxBuildConfig;return !!(B&&B.premiumFreeDuringTesting===true)})();
let draft=null,undoToken=null,active='',shown=80,catShown=80,selection=new Map(),lookup='',pendingRaw='',pendingFilename='',mapping=null;
function say(text){status.textContent=text}
function clearPanel(){if(scannerCleanup){try{scannerCleanup()}catch(e){}scannerCleanup=null}panel.replaceChildren();panel.hidden=false}
function resetReview(){draft=null;shown=80;mapping=null;}
function toggle(actionName){if(active===actionName&&!panel.hidden){panel.hidden=true;active='';return}active=actionName;clearPanel();}
async function premium(name){
 toggle('premium-'+name);if(panel.hidden)return;
 const h=el('h4',null,name==='photo'?'Photograph your threads':'Scan skein barcodes');panel.append(h);
 const P=root.FlossFoxSmartStashPremiumBridge;
 if(FREE_TEST)panel.append(el('p','ffss-hint','Free for now. Photos and barcodes are read on this device and never uploaded.'));
 else{
 // A locally edited JS flag is not an entitlement. The real bridge must call a server-controlled session.
 if(!P||typeof P.hasAccess!=='function'){
  panel.append(el('p',null,'Premium scanning is not activated in this build. Verified subscription access and a supported recognition engine must be integrated first.'));
  panel.append(el('p','ffss-hint','Your existing collection remains accessible. Manual entry, bulk paste and file import are free.'));
  panel.append(btn('Import a list instead',()=>{active='';showImport()},'sec'));return;
 }
 const checking=el('p','ffss-hint','Checking subscription access…');panel.append(checking);
 let allowed=false;try{allowed=(await P.hasAccess(name))===true}catch(e){allowed=false}
 if(active!=='premium-'+name||panel.hidden)return;
 checking.remove();if(!allowed){panel.append(el('p',null,'A verified Premium subscription is required for this scanner. No photo or barcode was collected.'));panel.append(btn('Import a list for free',()=>{active='';showImport()},'sec'));return}
 }
 const S=root.FlossFoxSmartStashScanner,body=el('div');panel.append(body);
 if(!S){body.append(el('p',null,'Scanner component is not available in this build.'));return}
 try{scannerCleanup=name==='photo'?S.photo(body,DMC,(d,source)=>prepare(d,source)):S.barcode(body,DMC,root.FlossFoxSmartStashVerifiedBarcodes||{},(d,source)=>prepare(d,source));}
 catch(e){body.append(el('p',null,'Scanner setup failed on this device. No inventory was changed.'))}
}
// Photo recognition is the premium flagship; free import stays immediately visible beside it.
action('Photograph threads',(FREE_TEST?'Free during testing':'Premium flagship')+' · Read printed labels',()=>premium('photo'),true);
action('Scan barcodes',(FREE_TEST?'Free during testing':'Premium')+' · Continuous scanning',()=>premium('barcode'),true);
action('Import a list','Free · CSV, Excel, TXT, JSON',()=>showImport());
action('Choose colors','Free · Tap multiple DMC colors',()=>showCatalog());
function showImport(){toggle('import');if(panel.hidden)return;panel.append(el('h4',null,'Import an existing thread list'));
 panel.append(el('p','ffss-hint','Use CSV, TSV, TXT, JSON or Excel (.xlsx) exports from other apps or spreadsheets. For older .xls files, export as CSV. Only DMC inventory can currently be saved; other brands are reported for review.'));
 const file=el('input');file.type='file';file.accept='.csv,.tsv,.txt,.json,.xlsx,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';file.id='ffssFile';panel.append(label('Choose a list file',file));
 const paste=el('textarea');paste.rows=4;paste.placeholder='DMC 310 x2\nDMC 321 x1\nBLANC x3';paste.maxLength=C.MAX_CHARS;paste.id='ffssPaste';panel.append(label('Or paste an inventory list',paste));
 const row=el('div','ffss-actions');row.append(btn('Review pasted list',()=>importText(paste.value,'paste.txt'),'pri'));panel.append(row);
 file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;
  const ext=f.name.toLowerCase().split('.').pop();if(!['csv','tsv','txt','json','xlsx'].includes(ext)){say('That format is not supported yet. Export it as CSV or TXT.');return}
  if(f.size>(ext==='xlsx'?8*1024*1024:C.MAX_CHARS*3)){say('That file is too large. Split the inventory into smaller lists.');return}
  try{if(ext==='xlsx'){
    const book=await root.FlossFoxSmartStashXLSX.open(await f.arrayBuffer());
    if(book.sheets.length===1){importText(root.FlossFoxSmartStashXLSX.csv(book.sheets[0].rows),f.name+'.csv');return}
    clearPanel();panel.append(el('h4',null,'Choose the worksheet containing your threads'));
    const select=el('select');select.setAttribute('aria-label','Worksheet name');book.sheets.forEach((sh,i)=>{const o=el('option',null,`${sh.name} (${sh.rows.length} rows)`);o.value=String(i);select.append(o)});panel.append(select);
    panel.append(btn('Import this worksheet',()=>{const sh=book.sheets[Number(select.value)];importText(root.FlossFoxSmartStashXLSX.csv(sh.rows),f.name+'.csv')},'pri'));
  }else importText(await f.text(),f.name);
  }catch(e){say('Could not read that file: '+e.message)}});
}
function importText(text,filename){try{pendingRaw=text;pendingFilename=filename;const info=C.inspect(text,filename);
 if(info.format==='table'&&info.columns>1){showMapping(info);return}
 const p=C.parse(text,filename,DMC);prepare(p,'Imported list');
 }catch(e){say('Import stopped: '+e.message)}}
function showMapping(info){clearPanel();panel.append(el('h4',null,'Match your list columns'));
 panel.append(el('p','ffss-hint','Pick which columns identify DMC numbers, quantities, and brands. FlossFox never assumes stitch counts are skein counts.'));
 const f=el('div','ffss-map');mapping={};const mapSelect=(name,key,optional,initial)=>{const select=el('select');
  if(optional){const opt=el('option',null,'Not included');opt.value='-1';select.append(opt)}
  for(let i=0;i<info.columns;i++){const o=el('option',null,info.headers[i]||'Column '+(i+1));o.value=String(i);select.append(o)}
  select.value=String(Number.isInteger(initial)?initial:(optional?-1:0));mapping[key]=Number(select.value);select.addEventListener('change',()=>{mapping[key]=Number(select.value)});f.append(label(name,select));};
 mapSelect('Thread number','code',false,info.suggested.code);
 mapSelect('Skein quantity','qty',true,info.suggested.qty);
 mapSelect('Brand','brand',true,info.suggested.brand);
 panel.append(f);if(info.sample.length){const p=el('p','ffss-hint','Example: '+info.sample[0].slice(0,6).join(' | '));panel.append(p)}
 panel.append(btn('Review '+(info.sample.length?'these rows':'import'),()=>{
  try{const p=C.parse(pendingRaw,pendingFilename,DMC,mapping);prepare(p,'Imported list')}catch(e){say('Import stopped: '+e.message)}
 },'pri'));
 say('Column mapping ready.');}
function showCatalog(){toggle('catalog');if(panel.hidden)return;catShown=80;renderCatalog()}
function renderCatalog(){clearPanel();panel.append(el('h4',null,'Tap the DMC colors you own'));
 panel.append(el('p','ffss-hint','Each tap selects a color. The default is 1 full skein (unverified until you confirm the actual count). Adjust counts during review.'));
 const srch=el('input');srch.type='search';srch.placeholder='Find number or color name';srch.value=lookup;srch.setAttribute('aria-label','Search the DMC catalog');panel.append(srch);
 const count=el('p','ffss-selected',`${selection.size} selected`);panel.append(count);
 const list=el('div','ffss-catalog');list.setAttribute('role','group');list.setAttribute('aria-label','DMC color choices');panel.append(list);
 const more=btn('Show more colors',()=>{catShown+=80;drawCatalog()});const actions=el('div','ffss-actions');panel.append(more,actions);
 actions.append(btn('Review selected colors',()=>{if(!selection.size){say('Select at least one color.');return}
  prepare({records:[...selection.keys()].map(code=>({code,qty:selection.get(code),verified:false,line:'Catalog'})),issues:[],skipped:0,rowsRead:selection.size},'Selected colors');},'pri'));
 actions.append(btn('Clear selection',()=>{selection.clear();drawCatalog()},'ghost'));
 const keys=Object.keys(DMC).sort((a,b)=>{const an=/^\d+$/.test(a)?Number(a):1e9,bn=/^\d+$/.test(b)?Number(b):1e9;return an-bn||a.localeCompare(b)});
 function drawCatalog(){list.replaceChildren();const term=lookup.toLowerCase().trim();const matches=keys.filter(c=>!term||c.toLowerCase().includes(term)||String(DMC[c].name||'').toLowerCase().includes(term));
  for(const c of matches.slice(0,catShown)){const on=selection.has(c),b=el('button','ffss-color'+(on?' is-selected':''));b.type='button';b.setAttribute('aria-pressed',String(on));
   const sw=el('i','ffss-swatch');const hex=DMC[c].hex;if(typeof hex==='string'&&/^#[0-9a-f]{6}$/i.test(hex))sw.style.backgroundColor=hex;
   b.append(sw,el('b',null,c),el('small',null,String(DMC[c].name||'')));b.addEventListener('click',()=>{if(selection.has(c))selection.delete(c);else selection.set(c,1);drawCatalog()});list.append(b)}
  more.hidden=matches.length<=catShown;count.textContent=`${selection.size} color${selection.size===1?'':'s'} selected · ${matches.length} results`;}
 srch.addEventListener('input',()=>{lookup=srch.value;catShown=80;drawCatalog()});drawCatalog();}
function prepare(data,title){resetReview();draft={data,source:title,assume:false,mode:'keep',confirmedLarge:false,ackIssues:false,importDetails:false,rawSnapshot:currentSnapshot()};
 active='review';renderReview();say(`${data.records.length} recognized DMC color${data.records.length===1?'':'s'}. Review before saving.`);}
function currentSnapshot(){try{return X.snapshot(localStorage,T)}catch(e){return undefined}}
function renderReview(){if(!draft)return;clearPanel();const d=draft,records=d.data.records;
 panel.append(el('h4',null,`${d.source}: review before saving`));
 panel.append(el('p','ffss-hint',`${records.length} recognized color${records.length===1?'':'s'}; ${d.data.skipped||0} row${d.data.skipped===1?'':'s'} need attention. No changes have been saved.`));
 if(d.data.issues?.length){const details=el('details','ffss-issues');const summary=el('summary',null,`${d.data.issues.length} skipped or ambiguous line${d.data.issues.length===1?'':'s'}: review`);details.append(summary);
  const ul=el('ul');for(const e of d.data.issues.slice(0,200))ul.append(el('li',null,`Line ${e.line}: ${e.reason}`));if(d.data.issues.length>200)ul.append(el('li',null,'Additional issues omitted from this display.'));details.append(ul);panel.append(details);
  const ack=el('input');ack.type='checkbox';ack.checked=d.ackIssues;ack.addEventListener('change',()=>{d.ackIssues=ack.checked;sync()});panel.append(label('I reviewed the skipped or ambiguous rows',ack));}
 const choices=el('fieldset','ffss-mode');choices.append(el('legend',null,'If a color is already saved'));
 for(const [value,name] of [['keep','Keep existing counts (safest)'],['set','Replace existing counts'],['add','Add imported amounts to existing counts']]){
  const r=el('input');r.type='radio';r.name='ffssMergeMode';r.value=value;r.checked=d.mode===value;r.addEventListener('change',()=>{d.mode=value;renderReview()});choices.append(label(name,r));}panel.append(choices);
 const withDetails=records.filter(r=>r.extras).length;
 if(withDetails){const chk=el('input');chk.type='checkbox';chk.checked=d.importDetails;chk.addEventListener('change',()=>{d.importDetails=chk.checked;renderReview()});
  panel.append(label(`Also restore partial skeins, restock and storage locations for ${withDetails} FlossFox JSON entries (replaces those details for updated colors)`,chk));}
 const missing=records.filter(r=>r.qty===null).length;
 if(missing){const chk=el('input');chk.type='checkbox';chk.checked=d.assume;chk.addEventListener('change',()=>{d.assume=chk.checked;renderReview()});panel.append(label(`For ${missing} unnumbered quantities, use 1 skein per color and mark unverified`,chk));}
 const tablewrap=el('div','ffss-tablewrap'),table=el('table','ffss-table'),head=el('thead'),hr=el('tr');for(const h of ['DMC','Skeins in list','Currently saved','After merge','Remove'])hr.append(el('th',null,h));head.append(hr);table.append(head);
 const body=el('tbody');table.append(body);tablewrap.append(table);panel.append(tablewrap);
 const errors=el('p','ffss-hint');const save=btn('Save to my collection',()=>saveNow(),'pri');const extra=el('div','ffss-confirm');panel.append(extra,errors,el('div','ffss-actions'));const acts=panel.lastChild;acts.append(save,btn('Cancel review',()=>{draft=null;active='';panel.hidden=true;say('Nothing changed.');},'ghost'));
 const showMore=btn('Show more rows',()=>{shown+=80;renderReview()});acts.append(showMore);
 const old=(T.data()||{}).threads||{};let currentPlan=null;
 const sync=()=>{currentPlan=C.plan(old,records,d.mode,d.assume,d.importDetails);errors.textContent=currentPlan.errors.length?`${currentPlan.errors.length} count${currentPlan.errors.length===1?'':'s'} need review. Fill in quantities or select the unverified option.`:`${currentPlan.changeCount} change${currentPlan.changeCount===1?'':'s'} ready to save.`;
  extra.replaceChildren();if(currentPlan.large.length){const check=el('input');check.type='checkbox';check.checked=d.confirmedLarge;check.addEventListener('change',()=>{d.confirmedLarge=check.checked;sync()});extra.append(label(`I verified ${currentPlan.large.length} unusually large count${currentPlan.large.length===1?'':'s'} (over 20 skeins)`,check))}
  save.disabled=!currentPlan.changeCount||!!currentPlan.errors.length||!!(d.data.issues?.length&&!d.ackIssues)||!!(currentPlan.large.length&&!d.confirmedLarge)||!T.canSave()||d.rawSnapshot===undefined;
  showMore.hidden=shown>=records.length;save.textContent=`Save ${currentPlan.changeCount} change${currentPlan.changeCount===1?'':'s'}`;
  return currentPlan;};
 function drawRows(){body.replaceChildren();const p=C.plan(old,records,d.mode,d.assume,d.importDetails),after=new Map(p.rows.map(r=>[r.code,r]));for(const r of records.slice(0,shown)){
   const tr=el('tr'),cur=old[r.code],p=after.get(r.code);
   const codeCell=el('th');const codeEdit=el('input');codeEdit.type='text';codeEdit.maxLength=8;codeEdit.value=r.code;codeEdit.setAttribute('aria-label',`Correct DMC code ${r.code}`);
   codeEdit.addEventListener('change',()=>{const v=C.normalizeCode(codeEdit.value);if(!Object.prototype.hasOwnProperty.call(DMC,v)){say('Unknown DMC code '+v+'. No change made.');codeEdit.value=r.code;return}
     if(records.some(x=>x!==r&&x.code===v)){say('DMC '+v+' already appears in this review. Remove the duplicate instead.');codeEdit.value=r.code;return}
     r.code=v;d.confirmedLarge=false;drawRows();sync();say('Corrected recognition to DMC '+v+'.');});codeCell.append(codeEdit);if(r.confidence){const hint=el('small','ffss-scan-hint',r.confidence==='labeled'?'Printed label suggestion · verify':'Uncertain label suggestion · verify carefully');codeCell.append(hint)}if(r.line&&typeof r.line==='string'&&r.line!=='Catalog'&&r.line!=='Barcode'){codeCell.append(el('small','ffss-scan-hint',r.line.slice(0,60)))}tr.append(codeCell);
   const td=el('td');const input=el('input');input.type='number';input.min='0';input.max='999';input.step='1';input.inputMode='numeric';input.value=r.qty===null?'':String(r.qty);input.placeholder='Unknown';input.setAttribute('aria-label',`Skeins for DMC ${r.code}`);
   input.addEventListener('change',()=>{const s=input.value.trim();r.qty=s===''?null:(/^\d{1,3}$/.test(s)?Number(s):NaN);r.verified=r.qty!==null&&Number.isInteger(r.qty);d.confirmedLarge=false;const idx=records.indexOf(r);drawRows();sync();const refreshed=body.querySelectorAll('input[type=number]')[idx];if(refreshed){refreshed.focus();refreshed.select();}});td.append(input);tr.append(td);
   tr.append(el('td',null,cur?`${cur.n}${cur.confirmed===true?'':' · unverified'}`:'Not yet owned'));
   tr.append(el('td',null,p?`${p.after}${p.action==='unchanged'?' · kept':''}${p.confirmed?'':' · unverified'}`:'Needs quantity'));
   const removeCell=el('td');removeCell.append(btn('Remove',()=>{const idx=records.indexOf(r);if(idx>=0)records.splice(idx,1);d.confirmedLarge=false;drawRows();sync();say('Removed DMC '+r.code+' from this review; no inventory changed.');},'ghost small'));tr.append(removeCell);body.append(tr)}
 }drawRows();sync();
}
function saveNow(){if(!draft)return;const d=draft,p=C.plan(T.data().threads,d.data.records,d.mode,d.assume,d.importDetails);
 if(p.errors.length||!p.changeCount||(d.data.issues?.length&&!d.ackIssues)||(p.large.length&&!d.confirmedLarge)){say('Review the list and confirmations before saving.');return}
 let r;try{r=X.commit(localStorage,T,p,d.rawSnapshot,d.confirmedLarge)}catch(e){say('Save failed: '+e.message);return}
 if(!r.ok){say(r.error);return}undoToken=r.token;draft=null;active='';clearPanel();panel.append(el('h4',null,'Your collection has been updated'));
 panel.append(el('p',null,`${r.changed} change${r.changed===1?'':'s'} saved on this device. Existing storage locations and restock flags were preserved.`));
 panel.append(btn('Undo this import',()=>{const out=X.undo(localStorage,T,undoToken);if(out.ok){undoToken=null;panel.hidden=true;say('Import undone. Your previous collection was restored.')}else say(out.error)},'sec'));
 say(`${r.changed} collection change${r.changed===1?'':'s'} saved. Remember to back up your collection.`);
}
const original=quick;original.after(box); // 3.9 dev: manual Add stays on the first phone screen; Smart Stash follows it
root.FlossFoxSmartStashUI={openImport:showImport,openCatalog:showCatalog};
})(typeof window!=='undefined'?window:globalThis);
