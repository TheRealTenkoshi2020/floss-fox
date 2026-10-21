/* Floss Fox Pattern Import: deterministic, review-first legend/text parser.
   Source text and files stay in the browser. No chart-grid stitch inference.
   Node/commonJS and browser UMD. No project writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxPatternCore=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MAX_TEXT=240000, MAX_LINES=12000, MAX_COLORS=600;
function normalCode(v){let c=String(v||'').trim().toUpperCase().replace(/^DMC\s*[:#-]?\s*/,'').replace(/\s+/g,'');/* same aliases as the paste parser: Blanc is DMC White, single digits are 01-09 */if(c==='BLANC')c='WHITE';if(/^\d$/.test(c))c='0'+c;return c;}
function validCode(raw,validCodes){const code=normalCode(raw);return Object.prototype.hasOwnProperty.call(validCodes||{},code)?code:null;}
const isSku=v=>/^(?:\d{1,4}|BLANC|WHITE|ECRU|B5200)$/i.test(v);
function parseRow(line,validCodes,page){
 const clean=String(line||'').trim().replace(/[\u00a0\t]+/g,' ');
 if(clean.length<3||clean.length>300)return null;
 // Prevent false-positive DMC colors from chart dimensions (e.g. 180 x 240 stitches).
 if(/^\d{1,4}\s*(?:x|×|by)\s*\d{1,4}\s*(?:stitches?|crosses?)/i.test(clean))return null;
 // Strong preference: explicit DMC; standalone number only at start of a legend row.
 let match=/\bDMC\s*[:#-]?\s*(BLANC|WHITE|ECRU|B5200|\d{1,4})\b/i.exec(clean)||/^(?:\s*\|\s*)?(BLANC|WHITE|ECRU|B5200|\d{1,4})\b(?=\s|\||:|;|-)/i.exec(clean);
 let column=false,leading=false;
 const UNIT=/^\s*(?:ct|count|strands?|x|×|by|stitch(?:es)?|cm|mm|in|inch(?:es)?|pages?|rows?|%|aida|linen|evenweave)\b/i;
 // A bare number at the start of a row is only a color code if it is not a measurement ("14 ct", "2 strands") and
 // not a row number/symbol in front of the real code ("1 310 Black", "3 321 Red 2"): then the second number is the code.
 if(match&&!/dmc/i.test(match[0])){const end=match.index+match[0].length,rest=clean.slice(end);
  if(UNIT.test(rest))match=null;
  else{const m2=/^\s+(BLANC|WHITE|ECRU|B5200|\d{1,4})\s+(?=[A-Za-z])/i.exec(rest);if(m2&&!UNIT.test(rest.slice(m2[0].length-1))&&validCode(m2[1],validCodes)){match={0:clean.slice(0,end+m2[0].length).trimEnd(),1:m2[1],index:0};leading=true}}}
 // 2.0A: plain column legends ("X 310 Black 2400 2"): symbol, code, then a color name. The code is taken;
 // unlabeled numbers are NOT imported because their meaning (stitches? skeins? strands?) is not stated.
 if(!match){const m=/^(?:[^\w\s]{1,2}|[A-Za-z]{1,2}|\d{1,2}[.)])\s+(BLANC|WHITE|ECRU|B5200|\d{1,4})\s+(?!(?:count|ct|aida|linen|evenweave|cm|mm|in|inch|inches|x|by|stitch|stitches|strands?|skeins?|pages?)\b)[A-Za-z]/i.exec(clean);if(m){match=m;column=true}}
 // Small-legend fix: bare "symbol code count" rows ("X 310 1446 1"). Code taken; the unlabeled numbers are NOT amounts.
 if(!match){const m=new RegExp('^'+SYM_SRC+'\\s+(BLANC|WHITE|ECRU|B5200|\\d{1,4})(?=(?:\\s+(?:\\d{1,8}|stitches|skeins?|strands?))+\\s*$)','i').exec(clean);if(m){match=m;column=true}}
 if(!match||!isSku(match[1]))return null;
 const code=validCode(match[1],validCodes);if(!code)return null;
 // Only explicitly named units are imported. In particular 1200 stitches != 1200 skeins.
 const sk=/\b(\d{1,3})\s*(?:full\s+)?skeins?\b/i.exec(clean)||/\b(?:skeins?\s*[:=]\s*)(\d{1,3})\b/i.exec(clean);
 const st=/\b(\d{1,8})\s*(?:full\s+)?(?:cross\s*)?stitches\b/i.exec(clean)||/\b(?:stitches\s*[:=]\s*)(\d{1,8})\b/i.exec(clean);
 const strands=/\b([1-6])\s*strands?\b/i.exec(clean);
 const warnings=[];const range=/\b\d{1,3}\s*(?:-|–|to|or)\s*\d{1,3}\s*(?:full\s+)?skeins?\b/i.test(clean);if(range)warnings.push('range-amount');if(sk&&/\b(?:about|approx\.?|approximately|around|~)\s*\d/i.test(clean))warnings.push('approximate-amount');
 const qty=sk&&!range?+sk[1]:null, stitchCount=st?+st[1]:null;
 if(qty!==null&&(qty<1||qty>9999))warnings.push('invalid-skein-amount');
 if(stitchCount!==null&&(stitchCount<1||stitchCount>10000000))warnings.push('invalid-stitch-count');
 if(!sk&&!st)warnings.push('no-quantity-evidence');
 if(leading)warnings.push('leading-number-not-a-color');
 if((column||leading)&&!sk&&!st&&/\d/.test(clean.slice(match.index+match[0].length)))warnings.push('unlabeled-numbers-not-imported');
 if(/variegat/i.test(clean))warnings.push('variegated-check-color');
 if(/\banchor\b/i.test(clean))warnings.push('check-thread-brand');
 if(/\b(?:backstitch|half\s*cross|blend|fractional)\b/i.test(clean))warnings.push('specialty-stitch-review');
 const after=clean.slice(match.index+match[0].length);
 const structured=!!(column||leading||sk||st||/(?:^|\s)\d{1,8}(?=\s*$|\s+(?:\d|stitch|skein|strand))/i.test(after)||new RegExp('^'+SYM_SRC+'\\s+DMC\\b','i').test(clean));
 return {code,structured,qty:warnings.includes('invalid-skein-amount')?null:qty,stitchCount:warnings.includes('invalid-stitch-count')?null:stitchCount,strandCount:strands?+strands[1]:null,sourcePage:page||1,sourceLine:clean.slice(0,300),warnings,needsReview:true};
}
// Lines that look like thread legend rows for products this importer does not take (Light Effects, Satin, Etoile, Coloris, metallics, beads).
const SYM_SRC='(?:[^\\w\\s]{1,2}|[A-Za-z]{1,2}|\\d{1,2}[.)])';
const SYM_RE=new RegExp('^'+SYM_SRC+'$');
// Two-column legends put two rows on one text line ("X 150 Rose 437 * 154 Grape 1513"). Split before each later
// "symbol code" pair that follows a number or an amount word. Lines without a leading symbol (color charts) are never split.
function splitSegments(line,validCodes){const t=String(line||'').trim().replace(/[\u00a0\t]+/g,' ').split(' ');
 const starts=i=>SYM_RE.test(t[i]||'')&&(validCode(t[i+1],validCodes)||(/^DMC$/i.test(t[i+1]||'')&&validCode(t[i+2],validCodes)));
 if(t.length<5||!starts(0))return [t.join(' ')];const cut=[0];
 for(let i=2;i<t.length-1;i++)if(starts(i)&&/^(?:\d{1,8}|skeins?|stitches)$/i.test(t[i-1]))cut.push(i);
 if(cut.length<2)return [t.join(' ')];return cut.map((c,k)=>t.slice(c,cut[k+1]).join(' '))}
