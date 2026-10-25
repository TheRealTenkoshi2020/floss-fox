/* Pattern trust (dev): a simple verdict on top of the Pattern check, plus "Fix it for me" for DMC numbers.
   Local only. Reads the existing check results and never changes them. Every fix needs a confirming tap, is logged and can be undone.
   The PDF is never edited. Wording is PLACEHOLDER for Pixel (plain, no em dashes, Pip is they/them). */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPatternTrust=api})(typeof window!=='undefined'?window:globalThis,function(root){
'use strict';
const req=(g,f)=>root[g]||(typeof require==='function'?require(f):null);
const PC=()=>req('FlossFoxPatternCheck','./pattern-check.js'),PCH=()=>req('FlossFoxPatternChart','./pattern-chart.js');
// ---- strings (PLACEHOLDER for Pixel)
const STR={
 red:'Check before you stitch',amber:n=>`Check ${n===1?'this 1 thing':'these '+n+' things'}`,green:'Nothing stood out in the chart',greenKey:'Nothing stood out in the color key',
 fix:'Fix it',fixCode:c=>`Fix ${c}`,show:'Show me',more:n=>`And ${n} more.`,small:'Small things',
 sheetFake:x=>x.name?`We couldn't find DMC ${x.from} in the DMC catalog. The key calls it "${x.name}". Here's the closest DMC color we found.`:`We couldn't find DMC ${x.from} in the DMC catalog. Here's the closest DMC color we found.`,
 sheetName:x=>`The key calls DMC ${x.from} "${x.name}", but in the DMC catalog ${x.from} is ${x.catalog}. Here's a DMC color that fits the name.`,
 titleFake:x=>`Change DMC ${x.from}?`,titleName:x=>`Change DMC ${x.from}?`,
 far:"We couldn't find a close DMC color. Type the DMC number from your pattern.",nothing:"There's no color name to go on, so we won't guess. Type the DMC number from your pattern.",
 notDmc:'Not in the DMC catalog',very:'Very close',close:'Close',others:'Other close colors:',typeLabel:'Type a DMC number',typeBtn:'Use this number',
 typeBad:"We don't know that DMC number. Check it against your pattern.",already:c=>`DMC ${c} is already in your list.`,
 use:c=>`Use DMC ${c}`,keep:c=>`Keep ${c}`,safe:"Your pattern file stays the same. Only your Floss Fox color list changes. You can undo.",
 changed:x=>`Changed DMC ${x.from} to DMC ${x.to}.`,tag:x=>`Changed from DMC ${x.from}`,undo:'Undo',undoAll:'Undo all fixes',undone:x=>`Put back DMC ${x.from}.`,undoneAll:n=>`Put back ${n} fix${n===1?'':'es'}.`,
 projIntro:'From when you imported this pattern.',pipRed:"A few things need a look before you stitch. See Pattern check. I haven't changed anything."};
// ---- color math: sRGB hex -> CIELAB (D65) -> CIEDE2000
function lab(hex){const h=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return null;const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v>0.04045?((v+0.055)/1.055)**2.4:v/12.92);
 const X=(c[0]*0.4124564+c[1]*0.3575761+c[2]*0.1804375)/0.95047,Y=c[0]*0.2126729+c[1]*0.7151522+c[2]*0.072175,Z=(c[0]*0.0193339+c[1]*0.119192+c[2]*0.9503041)/1.08883;
 const f=t=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116;return[116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))]}
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
function de00(a,b){const[L1,a1,b1]=a,[L2,a2,b2]=b,C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2,G=0.5*(1-Math.sqrt(Cb**7/(Cb**7+25**7)));
 const a1p=(1+G)*a1,a2p=(1+G)*a2,C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2),hp=(x,y)=>x===0&&y===0?0:(deg(Math.atan2(y,x))+360)%360,h1=hp(a1p,b1),h2=hp(a2p,b2);
 const dL=L2-L1,dC=C2p-C1p;let dh=0;if(C1p*C2p!==0){dh=h2-h1;if(dh>180)dh-=360;else if(dh<-180)dh+=360}const dH=2*Math.sqrt(C1p*C2p)*Math.sin(rad(dh/2));
 const Lb=(L1+L2)/2,Cbp=(C1p+C2p)/2;let hb=h1+h2;if(C1p*C2p!==0){hb=Math.abs(h1-h2)<=180?(h1+h2)/2:(h1+h2<360?(h1+h2+360)/2:(h1+h2-360)/2)}
 const T=1-0.17*Math.cos(rad(hb-30))+0.24*Math.cos(rad(2*hb))+0.32*Math.cos(rad(3*hb+6))-0.2*Math.cos(rad(4*hb-63)),dT=30*Math.exp(-(((hb-275)/25)**2)),RC=2*Math.sqrt(Cbp**7/(Cbp**7+25**7));
 const SL=1+0.015*(Lb-50)**2/Math.sqrt(20+(Lb-50)**2),SC=1+0.045*Cbp,SH=1+0.015*Cbp*T,RT=-Math.sin(rad(2*dT))*RC;
 return Math.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH))}
