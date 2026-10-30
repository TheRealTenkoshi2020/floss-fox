/* Floss Fox landing (dev, ci005-79). Once per fresh open (new tab / app launch) via sessionStorage.
   Skipped on reload, back/forward, or a deep link (any hash). Never delays data loading: the app below
   boots and renders as usual and is only hidden by a class on <html> until a choice is made. */
(function(){'use strict';
 var K='ff.landing.seen',de=document.documentElement;
 function nav(){try{var e=performance.getEntriesByType('navigation')[0];if(e)return e.type}catch(_){}return 'navigate'}
 function seen(){try{return sessionStorage.getItem(K)==='1'}catch(_){return true}}
 function mark(){try{sessionStorage.setItem(K,'1')}catch(_){}}
 function count(){try{var g=window.goatcounter;if(g&&g.count)g.count({path:'landing',title:'Landing'})}catch(_){}}
 // Runs in <head> before first paint, so the app never flashes behind the landing.
 if(!location.hash&&!seen()&&nav()==='navigate'){de.classList.add('ff-landing');window.__ffLandingShown=1}
 mark();
 function el(id){return document.getElementById(id)}
 function first(){var m=el('ffLanding');if(m)try{m.focus({preventScroll:true})}catch(_){}} // focus the region (no ring); next Tab lands on Find floss
 function show(){de.classList.add('ff-landing');scrollTo(0,0);first();count()}
 function hide(){de.classList.remove('ff-landing')}
 window.ffShowLanding=show;
 function init(){
  var L=el('ffLanding');if(!L)return;
  L.addEventListener('click',function(ev){
   var a=ev.target.closest&&ev.target.closest('a[data-tab]');if(!a)return;
   var t=el(a.getAttribute('data-tab'));
   if(!t||t.tagName==='A')return hide(); // Fabric is its own page: let the link navigate
   ev.preventDefault();hide();t.click();scrollTo(0,0);try{t.focus({preventScroll:true})}catch(_){}
  });
  var tb=el('ffLandTour');
  if(tb)tb.addEventListener('click',function(){hide();var c=el('tabConvert');if(c)c.click();scrollTo(0,0);
   if(window.FlossFoxTour&&window.FlossFoxTour.start)window.FlossFoxTour.start()});
  var n=el('appname');
  if(n){n.classList.add('fflandlink');n.setAttribute('role','link');n.setAttribute('tabindex','0');n.setAttribute('title','Start');
   n.addEventListener('click',show);n.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();show()}})}
  document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('a.ffstart');if(s){e.preventDefault();show()}});
  if(de.classList.contains('ff-landing')){if(window.goatcounter)count();else addEventListener('load',count)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
