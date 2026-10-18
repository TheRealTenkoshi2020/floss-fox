/* Pip's Fabric Calculator UI. Local only: optional preferences in a separate versioned key (never touches projects). */
(function(){
'use strict';
const F=window.FlossFoxFabric,$=id=>document.getElementById(id);
const KEY=(/floss-fox-dev/.test(location.pathname)?'flossfox-dev':'flossfox')+'.fabric.v1';
const S={unit:'in',fabric:'aida:14',over:1,margin:'framing',marginIn:3,custom:''};   // marginIn: full precision inches
let overTouched=false,lastOk=null;
const load=()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o&&o.v===1)Object.assign(S,o.s)}catch(e){}};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({v:1,s:{...S,w:$('fcW').value,h:$('fcH').value}}))}catch(e){}};
const radios=n=>[...document.querySelectorAll(`input[name=${n}]`)];
const setErr=(inp,errEl,msg)=>{inp.setAttribute('aria-invalid',msg?'true':'false');$(errEl).textContent=msg||''};
const u=()=>S.unit,fmtLen=(inch,up)=>u()==='in'?F.fmtIn(inch)+'″':(up?String(Math.ceil(F.toCm(inch)*10-1e-9)/10):F.fmt(F.toCm(inch),1))+' cm';
const other=(inch,up)=>u()==='in'?(up?String(Math.ceil(F.toCm(inch)*10-1e-9)/10):F.fmt(F.toCm(inch),1))+' cm':F.fmtIn(inch)+' in';
function countOf(){if(S.fabric==='custom'){const r=F.parseNum($('fcCustom').value,F.LIMITS.countMin,F.LIMITS.countMax,'custom count');setErr($('fcCustom'),'fcCustomErr',r.ok?'':r.error);return r.ok?r.value:null}return Number(S.fabric.split(':')[1])}
function overNote(){const t=S.fabric.split(':')[0],c=countOf();const n=$('fcOverNote');
 if(t==='even'&&S.over===2){n.hidden=false;n.textContent=`Evenweave and linen are usually stitched over two threads, so ${c}-count works like ${F.fmt(c/2,2)} stitches per inch.`}
 else if(t==='even'&&S.over===1){n.hidden=false;n.textContent=`Stitching over one thread on ${c}-count makes tiny stitches (${c} per inch). Most patterns use over two.`}
 else if(t==='aida'&&S.over===2){n.hidden=false;n.textContent=`Over two on Aida is unusual: it makes ${F.fmt(c/2,2)} stitches per inch.`}
 else n.hidden=true}
function run(){
 const w=F.parseWhole($('fcW').value,F.LIMITS.stitchesMin,F.LIMITS.stitchesMax,'width'),h=F.parseWhole($('fcH').value,F.LIMITS.stitchesMin,F.LIMITS.stitchesMax,'height');
 setErr($('fcW'),'fcWerr',w.ok?'':w.error);setErr($('fcH'),'fcHerr',h.ok?'':h.error);
 const c=countOf();overNote();
 if(S.margin==='custom'){const lim=u()==='in'?F.LIMITS.marginMaxIn:F.toCm(F.LIMITS.marginMaxIn);const r=F.parseNum($('fcMarginC').value,0,Math.round(lim*100)/100,'extra fabric',u()==='in'?' in':' cm');setErr($('fcMarginC'),'fcMarginErr',r.ok?'':r.error);if(r.ok&&$('fcMarginC').dataset.dirty==='1'){S.marginIn=u()==='in'?r.value:F.fromCm(r.value);$('fcMarginC').dataset.dirty='0'}if(!r.ok){show(null);return}}
 else S.marginIn=F.PRESETS[S.margin];
 if(!w.ok||!h.ok||c===null){show(null);return}
 show(F.compute({w:w.value,h:h.value,count:c,over:S.over,marginIn:S.marginIn}),w.value,h.value,c);save()}
