// node tests/pattern_trust_unit.cjs : Pattern trust verdict + "Fix it for me" (simulated, synthetic data).
const fs=require('fs'),path=require('path');const T=require('../pip-hybrid/pattern-trust.js'),PCH=require('../pip-hybrid/pattern-chart.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const DMC=JSON.parse(/DMC=(\{"WHITE".*?\}\})/.exec(html)[1]);
let N=0,F=0;const ok=(n,c,d)=>{c?N++:F++;console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+String(JSON.stringify(d)).slice(0,400)))};
const r1=o=>({fake:[],dup:[],names:[],amounts:[],count:0,...o});
const r2=o=>({status:'checked',extra:[],unused:[],counts:[],symMulti:[],codeMulti:[],labels:{repeat:[],missing:[]},size:null,sum:null,...o});
const L=(a,b)=>T.verdict(a,b).level;
// 1) verdict table: every check alone hits its level
ok('clean + chart read: green',L(r1(),r2())==='green');
ok('clean + picture chart: green-key',L(r1(),r2({status:'no-chart'}))==='green-key'&&L(r1(),null)==='green-key');
for(const [n,a,b] of [['fake',r1({fake:['3999']}),r2()],['symMulti',r1(),r2({symMulti:[{sym:'H',codes:['1','2']}]})],['extra',r1(),r2({extra:[{sym:'%',n:9}]})],['missing rows',r1(),r2({labels:{repeat:[],missing:[37]}})]])ok(n+' alone: red',L(a,b)==='red',T.verdict(a,b));
for(const [n,a,b] of [['names',r1({names:[{code:'3865',listed:'Sky Blue',catalog:'winter white'}]}),r2()],['dup',r1({dup:['310']}),r2()],['codeMulti',r1(),r2({codeMulti:[{code:'310',syms:['X','O']}]})],['counts',r1(),r2({counts:[{code:'310',sym:'X',listed:100,counted:50}]})],['sum',r1(),r2({sum:{sum:9,room:4,w:2,h:2}})],['repeat rows',r1(),r2({labels:{repeat:[49],missing:[]}})]])ok(n+' alone: amber',L(a,b)==='amber',T.verdict(a,b));
ok('unused alone: still green, listed as a tip',L(r1(),r2({unused:[{code:'797',sym:'='}]}))==='green'&&T.verdict(r1(),r2({unused:[{code:'797',sym:'='}]})).tips.length===1);
ok('amounts alone: still green, a tip',L(r1({amounts:[{code:'321',stated:1,est:5,fabric:'x',stitches:9000,kind:'low'}]}),r2())==='green');
ok('mixed takes the worst (amber + red = red)',L(r1({dup:['310'],fake:['9999']}),r2())==='red');
const v=T.verdict(r1({fake:['9999','4000'],names:[{code:'3865',listed:'Sky Blue',catalog:'winter white'}]}),r2({extra:[{sym:'%',n:3}]}));
ok('one item per code: 2 fakes + 1 name + 1 extra = 4 items',v.items.length===4,v.items);
ok('fake and name items offer Fix it, others do not',v.items.filter(i=>i.fix).map(i=>i.kind).join()==='fake,fake,name',v.items);
ok('item text reuses the existing approved sentences',v.items[0].text.includes('9999')&&v.items.some(i=>i.text===PCH.STR.extra({sym:'%',n:3})),v.items);
// 2) CIEDE2000 against Sharma, Wu, Dalal (2005) reference pairs
const S=[[[50,2.6772,-79.7751],[50,0,-82.7485],2.0425],[[50,-1.3802,-84.2814],[50,0,-82.7485],1.0000],[[50,0,0],[50,-1,2],2.3669],[[50,2.5,0],[73,25,-18],27.1492],[[50,2.5,0],[50,3.1736,0.5854],1.0000],[[60.2574,-34.0099,36.2677],[60.4626,-34.1751,39.4387],1.2644],[[90.8027,-2.0831,1.441],[91.1528,-1.6435,0.0447],1.4441],[[2.0776,0.0795,-1.135],[0.9033,-0.0636,-0.5514],0.9082]];
ok('CIEDE2000 matches the 8 reference pairs to 4 decimals',S.every(([a,b,e])=>Math.abs(T.de00(a,b)-e)<1e-4),S.map(([a,b,e])=>[T.de00(a,b).toFixed(4),e]));
// 3) nearest: golden cases
let m=T.suggest({code:'3999',name:'Deep Forest Green',hex:'#2f4f2f'},DMC);ok('3999 Deep Forest Green -> 890, then 500 and 934',m.best&&m.best.code==='890'&&m.alts.map(a=>a.code).join()==='500,934',m);
m=T.suggest({code:'3999',name:'Deep Forest Green'},DMC);ok('name only (paste, no swatch): "Deep" reads as dark -> 987 dk forest green',m.best&&m.best.code==='987',m);
m=T.suggest({code:'8120',name:'Dusty Rose',hex:'#c48a8a'},DMC);ok('8120 Dusty Rose -> 3727',m.best&&m.best.code==='3727',m);
m=T.suggest({code:'317B',name:'Pewter Gray'},DMC);ok('317B Pewter Gray -> 317 (typo hint + name)',m.best&&m.best.code==='317',m);
m=T.suggest({code:'9999',name:''},DMC);ok('no name, no swatch: no guess, type a number only',!m.best&&m.alts.length===0&&m.reason==='nothing',m);
m=T.suggest({code:'4000',name:'',hex:'#00ffff'},DMC);ok('best distance >=10: no suggestion',!m.best&&m.reason==='far',m);
m=T.suggest({code:'3999',name:'Deep Forest Green',hex:'#2f4f2f'},DMC,{exclude:['890']});ok('codes already in the list are not suggested',m.best.code==='500',m);
m=T.suggest({code:'3865',name:'Sky Blue'},DMC);ok('name only: Sky Blue -> a real blue with a name match',m.best&&/blue/.test(DMC[m.best.code].name),m);
ok('closeness labels: <5 very, <10 close',T.closeness(4.4)==='very'&&T.closeness(7)==='close');
// 4) import fix + undo restore exact original
const rows0=[{code:'310',qty:2,stitchCount:null,sourcePage:1,sourceLine:'DMC 310 Black 2 skeins',warnings:[],confirmed:false},{code:'3865',qty:1,stitchCount:null,sourcePage:1,sourceLine:'DMC 3865 Sky Blue 1 skein',warnings:[],confirmed:false}];
const sk0=[{page:1,line:'DMC 3999 Deep Forest Green 2 skeins',reason:'unrecognized'}];
const st={rows:JSON.parse(JSON.stringify(rows0)),skipped:JSON.parse(JSON.stringify(sk0)),log:[]};const before=JSON.stringify({rows:st.rows,skipped:st.skipped});
const parse=t=>require('../pip-hybrid/pattern-core.js').parsePages([{page:1,text:t}],DMC);
const f1=T.importFix(st,{kind:'fake',from:'3999',to:'890'},parse);ok('fake fix adds DMC 890 with the amount from the line, removes the skipped line',f1&&st.rows.some(r=>r.code==='890'&&r.qty===2&&r.fixedFrom==='3999')&&!st.skipped.length,st);
const f2=T.importFix(st,{kind:'name',from:'3865',to:'519'},parse);ok('name fix swaps the code and marks it',st.rows.some(r=>r.code==='519'&&r.fixedFrom==='3865')&&!st.rows.some(r=>r.code==='3865'),st.rows);
ok('fix log has 2 entries',st.log.length===2);
T.importUndo(st,f1.id);ok('undo one: the other fix stays',st.rows.some(r=>r.code==='519')&&!st.rows.some(r=>r.code==='890')&&st.skipped.length===1,st);
T.importUndoAll(st);ok('undo all: rows and skipped lines byte-identical to before',JSON.stringify({rows:st.rows,skipped:st.skipped})===before&&!st.log.length,st);
ok('nothing changes without a fix call (suggest is pure)',(()=>{const d=JSON.stringify(DMC);T.suggest({code:'3999',name:'Deep Forest Green'},DMC);return JSON.stringify(DMC)===d})());
// 5) project fix + undo
const proj0={id:'p1',name:'P',notes:'',buyBrand:'dmc',status:'planning',items:[{code:'310',qty:2,stated:true,assumed:0,src:['Reviewed pattern legend: DMC 310 Black 2 skeins'],stitchCount:null},{code:'3865',qty:1,stated:true,assumed:0,src:['Reviewed pattern legend: DMC 3865 Sky Blue 1 skein'],stitchCount:null}],decisions:{'310':{status:'have'},'3865':{status:'buy'}},purchased:{},pcheck:{v:1,open:[{code:'3999',line:'DMC 3999 Deep Forest Green 2 skeins',page:1}],fixes:[]},created:'a',updated:'b'};
const p=JSON.parse(JSON.stringify(proj0)),pb=JSON.stringify(proj0);
const g1=T.projectFix(p,{kind:'fake',from:'3999',to:'890'},parse);ok('project fake fix: item 890 added, open list empty, decision blank',p.items.some(i=>i.code==='890'&&i.qty===2)&&!p.pcheck.open.length&&p.decisions['890']&&p.decisions['890'].status===null,p);
const g2=T.projectFix(p,{kind:'name',from:'3865',to:'519'},parse);ok('project name fix: same spot, new code, old decision kept in the log',p.items[1].code==='519'&&!p.decisions['3865']&&p.pcheck.fixes.length===2,p);
ok('projectChecks finds name mismatch from saved source lines',T.projectChecks(JSON.parse(pb),DMC).names.some(x=>x.code==='3865'));
T.projectUndo(p,g1.id);ok('project undo one',!p.items.some(i=>i.code==='890')&&p.pcheck.open.length===1&&p.items[1].code==='519',p);
T.projectUndoAll(p);const a=JSON.parse(JSON.stringify(p));delete a.updated;const b=JSON.parse(pb);delete b.updated;ok('project undo all: byte-identical (except updated time)',JSON.stringify(a)===JSON.stringify(b),[a,b]);
ok('a fake fix to a code already in the project is refused',T.projectFix(p,{kind:'fake',from:'3999',to:'310'},parse)===null&&JSON.stringify((()=>{const c=JSON.parse(JSON.stringify(p));delete c.updated;return c})())===JSON.stringify(b));
ok('normPcheck drops junk and keeps good data',JSON.stringify(T.normPcheck({v:1,open:[{code:'3999',line:'x',page:1},{bad:1}],fixes:[{id:'f1',kind:'zzz'}]}))==='{"v":1,"open":[{"code":"3999","line":"x","page":1}],"fixes":[]}'&&T.normPcheck({v:1,open:[],fixes:[]})===undefined&&T.normPcheck('x')===undefined);
// 6) strings: no em dashes, Pip they/them
const all=JSON.stringify(Object.values(T.STR).map(x=>typeof x==='function'?x({n:3,code:'3999',to:'890',from:'3999',name:'Deep Forest Green'}):x));ok('no em dashes in new strings',!/\u2014/.test(all));ok('Pip is never he/she',!/\b(he|she|his|her)\b/i.test(all),all);
// 7) known edge case: key line "● 1 White" on a numbered-chart page
const it=(s,x,y)=>({s,x,y,w:s.length*5});const items=[it('Key',10,500),it('●',10,480),it('1',30,480),it('White',50,480),it('X',10,465),it('310',30,465),it('Black',50,465)];
for(let r=0;r<6;r++){items.push(it(String(r+1),10,400-r*10));for(let c=0;c<8;c++)items.push(it((r+c)%2?'●':'X',30+c*10,400-r*10))}
const rr=PCH.check([{page:1,text:'',items}],DMC);ok('"● 1 White" is read as DMC 01, not dropped (no false extra symbol)',!rr.extra.some(e=>e.sym==='●')&&!rr.unused.length,rr);
// 8) verdict re-evaluates after fixes (Pixel question): red -> amber/green, undo all -> red, survives save/load (JSON)
{const pv=q=>T.verdict(T.projectChecks(q,DMC),null).level;const q=JSON.parse(JSON.stringify(proj0));const orig=JSON.stringify(q);
 ok('project: red with an open unknown code',pv(q)==='red',T.projectChecks(q,DMC));
 T.projectFix(q,{kind:'fake',from:'3999',to:'987'},parse);ok('project: all red fixed, name mismatch left -> amber',pv(q)==='amber',T.projectChecks(q,DMC));
 const q2=JSON.parse(JSON.stringify(q));ok('project: amber survives save and reload',pv(q2)==='amber');
 T.projectFix(q2,{kind:'name',from:'3865',to:'519'},parse);ok('project: everything fixed -> green',pv(q2)==='green-key'&&T.verdict(T.projectChecks(q2,DMC),null).label==='Nothing stood out in the color key');
 const q3=JSON.parse(JSON.stringify(q2));ok('project: green survives save and reload',pv(q3)==='green-key');
 T.projectUndoAll(q3);ok('project: Undo all -> red again, exact original',pv(q3)==='red'&&JSON.stringify(q3)===orig,q3);
 const r=JSON.parse(JSON.stringify(proj0));r.items=r.items.filter(i=>i.code!=='3865');delete r.decisions['3865'];T.projectFix(r,{kind:'fake',from:'3999',to:'987'},parse);ok('project: only red item fixed -> green',pv(r)==='green-key',T.projectChecks(r,DMC));
 const st={rows:[],skipped:JSON.parse(JSON.stringify(sk0)),log:[]};const iv=()=>T.verdict({fake:st.skipped.length?['3999']:[],names:[],dup:[],amounts:[],count:0},null).level;
 ok('import: red before fix',iv()==='red');T.importFix(st,{kind:'fake',from:'3999',to:'987'},parse);ok('import: red fixed -> green',iv()==='green-key');T.importUndoAll(st);ok('import: Undo all -> red',iv()==='red')}
