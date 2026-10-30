/* Pattern check v2 (dev): does the color key match the chart? Read-only, local only, never blocks saving.
   Works only when the chart's symbols are real PDF text (one symbol per grid cell). A chart that is a picture is skipped
   with a gentle note. Wording is PLACEHOLDER for Pixel (plain, no em dashes, Pip is they/them). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPatternChart=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const CODE=/^(?:BLANC|WHITE|ECRU|B5200|\d{1,4})$/i, INT=/^\d{1,3}$/;
// Count tolerance: flag only when the key and the chart differ by more than 10% AND more than 5 stitches.
const TOL_PCT=0.10, TOL_ABS=5;
const differs=(listed,counted)=>{const d=Math.abs(listed-counted);return d>TOL_ABS&&d>TOL_PCT*counted};
// Text items -> visual rows of whitespace tokens, each with an estimated x (items can hold several words).
function tokenRows(items){const rows=[];for(const it of items||[]){if(!it||typeof it.s!=='string')continue;let r=rows.find(q=>Math.abs(q.y-it.y)<2);if(!r){r={y:it.y,items:[]};rows.push(r)}r.items.push(it)}
 rows.sort((a,b)=>b.y-a.y);
 for(const r of rows){r.items.sort((a,b)=>a.x-b.x);r.toks=[];for(const it of r.items){const s=it.s,cw=(it.w||s.length*5)/Math.max(1,s.length);const re=/\S+/g;let m;while((m=re.exec(s)))r.toks.push({t:m[0],x:it.x+m.index*cw,w:m[0].length*cw,y0:it.y})}}
 return rows}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:0};
const isSeq=ts=>{if(ts.length<5)return false;const v=ts.map(t=>/^\d+$/.test(t.t)?+t.t:(/^[A-Z]$/.test(t.t)?t.t.charCodeAt(0):NaN));if(v.some(Number.isNaN))return false;let up=0;for(let i=1;i<v.length;i++)if(v[i]>v[i-1])up++;return up>=0.8*(v.length-1)};
// Chart grid: 5+ rows with 6+ short tokens (1 or 2 characters) on a shared, regular cell pitch.
// symcheck: the grid is then treated as a region (x and y bounds). Every token inside it is a chart cell or a ruler/row
// number, never part of the color key, and row numbers on either edge (or column rulers) are never counted as symbols.
function findGrid(rows0){const rows=rows0.map(r=>({...r,toks:r.toks.filter(t=>!t.used)})).filter(r=>r.toks.length);const cand=rows.filter(r=>{const sh=r.toks.filter(t=>t.t.length<=2);return sh.length>=6&&sh.length>=0.8*r.toks.length&&!isSeq(sh)});
 if(cand.length<5)return null;const gaps=[];for(const r of cand)for(let i=1;i<r.toks.length;i++)gaps.push(r.toks[i].x-r.toks[i-1].x);const pitch=median(gaps);if(!(pitch>2))return null;
 const ok=cand.filter(r=>{let g=0;for(let i=1;i<r.toks.length;i++){const d=(r.toks[i].x-r.toks[i-1].x)/pitch;if(Math.abs(d-Math.round(d))<0.3)g++}return g>=0.8*(r.toks.length-1)});if(ok.length<5)return null;
 const near=(t,x)=>x!=null&&Math.abs(t.x-x)<pitch*0.5;
 // Row labels: integers at the left (and/or right) edge of most rows. They are not stitches.
 const x0=median(ok.map(r=>r.toks[0].x)),hasL=ok.filter(r=>INT.test(r.toks[0].t)&&near(r.toks[0],x0)).length>=0.8*ok.length;
 const lastInt=ok.map(r=>[...r.toks].reverse().find(t=>INT.test(t.t))).filter(Boolean),xr=lastInt.length?median(lastInt.map(t=>t.x)):null;
 const hasR=xr!=null&&(!hasL||Math.abs(xr-x0)>pitch)&&ok.filter(r=>r.toks.some(t=>INT.test(t.t)&&near(t,xr))).length>=0.8*ok.length;
 const isLabel=t=>INT.test(t.t)&&((hasL&&near(t,x0))||(hasR&&near(t,xr)));
 // Column rulers (1 2 3 ... above or below the grid) give the exact cell span when present.
 let lo=Infinity,hi=-Infinity;for(const r of ok)for(const t of r.toks)if(!isLabel(t)){lo=Math.min(lo,t.x);hi=Math.max(hi,t.x)}
 const ruler=rows.filter(r=>isSeq(r.toks.filter(t=>/^\d+$/.test(t.t)))&&r.toks.filter(t=>/^\d+$/.test(t.t)).length>=0.8*r.toks.length);
 if(ruler.length){const rx=ruler.flatMap(r=>r.toks.filter(t=>/^\d+$/.test(t.t)).map(t=>t.x));lo=Math.max(lo,Math.min(...rx)-pitch*0.5);hi=Math.min(hi,Math.max(...rx)+pitch*0.5)}/* symcheck: the column ruler marks the cell span, so row numbers on sparse rows stay outside it */if(hasR)hi=Math.min(hi,xr-pitch*0.5);if(hasL)lo=Math.max(lo,x0+pitch*0.5);/* symcheck: nothing past the row numbers is a cell */
 lo-=pitch*0.6;hi+=pitch*0.6;const yTop=Math.max(...ok.map(r=>r.y))+pitch*1.2,yBot=Math.min(...ok.map(r=>r.y))-pitch*1.2;
 const xL=hasL?Math.min(lo,x0-pitch):lo,xR=hasR?Math.max(hi,xr+pitch):hi;
 const inRegion=(r,t)=>r.y<=yTop&&r.y>=yBot&&t.x>=xL&&t.x<=xR;
 const labels=[],cells=[],used=[];let h=0;
 for(const r of rows){if(ruler.includes(r)||r.y>yTop||r.y<yBot)continue;let any=false;for(const t of r.toks){if(!inRegion(r,t))continue;used.push(t);any=true;if(isLabel(t)){if(hasL?near(t,x0):true)labels.push(+t.t);continue}if(t.x>=lo&&t.x<=hi&&t.t.length<=2&&!(INT.test(t.t)&&r.toks.filter(o=>o.t===t.t).length>1&&(t===r.toks[0]||t===r.toks[r.toks.length-1])))cells.push(t.t)}/* symcheck: the same number at both ends of a row is its row label */if(any)h++}
 for(const r of ruler)for(const t of r.toks)used.push(t);
 return{rows:ok,cells,labels,used,isLabel,inRegion,yTop,yBot,height:h,width:Math.round((hi-lo-pitch*1.2)/pitch)+1}}
