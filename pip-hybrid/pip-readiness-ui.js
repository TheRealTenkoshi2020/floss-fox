/* Pip Project Readiness - local-only optional UI & chat chooser.
 * Deliberately uses the PUBLIC computed project plan, not its own estimator.
 * Does not read localStorage, send fetch, or write to project/inventory data.
 */
(function(root){'use strict';
const CORE=root.FlossFoxPipReadiness;
if(!CORE)return;
const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
function api(){return root.FlossFoxProjects}
/* ---- User-facing strings (functional labels; Pixel may replace wording). Listed in /workspace/ci005/STRINGS_FOR_PIXEL.md ---- */
const STR=Object.freeze({
 title:'Pip\'s readiness check',
 intro:'This uses the same choices and amounts as your shopping list. If you\'ve saved a storage location in My Thread Collection, you\'ll see it here.',
 confirmed:'Have enough',
 buy:'Need to buy',
 awaiting:'Waiting to check in',
 unknown:'Check first',
 stored:'Stored:',
 noSpot:'no storage location saved',
 toBuy:n=>`${n} to buy`,
 estimates:'Some amounts are Pip\'s estimates, so real thread use may vary.',
 counts:r=>`${r.counts.ready} of ${r.total} have enough · ${r.counts.toBuy} to buy · ${r.counts.awaiting} to check in · ${r.counts.review} to check first`,
 unavailable:'We couldn\'t show the readiness check just now. The project summary is still up to date.',
 chatIntro:'Pick a project and I\'ll open its readiness check right inside it.',
 chatNone:'You don\'t have any saved projects yet. Add some colors on Find My Floss and save a project, then I can check it.',
 chatOpened:name=>`I opened “${name}” for you. Its readiness check is just below the project summary.`
});
function storageMap(project){const T=root.FlossFoxThreadsUI;if(!T||typeof T.data!=='function')return{};const d=T.data()||{};return (project&&project.demo?d.demo:d.threads)||{}}
/* One in-project readiness view. Takes the plan the project editor already computed (no second calculation). */
/* Flow pass item 7: folded by default to keep the project page short; stays open once you open it. */
const OPENR={};
function renderInto(host,project,plan){if(!host)return;host.replaceChildren();let r;
 try{r=CORE.summarize(JSON.parse(JSON.stringify(project)),plan,storageMap(project))}catch{host.append(create('p','hint',STR.unavailable));return}
 if(!r.total){host.hidden=true;return}host.hidden=false;
 const det=create('details','ff-readiness ff-readiness-inline');det.open=!!OPENR[project.id];det.addEventListener('toggle',()=>{OPENR[project.id]=det.open});const sum=create('summary','',STR.title+' ');sum.append(create('span','mut',`(${STR.counts(r)})`));det.append(sum,create('p','hint',STR.intro));
 const rows=[['have',STR.confirmed,r.groups.have.concat(r.groups.received)],['buy',STR.buy,r.groups.buy],['awaiting',STR.awaiting,r.groups.awaiting],['review',STR.unknown,r.groups.review]];
 for(const [key,label,list] of rows){if(!list.length)continue;const g=create('div','ff-rg ff-rg-'+key);g.dataset.group=key;g.append(create('h4','',`${label} (${list.length})`));const ul=create('ul','ff-readiness-list');
  for(const t of list){const li=create('li');li.dataset.code=t.code;li.append(create('b','',`DMC ${t.code}`));if(t.remaining!==null&&t.remaining!==undefined)li.append(document.createTextNode(' · '+STR.toBuy(t.remaining)));
   if(t.location||key==='have'||key==='review')li.append(create('span',t.location?'ff-loc':'ff-loc mut',t.location?` · ${STR.stored} ${t.location}`:` · ${STR.noSpot}`));if(t.reason&&key==='review')li.append(create('span','mut',' · '+t.reason));ul.append(li)}
  g.append(ul);det.append(g)}
 if(r.hasEstimates)det.append(create('p','hint',STR.estimates));host.append(det)}
function projects(){return (api()?._store()?.projects||[]).filter(p=>p&&p.demo!==true).map(p=>({id:p.id,name:p.name||'Untitled project'}))}
function inspect(id){const P=api();if(!P||typeof P.plan!=='function')throw new Error('Project planner unavailable');
 const p=P._store().projects.find(p=>p.id===id&&p.demo!==true);if(!p)throw new Error('Project not found');
 // No clones written back; all resulting objects are created by the existing plan function.
 const storage=root.FlossFoxThreadsUI?.data()?.threads||{};
 const snapshot=JSON.parse(JSON.stringify(p)); // prevents any future plan-side mutation of saved user objects
 return CORE.summarize(snapshot,P.plan(snapshot),storage);
}
function explain(id){return CORE.toText(inspect(id))}
function chooseForChat(host,respond){
 if(!host||typeof respond!=='function')return;
 const all=projects(),holder=create('div','piph-choices');
 if(!all.length){respond(STR.chatNone);return}
 respond(STR.chatIntro);
 for(const p of all){const b=create('button','sec piph-chip',p.name);b.type='button';b.addEventListener('click',()=>{
  holder.remove();try{respond(STR.chatOpened(p.name));const dlg=document.getElementById('pipHybridDialog');if(dlg&&dlg.open)dlg.close();api().open(p.id);const el=document.getElementById('pReady');if(el){const d=el.querySelector('details');if(d)d.open=true;el.scrollIntoView({block:'start'})}}catch{respond(STR.unavailable)}
 });holder.append(b)}host.append(holder);
}
function mount(){const view=document.getElementById('projectsView');if(!view||view.querySelector('#pipProjectReadiness'))return;
 const panel=create('section','card ff-readiness');panel.id='pipProjectReadiness';
 const heading=create('h2','', 'Pip’s Project Readiness Check');
 const note=create('p','hint','This check only reads your project, on this device. It uses the same choices and amounts as your shopping list, and skips skeins set aside for other projects.');
 const form=create('div','ff-readiness-controls');const lbl=create('label','', 'Project to check');const select=create('select');select.id='ffReadinessProject';lbl.htmlFor=select.id;
 const button=create('button','sec','Check this project');button.type='button';
 const details=create('div','ff-readiness-result');details.setAttribute('role','status');details.setAttribute('aria-live','polite');
 function choices(){const previously=select.value;select.replaceChildren();const all=projects();for(const p of all){const o=create('option','',p.name);o.value=p.id;select.append(o)}if(all.some(p=>p.id===previously))select.value=previously;button.disabled=!all.length;}
 function render(){choices();details.replaceChildren();if(!select.value){details.append(create('p','hint','Save a project to check its readiness.'));return}
  try{const r=inspect(select.value);details.append(create('p','ff-readiness-heading',r.ready?'Ready according to your project plan':'Still needs attention'));
    details.append(create('p','',`${r.counts.ready}/${r.total} accounted for · ${r.counts.toBuy} need buying · ${r.counts.awaiting} waiting to check in · ${r.counts.review} to review`));
    if(r.hasEstimates)details.append(create('p','hint','Includes provisional skein estimates. Actual thread use varies.'));
    const sections=[['review','Check first'],['buy','Need to buy'],['awaiting','Waiting to check in'],['have','Have enough'],['received','Received']];
    for(const [key,label] of sections){if(!r.groups[key].length)continue;const h=create('h3','',label);const ul=create('ul','ff-readiness-list');for(const t of r.groups[key]){
      const text=`DMC ${t.code}${t.remaining!==null?` · ${t.remaining} still to buy`:''}${t.location?` · Stored: ${t.location}`:''}${t.reason?` · ${t.reason}`:''}`;
      ul.append(create('li','',text));
    }details.append(h,ul)}
    details.append(create('p','hint',r.notice));
  }catch{details.append(create('p','hint','I couldn\'t work this one out just now. Open the project to check its details.'))}
 }
 button.addEventListener('click',render);form.append(lbl,select,button);panel.append(heading,note,form,details);
 view.insertBefore(panel,view.querySelector('#projListCard')||view.firstChild);
 // Choices are refreshed at button press; never mutate user data or subscribe to private storage events.
 choices();
}
/* 2.0A: the standalone panel with its own picker is retired; readiness lives inside each project (renderInto). mount() kept for compatibility. */
root.FlossFoxPipReadinessUI=Object.freeze({projects,inspect,explain,chooseForChat,mount,renderInto,STR});
})(typeof window!=='undefined'?window:globalThis);
