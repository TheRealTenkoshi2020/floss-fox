/* Pip, the Floss Fox companion. Deterministic: reads the converter's existing parse result. No network, no AI. */
(()=>{'use strict';
const PIP_KEY='flossfox.pip.v1';           // stores only "shown"/"hidden"
// Returning visitor = the tour was already completed or dismissed (tour.js pref). Read-only here.
const returning=(()=>{try{const t=JSON.parse(localStorage.getItem(PIP_KEY.replace(/\.pip\.v1$/,'.tour.v1'))||'null');if(t&&(t.status==='done'||t.status==='dismissed'))return true;const d=JSON.parse(localStorage.getItem(PIP_KEY.replace(/\.pip\.v1$/,'.v1'))||'null');return !!(d&&d.projects&&d.projects.length)}catch(e){return false}})(); // genuine returning visitor: finished/dismissed the tour, or has saved projects
const SIZES=[160,320,480];
// Poses with real (transparent) artwork. 'thinking' is used only for real checks (Ask Pip answers, backup check); the 'processing' state stays unused (no fake delays).
const ART={greeting:'greeting',curious:'curious',puzzled:'puzzled',duplicates:'duplicates',helpful:'helpful',tangled:'tangled',celebrating:'celebrating',sleepy:'sleepy',
 thinking:'thinking',pointing:'pointing',peeking:'peeking',neutral:'neutral','greeting-alt':'greeting-alt',
 reassuring:'reassuring',presenting:'presenting',discovery:'discovery',saved:'saved','face-icon':'face-icon',
 needle:'needle','needle-alt':'needle-alt',organizing:'organizing',goodbye:'goodbye','cross-stitch':'cross-stitch'};
const FUTURE={proud:'greeting',teaching:'curious'};
const poseArt=p=>ART[p]||ART[FUTURE[p]]||'greeting';
const short=t=>{t=String(t).replace(/\s+/g,' ').trim();return t.length>24?t.slice(0,23)+'…':t};
/* Error poses: REASSURING for plain fixable errors (unknown DMC number, unreadable amount): "let's fix that".
   PUZZLED for clarification ("did you mean?"): a line with more than one number, where Pip can't tell what was meant. Tangled is never used for errors. */
const errPose=r=>r.errs.some(e=>e.kind==='multi'||!['code','qty'].includes(e.kind))?'puzzled':'reassuring';
function errMsg(r){if(r.errs.length>1)return errPose(r)==='reassuring'?`No worries! ${r.errs.length} entries need a quick look. They're highlighted below.`:`Hmm, ${r.errs.length} entries need a look. They're highlighted below.`;const e=r.errs[0],x=short(e.t);
 if(e.kind==='code')return`Let's fix that one. I couldn't read “${x}” as a DMC number. It's highlighted below.`;
 if(e.kind==='qty')return`Let's fix that one. I couldn't read the amount in “${x}”. It's highlighted below.`;
 if(e.kind==='multi')return`Hmm, “${x}” has more than one number in it. Which one did you mean? It's highlighted below.`;
 return"I couldn't read that entry. It's highlighted below so you can take a look."}
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
// Real alternatives only: counts DMC colors the chart actually matched in the chosen non-DMC brand (read from the converter's own list).
const alt=()=>{try{return window.FlossFoxAlt?window.FlossFoxAlt():null}catch(e){return null}};
const TANGLE=["Oops, got a little tangled up!","I meant to do that. Probably."];let tn=0;
/* Central state map. pri follows the brief: 1 errors > 2 user-requested help > 3 duplicate/validation > 4 celebration > 5 helpful/curious > 6 playful > 7 sleepy.
   Base states come from the parse result; celebrating/tangled/sleepy are short overlays on top of a calm base. */
const STATES={
 welcome:    {pose:'greeting',   pri:10, anim:'pop',   msg:()=>"Hi, I'm Pip! Let's get your threads sorted."},
 welcomeBack:{pose:'greeting-alt',pri:10,anim:'pop',   msg:()=>'Welcome back! What are we stitching next?'},
 idle:       {pose:'neutral',    pri:12, anim:'fade',  msg:()=>'Paste a list whenever you\'re ready.'},
 attentive:  {pose:'curious',    pri:20, anim:'tilt',  msg:()=>'Ready when you are!'},
 empty:      {pose:'curious',    pri:20, anim:'tilt',  msg:()=>'I didn\'t find any colors yet. Pop a few DMC numbers in and I\'ll take a look.'},
 listReady:  {pose:'presenting', pri:20, anim:'pop',   msg:()=>((window.FF_P12||{})['p12.bubble.find.has.1'])||"Here are your colors. Save them as a project to check what you own."},
 recovered:  {pose:'reassuring', pri:21, anim:'fade',  msg:()=>'All fixed! Every line reads cleanly now.'},
 helpful:    {pose:'discovery',  pri:25, anim:'pop',   msg:()=>{const a=alt();return a&&a.matched?`Look! The chart has ${a.brand} matches for ${a.matched} of your ${plural(a.total,'color')}.`:''}},
 processing: {pose:'thinking',   pri:30, anim:'fade',  msg:()=>'Let me look at your list…'}, // reserved: parsing is instant, so never shown (no fake delays)
 celebrating:{pose:'celebrating',pri:35, anim:'cheer', msg:()=>'Yay, your list is ready!'},
 duplicate:  {pose:'duplicates', pri:40, anim:'pop',   msg:r=>r.items.filter(i=>i.src.length>1).length===1?"Found a repeat! I combined it and added up the skeins.":"Found some repeats! I combined them and added up the skeins."},
 goodbye:    {pose:'goodbye',    pri:9,  anim:'fade',  msg:()=>"Happy stitching! Tap Ask Pip anytime."},
 error:      {pose:errPose,      pri:50, anim:'tilt',  msg:errMsg},
 tangled:    {pose:'tangled',    pri:8,  anim:'wiggle',msg:()=>TANGLE[tn%2]},
 screen:     {pose:()=>screenPose||'reassuring', pri:20, anim:'fade',  msg:()=>screenT}, // per-screen line from pip-help.js (off Find floss)
 sleepy:     {pose:'sleepy',     pri:5,  anim:'doze',  msg:()=>''},
 // Contextual tips (overlays, at most once per session each, only over a calm state; see tour.js)
 hintStart:  {pose:()=>'peeking',    pri:22, anim:'tilt',  msg:()=>'Not sure where to start? Try typing a DMC number, like 310!'},
 hintCompare:{pose:'discovery',    pri:22, anim:'pop',   msg:()=>{const n=window.FlossFoxAltFor?Math.max(FlossFoxAltFor('sullivans'),FlossFoxAltFor('anchor')):0;return n?'Want to compare another thread brand? Try "Brand to buy" in your shopping list.':''}}
};
// Needle tips rotate between NEEDLE (happy) and NEEDLE-ALT (calm closed smile) for variety.
let needleN=0;const needlePose=()=>(needleN++%2)?'needle-alt':'needle';
const CALM=25; // overlays (tangled, sleepy) only sit on a base at or below this priority
function stateFor(r,submitted){const c=[greeted?'idle':returning?'welcomeBack':'welcome'];
 if(r.errs.length)c.push('error');if(r.items.some(i=>i.src.length>1))c.push('duplicate');
 if(r.items.length){c.push('listReady');const a=alt();if(a&&a.matched)c.push('helpful')}else if(submitted&&!r.errs.length)c.push('empty');
 return c.sort((a,b)=>STATES[b].pri-STATES[a].pri)[0]}
const $=id=>document.getElementById(id);
const el=$('pip');if(!el)return;
const img=$('pipImg'),src=$('pipSrc'),msg=$('pipMsg'),fig=$('pipFig'),tog=$('pipToggle'),hi=$('pipHi');
let greeted=false,touring=false,cur=null,base='welcome',lastR={items:[],errs:[]},over=null,overT=0,celebrated=false;
const T={toast:3500,celebrate:4000,tangle:2600,tangleGap:60000,idle:90000,minSleep:4000,throttle:1000};
const set=(a,ext)=>SIZES.map(w=>`assets/pip/pip-${a}-${w}.${ext} ${w}w`).join(', ');
let screenK=null,screenT='',screenPose=null;
function show(name,r,anim=true){if(screenK&&name===base)name='screen';const S=STATES[name];if(!S)return;if(r)lastR=r;const text=S.msg(lastR);const pz=typeof S.pose==='function'?S.pose(lastR):S.pose;
 if(cur===name&&msg.textContent===text&&el.dataset.pose===poseArt(pz))return; // nothing meaningful changed
 const a=poseArt(pz);cur=name;el.dataset.state=name;el.dataset.pose=a;
 if(img.dataset.art!==a){src.srcset=set(a,'webp');img.srcset=set(a,'png');img.src=`assets/pip/pip-${a}-320.png`;img.dataset.art=a}
 msg.textContent=text;msg.classList.toggle('quiet',!text);
 fig.classList.remove('pip-pop','pip-tilt','pip-fade','pip-cheer','pip-wiggle','pip-doze');if(anim){void fig.offsetWidth;fig.classList.add('pip-'+S.anim)}}
const clearOver=()=>{clearTimeout(overT);over=null};
function overlay(name,ms){clearOver();over=name;show(name);if(ms)overT=setTimeout(()=>{over=null;show(base,null,false)},ms)} // settle quietly: no new animation
const quiet=()=>fig.hidden||document.hidden;
// Called by the converter on every recalculation.
function result(r,submitted){greeted=true;const prev=base;lastR=r;base=stateFor(r,submitted);
 if(prev==='error'&&['listReady','helpful'].includes(base)&&submitted)base=base==='helpful'?base:'recovered'; // real recovery: the list that had errors now reads cleanly
 if(STATES[base].pri>STATES.celebrating.pri)clearOver();          // errors/duplicates interrupt anything
 else if(over==='sleepy'||over==='tangled'||(over&&over.startsWith('hint')))clearOver();            // real input ends play and sleep
 const ex=typeof window.isExample==='function'&&window.isExample();
 const clean=submitted&&r.items.length&&!r.errs.length&&STATES[base].pri<=CALM;
 if(clean&&!celebrated&&!ex){const a=alt();if(!a||!a.review){celebrated=true;if(!fig.hidden){overlay('celebrating',T.celebrate);arm();return}}}
 if(over==='celebrating')return; // let the one celebration finish, then settle to the new base
 show(base,r);arm()}
// Easter egg: tap Pip. At most once a minute; never over an error, duplicate or celebration.
let lastTangle=-Infinity;
function tangle(){const now=performance.now();
 if(over==='sleepy')wake();
 if(touring||over==='celebrating'||STATES[base].pri>CALM||now-lastTangle<T.tangleGap||fig.hidden)return false;
 lastTangle=now;tn++;overlay('tangled',T.tangle);arm();return true}
if(hi)hi.addEventListener('click',tangle);
// Sleepy: one timer, reset on activity (throttled, passive). Paused while the tab is hidden. No polling.
let idleT=0,sleptAt=0,lastAct=0;
function arm(){clearTimeout(idleT);if(document.hidden||over==='sleepy')return;idleT=setTimeout(sleep,T.idle)}
function sleep(){if(touring||quiet()||over||STATES[base].pri>CALM)return arm();sleptAt=performance.now();overlay('sleepy',0)}
function wake(){if(over!=='sleepy')return;const left=T.minSleep-(performance.now()-sleptAt);
 if(left>0){clearTimeout(overT);overT=setTimeout(wake,left);return}
 clearOver();show(['welcome','welcomeBack','idle'].includes(base)?'attentive':base,null,false);fig.classList.add('pip-fade');arm()}
function activity(){const now=performance.now();if(over==='sleepy')return wake();if(now-lastAct<T.throttle)return;lastAct=now;arm()}
['pointerdown','pointermove','keydown','scroll','wheel','touchstart'].forEach(e=>window.addEventListener(e,activity,{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(idleT);else arm()});
// Project readiness: celebrate once per real not-ready -> ready transition (first sighting only records the state).
const seen=new Map();
function projectReady(id,ready){const prev=seen.get(id);seen.set(id,!!ready);return prev===false&&!!ready&&!fig.hidden}
// Visibility preference
function vis(on,store){fig.hidden=!on;document.body.classList.toggle('pip-hidden-all',!on);msg.hidden=!on;el.classList.toggle('pipoff',!on);el.parentElement.classList.toggle('nopip',!on);tog.setAttribute('aria-expanded',String(on));tog.textContent=on?'Hide Pip':'Show Pip';
 if(!on)clearOver();else show(base,null,false);if(store)try{localStorage.setItem(PIP_KEY,on?'shown':'hidden')}catch(e){}}
let pref='shown';try{pref=localStorage.getItem(PIP_KEY)||'shown'}catch(e){}
vis(pref!=='hidden',false);tog.onclick=()=>vis(fig.hidden,true);
window.FlossFoxPip=null;
const api={result,show,stateFor,STATES,ART,FUTURE,current:()=>cur,base:()=>base,overlay:()=>over,tangle,projectReady,KEY:PIP_KEY,
 // test hook: shorten timers (dev/testing only; no effect unless called)
 setTour:on=>{touring=!!on;if(touring&&(over==='sleepy'||over==='tangled'||(over&&over.startsWith('hint')))){clearOver();show(base,null,false)}arm()},touring:()=>touring,
 hint:n=>{const S=STATES[n];if(!S||touring||over||quiet()||STATES[base].pri>CALM||!S.msg(lastR))return false;overlay(n,9000);arm();return true},
 errPose,
 screen:(k,t,pose)=>{if(!k){if(!screenK)return;screenK=null;if(cur==='screen')show(base,null,false);return}screenK=k;screenT=String(t||'');screenPose=pose||null;clearOver();show('screen')},screenKey:()=>screenK,
 isHidden:()=>fig.hidden,
 // Brief decorative confirmation (wink + thumbs-up) next to the app's own status line, which is the one polite announcement.
 saved:(slot,text)=>{if(!slot||fig.hidden)return false;slot.querySelectorAll('.savedtoast').forEach(x=>x.remove());const t=document.createElement('span');t.className='savedtoast';t.setAttribute('aria-hidden','true');
  t.innerHTML=`<picture><source type="image/webp" srcset="assets/pip/pip-saved-160.webp"><img src="assets/pip/pip-saved-160.png" width="160" height="237" alt=""></picture>${text?`<span>${String(text).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>`:''}`;slot.prepend(t);setTimeout(()=>t.remove(),T.toast);return true},
 // Tour finished: GOODBYE (walking off with a wave), a short calm overlay. Never over errors or busy states.
 bye:()=>{if(fig.hidden||STATES[base].pri>CALM)return false;overlay('goodbye',3000);arm();return true},
 needlePose,
 _timing:o=>{Object.assign(T,o);arm();return{...T}}};
/* global state */
if(typeof state!=='undefined'&&(state.items.length||state.errs.length)){lastR=state;base=stateFor(state,true);show(base,state)}else{base=stateFor({items:[],errs:[]},false);show(base)}
const warm=()=>{const w=img.currentSrc&&/-(\d+)\.(webp|png)/.exec(img.currentSrc);const size=w?w[1]:'320',ext=w?w[2]:'webp';
 // Only warm the few poses the companion is likely to need next (after idle); everything else loads when its view or state appears.
 ['neutral','curious','presenting','reassuring','puzzled'].forEach(a=>{if(img.currentSrc.indexOf('pip-'+a+'-')<0){const i=new Image();i.decoding='async';i.src=`assets/pip/pip-${a}-${size}.${ext}`}})};
window.addEventListener('load',()=>(window.requestIdleCallback||setTimeout)(warm,{timeout:3000}));
const inp=$('inp');inp.addEventListener('focus',()=>{if(['welcome','welcomeBack','idle'].includes(cur)&&!inp.value.trim())show('attentive')});
// Leaving an empty box: settle to the calm idle companion (curious stays for focus/exploring).
inp.addEventListener('blur',()=>{if(cur==='attentive'&&!inp.value.trim()&&!over){greeted=true;base='idle';show('idle')}});
arm();
window.FlossFoxPip=api;
})();
