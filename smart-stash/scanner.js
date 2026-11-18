/* Smart Stash Premium scanning workflows: multi-photo local OCR and live barcode capture.
   Browser camera native BarcodeDetector first; dependency-free EAN reader fallback.
   Every barcode must be verified against either curated evidence or user's own explicitly
   typed device-local mapping. No barcode or image is uploaded; scan results are suggestions.
   Premium access gate is in ui.js; this module NEVER saves collection inventory directly.
 */
(function(root){'use strict';if(typeof document==='undefined')return;
const P=root.FlossFoxPhotoEngine,R=root.FlossFoxSmartStashRecognition,E=root.FlossFoxEANReader;
const make=(t,s,cls)=>{const e=document.createElement(t);if(s!==undefined)e.textContent=s;if(cls)e.className=cls;return e};
const btn=(t,cb,cls='sec')=>{const b=make('button',t,cls);b.type='button';b.addEventListener('click',cb);return b};
const note=(parent)=>{const p=make('p','','ffss-status');p.setAttribute('role','status');p.setAttribute('aria-live','polite');parent.append(p);return t=>p.textContent=t};
const KEY=(root.FlossFoxThreadsUI?.KEY||'flossfox.threads.v1').replace(/\.threads\.v1$/,'')+'.smartstash.barcodes.v1';
function known(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');return d&&d.schema===1&&d.codes&&typeof d.codes==='object'?d.codes:{}}catch{return{}}}
function saveKnown(code,thread){if(!R.validEAN(code))return {ok:false,error:'Invalid UPC/EAN checksum.'};const codes=known();const copy={...codes,[code]:{brand:'DMC',code:thread,source:'user-confirmed',at:new Date().toISOString()}};
 try{localStorage.setItem(KEY,JSON.stringify({schema:1,codes:copy}));if(JSON.parse(localStorage.getItem(KEY)).codes[code]?.code!==thread)throw Error('readback failed');return{ok:true}}catch{return{ok:false,error:'This device cannot save barcode associations.'}}}
function photo(parent,chart,onCandidates){parent.replaceChildren();const status=note(parent);
 parent.append(make('p','Photograph printed bobbin numbers or skein labels. Clear, close-up photos with visible numbers work best. Photos never leave this device. Every suggestion needs review.'));
 const input=make('input');input.type='file';input.accept='image/*';input.multiple=true;input.setAttribute('aria-label','Select up to twenty thread photos');parent.append(input);
 
 const detail=make('input');detail.type='checkbox';detail.id='ffssPhotoDetail';const dl=make('label');dl.append(detail,document.createTextNode(' Scan smaller label areas (slower; best for organizer photographs)'));parent.append(dl);
 const progress=make('progress');progress.max=100;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','Photo scan progress');parent.append(progress);
 const actions=make('div',undefined,'ffss-actions');parent.append(actions);
 let controller=null,disposed=false;const run=btn('Find thread numbers',async()=>{
  const files=[...(input.files||[])];if(!files.length){status('Choose some photos first.');return}if(files.length>20){status('Limit each batch to twenty photos.');return}
  if(!P){status('Photo recognition engine not installed.');return}
  controller=new AbortController();run.disabled=true;progress.hidden=false;progress.value=0;
  try{const result=await P.scanFiles(files,chart,{signal:controller.signal,preferTesseract:true,detailMode:detail.checked,onProgress:e=>{
    if(disposed)return;if(e.stage==='photo'){progress.value=Math.round((e.index-1)/files.length*100);status(`Photo ${e.index}/${e.total}: ${e.message}`)}
    else status(e.stage==='detail'?e.message:`Preparing local recognition (${e.message||'loading'})…`);
  }});
   if(disposed)return;progress.value=100;status(`${result.records.length} unique numbered threads suggested from ${files.length} photos; ${result.issues.length} notes. Check the actual numbers and quantities before saving.`);
   if(result.records.length)onCandidates(result,'Photographed threads');
   else status('No readable labels found. Try a closer, brighter photo with the printed code visible, or use manual entry.');
  }catch(e){if(!disposed)status(e.message==='Recognition cancelled'?'Recognition cancelled.':'Photo recognition unavailable: '+String(e.message||e).slice(0,190))}
  finally{run.disabled=false;controller=null;progress.hidden=true;input.value='';}
 },'pri');actions.append(run,btn('Cancel recognition',()=>{controller?.abort();status('Stopping local recognition…')}));
 parent.append(make('p','Photos are processed locally. Floss colors alone cannot identify their exact manufacturer numbers. On first use, offline OCR assets may need to be loaded and cached.','ffss-hint'));
 return()=>{disposed=true;controller?.abort();input.value='';parent.replaceChildren()};
}
function barcode(parent,chart,registry,onCandidates){parent.replaceChildren();const say=note(parent);
 parent.append(make('p','Scan UPC-A or EAN barcodes one after another. Known product mappings identify a color; unfamiliar barcodes can be linked to the printed DMC number on this device. No barcode is guessed.'));
 const video=make('video');video.muted=true;video.autoplay=true;video.setAttribute('playsinline','');video.className='ffss-video';parent.append(video);
 const actions=make('div',undefined,'ffss-actions');parent.append(actions);
 const found=new Map(),unknown=new Set();let stream=null,timer=null,doing=false,disposed=false,detector=null,last='',lastAt=0;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const details=make('div',undefined,'ffss-scans');parent.append(details);const codeInput=make('input');codeInput.type='text';codeInput.placeholder='Printed DMC number, e.g. 310';codeInput.maxLength=12;codeInput.setAttribute('aria-label','Printed DMC number for an unrecognized barcode');
 const codeList=make('select');codeList.setAttribute('aria-label','Unmapped barcode to associate');
 const linked=make('div',undefined,'ffss-map');linked.append(make('p','Teach this device an unknown barcode'+((root.FlossFoxBuildConfig&&root.FlossFoxBuildConfig.premiumFreeDuringTesting===true)?':':' (Premium):')),codeList,codeInput);parent.append(linked);
 let lastCaptured='';
 function display(){details.replaceChildren();const ul=make('ul');for(const [c,v] of found)ul.append(make('li',`DMC ${c} · ${v.source}${v.scans>1?' · seen '+v.scans+' times':''}`));for(const c of unknown)ul.append(make('li',`Unmapped barcode ${c}`));details.append(ul);
  codeList.replaceChildren();for(const c of unknown){const opt=make('option',c);opt.value=c;codeList.append(opt)}
  if(!unknown.size){codeList.disabled=true;codeInput.disabled=true}else{codeList.disabled=false;codeInput.disabled=false}
 }
 function accept(value){if(!value)return;const s=String(value).replace(/\s/g,''),time=Date.now();if(last===s&&time-lastAt<2200)return;last=s;lastAt=time;lastCaptured=s;
  const stored=known(),result=R.lookupBarcode(s,{...stored,...registry},chart);
  if(result.ok){const previous=found.get(result.code)||{source:stored[s]?'Saved on this device':'Verified catalog',scans:0};previous.scans++;found.set(result.code,previous);unknown.delete(s);say(`DMC ${result.code} recognized. Keep scanning, or review your colors.`)}
  else{unknown.add(s);say(`Barcode ${s} is readable but not linked to a verified DMC number. Enter the printed number once to remember it on this device.`)}display();
 }
 function capture(){if(video.readyState<2)return null;const w=video.videoWidth,h=video.videoHeight;if(w<80||h<60)return null;
  const scale=Math.min(1,1024/Math.max(w,h));canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.drawImage(video,0,0,canvas.width,canvas.height);
  return canvas;
 }
 async function processFrame(){if(disposed||!stream||doing)return;doing=true;
  try{const c=capture();if(!c)return;let foundCode=null;
   if(detector){const a=await detector.detect(c);foundCode=a.find(x=>R.validEAN(x.rawValue))?.rawValue||null}
   if(!foundCode&&E){const r=E.decodeImageData(ctx.getImageData(0,0,c.width,c.height));foundCode=r?.value||null}
   if(foundCode)accept(foundCode);
  }catch(e){say('Unable to decode this frame. Adjust lighting or try another angle.')}
  finally{doing=false}
 }
 function stop(){if(timer){clearInterval(timer);timer=null}stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;startButton.disabled=false;stopButton.disabled=true}
 async function start(){if(disposed)return;if(!root.isSecureContext||!navigator.mediaDevices?.getUserMedia){say('Live camera needs HTTPS, localhost and camera permission. Try uploading a barcode photo instead.');return}
  stop();startButton.disabled=true;try{if(typeof root.BarcodeDetector==='function')try{detector=new root.BarcodeDetector({formats:['ean_13','upc_a','ean_8']})}catch{detector=null}
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});if(disposed||document.hidden){stop();return}
   video.srcObject=stream;await video.play();stopButton.disabled=false;timer=setInterval(processFrame,350);say('Camera active. Hold a skein barcode steady in the frame.');
  }catch(e){stop();say('Camera unavailable or permission denied. You can still select an image or type a barcode.')}}
 const startButton=btn('Start scanning',start,'pri'),stopButton=btn('Stop camera',()=>{stop();say('Camera stopped.');});stopButton.disabled=true;actions.append(startButton,stopButton);
 const image=make('input');image.type='file';image.accept='image/*';image.setAttribute('aria-label','Choose a photograph of a barcode');parent.append(image);
 image.addEventListener('change',async()=>{const f=image.files?.[0];if(!f)return;if(!f.type.startsWith('image/')||f.size>9*1024*1024){say('Please choose an image under 9 MB.');return}
  let bitmap;try{bitmap=await createImageBitmap(f);canvas.width=bitmap.width;canvas.height=bitmap.height;if(canvas.width*canvas.height>16000000){say('That image is too large to scan.');return}ctx.drawImage(bitmap,0,0);let v=null;
   if(typeof root.BarcodeDetector==='function')try{const d=new root.BarcodeDetector({formats:['ean_13','upc_a','ean_8']});v=(await d.detect(canvas)).find(x=>R.validEAN(x.rawValue))?.rawValue}catch{}
   if(!v)v=E?.decodeImageData(ctx.getImageData(0,0,canvas.width,canvas.height))?.value;if(v){accept(v)}else say('No UPC/EAN barcode detected. Try a sharp, straight-on photo.');
  }catch{say('Could not read this barcode image.')}finally{bitmap?.close?.();image.value=''}
 });
 const typed=make('input');typed.type='text';typed.inputMode='numeric';typed.placeholder='Type a barcode number';typed.setAttribute('aria-label','Manually type a UPC or EAN barcode');parent.append(typed,btn('Check barcode',()=>{const s=typed.value.trim();if(!R.validEAN(s)){say('Invalid UPC/EAN barcode or check digit.');return}accept(s)}));
 const suggest=btn('Read printed label near barcode (local OCR)',async()=>{
  if(!unknown.size){say('Scan an unfamiliar barcode first.');return}
  if(!P?.scanFiles){say('Local photo-recognition component is missing. Enter the printed number manually.');return}
  const shot=capture();if(!shot){say('Point the camera at the barcode and its printed DMC number, then try again.');return}
  suggest.disabled=true;
  try{const blob=await new Promise((resolve,reject)=>shot.toBlob(x=>x?resolve(x):reject(Error('Cannot capture frame')),'image/png'));
   const file=new File([blob],'barcode-label.png',{type:'image/png'});
   const result=await P.scanFiles([file],chart,{preferTesseract:true});
   const options=result.records.map(x=>x.code);
   if(options.length===1){codeInput.value=options[0];say(`Printed label suggestion: DMC ${options[0]}. Compare it with the package, then press Remember this barcode.`)}
   else if(options.length>1){const sel=make('select');sel.setAttribute('aria-label','Suggested DMC number from the barcode photo');options.forEach(v=>{const o=make('option',v);o.value=v;sel.append(o)});
    sel.addEventListener('change',()=>{codeInput.value=sel.value});codeInput.value=sel.value;
    const previous=parent.querySelector('#ffssOcrChoices');previous?.remove();sel.id='ffssOcrChoices';linked.append(sel);
    say(`Several printed DMC numbers were suggested. Choose the correct one and verify the package before remembering.`)}
   else say('No printed DMC number found. You can still type the number shown on the package.');
  }catch(e){say('Local label recognition unavailable: '+String(e.message||e).slice(0,150))}finally{suggest.disabled=false}
 });parent.append(suggest);
 const teach=btn('Remember this barcode',()=>{const b=codeList.value,code=codeInput.value.trim().toUpperCase().replace(/^DMC\s*/,'');if(!unknown.has(b)||!Object.prototype.hasOwnProperty.call(chart,code)){say('Choose an unmatched barcode and enter a valid printed DMC number.');return}
  const previous=known()[b];if(previous?.code&&previous.code!==code&&!confirm(`This barcode is currently remembered as DMC ${previous.code}. Change it to ${code}?`)){say('Previous barcode association kept.');return}
  const r=saveKnown(b,code);if(!r.ok){say(r.error);return}unknown.delete(b);const v=found.get(code)||{source:'Saved on this device',scans:0};v.scans++;found.set(code,v);display();say(`Remembered barcode ${b} as DMC ${code} on this device. Check the actual label before saving your collection.`)
 },'sec');parent.append(teach);
 parent.append(btn('Review recognized colors',()=>{stop();if(!found.size){say('There are no recognized colors to review.');return}onCandidates({records:[...found].map(([code,r])=>({code,qty:null,verified:false,line:'Barcode',appearances:r.scans})),issues:[...unknown].map(x=>({line:'Barcode',reason:'Unmapped barcode '+x})),skipped:unknown.size,rowsRead:found.size+unknown.size},'Scanned barcodes')},'pri'));
 const hide=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hide);
 display();return()=>{disposed=true;stop();document.removeEventListener('visibilitychange',hide);image.value='';canvas.width=canvas.height=0};
}
root.FlossFoxSmartStashScanner={photo,barcode,barcodeStoreKey:KEY};
})(typeof window!=='undefined'?window:globalThis);
