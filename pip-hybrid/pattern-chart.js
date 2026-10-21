/* Pattern check v2 (dev): does the color key match the chart? Read-only, local only, never blocks saving.
   Works only when the chart's symbols are real PDF text (one symbol per grid cell). A chart that is a picture is skipped
   with a gentle note. Wording is PLACEHOLDER for Pixel (plain, no em dashes, Pip is they/them). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPatternChart=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const CODE=/^(?:BLANC|ECRU|B5200|\d{1,4})$/i, INT=/^\d{1,3}$/;
// Count tolerance: flag only when the key and the chart differ by more than 10% AND more than 5 stitches.
const TOL_PCT=0.10, TOL_ABS=5;
const differs=(listed,counted)=>{const d=Math.abs(listed-counted);return d>TOL_ABS&&d>TOL_PCT*counted};
// Text items -> visual rows of whitespace tokens, each with an estimated x (items can hold several words).
function tokenRows(items){const rows=[];for(const it of items||[]){if(!it||typeof it.s!=='string')continue;let r=rows.find(q=>Math.abs(q.y-it.y)<2);if(!r){r={y:it.y,items:[]};rows.push(r)}r.items.push(it)}
 rows.sort((a,b)=>b.y-a.y);
 for(const r of rows){r.items.sort((a,b)=>a.x-b.x);r.toks=[];for(const it of r.items){const s=it.s,cw=(it.w||s.length*5)/Math.max(1,s.length);const re=/\S+/g;let m;while((m=re.exec(s)))r.toks.push({t:m[0],x:it.x+m.index*cw})}}
 return rows}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:0};
const isSeq=ts=>{if(ts.length<5)return false;const v=ts.map(t=>/^\d+$/.test(t.t)?+t.t:(/^[A-Z]$/.test(t.t)?t.t.charCodeAt(0):NaN));if(v.some(Number.isNaN))return false;let up=0;for(let i=1;i<v.length;i++)if(v[i]>v[i-1])up++;return up>=0.8*(v.length-1)};
// Chart grid: 5+ rows with 6+ short tokens (1 or 2 characters) on a shared, regular cell pitch.
function findGrid(rows0){const rows=rows0.map(r=>({...r,toks:r.toks.filter(t=>!t.used)})).filter(r=>r.toks.length);const cand=rows.filter(r=>{const sh=r.toks.filter(t=>t.t.length<=2);return sh.length>=6&&sh.length>=0.8*r.toks.length&&!isSeq(sh)});
 if(cand.length<5)return null;const gaps=[];for(const r of cand)for(let i=1;i<r.toks.length;i++)gaps.push(r.toks[i].x-r.toks[i-1].x);const pitch=median(gaps);if(!(pitch>2))return null;
 const ok=cand.filter(r=>{let g=0;for(let i=1;i<r.toks.length;i++){const d=(r.toks[i].x-r.toks[i-1].x)/pitch;if(Math.abs(d-Math.round(d))<0.3)g++}return g>=0.8*(r.toks.length-1)});if(ok.length<5)return null;
 // Row labels: integers at the left edge of most rows. They are not stitches.
 const xs=ok.map(r=>r.toks[0].x),x0=median(xs),labelled=ok.filter(r=>INT.test(r.toks[0].t)&&Math.abs(r.toks[0].x-x0)<pitch*0.5);
 const hasLabels=labelled.length>=0.8*ok.length,labels=[],cells=[];let minX=Infinity,maxX=-Infinity;
 for(const r of ok){let ts=r.toks;if(hasLabels&&INT.test(ts[0].t)&&Math.abs(ts[0].x-x0)<pitch*0.5){labels.push(+ts[0].t);ts=ts.slice(1)}for(const t of ts){cells.push(t.t);minX=Math.min(minX,t.x);maxX=Math.max(maxX,t.x)}}
 return{rows:ok,cells,labels,height:ok.length,width:Math.round((maxX-minX)/pitch)+1}}
// Row labels that repeat or skip (49, 49 or 36 then 41). Uses the usual step between labels.
function labelProblems(labels){if(labels.length<5)return{repeat:[],missing:[]};const steps=[];for(let i=1;i<labels.length;i++)steps.push(labels[i]-labels[i-1]);const st=median(steps.filter(s=>s>0))||1,repeat=[],missing=[];
 for(let i=1;i<labels.length;i++){const a=labels[i-1],b=labels[i];if(b===a){if(!repeat.includes(b))repeat.push(b)}else if(b>a+st&&(b-a)%st===0){for(let v=a+st;v<b;v+=st)missing.push(v)}}return{repeat,missing}}
// Key entries: symbol, optional "=", optional "DMC", code, then name words, then (if the page has a Stitches column) a count.
function keyEntries(rows,validCodes){const out=[];const countCol=rows.some(r=>r.toks.some(t=>/^(stitches|count)$/i.test(t.t)));
 for(const r of rows){const T=r.toks;for(let i=0;i<T.length;i++){let j=i;const sym=T[j].t;if(sym.length>2||/^\d+$/.test(sym)||/^dmc$/i.test(sym))continue;if(/^[x×]$/i.test(sym)&&i>0&&/\d$/.test(T[i-1].t))continue;/* "24 x 18" is a size */j++;
  if(T[j]&&T[j].t==='='&&sym!=='=')j++;if(T[j]&&/^dmc$/i.test(T[j].t))j++;if(!T[j]||!CODE.test(T[j].t))continue;const code=T[j].t.toUpperCase();
  const valid=!validCodes||!!validCodes[code];if(!valid&&!/^\d{3,4}$/.test(code))continue;if(T[j+1]&&/^(stitch|stitches|ct)\b/i.test(T[j+1].t))continue;let k=j+1;const name=[];let count=null;
  while(k<T.length){const t=T[k].t;if(t.length<=2&&!/^\d+$/.test(t)&&T[k+1]&&(CODE.test(T[k+1].t)||T[k+1].t==='='||/^dmc$/i.test(T[k+1].t)))break;if(/^\d+$/.test(t)){if(countCol&&count===null)count=+t;k++;break}name.push(t);k++}
  for(let q=i;q<k;q++)T[q].used=true;out.push({sym,code,valid,name:name.join(' '),count});i=k-1}}
 return out}