const FAR=10,VERY=5;const closeness=d=>d<VERY?'very':d<FAR?'close':'far';
// ---- name hints: the catalog entry whose name best matches the key's name gives a target color
const ALIAS={grey:'gray',deep:'dark',blanc:'white',dk:'dark',lt:'light',md:'medium',vy:'very',ul:'ultra'};
const words=s=>String(s||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean).map(w=>ALIAS[w]||w);
const MOD=new Set(['dark','light','medium','very','ultra','pale','deep']);
function nameTarget(name,DMC){const w=words(name);if(!w.length)return null;const core=w.filter(x=>!MOD.has(x));if(!core.length)return null;let best=null;
 for(const k of Object.keys(DMC)){const n=words(DMC[k].name);const hit=core.filter(x=>n.includes(x)).length;if(!hit)continue;const mod=w.filter(x=>MOD.has(x)&&n.includes(x)).length;const score=hit*2+mod-0.25*Math.abs(n.length-w.length)+(n.join(' ')===w.join(' ')?5:0);
  if(!best||score>best.score)best={code:k,score,hit}}
 return best&&best.hit===core.length?best.code:best&&best.hit>=1&&core.length<=2?best.code:null}
function typoCands(code,DMC){const c=String(code||'').toUpperCase(),out=[];const s=c.replace(/[^0-9]/g,'');const add=x=>{if(x&&x!==c&&DMC[x]&&!out.includes(x))out.push(x)};add(s);add(s.replace(/^0+/,''));if(/^\d$/.test(s))add('0'+s);return out}
function suggest(info,DMC,opts){opts=opts||{};const ex=new Set(opts.exclude||[]),from=String(info.code||'').toUpperCase();ex.add(from);
 let tcode=null,target=info.hex?lab(info.hex):null;if(!target&&info.name){tcode=nameTarget(info.name,DMC);if(tcode)target=lab(DMC[tcode].hex)}
 const typos=typoCands(from,DMC).filter(c=>!ex.has(c)&&(!target||de00(target,lab(DMC[c].hex))<FAR));
 if(!target&&!typos.length)return{best:null,alts:[],reason:'nothing',target:null};
 const card=(c,d)=>({code:c,de:Math.round(d*10)/10,hex:DMC[c].hex,name:DMC[c].name});
 const ranked=target?Object.keys(DMC).filter(c=>!ex.has(c)).map(c=>card(c,de00(target,lab(DMC[c].hex)))).sort((a,b)=>a.de-b.de):[];
 const list=[...typos.map(c=>card(c,target?de00(target,lab(DMC[c].hex)):0)),...ranked.filter(r=>!typos.includes(r.code))];
 if(!list.length||list[0].de>=FAR)return{best:null,alts:[],reason:'far',target:info.hex||(tcode&&DMC[tcode].hex)||null};
 return{best:list[0],alts:list.slice(1).filter(x=>x.de<FAR).slice(0,2),reason:'ok',target:info.hex||(tcode&&DMC[tcode].hex)||null}}