function show(r,w,h,c){lastOk=r?{r,w,h,c}:null;
 if(!r){$('fcCutNum').textContent='–';$('fcCutSub').textContent='';$('fcDesNum').textContent='–';$('fcFix').textContent='Fix the highlighted box to see your sizes.';$('fcOtherTab').textContent='';return}
 $('fcFix').textContent='';
 $('fcCutNum').textContent=`${fmtLen(r.cut.w,true)} × ${fmtLen(r.cut.h,true)}`;
 $('fcCutSub').textContent=`(${other(r.cut.w,true)} × ${other(r.cut.h,true)}) · design plus ${fmtLen(r.marginIn)} on each side (${fmtLen(r.marginTotalIn)} total per direction), rounded up to the next ¼ inch`;
 $('fcCut').setAttribute('aria-label',`Fabric to cut: ${$('fcCutNum').textContent}`);
 $('fcDesNum').textContent=`${fmtLen(r.design.w)} × ${fmtLen(r.design.h)}`;
 $('fcDesSub').textContent=`(${other(r.design.w)} × ${other(r.design.h)}) · stitched area only, ${w} × ${h} stitches at ${F.fmt(r.effective,2)} stitches per inch`;
 const t=document.createElement('table');t.className='otab';t.innerHTML='<thead><tr><th scope="col">Aida (over one)</th><th scope="col">Evenweave (over two)</th><th scope="col">Finished size</th></tr></thead>';
 const tb=document.createElement('tbody');F.others(w,h).forEach(o=>{const tr=document.createElement('tr');[`${o.aida}-count`,`${o.evenweave}-count`,`${fmtLen(o.w)} × ${fmtLen(o.h)}`].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.appendChild(td)});tb.appendChild(tr)});
 t.appendChild(tb);$('fcOtherTab').textContent='';$('fcOtherTab').appendChild(t)}
function text(){if(!lastOk)return'';const {r,w,h,c}=lastOk;const L=(i,up)=>`${F.fmtIn(i)} in (${up?Math.ceil(F.toCm(i)*10-1e-9)/10:F.fmt(F.toCm(i),1)} cm)`;
 return[`Pip's Fabric Calculator (Floss Fox)`,`Pattern: ${w} × ${h} stitches`,`Fabric: ${S.fabric==='custom'?c+'-count (custom)':$('fcCount').selectedOptions[0].textContent}, over ${S.over===1?'one':'two'} (${F.fmt(r.effective,2)} stitches per inch)`,
  `Your finished design: ${L(r.design.w)} × ${L(r.design.h)}`,`Extra fabric: ${F.fmtIn(r.marginIn)} in on each side`,`Fabric to cut: ${L(r.cut.w,true)} × ${L(r.cut.h,true)} (rounded up to the next 1/4 inch)`,
  `This size includes extra fabric around your stitching, so you'll have room to finish your project.`].join('\n')}
function syncMarginInput(){if(S.margin!=='custom')return;const v=u()==='in'?S.marginIn:F.toCm(S.marginIn);$('fcMarginC').value=F.fmt(v,u()==='in'?3:2);$('fcMarginC').dataset.dirty='0';document.querySelectorAll('.u').forEach(e=>e.textContent=u())}
function init(){load();
 if(S.w)$('fcW').value=S.w;if(S.h)$('fcH').value=S.h;$('fcCount').value=S.fabric;if(!$('fcCount').value){S.fabric='aida:14';$('fcCount').value='aida:14'}$('fcCustom').value=S.custom||'';$('fcCustomBox').hidden=S.fabric!=='custom';
 radios('fcOver').forEach(r=>r.checked=+r.value===S.over);radios('fcMargin').forEach(r=>r.checked=r.value===S.margin);radios('fcUnit').forEach(r=>r.checked=r.value===S.unit);
 $('fcMarginBox').hidden=S.margin!=='custom';syncMarginInput();
 ['fcW','fcH'].forEach(id=>$(id).addEventListener('input',run));
 $('fcCustom').addEventListener('input',()=>{S.custom=$('fcCustom').value;run()});
 $('fcCount').addEventListener('change',()=>{const prev=S.fabric.split(':')[0];S.fabric=$('fcCount').value;$('fcCustomBox').hidden=S.fabric!=='custom';const t=S.fabric.split(':')[0];
  if(t!==prev&&t!=='custom'){S.over=t==='even'?2:1;radios('fcOver').forEach(r=>r.checked=+r.value===S.over)}run()});
 radios('fcOver').forEach(r=>r.addEventListener('change',()=>{S.over=+r.value;run()}));
 radios('fcMargin').forEach(r=>r.addEventListener('change',()=>{const was=S.marginIn;S.margin=r.value;$('fcMarginBox').hidden=S.margin!=='custom';if(S.margin==='custom'){S.marginIn=was;syncMarginInput()}run()}));
 $('fcMarginC').addEventListener('input',()=>{$('fcMarginC').dataset.dirty='1';run()});
 radios('fcUnit').forEach(r=>r.addEventListener('change',()=>{S.unit=r.value;syncMarginInput();run()}));
 $('fcCopy').addEventListener('click',async()=>{const t=text();if(!t){$('fcMsg').textContent='Fix the highlighted box first.';return}try{await navigator.clipboard.writeText(t);$('fcMsg').textContent='Copied to clipboard.'}catch(e){$('fcMsg').textContent='Couldn\'t copy automatically. Select the sizes above and copy them.'}});
 $('fcPrint').addEventListener('click',()=>print());
 run()}
window.FlossFoxFabricUI={state:()=>({...S}),text,run};
init();
})();
