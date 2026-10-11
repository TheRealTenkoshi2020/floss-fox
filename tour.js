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
const pipImg=(pose,cls)=>`<picture><source type="image/webp" srcset="assets/pip/pip-${pose}-160.webp"><img class="${cls}" src="assets/pip/pip-${pose}-160.jpg" width="160" height="215" alt="" decoding="async"></picture>`;
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const TOUR_SAMPLE='310\n321\n666\n699';
const linksOn=()=>!!(window.FlossFoxLinks&&FlossFoxLinks.enabled&&FlossFoxLinks.enabled());
const inView=v=>!$(v).hidden;
const toConvert=()=>{if(!inView('convertView'))$('tabConvert').click()};

/* ---------- Step configuration (single source of truth) ---------- */
const STEPS=[
 {id:'enter',title:'Add your colors',target:()=>$('inp'),anchor:()=>document.querySelector('.hero .row'),
  pose:()=>st().errs.length?'puzzled':'curious',
  msg:()=>"First, pop your DMC thread numbers in here! You can type them or paste your whole list.",
  more:()=>st().errs.length?`${plural(st().errs.length,'line')} couldn't be read yet. They're listed in red under Your colors.`:st().items.length?`You've added ${plural(st().items.length,'color')}. Tap Next when you're ready.`:"Then tap Add my colors. Want to practise first? I can fill in a short sample list.",
  extra:()=>st().items.length?'':`<button type="button" class="sec" data-t="example">Try an example (310, 321, 666, 699)</button>`,
  done:()=>st().items.length>0,
  help:'Each line or comma-separated entry is one DMC color. Add amounts like 310 x2.'},
 {id:'results',title:'Check your results',target:()=>$('results').hidden?null:$('results'),anchor:()=>$('summary'),
  pose:()=>st().errs.length?'puzzled':dupN()?'duplicates':'helpful',
  msg:()=>"Here's what I found! You can check your colors and see if anything needs attention.",
  more:()=>{const s=st();if(!s.items.length&&!s.errs.length)return'No results yet. Go back and add your colors, or skip this step.';const b=[];
   if(s.items.length)b.push(`I recognized ${plural(s.items.length,'color')}; each row shows the DMC color and its chart matches.`);
   if(s.errs.length)b.push(`${plural(s.errs.length,'line')} couldn't be read. Fix them in the box above and add again.`);
   if(dupN())b.push(`${plural(dupN(),'color')} appeared more than once, so I combined them and added up the skeins.`);
   if(s.items.some(i=>i.stated===false||i.assumed))b.push('Amounts marked "assumed" had no number, so I counted 1 skein.');return b.join(' ')},
  ready:()=>!$('results').hidden,
  help:'Swatches show the DMC color on screen, which is only an approximation.'},
 {id:'brands',title:'Other thread brands',target:()=>$('shopcard').hidden?null:$('dest'),anchor:()=>document.querySelector('#shopcard .toggle'),
  pose:()=>'helpful',
  msg:()=>"Did you know you can look at other thread brands too? Let's explore your options!",
  more:()=>`Use <b>Brand to buy</b> to switch between DMC, Sullivans and Anchor. Matches come from published conversion charts, so colors may not be exact. Compare real thread if it matters. The cost table shows rough price estimates for each brand, before shipping; prices change, so check the store.${destV()!=='dmc'?` You're looking at ${BR[destV()]} now: ${plural(window.FlossFoxAltFor?FlossFoxAltFor(destV()):0,'color')} of ${st().items.length} have a chart match.`:''}`,
  ready:()=>!$('shopcard').hidden,optional:true,
  help:'Metallic and variegated threads are never swapped automatically.'},
 {id:'shop',title:'Your shopping list',target:()=>$('shopcard').hidden?null:$('shop'),anchor:()=>$('shop'),
  pose:()=>'helpful',
  msg:()=>"Now let's get your threads organized so they're easier to shop for!",
  more:()=>`Tick the boxes as you shop, or use <b>Print list</b> and <b>Copy as text</b> below. <b>Save project</b> keeps the list in this browser; in My projects you can mark what you have, open <b>Shop my list</b> in the store, and download a spreadsheet (CSV).${linksOn()?' Store links are optional affiliate links. You never need them to use Floss Fox.':''}`,
  ready:()=>!$('shopcard').hidden,
  help:'Nothing is uploaded: projects live on this device only.'},
 {id:'finish',title:"You're all set",target:()=>null,anchor:()=>$('shopcard').hidden?document.querySelector('.hero .row'):document.querySelector('#shopcard h2'),
  pose:()=>'celebrating',
  msg:()=>"Yay! You've got it! You're ready to start stitching!",
  more:()=>"You can take the tour again any time from Ask Pip or the Help tab.",
  final:true}
];