// ---- verdict: maps the existing checks to levels. Items are one per code or symbol; tips never raise the level.
function verdict(r1,r2){r1=r1||{};const P=PC(),H=PCH(),items=[],tips=[];let red=false;
 for(const c of r1.fake||[]){items.push({kind:'fake',code:c,fix:true,text:P.STR.fake([c])});red=true}
 for(const x of r1.names||[])items.push({kind:'name',code:x.code,fix:true,text:P.STR.name(x),listed:x.listed,catalog:x.catalog});
 for(const c of r1.dup||[])items.push({kind:'dup',code:c,show:c,text:P.STR.dup([c])});
 for(const x of r1.amounts||[])tips.push({kind:'amount',code:x.code,show:x.code,text:P.STR.amt(x)});
 if(r2){for(const x of r2.symMulti||[]){items.push({kind:'symMulti',text:H.STR.symMulti(x)});red=true}for(const x of r2.extra||[]){items.push({kind:'extra',text:H.STR.extra(x)});red=true}
  if(r2.labels&&r2.labels.missing&&r2.labels.missing.length){items.push({kind:'missing',text:H.STR.missing(r2.labels.missing)});red=true}
  for(const x of r2.codeMulti||[])items.push({kind:'codeMulti',code:x.code,show:x.code,text:H.STR.codeMulti(x)});
  for(const x of r2.counts||[])items.push({kind:'count',code:x.code,show:x.code,text:H.STR.count(x)});
  if(r2.sum)items.push({kind:'sum',text:H.STR.sum(r2.sum)});if(r2.labels&&r2.labels.repeat&&r2.labels.repeat.length)items.push({kind:'repeat',text:H.STR.repeat(r2.labels.repeat)});
  const un=r2.unused||[];if(un.length>3)tips.push({kind:'unused',text:H.STR.unusedMany(un)});else un.forEach(x=>tips.push({kind:'unused',code:x.code,text:H.STR.unused(x)}))}
 const level=red?'red':items.length?'amber':r2&&r2.status==='checked'?'green':'green-key';
 return{level,items,tips,label:level==='red'?STR.red:level==='amber'?STR.amber(items.length):level==='green'?STR.green:STR.greenKey}}
// ---- import fixes (rows and skipped lines before saving)
let seq=0;const nid=()=>'fx'+Date.now().toString(36)+(seq++).toString(36);const cp=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const tokRe=c=>new RegExp('(^|[^\\w])('+esc(c)+')(?![\\w])','i');
function lineFor(code,skipped){return(skipped||[]).findIndex(s=>s&&s.reason==='unrecognized'&&tokRe(code).test(s.line||''))}
function fakeInfo(code,skipped){const i=lineFor(code,skipped);if(i<0)return{code,line:'',page:1,name:''};const s=skipped[i];return{code,line:s.line,page:s.page||1,name:(PC().listedName(s.line,code)||'').trim()}}
function rowFromLine(line,from,to,page,parse){let r=null;try{const t=String(line).replace(tokRe(from),(m,a)=>a+to);r=(parse(t).rows||[]).find(x=>x.code===to)||null}catch(e){}
 return{...(r||{code:to,structured:false,qty:null,stitchCount:null,strandCount:null,warnings:[],needsReview:true,duplicates:[]}),code:to,sourcePage:page||1,sourceLine:String(line),fixedFrom:from,confirmed:false}}
