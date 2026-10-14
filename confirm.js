/* Floss Fox: reusable in-page Pip confirm. ask(opts) -> Promise<boolean> (true = remove/confirm). */
(function(root){'use strict';
let host=null,done=null,prev=null;
function ensure(){if(host)return host;host=document.createElement('div');host.id='ffConfirm';host.className='ffconfirm';host.hidden=true;
 host.innerHTML='<div class="ffconfirm-back" data-ffc-x tabindex="-1"></div><div class="ffconfirm-panel" role="dialog" aria-modal="true" aria-labelledby="ffConfirmTitle" aria-describedby="ffConfirmBody"><div class="ffconfirm-pip"><picture><source type="image/webp" id="ffConfirmWebp" srcset=""><img id="ffConfirmImg" src="" width="160" height="241" alt="" decoding="async"></picture></div><h2 id="ffConfirmTitle"></h2><p id="ffConfirmBody"></p><div class="ffconfirm-acts"><button type="button" class="pri" id="ffConfirmKeep">Keep it</button><button type="button" class="sec" id="ffConfirmGo">Remove</button></div></div>';
 document.body.appendChild(host);
 host.querySelector('[data-ffc-x]').onclick=()=>finish(false);
 host.querySelector('#ffConfirmKeep').onclick=()=>finish(false);
 host.querySelector('#ffConfirmGo').onclick=()=>finish(true);return host}
function finish(ok){if(!done)return;const r=done;done=null;host.hidden=true;document.removeEventListener('keydown',onKey,true);
 const f=prev;prev=null;if(f&&f.focus)try{f.focus()}catch(e){}r(ok)}
function onKey(e){if(!done)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);return}
 if(e.key!=='Tab')return;const bs=host.querySelectorAll('.ffconfirm-panel button:not([disabled])');if(!bs.length)return;
 const a=bs[0],z=bs[bs.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
/** @param {{title:string,body:string,pose?:string,keep?:string,go?:string}} o */
function ask(o){o=o||{};ensure();if(done)finish(false);const pose=o.pose||'thinking',h=o.height||(pose==='peeking'?221:241);
 const img=host.querySelector('#ffConfirmImg'),webp=host.querySelector('#ffConfirmWebp');
 webp.srcset='assets/pip/pip-'+pose+'-160.webp';img.src='assets/pip/pip-'+pose+'-160.png';img.width=160;img.height=h;img.dataset.pose=pose;
 host.querySelector('#ffConfirmTitle').textContent=o.title||'Are you sure?';
 host.querySelector('#ffConfirmBody').textContent=o.body||'';
 host.querySelector('#ffConfirmKeep').textContent=o.keep||'Keep it';
 host.querySelector('#ffConfirmGo').textContent=o.go||'Remove';
 prev=document.activeElement;host.hidden=false;document.addEventListener('keydown',onKey,true);
 return new Promise(r=>{done=r;requestAnimationFrame(()=>{const k=host.querySelector('#ffConfirmKeep');if(k)k.focus()})})}
root.FlossFoxConfirm={ask};
})(typeof window!=='undefined'?window:this);
