/* FlossFox local photo-recognition engine.
   Tesseract.js v7 self-hosted adapter + native TextDetector fallback. No network API,
   no persistence of photos and no inventory writes. Required Tesseract assets can be
   installed via package vendor_fetch.py; missing assets are reported, not replaced by CDN.
   Every output is only a suggested color code. User confirms actual counts in Smart Stash.
*/
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPhotoEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const root=typeof globalThis!=='undefined'?globalThis:window; // Mouse fix: factory had no root binding (ReferenceError on first scan)
const MAX_FILES=20,MAX_BYTES=9*1024*1024,MAX_SIDE=2200;
const abs=(p)=>new URL(p,document.baseURI).href;
const next=()=>new Promise(r=>setTimeout(r,0));
function getCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function tileAreas(img){const w=img.width,h=img.height;const x=Math.floor(w*.48),y=Math.floor(h*.48);const marginX=Math.floor(w*.06),marginY=Math.floor(h*.06);return [
 {x:0,y:0,width:Math.min(w,x+marginX),height:Math.min(h,y+marginY)},
 {x:Math.max(0,x-marginX),y:0,width:w-Math.max(0,x-marginX),height:Math.min(h,y+marginY)},
 {x:0,y:Math.max(0,y-marginY),width:Math.min(w,x+marginX),height:h-Math.max(0,y-marginY)},
 {x:Math.max(0,x-marginX),y:Math.max(0,y-marginY),width:w-Math.max(0,x-marginX),height:h-Math.max(0,y-marginY)}];}
