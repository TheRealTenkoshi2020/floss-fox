/* Project editor component; no independent storage or hidden inventory writes. */
(function(root){
'use strict';
const S=root.FlossFoxSkeins;
const escape=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function initial(project,fabricPreference){
 if(project.skeinEstimator)return{...project.skeinEstimator};
 const d={...S.DEFAULTS};
 try{const pref=JSON.parse(fabricPreference||'null');const f=pref&&pref.v===1&&pref.s;
  if(f&&typeof f.fabric==='string'){const parts=f.fabric.split(':'),count=parts[0]==='custom'?Number(f.custom):Number(parts[1]);
   const candidate={...d,fabric:parts[0]==='even'?'even':'aida',count,over:parts[0]==='even'?f.over:1};if(S.validate(candidate).ok)return candidate;
  }
 }catch(e){}
 return d;
}
function html(project,known,fam,preference,pipVisible){
 const s=initial(project,preference),active=s.enabled===true;
 const rs=project.items.map(it=>({it,r:S.requirement(it,active?s:null,known,fam(it.code),project.buyBrand)}));
 const estimated=rs.filter(x=>x.r.estimate.kind==='estimate'),missing=rs.filter(x=>x.r.estimate.kind==='review');
 const guidance=active?(missing.length?'Some colors need a check first, so their amounts stay open for now.':'These amounts are estimates. I\'ve added your selected extra allowance.'):'Check the fabric count and strands your pattern uses. No amounts change until you turn on Use Pip’s estimates in this project.';
 return`<details class="skein-panel noprint" id="pSkein"${active||!S.validate(s).ok?' open':''}><summary class="skein-summary"><span class="skein-summary-mark" aria-hidden="true">${pipVisible?'<picture><source type="image/webp" srcset="assets/pip/pip-thinking-160.webp"><img src="assets/pip/pip-thinking-160.png" width="160" height="240" alt="" loading="lazy"></picture>':'🧶'}</span><span class="skein-summary-text"><span class="skein-summary-title">Estimate skeins with Pip${active?' <span class="skein-on">on</span>':''}</span><span class="skein-summary-desc">Turn stitch counts into whole-skein estimates for this project’s fabric and strands.</span></span><span class="skein-summary-chev" aria-hidden="true">▾</span></summary>
 <div class="skein-body"><div class="skein-message">${pipVisible?'<picture><source type="image/webp" srcset="assets/pip/pip-curious-160.webp"><img src="assets/pip/pip-curious-160.png" width="160" height="240" alt="" loading="lazy"></picture>':''}<p>${escape(guidance)}</p></div>
 <p class="hint">Full crosses in standard DMC cotton. This estimates the complete pattern, not the thread left to finish a work in progress. Existing supplied skein amounts remain in use.</p>
 <div class="skein-fields">
 <div><label for="seFabric">Fabric type</label><select id="seFabric"><option value="aida"${s.fabric==='aida'?' selected':''}>Aida</option><option value="even"${s.fabric==='even'?' selected':''}>Linen / evenweave</option></select></div>
 <div><label for="seCount">Fabric count (per inch)</label><input id="seCount" type="number" min="6" max="80" step="1" inputmode="numeric" value="${escape(s.count)}"></div>
 <div><label for="seOver">Stitch over</label><select id="seOver"${s.fabric==='aida'?' disabled':''}><option value="1"${s.over===1?' selected':''}>1 ${s.fabric==='aida'?'Aida square':'fabric thread'}</option><option value="2"${s.over===2?' selected':''}>2 fabric threads (linen/evenweave)</option></select></div>
 <div><label for="seStrands">Strands per finished cross</label><select id="seStrands">${[1,2,3,4,5,6].map(n=>`<option value="${n}"${s.strands===n?' selected':''}>${n} strand${n===1?'':'s'}</option>`).join('')}</select></div>
 <div><label for="seExtra">Extra above the provisional average</label><select id="seExtra">${S.EXTRAS.map(n=>`<option value="${n}"${s.extraPercent===n?' selected':''}>${n}% extra</option>`).join('')}</select></div></div>
 <p class="hint">A single strand folded for a two-strand loop start counts as 2 strands. Per-color strand instructions in Details override this default.</p>
 <div class="skein-toggles">
 <label class="skein-toggle"><input type="checkbox" id="seFull"${s.fullCrosses===true?' checked':''}><span class="skein-switch" aria-hidden="true"></span><span class="skein-toggle-copy"><span class="skein-toggle-title">Confirm counts are full crosses</span><span class="skein-toggle-hint">Turn on when colors without a stitch-type note are full crosses. Specialty stitches still need their own check.</span></span></label>
 <label class="skein-toggle"><input type="checkbox" id="seEnabled"${active?' checked':''}><span class="skein-switch" aria-hidden="true"></span><span class="skein-toggle-copy"><span class="skein-toggle-title">Use Pip’s estimates in this project</span><span class="skein-toggle-hint">Turn on to fill missing or wholly assumed quantities. Your Have enough / Need to buy choices stay as they are.</span></span></label>
 </div>
 <p class="hint">${project.skeinEstimator?'Saved project settings.':'Starting settings. Check them against your pattern.'} Your Have enough / Need to buy choices and thread collection are not changed.</p>
 <div class="row"><button type="button" class="pri" id="seSave">${active?'Update estimates':'Save estimator choices'}</button><button type="button" class="ghost" id="seDefaults">Reset estimator controls</button></div>
 <p id="seError" class="warn skein-error" role="alert">${S.validate(s).ok?'':escape(S.validate(s).error)}</p>
 ${active?`<p class="hint skein-assumptions">${escape(S.assumptions(s))}</p><p class="hint">${estimated.length} of ${project.items.length} colors estimated${missing.length?` · ${missing.length} omitted; total incomplete`:''}. Whole-skein figures below are before stock, not additional purchases.</p><ul class="skein-results">${rs.map(({it,r})=>{const e=r.estimate;return`<li><b>DMC ${escape(it.code)}</b>${e.kind==='estimate'?` · ${it.stitchCount.toLocaleString('en-US')} full crosses<small>About ${S.fmt(e.base)} skeins used · about ${S.fmt(e.planning)} with extra · ${e.whole} whole skeins before stock · ${e.strands} strands</small><small>${r.source==='stated'||r.source==='partly-assumed'?'Your supplied requirement is retained.':r.source==='unavailable'?escape(r.reason):'Estimated quantity is used in this project’s preparation plan.'}</small>`:`<small>Check first: ${escape(e.reason||r.reason||'review settings')}</small>`}</li>`}).join('')}</ul>`:''}
 <details><summary>How Pip estimates</summary><p class="hint">One DMC cotton skein contains 8 meters of six separable strands. A small set of community measurements and a stitcher’s measured/estimated chart inform a provisional average of about 2,100 full crosses on 14-count with two strands, before your extra. With 20% extra, Pip budgets about 1,750 stitches per skein. Other stitch sizes and strand counts are scaled estimates.</p><p class="hint">The reports mostly describe efficient stitching. Their thread use already includes discarded ends. Increase extra for scattered stitches, long carries, frequent starts or unpicking; 50% and 100% are available for more allowance. Actual use may fall outside these estimates.</p><p class="hint"><a href="https://www.dmc.com/US/en/products/mouline-stranded-thread/mouline-special" target="_blank" rel="noopener noreferrer">DMC skein details</a> · <a href="https://www.reddit.com/r/CrossStitch/comments/1dmthpn" target="_blank" rel="noopener noreferrer">Community skein experiment</a> · <a href="https://www.lindystitches.com/blogs/news/how-many-skeins-of-floss-will-i-need" target="_blank" rel="noopener noreferrer">Stitcher’s chart</a></p></details></div></details>`;
}
function bind(container,project,save,onSaved){
 const get=id=>container.querySelector('#'+id),err=get('seError');if(!err)return;
 get('seFabric').onchange=()=>{get('seOver').disabled=get('seFabric').value==='aida';if(get('seOver').disabled)get('seOver').value='1'};
 get('seDefaults').onclick=()=>{const d=S.DEFAULTS;get('seFabric').value=d.fabric;get('seCount').value=d.count;get('seOver').value=d.over;get('seOver').disabled=true;get('seStrands').value=d.strands;get('seExtra').value=d.extraPercent;get('seFull').checked=false;get('seEnabled').checked=false;err.textContent='Controls reset. Save to change this project.'};
 get('seSave').onclick=()=>{
  const count=S.wholeInput(get('seCount').value,6,80,'fabric count');
  if(!count.ok){err.textContent=count.error;get('seCount').setAttribute('aria-invalid','true');get('seCount').focus();return}
  const candidate={version:S.VERSION,enabled:get('seEnabled').checked,fabric:get('seFabric').value,count:count.value,over:Number(get('seOver').value),strands:Number(get('seStrands').value),extraPercent:Number(get('seExtra').value),fullCrosses:get('seFull').checked};
  const valid=S.validate(candidate);if(!valid.ok){err.textContent=valid.error;return}
  if(candidate.enabled&&!candidate.fullCrosses&&!project.items.every(it=>it.stitchType==='full')){err.textContent='Confirm the full-cross counts before using estimates.';get('seFull').focus();return}
  project.skeinEstimator=candidate;save(project);if(onSaved)onSaved(candidate.enabled?'Pip’s estimates updated. Your stock and manual choices were kept.':'Estimates are off. Your original amounts are back in use.');
 };
}
root.FlossFoxSkeinsUI={initial,html,bind};
})(typeof window!=='undefined'?window:this);