// A legend-shaped row whose number isn't a DMC code ("# 9999 Bogus 10 1"): list it so it is never silently dropped.
const UNKNOWN_ROW=new RegExp('^'+SYM_SRC+'\\s+\\d{1,4}\\b(?!\\s*(?:x|×|by|ct|count|strands?|stitch(?:es)?|cm|mm|in|inch(?:es)?|aida|linen|evenweave)\\b)');
const SPECIAL=/\b(?:light\s*effects?|satin|etoile|[ÉE]toile|coloris|metallic|kreinik|mill\s*hill|beads?|DMC\s*[ESC]\s?\d{2,4}|[ESC]\d{3,4})\b/i;
const CATALOG_MIN=150,CATALOG_RUN=12;
const ordCache=new WeakMap();
function catalogOrder(validCodes){if(!validCodes||typeof validCodes!=='object')return new Map();if(ordCache.has(validCodes))return ordCache.get(validCodes);
 const n=c=>/^\d+$/.test(c)?+c:-1;const keys=Object.keys(validCodes).sort((a,b)=>(n(a)<0)-(n(b)<0)||n(a)-n(b)||(a<b?-1:a>b?1:0));const m=new Map(keys.map((k,i)=>[k,i]));ordCache.set(validCodes,m);return m}
// Longest streak of codes (in reading order) that are immediate neighbours in the DMC catalog: 150,151,152... A real pattern key almost never has 12.
// Share of codes that directly follow the previous code in catalog order (a chart page's tail, e.g. 5283 5284 5287 ... B5200 ECRU WHITE).
function catalogAdjacent(codes,order){let adj=0,prev=null;for(const c of codes){const i=order.get(c);if(i!==undefined&&prev!==null&&i===prev+1)adj++;if(i!==undefined)prev=i}return codes.length>1?adj/(codes.length-1):0}
function catalogRun(codes,order){let best=0,cur=0,prev=null;for(const c of codes){const i=order.get(c);if(i!==undefined&&prev!==null&&i===prev+1)cur++;else cur=1;if(i!==undefined)prev=i;best=Math.max(best,cur)}return best}
function parsePages(pages,validCodes){
 if(!Array.isArray(pages)||pages.length>100)throw new Error('That page list isn\'t valid.');
 let checked=0;const raw=[];const warnings=[];const skipped=[];
 for(const p of pages){let text=String(p.text||'');if(text.length>MAX_TEXT)text=text.slice(0,MAX_TEXT);
  const lines=text.split(/\r?\n/);for(const line of lines){if(++checked>MAX_LINES){warnings.push('text-limit-reached');break}const segs=splitSegments(line,validCodes);for(const seg of segs){const row=parseRow(seg,validCodes,p.page);if(!row&&skipped.length<50&&(SPECIAL.test(seg)||/\bDMC\s*[:#-]?\s*[A-Za-z]?\d/i.test(seg)||UNKNOWN_ROW.test(String(seg).trim())))skipped.push({page:p.page||1,line:String(seg).trim().slice(0,160),reason:SPECIAL.test(seg)?'specialty':'unrecognized'});if(row){if(segs.length>1)row.warnings.push('two-column-row');if(!row.structured){row.lineCodes=[];for(const m of String(seg).matchAll(/(?:^|\s)(BLANC|WHITE|ECRU|B5200|\d{1,4})\s+(?=[A-Za-z])/gi)){const c=validCode(m[1],validCodes);if(c)row.lineCodes.push(c)}}raw.push(row);if(raw.length>=MAX_COLORS){warnings.push('color-limit-reached');break}}}if(raw.length>=MAX_COLORS)break}
  if(checked>MAX_LINES||raw.length>=MAX_COLORS)break;
 }
 // Barbara (3.0 feedback): a full DMC color chart/catalog page ("310 Black" on every line) is NOT the pattern's color key.
 // Flag pages with more than CATALOG_MIN distinct codes, or a long run of codes that are neighbours in the DMC catalog order,
 // and import nothing from them. If the whole document still has more than CATALOG_MIN distinct codes, import nothing at all.
 // Small-legend fix: a page where (nearly) every code sits on its own legend row (a symbol before it, or a count after it)
 // is a pattern key, so the 60% catalog-order rule doesn't apply to it. A sorted shade family (150 151 152 153 ...) is normal.
 // The >150 codes rule and the 12-in-a-row rule still apply to every page. Codes later on an unstructured chart line count too.
 const order=catalogOrder(validCodes),perPage=new Map();for(const x of raw){if(!perPage.has(x.sourcePage))perPage.set(x.sourcePage,{codes:[],rows:0,structured:0});const pp=perPage.get(x.sourcePage);pp.rows++;if(x.structured)pp.structured++;pp.codes.push(...(x.lineCodes&&x.lineCodes.length?x.lineCodes:[x.code]))}
 const catalogPages=[];for(const [pg,pp] of perPage){const d=[...new Set(pp.codes)],legend=pp.rows>0&&pp.structured/pp.rows>=0.8;if(d.length>CATALOG_MIN||catalogRun(d,order)>=CATALOG_RUN||(!legend&&d.length>=8&&catalogAdjacent(d,order)>=0.6))catalogPages.push(pg)}
 let kept=raw.filter(x=>!catalogPages.includes(x.sourcePage));
 if(catalogPages.length)warnings.push('catalog-page-skipped');
 if(new Set(kept.map(x=>x.code)).size>CATALOG_MIN){kept=[];warnings.push('catalog-document')}
 raw.length=0;raw.push(...kept);
 for(const x of raw){delete x.lineCodes}
 const byCode=new Map();for(const x of raw){const r=byCode.get(x.code);if(r){r.duplicates.push({page:x.sourcePage,line:x.sourceLine});r.warnings.push('duplicate-color-rows');r.needsReview=true; // Do not sum duplicate stitch counts across page legends
  r.qty=null;r.stitchCount=null;
 }else byCode.set(x.code,{...x,duplicates:[]})}
 return {version:1,rows:[...byCode.values()],skipped,warnings:[...new Set(warnings)],metadata:{sourcePages:pages.length,matchedLines:raw.length,catalogPages},trustedForAutomaticImport:false};
}
function validateModelRows(model,validCodes){
 if(!model||typeof model!=='object'||!Array.isArray(model.rows)||model.rows.length>MAX_COLORS)return {rows:[],warnings:['invalid-model-output']};
 const rows=[],seen=new Set(),warnings=[];
 for(const x of model.rows){if(!x||typeof x!=='object'){warnings.push('invalid-entry');continue}
  const code=validCode(x.code,validCodes);if(!code){warnings.push('unknown-color');continue}
  if(seen.has(code)){warnings.push('duplicate-color');continue}seen.add(code);
  const qty=Number.isInteger(x.skeins)&&x.skeins>=1&&x.skeins<=999?x.skeins:null;
  const stitchCount=Number.isInteger(x.stitches)&&x.stitches>0&&x.stitches<=1e7?x.stitches:null;
  // Never accept provider confidence scores as verified evidence.
  rows.push({code,qty,stitchCount,strandCount:Number.isInteger(x.strands)&&x.strands>=1&&x.strands<=6?x.strands:null,sourcePage:1,sourceLine:String(x.evidence||'').slice(0,220),warnings:['ai-proposed-not-verified'],needsReview:true,duplicates:[]});
 }
 return {rows,warnings};
}
function projectDraft(rows,name){
 if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_COLORS)throw new Error('No colors to import');
 const items=[],seen=new Set();
 for(const row of rows){if(!row||!row.confirmed||!isSku(row.code)||seen.has(row.code))throw new Error('Review each color before importing');seen.add(row.code);
  const qty=row.qty==null?null:Number(row.qty),stitchCount=row.stitchCount==null?null:Number(row.stitchCount);
  if(qty!==null&&(!Number.isInteger(qty)||qty<1||qty>9999))throw new Error('A skein amount isn\'t valid.');
  if(stitchCount!==null&&(!Number.isInteger(stitchCount)||stitchCount<0||stitchCount>1e7))throw new Error('A stitch count isn\'t valid.');
  items.push({code:row.code,qty,stated:qty!==null,assumed:0,src:[`Reviewed pattern legend: ${String(row.sourceLine||row.code).slice(0,140)}`],stitchCount,stitchCountReviewed:stitchCount!==null,...(Number.isInteger(row.strandCount)?{strandCount:row.strandCount}:{})});
 }
 const now=new Date().toISOString();return{id:(globalThis.crypto?.randomUUID?.()||'pattern-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)),name:String(name||'Imported pattern').trim().slice(0,100)||'Imported pattern',notes:'Imported from a pattern legend you reviewed. Chart symbols and the stitch grid have not been checked.',buyBrand:'dmc',status:'planning',items,decisions:{},purchased:{},created:now,updated:now};
}
return {normalCode,validCode,parseRow,parsePages,validateModelRows,projectDraft,catalogRun,CATALOG_MIN,CATALOG_RUN};
});
