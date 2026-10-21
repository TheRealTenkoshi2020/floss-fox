// node tests/pattern_chart_unit.cjs : Pattern check v2, key vs chart, on SYNTHETIC PDFs (simulated). pages.json comes from tests/dump_chart_pages.py.
const fs=require('fs'),path=require('path');const PCH=require('../pip-hybrid/pattern-chart.js'),PC=require('../pip-hybrid/pattern-check.js'),C=require('../pip-hybrid/pattern-core.js'),SK=require('../skeins/calc.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const DMC=JSON.parse(/DMC=(\{"WHITE".*?\}\})/.exec(html)[1]);
const D=path.join(__dirname,'fixtures','chart-check'),P=JSON.parse(fs.readFileSync(path.join(D,'pages.json'))),E=JSON.parse(fs.readFileSync(path.join(D,'expected.json')));let N=0,F=0;
const ok=(n,c,d)=>{c?N++:F++;console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+String(JSON.stringify(d)).slice(0,400)))};
const R=k=>PCH.check(P[k],DMC),clean=r=>!r.extra.length&&!r.unused.length&&!r.counts.length&&!r.symMulti.length&&!r.codeMulti.length&&!r.sum&&!r.labels.repeat.length&&!r.labels.missing.length;
let r=R('match');ok('matching pattern: chart read, no flags',r.status==='checked'&&clean(r)&&PCH.lines(r).length===0,r);
r=R('extra-symbol');ok('extra chart symbol % flagged with its 9 cells',r.status==='checked'&&r.extra.length===1&&r.extra[0].sym==='%'&&r.extra[0].n===9&&!r.unused.length,r);
r=R('unused-color');ok('unused key color 797 (=) flagged, nothing else',r.unused.length===1&&r.unused[0].code==='797'&&!r.extra.length&&!r.counts.length,r);
r=R('wrong-counts');const ex=E['wrong-counts'].chartCounts;ok('wrong count 310 flagged with the true chart count',r.counts.length===1&&r.counts[0].code==='310'&&r.counts[0].counted===ex.X&&r.counts[0].listed===ex.X+60,r.counts);
ok('321 off by 2 stitches is inside the tolerance',!r.counts.some(x=>x.code==='321'));
r=R('image-chart');ok('image-only chart: skipped with the gentle note, no flags',r.status==='no-chart'&&PCH.lines(r).length===0&&PCH.note(r)===PCH.STR.noChart,r);
r=R('two-column');ok('two-column key: all 6 colors read, no flags',r.status==='checked'&&clean(r),r);
r=R('two-column-bad');ok('two-column key: % extra and 3865 (@) unused',r.extra.map(x=>x.sym).join()==='%'&&r.unused.map(x=>x.code).join()==='3865',r);
ok('tolerance: >10% and >5 stitches',PCH.differs(112,100)&&!PCH.differs(109,100)&&!PCH.differs(25,20)&&PCH.differs(26,20));
// Myke's real AI images, rebuilt as text-layer PDFs (synthetic replicas)
r=R('ghost-replica');const g=PCH.lines(r);
ok('ghost: H used for 602 and 6003',r.symMulti.some(x=>x.sym==='H'&&x.codes.includes('602')&&x.codes.includes('6003')),r.symMulti);
ok('ghost: V used for 3685 and 211',r.symMulti.some(x=>x.sym==='V'&&x.codes.includes('3685')&&x.codes.includes('211')),r.symMulti);
ok('ghost: 3685 has two symbols (V, K)',r.codeMulti.some(x=>x.code==='3685'),r.codeMulti);
ok('ghost: chart symbols @ and ii not in key',['@','ii'].every(s=>r.extra.some(x=>x.sym===s)),r.extra);
ok('ghost: row 49 repeats, 37 to 40 missing',r.labels.repeat.includes(49)&&JSON.stringify(r.labels.missing)==='[37,38,39,40]',r.labels);
r=R('barrel-replica');
ok('barrel: 310 listed with two symbols',r.codeMulti.some(x=>x.code==='310'),r.codeMulti);
ok('barrel: wrong counts flagged (e.g. 936 says 38)',r.counts.some(x=>x.code==='936'&&x.listed===38),r.counts);
ok('barrel: heart symbol in chart not in key',r.extra.some(x=>x.sym==='\u2665'),r.extra);
// What the existing v1 checker catches on the same replicas
const v1=k=>{const parsed=C.parsePages(P[k].map(p=>({page:p.page,text:p.text})),DMC);return PC.check(parsed,DMC,SK)};
const vg=v1('ghost-replica'),vb=v1('barrel-replica');console.log('INFO v1 ghost',JSON.stringify(vg));console.log('INFO v1 barrel',JSON.stringify(vb));
ok('v1 ghost: duplicates 3608/3607/3685/211 flagged',['3608','3607','3685','211'].every(c=>vg.dup.includes(c)),vg.dup);
ok('v1 ghost: 6003 not a DMC code',vg.fake.includes('6003'),vg.fake);
ok('v1 barrel: 310 duplicate flagged',vb.dup.includes('310'),vb.dup);
for(const k of ['ghost-replica','ghost-below']){const rows=C.parsePages(P[k].map(p=>({page:p.page,text:p.text})),DMC).rows.map(x=>x.code).sort().join();ok(k+': imports exactly the 6 key colors (no DMC 01 from a row label)',rows==='211,310,3607,3608,3685,602',rows)}
{const rows=C.parsePages(P['barrel-replica'].map(p=>({page:p.page,text:p.text})),DMC).rows.map(x=>x.code);ok('barrel replica: no row labels imported as codes',rows.every(c=>c.length>=3),rows)}
{const r=C.parsePages([{page:1,text:'12 Tender Green 2 skeins'}],DMC).rows.map(x=>x.code).join();ok('no chart on the page: "12 Tender Green 2 skeins" still imports DMC 12',r==='12',r)}
const all=JSON.stringify(Object.keys(P).map(k=>{const x=PCH.check(P[k],DMC);return[PCH.lines(x),PCH.note(x)]}))+JSON.stringify(PCH.STR.sum({sum:1,room:1,w:1,h:1}));
ok('no em dashes in any v2 copy',!/\u2014/.test(all));
ok('no he/she pronouns in copy',!/\b(he|she|his|her)\b/i.test(all));
console.log(`${N} passed, ${F} failed`);process.exit(F?1:0);
