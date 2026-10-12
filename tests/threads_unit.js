// node tests/threads_unit.js : My Thread Collection core (storage format, merge, steps, compare). No DOM.
const fs=require('fs');const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const DMC=JSON.parse(html.match(/const DMC=(\{.*?\});/)[1]);
const C=require('../threads.js').core(DMC),parse=require('../parse.js').make(DMC);let pass=0,fail=0;
const t=(n,c)=>{try{if(c()){pass++;console.log('PASS',n)}else{fail++;console.log('FAIL',n)}}catch(e){fail++;console.log('FAIL',n,e.message)}};
let d=C.empty();
t('empty collection',()=>d.schema===1&&!Object.keys(d.threads).length);
let r=C.add(d,parse('310, 321 x2\n310').items);t('add from parser: duplicates merge (310 twice = 2 skeins)',()=>r.added===2&&d.threads['310'].n===2&&d.threads['321'].n===2);
r=C.add(d,parse('310 x3').items);t('adding an owned color merges, never duplicates',()=>r.merged===1&&r.added===0&&d.threads['310'].n===5&&Object.keys(d.threads).length===2);
t('unknown codes are never added',()=>{C.add(d,[{code:'9999',qty:1}]);return!d.threads['9999']});
t('+ / − steps',()=>C.step(d,'321',1)===3&&C.step(d,'321',-1)===2);
t('− never goes below 0',()=>{C.step(d,'321',-5);return d.threads['321'].n===0});
t('+ capped at 999',()=>{d.threads['321'].n=998;C.step(d,'321',5);return d.threads['321'].n===999});
t('states: stock / partial / out',()=>C.state({n:2,partial:false})==='stock'&&C.state({n:0,partial:true})==='partial'&&C.state({n:0,partial:false})==='out'&&C.state(undefined)==='out');
// compare
const coll={schema:1,threads:{'310':{n:2,partial:false,restock:false},'321':{n:1,partial:true,restock:false},'666':{n:0,partial:false,restock:true},'815':{n:0,partial:true,restock:false}}};
const cmp=C.compare([{code:'310',qty:2},{code:'321',qty:2},{code:'666',qty:1},{code:'815',qty:null},{code:'3865',qty:1},{code:'310',qty:3}].slice(0,5),coll);
t('owned when skeins >= need',()=>cmp.owned.some(x=>x.code==='310'));
t('short when some but fewer than needed (partial does not count as a full skein)',()=>cmp.short.length===1&&cmp.short[0].code==='321'&&cmp.short[0].have===1&&cmp.short[0].partial);
t('out of stock counts as missing',()=>cmp.missing.some(x=>x.code==='666'));
t('not in collection = missing',()=>cmp.missing.some(x=>x.code==='3865'));
t('unknown need + partial only = color owned, quantity not verified',()=>cmp.unverified.some(x=>x.code==='815')&&!cmp.owned.some(x=>x.code==='815'));
t('owned / unverified / short / missing counted separately (1/1/1/2)',()=>cmp.owned.length===1&&cmp.unverified.length===1&&cmp.short.length===1&&cmp.missing.length===2);
t('assumed 1 skein + owned = unverified, never "have enough"',()=>{const r=C.compare([{code:'310',qty:1,assumed:1}],coll);return r.unverified.length===1&&r.owned.length===0});
t('stated 3 incl. 1 assumed, have 1 = short (stated part not covered)',()=>{const r=C.compare([{code:'310',qty:3,assumed:1}],{schema:1,threads:{'310':{n:1}}});return r.short.length===1});
t('stitch counts are never used as skeins in compare',()=>{const r=C.compare([{code:'310',qty:1,stitchCount:5000}],coll);return r.owned.length===1});
// demo map is separate
t('demo threads kept in their own map; real compare ignores them',()=>{const d=C.empty();C.add(d,[{code:'310',qty:5}],{demo:true});C.add(d,[{code:'310',qty:1}]);
 return d.threads['310'].n===1&&d.demo['310'].n===5&&C.compare([{code:'310',qty:3}],d).short.length===1&&C.compare([{code:'310',qty:3}],d,{demo:true}).owned.length===1});
t('demo map survives migrate, real entry with same DMC number unchanged',()=>{const m=C.migrate({schema:1,threads:{'310':{n:1}},demo:{'310':{n:9}}});return m.data.threads['310'].n===1&&m.data.demo['310'].n===9});
// Demogorgon: 19 colors, 13 owned, 6 missing
const demo=['310','321','666','815','817','3865','B5200','413','414','415','762','318','317','498','304','3799','535','3371','ECRU'];
const dc=C.empty();C.add(dc,demo.slice(0,13).map(code=>({code,qty:2})));
const pr=parse(demo.map(c=>c==='ECRU'?'Ecru x1':c+' x1').join('\n'));
const dr=C.compare(pr.items,dc);t('Demogorgon (x1 stated): 19 colors -> 13 owned, 0 short, 6 missing',()=>pr.items.length===19&&dr.owned.length===13&&dr.short.length===0&&dr.missing.length===6);
// migration / corrupted
t('migrate: valid data round-trips',()=>{const m=C.migrate(JSON.parse(JSON.stringify(coll)));return m.data.threads['321'].partial===true&&m.skipped===0});
t('migrate: bad entries skipped, good kept',()=>{const m=C.migrate({schema:1,threads:{'310':{n:2},'9999':{n:1},'321':{n:-1},'666':{n:1.5},'ECRU':'x','815':{n:3,restock:'yes'}}});return Object.keys(m.data.threads).join()==='310,815'&&m.skipped===4&&m.data.threads['815'].restock===false});
t('migrate: newer schema refused (left untouched)',()=>C.migrate({schema:2,threads:{}}).tooNew===true);
t('migrate: not collection data -> null',()=>C.migrate(null)===null&&C.migrate({projects:[]})===null&&C.migrate({threads:[]})===null&&C.migrate('x')===null);
t('migrate: no schema field treated as v1',()=>C.migrate({threads:{'310':{n:1}}}).data.threads['310'].n===1);
t('core has no DOM/storage/network outside the UI part',()=>{const s=fs.readFileSync(__dirname+'/../threads.js','utf8');const core=s.slice(0,s.indexOf('// ---------------- UI'));return !/document\.|localStorage|fetch\(|XMLHttpRequest|sendBeacon/.test(core.replace(/\/\*[\s\S]*?\*\//g,''))});
console.log(`\nthreads_unit: ${pass} passed, ${fail} failed`);process.exit(fail?1:0);
