/* Pip's guided tour, Ask Pip and contextual tips. Deterministic, local only: no network, no AI, no free-text input.
   Stores only small preferences (tour status, tips on/off). Never stores the thread list. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
if(!$('convertView'))return;
const PIP=()=>window.FlossFoxPip;
const PREFIX=(PIP()&&PIP().KEY||'flossfox.pip.v1').replace(/\.pip\.v1$/,'');   // 'flossfox' or 'flossfox-dev'
const TKEY=PREFIX+'.tour.v1',HKEY=PREFIX+'.hints.v1';
const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}},put=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const tourPref=()=>{try{return JSON.parse(get(TKEY)||'null')}catch(e){return null}};
const setTourPref=o=>put(TKEY,JSON.stringify(o));
const hintsOn=()=>get(HKEY)!=='off';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const st=()=>(typeof state!=='undefined'?state:{items:[],errs:[]}); /* global state */
const dupN=()=>st().items.filter(i=>i.src.length>1).length;
const destV=()=>($('dest')||{}).value||'dmc';
const BR={dmc:'DMC',sullivans:'Sullivans',anchor:'Anchor'};
const pipImg=(pose,cls)=>`<picture><source type="image/webp" srcset="assets/pip/pip-${pose}-160.webp"><img class="${cls}" src="assets/pip/pip-${pose}-160.png" width="160" height="240" alt="" decoding="async"></picture>`;
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
/* FF-1261: with-colors closing line when results have colors OR the paste box holds recognizable DMC colors (typed, pasted or the tour's example) */
const hasColors=()=>{if(st().items.length)return true;try{const v=($('inp')||{}).value||'';return !!v.trim()&&typeof parse==='function'&&parse(v).items.length>0}catch(e){return false}};
const TOUR_SAMPLE='310\n321\n666\n699';
// affiliate sentence only for real (non-mock) approved merchants; ?fixtures=1 demo shops earn nothing
const linksOn=()=>!!(window.FlossFoxShop&&FlossFoxShop.anyRealEligible&&FlossFoxShop.anyRealEligible());
const inView=v=>!$(v).hidden;
const toConvert=()=>{if(!inView('convertView'))$('tabConvert').click()};
const TABS={convert:'tabConvert',threads:'tabThreads',projects:'tabProjects',shop:'tabShop'};const toView=v=>{if(!inView(v+'View'))$(TABS[v]).click()};

/* ---------- Step configuration (single source of truth) ---------- */
const TS=i=>((window.FF_STR||{}).tour||[])[i]||{};
const STEPS=[
 {id:'enter',title:TS(0).title||'Add your colors',view:'convert',target:()=>$('inp'),anchor:()=>document.querySelector('.hero .row'),
  pose:()=>st().errs.length?PIP().errPose(st()):'pointing',
  msg:()=>TS(0).body||"",
  more:()=>st().errs.length?`${plural(st().errs.length,'line')} couldn't be read yet. They're listed in red under Your colors.`:st().items.length?`You've added ${plural(st().items.length,'color')}. Tap Next when you're ready.`:"Then tap Add my colors. Want to practice first? I can fill in a short sample list.",
  extra:()=>st().items.length?'':`<button type="button" class="sec" data-t="example">Try an example (310, 321, 666, 699)</button>`,
  done:()=>st().items.length>0,
  help:''},
 {id:'threads',title:TS(1).title||'My threads',view:'threads',target:()=>$('thAdd'),anchor:()=>$('thAdd'),pose:()=>'organizing',msg:()=>TS(1).body||'',more:()=>'',help:''},
 {id:'project',title:TS(2).title||'Projects',view:'projects',target:()=>{const e=$('projEdit');return e&&!e.hidden?e.querySelector('.ptitle'):$('newEmpty')},anchor:()=>{const e=$('projEdit');return e&&!e.hidden?e.querySelector('.ptitle'):$('newEmpty').parentElement},pose:()=>'presenting',msg:()=>TS(2).body||'',more:()=>'',help:''},
 {id:'shop',title:TS(3).title||'Shopping',view:'shop',target:()=>{const b=$('shopBody');return b&&!b.hidden?b:null},anchor:()=>$('shopPickRow')&&!$('shopPickRow').hidden?$('shopPickRow'):$('shopCard').firstElementChild,pose:()=>'pointing',msg:()=>TS(3).body||'',more:()=>'',help:''},
 {id:'finish',title:TS(4).title||"You're all set",view:'convert',target:()=>null,anchor:()=>document.querySelector('.hero .row'),pose:()=>'goodbye',msg:()=>TS(4).body||'',more:()=>'',final:true}
];

