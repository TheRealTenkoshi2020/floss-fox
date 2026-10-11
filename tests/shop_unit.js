// Floss Fox 1.5A unit tests for shop/offers.js and the production register. Run: node tests/shop_unit.js
const O=require('../shop/offers.js');const fs=require('fs'),vm=require('vm'),path=require('path');
let pass=0,fail=0;const ok=(n,c,i)=>{if(c){pass++;console.log('PASS',n)}else{fail++;console.log('FAIL',n,i===undefined?'':JSON.stringify(i))}};
const NOW=Date.parse('2026-10-11T12:00:00Z');
const loadReg=(file,extra)=>{const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);if(extra)vm.runInContext(fs.readFileSync(extra,'utf8'),ctx);return ctx.window};
const PROD=loadReg('shop/merchants.js');
const need=(o)=>Object.assign({brand:'dmc',code:'310',family:'six-strand-cotton',pack:'single-skein',qty:2,assumed:false,from:['310'],disputed:false},o||{});
const real=(o)=>Object.assign({merchantId:'r1',displayName:'Real Shop',affiliateNetwork:'Awin',programId:'1',approvalState:'approved',approvedForProduction:true,approvedForPreview:true,
 allowedDomains:['floss-store.invalid'],trackingHosts:['www.awin1.com'],destinationParam:'ued',rel:'sponsored noopener',termsReviewedAt:'2026-10-01',termsEvidence:'portal terms v3 (private)',trackingLinkSource:'Awin Link Builder',verifiedAt:'2026-10-01',
 categoryLandings:[{offerType:'category',family:'six-strand-cotton',brands:['dmc'],url:'https://floss-store.invalid/floss',linkVerifiedAt:'2026-10-05'}],
 offers:[{offerId:'o310',offerType:'exact-product',targetProduct:{brand:'dmc',code:'310',family:'six-strand-cotton',package:'single-skein'},url:'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=https%3A%2F%2Ffloss-store.invalid%2Fdmc-310',linkVerifiedAt:'2026-10-05'}]},o||{});
const cfg=(ms,extra)=>Object.assign({SHOPPING_LAYER:true,linkMaxAgeDays:180,merchants:ms},extra||{});
const sel=(needs,c,env)=>O.select(needs,c,env||'production',NOW);