function statedSize(pages){for(const p of pages||[]){const m=/\b(\d{2,4})\s*[x×]\s*(\d{2,4})\s*stitch/i.exec(p.text||'');if(m)return{w:+m[1],h:+m[2]}}return null}
function check(pages,validCodes){const res={status:'none',extra:[],unused:[],counts:[],symMulti:[],codeMulti:[],labels:{repeat:[],missing:[]},size:null,sum:null};
 if(!Array.isArray(pages)||!pages.length)return res;let key=[],cells=[],labels=[],grid=null,dims=null;
 for(const p of pages){const rows=tokenRows(p.items);key.push(...keyEntries(rows,validCodes));const g=findGrid(rows);if(g){grid=true;cells.push(...g.cells);labels.push(...g.labels);dims=dims||{w:g.width,h:0};dims.h+=g.height}}
 if(!key.length)return res;
 // One symbol, one code (and the reverse). Exact repeats of the same pair are left to the duplicate check.
 const bySym=new Map(),byCode=new Map();for(const e of key){(bySym.get(e.sym)||bySym.set(e.sym,new Set()).get(e.sym)).add(e.code);(byCode.get(e.code)||byCode.set(e.code,new Set()).get(e.code)).add(e.sym)}
 for(const [s,c] of bySym)if(c.size>1)res.symMulti.push({sym:s,codes:[...c]});for(const [c,s] of byCode)if(s.size>1)res.codeMulti.push({code:c,syms:[...s]});
 const size=statedSize(pages),counted=key.filter(e=>e.count!=null);
 // Listed counts that cannot fit in the stated design size (each code counted once).
 if(size&&counted.length){const once=new Map();for(const e of counted)if(!once.has(e.code))once.set(e.code,e.count);const sum=[...once.values()].reduce((a,b)=>a+b,0);if(sum>size.w*size.h)res.sum={sum,room:size.w*size.h,...size}}
 if(!grid){res.status='no-chart';return res}
 res.status='checked';const tally=new Map();for(const s of cells)tally.set(s,(tally.get(s)||0)+1);
 for(const [s,n] of tally)if(!bySym.has(s))res.extra.push({sym:s,n});
 for(const [s,codes] of bySym)if(!tally.has(s))for(const c of codes)if(!res.unused.some(u=>u.code===c))res.unused.push({code:c,sym:s});
 // Counts are compared only when one symbol means exactly one code and the key gives that code one count.
 for(const [c,syms] of byCode){if(syms.size!==1)continue;const s=[...syms][0];if(bySym.get(s).size!==1)continue;const ls=[...new Set(key.filter(e=>e.code===c&&e.count!=null).map(e=>e.count))];if(ls.length!==1)continue;const n=tally.get(s)||0;if(n&&differs(ls[0],n))res.counts.push({code:c,sym:s,listed:ls[0],counted:n})}
 res.labels=labelProblems(labels);
 return res}