/* ---------- Tour card ---------- */
// Pointing Pip: their paw points to their left (screen right). Mirror Pip when the target's centre is to their left on screen.
function aim(){if(!card||!tgt)return;const i=card.querySelector('.tpip');if(!i||card.dataset.pose!=='pointing')return;const a=i.getBoundingClientRect(),b=tgt.getBoundingClientRect();
 const mir=(b.left+b.right)/2<(a.left+a.right)/2;i.classList.toggle('mirror',mir);card.dataset.mirror=mir}
let idx=-1,card=null,tgt=null,returnFocus=null,readSince=0;
const live=t=>{const l=$('tourLive');if(l){l.textContent='';setTimeout(()=>{l.textContent=t},30)}};
function clearTarget(){if(tgt)tgt.classList.remove('tour-target');tgt=null}
function removeCard(){if(card)card.remove();card=null;clearTarget()}
function place(el,anchor,focus){const v=document.querySelector('#convertView:not([hidden]),#threadsView:not([hidden]),#projectsView:not([hidden]),#shopView:not([hidden])');const a=anchor&&anchor.isConnected&&anchor.offsetParent!==null?anchor:(v&&v.id!=='convertView'?v.querySelector('h2')||v.firstElementChild:document.querySelector('.hero .row'));a.insertAdjacentElement('afterend',el);
 const r=el.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 if(focus){const h=el.querySelector('h2');h.focus({preventScroll:true})}}
function render(focus){const S=STEPS[idx];if(!S)return;toView(S.view||'convert');removeCard();
 const t=S.target();const missing=!t&&!S.final;const notReady=S.ready&&!S.ready();
 if(t){t.classList.add('tour-target');tgt=t}
 const c=document.createElement('section');c.className='tourcard noprint';c.id='tourCard';c.setAttribute('aria-labelledby','tourH');c.dataset.step=S.id;let pose=S.pose();if(pose==='pointing'&&!t)pose='helpful';c.dataset.pose=pose;
 const back=idx>0?'<button type="button" class="ghost" data-t="back">Back</button>':'';
 const nextLbl=S.final?'':notReady||missing?(S.optional?'Skip this step':'Skip this step'):'Next';
 const btns=S.final?'<button type="button" class="pri" data-t="start">Start using Floss Fox</button><button type="button" class="sec" data-t="tips">Explore Ask Pip</button>':`${S.extra?S.extra():''}<button type="button" class="pri" data-t="next">${nextLbl}</button>${back}<button type="button" class="ghost" data-t="skip">Skip tour</button>`;
 c.innerHTML=`${pipImg(pose,'tpip')}<div><p class="tstep">Step ${idx+1} of ${STEPS.length}</p><h2 id="tourH" tabindex="-1">${esc(S.title)}</h2><p class="tmsg">${esc(S.msg())}</p>${S.help?`<p class="thelp hint">${esc(S.help)}</p>`:''}<p class="tmore">${S.more()}</p>${missing&&!notReady?'<p class="tmore">I can\'t find that part of the page right now, so you can skip ahead.</p>':''}</div><div class="row">${btns}${S.final?back:''}<button type="button" class="ghost" data-t="close" aria-label="Close the tour">Close</button></div>`;
 card=c;place(c,t?S.anchor():null,focus);aim();readSince=performance.now();
 setTourPref({status:'active',step:idx});if(PIP())PIP().setTour(true)}
