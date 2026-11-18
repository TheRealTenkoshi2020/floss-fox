/* FlossFox Smart Stash: local-only, deterministic inventory import parsing.
 * No external network, AI, guessed brands, guessed quantities or storage writes.
 * Supported input: CSV, TSV, delimited TXT, pasted lists, and JSON exports.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxSmartStashCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_CHARS=2_000_000,MAX_RECORDS=5000,MAX_FIELDS=32;
const alias={code:['code','colornumber','colournumber','threadnumber','flossnumber','dmccode','dmcnumber','number','colorcode','colourcode','threadcode','flosscode','color','colour','thread','floss','sku'],qty:['qty','quantity','skeins','skein','owned','count','amount','quantityowned','skeinsowned','fullskeins','stock','instock','total','numberowned'],brand:['brand','manufacturer','make','threadbrand','flossbrand']};
const clean=s=>String(s==null?'':s).trim();
function normalizeCode(s){let v=clean(s).toUpperCase().replace(/^['"]|['"]$/g,'').trim();v=v.replace(/^DMC\s*[-#:]*\s*/,'');return v;}
function key(s){return clean(s).toLowerCase().replace(/[^a-z0-9]/g,'');}
function detectDelimiter(line){const candidates=[',','\t',';','|'];let best=',',count=0;for(const d of candidates){const n=(line.match(new RegExp(d==='|'?'\\|':d,'g'))||[]).length;if(n>count){count=n;best=d}}return best;}
function parseDelimited(text,delimiter){const rows=[];let row=[],field='',quoted=false,line=1,rowLine=1;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else{if(c==='\n')line++;field+=c}}
  else if(c==='"'){if(field.trim())throw Error('Quote inside an unquoted cell, near line '+line+'.');quoted=true}
  else if(c===delimiter){row.push(field.trim());field='';if(row.length>MAX_FIELDS)throw Error('Too many columns.');}
  else if(c==='\n'){row.push(field.trim());if(row.some(Boolean))rows.push({cells:row,line:rowLine});if(rows.length>MAX_RECORDS+1)throw Error('Too many inventory rows.');row=[];field='';line++;rowLine=line;}
  else if(c==='\r'){if(text[i+1]!=='\n'){row.push(field.trim());if(row.some(Boolean))rows.push({cells:row,line:rowLine});row=[];field='';line++;rowLine=line;}}
  else field+=c;
 }
 if(quoted)throw Error('Unclosed quoted cell.');row.push(field.trim());if(row.some(Boolean))rows.push({cells:row,line:rowLine});return rows;
}
function asInput(text){if(typeof text!=='string'||text.length>MAX_CHARS)throw Error('File is too large (2 million characters maximum).');return text.replace(/^\uFEFF/,'');}
function sniff(text,filename=''){text=asInput(text);const ext=clean(filename).toLowerCase().split('.').pop();const first=text.split(/\r?\n/).find(s=>s.trim()&&!s.trim().startsWith('#'))||''; // Mouse fix: a '#' comment line (e.g. with ';') no longer turns a plain list into a table
 if(ext==='json'||/^[\s\r\n]*[\[{]/.test(text))return {format:'json'};
 if(ext==='csv'||ext==='tsv'||first.includes('\t')||first.includes(';')||first.includes('|')||/^\s*(?:brand|code|color|colour|thread|dmc|sku|floss|quantity|qty|skeins)\s*[,\t;]/i.test(first))return {format:'table',delimiter:ext==='tsv'?'\t':detectDelimiter(first)};
 return {format:'list'};
}
function inspect(text,filename=''){
 const type=sniff(text,filename);if(type.format!=='table')return {...type,headers:[],suggested:{}};
 const cells=parseDelimited(asInput(text),type.delimiter);const first=cells[0]?.cells||[];const suggested={};
 for(const col of Object.keys(alias)){const i=first.findIndex(x=>alias[col].includes(key(x)));if(i>=0)suggested[col]=i;}
 const hasHeaders=Object.prototype.hasOwnProperty.call(suggested,'code')||Object.prototype.hasOwnProperty.call(suggested,'qty')||Object.prototype.hasOwnProperty.call(suggested,'brand');
 return {...type,hasHeaders,headers:hasHeaders?first.map((x,i)=>x||`Column ${i+1}`):first.map((x,i)=>`Column ${i+1} (${x.slice(0,20)})`),suggested,columns:first.length,sample:cells.slice(hasHeaders?1:0,(hasHeaders?1:0)+3).map(x=>x.cells)};
}
function parseQuantity(v){if(v===null||v===undefined||clean(v)==='')return null;const s=clean(v);if(!/^\d{1,3}$/.test(s))return undefined;const n=Number(s);return Number.isInteger(n)&&n>=0&&n<=999?n:undefined;}
function candidate(code,qty,brand,line){return {code:normalizeCode(code),qty:parseQuantity(qty),brand:clean(brand||'DMC').toUpperCase(),line};}
function entriesFromJSON(input){let d;try{d=JSON.parse(input)}catch(e){throw Error('This JSON file could not be read.')}const out=[];
 const trustedExport=!!(d&&typeof d==='object'&&!Array.isArray(d)&&d.app==='floss-fox'&&d.kind==='thread-list'&&d.schema===2);
 function exported(code,x,line){const r=candidate(x.code??code,x.n??x.qty??x.quantity??x.skeins??x.owned,x.brand,line);
  if(trustedExport){r.verified=x.confirmed===true;r.extras={partial:x.partial===true,restock:x.restock===true,storage:x.storage&&typeof x.storage==='object'?x.storage:null}}
  return r}
 if(Array.isArray(d)){for(const x of d){if(Array.isArray(x))out.push(candidate(x[0],x[1],x[2],'JSON row'));else if(x&&typeof x==='object')out.push(candidate(x.code??x.colorCode??x.color??x.thread??x.number??x.floss,x.qty??x.quantity??x.n??x.skeins??x.owned,x.brand??x.manufacturer,'JSON row'));else out.push(candidate(x,null,'DMC','JSON row'));}}
 else if(d&&typeof d==='object'){
  const m=d.threads??d.inventory??d.stash??d.collection;
  if(Array.isArray(m))return entriesFromJSON(JSON.stringify(m));
  if(m&&typeof m==='object'&&!Array.isArray(m)){for(const [code,x] of Object.entries(m)){if(x&&typeof x==='object'&&!Array.isArray(x))out.push(exported(code,x,'JSON map'));else out.push(candidate(code,x,'DMC','JSON map'));}}
  else if(Array.isArray(d.items))return entriesFromJSON(JSON.stringify(d.items));
  else throw Error('JSON must contain an array or a threads/inventory/stash/collection map.');
 }else throw Error('JSON inventory must be an array or object.');
 if(out.length>MAX_RECORDS)throw Error('Too many inventory rows.');return out;
}
function parseList(text){const out=[];const lines=asInput(text).split(/\r?\n/);if(lines.length>MAX_RECORDS)throw Error('Too many inventory lines.');
 for(let i=0;i<lines.length;i++){const s=lines[i].trim();if(!s||s.startsWith('#'))continue;
  // Accept separated codes only for unambiguous comma lists. Space-separated digit pairs are ambiguous.
  const parts=/^\s*(?:(?:DMC\s*)?[A-Z]?\d{1,4}|(?:DMC\s*)?(?:WHITE|BLANC|ECRU))\s*(?:,\s*(?:(?:DMC\s*)?[A-Z]?\d{1,4}|(?:DMC\s*)?(?:WHITE|BLANC|ECRU)))+\s*$/i.test(s)?s.split(','):[s];
  for(const p of parts){const m=/^(?:DMC\s*[-#:]*\s*)?([A-Z]?\d{1,4}|WHITE|BLANC|ECRU)\s*(?:[xX×:]\s*(\d{1,3})|,\s*(\d{1,3}))?$/i.exec(p.trim());if(m)out.push(candidate(m[1],m[2]??m[3]??null,'DMC',i+1));else out.push({code:'',qty:undefined,brand:'DMC',line:i+1,invalid:s});}
 }return out;
}
function parseTable(text,info,mapping){const rows=parseDelimited(asInput(text),info.delimiter);const first=info.hasHeaders?1:0,mapping2={code:!info.hasHeaders?0:info.suggested.code,qty:!info.hasHeaders?1:info.suggested.qty,brand:info.suggested.brand,...mapping};
 if(!Number.isInteger(mapping2.code)||mapping2.code<0||mapping2.code>=info.columns)throw Error('Choose the column containing thread numbers.');
 const out=[];for(let i=first;i<rows.length;i++){const r=rows[i],v=r.cells;out.push(candidate(v[mapping2.code],mapping2.qty>=0?v[mapping2.qty]:null,mapping2.brand>=0?v[mapping2.brand]:null,r.line));}
 return out;
}
function parse(text,filename,chart,mapping){if(!chart||typeof chart!=='object')throw Error('The DMC color chart is unavailable.');const info=inspect(text,filename);let raw=info.format==='json'?entriesFromJSON(asInput(text)):info.format==='list'?parseList(text):parseTable(text,info,mapping);
 const records=[],issues=[],seen=new Set();for(const r of raw){const code=r.code;
  if(r.invalid||!code){issues.push({line:r.line,reason:'Unrecognized thread entry',raw:r.invalid||''});continue;}
  if(r.brand!=='DMC'){issues.push({line:r.line,reason:`Unsupported brand ${r.brand}: not imported`});continue;}
  if(!Object.prototype.hasOwnProperty.call(chart,code)){issues.push({line:r.line,reason:`Unknown DMC code ${code}: not imported`});continue;}
  if(r.qty===undefined){issues.push({line:r.line,reason:`Invalid amount for DMC ${code}: not imported`});continue;}
  if(seen.has(code)){issues.push({line:r.line,reason:`Repeated DMC ${code}: only the first one was kept; verify before saving`});continue;}
  seen.add(code);records.push({code,qty:r.qty,line:r.line,verified:r.verified===false?false:r.qty!==null,...(r.extras?{extras:r.extras}:{})});
 }
 return {records,issues,format:info.format,rowsRead:raw.length,skipped:raw.length-records.length};
}
function plan(current,records,mode='keep',assumeOne=false,importDetails=false){const next=[],errors=[],now=current||{};const validModes=['keep','set','add'];if(!validModes.includes(mode))throw Error('Unknown merge mode.');const seen=new Set();
 for(const r of records){if(seen.has(r.code)){errors.push('Duplicate '+r.code);continue}seen.add(r.code);const was=Object.prototype.hasOwnProperty.call(now,r.code)?now[r.code]:null;let qty=r.qty,confirmed=r.verified!==false&&qty!==null;
  if(was&&mode==='keep'){next.push({code:r.code,was:was.n,after:was.n,confirmed:was.confirmed===true,action:'unchanged',qty});continue}
  if(qty===null&&assumeOne){qty=1;confirmed=false}
  if(qty===null){errors.push('Quantity missing for '+r.code);continue}
  if(!Number.isInteger(qty)||qty<0||qty>999){errors.push('Invalid quantity for '+r.code);continue}
  const newQty=mode==='add'?(was?.n||0)+qty:qty;
  if(newQty>999){errors.push('Over 999 skeins for '+r.code);continue}
  next.push({code:r.code,was:was?.n??null,after:newQty,confirmed:confirmed||(!!was&&mode==='add'&&was.confirmed===true&&qty===0),action:was?'update':'new',qty,...(importDetails&&r.extras&&mode!=='add'?{extrasToApply:r.extras}:{})});
 }
 return {rows:next,errors,changeCount:next.filter(r=>r.action!=='unchanged').length,large:next.filter(r=>r.action!=='unchanged'&&r.after>20&&(r.was===null||r.after>r.was)).map(r=>r.code)};
}
return {parse,inspect,plan,parseDelimited,normalizeCode,parseQuantity,MAX_CHARS,MAX_RECORDS};
});
