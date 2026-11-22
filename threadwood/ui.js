/* The Threadwood — Pip's Den. Progressive enhancement for dev test site.
   Keepsake data stays local, independent of projects/inventory. Does not call AI endpoints or analytics.
   No streaks, guilt prompts, fake presence, automatic photo uploads, or subscription requirements.
*/
(function(root){'use strict';
const C=root.FlossFoxThreadwoodCore,S=root.FlossFoxThreadwoodStore,TXT=root.FlossFoxThreadwoodContent;
const P=root.FlossFoxProjects,T=root.FlossFoxThreadsUI;
if(!C||!S||!TXT||!P||!P.showView||!document.querySelector('nav.tabs')||document.getElementById('threadwoodView'))return;
const $=id=>document.getElementById(id),nav=document.querySelector('nav.tabs');
const key=(P.KEY||'flossfox.v1').replace(/\.v1$/,'')+'.threadwood.v1';
let store;try{store=S.make(root.localStorage,key)}catch(e){return}
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x};
const btn=(label,fn,cls='sec')=>{const x=el('button',cls,label);x.type='button';x.addEventListener('click',fn);return x};
const h=(tag,txt,cls)=>el(tag,cls,txt);
const msg=(t)=>{const x=$('twStatus');if(x)x.textContent=t};
function id(){return 'tw_'+(root.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2))}
function projects(){return C.projectList(P)}
function project(id){return projects().find(p=>p.id===id)||null}
function ownedCount(){try{return Object.keys(T.data().threads||{}).length}catch(e){return 0}}
function safeOpen(view){viewBox.hidden=true;tab.setAttribute('aria-pressed','false');tab.removeAttribute('aria-current');P.showView(view)}
function showDen(fromHash=false){P.showView('threadwood',fromHash);viewBox.hidden=false;tab.setAttribute('aria-pressed','true');tab.setAttribute('aria-current','page');render();try{viewBox.querySelector('h1').focus({preventScroll:true})}catch(e){};}
const tab=btn("Pip's Den",()=>showDen(),'tw-nav');tab.id='tabThreadwood';tab.setAttribute('aria-pressed','false');tab.setAttribute('aria-controls','threadwoodView');tab.setAttribute('title',"Visit Pip's Den in the Threadwood");nav.append(tab); // 3.9: guided-ux.js moves this into More tools; Pip's Den is optional, never a competing home
const viewBox=el('section','threadwood');viewBox.id='threadwoodView';viewBox.hidden=true;viewBox.setAttribute('aria-label',"Pip's Den");
const anchor=$('convertView');(anchor&&anchor.parentNode?anchor.parentNode:nav.parentNode).insertBefore(viewBox,anchor||nav.nextSibling);
nav.addEventListener('click',event=>{if(!event.target.closest('#tabThreadwood, summary')){viewBox.hidden=true;tab.setAttribute('aria-pressed','false');tab.removeAttribute('aria-current')}});
root.addEventListener('hashchange',()=>{if(location.hash==='#threadwood')showDen(true);else{viewBox.hidden=true;tab.setAttribute('aria-pressed','false');tab.removeAttribute('aria-current')}});
root.addEventListener('popstate',()=>{if(location.hash==='#threadwood')showDen(true);else viewBox.hidden=true});
// 3.9: any existing navigation that reveals another view (search, Continue, deep links) closes the Den.
{const hideDen=()=>{viewBox.hidden=true;tab.setAttribute('aria-pressed','false');tab.removeAttribute('aria-current')};
 const mo=new MutationObserver(()=>{if(viewBox.hidden)return;for(const id of ['workbasketView','convertView','threadsView','projectsView','shopView','helpView','settingsView']){const v=$(id);if(v&&!v.hidden){hideDen();break}}});
 for(const id of ['workbasketView','convertView','threadsView','projectsView','shopView','helpView','settingsView']){const v=$(id);if(v)mo.observe(v,{attributes:true,attributeFilter:['hidden']})}}