// Row labels that repeat or skip (49, 49 or 36 then 41). Uses the usual step between labels.
function labelProblems(labels){if(labels.length<5)return{repeat:[],missing:[]};const steps=[];for(let i=1;i<labels.length;i++)steps.push(labels[i]-labels[i-1]);const st=median(steps.filter(s=>s>0))||1,repeat=[],missing=[];
 for(let i=1;i<labels.length;i++){const a=labels[i-1],b=labels[i];if(b===a){if(!repeat.includes(b))repeat.push(b)}else if(b>a+st&&(b-a)%st===0){for(let v=a+st;v<b;v+=st)missing.push(v)}}return{repeat,missing}}
// Key entries: symbol, optional "=", optional "DMC", code, then name words, then (if the page has a Stitches column) a count.
function keyEntries(rows,validCodes){const out=[];const countCol=rows.some(r=>r.toks.some(t=>/^(stitches|count)$/i.test(t.t)));
 for(const r of rows){const T=r.toks;for(let i=0;i<T.length;i++){let j=i;const sym=T[j].t;if(sym.length>2||/^\d+$/.test(sym)||/^dmc$/i.test(sym))continue;if(i>0&&T[i-1].w!=null&&T[i].x-(T[i-1].x+T[i-1].w)<1.5*(T[i-1].w/T[i-1].t.length))continue;/* symcheck: glued to the word before it, so it is prose punctuation, not a key symbol */if(/^[a-z]{2}$/.test(sym))continue;/* symcheck: a lowercase word like 'of' in a stitching note ('of DMC 644 and feed it') */if(/^[x×]$/i.test(sym)&&i>0&&/\d$/.test(T[i-1].t)&&(T[i-1].w==null||T[i].x-(T[i-1].x+T[i-1].w)<3*(T[i-1].w/T[i-1].t.length)))continue;/* "24 x 18" is a size */j++;
  if(T[j]&&T[j].t==='='&&sym!=='=')j++;if(T[j]&&/^dmc$/i.test(T[j].t))j++;if(!T[j]||!CODE.test(T[j].t))continue;let code=T[j].t.toUpperCase();/* '1 White' means DMC 01: single digits are 01-09, same as the paste parser */if(/^\d$/.test(code)&&validCodes&&validCodes['0'+code])code='0'+code;
  const valid=!validCodes||!!validCodes[code];if(!valid&&!/^\d{3,4}$/.test(code))continue;if(T[j+1]&&/^(stitch|stitches|ct)\b/i.test(T[j+1].t))continue;let k=j+1;const name=[];let count=null;
  while(k<T.length){const t=T[k].t;if(t.length<=2&&!/^\d+$/.test(t)&&T[k+1]&&(CODE.test(T[k+1].t)||T[k+1].t==='='||/^dmc$/i.test(T[k+1].t)))break;if(/^\d+$/.test(t)){if(countCol&&count===null)count=+t;k++;break}name.push(t);k++}
  /* Flow pass: a symbol and a bare number with no color name and no DMC or = mark is a chart cell, not a key entry */if(!name.some(w=>/[A-Za-z]{3,}/.test(w))&&!T.slice(i,j).some(t=>t.t==='='||/^dmc$/i.test(t.t)))continue;for(let q=i;q<k;q++)T[q].used=true;out.push({sym,code,valid,name:name.join(' '),count,toks:T.slice(i,k)});i=k-1}}
 return out}
