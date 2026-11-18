/* Floss Fox 3.9: Guided Experience (test-site candidate)
   Presentation-only progressive enhancement. Does not write localStorage,
   sessionStorage, projects, threads, backups or account state. No network.
   Reuses existing tab controls and approved Pip artwork. */
(function(root){
  'use strict';
  if(root.FlossFoxGuidedUX)return;
  const doc=root.document;
  if(!doc)return;
  const $=id=>doc.getElementById(id);
  const made=(tag,cls)=>{const e=doc.createElement(tag);if(cls)e.className=cls;return e};
  const TAB_NAMES={tabShop:'Shopping',tabFabric:'Fabric',tabHelp:'Help',tabSettings:'Settings',tabThreadwood:"Pip's Den"};
  const SECONDARY=['tabShop','tabFabric','tabHelp','tabSettings'];
  const OPTIONAL=['tabThreadwood']; // added by threadwood/ui.js when present; never required
  const state={landing:false,navigation:false};

  function activeProject(){
    try{
      const api=root.FlossFoxProjects;
      if(!api||typeof api._store!=='function')return null;
      const store=api._store();
      if(!store||!Array.isArray(store.projects))return null;
      const rows=store.projects.filter(p=>p&&typeof p.id==='string'&&p.id&&p.demo!==true&&p.status!=='done');
      rows.sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')));
      return rows[0]||null;
    }catch(_){return null;}
  }
  function label(anchor,title,subtitle){
    if(!anchor)return;
    const b=anchor.querySelector('b'),s=anchor.querySelector('small');
    if(b)b.textContent=title;
    if(s)s.textContent=subtitle;
  }
  function enhanceLanding(){
    if(state.landing)return true;
    const landing=$('ffLanding'),choices=landing&&landing.querySelector('nav.choices');
    if(!choices)return false;
    const get=id=>choices.querySelector('a[data-tab="'+id+'"]');
    const convert=get('tabConvert'),threads=get('tabThreads'),projects=get('tabProjects'),shop=get('tabShop'),fabric=get('tabFabric');
    if(!convert||!threads||!projects||!shop||!fabric)return false;
    // Keep the original nodes, hrefs, event delegation, Start here tag, and tour.
    label(convert,'Find colors for a pattern','Enter DMC numbers or import a pattern');
    label(projects,'Start or continue a project','Create, open, and manage stitching projects');
    label(threads,'Organize my threads','See what threads I own and what I need');
    const hint=made('p','ffux-choice-hint');
    hint.id='ffuxChoiceHint';
    hint.textContent='Choose what you want to do. You can explore every tool at any time.';
    choices.insertBefore(hint,convert);
    // Three main decisions in task order; the others stay one tap away.
    const toolBox=made('details','ffux-landing-tools');
    toolBox.id='ffuxLandingTools';
    const summary=made('summary');summary.textContent='All tools';
    const more=made('div','ffux-landing-more');
    toolBox.append(summary,more);
    choices.insertBefore(projects,threads);
    choices.insertBefore(toolBox,shop);
    more.append(shop,fabric);

    const active=activeProject();
    if(active){
      const resume=made('button','ffux-resume');
      resume.id='ffuxResume';resume.type='button';
      const lead=made('span','ffux-resume-kicker');lead.textContent='Ready to pick up your stitching?';
      const name=made('strong','ffux-resume-name');
      const n=typeof active.name==='string'&&active.name.trim()?active.name.trim():'Your project';
      name.textContent='Continue: '+(n.length>62?n.slice(0,61)+'…':n);
      resume.append(lead,name);
      resume.addEventListener('click',()=>{
        try{
          const p=root.FlossFoxProjects;
          // Recheck to avoid navigating to a project deleted since rendering.
          const latest=activeProject();
          const exists=p&&p._store&&p._store().projects.some(x=>x&&x.id===active.id&&x.demo!==true);
          if(!latest||!exists||typeof p.open!=='function'){
            const tab=$('tabProjects');if(tab){doc.documentElement.classList.remove('ff-landing');tab.click();}
            return;
          }
          doc.documentElement.classList.remove('ff-landing');
          p.open(active.id); // Existing app's navigation and project editor; no writes.
          root.scrollTo&&root.scrollTo(0,0);
          const h=$('projEdit')&&$('projEdit').querySelector('h2,h3');
          if(h){h.tabIndex=-1;h.focus({preventScroll:true});}
        }catch(_){const tab=$('tabProjects');if(tab){doc.documentElement.classList.remove('ff-landing');tab.click();}}
      });
      choices.insertBefore(resume,hint);
      if(root.FlossFoxThreadwood&&typeof root.FlossFoxThreadwood.show==='function'){
        const den=made('button','ffux-den-link');den.id='ffuxDenLink';den.type='button';den.textContent="Or spend a moment with Pip in Pip's Den";
        den.addEventListener('click',()=>{doc.documentElement.classList.remove('ff-landing');try{root.FlossFoxThreadwood.show();}catch(_){}});
        choices.insertBefore(den,hint);
      }
    }
    landing.classList.add('ffux-landing');
    state.landing=true;
    return true;
  }

  function enhanceNav(){
    if(state.navigation)return true;
    const nav=doc.querySelector('nav.tabs');
    if(!nav)return false;
    const tabs=SECONDARY.map(id=>$(id));
    if(tabs.some(n=>!n||!nav.contains(n)))return false;
    const menu=made('details','ffux-nav-more');menu.id='ffuxNavMore';
    const summary=made('summary','ffux-nav-summary');summary.id='ffuxNavSummary';
    const list=made('div','ffux-nav-list');list.id='ffuxNavList';
    menu.append(summary,list);
    nav.append(menu);
    for(const tab of tabs)list.append(tab); // Move controls, never replace them or their handlers.
    OPTIONAL.forEach(id=>{const t=$(id);if(t&&nav.contains(t)){list.append(t);tabs.push(t);}});
    const sync=()=>{
      let selected=null;
      for(const tab of tabs){
        const on=tab.getAttribute('aria-pressed')==='true'||
          (tab.id==='tabFabric'&&root.location&&root.location.pathname.endsWith('/fabric.html'));
        if(on){selected=tab;break;}
      }
      const txt=selected?'More: '+TAB_NAMES[selected.id]:'More tools';
      if(summary.textContent!==txt)summary.textContent=txt;
      summary.setAttribute('aria-label',selected?'More tools. '+TAB_NAMES[selected.id]+' selected':'More tools');
      if(selected)summary.setAttribute('aria-current','page');else summary.removeAttribute('aria-current');
    };
    menu.addEventListener('click',e=>{
      if(e.target.closest&&e.target.closest('#ffuxNavList > button, #ffuxNavList > a')){
        // The app's existing button handlers still run; collapse after navigation.
        root.setTimeout(()=>{menu.open=false;sync();},0);
      }
    });
    const watch=new MutationObserver(sync);
    tabs.forEach(tab=>watch.observe(tab,{attributes:true,attributeFilter:['aria-pressed','aria-current']}));
    const primary=['tabWorkbasket','tabConvert','tabThreads','tabProjects'];
    primary.forEach(id=>{const el=$(id);if(el)watch.observe(el,{attributes:true,attributeFilter:['aria-pressed','aria-current']});});
    doc.addEventListener('click',e=>{
      if(!menu.open)return;
      if(!menu.contains(e.target))menu.open=false;
    });
    root.addEventListener('hashchange',()=>root.setTimeout(sync,0));
    nav.classList.add('ffux-tabs');
    sync();
    state.navigation=true;
    return true;
  }
  function boot(){enhanceLanding();enhanceNav();}
  root.FlossFoxGuidedUX=Object.freeze({version:'test-ux-1',boot,activeProject,enhanceLanding,enhanceNav,state:()=>({...state})});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);
  else boot();
})(typeof window!=='undefined'?window:undefined);
