/* Smart Stash 2: Portable exports, safe stash-audit summaries, quick review filters.
   Read-only access to existing canonical collection. Does not change any fields.
   Exports never include demo colors; JSON preserves storage & confirmation semantics.
*/
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxSmartStashInventoryTools=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
const order=(a,b)=>{const x=/^\d+$/.test(a)?Number(a):1e8,y=/^\d+$/.test(b)?Number(b):1e8;return x-y||a.localeCompare(b)};
function collect(data,chart={}){if(!data||typeof data!=='object'||!data.threads||typeof data.threads!=='object')throw Error('Invalid collection');
 return Object.entries(data.threads).filter(([code,e])=>Object.prototype.hasOwnProperty.call(chart,code)&&e&&Number.isInteger(e.n)&&e.n>=0&&e.n<=999).sort((a,b)=>order(a[0],b[0])).map(([code,e])=>({brand:'DMC',code,name:String(chart[code]?.name||''),qty:e.n,confirmed:e.confirmed===true,partial:e.partial===true,restock:e.restock===true,storage:e.storage||null}));
}
function metrics(rows){const sum=(fn)=>rows.filter(fn).length;return{colors:rows.length,fullSkeins:rows.reduce((n,r)=>n+r.qty,0),unverified:sum(r=>r.qty>0&&!r.confirmed),partial:sum(r=>r.partial),partialOnly:sum(r=>r.qty===0&&r.partial),restock:sum(r=>r.restock),empty:sum(r=>r.qty===0&&!r.partial),missingLocation:sum(r=>!r.storage?.container)}}
const csvValue=s=>{s=String(s??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
function csv(rows){const headers=['Brand','Thread Code','Color Name','Full Skeins','Count Confirmed','Partial Skein','Restock','Container','Slot','Stored As'];return [headers.map(csvValue).join(','),...rows.map(r=>[r.brand,r.code,r.name,r.qty,r.confirmed?'yes':'no',r.partial?'yes':'no',r.restock?'yes':'no',r.storage?.container||'',r.storage?.slot||'',r.storage?.medium||''].map(csvValue).join(','))].join('\r\n')+'\r\n';}
function json(rows){const threads={};for(const r of rows){threads[r.code]={n:r.qty,partial:r.partial,restock:r.restock,...(r.confirmed?{confirmed:true}:{}),...(r.storage?{storage:r.storage}:{})}}return JSON.stringify({app:'floss-fox',kind:'thread-list',schema:2,exported:new Date().toISOString(),threads},null,2)+'\n'}
function download(text,name,type){if(typeof document==='undefined')throw Error('Browser required');const blob=new Blob([text],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
return {collect,metrics,csv,json,download};
});