function importFix(st,f,parse){const{kind,from,to}=f;if(!to||from===to||st.rows.some(r=>r.code===to))return null;const e={id:nid(),kind,from,to};
 if(kind==='fake'){const i=lineFor(from,st.skipped);if(i<0)return null;const s=st.skipped[i];e.skIndex=i;e.skipped=cp(s);e.row=rowFromLine(s.line,from,to,s.page,parse);st.skipped.splice(i,1);st.rows.push(e.row)}
 else if(kind==='name'){const i=st.rows.findIndex(r=>r.code===from);if(i<0)return null;e.index=i;e.prev=cp(st.rows[i]);e.row={...st.rows[i],code:to,fixedFrom:from};st.rows[i]=e.row}else return null;
 st.log.push(e);return e}
function importUndo(st,id){const k=st.log.findIndex(e=>e.id===id);if(k<0)return null;const e=st.log[k];st.log.splice(k,1);const i=st.rows.indexOf(e.row);
 if(e.kind==='fake'){if(i>=0)st.rows.splice(i,1);st.skipped.splice(Math.min(e.skIndex,st.skipped.length),0,cp(e.skipped))}else{const j=i>=0?i:Math.min(e.index,st.rows.length);st.rows.splice(j,i>=0?1:0,cp(e.prev))}return e}
function importUndoAll(st){const n=st.log.length;for(const e of st.log.slice().reverse())importUndo(st,e.id);return n}
// ---- project fixes (saved projects). Stored only when needed in an optional, additive field: project.pcheck
const BLANK=()=>({status:null,owned:null,anchor:null,recv:null,ownedSource:null,ownedPartial:false,estimateChecked:null});
const reorder=p=>{const d={};for(const it of p.items)d[it.code]=p.decisions[it.code]||BLANK();p.decisions=d};
const tidy=p=>{if(p.pcheck&&!p.pcheck.open.length&&!p.pcheck.fixes.length)delete p.pcheck};
function itemFromLine(line,from,to,parse){const r=rowFromLine(line,from,to,1,parse),q=Number.isInteger(r.qty)?r.qty:null,s=Number.isInteger(r.stitchCount)?r.stitchCount:null;
 return{code:to,qty:q,stated:q!==null,assumed:0,src:[`Reviewed pattern legend: ${String(line).slice(0,140)}`],stitchCount:s,stitchCountReviewed:s!==null,...(Number.isInteger(r.strandCount)?{strandCount:r.strandCount}:{})}}
function projectFix(p,f,parse){const{kind,from,to}=f;if(!to||from===to||p.items.some(i=>i.code===to))return null;p.pcheck=p.pcheck||{v:1,open:[],fixes:[]};const e={id:nid(),kind,from,to,at:new Date().toISOString()};
 if(kind==='fake'){const i=p.pcheck.open.findIndex(o=>o.code===from);if(i<0){tidy(p);return null}const o=p.pcheck.open[i];e.openIndex=i;e.open=cp(o);p.pcheck.open.splice(i,1);p.items.push(itemFromLine(o.line,from,to,parse))}
 else if(kind==='name'){const i=p.items.findIndex(x=>x.code===from);if(i<0){tidy(p);return null}e.index=i;e.prev={item:cp(p.items[i]),decision:cp(p.decisions[from]||BLANK())};p.items[i]={...p.items[i],code:to};delete p.decisions[from]}else{tidy(p);return null}
 p.pcheck.fixes.push(e);reorder(p);return e}
function projectUndo(p,id){if(!p.pcheck)return null;const k=p.pcheck.fixes.findIndex(e=>e.id===id);if(k<0)return null;const e=p.pcheck.fixes[k];p.pcheck.fixes.splice(k,1);const i=p.items.findIndex(x=>x.code===e.to);
 if(e.kind==='fake'){if(i>=0)p.items.splice(i,1);delete p.decisions[e.to];p.pcheck.open.splice(Math.min(e.openIndex,p.pcheck.open.length),0,cp(e.open))}
 else{delete p.decisions[e.to];const it=cp(e.prev.item);if(i>=0)p.items[i]=it;else p.items.splice(Math.min(e.index,p.items.length),0,it);p.decisions[e.prev.item.code]=cp(e.prev.decision)}
 reorder(p);tidy(p);return e}