function go(i,announce=true){idx=Math.max(0,Math.min(STEPS.length-1,i));render(true);if(announce)live(`Pip's tour, step ${idx+1} of ${STEPS.length}: ${STEPS[idx].title}`)}
function start(){closeAsk(false);removeInvite();returnFocus=document.activeElement&&document.activeElement!==document.body?document.activeElement:$('askPipBtn');toConvert();go(0)}
function end(status){const was=idx>=0;removeCard();idx=-1;if(PIP())PIP().setTour(false);setTourPref({status});if(status==='done'&&was&&PIP()&&PIP().bye)setTimeout(()=>PIP().bye(),50);
 if(was){live('Tour closed.');const f=returnFocus&&returnFocus.isConnected&&returnFocus.offsetParent!==null?returnFocus:$('inp');if(f)f.focus()}}
document.addEventListener('click',e=>{const b=e.target.closest('#tourCard [data-t]');if(!b)return;const a=b.dataset.t;
 if(a==='next')go(idx+1);else if(a==='back')go(idx-1);else if(a==='skip')end('dismissed');else if(a==='close')end(idx===STEPS.length-1?'done':'dismissed');
 else if(a==='example'){if(window.FlossFoxExample)FlossFoxExample(TOUR_SAMPLE)}
 else if(a==='start'){const r=!$('results').hidden;end('done');const h=r?$('results').querySelector('h2'):$('inp');if(r){h.tabIndex=-1}h.focus()}
 else if(a==='tips'){end('done');openAsk()}});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('askPip')&&!$('askPip').hidden){closeAsk(true);return}if(idx>=0)end('dismissed')});
// React to the real list while touring: step 1 completes on a valid list; other steps refresh their (true) text.
document.addEventListener('flossfox:result',e=>{if(idx<0)return;const S=STEPS[idx];
 
 const f=card&&card.contains(document.activeElement)?document.activeElement.dataset.t:null;render(false);if(f){const b=card.querySelector(`[data-t="${f}"]`);if(b)b.focus()}});
window.addEventListener('resize',()=>{if(card&&tgt&&!tgt.isConnected)render(false);else aim()});

/* ---------- First-visit invite / resume ---------- */
let invite=null;
function removeInvite(){if(invite)invite.remove();invite=null;$('pip').classList.remove('inviting')}
function showInvite(resume){const c=document.createElement('section');c.className='tourcard noprint';c.id='tourInvite';c.setAttribute('aria-labelledby','inviteH');
 c.innerHTML=`${pipImg('greeting','tpip')}<div><h2 id="inviteH" class="sr" tabindex="-1">${resume?'Pick up the tour?':'Meet Pip'}</h2><p class="tmsg">${resume?"Looks like we didn't finish the tour last time. I don't keep your list for the tour, so let's start again from the beginning.":((window.FF_STR||{}).tourInvite||"Hi, I'm Pip! Want me to show you around? It only takes five quick steps.")}</p></div><div class="row"><button type="button" class="pri" id="tourYes">${resume?'Restart the tour':'Show me around'}</button><button type="button" class="ghost" id="tourNo">${resume?'No thanks':"I'll explore on my own"}</button></div>`;
 c.classList.add('invite');document.querySelector('.hero .steps').insertAdjacentElement('afterend',c); /* one-Pip: the companion stays; the invite sits in the hero on every width */invite=c;
 $('tourYes').onclick=start;$('tourNo').onclick=()=>{removeInvite();setTourPref({status:'dismissed'});$('inp').focus()}}
const pref=tourPref();
if(!pref)showInvite(false);else if(pref.status==='active')showInvite(true);

