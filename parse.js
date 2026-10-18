/* Floss Fox 1.7 list parser. Pure (no DOM, no storage, no network) so tests/parse_unit.js can run it in Node.
   make(DMC) -> parse(text) -> {items, errs, lines}
   Rules (see briefs/feedback-audit.md):
   - Splits on new lines; inside a line on commas/semicolons. Tabs count as spaces. Blank lines are skipped, nothing else is.
   - "DMC <id>": the token right after DMC is the color. A row number before DMC is ignored.
   - Ids are checked against the chart. Leading zeros are kept (03 is DMC 03). A single digit 3 means 03 (DMC has no "3").
   - A trailing whole number after the id/description is the stitch count ("1,160" allowed).
   - Skein amounts keep the old syntax: x2, (2), 2 skeins, x?.
   - Anything unclear becomes an error with the original text, a plain reason and suggested fixes. Duplicates merge (skeins and stitches add up). */
(function(root){
const SKEIN_CAP=20; // more skeins than this of one color needs an explicit "confirmed" (it's usually a stitch count)
function make(DMC){
 const ID=/^(b5200|ecru|white|blanc|e\d{3,4}|\d{1,4})$/i;
 const norm=c=>{c=c.toUpperCase();if(c==='BLANC')c='WHITE';if(/^\d$/.test(c))c='0'+c;return c};
 const known=c=>Object.prototype.hasOwnProperty.call(DMC,c);
 const notInChart=c=>/^E\d/.test(c)?`DMC ${c} looks like a Light Effects thread. Floss Fox's chart only has 6-strand cotton, so it can't be checked yet`
  :/^4\d{3}$/.test(c)?`DMC ${c} looks like a Color Variations thread, which isn't in Floss Fox's chart yet`
  :`DMC ${c} isn't in our chart. Double-check the number on your pattern`;
 const N='(-?[\\d.]+|\\?)';
 const QRE=[new RegExp('^\\s*x\\s*'+N,'i'),new RegExp('\\bx\\s*'+N,'i'),new RegExp('\\(\\s*'+N+'\\s*\\)'),new RegExp(N+'\\s*(?:skeins?|sk)\\b','i'),/(-?[\d.]+)\s*x\b/i,/(?:^|\s)(\?)(?=\s|$)/];
 const WORDNUM=/\b(one|two|three|four|five|six|seven|eight|nine|ten|half)\b/i;
 // read skein amount + stitch count from the text after the id. Returns {qty, stated, stitches} or {err}
 function tail(r,afterDmc,code){let qty=null;let conf=false;r=r.replace(/\s*\bconfirm(?:ed)?\b\s*$/i,()=>{conf=true;return ''});
  for(const q of QRE){const mm=r.match(q);if(mm){qty=mm[1];r=r.replace(mm[0],' ');break}}
  let stitches=null;const sm=r.match(/(?:^|\s)(\d{1,3}(?:,\d{3})+|\d+)\s*(?:stitch(?:es)?|sts?)?\s*$/i);
  if(sm){const before=r.slice(0,sm.index);
   if(/[a-z]/i.test(before)||/stitch|sts?\s*$/i.test(sm[0])||(afterDmc&&!/\d/.test(before))){stitches=+sm[1].replace(/,/g,'');r=before}}
  if(/\d/.test(r)){const nums=(r.match(/\d[\d,.]*/g)||[]);
   return{err:'multi',why:'contains more than one number. Put each color on its own line or separate them with commas',nums}}
  if(/\?|\bskeins?\b|\bsk\b|\bx\b/i.test(r)||WORDNUM.test(r))return{err:'qty',why:'couldn\'t read the quantity. Use a number like "x2", or "x?" if you don\'t know'};
  const stated=qty!==null;if(qty==='?')qty=null;else if(qty===null)qty='1';
  if(qty!==null&&(!/^\d+$/.test(qty)||+qty<1))return{err:'qty',why:`quantity "${qty}" isn't a whole number of skeins (1 or more)`};
  if(qty!==null&&+qty>SKEIN_CAP&&!conf){const n=+qty;return{err:'qty',why:`${n} skeins of one color is a lot. If ${n} is the stitch count, choose "stitches". If you really need ${n} skeins, confirm it`,
   fixes:[{label:`DMC ${code} with ${n.toLocaleString('en-US')} stitches`,text:`DMC ${code} ${n} stitches`},{label:`DMC ${code} only`,text:`DMC ${code}`},{label:`Yes, ${n} skeins (I'm sure)`,text:`DMC ${code} x${n} confirmed`,confirm:true}]}}
  if(stitches!==null&&!(stitches>=1&&stitches<=10000000))return{err:'qty',why:`stitch count "${stitches}" doesn't look right`};
  return{qty:qty===null?null:+qty,stated,stitches}}
 function one(t){
  let r=t.replace(/×/g,'x').replace(/[\t\u00a0]/g,' ').replace(/^\s*[•*·]\s*/,'').replace(/^#\s*/,'');
  r=r.replace(/(\s\d{1,3}),(\d{3})(\s*(?:stitch(?:es)?|sts?)?\s*)$/i,'$1$2$3'); // "1,160" stitches
  let code,rest,row=false;
  const dm=r.match(/(^|[^a-z])dmc\s*[:#\-.]?\s*(b5200|e\d{3,4}|ecru|white|blanc|\d+|[a-z]+\d+[a-z0-9]*)(?=$|[^a-z0-9]|x\s*[\d?])/i);
  if(dm){const pre=r.slice(0,dm.index+dm[1].length).trim();
   if(pre&&!/^\d{1,4}[.):]?(\s+\S{1,2})?$/.test(pre))return{kind:'multi',why:'has extra text before "DMC". Start the line with the DMC number',fixes:[{label:`Use DMC ${dm[2]}`,text:r.slice(dm.index+dm[1].length)}]};
   row=!!pre;code=dm[2];rest=r.slice(dm.index+dm[0].length)}
  else{const m=r.match(/^\s*(b5200|e\d{3,4}|ecru|white|blanc|\d+|[a-z]+\d+[a-z0-9]*)(?=$|[^a-z0-9]|x\s*[\d?])/i);
   if(!m)return{kind:'code',why:/^[a-z ]+$/i.test(r.trim())?'we couldn\'t find a DMC number in this line':'not recognized as a DMC number',fixes:[]};
   code=m[1];rest=r.slice(m[0].length)}
  if(!ID.test(code))return{kind:'code',why:'not recognized as a DMC number',fixes:[]};
  code=norm(code);rest=rest.replace(/^\s*[-:.]\s+/,' ');
  const tl=tail(rest,!!dm,norm(code));
  if(tl.err){const fixes=[];
   if(tl.err==='multi'&&!dm){const toks=r.trim().split(/\s+/);
    // bare numbers: offer the likely readings, never guess
    if(toks.every(x=>ID.test(x)&&x.length>=2)&&toks.length>1&&toks.every(x=>known(norm(x))))fixes.push({label:`Split into ${toks.length} colors`,text:toks.join(', ')});
    if(toks.length>=3&&/^\d+$/.test(toks[0])&&ID.test(toks[1])&&known(norm(toks[1]))&&toks.slice(2).some(x=>/[a-z]/i.test(x))&&!toks.slice(2,-1).some(x=>/\d/.test(x))){
     const st=/^\d[\d,]*$/.test(toks[toks.length-1])?toks[toks.length-1]:null;
     fixes.push({label:`Row ${toks[0]}: DMC ${norm(toks[1])}${st?`, ${st} stitches`:''}`,text:`${toks[0]} DMC ${toks.slice(1).join(' ')}`})}
    if(toks.length===2&&ID.test(toks[0])&&known(norm(toks[0]))&&/^\d+$/.test(toks[1])){const c0=norm(toks[0]),k=+toks[1];
     // never read a large number as skeins: offer stitches or the color only; skeins only when plausible (1..SKEIN_CAP)
     if(k>=1)fixes.push({label:`DMC ${c0} with ${k.toLocaleString('en-US')} stitch${k===1?'':'es'}`,text:`DMC ${toks[0]} ${k} stitches`});
     if(k>=1&&k<=SKEIN_CAP)fixes.push({label:`DMC ${c0}, ${k} skein${k===1?'':'s'}`,text:`DMC ${toks[0]} x${k}`});
     fixes.push({label:`DMC ${c0} only`,text:`DMC ${toks[0]}`})}}
   if(tl.fixes)fixes.push(...tl.fixes);return{kind:tl.err,why:tl.why,fixes}}
  if(!known(code))return{kind:'code',why:notInChart(code),fixes:[]};
  return{code,qty:tl.qty,stated:tl.stated,stitches:tl.stitches,row}}
 return function parse(text){text=String(text==null?'':text);const items=[],errs=[];let lines=0;
  const L=text.split('\n');let ls=0;
  for(let li=0;li<L.length;li++){const line=L[li];if(li)ls+=L[li-1].length+1;
   if(line.trim())lines++;
   const sre=/[^,;]+/g;let sm;
   // keep "1,160" stitch counts in one piece: protect a thousands comma that ends a described line
   const prot=line.replace(/(\s\d{1,3}),(\d{3})(\s*(?:stitch(?:es)?|sts?)?\s*\r?)$/i,(m0,a,b,c)=>/[a-z]/i.test(line.slice(0,line.length-m0.length))?a+'\u0001'+b+c:m0);
   while((sm=sre.exec(prot))!==null){const raw=sm[0].replace(/\u0001/g,','),t=raw.replace(/\r/g,'').trim();if(!t)continue;
    const start=ls+sm.index+(raw.length-raw.replace(/^\s+/,'').length),end=start+t.length;
    const p=one(t);
    if(!p.code){errs.push({t,kind:p.kind,why:p.why,fixes:p.fixes||[],line:li+1,start,end});continue}
    const q=p.qty,asm=p.stated?0:1,ex=items.find(i=>i.code===p.code);
    if(ex){ex.qty=(ex.qty===null||q===null)?null:ex.qty+q;ex.assumed=ex.qty===null?0:ex.assumed+asm;ex.stated=ex.assumed===0;ex.src.push(t);
     if(p.stitches!==null)ex.stitchCount=(ex.stitchCount||0)+p.stitches}
    else items.push({code:p.code,qty:q,stated:p.stated,assumed:q===null?0:asm,src:[t],stitchCount:p.stitches})}}
  return{items,errs,lines}}}
const api={make,SKEIN_CAP};
if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxParse=api;
})(this);
