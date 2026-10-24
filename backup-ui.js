/* Integrates with the existing v2 exporter/importer. Never changes project/thread
 * schemas, never uploads data, and never calls a started download a saved file. */
(function(){'use strict';
const C=window.FlossFoxBackupCore,P=window.FlossFoxProjects,T=window.FlossFoxThreadsUI;
if(!C||!P||!T||!document.getElementById('settingsView'))return;
const $=id=>document.getElementById(id),PFX=P.KEY.replace(/\.v1$/,''),PREFKEY=PFX+'.backup-prefs.v1',STATEKEY=PFX+'.backup-state.v1';
let config=C.defaults(),meta=C.emptyState(),prefsWritable=true,stateWritable=true,busy=false,pending=null,externalChange=false;
let lastThreads=JSON.parse(JSON.stringify(T.data().threads));
function read(key,normalize,fallback){try{const raw=localStorage.getItem(key);if(raw===null)return{value:fallback(),writable:true};const value=normalize(JSON.parse(raw));return value?{value,writable:true}:{value:fallback(),writable:false};}catch(e){return{value:fallback(),writable:false};}}
function load(){const p=read(PREFKEY,C.prefs,C.defaults),s=read(STATEKEY,C.state,C.emptyState);config=p.value;meta=s.value;prefsWritable=p.writable;stateWritable=s.writable;if(config.enabled&&stateWritable&&meta.enabledSince===null)putState({...meta,enabledSince:Date.now()});}
function feedback(text,confirmation=false){$('bkFeedback').hidden=false;$('bkFeedbackMsg').textContent=text;$('bkConfirmSave').hidden=!confirmation;$('bkDownloadInstead').hidden=true;}
function putState(next){
 const latest=read(STATEKEY,C.state,C.emptyState);if(!latest.writable){stateWritable=false;return false;}
 try{localStorage.setItem(STATEKEY,JSON.stringify(next));meta=next;stateWritable=true;return true;}catch(e){stateWritable=false;return false;}
}
function hasData(){return P._store().projects.some(p=>!p.demo)||Object.keys(T.data().threads).length>0;}
function render(){
 $('bkEnabled').checked=config.enabled;if(!Array.from($('bkWeeks').options).some(o=>o.value===String(config.weeks))){const option=document.createElement('option');option.value=String(config.weeks);option.textContent=config.weeks+' weeks';$('bkWeeks').appendChild(option);}$('bkWeeks').value=String(config.weeks);$('bkMajorEdits').checked=config.majorEdits;
 for(const id of ['bkEnabled','bkWeeks','bkMajorEdits'])$(id).disabled=!prefsWritable;
 $('bkWeeks').disabled=!prefsWritable||!config.enabled;$('bkMajorEdits').disabled=!prefsWritable||!config.enabled;
 $('bkLastSaved').textContent=meta.lastConfirmedAt===null?'No saved backup file has been confirmed in this browser.':'Last file save confirmed here: '+new Date(meta.lastConfirmedAt).toLocaleString()+'.';
 $('bkSettingsStatus').textContent=!prefsWritable?'Backup reminder settings could not be read or saved. They were left untouched; exporting still works.':!stateWritable?'This browser could not save reminder history. Exporting still works.':'';
 const due=stateWritable?C.reminder(config,meta,Date.now(),hasData()):{due:false};
 $('bkReminder').hidden=!due.due;
 $('bkReminderMsg').textContent=due.reason==='major-edit'?'Your collection changed by a large amount. Save a fresh backup file to keep a copy.':'It\'s time to save another backup file. Your projects and collection live in this browser.';
 for(const id of ['settingsExport','bkReminderExport'])$(id).disabled=busy;
}
function changePrefs(){
 if(!prefsWritable)return;
 const next=C.prefs({schema:1,enabled:$('bkEnabled').checked,weeks:Number($('bkWeeks').value),majorEdits:$('bkMajorEdits').checked});if(!next){feedback('Choose a backup interval from 1 to 52 whole weeks.');render();return;}
 const latest=read(PREFKEY,C.prefs,C.defaults);if(!latest.writable){prefsWritable=false;render();return;}
 try{localStorage.setItem(PREFKEY,JSON.stringify(next));if(!config.enabled&&next.enabled){const current=read(STATEKEY,C.state,C.emptyState);if(current.writable)putState({...current.value,enabledSince:Date.now(),snoozedUntil:null});}config=next;}
 catch(e){prefsWritable=false;}render();
}
function confirmed(snapshot){
 if(snapshot.savingPaused){feedback('A file copy was saved for the data currently readable in this tab. Some saved data could not be read, so this was not recorded as a complete backup.');return false;}
 const current=read(STATEKEY,C.state,C.emptyState);if(!current.writable||externalChange){feedback(externalChange?'A file copy was saved, but another tab changed your data. Reload and save a fresh copy before relying on it as the latest backup.':'A file copy was saved, but reminder history could not be stored.');return false;}
 const unchanged=C.revision(P.fullBackup())===snapshot.revision;
 const next={...current.value,lastConfirmedAt:Date.now(),snoozedUntil:null,majorToken:unchanged?null:current.value.majorToken};
 const ok=putState(next);
 feedback(!ok?'A file copy was saved, but reminder history could not be stored.':unchanged?'Backup file save confirmed. Keep the file somewhere safe.':'Backup file save confirmed. Your data changed after that copy was prepared; save another copy to include the newest changes.');
 render();return ok;
}
async function exportBackup(options={}){
 if(busy)return{status:'busy'};
 busy=true;pending=null;$('bkConfirmSave').hidden=true;render();
 let snapshot;
 try{
  const data=P.fullBackup(),text=JSON.stringify(data,null,2);snapshot={revision:C.revision(data),savingPaused:!P.canSave()||!T.canSave()};
  const result=await C.writeFile(text,{mode:options.mode==='save'?'save':'download',picker:typeof window.showSaveFilePicker==='function'?window.showSaveFilePicker.bind(window):null,download:P.downloadBackupText,filename:'floss-fox-backup-'+data.exported.slice(0,10)+'.json'});
  if(result.status==='file-written')confirmed(snapshot);
  else if(result.status==='download-started'){pending=snapshot;feedback('Download started. Check that the JSON file was saved, then confirm below. A download starting does not confirm the file was saved.',true);}
  else if(result.status==='canceled')feedback('Backup was not saved. Your data and previous backup history are unchanged.');
  else{feedback('The backup file could not be saved. Your data and previous backup history are unchanged.');$('bkDownloadInstead').hidden=false;}
  return result;
 }catch(e){feedback('The backup could not be prepared. Your existing data was not changed.');return{status:'failed'};}
 finally{busy=false;render();}
}
function noteInventoryChanged(){
 const current=T.data().threads,change=C.majorChange(lastThreads,current);lastThreads=JSON.parse(JSON.stringify(current));
 if(change.major&&config.enabled&&config.majorEdits){const latest=read(STATEKEY,C.state,C.emptyState);if(latest.writable)putState({...latest.value,majorToken:String(Date.now())+'-'+Math.random().toString(36).slice(2)});}
 render();
}
$('settingsExport').onclick=()=>exportBackup({mode:'save'});
$('settingsImport').onclick=()=>$('restoreFile').click();
$('bkReminderExport').onclick=()=>exportBackup();
$('bkReminderLater').onclick=()=>{const latest=read(STATEKEY,C.state,C.emptyState);if(latest.writable)putState({...latest.value,snoozedUntil:Date.now()+C.DAY});render();};
$('bkReminderSettings').onclick=()=>P.showView('settings');
$('bkConfirmSave').onclick=()=>{if(!pending)return;const copy=pending;pending=null;$('bkConfirmSave').hidden=true;confirmed(copy);};
$('bkDismissFeedback').onclick=()=>{pending=null;$('bkConfirmSave').hidden=true;$('bkFeedback').hidden=true;};
$('bkDownloadInstead').onclick=()=>exportBackup();
for(const id of ['bkEnabled','bkWeeks','bkMajorEdits'])$(id).onchange=changePrefs;
window.addEventListener('ff:data-saved',e=>{if(e.detail&&e.detail.area==='threads')noteInventoryChanged();else render();});
window.addEventListener('storage',e=>{if(e.key===PREFKEY||e.key===STATEKEY){load();render();}else if(e.key===P.KEY||e.key===T.KEY)externalChange=true;});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();render();}});
window.addEventListener('hashchange',render);window.addEventListener('pageshow',()=>{load();render();});
load();render();
// Recheck only while this page is open; no background/notification permission.
setInterval(()=>{if(!document.hidden)render();},60000);
window.FlossFoxBackupUI={exportBackup,noteInventoryChanged,refresh:()=>{load();render();},PREFKEY,STATEKEY};
})();
