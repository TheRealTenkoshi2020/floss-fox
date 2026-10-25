/* Pattern trust UI (dev): verdict line + fix list inside the Pattern check box, and the "Fix it for me" sheet.
   Nothing changes until the user taps "Use DMC ...". Each change is listed with Undo. Wording is PLACEHOLDER for Pixel. */
(function(){'use strict';const T=window.FlossFoxPatternTrust;if(!T)return;const S=T.STR;
const N=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
const B=(cls,txt,fn)=>{const b=N('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b};
const CAP=5;
/* o: {id, r1, r2, clean, foot, note, title, onFix(item), onShow(code), log:[{id,from,to}], onUndo(id), onUndoAll()} */
function box(o){const v=T.verdict(o.r1,o.r2),el=N('section','pat-check pt-box');el.id=o.id;el.setAttribute('aria-label',o.title);el.dataset.level=v.level;el.append(N('h3','',o.title));
 const vl=N('p','pt-verdict');vl.id=o.id+'Verdict';vl.dataset.level=v.level;vl.append(N('span','pt-dot'),N('span','',v.label));el.append(vl);
 if(o.intro)el.append(N('p','hint pt-intro',o.intro));
 const fakes=v.items.filter(i=>i.kind==='fake'),rest=v.items.filter(i=>i.kind!=='fake');
 if(v.items.length){const ul=N('ul','pt-fix');const P=window.FlossFoxPatternCheck;let k=0;const add=li=>{if(k++>=CAP)li.hidden=true;ul.append(li)};
  if(fakes.length){const li=N('li','pt-item');li.dataset.kind='fake';li.append(N('span','pt-text',P.STR.fake(fakes.map(i=>i.code))));const bs=N('span','pt-btns');fakes.forEach(i=>{const b=B('pri small pt-fixbtn',fakes.length===1?S.fix:S.fixCode(i.code),()=>o.onFix(i,b));b.dataset.code=i.code;bs.append(b)});li.append(bs);add(li)}
  for(const i of rest){const li=N('li','pt-item');li.dataset.kind=i.kind;li.append(N('span','pt-text',i.text));
   if(i.fix){const b=B('pri small pt-fixbtn',S.fix,()=>o.onFix(i,b));b.dataset.code=i.code;li.append(N('span','pt-btns'));li.lastChild.append(b)}
   else if(i.show&&o.onShow&&o.canShow&&o.canShow(i.show)){const b=B('ghost small',S.show,()=>o.onShow(i.show));li.append(N('span','pt-btns'));li.lastChild.append(b)}add(li)}
  el.append(ul);if(k>CAP){const m=B('ghost small pt-more',S.more(k-CAP),()=>{ul.querySelectorAll('li[hidden]').forEach(x=>x.hidden=false);m.remove()});el.append(m)}}
 if(v.tips.length){el.append(N('p','pt-small',S.small));const ul=N('ul','pt-tips');v.tips.forEach(t=>ul.append(N('li','',t.text)));el.append(ul)}
 if(!v.items.length&&!v.tips.length&&o.clean)el.append(N('p','pat-check-ok',o.clean));
 if((v.items.length||v.tips.length)&&o.foot)el.append(N('p','hint',o.foot));
 if(o.note){const pn=N('p','hint pat-chart-note',o.note);pn.id='patChartNote';el.append(pn)}
 if(o.log&&o.log.length){const ch=N('div','pat-saved pt-changed');ch.id=o.id+'Changed';ch.setAttribute('role','status');const ul=N('ul','pt-chlist');
  for(const e of o.log){const li=N('li');li.append(N('span','',S.changed(e)),' ');const u=B('ghost small pt-undo',S.undo,()=>o.onUndo(e.id));u.setAttribute('aria-label',S.undo+': '+S.changed(e));u.dataset.fix=e.id;li.append(u);ul.append(li)}
  ch.append(ul);if(o.log.length>1){const a=B('ghost small pt-undoall',S.undoAll,()=>o.onUndoAll());ch.append(a)}el.append(ch)}
 return{el,verdict:v}}
const chip=(hex,cls)=>{const c=N('div','pt-chip'+(cls?' '+cls:''));if(hex)c.style.background=hex;c.setAttribute('aria-hidden','true');return c};
/* o: {kind, from, name, catalog, sugg, DMC, onUse(code)->string|null(error), onKeep()} */
function sheet(anchor,o){document.getElementById('ptSheet')?.remove();const s=N('section','card pt-sheet');s.id='ptSheet';s.setAttribute('role','group');
 const h=N('h3','pt-title',o.kind==='fake'?S.titleFake(o):S.titleName(o));h.tabIndex=-1;h.id='ptSheetTitle';s.setAttribute('aria-labelledby','ptSheetTitle');s.append(h);
 const best=o.sugg&&o.sugg.best;let pick=best&&best.code;const err=N('p','pt-err');err.id='ptErr';err.setAttribute('role','alert');
 const use=B('pri pt-use','',()=>{if(!pick)return;const e=o.onUse(pick);if(e){err.textContent=e}});use.id='ptUse';
 const setPick=c=>{pick=c;use.textContent=S.use(c);use.disabled=!c;s.querySelectorAll('.pt-alt button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.code===c)));const r=s.querySelector('#ptRight');if(r&&o.DMC[c]){r.querySelector('.pt-chip').style.background=o.DMC[c].hex;r.querySelector('b').textContent='DMC '+c;r.querySelector('.pt-nm').textContent=o.DMC[c].name;const all=[best,...o.sugg.alts].filter(Boolean),m=all.find(x=>x.code===c);r.querySelector('small').textContent=m?(T.closeness(m.de)==='very'?S.very:S.close):''}};
 if(best){s.append(N('p','pt-says',o.kind==='fake'?S.sheetFake(o):S.sheetName(o)));const sw=N('div','pt-sw');
  const left=N('div','pt-side');left.append(chip(o.kind==='fake'?null:o.DMC[o.from].hex,o.kind==='fake'?'pt-none':''),N('b','',o.kind==='fake'?o.from:'DMC '+o.from),N('span','pt-nm',o.kind==='fake'?S.notDmc:o.DMC[o.from].name));if(o.name)left.append(N('small','','"'+o.name+'"'));
  const right=N('div','pt-side');right.id='ptRight';right.append(chip(best.hex),N('b','','DMC '+best.code),N('span','pt-nm',best.name),N('small','',T.closeness(best.de)==='very'?S.very:S.close));sw.append(left,right);s.append(sw);
  if(o.sugg.alts.length){s.append(N('p','pt-others',S.others));const alt=N('div','pt-alt');for(const a of [best,...o.sugg.alts]){const b=B('pt-altbtn','',()=>setPick(a.code));b.dataset.code=a.code;b.setAttribute('aria-label','DMC '+a.code+' '+a.name);const i=N('i');i.style.background=a.hex;b.append(i,N('span','','DMC '+a.code));alt.append(b)}s.append(alt)}}
 else s.append(N('p','pt-says',o.sugg&&o.sugg.reason==='far'?S.far:S.nothing));
 const tl=N('label','pt-type',S.typeLabel+' '),ti=N('input');ti.id='ptType';ti.inputMode='numeric';ti.autocomplete='off';ti.maxLength=6;tl.append(ti);
 const tb=B('sec small pt-typebtn',S.typeBtn,()=>{const e=o.onUse(ti.value);if(e)err.textContent=e});tb.id='ptTypeUse';const tr=N('div','pt-typerow');tr.append(tl,tb);
 const keep=B('ghost pt-keep',S.keep(o.kind==='fake'?o.from:'DMC '+o.from),()=>{s.remove();o.onKeep&&o.onKeep()});keep.id='ptKeep';
 const row=N('div','row pt-actions');if(best)row.append(use);row.append(keep);
 if(best){s.append(tr,row)}else{s.append(tr,row)}s.append(err,N('p','pat-tip',S.safe));if(best)setPick(best.code);
 anchor.after(s);h.focus({preventScroll:true});s.scrollIntoView({block:'nearest'});return s}
// Project page: only shows when the project has open Pattern check items or fixes. Nothing renders otherwise.
const parse=t=>window.FlossFoxPatternCore.parsePages([{page:1,text:t}],DMC);
function validate(code,taken){const C=window.FlossFoxPatternCore,c=C?C.normalCode(code):String(code||'').trim().toUpperCase();if(!c||!Object.prototype.hasOwnProperty.call(DMC,c))return{err:S.typeBad};if(taken.includes(c))return{err:S.already(c)};return{code:c}}
function mountProject(host,p,commit){if(!host)return;host.replaceChildren();const PC=window.FlossFoxPatternCheck;if(!PC||typeof DMC==='undefined')return;const r1=T.projectChecks(p,DMC),log=(p.pcheck&&p.pcheck.fixes)||[];if(!r1.count&&!log.length)return;
 const b=box({id:'pTrustBox',title:PC.STR.title,intro:S.projIntro,r1,r2:null,foot:PC.STR.foot,log,
  onFix:(i,btn)=>{const info=i.kind==='fake'?(()=>{const o=p.pcheck.open.find(x=>x.code===i.code)||{line:''};return{code:i.code,name:(PC.listedName(o.line,i.code)||'').trim()}})():{code:i.code,name:i.listed};
   const taken=p.items.map(x=>x.code);sheet(b.el,{kind:i.kind,from:i.code,name:info.name,catalog:i.catalog,sugg:T.suggest(info,DMC,{exclude:taken}),DMC,onKeep:()=>btn.focus(),
    onUse:raw=>{const v=validate(raw,taken);if(v.err)return v.err;const e=T.projectFix(p,{kind:i.kind,from:i.code,to:v.code},parse);if(!e)return S.typeBad;commit(S.changed(e),'pTrustBoxChanged');return null}})},
  onUndo:id=>{const e=T.projectUndo(p,id);if(e)commit(S.undone(e),'pTrustBoxVerdict')},onUndoAll:()=>{const n=T.projectUndoAll(p);commit(S.undoneAll(n),'pTrustBoxVerdict')}});
 host.append(b.el)}
window.FlossFoxPatternTrustUI={box,sheet,mountProject,validate,parse};
})();
