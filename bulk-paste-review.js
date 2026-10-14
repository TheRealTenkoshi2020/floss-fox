/* Read-only, strict typed line parser for bulk stash entry.
 * ACCEPT e.g. DMC 310 x 2 | B5200:1 | 03,4 | 310 (count UNKNOWN).
 * REJECT ambiguous bare number sequences like '310 1160' as potentially stitch counts.
 * Existing FlossFoxParse.parse should be used for *pattern requirements*, not inventory stock.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxBulkPasteReview=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function parse(text,chart,opts={}){
 if(typeof text!=='string'||text.length>100000)throw new TypeError('text must be <=100000 characters');
 if(!chart||typeof chart!=='object')throw new TypeError('valid color chart required');
 const results=[],errors=[],seen=new Set(),lines=text.replace(/\r\n?/g,'\n').split('\n');
 if(lines.length>3000)throw new RangeError('too many lines');
 for(let i=0;i<lines.length;i++){
  const original=lines[i],s=original.trim();if(!s||s.startsWith('#'))continue;
  let m=/^(?:DMC\s+)?([A-Za-z]?\d{1,4}|WHITE|BLANC|ECRU)\s*(?:[xX×:]\s*(\d{1,4})|,\s*(\d{1,4}))?\s*$/i.exec(s);
  if(!m){errors.push({line:i+1,raw:original,reason:'unrecognized-or-ambiguous-format'});continue}
  const code=m[1].toUpperCase();if(!own(chart,code)){errors.push({line:i+1,raw:original,reason:'unknown-color'});continue}
  if(seen.has(code)){errors.push({line:i+1,raw:original,reason:'duplicate-color'});continue}seen.add(code);
  const v=m[2]||m[3],qty=v===undefined?null:Number(v);
  if(qty!==null&&(!Number.isInteger(qty)||qty<0||qty>999)){errors.push({line:i+1,raw:original,reason:'quantity-out-of-range'});continue}
  results.push({line:i+1,code,fullSkeins:qty,action:qty===null?'review':'setFull',requiresConfirmation:qty===null||qty>20});
 }
 return {rows:results,errors,ready:errors.length===0&&results.length>0&&results.every(r=>r.fullSkeins!==null&&r.fullSkeins<=20),notice:'Inventory entries require explicit skein units; ambiguous counts are not accepted.'};
}
return{parse};
});