let tipOffset=0,pendingPhoto='',running=false,started=0;
let draft=(store.read().ok?store.read().state.draft:{seconds:0,projectId:''});
const prettyDate=iso=>{try{return new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}catch(e){return''}};
function focusArea(which){const box=$('tw'+which);if(box){box.open=true;box.scrollIntoView({block:'start',behavior:'auto'});const summary=box.querySelector('summary');if(summary)summary.focus()}}
function currentTip(){const t=TXT.treasures;return t[(C.dayIndex(new Date().toISOString().slice(0,10),t.length)+tipOffset)%t.length]}
function createHero(projs){const top=el('header','tw-hero'),copy=el('div','tw-hero-copy'),eyebrow=h('p','THE THREADWOOD','tw-eyebrow'),g=C.welcome(projs,ownedCount());
 const title=h('h1',g.title);title.tabIndex=-1;const desc=h('p',g.line,'tw-lead');copy.append(eyebrow,title,desc);
 const acts=el('div','tw-actions');acts.append(btn(g.action,()=>g.projectId?P.open(g.projectId):safeOpen(projs.length?'projects':'convert'),'pri'));
 acts.append(btn('Spend a moment with Pip',()=>focusArea('Pip'),'ghost'));
 copy.append(acts);const pic=el('picture','tw-pip');const src=el('source');src.type='image/webp';src.srcset='assets/pip/pip-greeting-160.webp';const im=el('img');im.src='assets/pip/pip-greeting-160.png';im.alt='Pip the fox, your familiar stitching guide';im.width=160;im.height=160;im.loading='lazy';pic.append(src,im);top.append(copy,pic);return top}
function buildShortcut(){const box=el('nav','tw-shortcuts');box.setAttribute('aria-label','What would you like to do?');
 box.append(btn('My threads',()=>safeOpen('threads'),'tw-tile'),btn('My projects',()=>safeOpen('projects'),'tw-tile'),btn('Stitchside',()=>focusArea('Session'),'tw-tile'),btn('My journey',()=>focusArea('Journey'),'tw-tile'));return box}
function pipReply(kind,projs){const active=projs.find(p=>p.status!=='done');switch(kind){
 case 'continue':return active?'You have '+active.name+' underway. Shall I open it so you can pick up where you stopped?':'No active project is saved yet. We can start one whenever you feel like it.';
 case 'tip':return currentTip().body;
 case 'discover':return 'I found something for the curious stitcher. Open Pip’s Treasures below for a small idea to try.';
 case 'quiet':return 'We can simply look at what you have made, or enjoy a quiet minute. The threadwork will be here when you are ready.';
 case 'stash':return ownedCount()?'Your collection holds '+ownedCount()+' recorded colors. Would you like to browse them?':'Your collection is empty right now. You can add colors by hand or bring an existing list into FlossFox.';
 default:return 'What shall we explore?'} }
function buildPip(projs){const area=el('details','tw-panel');area.id='twPip';area.open=false;area.append(h('summary','Talk with Pip'));
 const inner=el('div','tw-inside');inner.append(h('p','A helpful word, a little inspiration, or simply a place to pause.','tw-muted'));
 const speech=h('p','Welcome! Every stitch has its own story. What are you in the mood for?','tw-speech');speech.id='twPipReply';speech.setAttribute('aria-live','polite');inner.append(speech);
 const row=el('div','tw-choices');[['Continue a project','continue'],['A stitching tip','tip'],['Surprise me','discover'],['My collection','stash'],['Just visiting','quiet']].forEach(([label,kind])=>row.append(btn(label,()=>{speech.textContent=pipReply(kind,projects());if(kind==='discover')focusArea('Treasures')},'ghost')));
 inner.append(row,h('p','Pip’s quick replies work offline and use only your saved FlossFox information. They are not reading your thoughts or sending this conversation to a server.','tw-fine'));
 area.append(inner);return area}
