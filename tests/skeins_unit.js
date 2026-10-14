// No dependencies. Covers arithmetic, actual project planning/export/import, and UI controls.
// Browser layout and real Android testing are separate, pending checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../skeins/calc.js'),html=fs.readFileSync(__dirname+'/../index.html','utf8');
const DMC=JSON.parse(html.match(/const DMC=(\{.*?\});/)[1]),C=require('../threads.js').core(DMC);
const settings={...S.DEFAULTS,enabled:true,fullCrosses:true};
const row=(code='310',stitchCount=2400)=>({code,qty:1,assumed:1,stated:false,stitchCount,src:[]});
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const fam=c=>/metallic/.test(DMC[c].name)?'metallic':/variegated/.test(DMC[c].name)?'variegated':'solid';
const est=(it=row(),s=settings)=>S.estimate(it,s,DMC,fam(it.code));
test('community baseline example and purchasing allowance',()=>{const e=est();near(e.base,8/7);near(e.planning,48/35);near(e.coverage,2100);assert.equal(e.whole,2)});
const evidence=JSON.parse(fs.readFileSync(__dirname+'/../skeins/evidence.json','utf8'));
test('source arithmetic reproduces provisional mean without extra votes for chart rows',()=>{
 const average=a=>a.reduce((n,x)=>n+x,0)/a.length;
 const groups=evidence.groups.map(g=>average(g.points.map(p=>{
  const m=p.measurement;
  const raw=m?(m.stitchesRange?average(m.stitchesRange):m.stitches)*48/m.singleStrandLengthMetres:p.stitchesPerYardOfSkein?p.stitchesPerYardOfSkein*8/0.9144:p.stitchesPerSkein;
  near(raw,p.stitchesPerSkein);
  return raw*14/p.effectiveCount*p.strands/2;
 })));
 assert.equal(groups.length,5);groups.forEach((v,i)=>near(v,evidence.result.groupNormalizedYields14[i]));
 near(average(groups),2108.3511162956484);near(average(groups),evidence.result.mean14);
 assert.equal(Math.round(average(groups)/100)*100,S.BASIS.fullCrossesPerSkein);
 assert.equal(new Set(evidence.groups.map(g=>g.id)).size,5);
 assert.equal(evidence.groups.filter(g=>g.kind==='whole-skein measurement').length,2);
 assert.equal(evidence.model,S.MODEL);
});
test('planning coverage is 1750/2000/2250 at two strands, without a second tail factor',()=>{
 for(const [count,coverage]of [[14,1750],[16,2000],[18,2250]]){const e=est(row('310',coverage),{...settings,count});near(e.planning,1);assert.equal(e.whole,1)}
});
test('larger allowance is valid and still needs rounding per color',()=>{const e=est(row('310',1051),{...settings,extraPercent:100});assert.equal(e.whole,2);near(est(row('310',1050),{...settings,extraPercent:100}).planning,1)});
test('over-two equivalence and over-one difference',()=>{near(est(row(),{...settings,fabric:'even',count:28,over:2}).planning,est().planning);near(est(row(),{...settings,fabric:'even',count:28,over:1}).planning,est().planning/2)});
test('per-color strands take precedence',()=>near(est({...row(),strandCount:3}).planning,est().planning*1.5));
test('extra is applied once',()=>near(est().planning,est(row(),{...settings,extraPercent:0}).planning*1.2));
test('unknown is not zero',()=>{for(const n of [null,undefined,'',NaN,-1,1.5,'2400'])assert.equal(est({...row(),stitchCount:n}).kind,'review');assert.equal(est(row('310',0)).whole,0);assert.equal(est(row('310',1)).whole,1)});
test('strict human input',()=>{for(const n of ['',null,'1e3','2.5','-1','Infinity'])assert.equal(S.wholeInput(n,0,1e7,'stitches').ok,false);assert.equal(S.wholeInput('0',0,1e7,'stitches').value,0)});
test('unsupported types and products',()=>{for(const stitchType of ['half','back','blend','fractional','mixed'])assert.equal(est({...row(),stitchType}).kind,'review');assert.equal(est(row('48')).kind,'review');assert.equal(est({...row(),threadFamily:'pearl'}).kind,'review');assert.equal(est({...row(),blend:true}).kind,'review')});
test('unknown type requires confirmation; explicit full type works',()=>{assert.equal(est(row(),{...settings,fullCrosses:false}).kind,'review');assert.equal(est({...row(),stitchType:'full'},{...settings,fullCrosses:false}).kind,'estimate')});
test('original specialty text cannot be overridden by checkbox',()=>assert.equal(est({...row(),src:['310 2400 backstitches']}).kind,'review'));
test('invalid settings cannot silently activate defaults',()=>{for(const o of [{count:0},{count:81},{over:2},{strands:0},{extraPercent:-1},{extraPercent:15},{version:99}])assert.equal(est(row(),{...settings,...o}).kind,'review');assert.equal(S.validate(S.normalize({version:99,enabled:true})).ok,false)});
test('supplied amounts never replaced or buffered',()=>{const r=S.requirement({...row(),qty:3,assumed:0,stated:true},settings,DMC,'solid','dmc');assert.equal(r.source,'stated');assert.equal(r.amount,3);assert.equal(r.estimate.kind,'estimate')});
test('partly supplied requirement stays distinct',()=>{const r=S.requirement({...row(),qty:3,assumed:1},settings,DMC,'solid','dmc');assert.equal(r.source,'partly-assumed');assert.equal(r.amount,3)});
test('disabled estimator keeps original assumed behavior',()=>assert.equal(S.requirement(row(),{...settings,enabled:false},DMC,'solid','dmc').amount,1));
test('unsupported replacement never gets DMC shopping quantity',()=>{const r=S.requirement(row(),settings,DMC,'solid','anchor');assert.equal(r.amount,null);assert.equal(r.estimate.kind,'estimate')});
test('stable whole-skein thresholds',()=>{for(const [n,w]of [[0,0],[1e-10,1],[.99999999,1],[1,1],[1+Number.EPSILON,1],[1.00000001,2],[1.004,2]])assert.equal(S.ceilWhole(n),w)});
test('subtract confirmed fractions before rounding',()=>{assert.equal(S.compareStock(1.2,.3,false).buy,1);assert.equal(S.compareStock(.9,1,true).buy,0);assert.equal(S.compareStock(1.2,1,true).kind,'check-first');assert.equal(S.compareStock(1.2,null,false).kind,'check-first')});
test('legacy collection counts are unverified for estimates',()=>{const r=S.compareProject([row()],settings,DMC,fam,{'310':{n:2}},'dmc');assert.equal(r.unverified.length,1);assert.equal(r.owned.length,0)});
test('confirmed full skeins cover even with unknown partial',()=>assert.equal(S.compareProject([row()],settings,DMC,fam,{'310':{n:2,partial:true,confirmed:true}},'dmc').owned.length,1));
test('insufficient full skeins plus unknown partial stay check-first',()=>assert.equal(S.compareProject([row()],settings,DMC,fam,{'310':{n:1,partial:true,confirmed:true}},'dmc').unverified.length,1));
test('assumed collection add is not confirmed',()=>{const d=C.empty();C.add(d,[row()]);assert.equal(d.threads['310'].confirmed,undefined);C.step(d,'310',1);assert.equal(d.threads['310'].confirmed,true)});
test('explicit owned quantity can be confirmed and round-trips',()=>{const d=C.empty();C.add(d,[{code:'310',qty:2,stated:true,assumed:0}]);assert.equal(C.migrate(d).data.threads['310'].confirmed,true)});
test('added assumed stock invalidates a former exact count',()=>{const d=C.empty();C.add(d,[{code:'310',qty:2}]);C.add(d,[row()]);assert.equal(d.threads['310'].confirmed,undefined)});
test('monotonic model across supported fabrics and strands',()=>{
 for(const n of [0,1,150,900,2400,10000,10000000])for(const count of [6,11,14,16,18,28,40])for(const strands of [1,2,3,6]){
  const a=S.compute(n,{...settings,count,strands,extraPercent:0}),b=S.compute(n,{...settings,count,strands});
  assert.ok(Number.isFinite(b.planning)&&b.planning>=a.planning);assert.ok(b.whole>=a.whole);
 }
});

