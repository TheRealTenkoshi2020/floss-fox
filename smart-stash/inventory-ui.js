/* Secondary collection upgrades: free export and audit, no sign-up, no paywalls.
   Separate from Smart Stash scanner to preserve existing UI if one enhancement fails.
*/
(function(root){'use strict';if(typeof document==='undefined')return;
const T=root.FlossFoxThreadsUI,U=root.FlossFoxSmartStashInventoryTools;if(!T||!U||typeof DMC!=='object')return;
const main=document.querySelector('#threadsView #thCard'),smart=document.getElementById('ffSmartStash');if(!main||!smart)return;
const el=(t,s)=>{const e=document.createElement(t);if(s!==undefined)e.textContent=s;return e};const button=(s,fn)=>{const b=el('button',s);b.type='button';b.className='sec';b.onclick=fn;return b};
const details=el('details');details.id='ffssInventoryTools';details.className='ffss-tools';details.append(el('summary','Review and export my collection'));
const contents=el('div');const status=el('p','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');contents.append(el('p','Check counts that need attention and save a portable copy of your thread inventory. Exporting never changes it.'));
const stats=el('div');stats.className='ffss-audit';contents.append(stats);
const actions=el('div');actions.className='ffss-actions';contents.append(actions);
function rows(){return U.collect(T.data(),DMC)}
function render(){let r;try{r=rows()}catch{stats.textContent='Collection is unavailable.';return}const m=U.metrics(r);stats.replaceChildren();
 for(const [name,n] of [['Colors',m.colors],['Full skeins',m.fullSkeins],['Counts to verify',m.unverified],['Partial-only colors',m.partialOnly],['Restock flags',m.restock],['Without storage location',m.missingLocation]]){const s=el('div');s.append(el('b',String(n)),el('span',name));stats.append(s)}}
function exportNow(format){try{const r=rows();if(!r.length){status.textContent='Add some real thread colors first. Demo colors are never exported.';return}
 const name='flossfox-threads-'+new Date().toISOString().slice(0,10);if(format==='csv')U.download(U.csv(r),name+'.csv','text/csv;charset=utf-8');else U.download(U.json(r),name+'.json','application/json');
 status.textContent=`Export prepared: ${r.length} real colors. Keep your usual full FlossFox backup separately.`;
 }catch(e){status.textContent='Export failed: '+String(e.message||e)}}
actions.append(button('Export CSV',()=>exportNow('csv')),button('Export JSON',()=>exportNow('json')),button('Refresh audit',render));contents.append(status);details.append(contents);smart.after(details);details.addEventListener('toggle',()=>{if(details.open)render()});
})(typeof window!=='undefined'?window:globalThis);