function buildTreasures(){const area=el('details','tw-panel');area.id='twTreasures';area.append(h('summary','Pip’s Treasures: quick discoveries'));
 const inner=el('div','tw-inside');inner.append(h('p','A tiny idea whenever you want one. No streaks, no missed-day penalties.','tw-muted'));
 const card=el('article','tw-treasure');function update(){const tip=currentTip(),saved=store.read();title.textContent=tip.title;kind.textContent=tip.kind;body.textContent=tip.body;favorite.textContent=(saved.ok&&saved.state.favorites.includes(tip.id))?'Remove from favorites':'Save this discovery';}
 const kind=h('p','','tw-eyebrow'),title=h('h3',''),body=h('p','');card.append(kind,title,body);inner.append(card);
 const acts=el('div','tw-actions');acts.append(btn('Another discovery',()=>{tipOffset=(tipOffset+1)%TXT.treasures.length;update()},'sec'));
 const favorite=btn('Save this discovery',()=>{const result=store.write(s=>C.toggleFavorite(s,currentTip().id,TXT.treasures.map(x=>x.id)));if(result.ok){render();focusArea('Treasures');msg('Discovery collection updated. You can undo this change.')}else msg(result.error)},'ghost');acts.append(favorite);inner.append(acts);
 const savedHeading=h('h4','My saved discoveries');inner.append(savedHeading);const f=el('ul','tw-saved-tips'),r=store.read();if(r.ok){for(const item of TXT.treasures.filter(t=>r.state.favorites.includes(t.id)))f.append(h('li',item.title+': '+item.body));}if(!f.children.length)f.append(h('li','Nothing saved yet. Pick a discovery you would like to revisit.'));inner.append(f);area.append(inner);update();return area}
function projectSelect(id,labelText,initial=''){const l=el('label','tw-field'),caption=h('span',labelText),s=el('select');s.id=id;const none=el('option');none.value='';none.textContent='No particular project';s.append(none);
 for(const p of projects()){const o=el('option');o.value=p.id;o.textContent=p.name;s.append(o)}s.value=initial;s.setAttribute('aria-label',labelText);l.append(caption,s);return l}
function draftSeconds(){return Math.min(86400,draft.seconds+(running?Math.max(0,Math.floor((Date.now()-started)/1000)):0))}
function tick(){const x=$('twTimer');if(x)x.textContent=C.timeLabel(draftSeconds());const finish=$('twEnd');if(finish)finish.disabled=draftSeconds()<1;}
function pause(){if(!running)return;draft.seconds=draftSeconds();running=false;const save=store.write(s=>{s.draft={...draft};return s});if(!save.ok)msg(save.error);tick();const b=$('twRun');if(b)b.textContent='Resume session'}
function buildSession(){const area=el('details','tw-panel');area.id='twSession';area.append(h('summary','Stitchside: time together'));
 const inner=el('div','tw-inside');inner.append(h('p','A gentle timer for your stitching time. It pauses when the page goes into the background. Logging a session never changes your project progress automatically.','tw-muted'));
 const pick=projectSelect('twSessionProject','Working on',draft.projectId);inner.append(pick);
 const timer=h('p',C.timeLabel(draftSeconds()),'tw-timer');timer.id='twTimer';timer.setAttribute('role','timer');timer.setAttribute('aria-label','Session time');inner.append(timer);
 const actions=el('div','tw-actions');const run=btn(running?'Pause session':(draft.seconds?'Resume session':'Start session'),()=>{
   if(running){pause();return}
   const target=$('twSessionProject').value;
   if(draft.seconds&&target!==draft.projectId){msg('Finish or discard your current session before choosing another project.');return}
   draft.projectId=target;
   const r=store.write(s=>{s.draft={...draft};return s});if(!r.ok){msg(r.error);return}
   started=Date.now();running=true;run.textContent='Pause session';msg('Stitchside is running. Take your time.');tick();
 },'pri');run.id='twRun';actions.append(run);
 const end=btn('Log this session',()=>{pause();if(draft.seconds<1){msg('There is no stitching time to log yet.');return}
   const p=project(draft.projectId),record={id:id(),at:new Date().toISOString(),seconds:Math.min(86400,draft.seconds),projectId:draft.projectId,projectName:p?p.name:''};
   const r=store.write(s=>{const n=C.pushSession(s,record);n.draft={seconds:0,projectId:''};return n});if(!r.ok){msg(r.error);return}
   draft={seconds:0,projectId:''};render();focusArea('Session');msg('Stitchside session saved. No project counts were changed.')},'sec');end.id='twEnd';end.disabled=draftSeconds()<1;actions.append(end);
 actions.append(btn('Discard timer',()=>{if(running)pause();if(draft.seconds>0&&!root.confirm('Discard this unlogged stitching time?'))return;const r=store.write(s=>{s.draft={seconds:0,projectId:''};return s});if(!r.ok){msg(r.error);return}draft={seconds:0,projectId:''};render();focusArea('Session');msg('Timer cleared. No sessions were deleted.')},'ghost'));inner.append(actions);
 const sess=store.read();inner.append(h('h3','Recent sessions'));const list=el('ul','tw-small-list');
 if(sess.ok&&sess.state.sessions.length){for(const rec of sess.state.sessions.slice(0,6)){const li=el('li');li.append(h('span',prettyDate(rec.at)+' · '+C.timeLabel(rec.seconds)+(rec.projectName?' · '+rec.projectName:'')));li.append(btn('Remove',()=>remove(rec.id,'session'),'ghost'));list.append(li)}}else list.append(h('li','No sessions logged yet. That is perfectly fine.'));
 inner.append(list);area.append(inner);return area}
