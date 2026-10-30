/* Floss Fox proposed Store Mode view selector: read-only, safe to unit-test.
 * Consumes current FlossFoxProjects.plan(project).lines, never mutates project
 * purchases or inventory. Browser: FlossFoxStoreModeCore; Node require(...).
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxStoreModeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function canonical(s){return typeof s==='string'?s.trim().toUpperCase():'';}
function sortCode(a,b){
 const x=canonical(a),y=canonical(b),nx=/^\d+$/.test(x),ny=/^\d+$/.test(y);
 if(nx!==ny)return nx?-1:1;
 if(nx){const ax=Number(x),by=Number(y);if(ax!==by)return ax-by;return x.localeCompare(y,'en');}
 return x.localeCompare(y,'en',{numeric:true});
}
function prepare(lines,opts={}){
 if(!Array.isArray(lines))throw new TypeError('Shopping lines must be an array');
 const sort=opts.sort||'number',query=String(opts.query||'').trim().toLowerCase(),show=opts.show||'all';
 if(!['number','pattern','name'].includes(sort)||!['all','remaining','purchased'].includes(show))throw new RangeError('Invalid view options');
 const seen=new Set(),valid=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line||typeof line!=='object'||typeof line.key!=='string'||!line.key||seen.has(line.key))throw new TypeError('Duplicate or invalid shopping key');
  const code=canonical(line.to),brand=canonical(line.brand||opts.brand||'DMC');
  if(!code||code.length>35||brand.length>35||!Number.isInteger(line.q)||line.q<1||line.q>9999)throw new TypeError('Invalid line fields');
  seen.add(line.key);
  const item={key:line.key,code,brand,quantity:line.q,bought:line.bought===true,patternOrder:i,name:String(line.name||'').slice(0,120)};
  if(query&&!`${code} ${brand} ${item.name}`.toLowerCase().includes(query))continue;
  valid.push(item);
 }
 function compare(a,b){
  if(sort==='pattern')return a.patternOrder-b.patternOrder;
  if(sort==='name')return a.name.localeCompare(b.name)||sortCode(a.code,b.code)||a.patternOrder-b.patternOrder;
  return a.brand.localeCompare(b.brand)||sortCode(a.code,b.code)||a.patternOrder-b.patternOrder;
 }
 const remaining=valid.filter(x=>!x.bought).sort(compare),purchased=valid.filter(x=>x.bought).sort(compare);
 return {remaining:show==='purchased'?[]:remaining,purchased:show==='remaining'?[]:purchased,
   counts:{remaining:valid.filter(x=>!x.bought).length,purchased:valid.filter(x=>x.bought).length,visible:valid.length},
   note:'Bought means marked for purchase; do not change owned inventory until explicit receipt/check-in.'};
}
return {sortCode,prepare};
});