function imageCanvas(img,rotation=0,variant='normal',area=null){const rawW=area?.width||img.width,rawH=area?.height||img.height;
 const scale=Math.min(1,MAX_SIDE/Math.max(rawW,rawH)),W=Math.max(1,Math.round(rawW*scale)),H=Math.max(1,Math.round(rawH*scale));
 const sideways=rotation%180!==0,c=getCanvas(sideways?H:W,sideways?W:H),ctx=c.getContext('2d',{willReadFrequently:true});
 ctx.translate(c.width/2,c.height/2);ctx.rotate(rotation*Math.PI/180);
 ctx.drawImage(img,area?.x||0,area?.y||0,rawW,rawH,-W/2,-H/2,W,H);ctx.setTransform(1,0,0,1,0,0);
 if(variant==='contrast'){const p=ctx.getImageData(0,0,c.width,c.height),d=p.data;
  // Mild contrast only, never destructive black-and-white; Tesseract handles thresholding.
  for(let i=0;i<d.length;i+=4){const v=Math.max(0,Math.min(255,((d[i]*.3+d[i+1]*.59+d[i+2]*.11)-120)*1.55+120));d[i]=d[i+1]=d[i+2]=v}ctx.putImageData(p,0,0)}
 return c;
}
function scanText(raw,chart,meta={}){const s=String(raw||'').toUpperCase().replace(/[\u00a0\u200b-\u200d]/g,' '),found=new Map(),issues=[];
 const put=(code,confidence)=>{if(!Object.prototype.hasOwnProperty.call(chart,code))return;const old=found.get(code);if(old){old.appearances++;if(confidence==='labeled')old.confidence='labeled'}else found.set(code,{code,qty:null,verified:false,confidence,appearances:1,line:meta.line||'Photo'})};
 // Strong contexts: DMC 310, DMC:310, color/colour 310. No inference from thread colors.
 for(const m of s.matchAll(/\b(?:DMC|COLOU?R|COL\.)\s*[:#\-]?\s*(B5200|BLANC|WHITE|ECRU|\d{1,4})\b/g))put(m[1],'labeled');
 // DMC + another line followed immediately by a color on the next line.
 const lines=s.split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<lines.length-1;i++)if(/^(?:DMC|COLOU?R\s*:?)$/.test(lines[i])&&/^(B5200|BLANC|WHITE|ECRU|\d{1,4})$/.test(lines[i+1]))put(lines[i+1],'context');
 // Isolated code lines are low confidence, never auto-selected silently.
 for(const line of lines){const m=/^(?:#\s*)?(B5200|BLANC|WHITE|ECRU|\d{1,4})$/.exec(line);if(m)put(m[1],'unlabeled')}
 if(!found.size&&s.trim())issues.push({line:meta.line||'Photo',reason:'No recognizable DMC number. Try a closer crop in even light.'});
 return{records:[...found.values()],issues,scannedText:s.slice(0,4000)};
}
async function loadTesseract(){if(root.Tesseract?.createWorker)return root.Tesseract;
 const src=abs('smart-stash/vendor/ocr/tesseract.min.js');
 // Require same-origin vendor files, so an incomplete install never sends photos off-site.
 if(new URL(src).origin!==location.origin)throw Error('OCR assets are not on this site.');
 const response=await fetch(src,{method:'HEAD',cache:'no-cache'});if(!response.ok)throw Error('Self-hosted OCR assets are missing.');
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('OCR script could not load.'));document.head.append(script)});
 if(!root.Tesseract?.createWorker)throw Error('OCR worker is not available.');return root.Tesseract;
}
async function worker(progress){const T=await loadTesseract();
 const o={workerPath:abs('smart-stash/vendor/ocr/worker.min.js'),corePath:abs('smart-stash/vendor/ocr/core'),langPath:abs('smart-stash/vendor/ocr/lang'),gzip:true,logger:m=>{if(m?.status)progress?.(m.status,Math.round((m.progress||0)*100))}};
 const w=await T.createWorker('eng',1,o,{tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});return w;
}
async function scanFiles(files,chart,opts={}){const all=Array.from(files||[]);if(!all.length||all.length>MAX_FILES)throw Error('Select 1–20 photos per batch.');
 const onProgress=opts.onProgress||(()=>{}),signal=opts.signal;let w=null,results=[],issues=[],textReads=0;const abort=()=>{if(signal?.aborted)throw Error('Recognition cancelled')};
 let native=null;if(root.TextDetector){try{native=new root.TextDetector()}catch(e){}}
 try{if(!native||opts.preferTesseract){try{w=await worker((s,p)=>onProgress({stage:'engine',message:s,percent:p}))}catch(e){if(!native)throw Error('Offline OCR engine not installed: '+e.message);issues.push({line:'OCR',reason:'Tesseract unavailable; using native recognition.'})}}
  for(let i=0;i<all.length;i++){abort();const file=all[i];if(!file.type.startsWith('image/')||file.size>MAX_BYTES){issues.push({line:i+1,reason:'Unsupported image or file larger than 9 MB.'});continue}
   onProgress({stage:'photo',index:i+1,total:all.length,message:'Reading '+file.name});let img;
   try{img=await createImageBitmap(file,{imageOrientation:'from-image'});
    // Full image first. Detail mode scans four overlapping crops independently
    // to preserve tiny bobbin labels in a large organizer photograph.
    const passes=[{variant:'normal',area:opts.crop||null}];
    if(opts.detailMode){for(const area of tileAreas(img))passes.push({variant:'normal',area})}
    else if(w)passes.push({variant:'contrast',area:opts.crop||null});
    let recognized=0;
    for(const [pi,pass] of passes.entries()){abort();const canvas=imageCanvas(img,0,pass.variant,pass.area);
     if(opts.detailMode)onProgress({stage:'detail',index:pi+1,total:passes.length,message:'Reading label region '+(pi+1)+'/'+passes.length});
     let text='';try{if(w){const res=await w.recognize(canvas);text=res.data?.text||''}
     else {const blocks=await native.detect(canvas);text=blocks.map(b=>b.rawValue||b.text||'').join('\n')}}finally{canvas.width=0;canvas.height=0}
     textReads++;const parsed=scanText(text,chart,{line:file.name});recognized+=parsed.records.length;results.push(...parsed.records);
     if(!opts.detailMode&&recognized)break;
    }
    if(!recognized)issues.push({line:file.name,reason:'No readable DMC label found; try cropping closer or enter the printed code.'});
   }catch(e){if(signal?.aborted)throw e;issues.push({line:file.name,reason:'Could not process photo: '+String(e.message||e).slice(0,100)})}
   finally{img?.close?.();await next()}
  }
 }finally{if(w)await w.terminate().catch(()=>{})}
 const map=new Map();for(const r of results){const old=map.get(r.code);if(old){old.appearances+=r.appearances;if(r.confidence==='labeled')old.confidence='labeled'}else map.set(r.code,{...r})}
 return {records:[...map.values()],issues,skipped:issues.length,rowsRead:textReads,processed:all.length};
}
return {scanText,scanFiles,tileAreas,MAX_FILES,MAX_BYTES};
});
