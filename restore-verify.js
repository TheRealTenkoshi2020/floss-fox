/* Restore verification helpers. Pure, no storage of its own, no network.
   verifyKeys reads back each key and compares it with exactly what was meant to be saved. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxRestoreVerify=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const pl=(n,w)=>n+' '+w+(n===1?'':'s');
function verifyKeys(expected,get){const ks=Object.keys(expected||{});if(!ks.length)return{ok:false,mismatched:[]};const mm=[];
 for(const k of ks){let v;try{v=get(k)}catch(e){mm.push(k);continue}if(v!==expected[k])mm.push(k)}return{ok:!mm.length,mismatched:mm}}
function writeKeys(keys,set,remove){try{for(const k in keys){if(keys[k]===null)remove(k);else set(k,keys[k])}return true}catch(e){return false}}
function importMessage(r){const mode=r.mode==='replace'?'Replace':'Merge',head='Restore checked and saved ('+mode+'). ',old='This older backup has projects only, so your thread collection was not changed.';
 if(r.mode==='replace')return head+(r.full?'Your projects and thread collection now match the backup: '+pl(r.projects,'project')+' and '+pl(r.colors,'thread color')+'.':'Your projects now match the backup: '+pl(r.projects,'project')+'. '+old);
 return head+'Projects: '+r.add+' added, '+r.rep+' replaced, '+r.skip+' skipped, '+r.cp+' kept as copies. '+(r.full?'Thread colors: '+r.ta+' added; colors you already had kept their counts. You now have '+pl(r.projects,'project')+' and '+pl(r.colors,'thread color')+'.':old+' You now have '+pl(r.projects,'project')+'.')}
function failMessage(rolledBack){return rolledBack?'The restore could not be saved, so your data was put back how it was. Nothing was changed.':'The restore could not be saved and we could not confirm your data was put back. Before changing anything, use Undo last import, or import your backup again.'}
function copyMessage(r){return'Restored the copy from '+r.when+' and checked it: '+pl(r.projects,'project')+' and '+pl(r.colors,'thread color')+' are saved on this device.'}
return{verifyKeys,writeKeys,importMessage,failMessage,copyMessage};
});
