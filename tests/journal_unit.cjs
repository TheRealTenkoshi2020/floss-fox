// Phase 1 event journal: pure core tests (Node). Results are simulated (synthetic data, no browser).
const J=require('../journal.js');let pass=0,fail=0;
const ok=(n,c,i='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+i))};
const st=(inv,proj)=>J.project({schema:2,projects:proj||[]},{schema:2,threads:inv||{}});
const P=(id,status,dec,demo)=>({id,name:id,status,decisions:dec||{},...(demo?{demo:true}:{})});
let n=0;const id=()=>'e'+(++n);const T0=Date.parse('2026-11-01T12:00:00Z');
// first record = baseline only
let s0=st({'310':{n:2}},[P('p1','planning')]);let j=J.record(null,s0,T0,new Set(),id);
ok('BASE-1 first observation records no events',j.events.length===0&&j.base.sig===J.sig(s0));
let ses=new Set();
j=J.record(j,st({'310':{n:3}},[P('p1','planning')]),T0+1000,ses,id);
ok('INV-1 inventory change recorded',j.events.length===1&&j.events[0].k==='inventory'&&j.events[0].from.n===2&&j.events[0].to.n===3,JSON.stringify(j.events));
j=J.record(j,st({'310':{n:3}},[P('p1','planning')]),T0+2000,ses,id);
ok('DUP-1 same state saved again adds nothing',j.events.length===1);
j=J.record(j,st({'310':{n:4}},[P('p1','planning')]),T0+3000,ses,id);
ok('FOLD-1 quick follow-up edit folds into one event',j.events.length===1&&j.events[0].from.n===2&&j.events[0].to.n===4);
j=J.record(j,st({'310':{n:2}},[P('p1','planning')]),T0+4000,ses,id);
ok('UNDO-1 reverting in session removes the event (no phantom)',j.events.length===0);
j=J.record(j,st({'310':{n:2}},[P('p1','done',{'310':{status:'buy'}})]),T0+5000,ses,id);
ok('PROJ-1 completion recorded',j.events.some(e=>e.k==='project'&&e.to==='done'));
ok('SHOP-1 Need to buy recorded',j.events.some(e=>e.k==='shopping'&&e.ref.pid==='p1'&&e.ref.code==='310'&&e.to===true));
j=J.record(j,st({'310':{n:2,restock:true}},[P('p1','done',{'310':{status:'buy'}})]),T0+6000,ses,id);
ok('SHOP-2 restock flag recorded',j.events.some(e=>e.k==='shopping'&&e.ref.code==='310'&&!e.ref.pid&&e.to===true));
// older session events are never folded
const other=new Set();j=J.record(j,st({'310':{n:2}},[P('p1','done',{'310':{status:'buy'}})]),T0+7000,other,id);
ok('UNDO-2 a later session records a reversal instead of rewriting history',j.events.filter(e=>e.ref.code==='310'&&!e.ref.pid&&e.k==='shopping').length===2);
const late=new Set();let j2=J.record(J.parse(j),st({'310':{n:9}},[P('p1','done',{'310':{status:'buy'}})]),T0+8000,late,id);
j2=J.record(j2,st({'310':{n:2}},[P('p1','done',{'310':{status:'buy'}})]),T0+8000+J.UNDO_MS+1,late,id);
ok('UNDO-3 reverting after the undo window is a new event',j2.events.filter(e=>e.k==='inventory').length===2);
// demo excluded
ok('DEMO-1 demo projects never tracked',!('d1'in st({},[P('d1','done',{},true)]).ps));
// import rebase: no events, dedupe incoming by id
const before=J.parse(j),cnt=before.events.length;
const incoming=[...before.events.slice(0,1),{id:'x1',t:'2026-10-01T00:00:00Z',k:'inventory',ref:{code:'321'},from:null,to:{n:1,partial:false}},{id:'x1',t:'2026-10-01T00:00:00Z',k:'inventory',ref:{code:'321'},from:null,to:{n:1,partial:false}},{bogus:1}];
const imported=st({'321':{n:1}},[P('p2','ready')]);let j3=J.rebase(before,imported,incoming);
ok('IMP-1 import adds no diff events and dedupes by id',j3.events.length===cnt+1&&j3.events.filter(e=>e.id==='x1').length===1,j3.events.length+' vs '+cnt);
let j4=J.rebase(j3,imported,incoming);ok('IMP-2 importing the same backup twice adds nothing',j4.events.length===j3.events.length);
let j5=J.rebase(j4,before.base.state,null);
ok('IMP-3 undo import (state back to checkpoint) drops imported events',!j5.events.some(e=>e.id==='x1')&&j5.events.length===cnt,j5.events.length);
ok('OLD-1 backup without journal imports with no events added',J.rebase(before,imported,undefined).events.length===cnt);
// tolerance
ok('ROBUST-1 garbage journal becomes empty',J.parse('{nope').events.length===0&&J.parse({schema:99}).events.length===0&&J.parse(null).base===null);
ok('ROBUST-2 invalid events filtered',J.parse({schema:1,events:[{id:'a'},null,5]}).events.length===0);
// cap
let big=J.record(null,st({},[]),T0,new Set(),id);const s2=new Set();
for(let i=0;i<600;i++)big=J.record(big,st({['c'+i]:{n:1}},[]),T0+i*1000,null,id);
ok('CAP-1 journal capped at MAX_EVENTS (oldest dropped)',big.events.length===J.MAX_EVENTS&&big.events[big.events.length-1].ref.code==='c599');
ok('CAP-2 checkpoints capped',big.cps.length<=12);
ok('SIZE-1 capped journal stays small (<200 KB)',JSON.stringify(big).length<200000,JSON.stringify(big).length);
console.log(`journal_unit: ${pass} passed, ${fail} failed (simulated)`);process.exit(fail?1:0);