function statedSize(pages){for(const p of pages||[]){const m=/\b(\d{2,4})\s*[x×]\s*(\d{2,4})\s*stitch/i.exec(p.text||'');if(m)return{w:+m[1],h:+m[2]}}return null}
// symcheck: codes are normalized the same way for the key and the imported list (1 is 01; BLANC stays BLANC, never WHITE).
function normCode(c,validCodes){c=String(c).toUpperCase().replace(/^DMC\s*/,'');if(/^\d$/.test(c)&&validCodes&&validCodes['0'+c])c='0'+c;return c}
// Key regrouping: the key's symbol can sit on a slightly different baseline from its code (symbol fonts), so key rows use a looser line match.
function keyRows(rows,tol){const out=rows.map(r=>({y:r.y,toks:r.toks.filter(t=>!t.used).map(t=>({...t,src:t}))})).filter(r=>r.toks.length);
 for(const r of out)for(const t of [...r.toks]){if(!CODE.test(t.t)||/^\d{1,2}$/.test(t.t))continue;const k=r.toks.indexOf(t),prev=r.toks[k-1];if(prev&&t.x-prev.x<25)continue;
  let best=null;for(const q of out){if(q===r||Math.abs(q.y-(t.y0!=null?t.y0:r.y))>=tol)continue;for(const s of q.toks){const d=t.x-s.x;if(d>0&&d<25&&s.t.length<=2&&!/^\d+$/.test(s.t)&&!q.toks.some(o=>o.x>s.x&&o.x<t.x)&&(!best||d<best.d))best={q,s,d}}}
  if(best){best.q.toks.splice(best.q.toks.indexOf(best.s),1);r.toks.splice(k,0,best.s)}}
 return out.filter(r=>r.toks.length)}