// 9) Pixel final text, exactly
{const S=T.STR,x={from:'3999',to:'987',name:'Deep Forest Green',catalog:'winter white'};
 for(const [k,got,want] of [['green',S.green,'Nothing stood out in the chart'],['greenKey',S.greenKey,'Nothing stood out in the color key'],
  ['sheetFake',S.sheetFake(x),`We couldn't find DMC 3999 in the DMC catalog. The key calls it "Deep Forest Green". Here's the closest DMC color we found.`],
  ['sheetName',S.sheetName(x),`The key calls DMC 3999 "Deep Forest Green", but in the DMC catalog 3999 is winter white. Here's a DMC color that fits the name.`],
  ['titleFake',S.titleFake(x),'Change DMC 3999?'],['far',S.far,"We couldn't find a close DMC color. Type the DMC number from your pattern."],
  ['nothing',S.nothing,"There's no color name to go on, so we won't guess. Type the DMC number from your pattern."],['notDmc',S.notDmc,'Not in the DMC catalog'],
  ['typeBad',S.typeBad,"We don't know that DMC number. Check it against your pattern."],['changed',S.changed(x),'Changed DMC 3999 to DMC 987.'],['undone',S.undone(x),'Put back DMC 3999.'],
  ['undoneAll 2',S.undoneAll(2),'Put back 2 fixes.'],['undoneAll 1',S.undoneAll(1),'Put back 1 fix.'],['pipRed',S.pipRed,"A few things need a look before you stitch. See Pattern check. I haven't changed anything."]])ok('Pixel text: '+k,got===want,got);
 const csv=fs.readFileSync('/workspace/pip-art/m-involved/a-strings.csv','utf8'),row=csv.split('\n').find(l=>l.startsWith('pipA.pcheck.red,'));const pip=fs.readFileSync(path.join(__dirname,'..','pip.js'),'utf8');
 ok('pipA.pcheck.red in pip.js matches a-strings.csv and uses magnifier',row&&row.includes(S.pipRed)&&row.includes(',magnifier,')&&pip.includes("'pipA.pcheck.red':v=>`"+S.pipRed+'`')&&pip.includes("'pipA.pcheck.red':'magnifier'"))}
console.log(`${N} passed, ${F} failed`);process.exitCode=F?1:0;