function projectUndoAll(p){const L=(p.pcheck&&p.pcheck.fixes.slice().reverse())||[];for(const e of L)projectUndo(p,e.id);return L.length}
function projectChecks(p,DMC){const P=PC(),out={fake:[],dup:[],names:[],amounts:[],count:0};const fixedTo=new Set(((p.pcheck&&p.pcheck.fixes)||[]).map(e=>e.to));
 for(const o of (p.pcheck&&p.pcheck.open)||[])if(!out.fake.includes(o.code))out.fake.push(o.code);
 for(const it of p.items||[]){if(fixedTo.has(it.code))continue;const c=DMC[it.code];if(!c||!c.name)continue;for(const s of it.src||[]){const m=/^Reviewed pattern legend: (.*)$/.exec(s);if(!m)continue;const nm=P.listedName(m[1],it.code);if(P.nameMismatch(nm,c.name)){out.names.push({code:it.code,listed:nm,catalog:c.name});break}}}
 out.count=out.fake.length+out.names.length;return out}
const S=(v,n)=>typeof v==='string'?v.slice(0,n):'';const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
function normPcheck(x){if(!isObj(x))return undefined;const open=[],fixes=[];
 for(const o of Array.isArray(x.open)?x.open.slice(0,50):[])if(isObj(o)&&typeof o.code==='string'&&o.code&&typeof o.line==='string')open.push({code:S(o.code,12),line:S(o.line,300),page:Number.isInteger(o.page)?o.page:1});
 for(const e of Array.isArray(x.fixes)?x.fixes.slice(0,100):[]){if(!isObj(e)||typeof e.id!=='string'||typeof e.from!=='string'||typeof e.to!=='string')continue;
  if(e.kind==='fake'&&isObj(e.open)&&Number.isInteger(e.openIndex))fixes.push({id:S(e.id,40),kind:'fake',from:S(e.from,12),to:S(e.to,12),at:S(e.at,40),openIndex:e.openIndex,open:{code:S(e.open.code,12),line:S(e.open.line,300),page:Number.isInteger(e.open.page)?e.open.page:1}});
  else if(e.kind==='name'&&isObj(e.prev)&&isObj(e.prev.item)&&Number.isInteger(e.index))fixes.push({id:S(e.id,40),kind:'name',from:S(e.from,12),to:S(e.to,12),at:S(e.at,40),index:e.index,prev:{item:cp(e.prev.item),decision:isObj(e.prev.decision)?cp(e.prev.decision):BLANK()}})}
 return open.length||fixes.length?{v:1,open,fixes}:undefined}
// ---- at save: turn import fixes and still-open fake codes into the optional project.pcheck field
function savePcheck(draft,log,open){const fixes=[],op=(open||[]).map(o=>({code:o.code,line:o.line,page:o.page||1}));
 for(const e of log||[]){const idx=draft.items.findIndex(i=>i.code===e.to);if(idx<0)continue;const at=new Date().toISOString();
  if(e.kind==='fake')fixes.push({id:e.id,kind:'fake',from:e.from,to:e.to,at,openIndex:op.length,open:{code:e.from,line:e.skipped.line,page:e.skipped.page||1}});
  else fixes.push({id:e.id,kind:'name',from:e.from,to:e.to,at,index:idx,prev:{item:{...cp(draft.items[idx]),code:e.from},decision:BLANK()}})}
 const pc=normPcheck({v:1,open:op,fixes});if(pc)draft.pcheck=pc;else delete draft.pcheck;return draft}
return{STR,savePcheck,lab,de00,closeness,nameTarget,typoCands,suggest,verdict,fakeInfo,importFix,importUndo,importUndoAll,projectFix,projectUndo,projectUndoAll,projectChecks,normPcheck,FAR,VERY};
});
