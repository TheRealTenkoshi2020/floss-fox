/* One Pip per page (dev only). The single companion follows the reader section by section.
   Phones (<880px): slim bar docked at the bottom, page gets matching bottom padding, hidden while typing or while a dialog is open.
   Wide (>=880px): side column beside the active section, never above the tab bar.
   Section lines are APPROVED by Pixel (see pip-follow/STRINGS_FOR_PIXEL.md). Section changes are visual only (not announced);
   events keep their existing single polite announcement. Reads the Pip level, never writes storage. */
(function(){'use strict';
const KEY='flossfox.pip.v1',LEVEL_KEY='flossfox.pipLevel.v1';
const STR={ // APPROVED lines (Pixel, Oct 25). null = keep the tab's existing approved line, change pose only.
 'pf.threads':null,
 'pf.planCard':'One list for all your projects, so nothing gets bought twice.',
 'pf.projList':null,
 'pf.projEdit':null, // the approved readiness line (Ready to stitch etc.) stays
 'pf.patCheck':'I compared your pattern with your list. Here\'s what I found.',
 'pf.skein':'Tell me your fabric and stitch count, and I\'ll estimate how much floss you need.',
 'pf.backup':'Download a backup so your projects stay safe if this browser gets cleared.',
 'pf.shop':null,
 'pf.settings':null,
 'pf.help':null,
 'pf.fcCalc':null,
 'pf.fcOthers':'Here\'s your design on other fabric counts, side by side.',
 'pf.fcTips':'A few tips for measuring and cutting your fabric.'};
// section -> existing pose (no new art anywhere, including Shopping)
const SECTIONS=[['#thCard','organizing','pf.threads'],['#planCard','presenting','pf.planCard'],['#projListCard','organizing','pf.projList'],
 ['#projEdit','presenting','pf.projEdit'],['#patCheck','pattern-reader','pf.patCheck'],['#pSkein','thinking','pf.skein'],['#backupBox','postmaster','pf.backup'],
 ['#shopCard','pointing','pf.shop'],['#settingsView .card','cozy-companion','pf.settings'],['#helpView .card.help','helpful','pf.help'],
 ['#fc .card:not(.others):not(.tips)','measuring-fabric','pf.fcCalc'],['#fcOthers','discovery','pf.fcOthers'],['#fcTips','needle','pf.fcTips']];
const $=id=>document.getElementById(id),doc=document.documentElement,body=document.body;
const P=()=>window.FlossFoxPip;
function level(){const p=P();if(p&&p.level)return p.level();let h=null,s=null;try{h=localStorage.getItem(KEY);s=localStorage.getItem(LEVEL_KEY)}catch(e){}
 if(h==='hidden'||s==='off')return'off';return['chatty','important','quiet'].includes(s)?s:'important'}
const wide=matchMedia('(min-width:880px)'),rm=matchMedia('(prefers-reduced-motion: reduce)');
let comp=null,isFabric=false,homeG=null,homeNext=null;
// Build the companion. index: the hero Pip becomes it. fabric: the Ask Pip slot becomes it.
function mount(){if(comp&&comp.isConnected)return true;
 const hero=$('pip');
 if(hero){comp=hero;const g=hero.parentElement;if(g&&g.classList.contains('herogrid')){homeG=g;homeNext=hero.nextElementSibling;g.classList.add('pipmoved')}
  const host=document.querySelector('.wrap')||body;host.after?host.after(hero):body.append(hero)}
 else{const slot=$('ffFabricPip');if(!slot)return false;isFabric=true;comp=document.createElement('aside');comp.id='pipFollow';comp.setAttribute('aria-label','Pip');comp.append(slot);
  const fig=document.createElement('div');fig.className='pipfig';const im=slot.querySelector('picture');fig.append(im);slot.prepend(fig);
  const row=document.querySelector('.ffaskrow');(document.querySelector('.wrap')||body).after(comp);if(row)row.classList.add('pipmoved')}
 comp.classList.add('pipc');body.classList.add('pipone');
 const mn=document.createElement('button');mn.type='button';mn.className='pipmin';mn.id='pipMinBtn';mn.setAttribute('aria-label','Minimize Pip');mn.setAttribute('aria-expanded','true');mn.textContent='\u2013';
 const face=document.createElement('button');face.type='button';face.className='pipface';face.id='pipFaceBtn';face.setAttribute('aria-label','Show Pip helper');
 face.innerHTML='<img src="assets/pip/pip-face-icon-64.png" width="44" height="44" alt="">';
 mn.onclick=()=>{comp.classList.add('pipminned');mn.setAttribute('aria-expanded','false');face.focus();pad()};face.onclick=()=>{comp.classList.remove('pipminned');mn.setAttribute('aria-expanded','true');mn.focus();pad()};
 comp.append(mn,face);
 new ResizeObserver(pad).observe(comp);observe();return true}
// Visual refresh: on a tab that shows the hero (Find floss), the hero Pip is the companion, so it sits in the hero and there is no bar.
// Same element, same controls (Minimize, Hide Pip, Pip level); only where it is drawn changes.
// ci005-77: on phones the companion is an inline note at the top of the open view (never a bar over content).
function inlineSpot(){const w=document.querySelector('.wrap');if(!w)return null;if(isFabric){const c=w.querySelector('.card');return c?[c.parentElement,c]:null}
 const v=[...w.querySelectorAll(':scope>div[id$="View"]')].find(x=>!x.hidden);return v?[v,v.firstElementChild]:null}
function placeInline(){if(!comp)return false;body.classList.toggle('pipc-inline',!wide.matches);if(wide.matches)return false;const sp=inlineSpot();if(!sp)return false;const [par,ref]=sp;
 if(comp.parentElement!==par||comp.nextElementSibling!==ref){if(ref===comp)return true;const f=comp.contains(document.activeElement)?document.activeElement:null;par.insertBefore(comp,ref&&ref.parentElement===par?ref:null);if(f)f.focus({preventScroll:true})}return true}
let viewMO=null;function watchViews(){if(viewMO)return;const w=document.querySelector('.wrap');if(!w||!window.MutationObserver)return;viewMO=new MutationObserver(()=>dock());[...w.querySelectorAll(':scope>div[id$="View"]')].forEach(v=>viewMO.observe(v,{attributes:true,attributeFilter:['hidden']}))}
function dock(){if(!comp)return;watchViews();if(isFabric||!homeG){placeInline();return}const cv=$('convertView'),inHero=!!(cv&&!cv.hidden&&homeG.isConnected&&homeG.getClientRects().length);
 if(inHero&&comp.parentElement!==homeG){const f=comp.contains(document.activeElement)?document.activeElement:null;homeG.insertBefore(comp,homeNext&&homeNext.parentElement===homeG?homeNext:homeG.firstChild);if(f)f.focus({preventScroll:true})}
 else if(!inHero&&!placeInline()&&(comp.parentElement===homeG||(comp.parentElement&&comp.parentElement.closest('.wrap')))){const f=comp.contains(document.activeElement)?document.activeElement:null;(document.querySelector('.wrap')||body).after(comp);if(f)f.focus({preventScroll:true})}
 if(!inHero)body.classList.toggle('pipc-inline',!wide.matches);else body.classList.remove('pipc-inline');
 if(body.classList.contains('pipc-hero')!==inHero){body.classList.toggle('pipc-hero',inHero);const p=P();if(p&&p.retheme)p.retheme()}homeG.classList.toggle('pipmoved',!inHero)}
const heroMode=()=>body.classList.contains('pipc-hero');
// bottom padding on phones so nothing stays under the bar (last button reachable)
function pad(){if(!comp)return;dock();const h=heroMode()||wide.matches||body.classList.contains('pipc-inline')||comp.hidden||body.classList.contains('pipc-away')?0:comp.getBoundingClientRect().height;doc.style.setProperty('--pipc-h',Math.ceil(h)+'px')}
// wide: line up with the active section, but never above the tab bar / header
let active=null;
function place(){if(!comp)return;if(!wide.matches||heroMode()){comp.style.transform='';return}
 const hd=document.querySelector('.tabs')||document.querySelector('header');const minTop=hd?Math.max(16,hd.getBoundingClientRect().bottom+12):16;
 const t=active?active.getBoundingClientRect().top:minTop,h=comp.offsetHeight,max=innerHeight-h-16;
 comp.style.transform='translate3d(0,'+Math.round(Math.max(minTop,Math.min(t,max)))+'px,0)'}
// IntersectionObserver: the section crossing the reading line (40% from the top) is active
// most-visible section wins (share of the viewport it fills), debounced so boundaries never flicker
let io=null,seen=new Set();const vis=new Map();let pickT=0;
function pick(){clearTimeout(pickT);pickT=setTimeout(()=>{let best=null,bv=0;for(const [el,v] of vis)if(v>bv&&el.isConnected&&el.getClientRects().length){best=el;bv=v}
 if(best&&best!==active)activate(best)},rm.matches?0:140)}
function observe(){if(io)io.disconnect();vis.clear();io=new IntersectionObserver(es=>{for(const e of es)vis.set(e.target,e.isIntersecting?e.intersectionRect.height/innerHeight:0);pick()},{threshold:[0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]});
 for(const [sel] of SECTIONS)document.querySelectorAll(sel).forEach(el=>{if(!el.dataset.pipSection){el.dataset.pipSection=sel}io.observe(el)})}
function activate(el){if(!el.getClientRects().length)return;active=el;const s=SECTIONS.find(x=>x[0]===el.dataset.pipSection);if(!s)return;
 const lv=level();if(lv==='off')return;const line=STR[s[2]],first=!seen.has(s[2]);seen.add(s[2]);
 const text=line&&(lv==='chatty'||(lv==='important'&&first))?line:'';
 const p=P();if(p&&p.section)p.section(s[1],text);else if(isFabric)fabricPose(s[1]);place()}
function fabricPose(pose){const im=comp&&comp.querySelector('.pipfig img');if(!im)return;const src=`assets/pip/pip-${pose}-160.png`;if(im.getAttribute('src')!==src){im.setAttribute('src',src);const so=comp.querySelector('.pipfig source');if(so)so.setAttribute('srcset',`assets/pip/pip-${pose}-160.webp`)}}
// events from other modules route to the one Pip: their own art is hidden by CSS, the companion takes the pose
const EVSEL='.pipb2-reading,.pipb2-checkOk,.pipb2-fixSheet,.pipb2-backup,#pCel,.pat-pipknot';
function evFrom(n){const d=n.dataset&&n.dataset.pose;if(d)return d;const i=n.querySelector&&n.querySelector('img[src*="assets/pip/"]');const m=i&&/pip-([a-z-]+?)-\d+\./.exec(i.getAttribute('src'));return m?m[1]:null}
function onAdded(n){if(n.nodeType!==1||!comp||comp.contains(n))return;const hits=n.matches(EVSEL)?[n]:[...n.querySelectorAll(EVSEL)];
 for(const h of hits){const pose=evFrom(h);if(!pose)continue;const p=P();if(p&&p.event)p.event(pose,h.id==='pCel'?4000:5000);else if(isFabric)fabricPose(pose)}}
// keyboard and dialogs: get out of the way on phones
const TYPE='input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]):not([type=range]),textarea,select,[contenteditable=true]';
// phones, guided tour: the tour card speaks for Pip (its own Pip shows), the bar steps aside so it never sits over the card
function want(){const a=document.activeElement,typing=!wide.matches&&a&&a.matches&&a.matches(TYPE);
 const tour=!wide.matches&&!!document.getElementById('tourCard');body.classList.toggle('pipc-tour',tour);
 return !!(typing||tour||document.querySelector('dialog[open],#ffConfirm:not([hidden]),#ptSheet:not([hidden])'))}
function away(){const on=want();clearTimeout(backT);
 if(on||!body.classList.contains('pipc-away')){body.classList.toggle('pipc-away',on);pad();return}
 // coming back: wait until the tap that ended typing has landed, so the bar never slides under a finger mid-click
 const back=()=>{if(down){backT=setTimeout(back,60);return}body.classList.toggle('pipc-away',want());pad()};
 if(down)backT=setTimeout(back,16);else back()}
let backT=0,down=false;addEventListener('pointerdown',()=>{down=true},true);addEventListener('pointerup',()=>{setTimeout(()=>{down=false},0)},true);addEventListener('click',()=>{down=false;if(body.classList.contains('pipc-away')&&!want()){clearTimeout(backT);setTimeout(away,0)}},true);addEventListener('pointercancel',()=>{down=false},true);
let q=0;const mo=new MutationObserver(ms=>{for(const m of ms)m.addedNodes&&m.addedNodes.forEach(onAdded);if(q)return;q=requestAnimationFrame(()=>{q=0;if(!mount())return;dock();fabricOff();if(SECTIONS.some(([sel])=>[...document.querySelectorAll(sel)].some(e=>!e.dataset.pipSection)))observe();softSwap();away();place()})});
function softSwap(){if(!comp)return;const im=comp.querySelector('.pipfig img');if(!im||im.dataset.pfw)return;im.dataset.pfw='1';
 new MutationObserver(()=>{if(rm.matches)return;im.classList.remove('pf-in');void im.offsetWidth;im.classList.add('pf-in')}).observe(im,{attributes:true,attributeFilter:['src']});
 const m=comp.querySelector('.pipbubble,.ffpipline');if(m)new MutationObserver(()=>{if(rm.matches)return;m.classList.remove('pf-bub');void m.offsetWidth;m.classList.add('pf-bub')}).observe(m,{childList:true,characterData:true,subtree:true})}
// fabric.html has no Show Pip control of its own: at Off the companion simply is not there (index keeps its Show Pip pill)
function fabricOff(){let so=null;try{so=localStorage.getItem(LEVEL_KEY)}catch(e){}body.classList.toggle('piplevel-off',so==='off');body.classList.toggle('piplevel-quiet',so==='quiet');pad();if(isFabric&&comp){const off=level()==='off';if(comp.hidden!==off){comp.hidden=off;pad()}}}
addEventListener('storage',fabricOff);document.addEventListener('change',e=>{if(e.target&&e.target.name==='pipLevel')setTimeout(fabricOff,0)},true);
function start(){mo.observe(doc,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});mount();dock();fabricOff();softSwap();away();place()}
document.addEventListener('focusin',away);document.addEventListener('focusout',()=>setTimeout(away,0));
addEventListener('scroll',()=>{if(wide.matches)requestAnimationFrame(place)},{passive:true});addEventListener('resize',()=>{pad();place()});
(wide.addEventListener?wide.addEventListener('change',()=>{pad();place()}):0);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.FlossFoxPipFollow={STR,SECTIONS,level,active:()=>active,place,pad};
})();
