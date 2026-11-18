/* Pip's Fabric Calculator UI. Local only: optional preferences in a separate versioned key (never touches projects). */
(function(){
'use strict';
const F=window.FlossFoxFabric,$=id=>document.getElementById(id);
const KEY=(/floss-fox-dev/.test(location.pathname)?'flossfox-dev':'flossfox')+'.fabric.v1';
const S={unit:'in',fabric:'aida:14',over:1,margin:'framing',marginIn:3,custom:''};   // marginIn: full precision inches
let overTouched=false,lastOk=null,namedPresets=[];
const MAX_PRESETS=12;
const CP=window.FlossFoxAtelierCopy;
const PH={'fabric.preset.name':'Preset name','fabric.preset.save':'Save as preset','fabric.preset.use':'Use preset','fabric.preset.delete':'Delete preset','fabric.preset.saved':'✓ Preset saved in this browser.','fabric.preset.empty':'No presets yet. Save your usual fabric and margin to reuse them.','fabric.print':'Print cutting slip','fabric.cap.cut':'Fabric to cut','fabric.cap.stitched':'Stitched area','fabric.cap.margin':'Margin','fabric.note':'The drawing is a guide. Cut by the measurements.','fabric.invalid':'Fix the highlighted numbers to see the drawing.','fabric.aria':'Fabric to cut: {w} by {h} {unit}. Stitched area: {sw} by {sh} {unit}, with a {m} {unit} margin on each side.'};
const t=(k,v)=>{if(CP&&typeof CP.has==='function'&&CP.has(k)&&typeof CP.t==='function')return CP.t(k,v);return String(PH[k]||'').replace(/\{(\w+)\}/g,(m,x)=>v&&x in v?String(v[x]):m)};
const load=()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o&&o.v===1){if(o.s)Object.assign(S,o.s);namedPresets=normPresets(o.presets)}}catch(e){}};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({v:1,s:{...S,w:$('fcW').value,h:$('fcH').value},presets:namedPresets}))}catch(e){}};
function normPresets(list){
 if(!Array.isArray(list))return[];
 const out=[],seen=new Set();
 for(const raw of list.slice(0,40)){
  if(!raw||typeof raw!=='object')continue;
  const name=String(raw.name||'').trim().slice(0,40);if(!name||seen.has(name.toLowerCase()))continue;
  const fabric=typeof raw.fabric==='string'?raw.fabric.slice(0,20):'aida:14';
  const over=raw.over===2?2:1;
  const margin=['small','hoop','framing','custom'].includes(raw.margin)?raw.margin:'framing';
  const marginIn=typeof raw.marginIn==='number'&&isFinite(raw.marginIn)?raw.marginIn:3;
  const custom=typeof raw.custom==='string'?raw.custom.slice(0,12):'';
  const w=typeof raw.w==='string'?raw.w.slice(0,8):'';
  const h=typeof raw.h==='string'?raw.h.slice(0,8):'';
  seen.add(name.toLowerCase());out.push({name,fabric,over,margin,marginIn,custom,w,h});
  if(out.length>=MAX_PRESETS)break;
 }
 return out;
}
const radios=n=>[...document.querySelectorAll(`input[name=${n}]`)];
const setErr=(inp,errEl,msg)=>{inp.setAttribute('aria-invalid',msg?'true':'false');$(errEl).textContent=msg||''};
const u=()=>S.unit,fmtLen=(inch,up)=>u()==='in'?F.fmtIn(inch)+'″':(up?String(Math.ceil(F.toCm(inch)*10-1e-9)/10):F.fmt(F.toCm(inch),1))+' cm';
const other=(inch,up)=>u()==='in'?(up?String(Math.ceil(F.toCm(inch)*10-1e-9)/10):F.fmt(F.toCm(inch),1))+' cm':F.fmtIn(inch)+' in';
function countOf(){if(S.fabric==='custom'){const r=F.parseNum($('fcCustom').value,F.LIMITS.countMin,F.LIMITS.countMax,'custom count');setErr($('fcCustom'),'fcCustomErr',r.ok?'':r.error);return r.ok?r.value:null}return Number(S.fabric.split(':')[1])}
function overNote(){const t0=S.fabric.split(':')[0],c=countOf();const n=$('fcOverNote');
 if(t0==='even'&&S.over===2){n.hidden=false;n.textContent=`Evenweave and linen are usually stitched over two threads, so ${c}-count works like ${F.fmt(c/2,2)} stitches per inch.`}
 else if(t0==='even'&&S.over===1){n.hidden=false;n.textContent=`Stitching over one thread on ${c}-count makes tiny stitches (${c} per inch). Most patterns use over two.`}
 else if(t0==='aida'&&S.over===2){n.hidden=false;n.textContent=`Over two on Aida is unusual: it makes ${F.fmt(c/2,2)} stitches per inch.`}
 else n.hidden=true}