/* ---------- Tour card ---------- */
let idx=-1,card=null,tgt=null,returnFocus=null,readSince=0;
const live=t=>{const l=$('tourLive');if(l){l.textContent='';setTimeout(()=>{l.textContent=t},30)}};
function clearTarget(){if(tgt)tgt.classList.remove('tour-target');tgt=null}
function removeCard(){if(card)card.remove();card=null;clearTarget()}
function place(el,anchor,focus){const a=anchor&&anchor.isConnected&&anchor.offsetParent!==null?anchor:document.querySelector('.hero .row');a.insertAdjacentElement('afterend',el);
 const r=el.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 if(focus){const h=el.querySelector('h2');h.focus({preventScroll:true})}}
function render(focus){const S=STEPS[idx];if(!S)return;toConvert();removeCard();
 const t=S.target();const missing=!t&&!S.final;const notReady=S.ready&&!S.ready();
 if(t){t.classList.add('tour-target');tgt=t}
 const c=document.createElement('section');c.className='tourcard noprint';c.id='tourCard';c.setAttribute('aria-labelledby','tourH');c.dataset.step=S.id;c.dataset.pose=S.pose();
 const back=idx>0?'<button type="button" class="ghost" data-t="back">Back</button>':'';
 const nextLbl=S.final?'':notReady||missing?(S.optional?'Skip this step':'Skip this step'):'Next';
 const btns=S.final?'<button type="button" class="pri" data-t="start">Start using Floss Fox</button><button type="button" class="sec" data-t="tips">Explore more tips</button>':`${S.extra?S.extra():''}<button type="button" class="pri" data-t="next">${nextLbl}</button>${back}<button type="button" class="ghost" data-t="skip">Skip tour</button>`;
 c.innerHTML=`${pipImg(S.pose(),'tpip')}<div><p class="tstep">Step ${idx+1} of ${STEPS.length}</p><h2 id="tourH" tabindex="-1">${esc(S.title)}</h2><p class="tmsg">${esc(S.msg())}</p><p class="tmore">${S.more()}</p>${missing&&!notReady?'<p class="tmore">I can\'t find that part of the page right now, so you can skip ahead.</p>':''}</div><div class="row">${btns}${S.final?back:''}<button type="button" class="ghost" data-t="close" aria-label="Close the tour">Close</button></div>`;
 card=c;place(c,t?S.anchor():null,focus);readSince=performance.now();
 setTourPref({status:'active',step:idx});if(PIP())PIP().setTour(true)}
function go(i,announce=true){idx=Math.max(0,Math.min(STEPS.length-1,i));render(true);if(announce)live(`Pip's tour, step ${idx+1} of ${STEPS.length}: ${STEPS[idx].title}`)}
function start(){closeAsk(false);removeInvite();returnFocus=document.activeElement&&document.activeElement!==document.body?document.activeElement:$('askPipBtn');toConvert();go(0)}
function end(status){const was=idx>=0;removeCard();idx=-1;if(PIP())PIP().setTour(false);setTourPref({status});
 if(was){live('Tour closed.');const f=returnFocus&&returnFocus.isConnected&&returnFocus.offsetParent!==null?returnFocus:$('inp');if(f)f.focus()}}
