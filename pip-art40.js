/* Pip ideas 11-50 (dev only). New image files only; existing pose files and names stay as they are.
   Wires Pixel's placement plan to existing slots and moments. No new storage, no network, no AI. */
(function(){'use strict';
const POSES=[
 '11-spool-stage','12-sewing-box-door','13-tea-hoop','14-happy-wave-up','15-more-tools',
 '16-magnifier','17-two-skeins','18-rainbow-bundle','20-shrug-no-match','21-blanc-vs-white',
 '22-keepsake-chest','23-bobbin-tower','24-abacus-count','25-empty-box','26-skein-hug',
 '27-workbasket','28-corkboard','29-bookmark-book','30-hoop-overhead','31-brow-wipe',
 '32-shopping-basket','33-clipboard-checklist','34-wagon-restock','35-unpack-bag',
 '36-fabric-scissors','37-aida-inspect','38-pocket-watch','39-focus-stitching','40-progress-ring',
 '41-confetti-done','42-backup-envelope','43-restore-chest','44-settings-dial','45-help-lantern',
 '46-tips-scroll','47-offline-cloud','48-bandage-tangle','49-dozing-skein','50-whats-new-bow',
 'xx-wave-alt'
];
function register(){const P=window.FlossFoxPip;if(P&&P.ART)POSES.forEach(k=>{P.ART[k]=k});}
function srcset(pose,ext){return[160,320,480].map(w=>'assets/pip/pip-'+pose+'-'+w+'.'+ext+' '+w+'w').join(', ')}
function fillPicture(pic,pose,w,alt){
 if(!pic||!pose)return;
 const sources=pic.querySelectorAll('source');
 if(!sources.length){
  const s=document.createElement('source');s.type='image/webp';s.srcset=srcset(pose,'webp');pic.insertBefore(s,pic.firstChild);
 }else{
  sources.forEach(function(s){
   const ext=(s.type==='image/webp'||/\.webp\b/.test(s.srcset||''))?'webp':'png';
   s.srcset=srcset(pose,ext);
  });
 }
 const img=pic.querySelector('img');if(!img)return;
 img.srcset=srcset(pose,'png');
 img.src='assets/pip/pip-'+pose+'-'+(w||320)+'.png';
 img.dataset.pose=pose;img.dataset.art=pose;
 img.alt=alt||'';img.decoding=img.decoding||'async';
 if(!img.getAttribute('width')){img.width=w||160;img.height=w||160}
}
function landing(){
 const pic=document.querySelector('#ffLanding .lpip picture');if(!pic)return;
 const first=!!(document.getElementById('ffStartHere')||document.querySelector('#ffLanding .ffsh'));
 const pose=first?'12-sewing-box-door':'11-spool-stage';
 const alt=first
  ?'Pip, the Floss Fox mascot, holding the door of a tiny sewing-box house'
  :'Pip, the Floss Fox mascot, waving from the top of a spool of thread';
 fillPicture(pic,pose,320,alt);
 const img=pic.querySelector('img');if(img){img.width=170;img.height=170;img.loading=img.loading||'eager'}
}
function resumeCard(){
 const btn=document.getElementById('ffuxResume');if(!btn||btn.querySelector('.ff-art40'))return;
 const pic=document.createElement('picture');pic.className='ff-art40';pic.setAttribute('aria-hidden','true');
 const src=document.createElement('source');src.type='image/webp';src.srcset=srcset('13-tea-hoop','webp');src.sizes='72px';
 const img=document.createElement('img');
 img.src='assets/pip/pip-13-tea-hoop-160.png';img.srcset=srcset('13-tea-hoop','png');
 img.width=72;img.height=72;img.alt='';img.loading='lazy';img.decoding='async';img.dataset.pose='13-tea-hoop';
 pic.append(src,img);btn.insertBefore(pic,btn.firstChild);
}
function helpHeader(){
 const img=document.querySelector('#helpView .helphead img');
 const pic=document.querySelector('#helpView .helphead picture');
 if(!pic||!img)return;
 fillPicture(pic,'45-help-lantern',160,'Pip, the Floss Fox mascot, holding a glowing lantern');
 img.width=160;img.height=160;img.loading='lazy';
}
function patchStates(){
 const P=window.FlossFoxPip;if(!P||!P.STATES)return;
 const S=P.STATES;
 if(S.attentive)S.attentive.pose='16-magnifier';
 if(S.helpful)S.helpful.pose='17-two-skeins';
 if(S.empty)S.empty.pose='20-shrug-no-match';
 if(S.listReady)S.listReady.pose=function(r){
  const items=(r&&r.items)||[];
  const codes=items.map(function(i){return String(i.code||'').toUpperCase()});
  if(codes.indexOf('BLANC')>=0&&(codes.indexOf('WHITE')>=0||codes.indexOf('B5200')>=0))return'21-blanc-vs-white';
  return'18-rainbow-bundle';
 };
}
function patchSections(){
 const F=window.FlossFoxPipFollow;if(!F||!F.SECTIONS)return;
 const set=function(sel,pose){const row=F.SECTIONS.find(function(x){return x[0]===sel});if(row)row[1]=pose};
 set('#thCard','22-keepsake-chest');
 set('#shopCard','32-shopping-basket');
 set('#settingsView .card','44-settings-dial');
 set('#helpView .card.help','45-help-lantern');
 set('#backupBox','42-backup-envelope');
 set('#fcTips','46-tips-scroll');
 // Keep measuring-fabric, pattern-reader, thinking, organizing on project list (existing tested slots).
 const add=[
  ['#workbasketView .ffa-wb','27-workbasket','pf.threads'],
  ['#ffaFocus','39-focus-stitching','pf.projEdit'],
  ['#ffaSession','38-pocket-watch','pf.projEdit'],
  ['#ffaProgress','40-progress-ring','pf.projEdit'],
  ['#pLeftOff','29-bookmark-book','pf.projEdit'],
  ['.pleftoff','29-bookmark-book','pf.projEdit'],
  ['#smHome','35-unpack-bag','pf.shop'],
  ['#fcPresets','37-aida-inspect','pf.fcCalc'],
  ['#fcCut','36-fabric-scissors','pf.fcCalc'],
  ['#recentChanges','50-whats-new-bow','pf.settings'],
  ['#ffRestock','34-wagon-restock','pf.threads'],
  ['#ffLowSuggest','25-empty-box','pf.threads'],
  ['#restorePanel','43-restore-chest','pf.backup']
 ];
 add.forEach(function(row){if(!F.SECTIONS.some(function(x){return x[0]===row[0]}))F.SECTIONS.push(row)});
}
function preferContext(){
 const P=window.FlossFoxPip;if(!P||!P.section)return;
 const vis=function(id){const e=document.getElementById(id);return!!(e&&!e.hidden&&e.getClientRects().length)};
 const qvis=function(sel){const e=document.querySelector(sel);return!!(e&&!e.hidden&&e.getClientRects().length&&!(e.closest&&e.closest('[hidden]')))};
 if(vis('ffaFocus'))return P.section('39-focus-stitching','');
 if(vis('ffaSession'))return P.section('38-pocket-watch','');
 if(qvis('#ffaProgress .ffa-ring')){
  const cap=document.querySelector('#ffaProgress .ffa-prog-num, #ffaProgress [aria-label]');
  const t=(cap&&(cap.getAttribute('aria-label')||cap.textContent))||'';
  if(/\b100\s*%/.test(t))return P.section('41-confetti-done','');
  if(/\b([1-9]\d?)\s*%/.test(t))return P.section('31-brow-wipe','');
  return P.section('40-progress-ring','');
 }
 if(document.activeElement&&document.activeElement.id==='pLeftOff')return P.section('29-bookmark-book','');
 if(qvis('.ffa-gallery'))return P.section('30-hoop-overhead','');
 if(qvis('#smHome'))return P.section('35-unpack-bag','');
 if(qvis('#ffRestock')&&vis('ffRestock'))return P.section('34-wagon-restock','');
 if(qvis('#ffLowSuggest')&&vis('ffLowSuggest'))return P.section('25-empty-box','');
 if(document.activeElement&&(/qty|count|skein|thN|thAdd/.test(document.activeElement.id||'')||document.activeElement.closest&&document.activeElement.closest('[data-n],[data-qty],.th .n')))
  return P.section('24-abacus-count','');
 if(qvis('#restorePanel')&&vis('restorePanel'))return P.section('43-restore-chest','');
 if(qvis('#recentChanges')&&vis('settingsView')){
  const rc=document.getElementById('recentChanges');
  if(rc&&rc.getClientRects()[0]&&rc.getClientRects()[0].top<innerHeight*0.7&&rc.getClientRects()[0].bottom>80)
   return P.section('50-whats-new-bow','');
 }
 if(qvis('#fcPresets')&&document.activeElement&&(document.activeElement.id||'').indexOf('fcPreset')===0)
  return P.section('37-aida-inspect','');
}
function ev(pose,ms){const P=window.FlossFoxPip;if(P&&P.event)P.event(pose,ms||4000)}
function onClick(e){
 const t=e.target&&e.target.closest&&e.target.closest('button, [type=button], label.filebtn');
 if(!t)return;
 const id=t.id||'';
 if(id==='saveProj'||id==='newEmpty'){setTimeout(function(){ev('28-corkboard',4000)},400);return}
 if(id==='smRecv'||id.indexOf('sr-')===0||t.getAttribute('data-sr')||t.getAttribute('data-rc')||t.getAttribute('data-ss')||/I received it/i.test(t.textContent||'')){
  setTimeout(function(){ev('26-skein-hug',4000)},500);return}
 if(id==='backupBtn'||id==='settingsExport'){setTimeout(function(){ev('42-backup-envelope',4000)},600);return}
 if(id==='settingsImport'||id==='restoreFile'||/Restore from a backup/i.test(t.textContent||'')){setTimeout(function(){ev('43-restore-chest',4000)},400);return}
 if(id==='ffaPctSet'||id==='ffaPctSave'||/Set progress|Save estimate/i.test(t.textContent||'')){
  setTimeout(function(){
   const v=document.getElementById('ffaPct');const n=v?parseInt(v.value,10):NaN;
   ev(n===100?'41-confetti-done':'31-brow-wipe',4000);
  },300);return}
 if(id==='fcPrint'){ev('36-fabric-scissors',4000);return}
}
function onStatus(){
 const nodes=document.querySelectorAll('#bkSettingsStatus, #bkFeedback, #projStatus, #pMsg, #thMsg, [role="status"], .errbox, .warn');
 for(let i=0;i<nodes.length;i++){
  const t=(nodes[i].textContent||'');
  if(/not saved|couldn't save|could not save|didn't save|did not save|browser blocked the save/i.test(t)&&t.trim()){
   ev('48-bandage-tangle',4000);return}
 }
}
let stT=0;
function boot(){
 register();patchStates();patchSections();landing();helpHeader();resumeCard();
 const sh=document.getElementById('ffStartHere');
 if(sh)sh.addEventListener('click',function(){setTimeout(landing,0)});
 document.addEventListener('click',function(e){
  if(e.target&&e.target.closest&&e.target.closest('#ffLanding a[data-tab], #ffStartHere, #ffLandTour'))setTimeout(landing,0);
  onClick(e);
 },true);
 document.addEventListener('focusin',function(){preferContext()});
 const mo=new MutationObserver(function(){
  resumeCard();landing();
  preferContext();
  clearTimeout(stT);stT=setTimeout(onStatus,80);
 });
 mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','class']});
 preferContext();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.FlossFoxPipArt40={POSES:POSES,register:register};
})();
