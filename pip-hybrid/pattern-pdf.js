/* Local-only file inspector. PDF.js provided by local vendor build (no CDN dependency).
   Selected PDFs: text extraction only; rasterized chart images are NOT read as stitches.
   No content is uploaded; caller must independently obtain consent for any AI request. */
(function(root){'use strict';
 const MAX_BYTES=20*1024*1024,MAX_PAGES=30;
 function textItemsToLines(items){
  if(!Array.isArray(items))return '';
  const present=items.filter(i=>typeof i?.str==='string'&&i.str.trim());
  if(!present.some(x=>Array.isArray(x.transform)&&x.transform.length>=6))return present.map(x=>x.str).join('\n');
  const lines=[];for(const x of present){
   const m=x.transform;if(!Array.isArray(m)||!Number.isFinite(m[4])||!Number.isFinite(m[5])){lines.push({y:-1e9,parts:[{x:0,str:x.str}]});continue}
   const y=m[5],left=m[4];let row=lines.find(l=>Math.abs(l.y-y)<2.6);
   if(!row){row={y,parts:[]};lines.push(row)}row.parts.push({x:left,str:x.str});
  }
  return lines.sort((a,b)=>b.y-a.y).map(l=>l.parts.sort((a,b)=>a.x-b.x).map(x=>x.str).join(' ')).join('\n');
 }
 async function inspect(file,pdfjs,opts={}){
  if(!file||!Number.isInteger(file.size)||file.size<1||file.size>MAX_BYTES)throw new Error('That file is empty or larger than 20 MB.');
  const ext=(String(file.name||'').split('.').pop()||'').toLowerCase();
  if(['png','jpg','jpeg','webp','gif','heic','heif','bmp','tif','tiff'].includes(ext)||/^image\//.test(String(file.type||''))){const e=new Error((typeof window!=='undefined'&&window.FF_STR&&FF_STR.left&&FF_STR.left.imageWarning)||'Only PDFs work right now. Choose a PDF file, or type the color key into the box below.');e.pdfOnly=true;throw e}
  if(ext!=='pdf')throw new Error('That file type isn\'t supported. Choose a PDF file.');
  const header=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const pdf=header[0]===37&&header[1]===80&&header[2]===68&&header[3]===70&&header[4]===45;
  const png=header[0]===137&&header[1]===80&&header[2]===78&&header[3]===71&&header[4]===13&&header[5]===10&&header[6]===26&&header[7]===10;
  const jpg=header[0]===255&&header[1]===216&&header[2]===255;
  const webp=String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP';
  if(!((ext==='pdf'&&pdf)||(ext==='png'&&png)||(['jpg','jpeg'].includes(ext)&&jpg)||(ext==='webp'&&webp)))throw new Error('The file name and its contents don\'t match, so it may be damaged or mislabeled.');
  if(!pdf)return {kind:'image',name:file.name,pages:[],warnings:[((typeof window!=='undefined'&&window.FF_STR&&FF_STR.left&&FF_STR.left.imageWarning)||'Only PDFs work right now.')],requiresReview:true};
  if(!pdfjs||typeof pdfjs.getDocument!=='function')return {kind:'pdf',name:file.name,pages:[],warnings:['The PDF reader isn\'t available here, so PDF text can\'t be read. You can still type the legend in below.'],requiresReview:true};
  const bytes=new Uint8Array(await file.arrayBuffer());const loading=pdfjs.getDocument({data:bytes});let document;
  try{document=await loading.promise;const pages=[];const limit=Math.min(document.numPages,MAX_PAGES);
   for(let p=1;p<=limit;p++){
    if(opts.signal?.aborted)throw new Error('Import canceled');
    const page=await document.getPage(p),content=await page.getTextContent();
    // PDF text item order is not always visual reading order. Flag uncertain tables.
    const text=textItemsToLines(content.items).slice(0,100000);
    pages.push({page:p,text});
   }
   return{kind:'pdf',name:file.name,pages,warnings:[...(document.numPages>MAX_PAGES?['Only the first 30 pages were read. Import the rest separately.']:[]),...(pages.every(p=>!p.text.trim())?['This PDF has no text we can read, so it\'s probably scanned pages.']:[])],requiresReview:true};
  }finally{await document?.destroy?.().catch?.(()=>{});await loading?.destroy?.().catch?.(()=>{});}
 }
 const api={inspect,textItemsToLines,MAX_BYTES,MAX_PAGES};root.FlossFoxPatternPDF=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