document.addEventListener('click',e=>{const b=e.target.closest('#tourCard [data-t]');if(!b)return;const a=b.dataset.t;
 if(a==='next')go(idx+1);else if(a==='back')go(idx-1);else if(a==='skip')end('dismissed');else if(a==='close')end(idx===STEPS.length-1?'done':'dismissed');
 else if(a==='example'){if(window.FlossFoxExample)FlossFoxExample(TOUR_SAMPLE)}
 else if(a==='start'){const r=!$('results').hidden;end('done');const h=r?$('results').querySelector('h2'):$('inp');if(r){h.tabIndex=-1}h.focus()}
 else if(a==='tips'){end('done');openAsk()}});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('askPip')&&!$('askPip').hidden){closeAsk(true);return}if(idx>=0)end('dismissed')});
// React to the real list while touring: step 1 completes on a valid list; other steps refresh their (true) text.
document.addEventListener('flossfox:result',e=>{if(idx<0)return;const S=STEPS[idx];
 if(S.id==='enter'&&S.done()&&e.detail.submitted&&!st().errs.length){go(1);return}
 const f=card&&card.contains(document.activeElement)?document.activeElement.dataset.t:null;render(false);if(f){const b=card.querySelector(`[data-t="${f}"]`);if(b)b.focus()}});
window.addEventListener('resize',()=>{if(card&&tgt&&!tgt.isConnected)render(false)});

/* ---------- First-visit invite / resume ---------- */
let invite=null;
function removeInvite(){if(invite)invite.remove();invite=null;$('pip').classList.remove('inviting')}
function showInvite(resume){const c=document.createElement('section');c.className='tourcard noprint';c.id='tourInvite';c.setAttribute('aria-labelledby','inviteH');
 c.innerHTML=`${pipImg('greeting','tpip')}<div><h2 id="inviteH" class="sr" tabindex="-1">${resume?'Pick up the tour?':'Meet Pip'}</h2><p class="tmsg">${resume?"Looks like we didn't finish the tour last time. Your list isn't kept for the tour, so let's start it again from the beginning.":"Hi! I'm Pip! Want me to show you around? It'll be quick!"}</p></div><div class="row"><button type="button" class="pri" id="tourYes">${resume?'Restart the tour':'Show me around'}</button><button type="button" class="ghost" id="tourNo">${resume?'No thanks':"I'll explore myself"}</button></div>`;
 c.classList.add('invite');if(matchMedia('(max-width:879px)').matches){$('pip').before(c);$('pip').classList.add('inviting')}else document.querySelector('.hero .steps').insertAdjacentElement('afterend',c);invite=c;
 $('tourYes').onclick=start;$('tourNo').onclick=()=>{removeInvite();setTourPref({status:'dismissed'});$('inp').focus()}}
const pref=tourPref();
if(!pref)showInvite(false);else if(pref.status==='active')showInvite(true);

/* ---------- Ask Pip ---------- */
const ask=$('askPip'),askBtn=$('askPipBtn');
function context(){
 if(idx>=0)return{key:'tour',text:`We're on step ${idx+1} of ${STEPS.length} of the tour.`};
 if(inView('projectsView'))return $('projEdit')&&!$('projEdit').hidden?{key:'project',text:'This is one of your projects. Mark each color Have enough, Need to buy or Not sure, then use Shop my list.'}:{key:'projects',text:'These are your saved projects. They stay in this browser on this device.'};
 if(inView('helpView'))return{key:'help',text:'This page explains how Floss Fox works and what the words mean.'};
 const s=st();
 if(s.errs.length)return{key:'errors',text:`${plural(s.errs.length,'line')} couldn't be read. ${s.errs.length===1?"It's":"They're"} listed in red under Your colors. Fix the box above and tap Add my colors again.`};
 if(dupN())return{key:'duplicates',text:`${plural(dupN(),'color')} appeared more than once in your list. I combined them and added up the skeins.`};
 if(s.items.length&&destV()!=='dmc')return{key:'alternatives',text:`You're looking at ${BR[destV()]}: ${window.FlossFoxAltFor?FlossFoxAltFor(destV()):0} of your ${plural(s.items.length,'color')} have a chart match. Charts are published guides, so colors may not be exact.`};
 if(s.items.length)return{key:'results',text:`I found ${plural(s.items.length,'color')}. Your results and shopping list are below.`};
 return{key:'empty',text:'Your list is empty. Start by typing or pasting your DMC numbers into the box.'}}
