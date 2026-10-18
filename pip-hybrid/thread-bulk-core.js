/* Floss Fox bulk thread locations — pure, local, immutable logic.
 * Mutates NOTHING; never edits counts/partial/restock/confirmed, never calls a network.
 * Real DMC entries only; demo inventory is out of scope.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlossFoxBulkStorageCore=api})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const MAX_SELECTED=600;
const fmt={bobbin:'Bobbin',skein:'Skein',bag:'Bag',other:'Other'};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clean=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
function normalize(s){if(!s||typeof s!=='object'||Array.isArray(s))return null;
 const container=clean(s.container,60),slot=clean(s.slot,40),medium=own(fmt,s.medium)?s.medium:'';
 return container||slot||medium?{container,slot,medium}:null;
}
function copy(s){return s?{container:s.container,slot:s.slot,medium:s.medium}:null}
function equal(a,b){return JSON.stringify(a||null)===JSON.stringify(b||null)}
function display(s){return s?[s.container,s.slot,fmt[s.medium]||''].filter(Boolean).join(' · '):'No location'}
function prepare(map,codes,request){
 if(!map||typeof map!=='object'||Array.isArray(map))throw new Error('Thread collection unavailable.');
 if(!Array.isArray(codes)||!request||typeof request!=='object')throw new Error('Choose colors and a location action.');
 const wanted=[...new Set(codes)];if(!wanted.length)throw new Error('Select at least one color.');
 if(wanted.length>MAX_SELECTED)throw new Error(`Select no more than ${MAX_SELECTED} colors at once.`);
 if(!wanted.every(c=>typeof c==='string'&&own(map,c)&&map[c]&&typeof map[c]==='object'))throw new Error('One of the selected colors is no longer in your collection. Check your selection.');
 const mode=request.mode;if(!['replace','move','clear'].includes(mode))throw new Error('Choose what should change.');
 const loc=normalize(request.storage);
 if(mode==='replace'&&!loc)throw new Error('Enter a location or choose Clear storage locations.');
 if(mode==='move'&&!loc?.container)throw new Error('Enter a container name to move colors.');
 const changes=[];
 for(const code of wanted){const e=map[code],before=normalize(e.storage);
   const after=mode==='clear'?null:mode==='replace'?copy(loc):normalize({...before,container:loc.container});
   if(!equal(before,after))changes.push({code,before:copy(before),after:copy(after),updatedBefore:typeof e.updated==='string'?e.updated:''});
 }
 // A deterministic staleness token, NOT cryptographic authentication. Recheck immediately before commit.
 const signature=JSON.stringify({mode,chosen:wanted,versions:wanted.map(code=>{const e=map[code];return[code,e.n,e.partial,e.restock,e.confirmed,e.updated,normalize(e.storage)]}),changes:changes.map(c=>[c.code,c.before,c.after,c.updatedBefore])});
 return {mode,count:wanted.length,unchanged:wanted.length-changes.length,changes,signature};
}
function applyCopy(map,preview,now){const next={...map};for(const c of preview.changes){const e={...next[c.code],updated:now};if(c.after)e.storage=copy(c.after);else delete e.storage;next[c.code]=e;}return next}
function reverseCopy(map,changes){const next={...map};for(const c of changes){const e={...next[c.code],updated:c.updatedBefore};if(c.before)e.storage=copy(c.before);else delete e.storage;next[c.code]=e;}return next}
return Object.freeze({MAX_SELECTED,normalize,equal,display,prepare,applyCopy,reverseCopy});
});