function remove(recordId,type){if(!root.confirm(type==='entry'?'Remove this keepsake? It will only be recoverable from an exported backup.':'Remove this saved session?'))return;
 const r=store.write(s=>C.removeRecord(s,recordId,type));if(r.ok){render();focusArea(type==='entry'?'Journey':'Session');msg('Removed. You can undo the last change.')}else msg(r.error)}
async function compressPhoto(file){if(!file)return'';if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG, or WebP photo.');if(file.size>12000000)throw Error('Please use a photo smaller than 12 MB.');
 const uri=URL.createObjectURL(file);try{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('The photo could not be opened.'));img.src=uri});
 if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>70000000)throw Error('The photo resolution is too large to process.');
 let bound=850,quality=.72,out='';for(let attempt=0;attempt<7;attempt++){
   const scale=Math.min(1,bound/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),ht=Math.max(1,Math.round(img.naturalHeight*scale));
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=ht;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo processing is unavailable in this browser.');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,w,ht);ctx.drawImage(img,0,0,w,ht);out=canvas.toDataURL('image/jpeg',quality);
   if(C.safePhoto(out))return out;bound=Math.max(300,Math.round(bound*.78));quality=Math.max(.42,quality-.045);
 }
 throw Error('This photo is still too large. Try a closer crop or smaller image.');
 }finally{URL.revokeObjectURL(uri)}}
