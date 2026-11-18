/* Floss Fox landing (dev, ci005-79). Once per fresh open (new tab / app launch) via sessionStorage.
   Skipped on reload, back/forward, or a deep link (any hash). Never delays data loading: the app below
   boots and renders as usual and is only hidden by a class on <html> until a choice is made. */
(function(){'use strict';
 var K='ff.landing.seen',de=document.documentElement;
 var PREFONLY=/^flossfox(-dev)?\.atelier\.v1$/; // 3.9: see fresh()
 function nav(){try{var e=performance.getEntriesByType('navigation')[0];if(e)return e.type}catch(_){}return 'navigate'}
 function seen(){try{return sessionStorage.getItem(K)==='1'}catch(_){return true}}
 function mark(){try{sessionStorage.setItem(K,'1')}catch(_){}}
 function count(){try{var g=window.goatcounter;if(g&&g.count)g.count({path:'landing',title:'Landing'})}catch(_){}}
 // Runs in <head> before first paint, so the app never flashes behind the landing.
 // 3.9 Atelier: a returning visitor who turned on "Resume where I was" goes straight back to their last tab instead of this
 // welcome screen. Only when real data is saved (not fresh()) and the preference says so; anything unreadable shows the landing.
 function resumeOn(){try{if(fresh())return false;var o=JSON.parse(localStorage.getItem('flossfox.startHere.v1'.replace(/\.startHere\.v1$/,'.atelier.v1'))||'null');return!!(o&&typeof o==='object'&&!(Number(o.v)>1)&&o.rememberPlace===true)}catch(_){return false}}
 if(!location.hash&&!seen()&&nav()==='navigate'&&!resumeOn()){de.classList.add('ff-landing');window.__ffLandingShown=1}
 mark();
 function el(id){return document.getElementById(id)}
 function first(){var m=el('ffLanding');if(m)try{m.focus({preventScroll:true})}catch(_){}} // focus the region (no ring); next Tab lands on Find floss
 function show(){de.classList.add('ff-landing');scrollTo(0,0);first();count()}
 function hide(){de.classList.remove('ff-landing')}
 window.ffShowLanding=show;
 // ci005-85: first visit only (nothing saved under any flossfox key): a gentle "Start here" from Pip on Find floss.
 // Stores only a tiny seen flag; never reads or changes saved projects or threads.
 var SH='flossfox.startHere.v1';
 // 3.9 Atelier (FF39-24): a convenience-preference key (theme, Resume where I was) is not saved work and not a confirmed
 // welcome, so it alone must not hide Start here. Every other flossfox key still counts, exactly as before.
 function fresh(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';if(/^flossfox/.test(k)&&!PREFONLY.test(k))return false}return true}catch(_){return false}}
 function seenSH(){try{localStorage.setItem(SH,'seen')}catch(_){}var n=el('ffStartHere');if(n)n.remove();n=el('ffStartHereDot');if(n)n.remove();var t=document.querySelector('#ffLanding .ffsh');if(t)t.remove();var c=document.querySelector('#ffLanding .ch.ffshch');if(c)c.classList.remove('ffshch')}
 function startHere(L){if(!fresh())return;var f=L.querySelector('a[data-tab="tabConvert"]'),say=el('ffLandSay'),q=L.querySelector('p.quiet');if(!f||!say||!q)return;
   f.classList.add('ffshch');var t=document.createElement('span');t.className='ffsh';t.textContent='Start here';var sr=document.createElement('span');sr.className='sr';sr.textContent=', ';t.prepend(sr);f.append(t);
  var d=document.createElement('span');d.setAttribute('aria-hidden','true');d.id='ffStartHereDot';d.textContent='\u00b7';
  var g=document.createElement('button');g.type='button';g.id='ffStartHere';g.className='ffshok';g.textContent='Got it';
  g.addEventListener('click',seenSH);q.append(d,g)}
 window.FlossFoxStartHere={fresh:fresh,KEY:SH};
 function init(){
  var L=el('ffLanding');if(!L)return;startHere(L);
  L.addEventListener('click',function(ev){
   var a=ev.target.closest&&ev.target.closest('a[data-tab]');if(!a)return;if(el('ffStartHere'))seenSH();
   var t=el(a.getAttribute('data-tab'));
   if(!t||t.tagName==='A')return hide(); // Fabric is its own page: let the link navigate
   ev.preventDefault();hide();t.click();scrollTo(0,0);try{t.focus({preventScroll:true})}catch(_){}
  });
  var tb=el('ffLandTour');
  if(tb)tb.addEventListener('click',function(){if(el('ffStartHere'))seenSH();hide();var c=el('tabConvert');if(c)c.click();scrollTo(0,0);
   if(window.FlossFoxTour&&window.FlossFoxTour.start)window.FlossFoxTour.start()});
  var n=el('appname');
  if(n){n.classList.add('fflandlink');n.setAttribute('role','link');n.setAttribute('tabindex','0');n.setAttribute('title','Start');
   n.addEventListener('click',show);n.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();show()}})}
  document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('a.ffstart');if(s){e.preventDefault();show()}});
  if(de.classList.contains('ff-landing')){if(window.goatcounter)count();else addEventListener('load',count)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
