/* Deterministic task dispatcher: Floss Fox state read locally, zero AI.
   Never writes projects/threads or sends them to a backend.
   Explicitly narrow commands only; ambiguous requests fall back to built-in help. */
(function(root){'use strict';
function route(query){const q=String(query||'').trim().slice(0,600);if(!q)return null;
 if(/\b(?:upload|import|scan|read|open)\b.*\b(?:pattern|pdf|chart|legend|image)\b|\b(?:pattern|pdf)\b.*\b(?:upload|import|scan)\b/i.test(q)){
  return{id:'pattern-open',answer:'I can open the pattern importer. It reads PDF text locally when possible. You review colors before saving'+((typeof window!=='undefined'&&window.PIP_PATTERN_CONFIG&&window.PIP_PATTERN_CONFIG.enabled===true)?'; scanning a photographed legend requires your approval before one page is sent online':'; photographed legends are typed in by you')+'. Full chart stitch-grid recognition is not yet verified.',source:'local action',action:'pattern'};
 }
 if(/\b(?:move|put|reorganize|store|organize)\b.*\b(?:thread|floss|skein|color|box|drawer)\b/i.test(q))return{id:'organizer-open',answer:'Open My Thread Collection to edit storage locations. For several colors, use Organize several colors and review the changes before saving. I won\'t move anything automatically.',source:'local action',actions:[{label:'Open My Thread Collection',href:'index.html#threads'}]};
 const m=/\b(?:DMC\s*)?(\d{1,4}|B5200|BLANC|ECRU)\b/i.exec(q);
 const asking=/\b(?:where|find|have|own|stored|location|how many|skein|stash|inventory|collection|bobbin)\b/i.test(q);
 if(m&&asking&&root.FlossFoxThreadsUI?.data){
  const code=m[1].toUpperCase();if(typeof DMC==='undefined'||!Object.hasOwn(DMC,code))return null;
  const e=root.FlossFoxThreadsUI.data().threads?.[code];if(!e)return{id:'thread-lookup',answer:`DMC ${code} isn't in My Thread Collection on this device. That doesn't mean you don't own it, just that it isn't recorded here.`,source:'local inventory',actions:[{label:'Open My Thread Collection',href:'index.html#threads'}]};
  let answer=`DMC ${code}: ${e.n} recorded full skein${e.n===1?'':'s'}${e.partial?' plus a partial skein':''}.`;
  if(e.confirmed!==true)answer+=' The full-skein count is not confirmed.';
  const a=[e.storage?.container,e.storage?.slot,e.storage?.medium].filter(Boolean).join(' · ');
  answer+=a?` Storage: ${a}.`:' No storage location is recorded.';
  if(e.restock)answer+=' Marked for restock.';
  return{id:'thread-lookup',answer,source:'local inventory',actions:[{label:'Open My Thread Collection',href:'index.html#threads'}]};
 }
 if(/\b(?:how many|number of)\b.*\bprojects\b/i.test(q)&&root.FlossFoxProjects?._store){const n=root.FlossFoxProjects._store().projects.filter(x=>!x.demo).length;
  return{id:'project-count',answer:`You have ${n} saved project${n===1?'':'s'} in this browser. This doesn't include demo projects.`,source:'local inventory',actions:[{label:'Open My Projects',href:'index.html#projects'}]}}
 return null;
}
 const api=Object.freeze({route});root.FlossFoxPipLocalRouter=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