function run(){
 const w=F.parseWhole($('fcW').value,F.LIMITS.stitchesMin,F.LIMITS.stitchesMax,'width'),h=F.parseWhole($('fcH').value,F.LIMITS.stitchesMin,F.LIMITS.stitchesMax,'height');
 setErr($('fcW'),'fcWerr',w.ok?'':w.error);setErr($('fcH'),'fcHerr',h.ok?'':h.error);
 const c=countOf();overNote();
 if(S.margin==='custom'){const lim=u()==='in'?F.LIMITS.marginMaxIn:F.toCm(F.LIMITS.marginMaxIn);const r=F.parseNum($('fcMarginC').value,0,Math.round(lim*100)/100,'extra fabric',u()==='in'?' in':' cm');setErr($('fcMarginC'),'fcMarginErr',r.ok?'':r.error);if(r.ok&&$('fcMarginC').dataset.dirty==='1'){S.marginIn=u()==='in'?r.value:F.fromCm(r.value);$('fcMarginC').dataset.dirty='0'}if(!r.ok){show(null);return}}
 else S.marginIn=F.PRESETS[S.margin];
 if(!w.ok||!h.ok||c===null){show(null);return}
 show(F.compute({w:w.value,h:h.value,count:c,over:S.over,marginIn:S.marginIn}),w.value,h.value,c);save()}
