/* Pip art batch 2 (Pixel, dev only). Decorative art (alt="") at 8 spots. Every spot follows the Pip level setting.
   All lines below are APPROVED by Pixel (see pip-art/new-batch2/STRINGS_FOR_PIXEL.md). Never shown on the Shopping screen. */
(function(){'use strict';
const KEY='flossfox.pip.v1';
const LEVEL_KEY=KEY.replace(/\.pip\.v1$/,'.pipLevel.v1'),TIP_KEY=KEY.replace(/\.pip\.v1$/,'.pipTipShown.v1'); // TIP_KEY lives in sessionStorage
const STR={ // APPROVED by Pixel (batch 2 final)
 'b2.reading':"I'm reading your pattern now.",
 'b2.checkOk':"Nothing caught my eye. Still give each color a quick look against your pattern.",
 'b2.fixSheet':"Let's fix this together. Your pattern file stays the same.",
 'b2.helpTip':"Little tip: in My threads, you can find a color by its DMC number or its name."};
// spot -> pose, size, levels that show it
const SPOT={reading:{pose:'pattern-reader',lv:['chatty','important']},checkOk:{pose:'checklist',lv:['chatty','important']},fixSheet:{pose:'encouraging-coach',lv:['chatty','important']},
 fabric:{pose:'measuring-fabric',lv:['chatty','important','quiet']},helpTip:{pose:'whispering-tip',lv:['chatty']},level:{pose:'cozy-companion',lv:['chatty','important','quiet']},
 backup:{pose:'postmaster',lv:['chatty','important']}};
function level(){const P=window.FlossFoxPip;if(P&&P.level)return P.level();let h=null,s=null;try{h=localStorage.getItem(KEY);s=localStorage.getItem(LEVEL_KEY)}catch(e){}
 if(h==='hidden'||s==='off')return'off';return['chatty','important','quiet'].includes(s)?s:'important'}
const shopOpen=()=>{const v=document.getElementById('shopView');return !!(v&&!v.hidden&&v.getClientRects().length)};
const capFile=new Set();
function allowed(id,a){const sp=SPOT[id];if(!sp||!sp.lv.includes(level()))return false;if(shopOpen())return false;if(a&&a.closest&&a.closest('#shopView'))return false;return true}
function art(id,w,line){const sp=SPOT[id],d=document.createElement('div');d.className='pipb2 pipb2-'+id;d.dataset.pose=sp.pose;
 d.innerHTML=`<picture aria-hidden="true"><source type="image/webp" srcset="assets/pip/pip-${sp.pose}-160.webp 160w, assets/pip/pip-${sp.pose}-320.webp 320w" sizes="${w}px"><img src="assets/pip/pip-${sp.pose}-160.png" alt="" width="${w}" decoding="async" style="width:${w}px;height:auto"></picture>`;
 if(line){const p=document.createElement('p');p.className='pipb2-text';p.dataset.key=line;p.textContent=STR[line];d.append(p)}return d}
(function css(){const s=document.createElement('style');s.textContent='.pipb2{display:flex;align-items:center;gap:10px;margin:0 0 8px}.pipb2 img{flex:none}.pipb2-text{margin:0;font-size:.95rem}.pipb2-fabric{justify-content:center}.pipb2-level{float:right;margin:0 0 4px 8px}@media(max-width:400px){.pipb2-level img{width:72px!important}}';document.head.append(s)})();
// 02 reading: only during the real PDF read; art appears only if reading takes over 1 s, and goes away when it ends
let rT=null;
function reading(on,anchor){clearTimeout(rT);document.querySelectorAll('.pipb2-reading').forEach(x=>x.remove());if(!on||!anchor)return;
 rT=setTimeout(()=>{if(!anchor.isConnected||!allowed('reading',anchor))return;const d=art('reading',64,'b2.reading');d.setAttribute('aria-hidden','true');anchor.before(d)},1000)}
// 03 checkOk: green verdict, once per file
function checkOk(box,fileId){if(!box||!allowed('checkOk',box))return false;const id='ok:'+fileId;if(capFile.has(id))return false;capFile.add(id);
 const v=box.querySelector('.pt-verdict')||box.querySelector('h3');v.after(art('checkOk',64,'b2.checkOk'));return true}
// 10 fixSheet: Fix it sheet header, once per file (not on every open)
function fixSheet(s,fileId){if(!s||!allowed('fixSheet',s))return false;const id='fix:'+fileId;if(capFile.has(id))return false;capFile.add(id);
 const h=s.querySelector('.pt-title');(h||s.firstChild).after(art('fixSheet',64,'b2.fixSheet'));return true}
// 15 backup: export success only (called from backup-ui confirmed())
function backup(){const f=document.getElementById('bkFeedback');document.querySelectorAll('.pipb2-backup').forEach(x=>x.remove());if(!f||!allowed('backup',f))return false;
 const d=art('backup',56);f.prepend(d);return true}
// self-mounting spots: fabric card (07), Help tip (06), Pip level setting (09)
function tick(){const lv=level();
 const panel=document.getElementById('ffFabricPanel');if(panel){let a=panel.querySelector('.pipb2-fabric');const ok=SPOT.fabric.lv.includes(lv);if(ok&&!a){a=art('fabric',160);const h=panel.querySelector('h2');h?h.after(a):panel.prepend(a)}else if(!ok&&a)a.remove()}
 const set=document.getElementById('pipSettings');if(set){let a=set.querySelector('.pipb2-level');const ok=SPOT.level.lv.includes(lv);if(ok&&!a&&set.getClientRects().length){a=art('level',96);const lg=set.querySelector('legend');lg?lg.after(a):set.prepend(a)}else if(!ok&&a)a.remove()}
 const hv=document.getElementById('helpView'),open=hv&&!hv.hidden&&hv.getClientRects().length;const tipEl=document.querySelector('.pipb2-helpTip');
 if(!open){if(tipEl)tipEl.remove();return}
 if(tipEl){if(lv!=='chatty')tipEl.remove();return}
 let shown=null;try{shown=sessionStorage.getItem(TIP_KEY)}catch(e){}
 if(shown||!allowed('helpTip',hv))return;const card=hv.querySelector('.card.help');if(!card)return;
 const d=art('helpTip',64,'b2.helpTip');const h=card.querySelector('.helphead')||card.querySelector('h2');h?h.after(d):card.prepend(d);try{sessionStorage.setItem(TIP_KEY,'shown')}catch(e){}}
let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;tick()})}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
document.addEventListener('change',e=>{if(e.target&&e.target.name==='pipLevel')setTimeout(tick,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
window.FlossFoxPipB2={reading,checkOk,fixSheet,backup,level,tick,STR,SPOT,TIP_KEY,_reset:()=>{capFile.clear();try{sessionStorage.removeItem(TIP_KEY)}catch(e){}}};
})();
