/* Import a full pattern FILE locally; extract only reliable legend text (if selectable).
   Optional paid vision analyzes ONE selected page only AFTER thumbnail preview and Turnstile.
   All proposed colors require explicit per-row approval before local project creation.
   This is not a full chart symbol/stitch-grid decoder. */
(function(){'use strict';
 const C=window.FlossFoxPatternCore,I=window.FlossFoxPatternPDF;if(!C||!I||typeof DMC==='undefined'||!window.FlossFoxProjects)return;
 const config=window.PIP_HYBRID_CONFIG||{};
 const cfg=window.PIP_PATTERN_CONFIG||{};
 const endpoint=cfg.endpoint||(()=>{try{const u=new URL(config.endpoint);u.pathname='/v1/pattern/analyze';return u.href}catch{return''}})();
 const online=cfg.enabled===true&&!!endpoint&&/^https:\/\//.test(endpoint)&&!!config.turnstileSiteKey;
 let dialog,file,pdfjs,inspection,rows=[],previewBlob=null,turnstileToken='',turnstileId=null,selectedPage=1,abort;
 const N=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
 const $=id=>dialog?.querySelector('#'+id);
 const WARN={'no-quantity-evidence':'No amount on this line, so it\'s left as Unknown','unlabeled-numbers-not-imported':'This line has numbers with no label (stitches or skeins?), so we didn\'t import them','duplicate-color-rows':'Listed more than once, so we cleared the amounts. Enter the total yourself','check-thread-brand':'Mentions Anchor. Check which brand this line means','specialty-stitch-review':'Backstitch, blend, half cross or fractional line. Check the amount','variegated-check-color':'Variegated thread. Check the exact color number','invalid-skein-amount':'The skein amount looked wrong, so we cleared it','invalid-stitch-count':'The stitch count looked wrong, so we cleared it','ai-proposed-not-verified':'AI proposal: not verified','leading-number-not-a-color':'We read the first number as a row number or symbol, not a color. Check the color number','range-amount':'The amount is a range, so it\'s left as Unknown. Enter what you plan to buy','approximate-amount':'The amount is approximate. Check it against your pattern'};let skippedLines=[];
 const info=t=>{if($('patInfo'))$('patInfo').textContent=t};
 const setRows=r=>{rows=r.map(x=>({...x,confirmed:false}));drawRows()};
 function drawRows(){const host=$('patRows');host.replaceChildren();const title=N('p','',`Found ${rows.length} color${rows.length===1?'':'s'}. Check every value against your pattern. Amounts we couldn't read stay unknown.`);host.append(title);
  if(skippedLines.length){const d=N('details','pat-skipped');d.id='patSkipped';d.append(N('summary','',`${skippedLines.length} line${skippedLines.length===1?'':'s'} not imported (specialty threads, beads or color numbers we don't recognize)`),N('p','hint','We can only import standard DMC stranded cotton with a valid color number. Check these lines against your pattern and add anything you need by hand.'));const ul=N('ul');for(const x of skippedLines)ul.append(N('li','',`Page ${x.page}: ${x.line}${x.reason==='unrecognized'?' (color number not recognized)':''}`));d.append(ul);host.append(d)}
  if(!rows.length){host.append(N('p','', 'No reliable colors found. Paste a legend below, or try another pattern page.'));return}
  for(const row of rows){const div=N('div','pat-row'),h=N('b','',`DMC ${row.code}`);const evidence=N('small','',`Page ${row.sourcePage}: ${row.sourceLine||'AI proposal (not verified)'}`);
   const label=(title,val,max,field)=>{const l=N('label','',title+' '),input=N('input');input.type='number';input.min='1';input.max=String(max);input.step='1';input.inputMode='numeric';input.placeholder='Unknown';input.value=val==null?'':String(val);input.addEventListener('input',()=>{row[field]=input.value.trim()?Number(input.value):null;row.confirmed=false;tick.checked=false;validateReady()});l.append(input);return l};
   const tick=N('input');tick.type='checkbox';const confirm=N('label','pat-confirm',' I checked this color and its amounts against my pattern');confirm.prepend(tick);tick.addEventListener('change',()=>{row.confirmed=tick.checked;validateReady()});
   const wa=N('small','pat-warnings',[...new Set(row.warnings)].map(w=>WARN[w]||w).join(' · ')||'Needs review');div.append(h,evidence,wa,label('Full skeins',row.qty,999,'qty'),label('Stitches',row.stitchCount,10000000,'stitchCount'),confirm);host.append(div);
  }
  validateReady();
 }
 function validateReady(){const btn=$('patImport');if(btn)btn.disabled=!rows.length||rows.some(r=>!r.confirmed|| (r.qty!==null&&(!Number.isInteger(r.qty)||r.qty<1||r.qty>999)) || (r.stitchCount!==null&&(!Number.isInteger(r.stitchCount)||r.stitchCount<1||r.stitchCount>10000000)) )}
 async function lib(){if(pdfjs)return pdfjs;try{/* CI005: import() in a classic script resolves against the script URL, so resolve against the page instead. */const V=u=>new URL('pip-hybrid/vendor/pdfjs/'+u,document.baseURI).href;pdfjs=await import(V('pdf.mjs'));pdfjs.GlobalWorkerOptions.workerSrc=V('pdf.worker.mjs');return pdfjs}catch{return null}}
 async function inspectFile(f){file=f;inspection=null;rows=[];skippedLines=[];$('patRows').replaceChildren();$('patAIReview').hidden=true;$('patImagePreview').replaceChildren();previewBlob=null;try{
  info('Reading your file on this device…');const out=await I.inspect(file,await lib());inspection=out;const parsed=C.parsePages(out.pages,DMC);skippedLines=parsed.skipped||[];setRows(parsed.rows);
  $('patPage').max=String(Math.max(1,out.pages.length));$('patPage').value='1';$('patPageBox').hidden=!online||out.kind!=='pdf';/* page picker only feeds the AI preview */
  $('patName').value=(String(f.name||'').replace(/\.[^.]+$/,'').slice(0,100))||'Imported pattern';
  info(`Selected ${f.name}. ${out.warnings.join(' ')} ${out.kind==='pdf'?'Processed '+out.pages.length+' pages locally.':'Image selected. No image has been uploaded.'} Nothing was sent online.`);
  if(out.kind==='image')await showPreview();
 }catch(e){info('Import stopped: '+String(e.message||e));setRows([])}}
 async function showPreview(){const host=$('patImagePreview');host.replaceChildren();const page=Number($('patPage')?.value||1);selectedPage=page;previewBlob=null;if(!file)return;
  const canvas=N('canvas');const ctx=canvas.getContext('2d');
  try{
   if(inspection.kind==='pdf'){const lib1=await lib();if(!lib1)throw Error('The PDF preview isn\'t available here');const d=await lib1.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    try{const p=await d.getPage(page),view=p.getViewport({scale:1}),scale=Math.min(2,1600/Math.max(view.width,view.height)),v=p.getViewport({scale});canvas.width=Math.max(1,Math.floor(v.width));canvas.height=Math.max(1,Math.floor(v.height));await p.render({canvasContext:ctx,viewport:v}).promise}finally{await d.destroy()}}
   else {const img=await createImageBitmap(file);try{const scale=Math.min(1,1600/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.floor(img.width*scale));canvas.height=Math.max(1,Math.floor(img.height*scale));ctx.drawImage(img,0,0,canvas.width,canvas.height)}finally{img.close()}}
   previewBlob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',0.78));if(!previewBlob||previewBlob.size>2*1024*1024)throw Error('That page is too large to scan');canvas.style.maxWidth='100%';canvas.style.maxHeight='300px';host.append(canvas);info(online?'This is the selected page. Preview it before deciding whether to send this page to AI. Nothing has been uploaded.':'Here\'s the page you picked. Images aren\'t read automatically and AI analysis is off, so type its legend into the box below. Nothing has been uploaded.');
  }catch(e){previewBlob=null;info('Couldn\'t preview that page: '+String(e.message||e))}
 }
 async function startAI(){if(!online){info('AI pattern analysis is not configured. Local import still works.');return}if(!previewBlob)await showPreview();if(!previewBlob)return;
  $('patAIReview').hidden=false;$('patConfirmAI').disabled=true;turnstileToken='';const slot=$('patChallenge');slot.replaceChildren();
  if(!window.turnstile){try{await new Promise((resolve,reject)=>{const s=N('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.append(s)})}catch{info('Verification unavailable. No image sent.');return}}
  try{if(turnstileId!==null){window.turnstile.remove(turnstileId);turnstileId=null}turnstileId=window.turnstile.render(slot,{sitekey:config.turnstileSiteKey,action:'pattern_import',callback:tok=>{turnstileToken=tok;$('patConfirmAI').disabled=false},'expired-callback':()=>{turnstileToken='';$('patConfirmAI').disabled=true}})}catch{info('Cannot begin verification. No image sent.')}
  info(`Review the page image above. Approving sends ONLY that JPEG page image (${Math.ceil(previewBlob.size/1024)} KB) to the AI provider. The complete pattern, other pages, projects and inventory remain local.`);
 }
 async function analyze(){if(!turnstileToken||!previewBlob||!online)return;const token=turnstileToken;turnstileToken='';$('patConfirmAI').disabled=true;const reader=new FileReader();const base64=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(previewBlob)});
  const controller=new AbortController();abort=controller;const timer=setTimeout(()=>controller.abort(),22000);
  try{info('Sending this one approved page to AI…');const response=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify({mime:'image/jpeg',imageBase64:base64,turnstileToken:token}),signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'AI unavailable');
   const proposed=C.validateModelRows(data,DMC);if(!proposed.rows.length){info('AI found no trustworthy color codes on this page. You can paste the legend manually.');return}
   // Only add new codes: never silently replace already manually reviewed entries.
   const known=new Set(rows.map(r=>r.code)),add=proposed.rows.filter(r=>!known.has(r.code));setRows([...rows,...add]);info(`AI proposed ${add.length} additional DMC color${add.length===1?'':'s'}. Every result requires verification against the original page before importing.`);
  }catch(e){info('AI pattern analysis unavailable: '+String(e.message||e)+'. Nothing has been added.')}
  finally{clearTimeout(timer);abort=null;$('patAIReview').hidden=true}
 }
 function manualParse(){const lines=$('patPaste').value;const parsed=C.parsePages([{page:1,text:lines}],DMC);skippedLines=parsed.skipped||[];setRows(parsed.rows);info(`Found ${parsed.rows.length} color${parsed.rows.length===1?'':'s'} in your legend. Check each row before importing. Nothing was sent online.`)}
 function saveProject(){try{
  if(window.FlossFoxProjects.canSave?.()===false)throw Error('Saving isn\'t available in this browser right now. Download a backup before importing.');
  const draft=C.projectDraft(rows,$('patName').value);const id=window.FlossFoxProjects.add(draft);
  if(!id)throw Error('The project didn\'t pass our checks');
  // Projects.add() may retain an in-memory project even when localStorage fails.
  // Independently confirm persistence before claiming a successful save.
  const key=window.FlossFoxProjects.KEY;let persisted=!key;
  if(key){try{const saved=JSON.parse(localStorage.getItem(key)||'null');persisted=!!saved?.projects?.some(x=>x.id===id)}catch{persisted=false}}
  const n=rows.length;dialog.close();window.FlossFoxProjects.open(id);
  {/* connected workflow: land on the project with its step strip in view */const st=document.getElementById('projStatus');if(st)st.textContent=`Pattern saved with ${n} color${n===1?'':'s'}. Next, use the project steps to check your threads.`;const fl=document.getElementById('pFlow');if(fl){window.scrollTo(0,0);const b=fl.querySelector('[aria-current=step]');if(b)b.focus({preventScroll:true})}}
  if(!persisted){const status=document.getElementById('projStatus');if(status)status.textContent='Not saved: the pattern was imported for now, but this browser didn\'t store it. Download a backup before you leave.'}
 }catch(e){info('Not saved: '+String(e.message||e))}}
 function make(){if(dialog)return;dialog=N('dialog','pat-dialog');dialog.id='ffPatternDialog';dialog.setAttribute('aria-label','Import a cross-stitch pattern');const head=N('header','pat-header');head.append(N('h2','', 'Import a cross-stitch pattern'));const close=N('button','sec','Close');close.type='button';close.onclick=()=>dialog.close();head.append(close);
  const box=N('div','pat-layout'),desc=N('p','', 'PDF, PNG, JPG or WebP, up to 20 MB. We read PDF text on your device first. Chart grids (the stitch symbols) can\'t be read.');
  const choose=N('input');choose.type='file';choose.id='patFile';choose.accept='.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';choose.addEventListener('change',()=>{if(choose.files?.[0])void inspectFile(choose.files[0])});
  const nameLabel=N('label','', 'Project name '),name=N('input');name.id='patName';name.maxLength=100;nameLabel.append(name);
  const pgBox=N('label','', 'Page to preview for AI '),pg=N('input');pg.type='number';pg.min='1';pg.max='1';pg.value='1';pg.id='patPage';pgBox.id='patPageBox';pgBox.hidden=true;pgBox.append(pg);pg.addEventListener('change',()=>{void showPreview()});
  const thumb=N('div','pat-preview');thumb.id='patImagePreview';
  const tip=N('p','pat-tip', 'Need help reading a scan? You may optionally approve sending ONE previewed page to AI. This never happens automatically.');
  const ai=N('button','sec','Preview page for AI');ai.type='button';ai.disabled=!online;ai.hidden=!online;tip.hidden=!online;/* CI005: AI-only controls hidden while AI is off */ai.addEventListener('click',()=>{void startAI()});
  const consent=N('section','pat-ai-review');consent.id='patAIReview';consent.hidden=true;consent.append(N('b','', 'Confirm one-page upload'),N('p','', 'The image shown above is sent to the AI provider for legend extraction, not to your project storage. The provider may retain data under its terms. No complete pattern will be sent.'));
  const challenge=N('div');challenge.id='patChallenge';const approve=N('button','pri','Approve and analyze this page');approve.type='button';approve.id='patConfirmAI';approve.disabled=true;approve.addEventListener('click',()=>{void analyze()});const cancel=N('button','sec','Cancel AI upload');cancel.type='button';cancel.onclick=()=>{consent.hidden=true;turnstileToken=''};consent.append(challenge,approve,cancel);
  const manual=N('details');const summary=N('summary','', 'Or paste the DMC thread legend yourself');const paste=N('textarea');paste.id='patPaste';paste.rows=4;paste.placeholder='DMC 310 Black 2400 stitches\nDMC 321 Red 1 skein';const parse=N('button','sec','Find colors');parse.type='button';parse.onclick=manualParse;manual.append(summary,paste,parse);
  const found=N('div');found.id='patRows';const submit=N('button','pri','Create project with reviewed colors');submit.type='button';submit.id='patImport';submit.disabled=true;submit.onclick=saveProject;
  const status=N('p','pat-status','Nothing uploaded. Choose a file or paste a legend.');status.id='patInfo';status.setAttribute('role','status');box.append(desc,choose,nameLabel,pgBox,thumb,tip,ai,consent,manual,found,submit,status);dialog.append(head,box);document.body.append(dialog);
  dialog.addEventListener('close',()=>{abort?.abort();abort=null;turnstileToken='';previewBlob=null;file=null;inspection=null;rows=[];dialog.remove();dialog=null});
 }
 function open(){make();dialog.showModal();$('patFile').focus()}
 function init(){const base=document.querySelector('#convertView');if(!base)return;const button=N('button','sec pat-launch','Import a full pattern (PDF or image)');button.type='button';button.addEventListener('click',open);/* CI005 reconcile: Floss Fox's #saveBox is hidden until results exist, so place the entry under the Add my colors row instead. */const go=base.querySelector('#go'),row=go&&go.closest('.row');if(row){const w=N('div','row pat-launch-row');w.append(button);row.parentElement.insertBefore(w,row.nextSibling);return}const host=base.querySelector('#saveBox')||base.querySelector('.card')||base;host.parentElement.insertBefore(button,host);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.FlossFoxPatternUI={open};
})();
