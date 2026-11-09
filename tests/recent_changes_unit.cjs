// Recent changes core tests (Node). Results are simulated (synthetic data, no browser).
const R=require('../recent-changes.js');let pass=0,fail=0;
const ok=(n,c,i='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+i))};
const ctx={projectName:id=>id==='p1'?'My <b>sampler</b>':null,fmtDate:t=>'D:'+t};
const ev=(id,t,k,ref,from,to)=>({id,t,k,ref,from,to});
const E=[ev('a','2026-11-01T10:00:00Z','inventory',{code:'310'},{n:2,partial:false},{n:3,partial:true}),
 ev('b','2026-11-02T10:00:00Z','project',{pid:'p1'},'planning','done'),
 ev('c','2026-11-03T10:00:00Z','shopping',{code:'321'},false,true),
 ev('d','2026-11-04T10:00:00Z','shopping',{pid:'p1',code:'699'},false,true),
 ev('e','2026-11-05T10:00:00Z','inventory',{code:'BLANC'},null,{n:1,partial:false}),
 ev('f','2026-11-06T10:00:00Z','project',{pid:'gone'},'progress',null)];
const r=R.describe(E,ctx),L=r.items;
ok('ORDER newest first',L.map(x=>x.id).join('')==='fedcba',L.map(x=>x.id));
ok('INV before/after readable',L[5].text==='Floss 310: 2 skeins → 3 skeins plus a partial',L[5].text);
ok('PROJ status labels + name kept as plain string',L[4].text==='My <b>sampler</b>: Planning → Completed',L[4].text);
ok('SHOP restock flag',L[3].text==='Floss 321 added to your shopping list',L[3].text);
ok('SHOP project color',L[2].text==='My <b>sampler</b>: floss 699 marked Need to buy',L[2].text);
ok('BLANC shown as its own code, never WHITE',L[1].text==='Floss BLANC added to My threads (1 skein)'&&!/white/i.test(L[1].text),L[1].text);
ok('Removed project with unknown name is honest',L[0].text==='A project no longer saved was removed',L[0].text);
ok('DATE uses provided local formatter',L[0].when==='D:2026-11-06T10:00:00Z');
ok('KIND labels',L.map(x=>x.kind).join(',')==='Project,Threads,Shopping,Shopping,Project,Threads',L.map(x=>x.kind));
const bad=[null,5,'x',{},ev('g','nope','inventory',{code:'1'},null,null),ev('h','2026-11-01T00:00:00Z','milestone',{},1,2),ev('i','2026-11-01T00:00:00Z','inventory',{code:{}},null,{n:1}),ev('j','2026-11-01T00:00:00Z','project',{pid:'p1'},'weird','done')];
let r2;try{r2=R.describe(bad.concat([E[0]]),ctx)}catch(e){r2=null}
ok('MALFORMED skipped, never throws',r2&&r2.items.length===1&&r2.skipped===8,r2&&JSON.stringify(r2));
ok('MISSING journal = empty',R.describe(undefined,ctx).items.length===0&&R.describe(null).items.length===0);
const inv2=R.describe([ev('k','2026-11-01T00:00:00Z','inventory',{code:'310'},{n:3,partial:false},null)],ctx).items[0].text;
ok('INV removed',inv2==='Floss 310 removed from My threads (was 3 skeins)',inv2);
const s2=R.describe([ev('m','2026-11-01T00:00:00Z','shopping',{pid:'p1',code:'699'},true,false),ev('n','2026-11-01T00:00:01Z','shopping',{code:'5'},true,false)],ctx).items.map(x=>x.text);
ok('SHOP off texts',s2[1]==='My <b>sampler</b>: floss 699 no longer marked Need to buy'&&s2[0]==='Floss 5 taken off your shopping list',s2);
ok('NO em dashes in copy',!/\u2014/.test(JSON.stringify(r)+R.LIMITS+R.EMPTY));
console.log(`\n${pass} passed, ${fail} failed (simulated)`);process.exit(fail?1:0);
