/* Pip, the Floss Fox companion. Deterministic: reads the converter's existing parse result. No network, no AI. */
(()=>{'use strict';
const PIP_KEY='flossfox.pip.v1';           // stores only "shown"/"hidden"
const SIZES=[160,320,480];
// Poses that have real artwork. Poses without art fall back to an existing one; 'thinking' has no art and its state is never shown.
const ART={greeting:'greeting',curious:'curious',puzzled:'puzzled',duplicates:'duplicates',helpful:'helpful',tangled:'tangled',celebrating:'celebrating',sleepy:'sleepy'};
const FUTURE={thinking:'curious',proud:'greeting',peeking:'curious',teaching:'curious'};
const poseArt=p=>ART[p]||ART[FUTURE[p]]||'greeting';
const short=t=>{t=String(t).replace(/\s+/g,' ').trim();return t.length>24?t.slice(0,23)+'…':t};
function errMsg(r){if(r.errs.length>1)return`${r.errs.length} entries need a look. Check the highlighted lines below.`;const e=r.errs[0],x=short(e.t);
 if(e.kind==='code')return`I couldn't read “${x}” as a DMC number. Check the highlighted line below.`;
 if(e.kind==='qty')return`I couldn't read the amount in “${x}”. Check the highlighted line below.`;
 if(e.kind==='multi')return`“${x}” has more than one number in it. Check the highlighted line below.`;
 return"I couldn't read that entry. Check the highlighted line below."}
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
// Real alternatives only: counts DMC colors the chart actually matched in the chosen non-DMC brand (read from the converter's own list).
const alt=()=>{try{return window.FlossFoxAlt?window.FlossFoxAlt():null}catch(e){return null}};
const TANGLE=["Oops! Got a little tangled up!","I meant to do that. Probably."];let tn=0;
/* Central state map. pri follows the brief: 1 errors > 2 user-requested help > 3 duplicate/validation > 4 celebration > 5 helpful/curious > 6 playful > 7 sleepy.
   Base states come from the parse result; celebrating/tangled/sleepy are short overlays on top of a calm base. */
const STATES={
 welcome:    {pose:'greeting',   pri:10, anim:'pop',   msg:()=>"Hi! I'm Pip. Let's get your threads sorted!"},
 attentive:  {pose:'curious',    pri:20, anim:'tilt',  msg:()=>'Ready when you are!'},
 empty:      {pose:'curious',    pri:20, anim:'tilt',  msg:()=>'Add a few thread numbers to get started.'},
 listReady:  {pose:'curious',    pri:20, anim:'tilt',  msg:()=>"Your colors are ready! Let's see what you have."},
 helpful:    {pose:'helpful',    pri:25, anim:'pop',   msg:()=>{const a=alt();return a&&a.matched?`Look! I found ${a.brand} options for ${a.matched} of your ${plural(a.total,'color')}.`:''}},
 processing: {pose:'thinking',   pri:30, anim:'fade',  msg:()=>'Let me look at your list…'}, // reserved: no 'thinking' art and parsing is instant, so never shown
 celebrating:{pose:'celebrating',pri:35, anim:'cheer', msg:()=>'Yay! Your list is ready!'},
 duplicate:  {pose:'duplicates', pri:40, anim:'pop',   msg:r=>r.items.filter(i=>i.src.length>1).length===1?"Found a repeat! I've combined it for you.":"Found some repeats! I've combined them for you."},
 error:      {pose:'puzzled',    pri:50, anim:'tilt',  msg:errMsg},
 tangled:    {pose:'tangled',    pri:8,  anim:'wiggle',msg:()=>TANGLE[tn%2]},
 sleepy:     {pose:'sleepy',     pri:5,  anim:'doze',  msg:()=>''}
};
const CALM=25; // overlays (tangled, sleepy) only sit on a base at or below this priority
function stateFor(r,submitted){const c=['welcome'];
 if(r.errs.length)c.push('error');if(r.items.some(i=>i.src.length>1))c.push('duplicate');
 if(r.items.length){c.push('listReady');const a=alt();if(a&&a.matched)c.push('helpful')}else if(submitted&&!r.errs.length)c.push('empty');
 return c.sort((a,b)=>STATES[b].pri-STATES[a].pri)[0]}
const $=id=>document.getElementById(id);
const el=$('pip');if(!el)return;
const img=$('pipImg'),src=$('pipSrc'),msg=$('pipMsg'),fig=$('pipFig'),tog=$('pipToggle'),hi=$('pipHi');
let cur=null,base='welcome',lastR={items:[],errs:[]},over=null,overT=0,celebrated=false;
const T={celebrate:4000,tangle:2600,tangleGap:60000,idle:90000,minSleep:4000,throttle:1000};
const set=(a,ext)=>SIZES.map(w=>`assets/pip/pip-${a}-${w}.${ext} ${w}w`).join(', ');
function show(name,r,anim=true){const S=STATES[name];if(!S)return;if(r)lastR=r;const text=S.msg(lastR);
 if(cur===name&&msg.textContent===text)return; // nothing meaningful changed
 const a=poseArt(S.pose);cur=name;el.dataset.state=name;el.dataset.pose=a;
 if(img.dataset.art!==a){src.srcset=set(a,'webp');img.srcset=set(a,'jpg');img.src=`assets/pip/pip-${a}-320.jpg`;img.dataset.art=a}
 msg.textContent=text;msg.classList.toggle('quiet',!text);
 fig.classList.remove('pip-pop','pip-tilt','pip-fade','pip-cheer','pip-wiggle','pip-doze');if(anim){void fig.offsetWidth;fig.classList.add('pip-'+S.anim)}}
const clearOver=()=>{clearTimeout(overT);over=null};
function overlay(name,ms){clearOver();over=name;show(name);if(ms)overT=setTimeout(()=>{over=null;show(base,null,false)},ms)} // settle quietly: no new animation
const quiet=()=>fig.hidden||document.hidden;
// Called by the converter on every recalculation.
function result(r,submitted){lastR=r;base=stateFor(r,submitted);
 if(STATES[base].pri>STATES.celebrating.pri)clearOver();          // errors/duplicates interrupt anything
 else if(over==='sleepy'||over==='tangled')clearOver();            // real input ends play and sleep
 const ex=typeof window.isExample==='function'&&window.isExample();
 const clean=submitted&&r.items.length&&!r.errs.length&&STATES[base].pri<=CALM;
 if(clean&&!celebrated&&!ex){const a=alt();if(!a||!a.review){celebrated=true;if(!fig.hidden){overlay('celebrating',T.celebrate);arm();return}}}
 if(over==='celebrating')return; // let the one celebration finish, then settle to the new base
 show(base,r);arm()}
// Easter egg: tap Pip. At most once a minute; never over an error, duplicate or celebration.
let lastTangle=-Infinity;
function tangle(){const now=performance.now();
 if(over==='sleepy')wake();
 if(over==='celebrating'||STATES[base].pri>CALM||now-lastTangle<T.tangleGap||fig.hidden)return false;
 lastTangle=now;tn++;overlay('tangled',T.tangle);arm();return true}
if(hi)hi.addEventListener('click',tangle);
// Sleepy: one timer, reset on activity (throttled, passive). Paused while the tab is hidden. No polling.
let idleT=0,sleptAt=0,lastAct=0;
function arm(){clearTimeout(idleT);if(document.hidden||over==='sleepy')return;idleT=setTimeout(sleep,T.idle)}
function sleep(){if(quiet()||over||STATES[base].pri>CALM)return arm();sleptAt=performance.now();overlay('sleepy',0)}
function wake(){if(over!=='sleepy')return;const left=T.minSleep-(performance.now()-sleptAt);
 if(left>0){clearTimeout(overT);overT=setTimeout(wake,left);return}
 clearOver();show(base==='welcome'?'attentive':base,null,false);fig.classList.add('pip-fade');arm()}
function activity(){const now=performance.now();if(over==='sleepy')return wake();if(now-lastAct<T.throttle)return;lastAct=now;arm()}
['pointerdown','pointermove','keydown','scroll','wheel','touchstart'].forEach(e=>window.addEventListener(e,activity,{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(idleT);else arm()});
// Project readiness: celebrate once per real not-ready -> ready transition (first sighting only records the state).
const seen=new Map();
function projectReady(id,ready){const prev=seen.get(id);seen.set(id,!!ready);return prev===false&&!!ready&&!fig.hidden}
// Visibility preference
function vis(on,store){fig.hidden=!on;msg.hidden=!on;el.classList.toggle('pipoff',!on);el.parentElement.classList.toggle('nopip',!on);tog.setAttribute('aria-expanded',String(on));tog.textContent=on?'Hide Pip':'Show Pip';
 if(!on)clearOver();else show(base,null,false);if(store)try{localStorage.setItem(PIP_KEY,on?'shown':'hidden')}catch(e){}}
let pref='shown';try{pref=localStorage.getItem(PIP_KEY)||'shown'}catch(e){}
vis(pref!=='hidden',false);tog.onclick=()=>vis(fig.hidden,true);
window.FlossFoxPip=null;
const api={result,show,stateFor,STATES,ART,FUTURE,current:()=>cur,base:()=>base,overlay:()=>over,tangle,projectReady,KEY:PIP_KEY,
 // test hook: shorten timers (dev/testing only; no effect unless called)
 _timing:o=>{Object.assign(T,o);arm();return{...T}}};
/* global state */
if(typeof state!=='undefined'&&(state.items.length||state.errs.length)){lastR=state;base=stateFor(state,true);show(base,state)}else show('welcome');
const warm=()=>{const w=img.currentSrc&&/-(\d+)\.(webp|jpg)/.exec(img.currentSrc);const size=w?w[1]:'320',ext=w?w[2]:'webp';
 Object.values(ART).forEach(a=>{if(a!=='greeting'){const i=new Image();i.decoding='async';i.src=`assets/pip/pip-${a}-${size}.${ext}`}})};
window.addEventListener('load',()=>(window.requestIdleCallback||setTimeout)(warm,{timeout:3000}));
const inp=$('inp');inp.addEventListener('focus',()=>{if(cur==='welcome'&&!inp.value.trim())show('attentive')});
arm();
window.FlossFoxPip=api;
})();
