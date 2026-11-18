/* 3.9 Atelier Pip reactions (FF39-21). Verified points only, Pixel copy.json
   lines (starred .a / required companions), single companion via FlossFoxPip.react.
   Cover-photo hook is live in Stage G (FF39-13) with no invented pip.cover bubble; pip.covers is collection coverage. */
(function(root){
  'use strict';
  const CP=()=>root.FlossFoxAtelierCopy;
  function t(k,v,n){const X=CP();return X&&X.has&&X.has(k)?X.t(k,v,n):''}
  function ellip(s,n){s=String(s||'').trim();return s.length<=n?s:s.slice(0,Math.max(0,n-1))+'…'}
  function react(key,vars,anchor,opts){
    try{if(root.FlossFoxPip&&typeof FlossFoxPip.react==='function')return FlossFoxPip.react(key,vars,anchor,opts||{})}catch(e){}
    return false;
  }
  function imported(vars,anchor,fileId){
    const n=vars&&Number.isInteger(vars.n)?vars.n:0;if(n<1)return false;
    return react('pip.import',{n:n},anchor,{id:fileId,siteAnnounces:false,action:{label:t('pip.import.a')? 'Review colors':'Review colors',go:function(){
      const rows=document.getElementById('patRows');if(rows)try{rows.scrollIntoView({block:'start'})}catch(e){}
    }}});
  }
  function covers(p,P,anchor){
    if(!p||!P||!P.ready)return false;
    const n=(P.lines&&P.lines.length)||(p.items&&p.items.length)||0;
    const key=P.hasEstimates?'pip.covers.est':'pip.covers';
    return react(key,{n:n},anchor,{siteAnnounces:true,action:{label:'Open project',go:function(){
      const ed=document.getElementById('projEdit');if(ed)try{ed.scrollIntoView({block:'start'})}catch(e){}
    }}});
  }
  function returned(p,anchor){
    if(!p||p.status==='done')return false;
    const note=typeof p.leftOff==='string'?p.leftOff.trim():'';if(!note)return false;
    return react('pip.return',{note:ellip(note,44)},anchor,{id:p.id,siteAnnounces:true,action:{label:'Continue project',go:function(){
      const n=document.getElementById('pLeftOff');if(n){try{n.scrollIntoView({block:'center'})}catch(e){}try{n.focus({preventScroll:true})}catch(e){}}
    }}});
  }
  function finished(p,anchor){
    const name=ellip(p&&p.name?p.name:'this project',28);
    return react('pip.finish',{name:name},anchor||document.getElementById('projStatus')||document.getElementById('pCelebrate'),{siteAnnounces:true,action:{label:'See finished projects',go:function(){
      if(root.FlossFoxAtelier&&FlossFoxAtelier.exitSession)try{FlossFoxAtelier.exitSession()}catch(e){}
      const back=document.getElementById('pBack')||document.querySelector('#projEdit [data-back], #projEdit .back');
      if(back)back.click();
      else {const t=document.getElementById('tabProjects');if(t)t.click()}
    }}});
  }
  function timerStopped(ms,anchor){
    if(!(ms>=10*60*1000))return false; // Pixel: only after a sitting of at least 10 minutes
    const sitting=(root.FlossFoxAtelier&&FlossFoxAtelier._fmtSitting)?FlossFoxAtelier._fmtSitting(ms):(Math.floor(ms/60000)+' min');
    return react('pip.timer',{time:sitting},anchor,{siteAnnounces:true,action:{label:t('session.exit')||'Back to the full project',go:function(){
      if(root.FlossFoxAtelier&&FlossFoxAtelier.exitSession)FlossFoxAtelier.exitSession();
    }}});
  }
  // Stage G (FF39-13) cover-photo hook: live after a verified add/change/remove.
  // No invented Pip bubble (Pixel has no pip.cover.* line). Returns true only with a kind.
  function coverPhoto(p,kind){
    if(!p||!p.id)return false;
    if(kind!=='add'&&kind!=='change'&&kind!=='remove')return false;
    try{document.dispatchEvent(new CustomEvent('ff:cover-photo',{detail:{id:p.id,kind:kind}}))}catch(e){}
    return true;
  }
  root.FlossFoxAtelierPip={imported:imported,covers:covers,returned:returned,finished:finished,timerStopped:timerStopped,coverPhoto:coverPhoto,trim:ellip};
})(window);