// Execute the real projects.js definitions without booting the DOM-only wiring.
// It exercises the same normProject/plan/text/csv/checkBackup used by the app.
const storage=new Map(),elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',hidden:false,textContent:'',querySelector:()=>null,querySelectorAll:()=>[]});return elements.get(id)};
const collection={schema:1,threads:{}};
const context={console,setTimeout:()=>0,clearTimeout:()=>{},Date,Math,JSON,Number,Map,Set,isFinite,Blob,
 DMC,APP_NAME:'Floss Fox',BRAND:{dmc:'DMC',anchor:'Anchor',sullivans:'Sullivans'},PRICES:{checked:'fixture',dmc:{lo:1,hi:1},anchor:{lo:1,hi:1},sullivans:{lo:1,hi:1}},
 $:element,esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),fam,lab:c=>c,disp:(d,c)=>c,asmOf:i=>i.assumed||0,asmTxt:(q,a)=>a?' (assumed)':'',rng:(a,b)=>`${a}–${b}`,
 resolve:(it,dest,pick)=>({ok:true,to:dest==='dmc'?it.code:pick||DMC[it.code].anchor[0]||it.code,prov:'fixture'}),parse:require('../parse.js').make(DMC),
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:element,querySelector:()=>null},window:{FlossFoxSkeins:S}};
context.window.FlossFoxThreadsUI={data:()=>collection,compare:items=>C.compare(items,collection),exportData:()=>collection,core:C};
vm.createContext(context);
const source=fs.readFileSync(__dirname+'/../projects.js','utf8');
vm.runInContext(source.slice(0,source.indexOf('// ---- Wiring ----'))+'\nwindow.testApi={normProject,plan,planText,csv,checkBackup,fullBackup,cmpPlan,store,card,readyText};})();',context);
const P=context.window.testApi;
function project(items=[row()],overrides={}){const p=P.normProject({id:'test',name:'Test',items,decisions:{},purchased:{},buyBrand:'dmc',skeinEstimator:settings,...overrides});for(const i of p.items)p.decisions[i.code].status='buy';return p}
test('actual project shopping uses estimate without overwriting original qty',()=>{const p=project(),r=P.plan(p);assert.equal(r.lines[0].q,2);assert.equal(p.items[0].qty,1);assert.equal(p.items[0].assumed,1)});
test('per-color total is 4, not ceiling of all fractions',()=>assert.equal(P.plan(project([row(),row('321',900),row('3865',150)])).lines.reduce((n,l)=>n+l.q,0),4));
test('actual project plan subtracts verified stock first',()=>{const p=project();Object.assign(p.decisions['310'],{owned:1,ownedSource:'user'});assert.equal(P.plan(p).lines[0].q,1)});
test('unknown provenance and partials cannot generate confident shortage',()=>{const p=project();p.decisions['310'].owned=1;assert.equal(P.plan(p).checkFirst.length,1);p.decisions['310'].ownedSource='collection';p.decisions['310'].ownedPartial=true;assert.equal(P.plan(p).checkFirst.length,1)});
test('manual Have enough remains checked and receives recheck note',()=>{const p=project();Object.assign(p.decisions['310'],{status:'have',owned:1});const r=P.plan(p);assert.equal(r.have.length,1);assert.equal(r.ready,true);assert.equal(r.threads[0].recheck,true)});
test('manual Have enough on an assumed row survives missing estimate inputs',()=>{const p=project([row('310',null)]);p.decisions['310'].status='have';assert.equal(P.plan(p).have.length,1);assert.equal(P.plan(p).checkFirst.length,0);assert.equal(P.plan(p).threads[0].recheck,true)});
test('checked fingerprint clears note until input changes',()=>{const p=project();const e=est(p.items[0]);Object.assign(p.decisions['310'],{status:'have',estimateChecked:S.fingerprint(p.items[0],settings,e)});assert.equal(P.plan(p).threads[0].recheck,false);p.items[0].stitchCount++;assert.equal(P.plan(p).threads[0].recheck,true)});
test('older model fingerprint asks for review while preserving manual Have enough',()=>{const p=project(),e=est(p.items[0]);Object.assign(p.decisions['310'],{status:'have',estimateChecked:S.fingerprint(p.items[0],settings,e).replace(S.MODEL,'pip-dmc-full-cross-v1')});const r=P.plan(p);assert.equal(r.have.length,1);assert.equal(r.threads[0].recheck,true)});
test('unknown counts are check-first rather than default one-skein buy',()=>{const p=project([row('310',null)]);assert.equal(P.plan(p).checkFirst.length,1);assert.equal(P.plan(p).lines.length,0)});
test('zero full-cross amount creates no purchase',()=>assert.equal(P.plan(project([row('310',0)])).lines.length,0));
test('explicit requirement and estimate coexist without addition',()=>{const p=project([{...row(),qty:3,assumed:0,stated:true}]);assert.equal(P.plan(p).lines[0].q,3);assert.match(P.planText(p),/supplied requirement retained/)});
test('duplicate colors merge before rounding and subtract stock once',()=>{const p=project([row('310',900),row('310',900)]);assert.equal(p.items.length,1);Object.assign(p.decisions['310'],{owned:1,ownedSource:'user'});assert.equal(P.plan(p).lines[0].q,1)});
test('mixed duplicate counts and metadata remain unresolved',()=>{const p=project([row('310',900),row('310',null)]);assert.equal(p.items[0].stitchCount,null);assert.equal(P.plan(p).checkFirst.length,1);const m=project([{...row(),strandCount:1},{...row(),strandCount:3}]);assert.equal(P.plan(m).checkFirst.length,1)});
test('real parser merged missing counts cannot create a partial estimate',()=>{const items=context.parse('310 900 stitches\n310').items,p=project(items);assert.equal(p.items[0].stitchCount,900);assert.equal(P.plan(p).checkFirst.length,1);assert.match(P.planText(p),/verify a complete count/);assert.ok(!/about 0.49/.test(P.planText(p)));collection.threads={'310':{n:2,confirmed:true}};assert.equal(P.cmpPlan(p,context.window.FlossFoxThreadsUI).r.unverified.length,1)});
test('complete-count review resolves partial parser aggregate and persists',()=>{const p=project(context.parse('310 900 stitches\n310').items);p.items[0].stitchCountReviewed=true;assert.equal(P.plan(p).lines[0].q,1);assert.equal(P.normProject(p).items[0].stitchCountReviewed,true)});
test('legacy project keeps estimation off and original shopping',()=>{const p=project([row()],{skeinEstimator:undefined});assert.equal(p.skeinEstimator,undefined);assert.equal(P.plan(p).lines[0].q,1)});
test('enabled settings survive normalization and backup validation',()=>{const p=project();const b=P.checkBackup({app:'floss-fox',schema:2,projects:[p]});assert.equal(b.projects[0].skeinEstimator.fullCrosses,true);assert.equal(P.plan(b.projects[0]).lines[0].q,2)});
test('100% allowance survives actual project backup normalization',()=>{const p=project([row()],{skeinEstimator:{...settings,extraPercent:100}});const b=P.checkBackup({app:'floss-fox',schema:2,projects:[p]});assert.equal(b.projects[0].skeinEstimator.extraPercent,100);assert.equal(P.plan(b.projects[0]).lines[0].q,3)});
test('newer settings survive import as reviewable invalid data',()=>{const p=project([row()],{skeinEstimator:{...settings,version:99}});assert.equal(p.skeinEstimator.version,99);assert.equal(P.plan(p).checkFirst.length,1)});
test('per-row type and strands survive backup',()=>{const p=project([{...row(),strandCount:3,stitchType:'full'}]);assert.equal(P.checkBackup({app:'floss-fox',schema:2,projects:[p]}).projects[0].items[0].strandCount,3)});
test('new estimate CSV preserves source, original quantity and assumptions',()=>{const p=project();const csv=P.csv(p);assert.match(csv,/quantity_source,supplied_skeins,pip_estimated_usage_skeins/);assert.match(csv,/estimated/);assert.match(csv,/20% extra/)});
test('legacy CSV retains its 18 original columns',()=>assert.equal(P.csv(project([row()],{skeinEstimator:undefined})).split('\r\n')[0].split(',').length,18));
test('CSV formula protection remains active',()=>assert.ok(P.csv(project([row()],{name:'=HYPERLINK("bad")'})).includes("'=HYPERLINK")));
test('copy/export uses effective quantities rather than old assumed quantity',()=>{const text=P.planText(project());assert.match(text,/PIP’S SKEIN ESTIMATES/);assert.match(text,/uses Pip estimates/);assert.ok(!/includes an assumed amount/.test(text))});
test('actual comparison preview uses confirmed collection counts',()=>{collection.threads={'310':{n:2,confirmed:true}};const p=project(),r=P.cmpPlan(p,context.window.FlossFoxThreadsUI);assert.equal(r.r.owned.length,1);assert.equal(r.ch[0].to.ownedSource,'collection');assert.equal(r.ch[0].to.status,'have')});
test('comparison keeps legacy collection unverified',()=>{collection.threads={'310':{n:2}};const r=P.cmpPlan(project(),context.window.FlossFoxThreadsUI);assert.equal(r.r.unverified.length,1);assert.equal(r.ch[0].to.status,'check')});
test('comparison missing color records a confirmed zero only after apply',()=>{collection.threads={};const r=P.cmpPlan(project(),context.window.FlossFoxThreadsUI);assert.equal(r.ch[0].to.owned,0);assert.equal(r.ch[0].to.ownedSource,'collection')});
test('cross-brand plan stays unresolved while original-DMC estimate is visible',()=>{const p=project([row()],{buyBrand:'anchor'});assert.equal(P.plan(p).lines.length,0);assert.equal(P.plan(p).checkFirst.length,1);assert.match(P.planText(p),/shopping quantity unresolved/)});
test('received purchases still reduce actual shopping need',()=>{const p=project();p.decisions['310'].recv={brand:'dmc',to:'310',qty:1};assert.equal(P.plan(p).lines[0].q,1);p.decisions['310'].recv.qty=2;assert.equal(P.plan(p).lines.length,0);assert.equal(P.plan(p).have[0].state,'received')});
test('calculation never changes collection or stored project input',()=>{const p=project(),before=JSON.stringify(p),stock=JSON.stringify(collection);P.plan(p);P.planText(p);P.csv(p);assert.equal(JSON.stringify(p),before);assert.equal(JSON.stringify(collection),stock)});