function uploadButton(){const wrap=el('div','tw-upload'),input=el('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.id='twPhoto';const label=el('label','tw-field');label.htmlFor='twPhoto';label.append(h('span','Optional progress photograph'),input);wrap.append(label);
 const info=h('p','A small, location-metadata-free JPEG will be kept on this device.','tw-fine'),preview=el('img','tw-preview');preview.alt='Selected progress photograph';preview.hidden=true;wrap.append(info,preview);
 input.onchange=async()=>{pendingPhoto='';preview.hidden=true;msg('');const f=input.files&&input.files[0];if(!f)return;
   info.textContent='Preparing photo on this device…';try{pendingPhoto=await compressPhoto(f);preview.src=pendingPhoto;preview.hidden=false;info.textContent='Photo prepared locally. Nothing has been saved yet.'}catch(e){info.textContent='Photo not ready: '+e.message;input.value='';}}
 return wrap}
function saveKeepsake(){const p=project($('twJourneyProject').value),note=$('twNote').value.trim();const r=store.write(s=>C.pushEntry(s,{id:id(),at:new Date().toISOString(),note,projectId:p?p.id:'',projectName:p?p.name:'',progressPct:p?p.progressPct:null,photo:pendingPhoto}));
 if(!r.ok){msg(r.error);return}pendingPhoto='';render();focusArea('Journey');msg('Your moment was saved on this device.')}
function addJourneyCard(record){const li=el('li','tw-memory');if(record.photo){const img=el('img','tw-memory-photo');img.src=record.photo;img.alt='Progress photo'+(record.projectName?' of '+record.projectName:'');img.loading='lazy';li.append(img)}
 const content=el('div','tw-memory-text');content.append(h('p',prettyDate(record.at)+(record.projectName?' · '+record.projectName:'')+(record.progressPct!==null?' · '+record.progressPct+'% recorded':''),'tw-muted'));
 if(record.note)content.append(h('p',record.note));const acts=el('div','tw-actions');acts.append(btn('Stitch & Share postcard',()=>postcard(record),'sec'));
 acts.append(btn('Edit note',()=>{if(content.querySelector('textarea'))return;const box=el('textarea');box.value=record.note;box.maxLength=550;box.rows=3;box.setAttribute('aria-label','Edit keepsake note');const save=btn('Save note',()=>{const r=store.write(s=>C.updateNote(s,record.id,box.value));if(r.ok){render();focusArea('Journey');msg('Keepsake updated.')}else msg(r.error)},'pri');content.append(box,save);box.focus()},'ghost'));
 acts.append(btn('Remove',()=>remove(record.id,'entry'),'ghost'));content.append(acts);li.append(content);return li}
function download(filename,text,mime){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function downloadMemories(){try{download('flossfox-threadwood-memories.json',store.exportText(),'application/json');msg('Threadwood keepsake backup prepared. Keep your download somewhere safe.')}catch(e){msg(e.message)}}
async function importMemories(file){if(!file)return;if(file.size>3600000){msg('This keepsake file is too large to restore safely.');return}
 let t;try{t=await file.text()}catch(e){msg('Could not read the file.');return}
 const result=store.importText(t);if(!result.ok){msg(result.error);return}
 if(!root.confirm('Replace all Threadwood keepsakes, saved discoveries and session records with this exported copy? Your existing FlossFox projects and threads will not change.')){msg('Restore cancelled. Nothing was changed.');return}
 const r=store.write(()=>result.preview);if(r.ok){draft=result.preview.draft;running=false;render();focusArea('Journey');msg('Threadwood memories restored. The rest of FlossFox was untouched.')}else msg(r.error)}
function buildKeepsakes(){const area=el('details','tw-panel');area.id='twKeepsakes';area.append(h('summary','The Keepsake Collection: finished projects'));
 const inner=el('div','tw-inside');const finished=projects().filter(p=>p.status==='done');
 inner.append(h('p',finished.length?'The pieces you have marked complete, all in one place.':'No finished projects saved yet. Every piece can have its own pace.','tw-muted'));
 const list=el('ul','tw-small-list');for(const p of finished){const li=el('li');li.append(h('span',p.name+(p.progressPct!==null?' · '+p.progressPct+'% recorded':'')));li.append(btn('Open project',()=>{viewBox.hidden=true;P.open(p.id)},'sec'));list.append(li)}
 inner.append(list);area.append(inner);return area}
function buildJourney(){const area=el('details','tw-panel');area.id='twJourney';area.append(h('summary','The Stitching Journey: little moments worth keeping'));
 const inner=el('div','tw-inside');inner.append(h('p','Remember the stitches, the stories, or simply what today looked like. Add a note, a photo, or both.','tw-muted'));
 const picker=projectSelect('twJourneyProject','Which project is this about?');inner.append(picker);
 const note=el('label','tw-field');note.append(h('span','A thought to remember'));const textarea=el('textarea');textarea.id='twNote';textarea.rows=3;textarea.maxLength=550;textarea.placeholder='A tricky corner, a tiny victory, a gift in progress…';note.append(textarea);inner.append(note,uploadButton());
 inner.append(btn('Save this moment',saveKeepsake,'pri'));
 const r=store.read();inner.append(h('h3','My moments'));const list=el('ul','tw-memories');if(r.ok&&r.state.entries.length){for(const record of r.state.entries.slice(0,30))list.append(addJourneyCard(record));if(r.state.entries.length>30)list.append(h('li','Showing the latest 30 moments. Your export includes all of them.'))}else list.append(h('li','No keepsakes yet. When something matters, make a little note.'));
 inner.append(list);
 const tools=el('div','tw-backup');tools.append(h('h3','Keep your memories safe'),h('p','Your moments, sessions and saved discoveries are included in the full FlossFox backup (Settings, Backup). This separate Threadwood file is an extra copy you can keep.','tw-fine'));
 tools.append(btn('Download Threadwood backup',downloadMemories,'sec'));
 const pick=el('input');pick.type='file';pick.accept='.json,application/json';pick.id='twImportMemories';pick.hidden=true;pick.onchange=async()=>{await importMemories(pick.files&&pick.files[0]);pick.value=''};
 tools.append(btn('Restore Threadwood backup',()=>pick.click(),'ghost'),pick);inner.append(tools);area.append(inner);return area}
function wrapText(ctx,text,maxWidth,x,y,lineHeight,maxLines){const words=String(text).split(/\s+/);let line='',count=0;for(const word of words){const trial=line?line+' '+word:word;if(ctx.measureText(trial).width>maxWidth&&line){ctx.fillText(line,x,y+count*lineHeight);count++;line=word;if(count>=maxLines)break}else line=trial}if(line&&count<maxLines)ctx.fillText(line,x,y+count*lineHeight)}
async function postcard(e){try{const cv=document.createElement('canvas');cv.width=1100;cv.height=780;const ctx=cv.getContext('2d');if(!ctx)throw Error('Postcard creation is not supported in this browser.');ctx.fillStyle='#f5eedf';ctx.fillRect(0,0,1100,780);ctx.fillStyle='#d3ddcd';ctx.fillRect(26,26,1048,728);ctx.fillStyle='#faf7ef';ctx.fillRect(44,44,1012,692);
 ctx.fillStyle='#375540';ctx.font='bold 28px Georgia,serif';ctx.fillText('THE THREADWOOD · A STITCHING MEMORY',86,100);
 if(e.photo){const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('Could not load the photo for a postcard.'));img.src=e.photo});const w=928,h=440,ratio=Math.min(w/img.width,h/img.height),iw=img.width*ratio,ih=img.height*ratio;ctx.fillStyle='#e5d9c7';ctx.fillRect(86,133,w,h);ctx.drawImage(img,86+(w-iw)/2,133+(h-ih)/2,iw,ih)}else{ctx.fillStyle='#e6e9dc';ctx.fillRect(86,133,928,330);ctx.strokeStyle='#9db18e';ctx.lineWidth=2;for(let x=130;x<980;x+=27)for(let y=166;y<429;y+=27){ctx.beginPath();ctx.moveTo(x-5,y-5);ctx.lineTo(x+5,y+5);ctx.moveTo(x+5,y-5);ctx.lineTo(x-5,y+5);ctx.stroke()}}
 const base=e.photo?610:495;ctx.fillStyle='#334a3a';ctx.font='bold 32px Georgia,serif';wrapText(ctx,e.projectName||'A moment in stitches',900,86,base,37,2);
 ctx.fillStyle='#48554b';ctx.font='24px Georgia,serif';wrapText(ctx,e.note||'A little progress, saved for another day.',900,86,base+63,31,e.photo?2:4);
 ctx.font='21px system-ui,sans-serif';ctx.fillText(prettyDate(e.at),86,707);ctx.fillText('Made with FlossFox',780,707);cv.toBlob(blob=>{if(!blob){msg('Could not render the postcard.');return}const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='flossfox-stitching-memory.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);msg('Postcard generated. Check the picture before sharing it.')},'image/png')}
 catch(err){msg(err.message||'Could not create a postcard.')}}
function render(){if(viewBox.hidden)return;const projectsNow=projects(),oldOpen={};viewBox.querySelectorAll('details[id]').forEach(x=>{oldOpen[x.id]=x.open});viewBox.replaceChildren();
 viewBox.append(createHero(projectsNow),buildShortcut(),buildPip(projectsNow),buildSession(),buildTreasures(),buildJourney(),buildKeepsakes());
 const status=h('p','','tw-status');status.id='twStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');viewBox.append(status);
 const undo=btn('Undo last Threadwood change',()=>{if(running)pause();const r=store.undo();if(r.ok){const s=store.read();if(s.ok)draft=s.state.draft;render();msg('Last Threadwood change undone.')}else msg(r.error)},'ghost');undo.classList.add('tw-undo');viewBox.append(undo);
 viewBox.append(h('p','Your FlossFox projects and thread inventory are never changed by visits, conversations or stitching sessions here.','tw-fine'));
 for(const x of viewBox.querySelectorAll('details[id]'))if(Object.prototype.hasOwnProperty.call(oldOpen,x.id))x.open=oldOpen[x.id];tick();}
root.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});root.addEventListener('pagehide',pause);
const interval=setInterval(()=>{if(running&&!viewBox.hidden)tick()},1000);
// Canonical full-backup integration (3.9 dev): read-only export part, additive merge on restore.
function backupPart(){const r=store.read();if(!r.ok)return null;const s=r.state;if(!s.entries.length&&!s.sessions.length&&!s.favorites.length)return null;return{schema:s.schema,entries:s.entries,sessions:s.sessions,favorites:s.favorites}}
function restoreFromBackup(part){if(part===undefined||part===null)return{ok:true,added:0,skipped:true};
 let incoming;try{incoming=C.normalize({...part,draft:{seconds:0,projectId:''}})}catch(e){return{ok:false,error:e.message}}
 const cur=store.read();if(!cur.ok)return{ok:false,error:cur.error};
 const have=new Set([...cur.state.entries.map(x=>x.id),...cur.state.sessions.map(x=>x.id)]);
 const ne=incoming.entries.filter(x=>!have.has(x.id)),ns=incoming.sessions.filter(x=>!have.has(x.id)),nf=incoming.favorites.filter(x=>!cur.state.favorites.includes(x)&&TXT.treasures.some(t=>t.id===x));
 if(!ne.length&&!ns.length&&!nf.length)return{ok:true,added:0};
 const r=store.write(s=>{s.entries=[...s.entries,...ne].sort((a,b)=>b.at.localeCompare(a.at));s.sessions=[...s.sessions,...ns].sort((a,b)=>b.at.localeCompare(a.at));s.favorites=[...s.favorites,...nf];return s});
 if(!r.ok)return{ok:false,error:r.error};if(!viewBox.hidden)render();return{ok:true,added:ne.length+ns.length+nf.length,entries:ne.length,sessions:ns.length,favorites:nf.length}}
if(location.hash==='#threadwood'){const go=()=>{document.documentElement.classList.remove('ff-landing');showDen(true)};if(document.readyState==='complete')setTimeout(go,0);else root.addEventListener('load',()=>setTimeout(go,0))}
root.FlossFoxThreadwood={show:showDen,render,store,backupPart,restoreFromBackup,stop:()=>{pause();clearInterval(interval)}};
if(root.location&&location.hash==='#threadwood')showDen(true);
})(typeof globalThis!=='undefined'?globalThis:this);