// ---- Commercial gating ----
ok('G1 production register: env is production', PROD.FLOSS_FOX_ENV==='production');
ok('G2 production register: no merchant approved, none approved for production or preview', PROD.FLOSS_FOX_SHOP.merchants.every(m=>m.approvalState!=='approved'&&m.approvedForProduction===false&&m.approvedForPreview===false));
ok('G3 production register: zero URLs anywhere (no offers, no landings)', !/https?:\/\/[^'\s]*(fatquartershop|herrschners|leisurearts|michaels|hobbylobby|awin1)/i.test(JSON.stringify(PROD.FLOSS_FOX_SHOP.merchants.map(m=>[m.offers,m.categoryLandings]))) && PROD.FLOSS_FOX_SHOP.merchants.every(m=>!m.offers.length&&!m.categoryLandings.length));
let r=sel([need()],PROD.FLOSS_FOX_SHOP);ok('G4 all merchants applied/researching: layer off, 0 links', !r.layer&&r.linkCount===0&&r.excluded.length===5, r.excluded);
ok('G5 Awin publisher approved but merchant pending (applied): stays off', r.excluded.find(x=>x.merchantId==='herrschners').reason==='not-approved:applied');
ok('G6 no mock merchants in the production register', !PROD.FLOSS_FOX_SHOP.mockMerchants && !/\.example/.test(fs.readFileSync(path.join(__dirname,'../shop/merchants.js'),'utf8')));
r=sel([need()],cfg([real(),real({merchantId:'r2',displayName:'Pending Shop',approvalState:'applied'})]));
ok('G7 one independently approved merchant: only its links', r.merchants.length===1&&r.items[0].links.every(l=>l.merchantId==='r1'));
for(const st of ['suspended','rejected','expired']){r=sel([need()],cfg([real({approvalState:st})]));ok('G8 '+st+' merchant: no link', !r.layer&&r.linkCount===0)}
ok('G9 approved but terms not reviewed: off', !sel([need()],cfg([real({termsReviewedAt:null})])).layer);
ok('G9b approved but no official link source: off', !sel([need()],cfg([real({trackingLinkSource:''})])).layer);
ok('G9c approved but not approvedForProduction: off in production', !sel([need()],cfg([real({approvedForProduction:false})])).layer);
ok('G9d approvedForPreview only: on in preview, off in production', sel([need()],cfg([real({approvedForProduction:false})]),'preview').layer&&!sel([need()],cfg([real({approvedForProduction:false})]),'production').layer);
ok('G10 global kill switch SHOPPING_LAYER:false hides everything', !sel([need()],cfg([real()],{SHOPPING_LAYER:false})).layer);
ok('G10b there is no global "enable all": a truthy extra flag cannot activate an unapproved merchant', !sel([need()],cfg([real({approvalState:'applied'})],{affiliateEnabled:true,enableAll:true})).layer);
let crashed=false;try{r=sel([need()],cfg([null,42,'x',{},{merchantId:'m',displayName:'M',approvalState:'weird'},real({offers:'nope',categoryLandings:null})]))}catch(e){crashed=true}
ok('G11 malformed merchants/links: disabled safely, no crash', !crashed&&r.merchants.length===1&&r.linkCount===0, r);
ok('G11b missing config: no crash, off', !O.select([need()],null,'production',NOW).layer&&!O.select([need()],{},'production',NOW).layer);
const mock={mock:true,merchantId:'mk',displayName:'Mock',approvalState:'approved',rel:'sponsored noopener',allowedDomains:['floss-shop.example'],categoryLandings:[{offerType:'category',family:'six-strand-cotton',brands:['dmc'],url:'https://floss-shop.example/f'}],offers:[]};
ok('G12 mock merchant cannot activate in production (even if injected)', !sel([need()],cfg([mock]),'production').layer && !sel([need()],cfg([],{mockMerchants:[mock]}),'production').layer);
ok('G12b mock merchant works only in preview', sel([need()],cfg([],{mockMerchants:[mock]}),'preview').layer);
ok('G12c mock merchant with a non-reserved host is refused', sel([need()],cfg([],{mockMerchants:[Object.assign({},mock,{allowedDomains:['realshop.com'],categoryLandings:[{offerType:'category',family:'six-strand-cotton',brands:['dmc'],url:'https://realshop.com/f'}]})]}),'preview').linkCount===0);
ok('G12d real merchant pointing at a reserved .example host is refused', O.checkUrl('https://floss-shop.example/x',real(),'production')==='reserved-host-in-real-merchant');
ok('G13 unknown env: off', !sel([need()],cfg([real()]),'staging').layer);
ok('G14 stale link (not re-verified in 180 days) is dropped', sel([need()],cfg([real({offers:[Object.assign({},real().offers[0],{linkVerifiedAt:'2025-01-01'})],categoryLandings:[]})])).linkCount===0);
ok('G14b link with no verification date is dropped', sel([need()],cfg([real({offers:[Object.assign({},real().offers[0],{linkVerifiedAt:null})],categoryLandings:[]})])).linkCount===0);

// ---- URL safety ----
const m=real();
for(const [u,why] of [['javascript:alert(1)','js'],['data:text/html,x','data'],['http://floss-store.invalid/x','http'],['https://floss-store.invalid.evil.com/x','suffix trick'],['https://evilfloss-store.invalid/x','prefix trick'],['https://user:pw@floss-store.invalid/x','credentials'],['https://www.awin1.com/cread.php?awinmid=1&ued=https%3A%2F%2Fevil.com%2F','open redirect'],['https://www.awin1.com/cread.php?awinmid=1&ued=http%3A%2F%2Ffloss-store.invalid%2F','redirect to http'],['https://www.awin1.com/cread.php?awinmid=1','tracking without destination'],['not a url','garbage'],['https://evil.com/?u=floss-store.invalid','substring']])
 ok('U1 rejects '+why, O.checkUrl(u,m,'production')!==null, O.checkUrl(u,m,'production'));
ok('U2 accepts allowed host and its subdomain', O.checkUrl('https://floss-store.invalid/a',m)===null&&O.checkUrl('https://www.floss-store.invalid/a',m)===null);
ok('U3 accepts the network tracking host only with an allowed https destination', O.checkUrl(real().offers[0].url,m)===null);
r=sel([need()],cfg([real()]));const ex=r.items[0].links.find(l=>l.level==='A');
ok('U4 approved link is used exactly as supplied (no added or rewritten parameters)', ex&&ex.href===real().offers[0].url);
ok('U5 rel per merchant (sponsored noopener; noreferrer not forced on tracking links)', ex.rel==='sponsored noopener');

// ---- Product correctness ----
ok('P1 DMC 310 exact product: label names brand, code, family', ex.label==='View DMC 310 6-strand cotton at Real Shop');
r=sel([need({brand:'anchor',code:'403'})],cfg([real()]));ok('P2 DMC 310 -> Anchor 403 chosen: no DMC-310 exact offer', r.items[0].links.every(l=>l.level!=='A')&&r.items[0].note==='none');
r=sel([need({from:['310','3371']})],cfg([real()]));ok('P3 merged sources preserved in the decision', r.items[0].need.from.join()==='310,3371');
r=sel([need({family:'specialty',code:'E3852'})],cfg([real({offers:[{offerType:'exact-product',targetProduct:{brand:'dmc',code:'E3852',family:'specialty',package:'single-skein'},url:'https://floss-store.invalid/e',linkVerifiedAt:'2026-10-05'}]})]));
ok('P4 metallic/variegated never get an exact match (and no cotton browse link)', r.items[0].links.length===0);
for(const c of ['WHITE','BLANC','B5200']){r=sel([need({code:c})],cfg([real({offers:[{offerType:'exact-product',targetProduct:{brand:'dmc',code:c,family:'six-strand-cotton',package:'single-skein'},url:'https://floss-store.invalid/w',linkVerifiedAt:'2026-10-05'}]})]));ok('P5 '+c+' (disputed white) never gets a confident exact link', r.items[0].links.every(l=>l.level!=='A'))}
r=sel([need({brand:'anchor',code:'2',disputed:true})],cfg([real()]));ok('P5b disputed Anchor white: no exact link', r.items[0].links.every(l=>l.level!=='A'));
for(const [o,why] of [[{qty:null},'quantity unknown'],[{assumed:true},'assumed amount'],[{substitutionUnapproved:true},'unresolved substitute'],[{qty:0},'zero quantity'],[{brand:'xyz'},'unknown brand']])
 {r=sel([need(o)],cfg([real()]));ok('P6 '+why+': review, no purchase link', r.items.length===0&&r.review.length===1, r.review)}
r=sel([need({code:'3865'})],cfg([real({offers:[{offerType:'exact-product',targetProduct:{brand:'dmc',code:'3865',family:'six-strand-cotton',package:'assortment'},url:'https://floss-store.invalid/pack',linkVerifiedAt:'2026-10-05'}]})]));
ok('P7 assortment/kit never satisfies a single code (falls back to browse)', r.items[0].links.every(l=>l.level!=='A')&&r.items[0].note==='browse');
r=sel([need({code:'999'})],cfg([real()]));ok('P8 missing SKU: browse link only, clearly labelled', r.items[0].note==='browse'&&r.categories[0].label==='Browse DMC embroidery floss at Real Shop');
r=sel([need({code:'999'})],cfg([real({categoryLandings:[]})]));ok('P8b missing SKU and no category: no link at all', r.items[0].note==='none'&&r.linkCount===0);
r=sel([],cfg([real()]));ok('P9 nothing missing: zero links (no upsell)', r.linkCount===0&&r.items.length===0);
ok('P10 code normalisation does not create false matches (0310 vs 310 equal; 31 vs 310 not)', O.normCode('0310')===O.normCode('310')&&O.normCode('31')!==O.normCode('310'));
const n0=need({from:['310','3371']}),snap=JSON.stringify(n0);sel([n0],cfg([real()]));ok('P11 selector never mutates its input needs', JSON.stringify(n0)===snap);

// ---- Ranking ----
r=sel([need()],cfg([real({merchantId:'z',displayName:'Zeta Floss',commission:50}),real({merchantId:'a',displayName:'Alpha Floss',commission:1})]));
ok('R1 neutral alphabetical order, never by commission', r.merchants.map(x=>x.displayName).join()==='Alpha Floss,Zeta Floss');
ok('R2 same item at two partners: both shown', r.items[0].links.filter(l=>l.level==='A').length===2);

// ---- Privacy ----
const big=sel([need({code:'310'}),need({code:'321',from:['321']})],cfg([real()]));
const hrefs=[...big.items.flatMap(i=>i.links.map(l=>l.href||'')),...big.categories.map(c=>c.href)].join(' ');
ok('V1 hrefs never carry thread codes from the list, project names, ids or quantities (only the curated URL)', !/321|qty|project|clickref|pref1/i.test(hrefs), hrefs);
const src=fs.readFileSync(path.join(__dirname,'../shop/offers.js'),'utf8')+fs.readFileSync(path.join(__dirname,'../shop/ui.js'),'utf8');const code=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
ok('V2 shop code has no network, storage or tracking calls', !/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|new Image|iframe|preconnect|prefetch|innerHTML/.test(code));
ok('V3 no price, stock or "best" claims in shop UI copy', !/in stock|ships|free shipping|lowest|cheapest|best value|save \d|%\s*off/i.test(src));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
