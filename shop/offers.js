/* Floss Fox 1.5A shopping-offer selector. Pure, deterministic, no network, no storage.
   It CONSUMES the canonical shopping plan (read-only) and never changes requirements, substitutions, inventory or the list.
   Works in the browser (window.FlossFoxOffers) and in Node for unit tests (module.exports). */
(function(root){
'use strict';
const STATES=['researching','applied','approved','rejected','suspended','expired'];
const BRAND_NAME={dmc:'DMC',anchor:'Anchor',sullivans:'Sullivans'};
const FAMILY_LABEL={'six-strand-cotton':'6-strand cotton'};
const DISPUTED=new Set(['dmc:WHITE','dmc:BLANC','dmc:B5200','anchor:1','anchor:2']);
const DAY=864e5;
const isObj=o=>o&&typeof o==='object'&&!Array.isArray(o);
const str=v=>typeof v==='string'&&v.trim()!=='';
const normCode=c=>String(c==null?'':c).trim().toUpperCase().replace(/^0+(?=\d)/,'');
const hostOK=(h,list)=>Array.isArray(list)&&list.some(d=>str(d)&&(h===d.toLowerCase()||h.endsWith('.'+d.toLowerCase())));
const exactHost=(h,list)=>Array.isArray(list)&&list.some(d=>str(d)&&h===d.toLowerCase());
const fresh=(iso,now,maxDays)=>{if(!str(iso))return false;const t=Date.parse(iso);return isFinite(t)&&t<=now+DAY&&now-t<=maxDays*DAY};

// URL gate: https only, parsed hostname (not substring) on the merchant's allowlist; a network tracking host is allowed only
// when its destination parameter itself parses to an allowed https retailer host (no open redirect). Never rewritten.
function checkUrl(url,m,env){
 if(!str(url))return'no-url';let u;try{u=new URL(url)}catch(e){return'bad-url'}
 if(u.protocol!=='https:')return'not-https';if(u.username||u.password)return'credentials-in-url';
 const h=u.hostname.toLowerCase();
 if(m.mock&&!/\.example$/.test(h))return'mock-host-not-reserved';
 if(!m.mock&&/\.example$/.test(h))return'reserved-host-in-real-merchant';
 if(hostOK(h,m.allowedDomains))return null;
 if(exactHost(h,m.trackingHosts)&&str(m.destinationParam)){const d=u.searchParams.get(m.destinationParam);if(!d)return'tracking-without-destination';
  let du;try{du=new URL(d)}catch(e){return'bad-destination'}if(du.protocol!=='https:')return'destination-not-https';
  return hostOK(du.hostname.toLowerCase(),m.allowedDomains)?null:'destination-not-allowed'}
 return'host-not-allowed'}

// Merchant gate (fail closed). Returns null if eligible, else a reason code.
function merchantGate(m,env,cfg){
 if(!isObj(m)||!str(m.merchantId)||!str(m.displayName))return'malformed';
 if(!STATES.includes(m.approvalState))return'unknown-state';
 if(['rejected','suspended','expired'].includes(m.approvalState))return'blocked:'+m.approvalState;
 if(m.mock)return env==='preview'?null:'mock-outside-preview';
 if(m.approvalState!=='approved')return'not-approved:'+m.approvalState;
 if(!str(m.termsReviewedAt)||!str(m.termsEvidence))return'terms-not-reviewed';
 if(!str(m.trackingLinkSource))return'no-official-link-source';
 if(env==='production'&&m.approvedForProduction!==true)return'not-approved-for-production';
 if(env==='preview'&&m.approvedForProduction!==true&&m.approvedForPreview!==true)return'not-approved-for-preview';
 if(env!=='production'&&env!=='preview')return'unknown-env';
 return null}

function linkGate(rec,m,env,cfg,now){
 if(!isObj(rec))return'malformed-link';
 const bad=checkUrl(rec.url,m,env);if(bad)return bad;
 if(!m.mock&&!fresh(rec.linkVerifiedAt,now,(cfg&&cfg.linkMaxAgeDays)||180))return'link-not-verified-or-stale';
 return null}

// Adapter output -> per-need decisions.
// need: {brand, code, family, pack, qty(int|null), assumed(bool), from:[codes], disputed(bool)}
function needIssue(n){
 if(!isObj(n)||!BRAND_NAME[n.brand]||!str(String(n.code||'')))return'malformed-need';
 if(n.qty===null||n.qty===undefined||!(n.qty>0))return'quantity-unknown';
 if(n.assumed)return'quantity-assumed';
 if(n.substitutionUnapproved)return'substitution-unresolved';
 return null}
const exactEligible=n=>n.family==='six-strand-cotton'&&(n.pack||'single-skein')==='single-skein'&&!n.disputed&&!DISPUTED.has(n.brand+':'+normCode(n.code));

function select(needs,cfg,env,nowMs){
 const now=typeof nowMs==='number'?nowMs:Date.now();const out={layer:false,merchants:[],items:[],review:[],categories:[],linkCount:0,excluded:[]};
 if(!isObj(cfg)||cfg.SHOPPING_LAYER!==true){out.excluded.push({merchantId:'*',reason:'layer-off'});return out}
 const pool=[].concat(Array.isArray(cfg.merchants)?cfg.merchants:[],env==='preview'&&Array.isArray(cfg.mockMerchants)?cfg.mockMerchants:[]);
 const ms=[];pool.forEach(m=>{let r;try{r=merchantGate(m,env,cfg)}catch(e){r='malformed'}if(r)out.excluded.push({merchantId:isObj(m)&&m.merchantId||'?',reason:r});else ms.push(m)});
 ms.sort((a,b)=>a.displayName.localeCompare(b.displayName,'en'));   // neutral order: alphabetical, never by commission
 out.merchants=ms.map(m=>({merchantId:m.merchantId,displayName:m.displayName,rel:m.rel,mock:!!m.mock}));
 out.layer=ms.length>0;if(!out.layer)return out;
 const catSeen=new Set();
 (Array.isArray(needs)?needs:[]).forEach(n=>{
  const issue=needIssue(n);if(issue){out.review.push({need:n,reason:issue});return}
  const item={need:n,links:[],note:null};
  ms.forEach(m=>{
   let exact=null;
   if(exactEligible(n))(Array.isArray(m.offers)?m.offers:[]).forEach(o=>{if(exact||!isObj(o)||o.offerType!=='exact-product'||!isObj(o.targetProduct))return;const t=o.targetProduct;
    if(t.brand===n.brand&&normCode(t.code)===normCode(n.code)&&t.family===n.family&&t.package==='single-skein'&&!linkGate(o,m,env,cfg,now))exact=o});
   if(exact){item.links.push({level:'A',merchantId:m.merchantId,merchantName:m.displayName,rel:m.rel||'sponsored noopener',href:exact.url,mock:!!m.mock,
     label:`View ${BRAND_NAME[n.brand]} ${n.code} ${FAMILY_LABEL[n.family]} at ${m.displayName}`});return}
   const land=(Array.isArray(m.categoryLandings)?m.categoryLandings:[]).find(c=>isObj(c)&&c.offerType==='category'&&c.family===n.family&&Array.isArray(c.brands)&&c.brands.includes(n.brand)&&!linkGate(c,m,env,cfg,now));
   if(land){const k=m.merchantId+'|'+n.brand+'|'+n.family;item.links.push({level:'B',merchantId:m.merchantId,merchantName:m.displayName,category:k});
    if(!catSeen.has(k)){catSeen.add(k);out.categories.push({key:k,merchantId:m.merchantId,merchantName:m.displayName,rel:m.rel||'sponsored noopener',href:land.url,mock:!!m.mock,brand:n.brand,family:n.family,
     label:`Browse ${BRAND_NAME[n.brand]} embroidery floss at ${m.displayName}`})}}});
  if(!item.links.some(l=>l.level==='A'))item.note=item.links.length?'browse':'none';
  out.items.push(item)});
 out.linkCount=out.items.reduce((a,i)=>a+i.links.filter(l=>l.level==='A').length,0)+out.categories.length;
 return out}

const api={select,checkUrl,merchantGate,linkGate,needIssue,exactEligible,normCode,STATES,BRAND_NAME};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FlossFoxOffers=api;
})(typeof window!=='undefined'?window:this);