/* ---------- Ask Pip ---------- */
const ask=$('askPip'),askBtn=$('askPipBtn');
function context(){
 if(idx>=0)return{key:'tour',text:`We're on step ${idx+1} of ${STEPS.length} of the tour.`};
 if(inView('projectsView'))return $('projEdit')&&!$('projEdit').hidden?{key:'project',text:'This is one of your projects. Mark each color Have enough, Need to buy or Not sure, then use Shop my list.'}:{key:'projects',text:'These are your saved projects. They stay in this browser on this device.'};
 if(FH()&&['threads','shop'].includes(scr())){const e=FH().entry(scr());if(e)return{key:scr(),text:''}}
 if(inView('settingsView'))return{key:'settings',text:''};
 if(inView('helpView'))return{key:'help',text:'This page explains how Floss Fox works and what the words mean.'};
 const s=st();
 if(s.errs.length)return{key:'errors',text:`${plural(s.errs.length,'line')} couldn't be read. ${s.errs.length===1?"It's":"They're"} listed in red under Your colors. Fix the box above and tap Add my colors again.`};
 if(dupN())return{key:'duplicates',text:`${plural(dupN(),'color')} appeared more than once in your list. I combined them and added up the skeins.`};
 if(s.items.length&&destV()!=='dmc')return{key:'alternatives',text:`You're looking at ${BR[destV()]}: ${window.FlossFoxAltFor?FlossFoxAltFor(destV()):0} of your ${plural(s.items.length,'color')} have a chart match. Charts are published guides, so colors may not be exact.`};
 if(s.items.length)return{key:'results',text:`I found ${plural(s.items.length,'color')}. Your results and shopping list are below.`};
 return{key:'empty',text:'Your list is empty. Start by typing or pasting your DMC numbers into the box.'}}
const TOPICS=[
 ['enter','How do I enter my colors?','Type or paste DMC numbers into the box on Find floss, one per line or separated by commas, then tap Add my colors. Add amounts like 310 x2, or 310 x? if you don\'t know. Blanc, Ecru and B5200 work too.'],
 ['results','What does this result mean?','Your colors lists every DMC color I recognized, with its Anchor and Sullivans chart matches. Lines I couldn\'t read appear in red so you can fix them. Repeats are combined, and amounts marked "assumed" had no number, so I counted 1 skein.'],
 ['alts','What are thread alternatives?','These are Sullivans and Anchor threads that published conversion charts match to your DMC colors. Pick one in Brand to buy on the shopping list. Chart matches are close, not exact, and metallic or variegated threads aren\'t swapped. Cost figures are rough estimates.'],
 ['shop','How do I use my shopping list?','Tick colors as you shop, or Print or Copy the list. Save it as a project to mark what you already have; then Shop my list in My Projects gives you a store checklist, and you can download a spreadsheet (CSV).'],
 ['tour','Start the tour again','']];
let lastTopic=null;
const poseFor=k=>k==='enter'?(PIP()&&PIP().needlePose?PIP().needlePose():'needle'):k==='shop'?'organizing':'thinking';
const FH=()=>window.FFHelp,scr=()=>FH()?FH().screen():'convert',offConvert=()=>idx<0&&!['convert','results'].includes(scr())||idx<0&&inView('settingsView');
/* Ask Pip card: the Fabric card pattern (heading, screen help with one primary button, Close). Live Find floss context
   (errors, duplicates, alternatives, results) and the tour's Back button still show when they apply.
   Help topics, Chat with Pip and the tips checkbox live in Help (renderHelpPip). */
const LIVE_CTX=['tour','errors','duplicates','alternatives','results'];
function renderAsk(){const c=context();const ffk=FH()?(FH().tabKey?FH().tabKey():scr()):null,ffb=ffk&&idx<0?(FH().tabBody?FH().tabBody(ffk):FH().blockHtml(ffk)):'';const live=LIVE_CTX.includes(c.key)&&c.text;
 ask.innerHTML=`<h2 id="askPipH" tabindex="-1">Ask Pip</h2><p class="actx" data-ctx="${c.key}"${live?'':' hidden'}>${esc(c.text)}</p>${ffb}
 ${idx>=0?'<div class="row"><button type="button" class="pri" data-a="resume">Back to the tour</button></div>':''}
 <div class="row"><button type="button" class="ghost" data-a="close">Close</button></div>`;
 if(ffb&&FH()){FH().bindBlock(ask,()=>closeAsk(false));if(FH().tabBind)FH().tabBind(ask,()=>closeAsk(false))}}
