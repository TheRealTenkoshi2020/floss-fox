// node tests/parse_unit.js : list parser tests, independent of the UI. Uses the real DMC chart from index.html.
const fs=require('fs');const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const DMC=JSON.parse(html.match(/const DMC=(\{.*?\});/)[1]);
const parse=require('../parse.js').make(DMC);let pass=0,fail=0;
const t=(n,c)=>{try{if(c()){pass++;console.log('PASS',n)}else{fail++;console.log('FAIL',n)}}catch(e){fail++;console.log('FAIL',n,e.message)}};
const codes=r=>r.items.map(i=>i.code).join(' ');const I=(r,c)=>r.items.find(i=>i.code===c);
// plain + comma + mixed separators
let r=parse('310\n321\n666\n823');t('plain list, one per line',()=>codes(r)==='310 321 666 823'&&!r.errs.length);
r=parse('310, 321,666 ;823');t('comma/semicolon list',()=>codes(r)==='310 321 666 823'&&!r.errs.length);
r=parse('310\t321');t('tab between two bare numbers is flagged, not guessed',()=>r.errs.length===1&&r.errs[0].kind==='multi');
r=parse('1\tDMC\t310\tBlack\t1160');t('tab-separated legend row',()=>codes(r)==='310'&&I(r,'310').stitchCount===1160);
// numbered legends + the brief example
r=parse('1 DMC 03 Tin - Medium 1160');t('brief example: row 1 ignored, DMC 03, 1160 stitches',()=>codes(r)==='03'&&I(r,'03').stitchCount===1160&&I(r,'03').qty===1&&!r.errs.length);
r=parse('1. DMC 310 Black 520\n2) DMC 321 Red 88\n10: DMC 3865 Winter White 2,340');t('numbered legend with 1. 2) 10: and a 1,160-style count',()=>codes(r)==='310 321 3865'&&I(r,'3865').stitchCount===2340&&I(r,'321').stitchCount===88);
r=parse('12 ★ DMC 310 Black 5');t('row number + symbol before DMC',()=>codes(r)==='310'&&I(r,'310').stitchCount===5);
r=parse('DMC310\nDMC-321\nDMC: 666\ndmc #823');t('DMC glued, dash, colon, hash',()=>codes(r)==='310 321 666 823');
// descriptions
r=parse('DMC 310 Black\n321 Red\n3865 Winter White\nDMC 931 Antique Blue - Medium');t('descriptions are ignored',()=>codes(r)==='310 321 3865 931'&&r.items.every(i=>i.stitchCount===null));
r=parse('310 Black 1160');t('id, description, trailing stitch count',()=>I(r,'310').stitchCount===1160);
r=parse('DMC 310 Black 1160 stitches\nDMC 321 2,000 sts');t('"stitches"/"sts" words',()=>I(r,'310').stitchCount===1160&&I(r,'321').stitchCount===2000);
// skein amounts (old syntax kept)
r=parse('310 x2\n321 ×3\n666x2\n823 (2)\n699 3 skeins\n415 x?');t('skein amounts unchanged',()=>I(r,'310').qty===2&&I(r,'321').qty===3&&I(r,'666').qty===2&&I(r,'823').qty===2&&I(r,'699').qty===3&&I(r,'415').qty===null);
r=parse('DMC 699 Green 3 skeins 400');t('skeins and stitches on one line',()=>I(r,'699').qty===3&&I(r,'699').stitchCount===400);
r=parse('310');t('no amount = 1 assumed',()=>I(r,'310').qty===1&&I(r,'310').assumed===1&&I(r,'310').stated===false);
// leading zeros
r=parse('03\n3\n04\n09\n01');t('leading zeros kept; single digit 3 reads as 03 (DMC has no "3")',()=>codes(r)==='03 04 09 01'&&I(r,'03').src.length===2);
r=parse('DMC 03 Tin\nDMC 30 Blueberry');t('03 and 30 stay different',()=>codes(r)==='03 30');
// alphanumeric ids
r=parse('B5200\nEcru\nBLANC\nwhite\nDMC blanc 300');t('B5200, Ecru, BLANC and WHITE stay separate colors (ci005-82)',()=>codes(r)==='B5200 ECRU BLANC WHITE'&&I(r,'BLANC').src.length===2&&I(r,'BLANC').stitchCount===300&&I(r,'WHITE').src.length===1);
r=parse('DMC E168\nE3821\nDMC 4010\n3880\n3895');t('E-series and 4000s are named as not in chart (not dropped); 3880/3895 ok',()=>codes(r)==='3880 3895'&&r.errs.length===3&&/Light Effects/.test(r.errs[0].why)&&/Color Variations/.test(r.errs[2].why));
// duplicates
r=parse('1 DMC 310 Black 100\n7 DMC 310 Black 50\n310 x2');t('duplicates merge, stitches add up, every line kept in src',()=>r.items.length===1&&I(r,'310').stitchCount===150&&I(r,'310').src.length===3&&I(r,'310').qty===4);
// blank lines
r=parse('\n\n310\n   \n\n321\n\n');t('blank lines skipped, nothing else',()=>codes(r)==='310 321'&&!r.errs.length&&r.lines===2);
// invalid + ambiguous lines are never dropped
r=parse('9999\nhello world\n310 321 415\n415 2 strands\n310 two skeins\n310 x0\n310 1160\n1 310 Black 1160');
t('every bad line reported (8 lines, 8 errors)',()=>r.errs.length===8&&!r.items.length);
t('errors keep the original text and a line number',()=>r.errs[1].t==='hello world'&&r.errs[1].line===2&&r.errs[7].line===8);
t('"310 321 415" offers a split fix',()=>r.errs[2].fixes.some(f=>f.text==='310, 321, 415'));
t('"310 1160" offers "DMC 310 with 1,160 stitches" or "DMC 310 only", never 1160 skeins',()=>JSON.stringify(r.errs[6].fixes.map(f=>f.label))==='["DMC 310 with 1,160 stitches","DMC 310 only"]'&&!r.errs[6].fixes.some(f=>/x1160|skein/i.test(f.text+f.label)));
t('"1 310 Black 1160" offers the row-number reading',()=>r.errs[7].fixes.some(f=>f.label==='Row 1: DMC 310, 1160 stitches'));
t('suggested fixes parse cleanly',()=>r.errs.flatMap(e=>e.fixes).every(f=>{const q=parse(f.text);return q.items.length&&!q.errs.length}));
const txt='310\nhello\n321';r=parse(txt);t('error start/end point at the text in the box',()=>txt.slice(r.errs[0].start,r.errs[0].end)==='hello');
// quantity safeguards (cap = 20 skeins per color)
const P=require('../parse.js');t('skein cap is 20',()=>P.SKEIN_CAP===20);
r=parse('DMC 310 x20');t('20 skeins accepted',()=>I(r,'310').qty===20&&!r.errs.length);
for(const s of ['310 x25','310 (40)','310 30 skeins','DMC 310 Black x1160']){const q=parse(s);t(`"${s}": over the cap needs confirmation, not accepted`,()=>!q.items.length&&q.errs.length===1&&/is a lot/.test(q.errs[0].why))}
r=parse('310 x25');t('over-cap fixes: stitches, color only, and a confirm-only "Yes" (never a default)',()=>{const f=r.errs[0].fixes;return f[0].label==='DMC 310 with 25 stitches'&&f[1].label==='DMC 310 only'&&f[2].confirm===true&&f.filter(x=>x.confirm).length===1&&!f[0].confirm})
r=parse('310 x25 confirmed');t('"confirmed" override keeps 25 skeins, stated (not assumed)',()=>I(r,'310').qty===25&&I(r,'310').assumed===0&&I(r,'310').stitchCount===null);
r=parse('310 2');t('"310 2": skeins offered only because 2 is plausible; no "split into 310 and 02"',()=>{const l=r.errs[0].fixes.map(f=>f.label);return l.join('|')==='DMC 310 with 2 stitches|DMC 310, 2 skeins|DMC 310 only'});
r=parse('310 x0\n310 x-2\n310 x1.5\n310 x 2.0\nDMC 310 0 stitches\nDMC 310 -5');t('zero, negative and non-whole amounts rejected (6 lines, 6 errors)',()=>r.errs.length===6&&!r.items.length);
// three separate fields: skeins / assumed skeins / stitch count
r=parse('1 DMC 310 Black 1160');t('stitch count never becomes skeins: 1160 stitches, assumed 1 skein',()=>{const i=I(r,'310');return i.stitchCount===1160&&i.qty===1&&i.assumed===1&&i.stated===false});
r=parse('DMC 310 x3 1160');t('skeins and stitches side by side: 3 skeins (stated), 1160 stitches',()=>{const i=I(r,'310');return i.qty===3&&i.assumed===0&&i.stitchCount===1160});
r=parse('DMC 310 500\n310 x2');t('merge keeps them apart: 1 assumed + 2 stated = 3 skeins (1 assumed), 500 stitches',()=>{const i=I(r,'310');return i.qty===3&&i.assumed===1&&i.stitchCount===500});
t('items carry stitchCount (no old "stitches" field)',()=>!('stitches' in I(r,'310')));
// 120+ entries
const all=Object.keys(DMC).filter(c=>c!=='WHITE');const big=all.slice(0,130).map((c,i)=>`${i+1} DMC ${c} Some Name ${i*10+5}`).join('\n');
r=parse(big);t('130-line numbered legend: 130 colors, 0 errors',()=>r.items.length===130&&!r.errs.length&&r.lines===130&&r.items[129].stitchCount===1295);
r=parse(all.join(', '));t(`whole chart (${all.length}) as one comma line`,()=>r.items.length===all.length&&!r.errs.length);
// very long input
const huge=Array.from({length:5000},(_,i)=>`${i+1} DMC ${all[i%all.length]} Long description words here ${i+1}`).join('\n');
let ms=Date.now();r=parse(huge);ms=Date.now()-ms;t(`5000 lines (${huge.length} chars) parsed in ${ms} ms, merged to ${all.length} colors`,()=>r.items.length===all.length&&!r.errs.length&&ms<3000);
r=parse('310 '+'Very long description '.repeat(1000)+'\n'+'!'.repeat(20000));t('a 22,000-character description is kept; a 20,000-character junk line is reported, not dropped',()=>codes(r)==='310'&&r.errs.length===1&&r.errs[0].line===2);
t('parser code has no DOM/storage/network',()=>{const s=fs.readFileSync(__dirname+'/../parse.js','utf8').replace(/\/\*[\s\S]*?\*\//g,'');return !/document|localStorage|fetch|XMLHttpRequest|sendBeacon|innerHTML/.test(s)});
console.log(`\nparse_unit: ${pass} passed, ${fail} failed`);process.exit(fail?1:0);
