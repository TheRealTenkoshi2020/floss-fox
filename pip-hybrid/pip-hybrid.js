/* Pip Hybrid v0.2: local-first, opt-in per-request AI preview.
 * No localStorage, app data, analytics, or provider key access. All AI content is
 * textContent. Online history is in-memory, exclusively successful AI exchanges.
 */
(function () {
 'use strict';
 const KB=window.FlossFoxPipOffline, FLOWS=window.FlossFoxPipFlows;
 const TOOLS=window.FlossFoxPipLocalTools, PRIVACY=window.FlossFoxPipPrivacy;
 if(!KB)return;
 const cfg=window.PIP_HYBRID_CONFIG||{};
 const endpoint=typeof cfg.endpoint==='string'?cfg.endpoint.trim():'';
 // Reject unexpected transport configurations. The endpoint is developer-owned config.
 const onlineReady=(()=>{try {const u=new URL(endpoint);return u.protocol==='https:'||u.protocol==='http:'&&u.hostname==='localhost'}catch{return false}})();
 const MAX_MSG=600,MAX_HISTORY=6;
 let dialog,log,field,sendButton,onlineButton,status,preview,confirmButton,pending=null;
 let aiHistory=[],busy=false,abort=null,stamp=0,turnstileToken='',turnstileId=null,challengeLoading=false;
 function node(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
 function notice(s){if(status)status.textContent=s}
 function msg(role,text,source,action){const n=node('div','piph-message');n.dataset.role=role;
  if(source)n.append(node('span','piph-source',source));n.append(document.createTextNode(String(text)));
  if(action&&/^(?:index\.html#(?:convert|projects|threads|shop|help)|fabric\.html)$/.test(action.href)){
   const a=node('a','piph-link',action.label);a.href=action.href;
   a.addEventListener('click',()=>{if(dialog.open)dialog.close()});n.append(a);
  }
  log.append(n);log.scrollTop=log.scrollHeight;return n;
 }
 function chips(container,items,callback){container.replaceChildren();for(const item of items){
   const b=node('button','sec piph-chip',item.label);b.type='button';b.addEventListener('click',()=>callback(item));container.append(b);
 }}
 function showFlow(id){const s=FLOWS?.step(id);if(!s)return;
  msg('pip',s.opening||s.answer,'Guided help',s.action);
  if(s.choices){const holder=node('div','piph-choices');chips(holder,s.choices,choice=>showFlow(choice.next));log.append(holder);log.scrollTop=log.scrollHeight}
  notice('Guidance from Pip’s built-in knowledge. Nothing was sent online.');
 }
 function showMenu(){if(!FLOWS)return;const holder=node('div','piph-choices');chips(holder,FLOWS.menu,item=>showFlow(item.id));
  if(window.FlossFoxPipReadinessUI?.chooseForChat){
    const btn=node('button','sec piph-chip','Check my project readiness');btn.type='button';
    btn.addEventListener('click',()=>{window.FlossFoxPipReadinessUI.chooseForChat(log,t=>msg('pip',t,'Calculated offline'));notice('Checked on this device without changing anything. Nothing was sent online.')});
    holder.append(btn);
  }
  log.append(holder)}
 function offline(question){
  if(window.FlossFoxPipReadinessUI?.chooseForChat&&/\b(?:my project readiness|project readiness|is my project ready|what am i missing|what do i still need|project status)\b/i.test(question)){
    msg('user',question);window.FlossFoxPipReadinessUI.chooseForChat(log,t=>msg('pip',t,'Calculated offline'));
    notice('Checked on this device without changing anything. Nothing was sent online.');field.value='';return;
  }
  const local=window.FlossFoxPipLocalRouter?.route(question)||TOOLS?.answer(question)||KB.lookup(question);
  msg('user',question);
  if(local){msg('pip',local.answer,local.source==='local calculation'?'Calculated offline':local.source==='local inventory'?'Local collection':local.source==='local action'?'Local task':'Built-in help',local.actions?.[0]);if(local.action==='pattern'&&window.FlossFoxPatternUI?.open)window.FlossFoxPatternUI.open();
   notice('Answered on this device. Nothing was sent online.');
  }else{msg('pip','I don\'t have a reliable built-in answer for that yet. '+(onlineReady?'You can try the guided help below, or choose “Ask online AI” and review exactly what will be sent.':'You can try the guided help below.'),'Built-in help');showMenu();notice('No built-in answer for that. Nothing was sent online.');}
  field.value='';
 }
 function cancelPending(){pending=null;if(preview)preview.hidden=true;turnstileToken='';if(window.turnstile&&turnstileId!==null){try{window.turnstile.reset(turnstileId)}catch{}}}
 function clear(){stamp++;abort?.abort();abort=null;busy=false;aiHistory=[];if(log){log.replaceChildren();msg('pip','Ask me about cross-stitch, or choose a guided topic. Everything stays on this device unless you approve a specific online request.','Built-in help');showMenu()}if(field)field.value='';cancelPending();setBusy(false);notice('Chat cleared from this page.');}
 function setBusy(on){busy=on;if(field)field.disabled=on;if(sendButton)sendButton.disabled=on;if(onlineButton)onlineButton.disabled=on||!onlineReady;if(confirmButton)confirmButton.disabled=on||!!(cfg.turnstileSiteKey&&!turnstileToken)}
 async function loadChallenge(){
  if(!cfg.turnstileSiteKey)return;
  turnstileToken='';confirmButton.disabled=true;
  const slot=preview.querySelector('.piph-challenge');slot.replaceChildren();
  if(challengeLoading)return;
  if(window.turnstile&&turnstileId!==null){try{window.turnstile.remove(turnstileId)}catch{}turnstileId=null}
  if(!window.turnstile){challengeLoading=true;
   try {await new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.referrerPolicy='no-referrer';script.onload=resolve;script.onerror=reject;document.head.append(script);
   })}catch{notice('Online verification could not load. Built-in help still works.');return}
   finally{challengeLoading=false}
  }
  if(!pending||!window.turnstile)return;
  try{turnstileId=window.turnstile.render(slot,{sitekey:cfg.turnstileSiteKey,theme:'auto',size:'flexible',action:'pip_chat',callback:token=>{turnstileToken=String(token||'');confirmButton.disabled=!turnstileToken;notice('Verification ready. Review and approve your message.')},'expired-callback':()=>{turnstileToken='';confirmButton.disabled=true;notice('Verification expired. Please complete it again.')},'error-callback':()=>{turnstileToken='';confirmButton.disabled=true;notice('Verification unavailable. Please use built-in help.')}})}
  catch{notice('Verification could not start. Use built-in help instead.')}
 }
 function prepareOnline(){const message=field.value.trim();if(!message||busy)return;
  if(!onlineReady){notice('Online AI isn\'t turned on right now, but built-in help is ready.');return}
  if(message.length>MAX_MSG){notice('That question is a bit long. Try shortening it.');return}
  const outgoing={message,history:aiHistory.slice(-MAX_HISTORY).map(m=>({role:m.role,text:m.text.length>400?m.text.slice(0,399)+'…':m.text}))};
  // Never silently redact: that would alter meaning. Require user editing instead.
  const flagged=PRIVACY?.scan([message,...outgoing.history.map(x=>x.text)].join('\n'))||[];
  if(flagged.length){notice(`Please remove possible private details before using online AI: ${flagged.join(', ')}. The check is not comprehensive.`);return}
  pending=outgoing;preview.hidden=false;
  preview.querySelector('.piph-preview-text').textContent=message;
  const preceding=preview.querySelector('.piph-preview-history');preceding.textContent=outgoing.history.length?outgoing.history.map(x=>`${x.role==='user'?'You':'Pip'}: ${x.text}`).join('\n\n'):'None';
  confirmButton.disabled=!!cfg.turnstileSiteKey;
  if(cfg.turnstileSiteKey)void loadChallenge();
  else if(cfg.requireTurnstile){confirmButton.disabled=true;notice('Online protection is not configured. No request was sent.');return}
  notice('Your question has not been sent. Review the exact question and recent AI history below. Online verification may contact Cloudflare.');
  preview.querySelector('.piph-confirm').focus();
 }
 async function sendOnline(){if(!pending||busy||!onlineReady)return;
  if(cfg.requireTurnstile&&!turnstileToken){notice('Complete the online verification first.');return}
  const outbound=pending;const proof=turnstileToken;
  // Defensive second pass before network. Saved inventory/project data are NEVER read.
  if(PRIVACY?.scan([outbound.message,...outbound.history.map(x=>x.text)].join('\n')).length){cancelPending();notice('This message appears to contain private details. Nothing was sent.');return}
  cancelPending();msg('user',outbound.message,'Sent to online AI');
  if(field.value===outbound.message)field.value='';
  const current=++stamp;const controller=new AbortController();abort=controller;setBusy(true);notice('Waiting for the AI service…');
  const timer=setTimeout(()=>controller.abort(),13000);
  try{
   const data={...outbound};if(proof)data.turnstileToken=proof;
   const response=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
   const json=await response.json().catch(()=>({}));if(current!==stamp)return;
   if(!response.ok){const errors={400:'That question could not be processed.',403:'AI is not available from this website.',429:'Online AI has reached its usage limit.',503:'Online AI is temporarily unavailable.'};msg('pip',errors[response.status]||'The AI service did not respond. Try built-in help instead.','Online service');return}
   if(typeof json.answer!=='string'||!json.answer.trim())throw Error('No content');
   const answer=json.answer.slice(0,2200);msg('pip',answer,'Online AI · may be incorrect');
   aiHistory.push({role:'user',text:outbound.message},{role:'model',text:answer});aiHistory=aiHistory.slice(-MAX_HISTORY);
   notice('Online answer. Verify numbers using the Floss Fox tools.');
  }catch(e){if(current===stamp)msg('pip',e?.name==='AbortError'?'The AI service timed out. Offline help still works.':'Could not connect to online AI. Offline help still works.','Online service')}
  finally{clearTimeout(timer);if(current===stamp){abort=null;setBusy(false);field.focus()}}
 }
 function makeDialog(){if(dialog)return;
  dialog=node('dialog','piph-dialog');dialog.id='pipHybridDialog';dialog.setAttribute('aria-label','Chat with Pip');
  const layout=node('section','piph-layout');const hdr=node('header','piph-header');
  const img=node('img');img.src='assets/pip/pip-face-icon-160.webp';img.alt='';img.width=52;img.height=52;
  const wrap=node('div');wrap.append(node('h2','', 'Chat with Pip'),node('p','', onlineReady?'Offline guide · optional AI by permission':'Offline guide'));
  const close=node('button','piph-close','Close');close.type='button';close.addEventListener('click',()=>dialog.close());hdr.append(img,wrap,close);
  log=node('div','piph-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
  const controls=node('form','piph-controls');const info=node('p','piph-note',onlineReady?'Offline answers never leave this browser. For online AI, you approve the exact message and recent online conversation before sending. Do not share confidential details.':'Pip answers from built-in help on this device. Nothing you type leaves this browser.');
  field=node('textarea');field.id='piphMessage';field.maxLength=MAX_MSG;field.placeholder='Ask Pip about cross-stitch…';field.setAttribute('aria-label','Question for Pip');
  field.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!busy)controls.requestSubmit()}});
  const actions=node('div','piph-actions');const clearBtn=node('button','sec','Clear chat');clearBtn.type='button';clearBtn.addEventListener('click',clear);
  sendButton=node('button','pri','Ask offline');sendButton.type='submit';
  onlineButton=node('button','sec','Ask online AI');onlineButton.type='button';onlineButton.disabled=!onlineReady;onlineButton.hidden=!onlineReady;/* CI005: AI-only control hidden while AI is off */onlineButton.addEventListener('click',prepareOnline);
  status=node('span','piph-status','Built-in help ready.');status.setAttribute('role','status');
  actions.append(clearBtn,sendButton,onlineButton);controls.append(info,field,actions,status);
  preview=node('section','piph-preview');preview.hidden=true;preview.setAttribute('aria-label','Review information sent online');
  preview.append(node('h3','', 'Review before sending'),node('p','piph-note','Your question and the recent online AI conversation excerpts below will leave this device. Local projects and thread collections are not included. The provider may log requests for safety.'));
  const pQuestion=node('pre','piph-preview-text');const pHistory=node('pre','piph-preview-history');
  preview.append(node('h4','', 'Question'),pQuestion,node('h4','', 'Recent online conversation'),pHistory,node('div','piph-challenge'));
  const reviewButtons=node('div','piph-actions');const cancel=node('button','sec','Cancel');cancel.type='button';cancel.addEventListener('click',()=>{cancelPending();field.focus()});
  confirmButton=node('button','pri piph-confirm','Approve and send');confirmButton.type='button';confirmButton.addEventListener('click',()=>{void sendOnline()});
  reviewButtons.append(cancel,confirmButton);preview.append(reviewButtons);
  controls.addEventListener('submit',e=>{e.preventDefault();const question=field.value.trim();if(!question||busy)return;cancelPending();offline(question)});
  layout.append(hdr,log,controls,preview);dialog.append(layout);document.body.append(dialog);
  dialog.addEventListener('close',()=>{stamp++;abort?.abort();abort=null;setBusy(false);cancelPending()});
  msg('pip','Hi! I can help with stitching questions and show you around Floss Fox. Pick a topic or type your question.','Built-in help');showMenu();
 }
 function open(){makeDialog();if(!dialog.open)dialog.showModal();field.focus()}
 function decorateAskPanel(panel){if(!panel||panel.querySelector('[data-piph-open]'))return;
  const btn=node('button','sec piph-open','Chat with Pip');btn.type='button';btn.dataset.piphOpen='true';btn.addEventListener('click',open);
  const row=node('div','row');row.append(btn);const topics=panel.querySelector('.atopics');if(topics)topics.insertAdjacentElement('afterend',row);else panel.append(row);
 }
 window.FlossFoxPipHybrid=Object.freeze({decorateAskPanel,open,version:'0.2.0'});
})();
