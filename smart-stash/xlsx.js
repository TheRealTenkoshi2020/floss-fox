/* FlossFox Smart Stash offline XLSX reader, with vendored MIT JSZip 3.10.1.
 * Reads workbook/sharedStrings/worksheets only. No macros, formulas, external refs or network.
 * No OCR/AI. It is intentionally read-only, and refuses suspicious/huge workbooks.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxSmartStashXLSX=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_FILE=8*1024*1024,MAX_XML=8*1024*1024,MAX_ROWS=5001,MAX_COLUMNS=32;
const decodeXml=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Spreadsheet XML is damaged.');return d};
const nodes=(parent,local)=>Array.from(parent.getElementsByTagNameNS('*',local));
const attr=(node,local)=>{for(const a of Array.from(node.attributes||[]))if(a.localName===local)return a.value;return''};
async function getXML(zip,path,required=true){path=path.replace(/^\//,'');const file=zip.file(path);if(!file){if(required)throw Error('Missing worksheet component: '+path);return null}
 if(file._data?.uncompressedSize>MAX_XML)throw Error('A worksheet is too large to safely import.');const text=await file.async('string');if(text.length>MAX_XML)throw Error('A worksheet is too large.');return decodeXml(text)}
function resolvePath(from,target){if(target.startsWith('/'))return target.slice(1);
 const a=from.split('/');a.pop();for(const p of target.split('/')){if(!p||p==='.')continue;if(p==='..'){if(!a.length)throw Error('Invalid workbook path.');a.pop()}else a.push(p)}return a.join('/')}
function colIndex(name){let col=0;for(const x of String(name).match(/^[A-Z]+/i)?.[0].toUpperCase()||''){col=col*26+x.charCodeAt(0)-64}return col-1}
function cellText(c,shared){const t=c.getAttribute('t')||'',v=nodes(c,'v')[0]?.textContent;
 if(t==='inlineStr')return nodes(c,'t').map(x=>x.textContent||'').join('');
 if(t==='s'){const n=Number(v);return Number.isInteger(n)&&n>=0&&n<shared.length?shared[n]:''}
 if(t==='e'||t==='b')return '';
 // Formula cells use stored values only, never execute formulas.
 return v??'';}
function sheetRows(xml,shared){const out=[];for(const row of nodes(xml,'row')){
  const cells=[];let next=0;
  for(const c of nodes(row,'c')){let index=colIndex(c.getAttribute('r')||'');if(index<0)index=next;if(index>=MAX_COLUMNS)continue;cells[index]=cellText(c,shared);next=index+1}
  if(cells.some(x=>String(x??'').trim())){out.push(cells);if(out.length>MAX_ROWS)throw Error('Too many rows in spreadsheet.')}}return out}
function csv(rows){return rows.map(r=>r.map(v=>{const s=String(v??'');return /[,"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\n')}
async function open(input){if(!(input instanceof ArrayBuffer)&&!ArrayBuffer.isView(input))throw Error('An XLSX file is required.');const size=input.byteLength;if(size>MAX_FILE)throw Error('XLSX file exceeds the 8 MB limit.');
 const Z=typeof JSZip!=='undefined'?JSZip:(typeof globalThis!=='undefined'?globalThis.JSZip:null);if(!Z)throw Error('Bundled XLSX archive reader is missing.');
 let zip;try{zip=await Z.loadAsync(input,{checkCRC32:true})}catch{throw Error('The XLSX archive could not be opened.')}if(!zip.file('[Content_Types].xml'))throw Error('This is not an XLSX workbook.');
 let total=0;for(const [path,obj] of Object.entries(zip.files)){if(obj.dir)continue;if(path.includes('..')||path.startsWith('/'))throw Error('Unsafe workbook archive path.');total+=obj._data?.uncompressedSize||0;if(total>24*1024*1024)throw Error('Spreadsheet expands beyond the safety limit.');}
 const workbook=await getXML(zip,'xl/workbook.xml'),rels=await getXML(zip,'xl/_rels/workbook.xml.rels');
 const paths=new Map();for(const r of nodes(rels,'Relationship')){const target=r.getAttribute('Target')||'';if(r.getAttribute('TargetMode')==='External')continue;if(/\/worksheet$/.test(r.getAttribute('Type')||''))paths.set(r.getAttribute('Id'),resolvePath('xl/workbook.xml',target))}
 const stringsDoc=await getXML(zip,'xl/sharedStrings.xml',false),strings=[];
 if(stringsDoc)for(const si of nodes(stringsDoc,'si')){strings.push(nodes(si,'t').map(t=>t.textContent||'').join(''));if(strings.length>200000)throw Error('Too many spreadsheet labels.')}
 const sheets=[];for(const s of nodes(workbook,'sheet')){const id=attr(s,'id'),path=paths.get(id);if(!path)continue;const xml=await getXML(zip,path);sheets.push({name:s.getAttribute('name')||'Sheet '+(sheets.length+1),rows:sheetRows(xml,strings)});if(sheets.length>=20)break}
 if(!sheets.length)throw Error('The workbook contains no readable worksheets.');return {sheets};}
return {open,csv};
});