// The new UI renders pure HTML; test controls with a tiny DOM-independent stub.
vm.runInContext(fs.readFileSync(__dirname+'/../skeins/ui.js','utf8'),context);
const UI=context.window.FlossFoxSkeinsUI;
test('existing fabric preference is reused after validation',()=>{const s=UI.initial({},{v:1});assert.equal(s.count,14);const v=UI.initial({},JSON.stringify({v:1,s:{fabric:'even:32',over:2}}));assert.equal(v.count,32);assert.equal(v.over,2)});
test('editor HTML labels estimates and escapes imported text',()=>{const p=project();const out=UI.html(p,DMC,fam,null,true);assert.match(out,/seFull/);assert.match(out,/whole skeins before stock/);assert.match(out,/pip-thinking-160/);const bad=UI.html({...p,items:[{...row(),code:'<img src=x onerror=bad>'}]},DMC,()=> 'solid',null,false);assert.ok(!bad.includes('<img src=x'));assert.ok(!bad.includes('pip-thinking-160'))});
test('core is free from storage/DOM/network dependencies',()=>{const source=fs.readFileSync(__dirname+'/../skeins/calc.js','utf8');assert.ok(!/document\.|localStorage|fetch\(|XMLHttpRequest|sendBeacon/.test(source))});
function controls(){const values={seFabric:'aida',seCount:'14',seOver:'1',seStrands:'2',seExtra:'20'};const m={};for(const id of ['seFabric','seCount','seOver','seStrands','seExtra','seFull','seEnabled','seSave','seDefaults','seError'])m[id]={value:values[id]||'',checked:['seFull','seEnabled'].includes(id),textContent:'',setAttribute:()=>{},focus:()=>{}};return m}
test('save handler validates and preserves original project data',()=>{const m=controls(),p=project(),before=JSON.stringify(p.items);let saved=0;UI.bind({querySelector:q=>m[q.slice(1)]},p,()=>saved++,()=>{});m.seSave.onclick();assert.equal(saved,1);assert.equal(p.skeinEstimator.count,14);assert.equal(JSON.stringify(p.items),before)});
test('invalid input and missing full-cross confirmation cannot save',()=>{const m=controls(),p=project();let saved=0;UI.bind({querySelector:q=>m[q.slice(1)]},p,()=>saved++,()=>{});m.seCount.value='';m.seSave.onclick();assert.equal(saved,0);m.seCount.value='14';m.seFull.checked=false;m.seSave.onclick();assert.equal(saved,0);assert.match(m.seError.textContent,/Confirm/)});
test('unsaved reset changes controls only',()=>{const m=controls(),p=project(),before=JSON.stringify(p);UI.bind({querySelector:q=>m[q.slice(1)]},p,()=>{},()=>{});m.seDefaults.onclick();assert.equal(m.seEnabled.checked,false);assert.equal(JSON.stringify(p),before)});
console.log(`\nskeins_unit: ${passed} passed${process.exitCode?', failed (see above)':', 0 failed'}`);
