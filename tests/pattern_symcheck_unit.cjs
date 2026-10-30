// Simulated test (synthetic pdf.js text items, no real PDFs): Pip's pattern check must not read chart row numbers or
// stitching notes as key colors, must not flag unreliable symbol text as "can't tell apart", and must still catch real problems.
// Optional: SYMCHECK_PAGES=/path/pages.json (dumped locally from private PDFs, never committed) adds real-file checks.
const fs=require('fs'),path=require('path');const P=require('../pip-hybrid/pattern-chart.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const DMC=JSON.parse(/DMC=(\{"WHITE".*?\}\})/.exec(html)[1]);
let pass=0,fail=0;const ok=(n,c,d)=>{if(c){pass++;console.log('PASS',n)}else{fail++;console.log('FAIL',n,'->',JSON.stringify(d))}};
const pitch=11,X0=69;
// A chart with row numbers on both sides, a key to the right with symbols on a slightly different baseline, and a stitch guide.
function page({key,sym=(r,c)=>((r*7+c)%3===0?'–':(r+c)%4===0?'★':'='),guide=true,shared=null}){const it=[],add=(s,x,y)=>it.push({s,x,y,w:s.length*5.5});
 for(let c=1;c<=30;c++)add(String(c),X0+(c-1)*pitch,490);
 for(let r=1;r<=30;r++){const y=480-r*pitch;add(String(r),58,y);for(let c=1;c<=30;c++)add(sym(r,c),X0+(c-1)*pitch,y);add(String(r),X0+31*pitch,y)}
 key.forEach(([s,code],i)=>{const y=470-i*20;add(s,611,y-3.5);add(code,624,y);add('(DMC)',650,y)});
 if(guide){add('Backstitching & Embroidery Guide:',572,480-17*pitch);add('Teeth - DMC 310 - 2 strands',572,480-19*pitch+2.6);add('Blood - DMC 725 - 3 strand chain stitch',572,480-23*pitch+2.6);add('of DMC 742 and feed it under the',572,480-28*pitch)}
 return[{page:1,text:it.map(i=>i.s).join(' '),items:it}]}
const base=[['–','725'],['=','310'],['★','742']],imp=['725','310','742'];
let r=P.check(page({key:base}),DMC,{imported:imp});
ok('row numbers, ruler and stitch notes give no warnings',P.lines(r).length===0,P.lines(r));
ok('key read as the 3 imported colors',JSON.stringify(r.key)===JSON.stringify(base.map(([sym,code])=>({sym,code}))),r.key);
ok('no row numbers counted as symbols',!r.extra.some(x=>/^\d+$/.test(x.sym)),r.extra);
r=P.check(page({key:base}),DMC);
ok('even without the import list, no 02, 03, 17, 26 or 29 codes',!(r.key||[]).some(e=>/^(0?2|0?3|17|26|29)$/.test(e.code)),r.key);
// Genuine shared symbol: = means both 310 and 742.
r=P.check(page({key:[['–','725'],['=','310'],['=','742']],sym:(a,c)=>(a+c)%2?'–':'='}),DMC,{imported:imp});
ok('real shared symbol still warns',r.symMulti.some(x=>x.sym==='='&&x.codes.includes('310')&&x.codes.includes('742')),r.symMulti);
// Unreliable symbol text: two colors copy out as the same dash. Soft note, not "can't tell apart".
r=P.check(page({key:[['–','725'],['–','310'],['★','742']]}),DMC,{imported:imp});
ok('dash stand-in is not a hard "can\'t tell apart" warning',!r.symMulti.length&&r.symUnsure.length===1,r);
ok('soft wording does not claim they cannot be told apart',P.lines(r).every(l=>!/can't tell them apart/.test(l)),P.lines(r));
r=P.check(page({key:[['\uE001','725'],['\uE001','310'],['★','742']],sym:(a,c)=>(a+c)%2?'\uE001':'★'}),DMC,{imported:imp});
ok('private-use glyph stand-in is soft too',!r.symMulti.length&&r.symUnsure.length===1,r);
// Genuine missing symbol: the chart uses @ which the key does not list.
r=P.check(page({key:base,sym:(a,c)=>c===5?'@':'='}),DMC,{imported:imp});
ok('real missing symbol still warns',r.extra.some(x=>x.sym==='@'&&x.n===30),r.extra);
ok('missing symbol warning names no row numbers',r.extra.length===1,r.extra);
// A code the user did not import never shows up.
r=P.check(page({key:[['–','725'],['=','310'],['=','666']],sym:(a,c)=>(a+c)%2?'–':'='}),DMC,{imported:['725','310']});
ok('codes not in the import list never appear in warnings',P.lines(r).every(l=>!/666/.test(l)),P.lines(r));
ok('no em dashes in new copy',!/\u2014/.test(P.STR.symUnsure({sym:'-',codes:['1','2']})));
// ci005-82: BLANC is its own color. A key printing BLANC matches an imported BLANC with no warnings, and is never read as WHITE.
{const bk=[['–','725'],['=','310'],['★','BLANC']];let q=P.check(page({key:bk}),DMC,{imported:['725','310','BLANC']});
 ok('BLANC key + BLANC import: no false warnings',P.lines(q).length===0,P.lines(q));
 ok('BLANC key read as BLANC, not WHITE',q.key.some(e=>e.code==='BLANC')&&!q.key.some(e=>e.code==='WHITE'),q.key);
 ok('normCode keeps BLANC and WHITE apart',P.normCode('DMC BLANC',DMC)==='BLANC'&&P.normCode('white',DMC)==='WHITE');
 const wk=[['–','725'],['=','310'],['★','WHITE']];q=P.check(page({key:wk}),DMC,{imported:['725','310','WHITE']});
 ok('WHITE key + WHITE import still works with no warnings',P.lines(q).length===0,P.lines(q));}
if(process.env.SYMCHECK_PAGES&&fs.existsSync(process.env.SYMCHECK_PAGES)){const all=JSON.parse(fs.readFileSync(process.env.SYMCHECK_PAGES,'utf8'));
 if(all['full-list']){r=P.check(all['full-list'],DMC,{imported:['BLANC','725','310','720','640','644','3799','742','817']});ok('private full-list: BLANC key entry is BLANC, never WHITE',r.key.some(e=>e.code==='BLANC')&&!r.key.some(e=>e.code==='WHITE'),r.key);ok('private full-list: no false warnings',P.lines(r).length===0,P.lines(r));ok('private full-list: 9 key symbols',r.key.length===9&&new Set(r.key.map(e=>e.sym)).size===9,r.key)}
 if(all['solo-leveling']){r=P.check(all['solo-leveling'],DMC,{imported:['151','304','321','335']});ok('private solo-leveling: no false warnings',P.lines(r).length===0,P.lines(r))}}
console.log(`${pass} passed, ${fail} failed`);process.exit(fail?1:0);