/* Help > Pip, your helper: the Find floss questions, Chat with Pip (pip-hybrid) and the tips checkbox (already in Help) */
const helpPip=$('helpPip');
function renderHelpPip(focusAns){if(!helpPip)return;const a=TOPICS.find(t=>t[0]===lastTopic);const list=TOPICS.filter(t=>t[0]!=='tour');
 helpPip.innerHTML=`${a?'':`<span class="apeek" aria-hidden="true">${pipImg('peeking','')}</span>`}<div class="ahead${a?'':' peek'}" data-pose="${a?(a.pose=a.pose||poseFor(a[0])):'face-icon'}">${pipImg(a?a.pose:'face-icon','')}</div><div class="atopics" role="group" aria-label="Help topics">${list.map(t=>`<button type="button" class="sec" data-a="${t[0]}"${t[0]===lastTopic?' aria-pressed="true"':''}>${esc(t[1])}</button>`).join('')}</div>
 ${a?`<div class="aans" id="askAns" tabindex="-1"><b>${esc(a[1])}</b><p>${esc(a[2])}</p></div>`:''}`;
 window.FlossFoxPipHybrid?.decorateAskPanel(helpPip);if(focusAns&&$('askAns'))$('askAns').focus()}
if(helpPip){helpPip.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;if(a==='tour'){start();return}
 lastTopic=a;const t=TOPICS.find(x=>x[0]===a);if(t)delete t.pose;renderHelpPip(true)});
 /* render only when Help is shown, so its Pip images load with that view (A1) */
 const hv=$('helpView'),lazy=()=>{if(hv&&!hv.hidden&&!helpPip.childElementCount)renderHelpPip(false)};if(hv)new MutationObserver(lazy).observe(hv,{attributes:true,attributeFilter:['hidden']});lazy()}
function openAsk(){lastTopic=null;renderAsk();ask.hidden=false;askBtn.setAttribute('aria-expanded','true');$('askPipH').focus()}
function closeAsk(focus){if(ask.hidden)return;ask.hidden=true;askBtn.setAttribute('aria-expanded','false');if(focus)askBtn.focus()}
askBtn.onclick=()=>ask.hidden?openAsk():closeAsk(true);
ask.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='close')closeAsk(true);else if(a==='tour')start();else if(a==='resume'){closeAsk(false);go(idx)}
 });
['tabConvert','tabProjects','tabHelp','tabThreads','tabShop','tabSettings'].filter(id=>$(id)).forEach(id=>$(id).addEventListener('click',()=>{if(!ask.hidden)renderAsk()}));
$('helpTour').onclick=start;

/* ---------- Contextual tips ---------- */
function setHints(on){put(HKEY,on?'on':'off');['hintsHelp'].forEach(i=>{if($(i))$(i).checked=on})}
$('hintsHelp').checked=hintsOn();$('hintsHelp').onchange=e=>setHints(e.target.checked);
const shown=new Set();let lastType=0,hT=0;
$('inp').addEventListener('input',()=>{lastType=performance.now()});
const T={start:30000,compare:5000,quiet:3000};
function tryHint(name,cond){if(shown.has(name)||!hintsOn()||idx>=0||invite||!inView('convertView')||!cond())return;
 if(performance.now()-lastType<T.quiet||document.activeElement===$('inp')&&$('inp').value.trim()){clearTimeout(hT);hT=setTimeout(()=>tryHint(name,cond),T.quiet);return}
 if(!PIP())return;if(PIP().hint(name))shown.add(name);else if(PIP().overlay()==='celebrating'){clearTimeout(hT);hT=setTimeout(()=>tryHint(name,cond),4500)}}
const startCond=()=>!$('inp').value.trim()&&!st().items.length;
let sT=setTimeout(()=>tryHint('hintStart',startCond),T.start);
document.addEventListener('flossfox:result',e=>{if(!e.detail.submitted)return;const s=st();
 if(s.items.length&&!s.errs.length&&destV()==='dmc'){clearTimeout(hT);hT=setTimeout(()=>tryHint('hintCompare',()=>st().items.length&&!st().errs.length&&destV()==='dmc'&&Math.max(FlossFoxAltFor('sullivans'),FlossFoxAltFor('anchor'))>0),T.compare)}});

window.FlossFoxTour={start,end,go,step:()=>idx,STEPS,openAsk,closeAsk,context,hintsOn,setHints,KEYS:{tour:TKEY,hints:HKEY},
 _timing:o=>{Object.assign(T,o);clearTimeout(sT);sT=setTimeout(()=>tryHint('hintStart',startCond),T.start);return{...T}}};
})();
