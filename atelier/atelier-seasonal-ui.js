/* 3.9 Seasonal Pip wiring (FF39-22). Art is not shipped yet: available stays
   empty so choose() never requests files, and the established gardener/starlight
   look is unchanged. If a key is later marked available and the file is missing
   or fails, images fall back to standard Pip (no broken image). Off/Quiet and a
   turned-off Settings switch also keep standard Pip. Event poses are never swapped.
   Dates come from the device's local clock (or FlossFoxAtelierSeasonal.setNow in tests). */
(function(root){
  'use strict';
  if(!root.FlossFoxSeasonalArt){
    root.FlossFoxSeasonalArt={
      available:[],
      srcFor:function(key,w,ext){return 'assets/pip/pip-greeting-'+key+'-'+w+'.'+ext}
    };
  }
  let nowFn=null;
  function now(){return nowFn?nowFn():new Date()}
  function available(){const A=root.FlossFoxSeasonalArt;return (A&&Array.isArray(A.available))?A.available.slice():[]}
  function src(key,w,ext){const A=root.FlossFoxSeasonalArt;if(A&&typeof A.srcFor==='function')return A.srcFor(key,w,ext);return 'assets/pip/pip-greeting-'+key+'-'+w+'.'+ext}
  function base(key){return 'greeting-'+key}
  function prefs(){return root.FlossFoxAtelier&&root.FlossFoxAtelier.prefs?root.FlossFoxAtelier.prefs():null}
  function choice(){
    const S=root.FlossFoxSeasonal;if(!S||typeof S.choose!=='function')return null;
    const p=prefs()||{};
    const on=p.seasonalPip!==false; // ON by default when prefs have not booted yet
    const lv=root.FlossFoxPip&&root.FlossFoxPip.level?root.FlossFoxPip.level():'important';
    const hem=p.hemisphere||'north';
    return S.choose(now(),{seasonalPip:on,pipLevel:lv,hemisphere:hem,available:available()});
  }
  function restoreLanding(pic,img,webp,darks){
    if(!img)return;
    img.onerror=null;
    if(img.dataset.stdSrc)img.src=img.dataset.stdSrc;
    if(img.dataset.stdSrcset)img.srcset=img.dataset.stdSrcset;else img.removeAttribute('srcset');
    if(webp&&img.dataset.stdWebp)webp.srcset=img.dataset.stdWebp;
    const dark=document.documentElement.getAttribute('data-atelier-scheme')==='dark';
    darks.forEach(s=>{s.media=dark?'all':'not all'});
  }
  function applyLanding(){
    const pic=document.querySelector('#ffLanding .lpip picture');if(!pic)return;
    const img=pic.querySelector('img');if(!img)return;
    const darks=[...pic.querySelectorAll('[data-atelier-darksrc]')];
    const webp=pic.querySelector('source[type="image/webp"]:not([data-atelier-darksrc])');
    if(!img.dataset.stdSrc){
      img.dataset.stdSrc=img.getAttribute('src')||'assets/pip/pip-gardener-320.png';
      img.dataset.stdSrcset=img.getAttribute('srcset')||'';
      if(webp)img.dataset.stdWebp=webp.getAttribute('srcset')||'';
    }
    const ch=choice();
    if(!ch||!ch.key){restoreLanding(pic,img,webp,darks);return}
    const k=ch.key;
    img.onerror=function(){restoreLanding(pic,img,webp,darks);img.dataset.show='theme-fallback'};
    if(webp)webp.srcset=src(k,320,'webp');
    img.removeAttribute('srcset');
    img.src=src(k,320,'png');
    darks.forEach(s=>{s.media='not all'});
  }
  function refresh(){
    try{applyLanding()}catch(e){}
    try{if(root.FlossFoxPip&&typeof FlossFoxPip.retheme==='function')FlossFoxPip.retheme()}catch(e){}
  }
  root.FlossFoxAtelierSeasonal={
    now:now,
    setNow:function(fn){nowFn=typeof fn==='function'?fn:null;refresh()},
    available:available,src:src,base:base,choice:choice,restingChoice:choice,applyLanding:applyLanding,refresh:refresh
  };
  document.addEventListener('ff:atelier-seasonal',refresh);
  document.addEventListener('ff:atelier-prefs-reset',refresh);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);
  else setTimeout(refresh,0);
})(window);