const TOPICS=[
 ['enter','How do I enter my colors?','Type or paste DMC numbers into the box on Add colors, one per line or separated by commas, then tap Add my colors. Add amounts like 310 x2, or 310 x? if you don\'t know. Blanc, Ecru and B5200 work too.'],
 ['results','What does this result mean?','Your colors lists every DMC color I recognized, with its Anchor and Sullivans chart matches. Lines I couldn\'t read appear in red so you can fix them. Repeats are combined, and amounts marked "assumed" had no number, so I counted 1 skein.'],
 ['alts','What are thread alternatives?','Other brands, Sullivans and Anchor, that published charts match to your DMC colors. Choose one in Brand to buy on the shopping list. Chart matches are close, not exact, and metallic or variegated threads aren\'t swapped. Cost figures are rough estimates.'],
 ['shop','How do I use my shopping list?','Tick colors as you shop, or Print or Copy the list. Save it as a project to mark what you already have; then Shop my list in My projects gives you a store checklist, and you can download a spreadsheet (CSV).'],
 ['tour','Start the tour again','']];
let lastTopic=null;
function renderAsk(){const c=context();const a=TOPICS.find(t=>t[0]===lastTopic);
 ask.innerHTML=`<div class="ahead">${pipImg('helpful','')}<div><h2 id="askPipH" tabindex="-1">Ask Pip</h2><p class="actx" data-ctx="${c.key}">${esc(c.text)}</p></div></div>
 ${idx>=0?'<div class="row"><button type="button" class="pri" data-a="resume">Back to the tour</button></div>':''}
 <div class="atopics" role="group" aria-label="Help topics">${TOPICS.map(t=>`<button type="button" class="sec" data-a="${t[0]}"${t[0]===lastTopic?' aria-pressed="true"':''}>${esc(t[1])}</button>`).join('')}</div>
 ${a?`<div class="aans" id="askAns" tabindex="-1"><b>${esc(a[1])}</b><p>${esc(a[2])}</p></div>`:''}
 <div class="row"><label class="hintpref"><input type="checkbox" id="hintsAsk"${hintsOn()?' checked':''}> Show Pip's tips while I work</label><button type="button" class="ghost" data-a="close">Close</button></div>`;
 $('hintsAsk').onchange=e=>setHints(e.target.checked)}
function openAsk(){lastTopic=null;renderAsk();ask.hidden=false;askBtn.setAttribute('aria-expanded','true');$('askPipH').focus()}
function closeAsk(focus){if(ask.hidden)return;ask.hidden=true;askBtn.setAttribute('aria-expanded','false');if(focus)askBtn.focus()}
askBtn.onclick=()=>ask.hidden?openAsk():closeAsk(true);
ask.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
 if(a==='close')closeAsk(true);else if(a==='tour')start();else if(a==='resume'){closeAsk(false);go(idx)}
 else{lastTopic=a;renderAsk();$('askAns').focus()}});
['tabConvert','tabProjects','tabHelp'].forEach(id=>$(id).addEventListener('click',()=>{if(!ask.hidden)renderAsk()}));
$('helpTour').onclick=start;

/* ---------- Contextual tips ---------- */
function setHints(on){put(HKEY,on?'on':'off');['hintsAsk','hintsHelp'].forEach(i=>{if($(i))$(i).checked=on})}
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
