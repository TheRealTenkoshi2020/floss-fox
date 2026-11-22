#!/usr/bin/env python3
"""Real-app selection freshness and manual-progress contracts; synthetic isolated data.
FF_CHROME=/usr/bin/chromium python3 tests/shopping_selection_e2e.py http://127.0.0.1:8775/
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8775/').rstrip('/')+'/'
KEY='flossfox-dev.v1'; TK='flossfox-dev.threads.v1'
COUNT=0; errors=[]
def ok(name,value,detail=''):
    global COUNT
    assert value,name+': '+str(detail)
    COUNT+=1;print('PASS '+name,flush=True)
def item(code,n):return dict(code=code,qty=n,stated=True,assumed=0,src=['DMC '+code+' x'+str(n)],stitchCount=None)
def project(pid,a,b):return dict(id=pid,name='GEMINI-V5-'+pid,notes='',buyBrand='dmc',status='progress',items=[item('310',a),item('321',b)],decisions={'310':{'status':'buy'},'321':{'status':'buy'}},purchased={},created='2026-11-01T00:00:00Z',updated='2026-11-01T00:00:00Z')
SEED={'schema':2,'projects':[project('qa-a',2,1),project('qa-b',3,2)]}
STOCK={'schema':2,'threads':{'310':{'n':1,'partial':False,'restock':False,'confirmed':True},'321':{'n':2,'partial':False,'restock':False,'confirmed':False}}}
def view(g,name):g.evaluate('(v)=>FlossFoxProjects.showView(v)',name)
def raw(g,k):return g.evaluate('(k)=>localStorage.getItem(k)',k)
def trip(g):view(g,'shop');g.click('#ffauShopStart')
def need(g,width,label,n,legacy=False):
    selector='#planBuy > li[data-code="310"]' if legacy else '#ffauTrip-310 + span'
    text=g.inner_text(selector)
    expected='buy '+str(n) if legacy else str(n)+' skein'
    review=g.inner_text('#planCheck') if legacy else g.text_content('#ffauTrip details')
    ok(f'{width}: {label}',expected in text and '321' in review,{'expected':expected,'actual':text,'review':review})

with sync_playwright() as p:
    br=p.chromium.launch(executable_path=os.environ.get('FF_CHROME','/usr/bin/chromium'),args=['--no-sandbox'])
    for width in (320,390,1280):
        c=br.new_context(viewport={'width':width,'height':900},is_mobile=width<500,has_touch=width<500,service_workers='block')
        c.add_init_script('''(()=>{if(!sessionStorage.getItem('qa.seed')){localStorage.setItem(%s,%s);localStorage.setItem(%s,%s);sessionStorage.setItem('qa.seed','1')}sessionStorage.setItem('ff.landing.seen','1');localStorage.setItem('flossfox-dev.tour.v1','{"status":"dismissed"}');localStorage.setItem('flossfox-dev.hints.v1','off')})()'''%(json.dumps(KEY),json.dumps(json.dumps(SEED)),json.dumps(TK),json.dumps(json.dumps(STOCK))))
        g=c.new_page();g.set_default_timeout(12000);g.on('pageerror',lambda e:errors.append(str(e)))
        g.goto(BASE+'?nosw');g.wait_for_function('!!window.FlossFoxAuditUI&&!!window.FlossFoxPlanner')
        beforeProjects=raw(g,KEY);beforeStock=raw(g,TK)
        direct=g.evaluate("FlossFoxPlanner.compute(['qa-a','qa-b']).rows.find(x=>x.code==='310').maximumWholeSkeinsToBuy")
        ok(f'{width}: pure combined math is five required minus one confirmed',direct==4,direct)
        trip(g);need(g,width,'combined trip begins at four',4)
        g.check('#ffauTrip-310')
        g.uncheck('#ffauPick-qa-b');need(g,width,'A-only trip updates immediately without Show/reload',1)
        ok(f'{width}: changed plan clears stale Found',not g.is_checked('#ffauTrip-310'))
        g.check('#ffauPick-qa-b')
        for i in range(12):
            g.uncheck('#ffauPick-qa-b');need(g,width,f'trip cycle {i+1} A only',1)
            g.check('#ffauPick-qa-b');need(g,width,f'trip cycle {i+1} combined',4)
            g.uncheck('#ffauPick-qa-a');need(g,width,f'trip cycle {i+1} B only',2)
            g.check('#ffauPick-qa-a');need(g,width,f'trip cycle {i+1} combined again',4)
        ok(f'{width}: trip retains keyboard focus on selected checkbox',g.locator('#ffauPick-qa-a').evaluate('(e)=>document.activeElement===e'))
        ok(f'{width}: trip has no horizontal overflow',g.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        g.uncheck('#ffauPick-qa-b');g.reload();g.wait_for_function('!!window.FlossFoxAuditUI');trip(g)
        need(g,width,'latest selection survives reload',1)
        ok(f'{width}: selection checkbox survives reload',not g.is_checked('#ffauPick-qa-b'))
        g.uncheck('#ffauPick-qa-a')
        ok(f'{width}: empty selection removes stale list and share action',g.locator('#ffauTrip-310').count()==0 and 'Choose at least one project.' in g.inner_text('#ffauTrip') and g.locator('#ffauTrip button',has_text='Share a read-only link').count()==0)
        g.reload();g.wait_for_function('!!window.FlossFoxAuditUI');trip(g)
        ok(f'{width}: deliberately empty selection survives reload',g.locator('#ffauTrip fieldset input:checked').count()==0)
        g.check('#ffauPick-qa-a');need(g,width,'trip recovers immediately from empty selection',1)
        view(g,'projects')
        if g.locator('#pClose').is_visible():g.click('#pClose')
        g.click('#planOpen')
        g.check('[data-plan="qa-a"]');g.check('[data-plan="qa-b"]');g.click('#planGo');need(g,width,'existing planner begins at four',4,True)
        for i in range(12):
            g.uncheck('[data-plan="qa-b"]');need(g,width,f'planner cycle {i+1} A only',1,True)
            g.check('[data-plan="qa-b"]');need(g,width,f'planner cycle {i+1} combined',4,True)
            g.uncheck('[data-plan="qa-a"]');need(g,width,f'planner cycle {i+1} B only',2,True)
            g.check('[data-plan="qa-a"]');need(g,width,f'planner cycle {i+1} combined again',4,True)
        g.uncheck('[data-plan="qa-a"]');g.uncheck('[data-plan="qa-b"]')
        ok(f'{width}: empty planner removes old copy/print results',g.locator('#planCopy').count()==0 and g.locator('#planPrint').count()==0 and 'Pick at least one project.' in g.inner_text('#planOut'))
        g.check('[data-plan="qa-a"]');need(g,width,'existing planner recovers from empty selection',1,True)
        g.click('#planClose')
        ok(f'{width}: selection changes never mutate projects or inventory',raw(g,KEY)==beforeProjects and raw(g,TK)==beforeStock)
        g.evaluate("FlossFoxProjects.open('qa-a')");g.locator('#ffauSessions > summary').click()
        for i in range(3):
            g.fill('#ffauStitches','150');g.fill('#ffauMinutes','15');g.get_by_role('button',name='Save stitching session',exact=True).click()
        g.fill('#ffauPercent','37');g.get_by_role('button',name='Update percentage',exact=True).click()
        ok(f'{width}: 450 logged stitches and manual 37 percent remain independent',g.evaluate("FlossFoxAuditSessions.summary('qa-a').stitches===450&&FlossFoxProjects._store().projects.find(p=>p.id==='qa-a').progressPct===37"))
        ok(f'{width}: journal explicitly labels percentage user-entered','37% (user-entered)' in g.inner_text('#ffauSessions'))
        ok(f'{width}: logged usage/time never changes inventory',raw(g,TK)==beforeStock)
        c.close()
    br.close()
ok('no JavaScript errors',not errors,errors)
print(f'\n{COUNT} passed, 0 failed',flush=True)
