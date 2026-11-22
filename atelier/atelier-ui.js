/* Floss Fox 3.9 Atelier, Stage B–D: Workbasket, search, Display settings (Resume, seasonal Pip, Appearance), Reset display settings.
   Progressive enhancement loaded after every existing script. If anything it needs is missing, it does nothing.
   Safety rules:
   - Reads projects and threads only through FlossFoxProjects / FlossFoxThreadsUI and never changes them.
   - Navigation only: tab buttons, showView(), open(id) after checking the id still exists.
   - Writes only its own preference key (<prefix>.atelier.v1), and only after the visitor turns on Resume where I was
     (or presses Reset). Every write is read back; a failed write is reported, never shown as saved.
   - Search runs in memory on this device. Queries are never stored, logged or sent anywhere (no GoatCounter path or title).
   - User text (project names, notes, storage spots) is only ever set with textContent.
   - Strings come from atelier-copy.js (Pixel's DRAFT copy, pending Myke). */
(function(){'use strict';
if(window.FlossFoxAtelier)return; // idempotent: loading twice adds nothing
const P=window.FlossFoxProjects,T=window.FlossFoxThreadsUI,PR=window.FlossFoxAtelierPreferences,SR=window.FlossFoxAtelierSearch,PA=window.FlossFoxAtelierPalette,CP=window.FlossFoxAtelierCopy;
if(!P||!P.KEY||!P.showView||!PR||!SR||!CP||typeof document==='undefined')return;
// Placeholders until Pixel supplies the string (flagged in FF39_CHECKLIST.md). Pixel's copy wins as soon as the key exists.
const PH={'search.res.whiteSibling':'A different color from DMC {code}'}; // leftover Stage C placeholder; not yet in Pixel's copy.json
const $=id=>document.getElementById(id),t=(k,v,n)=>CP.has(k)?CP.t(k,v,n):String(PH[k]||'').replace(/\{(\w+)\}/g,(m,x)=>v&&x in v?String(v[x]):m);
const CAT=(()=>{try{return typeof DMC==='object'&&DMC?DMC:null}catch(e){return null}})(); // index.html catalog (script-scoped const)
function el(tag,attrs,text){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v===null||v===undefined||v===false)continue;if(k==='class')e.className=v;else if(k==='hidden')e.hidden=!!v;else e.setAttribute(k,v===true?'':String(v))}if(text!==undefined&&text!==null)e.textContent=String(text);return e}
const PKEY=PR.keyFor(P.KEY);
let LS=null;try{LS=window.localStorage}catch(e){}
// ---------- preferences (read-only until the visitor acts) ----------
let pref={ok:false,reason:'unavailable',data:null};
function loadPref(){pref=LS?PR.load(LS,PKEY):{ok:false,reason:'storage-unavailable',data:null};return pref}
loadPref();
const P0=()=>pref.ok?pref.data:PR.normalize(null).data;
function savePref(patch){if(!LS||!pref.ok)return{ok:false,reason:pref.reason||'unavailable'};const r=PR.save(LS,PKEY,{...pref.data,...patch});if(r.ok)pref={ok:true,data:r.data,stored:true};return r}
// ---------- live data (read only) ----------
function projects(){try{const s=P._store();return s&&Array.isArray(s.projects)?s.projects:null}catch(e){return null}}
const real=()=>(projects()||[]).filter(p=>p&&!p.demo);
function threads(){try{const d=T&&T.data&&T.data();return d&&d.threads&&typeof d.threads==='object'?d.threads:{}}catch(e){return{}}}
const hasSaved=()=>real().length>0||Object.keys(threads()).length>0;
const STATUS=SR.STATUS;
const cname=n=>String(n||'').replace(/\b(vy|dk|lt|md|ul)\b/gi,m=>({vy:'very',dk:'dark',lt:'light',md:'medium',ul:'ultra'}[m.toLowerCase()])); // same wording as My threads
const trim=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trimEnd()+'\u2026':s};
function fmtDate(iso){const d=new Date(iso);if(isNaN(d))return'';try{return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch(e){return iso.slice(0,10)}}
function current(){for(const k of PR.TABS){const b=$(tabId(k));if(b&&b.getAttribute('aria-pressed')==='true')return k}return 'convert'}
function tabId(k){return 'tab'+k.charAt(0).toUpperCase()+k.slice(1)}
function go(view){const b=$(tabId(view));if(b&&!b.hidden){b.click();return true}try{P.showView(view);return true}catch(e){return false}}
function openProjectSafe(id,focusNote){const p=real().find(x=>x.id===id);if(!p)return false;P.open(id);if(focusNote)setTimeout(()=>{const n=$('pLeftOff');if(n){try{n.scrollIntoView({block:'center'})}catch(e){}n.focus({preventScroll:true})}},0);return true}

// ---------- Workbasket ----------
let wbTab=null,wbView=null;
function mountWorkbasket(){
 const nav=document.querySelector('nav.tabs'),conv=$('convertView');if(!nav||!conv)return;
 wbTab=el('button',{type:'button',id:'tabWorkbasket',class:'prim ffa-tab','aria-pressed':'false',hidden:true});
 wbTab.append(el('span',{'aria-hidden':'true'},'\uD83E\uDDFA'),' ',el('span',{class:'lg'},t('wb.nav')),el('span',{class:'sm'},t('wb.nav')));
 wbTab.addEventListener('click',()=>{P.showView('workbasket');renderWB()});
 nav.insertBefore(wbTab,nav.firstChild);
 wbView=el('div',{id:'workbasketView',class:'ffa-wbview',hidden:true});conv.parentNode.insertBefore(wbView,conv);
 syncTab();
}
function syncTab(){if(wbTab)wbTab.hidden=!hasSaved()&&current()!=='workbasket'}
function stat(n,k,cls){const d=el('div',{class:'ffa-stat'+(cls?' '+cls:'')});d.append(el('b',null,String(n)),el('span',null,t(k,{n},n).replace(/^\d+\s/,'')));d.setAttribute('aria-label',t(k,{n},n));return d}
function quick(){const q=el('nav',{class:'ffa-quick','aria-labelledby':'ffWbQ'});q.append(el('h3',{id:'ffWbQ'},t('wb.quick.title')));
 const g=el('div',{class:'ffa-quickgrid'});
 const b=(k,f)=>{const x=el('button',{type:'button',class:'ffa-qbtn'},t(k));x.addEventListener('click',f);return x};
 g.append(b('wb.quick.find',()=>{go('convert');const i=$('inp');if(i)i.focus()}),b('wb.quick.threads',()=>go('threads')),b('wb.quick.shop',()=>go('shop')));
 const f=el('a',{class:'ffa-qbtn',href:'fabric.html'},t('wb.quick.fabric'));g.append(f);q.append(g);return q}
function palette(p){if(!PA)return null;let v;try{v=PA.strip(p.items||[],CAT||{})}catch(e){return null}
 if(!v.total)return el('p',{class:'ffa-mut ffa-small'},t('palette.empty'));
 const ul=el('ul',{class:'ffa-strip','aria-label':t('palette.aria',{name:trim(p.name,28),list:v.swatches.map(s=>s.label).join(', ')})});
 v.swatches.forEach(s=>{const li=el('li',{class:'ffa-floss'+(s.rgb?'':' none')+(s.outline?' edge':''),role:'img','aria-label':t(s.rgb?'swatch.aria':'swatch.aria.none',{brand:s.brand,code:s.code}),title:s.label});if(s.rgb)li.style.setProperty('--c',s.rgb);ul.append(li)});
 if(v.remaining){ul.append(el('li',{class:'ffa-more','aria-label':t('palette.more.aria',{n:v.remaining},v.remaining)},t('palette.more',{n:v.remaining})))}
 return ul}
function renderWB(){if(!wbView)return;syncTab();if(wbView.hidden&&current()!=='workbasket')return;
 const box=el('section',{class:'card ffa-wb','aria-labelledby':'ffWbH'}),all=projects(),ps=real(),th=threads(),owned=Object.keys(th).length;
 const active=ps.filter(p=>p.status!=='done').sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')))[0]||null;
 box.append(el('p',{class:'ffa-eyebrow'},t('wb.nav')),el('h2',{id:'ffWbH',tabindex:'-1'},t('wb.title')),el('p',{class:'ffa-lead'},active?t('wb.sub.active'):t('wb.sub.general')));
 if(all===null||(P.canSave&&!P.canSave())){box.append(el('p',{class:'warn',role:'alert'},t('wb.unreadable')))}
 else if(active){const c=el('article',{class:'ffa-active','aria-labelledby':'ffWbP'});
  c.append(el('p',{class:'ffa-label'},t('wb.active.label')),el('h3',{id:'ffWbP'},trim(active.name,100)),el('p',{class:'ffa-meta'},t('wb.active.meta',{status:STATUS[active.status]||STATUS.planning,date:fmtDate(active.updated)})));
  const pal=palette(active);if(pal)c.append(pal);
  const note=el('div',{class:'ffa-note'});note.append(el('b',null,t('wb.leftOff.label')));
  const lo=typeof active.leftOff==='string'&&active.leftOff.trim()?active.leftOff:'';note.append(el('p',{class:lo?'':'ffa-mut'},lo?trim(lo,240):t('wb.leftOff.none')));c.append(note);
  let P2=null;try{P2=P.plan(active)}catch(e){P2=null}
  if(P2&&Array.isArray(P2.lines)){const s=el('div',{class:'ffa-stats'}),toBuy=P2.lines.filter(l=>!l.bought).length,aw=P2.lines.filter(l=>l.bought).length,cf=Array.isArray(P2.checkFirst)?P2.checkFirst.length:0;
   s.append(stat(toBuy,'wb.stat.toBuy'),stat(cf,'wb.stat.checkFirst'));if(aw){const a=el('div',{class:'ffa-stat'});a.append(el('b',null,String(aw)),el('span',null,t('wb.stat.awaiting',{n:aw}).replace(/^\d+\s/,'')));a.setAttribute('aria-label',t('wb.stat.awaiting',{n:aw}));s.append(a)}c.append(s)}
  else c.append(el('p',{class:'ffa-mut ffa-small'},t('wb.stat.unknown')));
  const row=el('div',{class:'ffa-row'});const cont=el('button',{type:'button',class:'pri',id:'ffWbContinue'},t('wb.btn.continue'));cont.addEventListener('click',()=>{if(!openProjectSafe(active.id,true))renderWB()});row.append(cont);
  if(!lo){const an=el('button',{type:'button',class:'sec',id:'ffWbAddNote'},t('wb.btn.addNote'));an.addEventListener('click',()=>{if(!openProjectSafe(active.id,true))renderWB()});row.append(an)}
  c.append(row);box.append(c)}
 else if(ps.length){const c=el('div',{class:'ffa-empty'});c.append(el('h3',null,t('wb.done.title')),el('p',null,t('wb.done.body')));const r=el('div',{class:'ffa-row'});
  const a=el('button',{type:'button',class:'pri'},t('wb.done.btn'));a.addEventListener('click',()=>{go('convert');const i=$('inp');if(i)i.focus()});
  const b=el('button',{type:'button',class:'sec'},t('wb.done.btn2'));b.addEventListener('click',()=>go('projects'));r.append(a,b);c.append(r);box.append(c)}
 else{const c=el('div',{class:'ffa-empty'});c.append(el('h3',null,t('wb.zero.title')),el('p',null,t('wb.zero.body')));const a=el('button',{type:'button',class:'pri'},t('wb.zero.btn'));a.addEventListener('click',()=>{go('convert');const i=$('inp');if(i)i.focus()});c.append(a);box.append(c)}
 const side=el('section',{class:'card ffa-side','aria-label':t('wb.quick.title')});
 const o=el('p',{class:'ffa-owned'});o.append(el('b',null,t('wb.stat.owned',{n:owned},owned)),' ',el('span',{class:'ffa-mut ffa-small'},t('wb.stat.owned.hint')));side.append(o,quick());
 wbView.replaceChildren(el('div',{class:'ffa-wbgrid'}));wbView.firstChild.append(box,side)}

// ---------- universal search ----------
let sBtn=null,sPanel=null,sIn=null,sList=null,sLive=null,sNote=null,sDetail=null,opener=null,index=null,dirty=true,active=-1,opts=[],timer=0;
function mountSearch(){
 const head=document.querySelector('header'),nav=document.querySelector('nav.tabs');if(!head||!nav)return;
 sBtn=el('button',{type:'button',id:'ffSearchBtn',class:'ffa-searchbtn noprint','aria-label':t('search.aria'),'aria-haspopup':'dialog','aria-expanded':'false','aria-controls':'ffSearch'});
 {const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),c=document.createElementNS(NS,'circle'),l=document.createElementNS(NS,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  [['cx','11'],['cy','11'],['r','7'],['fill','none'],['stroke-width','2.2']].forEach(a=>c.setAttribute(a[0],a[1]));
  [['d','M16.5 16.5L21 21'],['stroke-width','2.4'],['stroke-linecap','round']].forEach(a=>l.setAttribute(a[0],a[1]));svg.append(c,l);sBtn.append(svg)}
 sBtn.append(el('span',{class:'ffa-lbl'},t('search.nav')));
 const ask=$('askPipBtn');head.insertBefore(sBtn,ask||null);
 sPanel=el('section',{id:'ffSearch',class:'card ffa-search noprint',role:'dialog','aria-modal':'false','aria-labelledby':'ffSearchH',hidden:true});
 const top=el('div',{class:'ffa-shead'});top.append(el('h2',{id:'ffSearchH',class:'ffa-sh'},t('search.label')));
 const x=el('button',{type:'button',class:'ffa-x','aria-label':t('search.close')},'\u00d7');x.addEventListener('click',()=>closeSearch(true));top.append(x);
 const f=el('div',{class:'ffa-sfield'});
 sIn=el('input',{type:'search',id:'ffSearchIn',autocomplete:'off',spellcheck:'false',maxlength:'120',placeholder:t('search.placeholder'),role:'combobox','aria-expanded':'false','aria-controls':'ffSearchList','aria-autocomplete':'list','aria-labelledby':'ffSearchH','aria-describedby':'ffSearchHint'});
 f.append(sIn);
 const hint=el('p',{id:'ffSearchHint',class:'ffa-hint'});hint.append(el('span',null,t('search.hint')+' '),el('span',null,t('search.privacy')));
 sList=el('div',{id:'ffSearchList',role:'listbox','aria-label':t('search.label'),class:'ffa-results'});
 sNote=el('p',{class:'ffa-hint',id:'ffSearchNote'});sDetail=el('div',{class:'ffa-detail',id:'ffSearchDetail',role:'region','aria-live':'polite','aria-label':t('search.group.colors'),hidden:true});
 sLive=el('p',{class:'sr',role:'status','aria-live':'polite',id:'ffSearchLive'});
 sPanel.append(top,f,hint,el('p',{class:'ffa-keys'},t('search.keys')),sNote,sList,sDetail,sLive);
 nav.parentNode.insertBefore(sPanel,nav.nextSibling);
 sBtn.addEventListener('click',()=>sPanel.hidden?openSearch():closeSearch(true));
 sIn.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,120)});
 sIn.addEventListener('keydown',onKey);
 sPanel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSearch(true)}});
 document.addEventListener('keydown',e=>{if(!(e.key==='k'||e.key==='K')||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;const a=document.activeElement,tg=a&&a.tagName;
  if(a!==sIn&&(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||(a&&a.isContentEditable)))return; // never steal a shortcut while typing elsewhere
  if(document.documentElement.classList.contains('ff-landing'))return;const c=$('ffConfirm');if(c&&!c.hidden)return;e.preventDefault();openSearch()});
}
function openSearch(){if(!sPanel)return;opener=document.activeElement;sPanel.hidden=false;document.body.classList.add('ffa-searching');sBtn.setAttribute('aria-expanded','true');sIn.focus();run()}
function closeSearch(restore){if(!sPanel||sPanel.hidden)return;sPanel.hidden=true;document.body.classList.remove('ffa-searching');sBtn.setAttribute('aria-expanded','false');sIn.setAttribute('aria-expanded','false');sIn.removeAttribute('aria-activedescendant');sDetail.hidden=true;
 if(restore){const o=opener&&document.contains(opener)?opener:sBtn;try{o.focus()}catch(e){}}opener=null}
