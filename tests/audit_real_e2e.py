#!/usr/bin/env python3
"""Full FlossFox app, isolated synthetic local data; mobile/desktop Chromium.
FF_CHROME=/usr/bin/chromium python tests/audit_real_e2e.py http://127.0.0.1:8765/
No production requests. Test APIs seed inputs; actual controls exercise workflows.
"""
import os, sys, json, copy
from pathlib import Path
from playwright.sync_api import sync_playwright

def unfold(g):
    # calm pass: secondary tools sit in folded details.ffcalm sections; open them like a tester would
    g.wait_for_timeout(50); g.evaluate("document.querySelectorAll('details.ffcalm').forEach(d=>d.open=true)")
B=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765/').rstrip('/')+'/'
KEY='flossfox-dev.v1'; TK='flossfox-dev.threads.v1'; SK='flossfox-dev.stitch-sessions.v1'
COUNT=0

def ok(name,condition,detail=''):
    global COUNT
    if not condition: raise AssertionError(name+': '+str(detail))
    COUNT+=1; print('PASS '+name,flush=True)

def item(code,n):return dict(code=code,qty=n,stated=True,assumed=0,src=['DMC '+code],stitchCount=None)
def proj(pid):return dict(id=pid,name='A very long project name for a fox sampler '+pid,notes='',buyBrand='dmc',status='progress',items=[item('310',2),item('321',1)],decisions={'310':{'status':'buy'},'321':{'status':'buy'}},purchased={},created='2026-11-01T00:00:00Z',updated='2026-11-01T00:00:00Z')
SEED={'schema':2,'projects':[proj('pa'),proj('pb')]}
THREADS={'schema':2,'threads':{'310':{'n':1,'partial':False,'restock':False,'confirmed':True},'321':{'n':2,'partial':False,'restock':False,'confirmed':False}}}
errors=[];outside=[]

def new(br,w=390,seed=True,offline=False):
    c=br.new_context(viewport={'width':w,'height':900},is_mobile=w<500,has_touch=w<500,service_workers='allow' if offline else 'block',accept_downloads=True)
    if seed:
        c.add_init_script('''(()=>{if(!sessionStorage.getItem('audit.seeded')){localStorage.setItem(%s,%s);localStorage.setItem(%s,%s);sessionStorage.setItem('audit.seeded','1')}sessionStorage.setItem('ff.landing.seen','1');localStorage.setItem('flossfox-dev.tour.v1','{"status":"dismissed"}');localStorage.setItem('flossfox-dev.hints.v1','off')})()'''%(json.dumps(KEY),json.dumps(json.dumps(SEED)),json.dumps(TK),json.dumps(json.dumps(THREADS))))
    g=c.new_page();g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)));g.on('dialog',lambda d:d.accept())
    g.on('request',lambda r: outside.append(r.url) if not r.url.startswith((B,'data:','blob:')) else None)
    g.goto(B+('' if offline else '?nosw'));g.wait_for_function('window.FlossFoxAuditUI&&window.FlossFoxGuidedUX');return c,g

def js(g,expr):return g.evaluate(expr)
def raw(g,key):return g.evaluate('(k)=>localStorage.getItem(k)',key)
def wide(g,name):ok(name,js(g,'document.documentElement.scrollWidth<=innerWidth'),g.viewport_size)
def view(g,v):g.evaluate('(v)=>FlossFoxProjects.showView(v)',v)
def openjournal(g):
    g.evaluate("FlossFoxProjects.open('pa')")

    unfold(g)
    if g.locator('#ffauSessions').get_attribute('open') is None:g.locator('#ffauSessions > summary').click()