// PLACEHOLDER wording for Pixel (plain, ELI5, no em dashes).
const st=n=>`${n} stitch${n===1?'':'es'}`, list=a=>a.length<3?a.join(' and '):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const STR={
 extra:x=>`The chart uses the symbol ${x.sym} (${st(x.n)}), but the color key doesn't list it. Check which color it should be.`,
 unused:x=>`DMC ${x.code} (symbol ${x.sym}) is in the color key, but that symbol never shows up in the chart. You might not need it.`,
 count:x=>`The key says DMC ${x.code} has ${st(x.listed)}, but we counted ${x.counted} ${x.sym} symbols in the chart. Check which is right.`,
 symMulti:x=>`The symbol ${x.sym} is used for more than one color (DMC ${list(x.codes)}). On the chart you can't tell them apart.`,
 codeMulti:x=>`DMC ${x.code} has more than one symbol in the key (${list(x.syms)}). Check if they're really the same color.`,
 sum:x=>`The key's stitch counts add up to ${x.sum}, but a ${x.w} x ${x.h} design only has room for ${x.room}. Some counts are probably wrong.`,
 unusedMany:l=>`${l.length} colors in the key never show up in the chart: DMC ${list(l.map(x=>x.code))}. You might not need them.`,
 repeat:l=>`Chart row number${l.length===1?'':'s'} ${list(l.map(String))} ${l.length===1?'shows':'show'} up twice. Rows may be doubled.`,
 missing:l=>`Chart row number${l.length===1?'':'s'} ${l.length>3?l[0]+' to '+l[l.length-1]:list(l.map(String))} ${l.length===1?'is':'are'} missing. Rows may have been left out.`,
 noChart:"We couldn't read the chart's symbols (it might be a picture), so we only checked the color key.",
 matched:'We also compared the chart with the color key.'};
function lines(r){const o=[];r.symMulti.forEach(x=>o.push(STR.symMulti(x)));r.codeMulti.forEach(x=>o.push(STR.codeMulti(x)));r.extra.forEach(x=>o.push(STR.extra(x)));if(r.unused.length>3)o.push(STR.unusedMany(r.unused));else r.unused.forEach(x=>o.push(STR.unused(x)));r.counts.forEach(x=>o.push(STR.count(x)));
 if(r.sum)o.push(STR.sum(r.sum));if(r.labels.repeat.length)o.push(STR.repeat(r.labels.repeat));if(r.labels.missing.length)o.push(STR.missing(r.labels.missing));return o}
function note(r){return r.status==='no-chart'?STR.noChart:r.status==='checked'?STR.matched:''}
return{check,lines,note,tokenRows,findGrid,keyEntries,labelProblems,differs,STR,TOL_PCT,TOL_ABS};
});