// symcheck: symbols from a custom chart font often copy out as one stand-in character (a dash, a box, a question mark or a private-use glyph).
const UNSURE=/^[-\u2010-\u2015\u2212?\u25A1\u25A0\uFFFD\uE000-\uF8FF]$/u;
function check(pages,validCodes,opts){const res={status:'none',extra:[],unused:[],counts:[],symMulti:[],symUnsure:[],codeMulti:[],labels:{repeat:[],missing:[]},size:null,sum:null};
 if(!Array.isArray(pages)||!pages.length)return res;let key=[],cells=[],labels=[],grid=null,dims=null;const loose=new Set();
 const imp=opts&&Array.isArray(opts.imported)&&opts.imported.length?new Set(opts.imported.map(c=>normCode(c,validCodes))):null;
 for(const p of pages){const rows=tokenRows(p.items);const kr=keyRows(rows,6);let ke=keyEntries(kr,validCodes);for(const r of kr)for(const t of r.toks)if(t.used)t.src.used=true;let g=findGrid(rows);
  /* symcheck: an "entry" whose code is really a chart row number (a cell, then the right-hand row label, then a note) is chart, not key */
  if(g){const bad=ke.filter(e=>e.toks.some(t=>g.isLabel(t)&&t.y<=g.yTop&&t.y>=g.yBot));if(bad.length){for(const e of bad)for(const t of e.toks)t.src.used=false;ke=ke.filter(e=>!bad.includes(e));g=findGrid(rows)}}
  if(g){for(const t of g.used)t.used=true}for(const e of ke)delete e.toks;key.push(...ke);if(g){grid=true;for(const r of rows)for(const t of r.toks)if(!t.used)loose.add(t.t);cells.push(...g.cells);labels.push(...g.labels);dims=dims||{w:g.width,h:0};dims.h+=g.height}}
 // symcheck: only colors that were actually imported can be in these warnings (no row numbers or page numbers read as DMC codes).
 if(imp)key=key.filter(e=>imp.has(normCode(e.code,validCodes)));
 res.key=key.map(e=>({sym:e.sym,code:e.code}));if(!key.length)return res;
 // One symbol, one code (and the reverse). Exact repeats of the same pair are left to the duplicate check.
 const bySym=new Map(),byCode=new Map();for(const e of key){(bySym.get(e.sym)||bySym.set(e.sym,new Set()).get(e.sym)).add(e.code);(byCode.get(e.code)||byCode.set(e.code,new Set()).get(e.code)).add(e.sym)}
 for(const [s,c] of bySym)if(c.size>1)(UNSURE.test(s)?res.symUnsure:res.symMulti).push({sym:s,codes:[...c]});for(const [c,s] of byCode)if(s.size>1)res.codeMulti.push({code:c,syms:[...s]});
 const size=statedSize(pages),counted=key.filter(e=>e.count!=null);
 // Listed counts that cannot fit in the stated design size (each code counted once).
 if(size&&counted.length){const once=new Map();for(const e of counted)if(!once.has(e.code))once.set(e.code,e.count);const sum=[...once.values()].reduce((a,b)=>a+b,0);if(sum>size.w*size.h)res.sum={sum,room:size.w*size.h,...size}}
 if(!grid){res.status='no-chart';return res}
 res.status='checked';const tally=new Map();for(const s of cells)tally.set(s,(tally.get(s)||0)+1);
 for(const [s,n] of tally)if(!bySym.has(s))res.extra.push({sym:s,n});
 /* Flow pass: sparse chart rows can fall outside the grid; a symbol still printed on a chart page is in use */const allText=pages.map(p=>p.text||'').join('\n'),mentions=c=>(allText.match(new RegExp('(^|[^\\w.])'+String(c).replace(/[^\w]/g,'')+'(?![\\w])','g'))||[]).length;for(const [s,codes] of bySym)if(!tally.has(s)&&!loose.has(s))for(const c of codes)if(!res.unused.some(u=>u.code===c)&&mentions(c)<2/* symcheck: named again in a backstitch or stitch guide, so it is used */)res.unused.push({code:c,sym:s});
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
 symUnsure:x=>`DMC ${list(x.codes)} look like they share the symbol ${x.sym}, but this PDF's chart symbols may not copy out cleanly. Check the printed key to be sure.`,
 symMulti:x=>`The symbol ${x.sym} is used for more than one color (DMC ${list(x.codes)}). On the chart you can't tell them apart.`,
 codeMulti:x=>`DMC ${x.code} has more than one symbol in the key (${list(x.syms)}). Check if they're really the same color.`,
 sum:x=>`The key's stitch counts add up to ${x.sum}, but a ${x.w} x ${x.h} design only has room for ${x.room}. Some counts are probably wrong.`,
 unusedMany:l=>`${l.length} colors in the key never show up in the chart: DMC ${list(l.map(x=>x.code))}. You might not need them.`,
 repeat:l=>`Chart row number${l.length===1?'':'s'} ${list(l.map(String))} ${l.length===1?'shows':'show'} up twice. Rows may be doubled.`,
 missing:l=>`Chart row number${l.length===1?'':'s'} ${l.length>3?l[0]+' to '+l[l.length-1]:list(l.map(String))} ${l.length===1?'is':'are'} missing. Rows may have been left out.`,
 noChart:"We couldn't read the chart's symbols (it might be a picture), so we only checked the color key.",
 matched:'We also compared the chart with the color key.'};
function lines(r){const o=[];r.symMulti.forEach(x=>o.push(STR.symMulti(x)));(r.symUnsure||[]).forEach(x=>o.push(STR.symUnsure(x)));r.codeMulti.forEach(x=>o.push(STR.codeMulti(x)));r.extra.forEach(x=>o.push(STR.extra(x)));if(r.unused.length>3)o.push(STR.unusedMany(r.unused));else r.unused.forEach(x=>o.push(STR.unused(x)));r.counts.forEach(x=>o.push(STR.count(x)));
 if(r.sum)o.push(STR.sum(r.sum));if(r.labels.repeat.length)o.push(STR.repeat(r.labels.repeat));if(r.labels.missing.length)o.push(STR.missing(r.labels.missing));return o}
function note(r){return r.status==='no-chart'?STR.noChart:r.status==='checked'?STR.matched:''}
return{check,normCode,UNSURE,lines,note,tokenRows,findGrid,keyEntries,labelProblems,differs,STR,TOL_PCT,TOL_ABS};
});