def backup(g):return js(g,'FlossFoxProjects.fullBackup()')
def restore(g,data,mode='merge',collision='replace'):
    view(g,'projects');js(g,"document.getElementById('backupBox').open=true")
    g.set_input_files('#restoreFile',{'name':'audit.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
    g.wait_for_selector('#rGo');g.check('input[name=imode][value='+mode+']')
    if g.locator('input[name=rmode][value='+collision+']').count():g.check('input[name=rmode][value='+collision+']')
    g.click('#rGo');g.wait_for_selector('#restoreDone')

with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('FF_CHROME','/usr/bin/chromium'),args=['--no-sandbox'])
    c,g=new(br,360,False)
    ok('fresh home keeps three main choices',g.locator('#ffLanding nav.choices > a').count()==3)
    ok('fresh home preserves approved Pip artwork',js(g,"[...document.querySelectorAll('#ffLanding img')].some(i=>i.naturalWidth>0)"))
    wide(g,'fresh home at 360px');c.close()
    for w in (360,390,768,1280):
        for theme in ('morning','moon'):
            c,g=new(br,w);g.evaluate('(t)=>FlossFoxAtelierTheme.apply(t)',theme)
            view(g,'threads');unfold(g);g.locator('#ffauImport').click();ok(f'{w} {theme}: import shortcut opens original importer',g.locator('#ffssFile').is_visible());wide(g,f'{w} {theme}: inventory width')
            # Close through the original toggle; shortcut must reopen the existing hidden input.
            g.locator('#ffSmartStash button.ffss-choice',has_text='Import a list').click();g.locator('#ffauImport').click();ok(f'{w} {theme}: collapsed importer reopens',g.locator('#ffssFile').is_visible())
            view(g,'shop');unfold(g);g.locator('#ffauShopStart').click();ok(f'{w} {theme}: shared 310 subtracts stash once','3 skeins' in g.inner_text('#ffauTrip-310 + span'))
            ok(f'{w} {theme}: uncertain 321 stays check first',g.locator('#ffauTrip-321').count()==0 and '321' in g.text_content('#ffauTrip details'))
            wide(g,f'{w} {theme}: combined trip width');g.screenshot(path=f'../verification/trip-{w}-{theme}.png',full_page=True)
            openjournal(g);wide(g,f'{w} {theme}: journal width');ok(f'{w} {theme}: journal controls labeled',g.get_by_label('Stitches completed',exact=True).count()==1)
            c.close()
    c,g=new(br);view(g,'shop');unfold(g);g.click('#ffauShopStart');before=raw(g,TK);projectsBefore=raw(g,KEY)
    g.check('#ffauTrip-310');ok('Found never changes purchases or stash',raw(g,TK)==before and raw(g,KEY)==projectsBefore)
    g.reload();view(g,'shop');unfold(g);g.click('#ffauShopStart');ok('Found survives reload',g.is_checked('#ffauTrip-310'))
    g.uncheck('#ffauPick-pb');g.get_by_role('button',name='Show combined list',exact=True).click();ok('Selection recalculates real planner','1 skein' in g.inner_text('#ffauTrip-310 + span'))
    g.reload();view(g,'shop');unfold(g);g.click('#ffauShopStart');ok('Selected projects survive reload',not g.is_checked('#ffauPick-pb'))
    openjournal(g);g.fill('#ffauStitches','150');g.fill('#ffauMinutes','45');g.fill('#ffauNotes','A real test of the integrated app')
    g.locator('#ffauSessions form details summary').click();g.fill('#ffauUsageCode','310');g.fill('#ffauUsageQty','0.25');g.fill('#ffauMoreUsage','321 0.50')
    g.get_by_role('button',name='Save stitching session',exact=True).click();ok('Journal saves stitches, time and two recorded usage entries',len(json.loads(raw(g,SK))['sessions'][0]['usage'])==2)
    ok('Journal usage does not deduct inventory',raw(g,TK)==before);ok('Journal recap is actual recorded use','0.75' in g.inner_text('#ffauSessions .ffau-stats'))
    g.fill('#ffauPercent','37');g.get_by_role('button',name='Update percentage',exact=True).click();ok('Manual progress persists and leaves lifecycle unchanged',js(g,"FlossFoxProjects._store().projects.find(p=>p.id==='pa').progressPct===37&&FlossFoxProjects._store().projects.find(p=>p.id==='pa').status==='progress'"))
    g.reload();openjournal(g);ok('Journal survives reload','150 stitches' in g.inner_text('#ffauRecent'))
    data=backup(g);ok('Full backup includes sessions',len(data['stitchSessions']['sessions'])==1)
    snap=js(g,"FlossFoxProjects.rawSnapshot().keys");ok('Snapshots include session sidecar',SK in snap)
    c2,h=new(br,seed=False);h.get_by_role('link',name='Start or continue a project',exact=False).click();restore(h,data,mode='replace');ok('Fresh full-app backup restore roundtrips sessions',json.loads(raw(h,SK))==data['stitchSessions'])
    # Collision copy, skip and replacement are tested against the real restore transaction.
    restore(h,data,collision='copy');ok('Copied projects receive independent sessions',len(json.loads(raw(h,SK))['sessions'])==2)
    prev=raw(h,SK);restore(h,data,collision='skip');ok('Skipped projects keep existing sessions',raw(h,SK)==prev)
    restore(h,data,collision='replace');ok('Replaced projects avoid duplicate historical logs',len(json.loads(raw(h,SK))['sessions'])==2)
    old=copy.deepcopy(data);del old['stitchSessions'];prev=raw(h,SK);restore(h,old,collision='skip');ok('Older backup preserves current sessions',raw(h,SK)==prev)
    bad=copy.deepcopy(data);bad['stitchSessions']['schema']=99;projBefore=raw(h,KEY);sessBefore=raw(h,SK)
    h.set_input_files('#restoreFile',{'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});h.wait_for_timeout(150);ok('Invalid session backup aborts before writes',raw(h,KEY)==projBefore and raw(h,SK)==sessBefore and 'invalid stitching sessions' in h.inner_text('#restorePanel'))
    # Full read-only links with known and uncertain positive quantities.
    packed=g.evaluate("FlossFoxAuditCore.packShare({v:1,t:'shopping',items:[['310',2]],review:[['321',3]]})")
    r=br.new_context(viewport={'width':360,'height':800},service_workers='block');v=r.new_page();v.on('pageerror',lambda e:errors.append(str(e)));v.on('dialog',lambda d:d.accept());v.goto(B+'?nosw#share='+packed);v.wait_for_selector('#ffauShared')
    ok('Opening a share creates no project or inventory',raw(v,KEY) is None and raw(v,TK) is None);ok('Sharing warning is explicit','not encrypted' in v.inner_text('#ffauShared'));wide(v,'Share dialog at 360px')
    v.get_by_role('button',name='Import as a new project',exact=True).click();v.wait_for_selector('#ffauShared',state='detached');shared=json.loads(raw(v,KEY))['projects'][0]
    ok('Explicit shared import creates new independent project',shared['name']=='Shared shopping list');ok('Uncertain positive shared amount stays uncertain',next(x for x in shared['items'] if x['code']=='321')['qty'] is None)
    for suffix in ('!!!','a'*6001):
        v.goto(B+'?nosw#share='+suffix);v.wait_for_selector('#ffauShared');ok('Malformed or oversized share offers no import',v.locator('#ffauShared button',has_text='Import as a new project').count()==0)
    # Opt-in tool remains separate from manufacturer results.
    view(g,'settings');g.check('#ffauColorEnable');view(g,'convert');g.locator('#ffauColor summary').click();g.fill('#ffauHex','#000000');g.get_by_role('button',name='Compare colors',exact=True).click();ok('Opt-in CIEDE2000 produces labeled DMC swatch estimates','DMC 310' in g.inner_text('#ffauColor') and 'not an approved equivalent' in g.inner_text('#ffauColor'))
    g.fill('#ffauHex','#ZZZZZZ');g.get_by_role('button',name='Compare colors',exact=True).click();ok('Invalid HEX is rejected','six-digit' in g.inner_text('#ffauColor'))
    view(g,'help')
    if g.locator('#ffauFeedback').get_attribute('open') is None:g.locator('#ffauFeedback summary').click()
    g.wait_for_selector('#ffauFeedback[open] form')
    ok('Conversion feedback explicitly local-only','not automatically sent' in g.inner_text('#ffauFeedback'),g.inner_text('#ffauFeedback'))
    # Copy feedback on the actual secure localhost clipboard; no server request.
    c.grant_permissions(['clipboard-read','clipboard-write'])
    g.fill('#ffauFeedback [name=brand]','Anchor');g.fill('#ffauFeedback [name=source]','403');g.fill('#ffauFeedback [name=dmc]','310');g.fill('#ffauFeedback [name=notes]','Compared two real skeins under daylight for this synthetic test')
    g.get_by_role('button',name='Copy a review report',exact=True).click();g.wait_for_timeout(100)
    ok('Conversion suggestion copies a structured local report',json.loads(js(g,'navigator.clipboard.readText()'))['proposedDmc']=='310' and 'has not been sent' in g.inner_text('#ffauFeedback'))
    # Snapshot restoration includes the session sidecar, with a safety copy first.
    openjournal(g);snapBefore=raw(g,SK);g.evaluate("FlossFoxSnapshots.take('session',{force:true})")
    g.evaluate("FlossFoxAuditSessions.add({id:'snapshot-extra',projectId:'pa',date:'2026-11-17',stitches:1,minutes:null,notes:'snapshot',usage:[]})")
    with g.expect_navigation():g.evaluate('FlossFoxSnapshots.restore(0)')
    g.wait_for_function('window.FlossFoxAuditSessions');ok('Snapshot restore restores the exact session sidecar',raw(g,SK)==snapBefore)
    ok('Snapshot safety copy keeps the prior session state',js(g,"FlossFoxSnapshots.list()[0].keys['flossfox-dev.stitch-sessions.v1'].includes('snapshot-extra')"))
    # Storage exceptions: percentage and session entry cannot claim success or corrupt old data.
    openjournal(g);oldSessions=raw(g,SK);oldProjects=raw(g,KEY)
    g.evaluate("()=>{window.auditSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='flossfox-dev.stitch-sessions.v1'||k==='flossfox-dev.v1')throw new DOMException('full','QuotaExceededError');return window.auditSet.call(this,k,v)}}")
    g.fill('#ffauStitches','99');g.get_by_role('button',name='Save stitching session',exact=True).click();ok('Quota failure never reports session saved',raw(g,SK)==oldSessions and 'Not saved' in g.inner_text('#ffauSessionStatus'))
    g.fill('#ffauPercent','80');g.get_by_role('button',name='Update percentage',exact=True).click();ok('Quota failure preserves progress in memory and storage',raw(g,KEY)==oldProjects and js(g,"FlossFoxProjects._store().projects.find(p=>p.id==='pa').progressPct===37"));g.evaluate('()=>{Storage.prototype.setItem=window.auditSet}')
    # Invalid manual percentages and stale tab edits fail without changing saved data.
    ok('Invalid completion percentage is rejected',js(g,"!FlossFoxProjects.setProgress('pa',101).ok"))
    staleBefore=raw(g,SK);g.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('flossfox-dev.v1'));d.projects[0].notes='Other tab edit';localStorage.setItem('flossfox-dev.v1',JSON.stringify(d))})()")
    g.fill('#ffauStitches','20');g.get_by_role('button',name='Save stitching session',exact=True).click();ok('Stale tab cannot add sessions against changed project data',raw(g,SK)==staleBefore and 'Another tab' in g.inner_text('#ffauSessionStatus'))
    g.reload();g.wait_for_function('window.FlossFoxAuditSessions');g.evaluate("localStorage.setItem('flossfox-dev.stitch-sessions.v1','{broken')")
    ok('Corrupt session data cannot become an incomplete successful backup',js(g,"(()=>{try{FlossFoxProjects.fullBackup();return false}catch(e){return true}})()"))
    g.evaluate('(raw)=>localStorage.setItem("flossfox-dev.stitch-sessions.v1",raw)',staleBefore)
    # Offline real-app reload after the complete service worker install.
    co,o=new(br,offline=True);o.wait_for_function('navigator.serviceWorker.controller',timeout=30000);o.wait_for_function("caches.keys().then(ks=>ks.some(k=>k.includes('gemini-audit')))")
    cached=o.evaluate("caches.keys().then(async ks=>{const c=await caches.open(ks.find(k=>k.includes('gemini-audit')));return Promise.all(['audit/ff-audit-ui.js','audit/ff-stitch-sessions.js','audit/ff-audit.css'].map(x=>c.match(x).then(Boolean)))})")
    ok('Service worker caches every new critical asset',all(cached));co.set_offline(True);o.reload();o.wait_for_function('window.FlossFoxAuditUI&&window.FlossFoxAuditSessions');openjournal(o);ok('Actual application and journal work after offline reload',o.locator('#ffauSessions').is_visible())
    ok('No browser runtime errors',not errors,errors);ok('No added external data requests',not outside,outside)
    for ctx in (c,c2,r,co):ctx.close()
    br.close()
    print(f'\n{COUNT} real-app audit checks passed',flush=True)
