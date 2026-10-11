/* Pip, the Floss Fox companion. Deterministic: reads the converter's existing parse result. No network, no AI. */
(()=>{'use strict';
const PIP_KEY='flossfox.pip.v1';           // stores only "shown"/"hidden"
const SIZES=[160,320,480];
// Poses that have real artwork. Future poses fall back to an existing one until art exists.
const ART={greeting:'greeting',curious:'curious',puzzled:'puzzled',duplicates:'duplicates'};
const FUTURE={thinking:'curious',helpful:'greeting',tangled:'puzzled',proud:'greeting',celebrating:'greeting',sleepy:'greeting',peeking:'curious',teaching:'curious'};
const poseArt=p=>ART[p]||ART[FUTURE[p]]||'greeting';
// Central state map: state -> pose (asset), message, animation, priority, announce (extra polite announcement; off: the app's own status already speaks)
const STATES={
 welcome:   {pose:'greeting',  pri:10, anim:'pop',  msg:()=>"Hi! I'm Pip. Have some thread numbers? Let's get them sorted!"},
 attentive: {pose:'curious',   pri:20, anim:'tilt', msg:()=>"I'm ready when you are. Paste your numbers, then press Add my colors."},
 empty:     {pose:'curious',   pri:20, anim:'tilt', msg:()=>"The box is empty. Paste a few thread numbers first."},
 listReady: {pose:'curious',   pri:20, anim:'tilt', msg:r=>`I see ${r.items.length} color${r.items.length===1?'':'s'} in your list. Next, check which ones you already have.`},
 processing:{pose:'thinking',  pri:30, anim:'fade', msg:()=>"Let me look at your list…"}, // reserved: parsing is instant, so this is never shown (no fake delays)
 duplicate: {pose:'duplicates',pri:40, anim:'pop',  msg:r=>{const n=r.items.filter(i=>i.src.length>1).length;return n===1?'Aha! This color showed up more than once, so I combined it into one line.':`Aha! ${n} colors showed up more than once, so I combined each into one line.`}},
 error:     {pose:'puzzled',   pri:50, anim:'tilt', msg:r=>r.errs.length===1?"Hmm, I couldn't recognize that number. Want to check it?":`Hmm, I couldn't recognize ${r.errs.length} of those lines. Want to check them?`}
};
// Pick the highest-priority state that applies to a parse result (error > duplicate > processing > guidance > idle).
function stateFor(r,submitted){const c=['welcome'];
 if(r.errs.length)c.push('error');if(r.items.some(i=>i.src.length>1))c.push('duplicate');
 if(r.items.length)c.push('listReady');else if(submitted&&!r.errs.length)c.push('empty');
 return c.sort((a,b)=>STATES[b].pri-STATES[a].pri)[0]}
const $=id=>document.getElementById(id);
const el=$('pip');if(!el)return;
const img=$('pipImg'),src=$('pipSrc'),msg=$('pipMsg'),fig=$('pipFig'),tog=$('pipToggle');
let cur=null;
const set=(a)=>SIZES.map(w=>`assets/pip/pip-${a}-${w}.${'webp'} ${w}w`).join(', ');
function show(name,r){const S=STATES[name];if(!S)return;const text=S.msg(r||{items:[],errs:[]});
 if(cur===name&&msg.textContent===text)return; // nothing meaningful changed
 const a=poseArt(S.pose);cur=name;el.dataset.state=name;el.dataset.pose=a;
 if(img.dataset.art!==a){src.srcset=set(a);img.srcset=SIZES.map(w=>`assets/pip/pip-${a}-${w}.jpg ${w}w`).join(', ');img.src=`assets/pip/pip-${a}-320.jpg`;img.dataset.art=a}
 msg.textContent=text;fig.classList.remove('pip-pop','pip-tilt','pip-fade');void fig.offsetWidth;fig.classList.add('pip-'+S.anim)}
// Visibility preference
function vis(on,store){el.hidden=!on;el.parentElement.classList.toggle('nopip',!on);tog.setAttribute('aria-expanded',String(on));tog.textContent=on?'Hide Pip':'Show Pip';if(store)try{localStorage.setItem(PIP_KEY,on?'shown':'hidden')}catch(e){}}
let pref='shown';try{pref=localStorage.getItem(PIP_KEY)||'shown'}catch(e){}
vis(pref!=='hidden',false);tog.onclick=()=>vis(el.hidden,true);
window.FlossFoxPip=null;
const api={result:(r,submitted)=>show(stateFor(r,submitted),r),show,stateFor,STATES,ART,FUTURE,current:()=>cur,KEY:PIP_KEY};
/* global state */
if(typeof state!=='undefined'&&(state.items.length||state.errs.length))api.result(state,true);else show('welcome');
// Warm the cache for the other poses once the page is idle (local files only).
const warm=()=>{const w=img.currentSrc&&/-(\d+)\.(webp|jpg)/.exec(img.currentSrc);const size=w?w[1]:'320',ext=w?w[2]:'webp';
 Object.values(ART).forEach(a=>{if(a!=='greeting'){const i=new Image();i.decoding='async';i.src=`assets/pip/pip-${a}-${size}.${ext}`}})};
window.addEventListener('load',()=>(window.requestIdleCallback||setTimeout)(warm,{timeout:3000}));
// Events: only meaningful ones.
const inp=$('inp');inp.addEventListener('focus',()=>{if(cur==='welcome'&&!inp.value.trim())show('attentive')});
window.FlossFoxPip=api;
})();
