/* Threadwood state: independent local-only companion data; exact-write verification, stale-tab guard, conditional undo. */
(function(root){'use strict';
const C=root.FlossFoxThreadwoodCore||(typeof module==='object'&&module.exports?require('./core.js'):null);
if(!C)return;
function make(storage,key){let raw=null,state=null,blocked=false,lastUndo=null;
  try{raw=storage.getItem(key);state=raw===null?C.empty():C.normalize(JSON.parse(raw))}catch(e){blocked=true;}
  function read(){if(blocked)return{ok:false,error:'These memories cannot safely be read or saved. Existing browser data was left untouched.'};return{ok:true,state:JSON.parse(JSON.stringify(state))}}
  function write(transform){if(blocked)return{ok:false,error:'Memory saving is paused because this device could not read the saved data.'};
    try{if(storage.getItem(key)!==raw)return{ok:false,error:'These memories changed in another tab. Refresh the page before editing.'};
      const candidate=C.normalize(transform(JSON.parse(JSON.stringify(state)))),next=JSON.stringify(candidate);
      if(next===raw)return{ok:true,unchanged:true};
      const previous=raw;storage.setItem(key,next);if(storage.getItem(key)!==next)throw Error('Browser did not retain the change');
      raw=next;state=candidate;lastUndo={before:previous,after:next};return{ok:true};
    }catch(e){return{ok:false,error:e&&e.message&&/limit|invalid|duplicate|photo|keepsake|session/i.test(e.message)?e.message:'Nothing saved: this device blocked the change or storage is full.'}}}
  function undo(){if(!lastUndo||blocked)return{ok:false,error:'There is no safe change to undo.'};
    try{if(storage.getItem(key)!==lastUndo.after)return{ok:false,error:'The data has changed since then; undo was cancelled.'};
      if(lastUndo.before===null)storage.removeItem(key);else storage.setItem(key,lastUndo.before);
      if(storage.getItem(key)!==lastUndo.before)throw Error('Undo could not be saved');
      raw=lastUndo.before;state=raw===null?C.empty():C.normalize(JSON.parse(raw));lastUndo=null;return{ok:true};
    }catch(e){return{ok:false,error:'Could not save the undo. No further changes were attempted.'}}}
  function exportText(){const r=read();if(!r.ok)throw Error(r.error);return JSON.stringify({app:'flossfox-threadwood',exportedAt:new Date().toISOString(),memories:r.state},null,2)}
  function importText(text){let o;try{o=JSON.parse(text)}catch(e){return{ok:false,error:'That file is not valid JSON.'}};
    if(!o||o.app!=='flossfox-threadwood'||!o.memories)return{ok:false,error:'Not a Threadwood keepsake export.'};
    try{const p=C.normalize(o.memories);return{ok:true,preview:p}}catch(e){return{ok:false,error:e.message}}}
  return{key,read,write,undo,exportText,importText,canUndo:()=>!!lastUndo};
}
root.FlossFoxThreadwoodStore={make};if(typeof module==='object'&&module.exports)module.exports={make};
})(typeof globalThis!=='undefined'?globalThis:this);
