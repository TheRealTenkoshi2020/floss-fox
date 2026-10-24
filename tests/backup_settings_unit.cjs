const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../backup-core.js');
test('default reminders are opt-in, interval validation and future schemas are conservative',()=>{
 assert.equal(C.defaults().enabled,false);assert.equal(C.defaults().weeks,2);
 for(const d of [{...C.defaults(),schema:2},{...C.defaults(),weeks:0},{...C.defaults(),weeks:1.5},{...C.defaults(),weeks:53},{...C.defaults(),enabled:'yes'}])assert.equal(C.prefs(d),null);
 assert.equal(C.validPrefsString(JSON.stringify(C.defaults())),true);assert.equal(C.validPrefsString('{'),false);
 assert.equal(C.state({...C.emptyState(),schema:99}),null);assert.equal(C.state({...C.emptyState(),lastConfirmedAt:Infinity}),null);
});
test('interval fires at the boundary, never for demo/empty data, and snooze wins over major edits',()=>{
 const p={...C.defaults(),enabled:true},s={...C.emptyState(),enabledSince:1000};
 assert.equal(C.reminder(p,s,1000+2*C.WEEK-1,true).due,false);assert.equal(C.reminder(p,s,1000+2*C.WEEK,true).due,true);
 assert.equal(C.reminder(p,s,1000+3*C.WEEK,false).due,false);assert.equal(C.reminder(C.defaults(),s,1000+3*C.WEEK,true).due,false);
 const m={...s,majorToken:'new',snoozedUntil:5000};assert.equal(C.reminder(p,m,4999,true).due,false);assert.equal(C.reminder(p,m,5000,true).reason,'major-edit');
 assert.equal(C.reminder({...p,majorEdits:false},{...s,majorToken:'new'},1001,true).due,false);
});
test('confirmed save restarts the interval; missing enabled history does not fabricate a saved file',()=>{
 const p={...C.defaults(),enabled:true},s={...C.emptyState(),enabledSince:0,lastConfirmedAt:2*C.WEEK};
 assert.equal(C.reminder(p,s,3*C.WEEK,true).due,false);assert.equal(C.reminder(p,C.emptyState(),1000000,true).due,false);
});
test('major changes count actual additions, removals and metadata, ignore timestamps, and never mutate stash',()=>{
 const entry={n:2,partial:false,restock:false,confirmed:true,updated:'old'},before={'310':entry},same={'310':{...entry,updated:'new'}};
 const raw=JSON.stringify(before);assert.equal(C.majorChange(before,same).major,false);
 assert.equal(C.majorChange(before,{'310':{...entry,n:22}}).major,true);
 assert.equal(C.majorChange({'310':{...entry,n:20}},{}).major,true);
 const ten=Object.fromEntries(Array.from({length:10},(_,i)=>[String(i),{...entry,n:0,partial:true}]));assert.equal(C.majorChange({},ten).major,true);
 assert.equal(C.majorChange({},Object.fromEntries(Object.entries(ten).slice(0,9))).major,false);assert.equal(JSON.stringify(before),raw);
});
test('backup revision ignores export time and property order but detects new counts, settings and notes',()=>{
 const a={exported:'old',projects:[{id:'a',notes:'hello'}],threads:{threads:{'310':{n:2}}},prefs:{pip:'hidden'}};
 const b={...a,exported:'new'};assert.equal(C.revision(a),C.revision(b));
 b.threads={threads:{'310':{n:3}}};assert.notEqual(C.revision(a),C.revision(b));
 assert.equal(C.canonical({a:1,b:2}),C.canonical({b:2,a:1}));
});
test('download starts without claiming a successful save and does not invoke the picker',async()=>{
 let calls=0,picks=0;const result=await C.writeFile('all-data',{mode:'download',filename:'backup.json',picker:async()=>{picks++;},download:(t,n,m)=>{calls++;assert.equal(t,'all-data');assert.equal(n,'backup.json');assert.equal(m,'application/json');}});
 assert.equal(result.status,'download-started');assert.equal(calls,1);assert.equal(picks,0);
});
test('supported file writes complete before success is returned',async()=>{
 const steps=[];const result=await C.writeFile('data',{mode:'save',filename:'backup.json',picker:async o=>{assert.equal(o.suggestedName,'backup.json');return{createWritable:async()=>({write:async t=>steps.push(t),close:async()=>steps.push('closed')})};}});
 assert.equal(result.status,'file-written');assert.deepEqual(steps,['data','closed']);
});
test('cancel, failed writes, and unsupported picker stay distinct; canceled pickers never trigger fallback',async()=>{
 let downloads=0,aborts=0;const canceled=await C.writeFile('x',{mode:'save',picker:async()=>{const e=new Error('canceled');e.name='AbortError';throw e;},download:()=>downloads++});assert.equal(canceled.status,'canceled');assert.equal(downloads,0);
 const failed=await C.writeFile('x',{mode:'save',picker:async()=>({createWritable:async()=>({write:async()=>{throw new Error('disk full');},abort:async()=>{aborts++;}})}),download:()=>downloads++});assert.equal(failed.status,'failed');assert.equal(aborts,1);assert.equal(downloads,0);
 assert.equal((await C.writeFile('x',{mode:'save',picker:null,download:()=>downloads++})).status,'download-started');assert.equal(downloads,1);
});
/* GoatCounter is kept (Myke): the zero-analytics loader check was removed; tests/analytics_e2e.py covers analytics. */
