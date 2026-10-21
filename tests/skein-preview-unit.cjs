'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../shop/skein-preview-catalog.js');
const valid=(more={})=>({brand:'dmc',family:'six-strand-cotton',pack:'single-skein',code:'310',qty:2,assumed:false,disputed:false,...more});
const preview='preview';
test('14 individually curated direct product URLs; exactly 2 retailers',()=>{
 const manifest=require('../docs/product-links.json');
 assert.equal(manifest.length,14);
 for(const x of manifest){const links=S.linksFor(valid({code:x.code}),preview);
   assert.equal(links.length,2);
   const link=links.find(l=>l.storeId===x.merchantId);
   assert.equal(link.url,x.url);
   assert.equal(link.exact,true);
   assert.equal(link.untracked,true);
 }
});
test('correct precise Hobby Lobby variant for DMC 310',()=>{
 const link=S.linksFor(valid(),preview)[0];
 assert.equal(link.storeId,'hobbylobby');assert.equal(link.type,'exact-product');
 assert.match(link.url,/310-black--dmc-mouline-grays-embroidery-floss/);
});
test('correct Everything Cross Stitch DMC 321 and 3012 direct products',()=>{
 for(const c of ['321','3012']){const link=S.linksFor(valid({code:c}),preview)[1];
 assert.equal(link.type,'exact-product');assert.equal(link.code,c)}
});
test('uncatalogued color has two honest DMC cotton catalog links',()=>{
 const links=S.linksFor(valid({code:'666'}),preview);
 assert.equal(links.length,2);assert.ok(links.every(l=>l.type==='catalog'&&!l.exact));
 assert.ok(links.every(l=>l.label.includes('Find DMC 666')));
 assert.ok(links.every(l=>l.url.startsWith('https://')));
});
test('never claim all link targets are product pages',()=>{
 const links=S.linksFor(valid({code:'310'}),preview);
 assert.equal(links[0].exact,true);assert.equal(links[1].exact,false);
});
test('reject code injection, ambiguous ids, special shades and invalid ranges',()=>{
 for(const code of ['310?x=1','0310','BLANC','WHITE','B5200','E310','S310','C310','4000','99999','',null]){
   assert.equal(S.linksFor(valid({code}),preview).length,0,`unexpected link for ${code}`)
 }
});
test('preserve special 01 / 09 shade strings',()=>{
 for(const code of ['01','09']) assert.equal(S.linksFor(valid({code}),preview)[1].code,code);
});
test('never render links unless explicit preview environment',()=>{
 for(const env of ['production','preview2',undefined,null]) assert.deepEqual(S.linksFor(valid(),env),[]);
});
test('reject wrong brand, specialty, packages, unresolved substitutions',()=>{
 for(const item of [
  valid({brand:'anchor'}),valid({brand:'sullivans'}),valid({family:'specialty'}),
  valid({pack:'assortment'}),valid({disputed:true}),
  valid({substitutionUnapproved:true}),
 ]) assert.equal(S.linksFor(item,preview).length,0);
});
test('assumed amounts get the same untracked links (Myke, flow phase 3)',()=>{
 const a=S.linksFor(valid({assumed:true}),preview),b=S.linksFor(valid(),preview);
 assert.equal(a.length,2);assert.deepEqual(a.map(x=>x.url),b.map(x=>x.url));assert.ok(a.every(x=>x.untracked===true&&x.tracked===false&&x.kind==='direct'));
});
test('reject unconfirmed or malformed skein quantities',()=>{
 for(const qty of [0,null,undefined,-1,2.5,NaN,Infinity,'2',10000])
  assert.equal(S.linksFor(valid({qty}),preview).length,0);
});
test('rows are read-only, do not double count duplicates and never include review or owned lines',()=>{
 const list=[valid(),valid({code:'321',qty:3}),valid({code:'310',qty:2}),valid({code:'666',qty:0}),valid({code:'839',assumed:true})];
 const before=JSON.stringify(list);const rows=S.rowsFor(list,preview);
 assert.deepEqual(rows.map(x=>x.code),['321','839']);
 assert.deepEqual(rows.map(x=>x.qty),[3,2]);assert.deepEqual(rows.map(x=>x.assumed),[false,true]);assert.equal(JSON.stringify(list),before);
});
test('exact destinations are HTTPS retailer-owned hosts and are untracked',()=>{
 const manifest=require('../docs/product-links.json');
 for(const x of manifest){const u=new URL(x.url);assert.equal(u.protocol,'https:');
 assert.ok(['www.hobbylobby.com','www.everythingcrossstitch.com'].includes(u.hostname));
 assert.ok(!/(awin1|affiliat|utm_|gclid|cj|clickref)/i.test(u.search));}
});
test('host safety prevents subdomain spoofing and user-info URLs',()=>{
 assert.equal(S.validUrl('https://www.hobbylobby.com.evil.com','www.hobbylobby.com'),false);
 assert.equal(S.validUrl('http://www.hobbylobby.com','www.hobbylobby.com'),false);
 assert.equal(S.validUrl('https://x@www.hobbylobby.com','www.hobbylobby.com'),false);
 assert.equal(S.validUrl('https://www.hobbylobby.com','www.hobbylobby.com'),true);
});
test('never mutate need record or hardcode stock, cart or prices',()=>{
 const item=Object.freeze(valid()); const before=JSON.stringify(item);
 const r=S.linksFor(item,preview);assert.equal(JSON.stringify(item),before);
 assert.ok(r.every(l=>!('price'in l)&&!('inStock'in l)&&!('cart'in l)));
});
