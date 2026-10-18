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
 return {code,qty:warnings.includes('invalid-skein-amount')?null:qty,stitchCount:warnings.includes('invalid-stitch-count')?null:stitchCount,strandCount:strands?+strands[1]:null,sourcePage:page||1,sourceLine:clean.slice(0,300),warnings,needsReview:true};
}
// Lines that look like thread legend rows for products this importer does not take (Light Effects, Satin, Etoile, Coloris, metallics, beads).
const SPECIAL=/\b(?:light\s*effects?|satin|etoile|[ÉE]toile|coloris|metallic|kreinik|mill\s*hill|beads?|DMC\s*[ESC]\s?\d{2,4}|[ESC]\d{3,4})\b/i;
function parsePages(pages,validCodes){
 if(!Array.isArray(pages)||pages.length>100)throw new Error('That page list isn\'t valid.');
 let checked=0;const raw=[];const warnings=[];const skipped=[];
 for(const p of pages){let text=String(p.text||'');if(text.length>MAX_TEXT)text=text.slice(0,MAX_TEXT);
  const lines=text.split(/\r?\n/);for(const line of lines){if(++checked>MAX_LINES){warnings.push('text-limit-reached');break}const row=parseRow(line,validCodes,p.page);if(!row&&skipped.length<50&&(SPECIAL.test(line)||/\bDMC\s*[:#-]?\s*[A-Za-z]?\d/i.test(line)))skipped.push({page:p.page||1,line:String(line).trim().slice(0,160),reason:SPECIAL.test(line)?'specialty':'unrecognized'});if(row){raw.push(row);if(raw.length>=MAX_COLORS){warnings.push('color-limit-reached');break}}}
  if(checked>MAX_LINES||raw.length>=MAX_COLORS)break;
 }
 const byCode=new Map();for(const x of raw){const r=byCode.get(x.code);if(r){r.duplicates.push({page:x.sourcePage,line:x.sourceLine});r.warnings.push('duplicate-color-rows');r.needsReview=true; // Do not sum duplicate stitch counts across page legends
  r.qty=null;r.stitchCount=null;
 }else byCode.set(x.code,{...x,duplicates:[]})}
 return {version:1,rows:[...byCode.values()],skipped,warnings:[...new Set(warnings)],metadata:{sourcePages:pages.length,matchedLines:raw.length},trustedForAutomaticImport:false};
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
return {normalCode,validCode,parseRow,parsePages,validateModelRows,projectDraft};
});