function getIndex(){if(index&&!dirty)return index;const ps=projects();index=SR.build({projects:ps||[],threads:threads(),catalog:CAT});dirty=false;return index}
const WH=['DMC:BLANC','DMC:WHITE','DMC:B5200'];
function run(){if(!sPanel||sPanel.hidden)return;let ix;sNote.textContent='';sNote.className='ffa-hint';
 try{ix=getIndex()}catch(e){sNote.textContent=t('search.stale');sNote.className='warn';ix=index||[]}
 const q=sIn.value,r=SR.search(ix,q,{limit:8});sList.replaceChildren();opts=[];active=-1;sDetail.hidden=true;
 if(!r.query){sNote.textContent=t('search.empty');sIn.setAttribute('aria-expanded','false');sIn.removeAttribute('aria-activedescendant');sLive.textContent='';return}
 if(!r.total){const n=el('div',{class:'ffa-none'});n.append(el('p',{class:'ffa-nonet'},t('search.none.title',{query:trim(q,40)})),el('p',null,t('search.none.body')));sList.append(n);sIn.setAttribute('aria-expanded','false');announce(0);return}
 const th=threads();
 const group=(rows,k,make)=>{if(!rows.length)return;const gid='ffsg-'+k.split('.').pop(),g=el('div',{role:'group','aria-labelledby':gid,class:'ffa-sgroup'});g.append(el('h3',{id:gid,role:'presentation'},t(k)));rows.forEach(row=>{const o=make(row);o.id='ffsr-'+opts.length;o.setAttribute('role','option');o.setAttribute('aria-selected','false');o.addEventListener('click',()=>activate(row));o.addEventListener('mousemove',()=>setActive(opts.indexOf(o),false));opts.push(o);g.append(o)});sList.append(g)};
 const own=code=>{const e=th[code];if(!e)return t('search.res.notOwned');let s=t('search.res.owned',{n:e.n},e.n);if(e.partial)s+=' \u00b7 '+t('search.res.partial');return s};
 group(r.colors,'search.group.colors',row=>{const o=el('div',{class:'ffa-res'}),isD=row.brand.toUpperCase()==='DMC',hex=isD&&CAT&&CAT[row.exactCode]&&/^#[0-9a-f]{6}$/i.test(CAT[row.exactCode].hex)?CAT[row.exactCode].hex:null;
  const sw=el('span',{class:'ffa-floss'+(hex?'':' none')+(hex&&/^#f/i.test(hex)?' edge':''),'aria-hidden':'true'});if(hex)sw.style.setProperty('--c',hex);
  const m=el('span',{class:'ffa-rmeta'});m.append(el('b',null,isD?(row.subtitle?t('search.res.color',{brand:row.brand,code:row.exactCode,name:cname(row.subtitle)}):`${row.brand} ${row.exactCode}`):`${row.brand} ${row.exactCode}`),el('span',null,isD?own(row.exactCode):t('search.res.chart',{dmc:row.dmc.slice(0,3).join(', ')})));if(row.whiteSibling){o.classList.add('ffa-sib');m.append(el('span',{class:'ffa-sibnote'},t('search.res.whiteSibling',{code:row.whiteSibling})))}o.append(sw,m);return o});
 group(r.threads,'search.group.threads',row=>{const o=el('div',{class:'ffa-res'}),e=th[row.exactCode]||{};const m=el('span',{class:'ffa-rmeta'});m.append(el('b',null,row.label));let s=own(row.exactCode);if(row.location)s+=' \u00b7 '+t('search.res.location',{location:row.location});m.append(el('span',null,s));o.append(m);return o});
 group(r.projects,'search.group.projects',row=>{const o=el('div',{class:'ffa-res'}),m=el('span',{class:'ffa-rmeta'}),p=real().find(x=>x.id===row.key),qq=SR.canon(q).toUpperCase(),usesCode=p&&!SR.canon(p.name).includes(SR.canon(q))&&(p.items||[]).some(i=>String(i.code).toUpperCase()===qq);
  m.append(el('b',null,row.label),el('span',null,usesCode?t('search.res.project',{status:STATUS[p.status]||STATUS.planning,code:qq}):(STATUS[p&&p.status]||STATUS.planning)));o.append(m);return o});
 const notes=[];if(r.colors.filter(c=>WH.includes(c.key)).length>=2)notes.push(t('search.whites'));
 if(r.colors.length>=8||r.threads.length>=8||r.projects.length>=8){if(r.total>r.colors.length+r.threads.length+r.projects.length)notes.push(t('search.limit',{n:8}))}
 sNote.textContent=notes.join(' ');sIn.setAttribute('aria-expanded','true');announce(opts.length)}
function announce(n){clearTimeout(announce.t);announce.t=setTimeout(()=>{sLive.textContent=t('search.count',{n},n)},450)}
function setActive(i,scroll){if(!opts.length)return;if(active>=0&&opts[active])opts[active].setAttribute('aria-selected','false');active=(i+opts.length)%opts.length;const o=opts[active];o.setAttribute('aria-selected','true');sIn.setAttribute('aria-activedescendant',o.id);if(scroll!==false)try{o.scrollIntoView({block:'nearest'})}catch(e){}}
function onKey(e){if(e.key==='ArrowDown'){e.preventDefault();setActive(active+1)}else if(e.key==='ArrowUp'){e.preventDefault();setActive(active<0?opts.length-1:active-1)}
 else if(e.key==='Home'&&opts.length&&e.ctrlKey){e.preventDefault();setActive(0)}
 else if(e.key==='Enter'){if(!opts.length)return;e.preventDefault();const o=opts[active<0?0:active];o.click()}}
function activate(row){
 if(row.type==='project'){if(real().some(p=>p.id===row.key)){closeSearch(false);openProjectSafe(row.key,false)}else{dirty=true;run()}return}
 if(row.type==='thread'||(row.type==='color'&&row.brand.toUpperCase()==='DMC'&&threads()[row.exactCode])){closeSearch(false);go('threads');
  setTimeout(()=>{const li=[...document.querySelectorAll('#thList li[data-code]')].find(x=>x.dataset.code===row.exactCode&&!x.classList.contains('demo'));
   if(li){li.classList.add('ffa-found');try{li.scrollIntoView({block:'center'})}catch(e){}const f=li.querySelector('button,input');if(f)f.focus({preventScroll:true});setTimeout(()=>li.classList.remove('ffa-found'),2400)}},60);return}
 // A color you don't own: show what the catalog knows, right here. Nothing is added or changed.
 sDetail.replaceChildren();const d=sDetail,isD=row.brand.toUpperCase()==='DMC',e=isD&&CAT?CAT[row.exactCode]:null;
 d.append(el('h3',null,`${row.brand} ${row.exactCode}`));
 if(isD){if(e&&e.name)d.append(el('p',null,cname(e.name)));d.append(el('p',null,t('search.res.notOwned')));if(e&&Array.isArray(e.anchor)&&e.anchor.length)d.append(el('p',{class:'ffa-mut ffa-small'},'Anchor '+e.anchor.join(' / ')));}
 else d.append(el('p',null,t('search.res.chart',{dmc:row.dmc.join(', ')})));
 d.append(el('p',{class:'ffa-mut ffa-small'},t('swatch.tip')));d.hidden=false}
function markDirty(){dirty=true;if(sPanel&&!sPanel.hidden)run()}

// ---------- Resume where I was + Reset display settings (Settings) ----------
let resumeResult='not-run';
function applyTheme(theme){if(window.FlossFoxAtelierTheme)FlossFoxAtelierTheme.apply(theme);syncThemeRadios(theme)}
function syncThemeRadios(theme){document.querySelectorAll('#ffTheme input[name=ffTheme]').forEach(r=>{r.checked=r.value===(theme||'system')})}
function mountSettings(){const sv=$('settingsView');if(!sv)return;const card=sv.querySelector('.card')||sv;
 const box=el('div',{class:'ffa-prefs',id:'ffAtelierPrefs'});
 const fs=el('fieldset',{class:'ffa-theme',id:'ffTheme'});
 fs.append(el('legend',{id:'ffThemeL'},t('theme.title')));
 const curTheme=P0().theme||'system';
 [['system','theme.system','theme.system.hint'],['morning','theme.morning','theme.morning.hint'],['forest','theme.forest','theme.forest.hint'],['moon','theme.moon','theme.moon.hint']].forEach(([val,lk,hk])=>{
  const id='ffTheme-'+val;const lab=el('label',{class:'ffa-theme-opt',for:id});
  const inp=el('input',{type:'radio',name:'ffTheme',id,value:val});inp.checked=curTheme===val;inp.disabled=!pref.ok;
  const txt=el('span',{class:'ffa-theme-txt'});txt.append(el('span',{class:'ffa-theme-name'},t(lk)),el('span',{class:'hint'},t(hk)));
  lab.append(inp,txt);fs.append(lab);
 });
 const lab=el('label',{class:'ffa-check'});const cb=el('input',{type:'checkbox',id:'ffResume','aria-describedby':'ffResumeHint'});cb.checked=!!P0().rememberPlace;cb.disabled=!pref.ok;
 lab.append(cb,' ',t('pref.resume'));const hint=el('p',{class:'hint',id:'ffResumeHint'},t('pref.resume.hint'));
 const st=el('p',{class:'hint',role:'status','aria-live':'polite',id:'ffPrefStatus'});
 const rb=el('button',{type:'button',class:'sec',id:'ffPrefReset'},t('pref.reset'));
 const sl=el('label',{class:'ffa-check'});const sc=el('input',{type:'checkbox',id:'ffSeasonal','aria-describedby':'ffSeasonalHint ffSeasonalState'});sc.checked=!!P0().seasonalPip;sc.disabled=!pref.ok;
 sl.append(sc,' ',t('pref.seasonal'));const sh=el('p',{class:'hint',id:'ffSeasonalHint'},t('pref.seasonal.hint'));
 const art=(window.FlossFoxSeasonalArt&&Array.isArray(FlossFoxSeasonalArt.available))?FlossFoxSeasonalArt.available:[]; // no seasonal art shipped yet
 const ss=el('p',{class:'hint ffa-small',id:'ffSeasonalState'},art.length?'':t('pref.seasonal.state.none'));
 sc.addEventListener('change',()=>{const want=sc.checked;st.textContent=t('common.saving');const r=savePref({seasonalPip:want});if(r.ok){st.textContent=t('common.saved');document.dispatchEvent(new CustomEvent('ff:atelier-seasonal',{detail:{on:want}}))}else{sc.checked=!want;st.textContent=t('common.notSaved')}});
 const tl=el('label',{class:'ffa-check'});const tc=el('input',{type:'checkbox',id:'ffTimer','aria-describedby':'ffTimerHint',role:'switch'});tc.checked=!!P0().sessionTimer;tc.disabled=!pref.ok;
 tl.append(tc,' ',t('pref.timer'));const th=el('p',{class:'hint',id:'ffTimerHint'},t('pref.timer.hint'));
 tc.addEventListener('change',()=>{const want=tc.checked;st.textContent=t('common.saving');const r=savePref({sessionTimer:want});if(r.ok){st.textContent=t('common.saved');document.dispatchEvent(new CustomEvent('ff:atelier-timer',{detail:{on:want}}));if(window.FlossFoxAtelier&&FlossFoxAtelier.paintSession){const pS=$('pSession'),id=P.openId&&P.openId();if(pS&&id){const pr=(P._store&&P._store().projects||[]).find(x=>x.id===id);FlossFoxAtelier.paintSession(pS,pr||{id})}} }else{tc.checked=!want;st.textContent=t('common.notSaved')}});
 box.append(el('h3',{id:'ffPrefH'},t('pref.title')),fs,lab,hint,sl,sh,ss,tl,th,rb,st);box.setAttribute('aria-labelledby','ffPrefH');card.append(box);
 fs.addEventListener('change',e=>{const inp=e.target;if(!inp||inp.name!=='ffTheme')return;const want=inp.value,prev=P0().theme||'system';
  st.textContent=t('common.saving');const r=savePref({theme:want});applyTheme(want);
  if(r.ok)st.textContent=t('theme.saved');else{st.textContent=t('theme.notSaved')}});
 cb.addEventListener('change',()=>{const want=cb.checked;st.textContent=t('common.saving');const r=savePref({rememberPlace:want,lastTab:current()==='settings'?'settings':current(),lastProjectId:null});
  if(r.ok)st.textContent=t('common.saved');else{cb.checked=!want;st.textContent=t('common.notSaved')}});
 rb.addEventListener('click',async()=>{const C=window.FlossFoxConfirm;const yes=C&&C.ask?await C.ask({title:t('pref.reset.title'),body:t('pref.reset.body'),keep:t('pref.reset.no'),go:t('pref.reset.yes'),pose:'thinking'}):window.confirm(t('pref.reset.title'));if(!yes)return;
  const r=LS?PR.reset(LS,PKEY):{ok:false};if(r.ok){loadPref();lowOnly=false;libApply();cb.checked=false;cb.disabled=!pref.ok;sc.checked=!!P0().seasonalPip;sc.disabled=!pref.ok;const tmr=$('ffTimer');if(tmr){tmr.checked=!!P0().sessionTimer;tmr.disabled=!pref.ok}applyTheme('system');st.textContent=t('pref.reset.done');document.dispatchEvent(new CustomEvent('ff:atelier-prefs-reset'));document.dispatchEvent(new CustomEvent('ff:atelier-timer',{detail:{on:!!P0().sessionTimer}}))}else st.textContent=t('common.notSaved')});
}
// Records the last tab / open project ONLY while Resume where I was is on.
function record(){const d=P0();if(!pref.ok||!d.rememberPlace)return;const v=current();if(v==='workbasket'&&!hasSaved())return;let pid=null;
 if(v==='projects'){try{const id=P.openId&&P.openId(),pe=$('projEdit');if(id&&pe&&!pe.hidden&&real().some(p=>p.id===id))pid=id}catch(e){}}
 if(d.lastTab===v&&d.lastProjectId===pid)return;savePref({lastTab:v,lastProjectId:pid})}
// Precedence: safety/storage problem > URL hash > landing / Start here / tour > Resume where I was > default.
function resume(){const d=P0();
 if(!pref.ok||!d.rememberPlace)return'off';
 if(location.hash&&location.hash!=='#')return'hash';
 if((P.canSave&&!P.canSave())||(T&&T.canSave&&!T.canSave()))return'safety';
 const R=$('restoreResult');if(R&&!R.hidden)return'safety';
 if(document.documentElement.classList.contains('ff-landing'))return'onboarding'; // landing shown: Start here, Resume off, or nothing saved
 if(window.FlossFoxStartHere&&FlossFoxStartHere.fresh&&FlossFoxStartHere.fresh())return'onboarding';
 const tc=$('tourCard');if(tc&&!tc.hidden)return'onboarding';
 const v=d.lastTab;if(!v||v==='convert')return'default';
 if(v==='projects'&&d.lastProjectId){if(openProjectSafe(d.lastProjectId,false))return'project';go('projects');const lc=$('projListCard');if(lc){const n=el('p',{class:'hint ffa-missing',role:'status'},t('wb.missing'));lc.insertBefore(n,lc.firstChild);const rm=()=>{n.remove();document.removeEventListener('click',rm,true)};setTimeout(()=>document.addEventListener('click',rm,true),0)}return'missing'}
 if(v==='workbasket'&&!hasSaved())return'default';
 return go(v)?'tab':'default'}
// ---------- My threads: collection view, sort, Running low, low-stock suggestions (FF39-11, FF39-12, decision 6) ----------
// Display only: reorders and hides rows that threads.js drew; never edits a thread except through the explicit
// "Add to shopping list" (restock flag, verified by threads.js setRestock). Not now is remembered for this page visit only.
const notNow=new Set();let lowOnly=false,libBusy=false;
const hueOf=hex=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return 999;const n=parseInt(m[1],16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
 if(d<.08)return 400+(1-mx)*10; /* neutrals last, light to dark */let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;return h<0?h+360:h};
const famKey=c=>{const e=CAT&&CAT[c];return hueOf(e&&e.hex)};
const byCodeA=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true});
function libApply(){const L=$('thList');if(!L||libBusy)return;libBusy=true;try{const d=P0(),th=threads();
 L.classList.remove('ffa-view-list','ffa-view-grid','ffa-view-shelf');L.classList.add('ffa-view-'+d.collectionView);
 const own=[...L.children].filter(li=>li.classList.contains('th')&&!li.classList.contains('demo')&&th[li.dataset.code]);
 const k=d.collectionSort,cmp={code:(a,b)=>byCodeA(a,b),amount:(a,b)=>th[a].n-th[b].n||byCodeA(a,b),family:(a,b)=>famKey(a)-famKey(b)||byCodeA(a,b),
  location:(a,b)=>{const x=SR.displayLocation(th[a].storage),y=SR.displayLocation(th[b].storage);return(!x)-(!y)||x.localeCompare(y,undefined,{numeric:true})||byCodeA(a,b)},
  recent:(a,b)=>String(th[b].updated||'').localeCompare(String(th[a].updated||''))||byCodeA(a,b)}[k]||((a,b)=>byCodeA(a,b));
 const sortedRows=own.slice().sort((x,y)=>cmp(x.dataset.code,y.dataset.code));
 if(sortedRows.some((r,i)=>r!==own[i])){const fe=document.activeElement,frag=document.createDocumentFragment();sortedRows.forEach(r=>frag.append(r));L.insertBefore(frag,L.querySelector('.demohead'));if(fe&&fe!==document.activeElement&&L.contains(fe))fe.focus({preventScroll:true})}
 const thr=d.lowStockThreshold;let shown=0;own.forEach(li=>{const low=th[li.dataset.code].n<=thr;li.classList.toggle('ffa-low',low);li.classList.toggle('ffa-lowhide',lowOnly&&!low);if(!li.hidden&&!(lowOnly&&!low))shown++});
 L.querySelectorAll('.demohead, li.demo').forEach(li=>li.classList.toggle('ffa-lowhide',lowOnly));
 const nm=$('ffLowNone');if(nm)nm.hidden=!(lowOnly&&own.length&&!shown);
 renderSuggest(th,thr);syncLibTools()}finally{libBusy=false}}
function syncLibTools(){const d=P0();document.querySelectorAll('#ffLibTools [data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===d.collectionView)));
 const so=$('ffLibSort');if(so)so.value=d.collectionSort;const lo=$('ffLowOnly');if(lo)lo.setAttribute('aria-pressed',String(lowOnly));const tn=$('ffLowN');if(tn&&document.activeElement!==tn)tn.value=String(d.lowStockThreshold);
 const lh=$('ffLowHint');if(lh)lh.textContent=t('lib.low.hint',{n:d.lowStockThreshold},d.lowStockThreshold);
 const tools=$('ffLibTools');if(tools)tools.hidden=!Object.keys(threads()).length}
function libSave(patch,focusId){const st=$('ffLibStatus');const r=savePref(patch);if(!r.ok&&st)st.textContent=pref.ok?t('common.notSaved'):'';libApply();const f=focusId&&$(focusId);if(f)f.focus()}
function mountLibrary(){const L=$('thList'),tools0=$('thTools');if(!L||!tools0)return;
 const box=el('div',{id:'ffLibTools',class:'ffa-libtools noprint'});
 const vg=el('div',{role:'group','aria-label':t('lib.view.aria'),class:'ffa-seg'});['list','grid','shelf'].forEach(v=>{const b=el('button',{type:'button',class:'sec','data-view':v,id:'ffLibV-'+v},t('lib.view.'+v));b.onclick=()=>libSave({collectionView:v},'ffLibV-'+v);vg.append(b)});
 const sl=el('label',{for:'ffLibSort'},t('lib.sort'));const so=el('select',{id:'ffLibSort'});['code','amount','family','location','recent'].forEach(k=>so.append(el('option',{value:k},t('lib.sort.'+k))));so.onchange=()=>libSave({collectionSort:so.value},'ffLibSort');
 const lo=el('button',{type:'button',class:'sec',id:'ffLowOnly','aria-pressed':'false'},t('lib.filter.low'));lo.onclick=()=>{lowOnly=!lowOnly;libApply();lo.focus()};
 const ll=el('label',{for:'ffLowN'},t('lib.low.setting'));const ln=el('input',{type:'number',id:'ffLowN',min:'0',max:'20',step:'1',inputmode:'numeric',class:'qbox','aria-describedby':'ffLowHint'});
 ln.onchange=()=>{const v=ln.value.trim();if(!/^\d{1,2}$/.test(v)||+v>20){ln.value=String(P0().lowStockThreshold);const st=$('ffLibStatus');if(st)st.textContent='Use a whole number from 0 to 20. Nothing changed.';return}libSave({lowStockThreshold:+v},'ffLowN')};
 const lu=el('span',null,t('lib.low.setting.unit'));const hint=el('p',{class:'hint',id:'ffLowHint'},t('lib.low.hint',{n:P0().lowStockThreshold},P0().lowStockThreshold));
 const st=el('p',{class:'hint',id:'ffLibStatus',role:'status','aria-live':'polite'});
 const r1=el('div',{class:'ffa-librow'});r1.append(vg,sl,so);const r2=el('div',{class:'ffa-librow'});r2.append(lo,ll,ln,lu);box.append(r1,r2,hint,st);
 const sug=el('div',{id:'ffLowSuggest',class:'ffa-suggest',hidden:true});
 tools0.after(box);box.after(sug);const none=el('p',{class:'hint',id:'ffLowNone',hidden:true},t('lib.low.none'));L.after(none);
 new MutationObserver(()=>libApply()).observe(L,{childList:true});libApply()}
function renderSuggest(th,thr){const box=$('ffLowSuggest');if(!box)return;const T=window.FlossFoxThreadsUI;
 const list=Object.keys(th).filter(c=>th[c].n<=thr&&!th[c].restock&&!notNow.has(c)).sort((a,b)=>th[a].n-th[b].n||byCodeA(a,b));
 const keepMsg=box.querySelector('.ffa-sugmsg');box.replaceChildren();if(keepMsg)box.append(keepMsg);
 if(!list.length||!T||!T.setRestock){box.hidden=!keepMsg;return}box.hidden=false;
 list.slice(0,3).forEach(c=>{const e=th[c],card=el('div',{class:'ffa-sug',role:'group','aria-labelledby':'ffSugH-'+c});
  card.append(el('span',{class:'ffa-tag'},t('lib.suggest.tag')),el('h3',{id:'ffSugH-'+c},t('lib.suggest.title')),el('p',null,t('lib.suggest.body',{n:e.n,brand:'DMC',code:c},e.n).replace('DMC '+c,'DMC\u00a0'+c)));
  const add=el('button',{type:'button',class:'pri',id:'ffSugAdd-'+c},t('lib.suggest.add')),no=el('button',{type:'button',class:'ghost',id:'ffSugNo-'+c},t('lib.suggest.later'));
  add.onclick=()=>{const cur=threads()[c];let msg;if(cur&&cur.restock)msg=t('lib.suggest.dupe',{brand:'DMC',code:c}).replace('DMC '+c,'DMC\u00a0'+c);else{const r=T.setRestock(c,true);msg=r.ok?t('lib.suggest.added',{brand:'DMC',code:c}).replace('DMC '+c,'DMC\u00a0'+c):t('common.notSaved')}
   sugMsg(msg);libApply();const f=$('ffSugMsg');if(f)f.focus()};
  no.onclick=()=>{notNow.add(c);libApply();const nx=box.querySelector('.ffa-sug .pri');(nx||$('thSearch')||document.body).focus()};
  const row=el('div',{class:'ffa-acts'});row.append(add,no);card.append(row);box.append(card)})}
function sugMsg(text){const box=$('ffLowSuggest');if(!box)return;let m=$('ffSugMsg');if(!m){m=el('p',{class:'hint ffa-sugmsg',id:'ffSugMsg',role:'status','aria-live':'polite',tabindex:'-1'});box.prepend(m)}m.textContent=text;box.hidden=false}
// ---------- Shop: Restock for My threads (decision 6). Lists colors the user flagged; only an explicit Remove changes anything. ----------
function mountRestock(){const sv=$('shopView');if(!sv)return;const card=el('section',{class:'card ffa-restock',id:'ffRestock','aria-labelledby':'ffRestockH',hidden:true});sv.insertBefore(card,sv.firstChild);renderRestock()}
function renderRestock(msg){const card=$('ffRestock');if(!card)return;const th=threads(),T=window.FlossFoxThreadsUI,codes=Object.keys(th).filter(c=>th[c].restock).sort(byCodeA);
 card.replaceChildren();if(!codes.length&&!msg){card.hidden=true;return}card.hidden=false;
 card.append(el('h2',{id:'ffRestockH'},t('restock.title')),el('p',{class:'hint'},t('restock.sub')));
 const st=el('p',{class:'hint',id:'ffRestockMsg',role:'status','aria-live':'polite',tabindex:'-1'},msg||'');card.append(st);
 if(!codes.length){card.append(el('p',{class:'hint'},t('restock.none')));return}
 const ul=el('ul',{class:'ffa-restocklist'});codes.forEach(c=>{const e=th[c],li=el('li',{'data-code':c});const hex=CAT&&CAT[c]&&/^#[0-9a-f]{6}$/i.test(CAT[c].hex)?CAT[c].hex:null;
  const sw=el('span',{class:'ffa-floss'+(hex?'':' none'),'aria-hidden':'true'});if(hex)sw.style.setProperty('--c',hex);
  const m=el('span',{class:'ffa-rmeta'});m.append(el('b',null,'DMC '+c+(CAT&&CAT[c]?' \u00b7 '+cname(CAT[c].name):'')),el('span',null,t('search.res.owned',{n:e.n},e.n)));
  const rm=el('button',{type:'button',class:'ghost',id:'ffRsRm-'+c,'aria-label':t('restock.remove')+': DMC '+c},t('restock.remove'));
  rm.onclick=()=>{const r=T&&T.setRestock?T.setRestock(c,false):{ok:false};renderRestock(r.ok?t('restock.removed',{brand:'DMC',code:c}):t('common.notSaved'));const f=$('ffRestockMsg');if(f)f.focus()};
  li.append(sw,m,rm);ul.append(li)});card.append(ul);
 if((window.FLOSS_FOX_ENV==='preview'||window.FLOSS_FOX_DIRECT_LINKS===true)&&window.FlossFoxSkeinPreviewUI){
  const items=codes.map(c=>{const li=ul.querySelector('li[data-code="'+CSS.escape(c)+'"]');return li?{li,need:{brand:'dmc',code:c,family:'six-strand-cotton',pack:'single-skein',qty:1,assumed:false,disputed:false}}:null}).filter(Boolean);
  if(items.length)FlossFoxSkeinPreviewUI.buyToggle(items,{prefix:'ffRs',list:ul})}}
// ---------- wiring ----------
function boot(){mountWorkbasket();mountSearch();mountSettings();mountLibrary();mountRestock();
 const obs=new MutationObserver(()=>{syncTab();if(current()==='workbasket')renderWB();record()});
 PR.TABS.forEach(k=>{const b=$(tabId(k));if(b)obs.observe(b,{attributes:true,attributeFilter:['aria-pressed']})});const pe=$('projEdit');if(pe)obs.observe(pe,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('ff:data-saved',e=>{markDirty();syncTab();if(current()==='workbasket')renderWB();if(!e.detail||e.detail.area==='threads'){libApply();if(!$('ffRestock')||!$('ffRestockMsg')||!$('ffRestockMsg').textContent)renderRestock()}});
 window.addEventListener('storage',e=>{if(!e.key||/^flossfox/.test(e.key)){markDirty();if(e.key===PKEY)loadPref()}});
 if(location.hash==='#workbasket')renderWB();
 const run1=()=>{resumeResult=resume();if(current()==='workbasket')renderWB()};
 if(document.readyState==='complete')setTimeout(run1,0);else addEventListener('load',()=>setTimeout(run1,0));
}

function rgbCatalog(){try{return typeof DMC==='object'&&DMC?DMC:CAT}catch(e){return CAT}}
function paintProjects(listEl,projects){
  const L=listEl||$('projList'),card=$('projListCard');
  if(!L||!card)return;
  let bar=$('ffaViewBar');
  if(!bar){
    bar=el('div',{id:'ffaViewBar',class:'ffa-viewbar',role:'group','aria-label':'Project list layout'});
    const mk=(v,key)=>{const b=el('button',{type:'button',class:'sec ffa-viewbtn','data-view':v,'aria-pressed':'false'},t(key)||v);b.addEventListener('click',()=>{const r=savePref({projectsView:v});if(!r.ok)return;if(window.FlossFoxProjects&&typeof FlossFoxProjects.refreshList==='function')FlossFoxProjects.refreshList();else paintProjects(L,projects)});return b};
    bar.append(mk('list','journal.view.list'),mk('gallery','journal.view.gallery'));
    const h2=card.querySelector('h2');
    if(h2){
      let row=$('ffaViewRow');
      if(!row){row=el('div',{class:'ffa-viewrow',id:'ffaViewRow'});h2.replaceWith(row);row.append(h2,bar);}
      else if(bar.parentNode!==row)row.append(bar);
    }else card.insertBefore(bar,L);
  }
  const view=(P0()&&P0().projectsView==='gallery')?'gallery':'list';
  bar.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===view;b.setAttribute('aria-pressed',on?'true':'false');b.classList.toggle('pri',on);b.classList.toggle('sec',!on)});
  L.classList.toggle('ffa-gallery',view==='gallery');
  if(view!=='gallery'){
    L.querySelectorAll('.ffa-cover').forEach(n=>n.remove());
    L.querySelectorAll('.ffa-gcard').forEach(n=>n.classList.remove('ffa-gcard'));
    return;
  }
  const Pal=window.FlossFoxAtelierPalette,src=rgbCatalog();
  (projects||[]).forEach(p=>{
    const btn=L.querySelector('[data-open="'+CSS.escape(p.id)+'"]');
    if(!btn)return;
    const li=btn.closest('li');if(!li||li.classList.contains('storeline')||li.classList.contains('empty'))return;
    li.classList.add('ffa-gcard');
    let cover=li.querySelector('.ffa-cover');
    if(!cover){cover=el('div',{class:'ffa-cover'});li.insertBefore(cover,li.firstChild)}
    if(window.FlossFoxAtelierMedia&&FlossFoxAtelierMedia.fillCover){
      FlossFoxAtelierMedia.fillCover(cover,p);
    }else if(!cover.childElementCount){
      cover.setAttribute('role','img');
      cover.setAttribute('aria-label',t('journal.cover.fallback.aria',{name:p.name})||('Color strip for '+p.name));
      const pack=Pal&&Pal.strip?Pal.strip(p.items||[],src,6):{swatches:[],more:0,total:0};
      const ul=el('ul',{class:'ffa-strip'});
      (pack.swatches||[]).forEach(s=>{
        const liS=el('li');
        const sp=el('span',{class:'ffa-floss ffa-chip',role:'img','aria-label':s.label||('DMC '+s.code)});
        if(s.rgb)sp.style.setProperty('--c',s.rgb);else sp.style.background='#ccc';
        liS.appendChild(sp);ul.appendChild(liS);
      });
      cover.appendChild(ul);
      if(pack.more)cover.appendChild(el('span',{class:'ffa-more'},'+'+pack.more));
    }
    const STAT={planning:'Planning',ready:'Ready to stitch',progress:'In progress',done:'Completed'};
    const status=STAT[p.status]||STAT.planning;
    const date=(p.updated||'').slice(0,10);
    if(!li.querySelector('.ffa-gmeta')){
      const meta=el('p',{class:'ffa-gmeta'});
      meta.append(el('b',null,status), document.createTextNode(' · '+(t('journal.card.meta',{status,date})||('Edited '+date)).replace(status+' · ','')));
      const nameEl=li.querySelector('.pname');
      if(nameEl&&nameEl.parentNode)nameEl.parentNode.insertBefore(meta,nameEl.nextSibling);
      else li.appendChild(meta);
    }
    if(!li.querySelector('.ffa-gcodes')){
      const codes=(p.items||[]).map(i=>i&&i.code).filter(Boolean);
      const shown=codes.slice(0,8);
      const line=shown.map(c=>/^(BLANC|WHITE|B5200|ECRU)$/.test(c)?c:'DMC '+c);
      // Lead with DMC once when the first code is numeric, and keep BLANC/WHITE/B5200 as themselves
      const text=codes.length?('DMC '+shown.map(c=>c).join(', ')): '';
      if(text)li.appendChild(el('p',{class:'ffa-gcodes mut small'},text.replace(/DMC (BLANC|WHITE|B5200|ECRU)/g,'$1')));
    }
    if(p.leftOff&&!li.querySelector('.ffa-gnote')){
      const note=el('div',{class:'ffa-gnote'});note.append(el('b',null,'Where I left off'),document.createTextNode(p.leftOff));
      li.appendChild(note);
    }
    if(p.status==='done'&&!li.querySelector('.ffa-gdone')){
      li.appendChild(el('p',{class:'ffa-gdone'},t('journal.finished.card')));
    }
    if(Number.isInteger(p.progressPct) && !li.querySelector('.ffa-ring')){
      const r=ringSvg(p.progressPct);r.classList.add('ffa-ring-sm');li.appendChild(r);
    }
  });
}


const RING_C=2*Math.PI*36;
function svgEl(name,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',name);if(attrs)for(const k in attrs)n.setAttribute(k,attrs[k]);if(text!=null)n.textContent=text;return n}
function ringSvg(pct){
  const n=Number.isInteger(pct)?pct:0, dash=(n/100)*RING_C;
  const aria=t('journal.progress.aria',{pct:n})||(n+'% done, your own estimate');
  const lab=el('div',{class:'ffa-ring',role:'img','aria-label':aria});
  const svg=svgEl('svg',{viewBox:'0 0 88 88','aria-hidden':'true'});
  svg.append(
    svgEl('circle',{class:'ffa-ring-trk',cx:'44',cy:'44',r:'36','stroke-width':'9',fill:'none'}),
    svgEl('circle',{class:'ffa-ring-val',cx:'44',cy:'44',r:'36','stroke-width':'9',fill:'none','stroke-dasharray':dash+' '+RING_C,transform:'rotate(-90 44 44)'}),
    svgEl('text',{x:'44',y:'51','text-anchor':'middle'},n+'%')
  );
  lab.append(svg,el('span',{class:'ffa-ring-cap','aria-hidden':'true'},t('journal.progress.ring')||'Your estimate'));
  return lab;
}
function paintProgress(host,p){
  if(!host||!p)return;
  host.replaceChildren();
  const wrap=el('section',{class:'ffa-progress',id:'ffaProgress'});
  wrap.append(el('h3',null,t('journal.progress.btn')||'Set progress'));
  const has=Number.isInteger(p.progressPct);
  if(!has){wrap.append(el('p',{class:'hint'},t('journal.progress.empty')))}
  else{
    wrap.append(ringSvg(p.progressPct));
    const num=el('p',{class:'ffa-prog-num'},t('journal.progress.caption',{pct:p.progressPct})||(p.progressPct+'% · your estimate'));
    wrap.append(num);
    if(p.progressPct===100&&p.status!=='done'){
      const label=({planning:'Planning',ready:'Ready to stitch',progress:'In progress',done:'Completed'})[p.status||'planning']||'In progress';
      wrap.append(el('p',{class:'hint',id:'ffaProgFull'},t('journal.progress.full',{status:label})));
    }
  }
  const editor=el('div',{class:'ffa-prog-edit'});editor.hidden=true;
  const lab=el('label',{for:'ffaPct'},t('journal.progress.label'));
  const row=el('div',{class:'row'});
  const inp=el('input',{id:'ffaPct',type:'number',inputmode:'numeric',min:'0',max:'100',step:'1'});
  if(has)inp.value=String(p.progressPct);
  inp.setAttribute('aria-describedby','ffaPctHelp ffaPctHint');
  row.append(inp,el('span',{'aria-hidden':'true'},'%'));
  editor.append(lab,row,el('p',{class:'hint',id:'ffaPctHelp'},t('journal.progress.help')),el('p',{class:'hint',id:'ffaPctHint'},t('journal.progress.hint')));
  const acts=el('div',{class:'row'});
  const saveB=el('button',{type:'button',class:'pri',id:'ffaPctSave'},t('journal.progress.save'));
  const cancelB=el('button',{type:'button',class:'sec',id:'ffaPctCancel'},t('journal.progress.cancel'));
  const clearB=el('button',{type:'button',class:'ghost',id:'ffaPctClear'},t('journal.progress.clear'));
  const msg=el('p',{class:'hint',role:'status','aria-live':'polite',id:'ffaPctMsg'});
  function closeEdit(){editor.hidden=true;if(setB)setB.hidden=false}
  saveB.onclick=()=>{const raw=String(inp.value||'').trim();if(raw===''){msg.textContent=t('journal.progress.bad');return}
    const n=Number(raw);if(!Number.isInteger(n)||n<0||n>100){msg.textContent=t('journal.progress.bad');return}
    const r=P.setProgress?P.setProgress(p.id,n):{ok:false};if(!r.ok){msg.textContent=t('common.notSaved')||'Not saved.';return}
    /* renderEditor will rebuild this; if not, paint again */
  };
  cancelB.onclick=()=>closeEdit();
  clearB.onclick=()=>{const r=P.setProgress?P.setProgress(p.id,null):{ok:false};if(!r.ok)msg.textContent=t('common.notSaved')};
  acts.append(saveB,cancelB,clearB);editor.append(acts,msg);
  const setB=el('button',{type:'button',class:'sec',id:'ffaPctOpen'},has?t('journal.progress.edit'):t('journal.progress.btn'));
  setB.onclick=()=>{editor.hidden=false;setB.hidden=true;inp.focus()};
  wrap.append(setB,editor);
  host.append(wrap);
}
// Stitch session: a focus-mode panel (FF39-16, PRODUCT_SPEC). Timer is optional and
// in-memory only. Never written to prefs, projects, threads or backups. Focus itself
// is also in-memory: a reload returns to the full project editor.
let sess={mode:'idle',start:null,frozen:0},tickT=null,sessHost=null,sessProject=null,focusOn=false;
function fmtTime(ms){const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),h=Math.floor(m/60),mm=String(m%60).padStart(h?2:1,'0'),ss=String(s%60).padStart(2,'0');return h?h+':'+String(m%60).padStart(2,'0')+':'+ss: (m>=10||h?mm:String(m))+':'+ss}
function fmtSitting(ms){const m=Math.max(0,Math.floor(ms/60000));if(m<1)return 'under 1 min';const h=Math.floor(m/60),r=m%60;if(!h)return m+' min';return r?h+' hr '+r+' min':h+' hr'}
function sessElapsed(){if(sess.mode==='running'&&sess.start!=null)return Date.now()-sess.start;return sess.frozen||0}
function sayTimer(ms){try{if(window.FlossFoxAtelierPip&&FlossFoxAtelierPip.timerStopped)FlossFoxAtelierPip.timerStopped(ms,$('ffaFocus')||$('ffaSession')||$('projStatus'))}catch(e){}}
function sessStopTick(){if(tickT){clearInterval(tickT);tickT=null}}
function sessTick(){sessStopTick();if(sess.mode==='running')tickT=setInterval(()=>{paintSession(sessHost,sessProject,true)},250)}
function goTab(id){const b=$(id);if(b)b.click()}
function locText(s){
  if(!s)return '';
  if(typeof s==='string')return s.trim();
  try{if(window.FlossFoxThreadLocations&&typeof FlossFoxThreadLocations.text==='function'){const x=FlossFoxThreadLocations.text(s);if(x)return x}}catch(e){}
  const mid={box:'box',bag:'bag',bobbin:'bobbin',card:'card',skein:'skein'};
  return [s.container,s.slot,s.medium?mid[s.medium]||s.medium:''].filter(Boolean).join(' · ');
}
function focusColors(p){
  const wrap=el('section',{class:'ffa-focus-colors'});
  wrap.append(el('h3',null,t('session.colors')||'Colors for this project'));
  const items=(p&&Array.isArray(p.items))?p.items:[];
  if(!items.length){wrap.append(el('p',{class:'hint'},'No colors listed yet.'));return wrap}
  const data=window.FlossFoxThreadsUI&&FlossFoxThreadsUI.data?FlossFoxThreadsUI.data():null;
  const threads=data&&data.threads?data.threads:{};
  const D=window.DMC||{};
  const ul=el('ul',{class:'ffa-colors'});
  items.forEach(it=>{
    const code=it&&it.code?String(it.code):'';
    const li=el('li');
    const src=rgbCatalog()||D||{};
    const hex=src[code]&&typeof src[code].hex==='string'&&/^#[0-9a-fA-F]{6}$/.test(src[code].hex)?src[code].hex:null;
    const white=/^(BLANC|WHITE|B5200)$/i.test(code);
    const sw=el('span',{class:'ffa-floss'+(hex?'':' none')+(hex&&(/^#f/i.test(hex)||white)?' edge':''),'aria-hidden':'true'});
    if(hex)sw.style.setProperty('--c',hex);
    li.append(sw,el('span',null,'DMC '+code));
    const rec=threads[code];
    const loc=rec?locText(rec.storage):'';
    if(loc)li.append(el('span',{class:'ffa-loc'},t('session.location',{location:loc})||('In '+loc)));
    ul.append(li);
  });
  wrap.append(ul);return wrap;
}
function paintTimerCard(){
  const card=el('section',{class:'ffa-session',id:'ffaSession'});
  const clock=fmtTime(sessElapsed());
  card.append(el('h3',null,t('session.title')||'Stitch session'));
  if(sess.mode==='idle'||sess.mode==='stopped'){
    if(sess.mode==='stopped'){
      const sitting=fmtSitting(sessElapsed());
      const sum=el('p',{class:'ffa-sess-sum',role:'status'},t('session.timer.summary',{time:sitting})||('This sitting: '+sitting+". We don't save this time."));
      card.append(sum);
      const again=el('button',{type:'button',class:'sec',id:'ffaTimerAgain'},t('session.timer.again'));
      again.onclick=()=>{sess={mode:'idle',start:null,frozen:0};paintSession(sessHost,sessProject)};
      card.append(again);
    }else{
      const clk=el('p',{class:'ffa-clock','aria-label':t('session.timer.aria',{time:'0:00'})},'0:00');
      card.append(clk,el('p',{class:'hint'},t('session.timer.empty')));
      const st=el('button',{type:'button',class:'pri',id:'ffaTimerStart'},t('session.timer.start'));
      st.onclick=()=>{sess={mode:'running',start:Date.now(),frozen:0};paintSession(sessHost,sessProject);sessTick()};
      card.append(st);
    }
  }else if(sess.mode==='running'){
    const row=el('div',{class:'row'});
    const clk=el('p',{class:'ffa-clock','aria-label':t('session.timer.aria',{time:clock})},clock);
    row.append(clk,el('span',{class:'ffa-badge ok',id:'ffaTimerRun'},t('session.timer.running')));
    card.append(row);
    const acts=el('div',{class:'row'});
    const pa=el('button',{type:'button',class:'sec',id:'ffaTimerPause'},t('session.timer.pause'));
    const sp=el('button',{type:'button',class:'sec',id:'ffaTimerStop'},t('session.timer.stop'));
    pa.onclick=()=>{sess={mode:'paused',start:null,frozen:sessElapsed()};sessStopTick();paintSession(sessHost,sessProject)};
    sp.onclick=()=>{const elapsed=sessElapsed();sess={mode:'stopped',start:null,frozen:elapsed};sessStopTick();paintSession(sessHost,sessProject);sayTimer(elapsed)};
    acts.append(pa,sp);card.append(acts,el('p',{class:'hint small'},t('session.timer.hint')));
    sessTick();
  }else if(sess.mode==='paused'){
    const row=el('div',{class:'row'});
    const clk=el('p',{class:'ffa-clock','aria-label':t('session.timer.aria',{time:clock})},clock);
    row.append(clk,el('span',{class:'ffa-badge wait'},t('session.timer.paused',{time:clock})));
    card.append(row);
    const acts=el('div',{class:'row'});
    const rs=el('button',{type:'button',class:'pri',id:'ffaTimerResume'},t('session.timer.resume'));
    const sp=el('button',{type:'button',class:'sec',id:'ffaTimerStop'},t('session.timer.stop'));
    rs.onclick=()=>{sess={mode:'running',start:Date.now()-sess.frozen,frozen:sess.frozen};paintSession(sessHost,sessProject);sessTick()};
    sp.onclick=()=>{const elapsed=sess.frozen||0;sess={mode:'stopped',start:null,frozen:elapsed};paintSession(sessHost,sessProject);sayTimer(elapsed)};
    acts.append(rs,sp);card.append(acts,el('p',{class:'hint small'},t('session.timer.hint')));
  }
  return card;
}
function paintFocus(isTick){
  const ed=$('projEdit');if(!ed)return;
  let foc=$('ffaFocus');
  if(!foc){foc=el('section',{class:'ffa-focus',id:'ffaFocus','aria-labelledby':'ffaFocusTitle'});ed.append(foc)}
  foc.hidden=false;ed.classList.add('ffa-focus-on');
  const clock=fmtTime(sessElapsed());
  if(isTick){const elc=foc.querySelector('.ffa-clock');if(elc)elc.textContent=clock;return} // clock face only; do not retouch aria-label every tick (announce Start/Pause/Resume/Stop only)
  foc.replaceChildren();
  const p=sessProject;
  const head=el('header',{class:'ffa-focus-head'});
  head.append(el('h2',{id:'ffaFocusTitle',tabindex:'-1'},(p&&p.name)||(t('session.title')||'Stitch session')));
  const exit=el('button',{type:'button',class:'sec',id:'ffaSessionExit'},t('session.exit')||'Back to the full project');
  exit.onclick=()=>exitSession();
  head.append(exit);foc.append(head);
  const lo=p&&typeof p.leftOff==='string'?p.leftOff.trim():'';
  if(lo){const note=el('section',{class:'ffa-focus-note'});note.append(el('h3',null,t('wb.leftOff.label')||'Where I left off'),el('p',null,lo));foc.append(note)}
  foc.append(focusColors(p));
  let blockers=0;
  try{const plan=window.FlossFoxProjects&&FlossFoxProjects.plan?FlossFoxProjects.plan(p):null;if(plan&&Array.isArray(plan.checkFirst))blockers=plan.checkFirst.length}catch(e){}
  if(blockers)foc.append(el('p',{class:'ffa-focus-block',id:'ffaFocusBlockers',role:'status'},t('session.blockers',{n:blockers},blockers)));
  const links=el('nav',{class:'ffa-focus-links','aria-label':'Tools'});
  const mk=(id,label,tab)=>{const b=el('button',{type:'button',class:'sec',id:id},label);b.onclick=()=>{exitSession();goTab(tab)};return b};
  links.append(mk('ffaFocusShop',t('wb.quick.shop')||'Shop missing threads','tabShop'),mk('ffaFocusThreads',t('wb.quick.threads')||'My threads','tabThreads'));
  foc.append(links);
  const on=!!(P0()&&P0().sessionTimer);
  if(on)foc.append(paintTimerCard());
}
function enterSession(p){focusOn=true;if(p)sessProject=p;if(sessHost){sessHost.replaceChildren();sessHost.hidden=true}paintFocus(false);
  const foc=$('ffaFocus');if(foc)try{foc.scrollIntoView({block:'start'})}catch(e){}
  const h=$('ffaFocusTitle');if(h){if(!h.hasAttribute('tabindex'))h.tabIndex=-1;try{h.focus({preventScroll:true})}catch(e){try{h.focus()}catch(e2){}}}}
function exitSession(){
  focusOn=false;
  const ed=$('projEdit');if(ed)ed.classList.remove('ffa-focus-on');
  const foc=$('ffaFocus');if(foc){foc.hidden=true;foc.replaceChildren()}
  if(sessHost)sessHost.hidden=false;
  paintSession(sessHost,sessProject);
  const start=$('ffaSessionStart');if(start)try{start.focus()}catch(e){}
}
function onEditorClosed(){if(focusOn){focusOn=false;const ed=$('projEdit');if(ed)ed.classList.remove('ffa-focus-on')}sessStopTick()}
function paintSession(host,p,isTick){
  sessHost=host||sessHost;sessProject=p||sessProject;
  if(focusOn){if(isTick){paintFocus(true);return}paintFocus(false);return}
  if(!sessHost)return;
  sessHost.hidden=false;
  if(isTick)return; // clock only ticks inside the focus panel
  sessHost.replaceChildren();
  const card=el('section',{class:'ffa-session',id:'ffaSession'});
  card.append(el('h3',null,t('session.title')||'Stitch session'));
  const start=el('button',{type:'button',class:'pri',id:'ffaSessionStart'},t('session.btn.start')||'Start a stitch session');
  start.onclick=()=>enterSession(sessProject);
  card.append(start);
  sessHost.append(card);
}
function celebrateDone(p){
  const name=p&&p.name?p.name:'this project';
  const msg=t('journal.finished.status',{name:name})||('✓ '+name+' is marked Completed.');
  if($('pCelebrate'))$('pCelebrate').textContent=msg;
  else if($('projStatus'))$('projStatus').textContent=msg;
  try{if(window.FlossFoxAtelierPip&&FlossFoxAtelierPip.finished)FlossFoxAtelierPip.finished(p,$('pCelebrate')||$('projStatus')||$('pip'))}catch(e){}
}

window.FlossFoxAtelier=Object.freeze({version:'3.9-stageF',draftCopy:true,prefKey:PKEY,prefs:()=>pref.ok?{...pref.data}:null,resumeResult:()=>resumeResult,renderWorkbasket:()=>renderWB(),openSearch:()=>openSearch(),closeSearch:()=>closeSearch(true),paintProjects:paintProjects,paintProgress:paintProgress,paintSession:paintSession,celebrateDone:celebrateDone,enterSession:enterSession,exitSession:exitSession,inSession:()=>focusOn,onEditorClosed:onEditorClosed,_dirty:()=>dirty,_fmtSitting:fmtSitting,_session:()=>({mode:sess.mode,elapsed:sessElapsed(),focus:focusOn}),_debugSession:(o)=>{if(!o)return;if(o.elapsed!=null){const ev=o.elapsed;sess={mode:o.mode||'running',start:Date.now()-ev,frozen:ev};paintSession(sessHost,sessProject)}}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
try{if(window.FlossFoxAtelierSeasonal&&FlossFoxAtelierSeasonal.refresh)FlossFoxAtelierSeasonal.refresh()}catch(e){}
})();