function draw(r){
 const fig=$('fcDiagram'),note=$('fcDiagNote');
 if(!fig)return;
 if(!r){fig.hidden=true;fig.innerHTML='';fig.removeAttribute('aria-label');if(note)note.textContent=t('fabric.invalid');return}
 const box=F.diagramBoxes(r,240,160,12);
 if(!box){fig.hidden=true;fig.innerHTML='';if(note)note.textContent=t('fabric.invalid');return}
 const unit=u()==='in'?'in':'cm';
 const fw=u()==='in'?F.fmtIn(r.cut.w):F.fmt(r.cut.wCm,1),fh=u()==='in'?F.fmtIn(r.cut.h):F.fmt(r.cut.hCm,1);
 const sw=u()==='in'?F.fmtIn(r.design.w):F.fmt(r.design.wCm,1),sh=u()==='in'?F.fmtIn(r.design.h):F.fmt(r.design.hCm,1);
 const m=u()==='in'?F.fmtIn(r.marginIn):F.fmt(F.toCm(r.marginIn),1);
 const aria=t('fabric.aria',{w:fw,h:fh,unit,sw,sh,m});
 fig.hidden=false;
 fig.setAttribute('aria-label',aria);
 fig.innerHTML=`<svg viewBox="0 0 ${box.W} ${box.H}" role="img" aria-hidden="true" data-cut-w="${r.cut.w}" data-cut-h="${r.cut.h}" data-des-w="${r.design.w}" data-des-h="${r.design.h}" data-margin="${r.marginIn}">
  <rect class="fc-cut" x="${box.cut.x}" y="${box.cut.y}" width="${box.cut.w}" height="${box.cut.h}"/>
  <rect class="fc-stitched" x="${box.design.x}" y="${box.design.y}" width="${box.design.w}" height="${box.design.h}"/>
 </svg>
 <figcaption class="fc-diag-cap"><span class="fc-cap-cut">${esc(t('fabric.cap.cut'))}</span> · <span class="fc-cap-st">${esc(t('fabric.cap.stitched'))}</span> · <span class="fc-cap-m">${esc(t('fabric.cap.margin'))} ${esc(fmtLen(r.marginIn))}</span></figcaption>`;
 if(note)note.textContent=t('fabric.note');
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(r,w,h,c){lastOk=r?{r,w,h,c}:null;
 if(!r){$('fcCutNum').textContent='–';$('fcCutSub').textContent='';$('fcDesNum').textContent='–';$('fcFix').textContent='Fix the highlighted box to see your sizes.';$('fcOtherTab').textContent='';draw(null);return}
 $('fcFix').textContent='';
 $('fcCutNum').textContent=`${fmtLen(r.cut.w,true)} × ${fmtLen(r.cut.h,true)}`;
 $('fcCutSub').textContent=`(${other(r.cut.w,true)} × ${other(r.cut.h,true)}) · design plus ${fmtLen(r.marginIn)} on each side (${fmtLen(r.marginTotalIn)} total per direction), rounded up to the next ¼ inch`;
 $('fcCut').setAttribute('aria-label',`Fabric to cut: ${$('fcCutNum').textContent}`);
 $('fcDesNum').textContent=`${fmtLen(r.design.w)} × ${fmtLen(r.design.h)}`;
 $('fcDesSub').textContent=`(${other(r.design.w)} × ${other(r.design.h)}) · stitched area only, ${w} × ${h} stitches at ${F.fmt(r.effective,2)} stitches per inch`;
 draw(r);
 const tbl=document.createElement('table');tbl.className='otab';tbl.innerHTML='<thead><tr><th scope="col">Aida (over one)</th><th scope="col">Evenweave (over two)</th><th scope="col">Finished size</th></tr></thead>';
 const tb=document.createElement('tbody');F.others(w,h).forEach(o=>{const tr=document.createElement('tr');[`${o.aida}-count`,`${o.evenweave}-count`,`${fmtLen(o.w)} × ${fmtLen(o.h)}`].forEach(x=>{const td=document.createElement('td');td.textContent=x;tr.appendChild(td)});tb.appendChild(tr)});
 tbl.appendChild(tb);$('fcOtherTab').textContent='';$('fcOtherTab').appendChild(tbl)}
function text(){if(!lastOk)return'';const {r,w,h,c}=lastOk;const L=(i,up)=>`${F.fmtIn(i)} in (${up?Math.ceil(F.toCm(i)*10-1e-9)/10:F.fmt(F.toCm(i),1)} cm)`;
 return[`Pip's Fabric Calculator (Floss Fox): cutting slip`,`Pattern: ${w} × ${h} stitches`,`Fabric: ${S.fabric==='custom'?c+'-count (custom)':$('fcCount').selectedOptions[0].textContent}, over ${S.over===1?'one':'two'} (${F.fmt(r.effective,2)} stitches per inch)`,
  `Your finished design: ${L(r.design.w)} × ${L(r.design.h)}`,`Extra fabric: ${F.fmtIn(r.marginIn)} in on each side`,`Fabric to cut: ${L(r.cut.w,true)} × ${L(r.cut.h,true)} (rounded up to the next 1/4 inch)`,
  `This size includes extra fabric around your stitching, so you'll have room to finish your project.`,`The drawing is a guide. Cut by the measurements.`].join('\n')}
function syncMarginInput(){if(S.margin!=='custom')return;const v=u()==='in'?S.marginIn:F.toCm(S.marginIn);$('fcMarginC').value=F.fmt(v,u()==='in'?3:2);$('fcMarginC').dataset.dirty='0';document.querySelectorAll('.u').forEach(e=>e.textContent=u())}
function paintPresets(){
 const host=$('fcPresets');if(!host)return;
 const list=$('fcPresetList');
 if(!namedPresets.length){list.innerHTML='<p class="hint" id="fcPresetEmpty">'+esc(t('fabric.preset.empty'))+'</p>';return}
 list.innerHTML='<ul class="fc-preset-ul">'+namedPresets.map((p,i)=>`<li><span class="fc-pname">${esc(p.name)}</span><span class="row" style="margin:0"><button type="button" class="sec" data-use="${i}">${esc(t('fabric.preset.use'))}</button><button type="button" class="sec" data-del="${i}">${esc(t('fabric.preset.delete'))}</button></span></li>`).join('')+'</ul>';
 list.querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',()=>usePreset(+b.dataset.use)));
 list.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>delPreset(+b.dataset.del)));
}
function currentPreset(name){
 return {name,fabric:S.fabric,over:S.over,margin:S.margin,marginIn:S.marginIn,custom:S.custom||'',w:$('fcW').value,h:$('fcH').value};
}
function savePreset(){
 const inp=$('fcPresetName');const name=String(inp&&inp.value||'').trim().slice(0,40);
 const msg=$('fcMsg');
 if(!name){if(msg)msg.textContent='Enter a name for this preset.';if(inp)inp.focus();return}
 const row=currentPreset(name);
 const i=namedPresets.findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
 if(i>=0)namedPresets[i]=row;else{
  if(namedPresets.length>=MAX_PRESETS){if(msg)msg.textContent='You already have '+MAX_PRESETS+' presets. Delete one to save another.';return}
  namedPresets.push(row);
 }
 save();paintPresets();if(msg)msg.textContent=t('fabric.preset.saved');
}
function usePreset(i){
 const p=namedPresets[i];if(!p)return;
 S.fabric=p.fabric;S.over=p.over;S.margin=p.margin;S.marginIn=p.marginIn;S.custom=p.custom||'';
 if(p.w)$('fcW').value=p.w;if(p.h)$('fcH').value=p.h;
 $('fcCount').value=S.fabric;if(!$('fcCount').value){S.fabric='aida:14';$('fcCount').value='aida:14'}
 $('fcCustom').value=S.custom||'';$('fcCustomBox').hidden=S.fabric!=='custom';
 radios('fcOver').forEach(r=>r.checked=+r.value===S.over);radios('fcMargin').forEach(r=>r.checked=r.value===S.margin);
 $('fcMarginBox').hidden=S.margin!=='custom';syncMarginInput();run();
}
function delPreset(i){
 if(!namedPresets[i])return;
 namedPresets.splice(i,1);save();paintPresets();
}
function init(){load();
 if(S.w)$('fcW').value=S.w;if(S.h)$('fcH').value=S.h;$('fcCount').value=S.fabric;if(!$('fcCount').value){S.fabric='aida:14';$('fcCount').value='aida:14'}$('fcCustom').value=S.custom||'';$('fcCustomBox').hidden=S.fabric!=='custom';
 radios('fcOver').forEach(r=>r.checked=+r.value===S.over);radios('fcMargin').forEach(r=>r.checked=r.value===S.margin);radios('fcUnit').forEach(r=>r.checked=r.value===S.unit);
 $('fcMarginBox').hidden=S.margin!=='custom';syncMarginInput();
 const pr=$('fcPrint');if(pr)pr.textContent=t('fabric.print')||pr.textContent;
 const pn=$('fcPresetNameL');if(pn)pn.textContent=t('fabric.preset.name');
 const ps=$('fcPresetSave');if(ps){ps.textContent=t('fabric.preset.save');ps.addEventListener('click',savePreset)}
 paintPresets();
 ['fcW','fcH'].forEach(id=>$(id).addEventListener('input',run));
 $('fcCustom').addEventListener('input',()=>{S.custom=$('fcCustom').value;run()});
 $('fcCount').addEventListener('change',()=>{const prev=S.fabric.split(':')[0];S.fabric=$('fcCount').value;$('fcCustomBox').hidden=S.fabric!=='custom';const typ=S.fabric.split(':')[0];
  if(typ!==prev&&typ!=='custom'){S.over=typ==='even'?2:1;radios('fcOver').forEach(r=>r.checked=+r.value===S.over)}run()});
 radios('fcOver').forEach(r=>r.addEventListener('change',()=>{S.over=+r.value;run()}));
 radios('fcMargin').forEach(r=>r.addEventListener('change',()=>{const was=S.marginIn;S.margin=r.value;$('fcMarginBox').hidden=S.margin!=='custom';if(S.margin==='custom'){S.marginIn=was;syncMarginInput()}run()}));
 $('fcMarginC').addEventListener('input',()=>{$('fcMarginC').dataset.dirty='1';run()});
 radios('fcUnit').forEach(r=>r.addEventListener('change',()=>{S.unit=r.value;syncMarginInput();run()}));
 $('fcCopy').addEventListener('click',async()=>{const tx=text();if(!tx){$('fcMsg').textContent='Fix the highlighted box first.';return}try{await navigator.clipboard.writeText(tx);$('fcMsg').textContent='Copied to clipboard.'}catch(e){$('fcMsg').textContent='Couldn\'t copy automatically. Select the sizes above and copy them.'}});
 $('fcPrint').addEventListener('click',()=>print());
 run()}
window.FlossFoxFabricUI={state:()=>({...S}),text,run,presets:()=>namedPresets.slice()};
init();
})();
