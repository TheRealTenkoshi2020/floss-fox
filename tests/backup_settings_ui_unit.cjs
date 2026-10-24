/* Controller integration with injected DOM/file/storage APIs. Uses the actual
 * fullBackup() from projects.js. This is not a layout/browser-render test. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../backup-core.js');
const KEY='flossfox-dev.v1',TK='flossfox-dev.threads.v1',PK='flossfox-dev.backup-prefs.v1',SK='flossfox-dev.backup-state.v1';
function harness({prefs=null,meta=null,failWrites=false,savingPaused=false}={}){
 const nodes=new Map(),events=new Map(),downloads=[],db=new Map();let now=2000000000;
 class Node{constructor(){this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.textContent='';this.options=[];}appendChild(o){this.options.push(o);}}
 for(const id of ['settingsView','bkFeedback','bkFeedbackMsg','bkConfirmSave','bkDownloadInstead','bkEnabled','bkWeeks','bkMajorEdits','bkLastSaved','bkSettingsStatus','bkReminder','bkReminderMsg','settingsExport','settingsImport','bkReminderExport','bkReminderLater','bkReminderSettings','bkDismissFeedback','restoreFile'])nodes.set(id,new Node());
 for(const id of ['bkFeedback','bkConfirmSave','bkDownloadInstead','bkReminder'])nodes.get(id).hidden=true;
 nodes.get('bkWeeks').options=['1','2','4','8','12'].map(value=>({value}));
 const store={schema:2,projects:[{id:'real',name:'Fixture',notes:'Cross-stitch — fixture',items:[{code:'310',qty:2,assumed:0,stitchCount:1160}]},{id:'demo',demo:true,items:[]}]};
 const data={schema:2,threads:{'310':{n:2,partial:false,restock:false,confirmed:true,storage:{container:'Box 3',slot:'A2'}},'321':{n:0,partial:true,restock:true,confirmed:true}},demo:{'666':{n:3}}};
 db.set(KEY,JSON.stringify(store));db.set(TK,JSON.stringify(data));if(prefs!==null)db.set(PK,typeof prefs==='string'?prefs:JSON.stringify(prefs));if(meta!==null)db.set(SK,typeof meta==='string'?meta:JSON.stringify(meta));
 const add=(name,f)=>events.set(name,[...(events.get(name)||[]),f]);
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const T={data:()=>data,canSave:()=>!savingPaused,exportData:()=>({schema:2,threads:JSON.parse(JSON.stringify(data.threads))})};
 const P={KEY,_store:()=>store,canSave:()=>!savingPaused,downloadBackupText:(text,name,type)=>downloads.push({text,name,type}),showView:()=>{}};
 const sandbox={FlossFoxBackupCore:C,FlossFoxProjects:P,FlossFoxThreadsUI:T,document:{hidden:false,getElementById:id=>nodes.get(id)||null,createElement:()=>new Node(),addEventListener:add},localStorage:{getItem:k=>db.get(k)??null,setItem:(k,v)=>{if(failWrites)throw new Error('storage blocked');db.set(k,v);}},Date:Clock,setInterval:(fn,period)=>{assert.equal(period,60000);return 1;},addEventListener:add,console,SCHEMA:2,BK_VERSION:2,store,TUI:()=>T,nowISO:()=>new Clock().toISOString(),lsGet:k=>db.get(k)??null};
 sandbox.window=sandbox;
 const projectSource=fs.readFileSync(require.resolve('../projects.js'),'utf8');
 const prefKeys=projectSource.match(/const PREF_KEYS=(\{[^\n]+\});/);assert.ok(prefKeys);
 const exporter=projectSource.slice(projectSource.indexOf('function fullBackup()'),projectSource.indexOf('\nfunction backup('));assert.ok(exporter.includes('store.projects.filter'));
 const context=vm.createContext(sandbox);vm.runInContext('const PFX="flossfox-dev"; const PREF_KEYS='+prefKeys[1]+';\n'+exporter+';globalThis.__export=fullBackup;',context);P.fullBackup=sandbox.__export;
 vm.runInContext(fs.readFileSync(require.resolve('../backup-ui.js'),'utf8'),context);
 return{ui:sandbox.FlossFoxBackupUI,nodes,db,downloads,P,T,store,data,sandbox,emit:(name,value)=>{for(const f of events.get(name)||[])f(value);},advance:n=>{now+=n;},state:()=>JSON.parse(db.get(SK)||'null'),raw:()=>[db.get(KEY),db.get(TK)]};
}
test('controller starts quietly and exported actual v2 data keeps quantities, locations and partials without demos',async()=>{
 const h=harness(),before=h.raw();assert.equal(h.db.has(SK),false);assert.equal(h.nodes.get('bkReminder').hidden,true);
 const r=await h.ui.exportBackup();assert.equal(r.status,'download-started');assert.equal(h.state(),null);assert.equal(h.nodes.get('bkConfirmSave').hidden,false);
 const d=JSON.parse(h.downloads[0].text);assert.equal(d.version,2);assert.equal(d.schema,2);assert.equal(d.projects.length,1);assert.equal(d.projects[0].items[0].stitchCount,1160);assert.equal(d.threads.threads['310'].storage.slot,'A2');assert.equal(d.threads.threads['321'].partial,true);assert.equal(d.threads.demo,undefined);assert.deepEqual(h.raw(),before);
 h.nodes.get('bkConfirmSave').onclick();assert.ok(h.state().lastConfirmedAt);assert.deepEqual(h.raw(),before);
});
test('an exported older snapshot cannot clear a newer major-edit reminder',async()=>{
 const h=harness({prefs:{...C.defaults(),enabled:true}});await h.ui.exportBackup();h.data.threads['310'].n+=20;h.emit('ff:data-saved',{detail:{area:'threads'}});const token=h.state().majorToken;assert.ok(token);
 h.nodes.get('bkConfirmSave').onclick();assert.equal(h.state().majorToken,token);assert.equal(h.nodes.get('bkReminder').hidden,false);
 await h.ui.exportBackup();h.nodes.get('bkConfirmSave').onclick();assert.equal(h.state().majorToken,null);assert.equal(h.nodes.get('bkReminder').hidden,true);
});
test('file-picker cancellation and failure preserve prior history without a duplicate download',async()=>{
 const initial={...C.emptyState(),lastConfirmedAt:1000},h=harness({meta:initial});
 h.sandbox.showSaveFilePicker=async()=>{const e=new Error('canceled');e.name='AbortError';throw e;};assert.equal((await h.ui.exportBackup({mode:'save'})).status,'canceled');assert.deepEqual(h.state(),initial);assert.equal(h.downloads.length,0);
 let aborted=false;h.sandbox.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{throw new Error('full');},abort:async()=>{aborted=true;}})});
 assert.equal((await h.ui.exportBackup({mode:'save'})).status,'failed');assert.equal(aborted,true);assert.deepEqual(h.state(),initial);assert.equal(h.nodes.get('bkDownloadInstead').hidden,false);
});
test('a successful writer updates history only after close, with the full actual JSON payload',async()=>{
 const h=harness();let release,contents='';h.sandbox.showSaveFilePicker=async()=>({createWritable:async()=>({write:async t=>{contents=t;},close:()=>new Promise(r=>{release=r;})})});
 const saving=h.ui.exportBackup({mode:'save'});for(let i=0;i<10&&!release;i++)await Promise.resolve();assert.equal(typeof release,'function');assert.equal(h.state(),null);assert.equal(h.nodes.get('settingsExport').disabled,true);
 release();await saving;assert.ok(h.state().lastConfirmedAt);assert.equal(JSON.parse(contents).projects[0].notes,'Cross-stitch — fixture');assert.equal(h.nodes.get('settingsExport').disabled,false);assert.equal(h.nodes.get('bkConfirmSave').hidden,true);
});
test('imported enabled preferences begin an interval without falsely claiming a file save',()=>{
 const h=harness({prefs:{...C.defaults(),enabled:true,weeks:3}});assert.ok(h.state().enabledSince);assert.equal(h.state().lastConfirmedAt,null);assert.equal(h.nodes.get('bkWeeks').value,'3');assert.ok(h.nodes.get('bkWeeks').options.some(o=>o.value==='3'));
 h.advance(3*C.WEEK);h.ui.refresh();assert.equal(h.nodes.get('bkReminder').hidden,false);h.nodes.get('bkReminderLater').onclick();assert.equal(h.nodes.get('bkReminder').hidden,true);h.advance(C.DAY);h.ui.refresh();assert.equal(h.nodes.get('bkReminder').hidden,false);
});
test('future preference and history formats are preserved; backup export still works',async()=>{
 const future='{"schema":99,"enabled":true}',h=harness({prefs:future,meta:'{"schema":99}'});assert.equal(h.nodes.get('bkEnabled').disabled,true);const before=h.raw();await h.ui.exportBackup();h.nodes.get('bkConfirmSave').onclick();assert.equal(h.db.get(PK),future);assert.equal(h.db.get(SK),'{"schema":99}');assert.deepEqual(h.raw(),before);
});
test('storage failures do not block file export or overwrite personal records',async()=>{
 const h=harness({failWrites:true}),before=h.raw();h.nodes.get('bkEnabled').checked=true;h.nodes.get('bkEnabled').onchange();assert.equal(h.nodes.get('bkEnabled').disabled,true);await h.ui.exportBackup();h.nodes.get('bkConfirmSave').onclick();assert.equal(h.state(),null);assert.deepEqual(h.raw(),before);assert.match(h.nodes.get('bkFeedbackMsg').textContent,/history could not be stored/);
});
test('unreadable saved app data and external-tab changes are never marked as complete current backups',async()=>{
 for(const options of [{savingPaused:true},{}]){const h=harness(options);if(!options.savingPaused)h.emit('storage',{key:KEY});await h.ui.exportBackup();h.nodes.get('bkConfirmSave').onclick();assert.equal(h.state(),null);assert.match(h.nodes.get('bkFeedbackMsg').textContent,/not recorded as a complete backup|another tab/);}
});
