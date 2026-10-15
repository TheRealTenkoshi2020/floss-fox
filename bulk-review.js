/* Floss Fox v2 (increment 1): strict bulk list review for My Thread Collection.
   Uses FlossFoxBulkPasteReview (strict line parser) + the existing collection API (FlossFoxThreadsUI.data/replaceAll).
   No new storage keys or fields: entries keep {n,partial,restock,updated,confirmed?}. Nothing is written until "Save".
   - Lines with an amount: Set to / Add (user must pick) -> confirmed full skeins. Partial/restock flags are never changed.
   - Lines without an amount: new colour -> 1 full skein, NOT confirmed (same meaning as the existing Add box); existing colour -> unchanged.
   - More than 20 of one colour: a per-row tick is required. Any problem line blocks saving (no partial success).
   - Undo restores the exact collection from before the save. */
(function(){
if(typeof document==='undefined'||!window.FlossFoxBulkPasteReview||!window.FlossFoxThreadsUI)return;
const $=id=>document.getElementById(id),T=window.FlossFoxThreadsUI,CAP=()=>(window.FlossFoxParse&&FlossFoxParse.SKEIN_CAP)||20;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WHY={'unrecognized-or-ambiguous-format':'not a clear “DMC number x skeins” line (for example 310 x2)','unknown-color':'not a DMC color number','duplicate-color':'this color is already on an earlier line','quantity-out-of-range':'skeins must be 0 to 999'};
let st=null,undo=null;
function plan(){const mode=(document.querySelector('input[name="bkMode"]:checked')||{}).value||'';const cur=T.data().threads,ch=[];
 for(const r of st.r.rows){const e=cur[r.code];let next=null,note='';
  if(r.fullSkeins===null){if(e){note='No amount given: left unchanged.'}else{next={n:1,partial:false,restock:false};note='No amount given: added as 1 full skein, not confirmed. Check it later.'}}
  else if(!mode){note='Choose Set or Add above.'}
  else{const n=mode==='add'?(e?e.n:0)+r.fullSkeins:r.fullSkeins;if(n>999){note='Would be more than 999.';next=false}else{next={...(e||{partial:false,restock:false}),n,confirmed:true}}}
  ch.push({r,e,next,note})}
 return{mode,ch}}
function open(){const t=$('thAdd').value;if(!t.trim()){$('thStatus').textContent='Type or paste DMC numbers first, one per line.';return}
 let r;try{r=FlossFoxBulkPasteReview.parse(t,DMC)}catch(e){$('thStatus').textContent='That list is too long to review at once.';return}
 st={r,ok:{}};draw();$('bkPanel').hidden=false;$('bkPanel').focus()}
function draw(){const P=$('bkPanel'),{mode,ch}=plan(),lab=c=>c+(DMC[c]?' '+DMC[c].name:'');
 const over=ch.filter(x=>x.next&&x.next.n>CAP()&&!(x.e&&x.next.n<=x.e.n)),bad=st.r.errors.length||ch.some(x=>x.next===false);
 const need=ch.some(x=>x.r.fullSkeins!==null)&&!mode,unconf=over.some(x=>!st.ok[x.r.code]);
 const real=ch.filter(x=>x.next&&!(x.e&&x.e.n===x.next.n&&(x.e.confirmed===true)===(x.next.confirmed===true)));
 P.innerHTML=`<h3>Review before saving</h3><p class="hint">Nothing is saved yet. Partial-skein and Restock ticks are never changed here.</p>
<fieldset class="bkmode"><legend>Amounts on your list mean:</legend><label><input type="radio" name="bkMode" value="set"${mode==='set'?' checked':''}> <b>Set to</b> (replace my count)</label> <label><input type="radio" name="bkMode" value="add"${mode==='add'?' checked':''}> <b>Add</b> (on top of my count)</label></fieldset>
${st.r.errors.length?`<div class="errbox" role="alert"><b>${st.r.errors.length} line${st.r.errors.length===1?'':'s'} need fixing first:</b><ul>${st.r.errors.map(e=>`<li>Line ${e.line} “${esc(e.raw.trim())}”: ${esc(WHY[e.reason]||e.reason)}.</li>`).join('')}</ul>Stitch counts aren't skeins, so numbers like “310 1160” aren't guessed.</div>`:''}
<div class="bkwrap"><table class="bktab"><thead><tr><th scope="col">Color</th><th scope="col">Now</th><th scope="col">After</th><th scope="col">Note</th></tr></thead><tbody>${ch.map(x=>{const c=x.r.code,id='bkok-'+c.replace(/[^\w]/g,'_'),big=over.includes(x);
 return `<tr><th scope="row">DMC ${esc(lab(c))}</th><td>${x.e?x.e.n+(x.e.confirmed===true?'':' (not confirmed)'):'—'}</td><td>${x.next?x.next.n+(x.next.confirmed?'':' (not confirmed)'):'—'}</td><td>${esc(x.note)}${big?`<label class="bkok"><input type="checkbox" id="${id}" data-ok="${esc(c)}"${st.ok[c]?' checked':''}> Yes, ${x.next.n} full skeins is right (not a stitch count)</label>`:''}</td></tr>`}).join('')}</tbody></table></div>
<p class="hint" id="bkWhy">${bad?'Fix the lines above in the box, then review again.':need?'Choose Set or Add to continue.':unconf?`Tick to confirm counts over ${CAP()}.`:real.length?`${real.length} change${real.length===1?'':'s'} ready.`:'Nothing would change.'}</p>
<div class="row"><button type="button" class="pri" id="bkSave"${bad||need||unconf||!real.length?' disabled':''}>Save ${real.length} change${real.length===1?'':'s'}</button><button type="button" class="ghost" id="bkCancel">Cancel</button></div>`;
 P.querySelectorAll('input[name="bkMode"]').forEach(i=>i.onchange=()=>{draw();const n=P.querySelector('input[name="bkMode"]:checked');if(n)n.focus()});
 P.querySelectorAll('[data-ok]').forEach(i=>i.onchange=()=>{st.ok[i.dataset.ok]=i.checked;draw();const n=$(i.id);if(n)n.focus()});
 $('bkCancel').onclick=()=>{close();$('thStatus').textContent='Nothing changed.';$('thAdd').focus()};
 $('bkSave').onclick=()=>save(real)}
function close(){st=null;const P=$('bkPanel');P.hidden=true;P.innerHTML=''}
function save(real){if(!T.canSave()){$('thStatus').textContent='Not saved: saving is paused (see the note above).';return}
 const before=JSON.parse(JSON.stringify(T.data().threads)),next=JSON.parse(JSON.stringify(before)),now=new Date().toISOString(),C=T.core;
 for(const x of real){const v={n:x.next.n,partial:x.next.partial===true,restock:x.next.restock===true,updated:now,...(x.next.confirmed?{confirmed:true}:{})};const e=C.normEntry(x.r.code,v);if(!e){$('thStatus').textContent='Nothing saved: a row could not be checked.';return}next[x.r.code]=e}
 const ok=T.replaceAll({threads:next});if(!ok){T.replaceAll({threads:before});$('thStatus').textContent='Not saved: browser storage refused the change. Your collection is unchanged.';return}
 undo=before;close();$('thAdd').value='';
 $('bkUndo').hidden=false;$('thStatus').textContent=`Saved ${real.length} change${real.length===1?'':'s'}. You can undo this.`;$('bkUndo').focus()}
$('bkUndo').onclick=()=>{if(!undo)return;const ok=T.replaceAll({threads:undo});undo=null;$('bkUndo').hidden=true;$('thStatus').textContent=ok?'Undone. Your collection is back to how it was.':'Undo could not be saved in this browser.';$('thAdd').focus()};
$('thBulkBtn').onclick=open;
})();
