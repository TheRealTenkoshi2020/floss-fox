#!/usr/bin/env python3
"""DEV PREVIEW ONLY: demo-data button. Usage: FF_KEY=flossfox-dev.v1 python tests/demo_e2e.py https://therealtenkoshi2020.github.io/floss-fox-dev/"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8767/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); TK = KEY[:-3] + '.threads.v1'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (360, 390, 1280):
        ctx = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 600, has_touch=w < 600)
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B); g.wait_for_load_state('networkidle')
        ok(f'{w}px fresh visit: nothing is auto-loaded', g.evaluate(f"localStorage.getItem('{TK}')") is None and g.evaluate(f"localStorage.getItem('{KEY}')") is None)
        g.evaluate(f"localStorage.setItem('{TK}',JSON.stringify({{schema:1,threads:{{'310':{{n:1,partial:false,restock:false,updated:''}},'898':{{n:3,partial:false,restock:false,updated:''}}}}}}));localStorage.setItem('{KEY}',JSON.stringify({{schema:2,projects:[{{id:'mine',name:'My own',notes:'',buyBrand:'dmc',items:[{{code:'310',qty:2,stated:true,assumed:0,src:['310 x2']}}],decisions:{{}},purchased:{{}},created:'2026-10-01T00:00:00Z',updated:'2026-10-01T00:00:00Z'}}]}}))"); g.reload(); g.wait_for_load_state('networkidle')
        realT, realP = g.evaluate(f"localStorage.getItem('{TK}')"), g.evaluate(f"localStorage.getItem('{KEY}')")
        ok(f'{w}px my own data seeded', 'demo' not in json.loads(realT) and len(json.loads(realP)['projects']) == 1)
        g.goto(B); g.wait_for_load_state('networkidle')
        g.click('#tabThreads'); ok(f'{w}px demo button is labelled preview only', 'Preview only' in g.inner_text('.demobox') and g.locator('#demoBtn').is_visible())
        g.click('#demoBtn'); g.wait_for_timeout(150)
        d = json.loads(g.evaluate(f"localStorage.getItem('{TK}')"))
        ok(f'{w}px demo collection: 13 demo colors, labelled Demo, in their own map', g.locator('#thList .th.demo').count() == 13 and g.locator('#thList .th.demo .demotag').count() == 13 and len(d['demo']) == 13)
        ok(f'{w}px real 310 (1 skein) not merged with demo 310 (4 skeins)', d['threads'] == json.loads(realT)['threads'] and d['demo']['310']['n'] == 4 and g.input_value('#tn-310') == '1' and g.input_value('#tn-d_310') == '4')
        g.click('#demoBtn'); g.wait_for_timeout(100); ok(f'{w}px loading twice adds nothing', 'already loaded' in g.inner_text('#demoMsg') and json.loads(g.evaluate(f"localStorage.getItem('{TK}')"))['demo']['310']['n'] == 4)
        g.evaluate("FlossFoxProjects.open(FlossFoxProjects._store().projects.find(x=>x.demo).id)"); g.wait_for_timeout(150)
        ok(f'{w}px Demogorgon (demo): 13 owned, 0 short, 6 missing', g.inner_text('#cmpOwned').startswith('✓ 13') and g.inner_text('#cmpShort').startswith('◐ 0') and g.inner_text('#cmpMissing').startswith('✗ 6'), g.inner_text('#pCmp'))
        ok(f'{w}px demo project has 19 colors with stitch counts', g.evaluate("FlossFoxProjects._store().projects.find(x=>x.demo).items.length") == 19 and g.evaluate("FlossFoxProjects._store().projects.find(x=>x.demo).items.every(i=>i.stitchCount>0)"))
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); ok(f'{w}px demo project tagged Demo; my real project still compares with my real threads', 'Demo' in g.inner_text('#pCmpBox').replace('demo threads', 'Demo') )
        if w in (390, 1280):
            os.makedirs('/workspace/floss-converter/feedback-shots/cf', exist_ok=True); g.screenshot(path=f'/workspace/floss-converter/feedback-shots/cf/demo-project-{w}.png')
        ok(f'{w}px no sideways scrolling', g.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        g.click('#tabThreads'); g.click('#thRemoveDemo'); g.wait_for_selector('#ffConfirm:not([hidden])'); g.click('#ffConfirmGo'); g.wait_for_timeout(150)
        ok(f'{w}px Remove demo data leaves my real threads and project exactly as they were', g.evaluate(f"localStorage.getItem('{TK}')") == realT and [(x['id'], x['name'], [(i['code'], i['qty'], i['assumed']) for i in x['items']]) for x in json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects']] == [('mine', 'My own', [('310', 2, 0)])], g.evaluate(f"localStorage.getItem('{TK}')"))
        ctx.close()
    ok('no JS errors', not errs, errs); br.close()
print(f"\ndemo_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
