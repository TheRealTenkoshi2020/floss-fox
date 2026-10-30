#!/usr/bin/env python3
"""FF-QA-01 (DEMO-1/DEMO-2): saving the "Try an example" list is tagged demo; a real project named "Example project" stays real.
Usage: FF_KEY=flossfox-dev.v1 python tests/sample_save_e2e.py http://localhost:8811/floss-fox-dev/"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1')
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (390, 1280):
        ctx = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 600, has_touch=w < 600)
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B + '?nosw'); g.wait_for_load_state('networkidle')
        g.click('#sample'); g.wait_for_timeout(150)
        g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(200)
        ps = json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects']
        ok(f'{w}px saved example is tagged demo', len(ps) == 1 and ps[0].get('demo') is True, [(x['name'],x.get('demo')) for x in ps])
        bk = g.evaluate("FlossFoxProjects.fullBackup()")
        ok(f'{w}px saved example excluded from full backup', bk['projects'] == [])
        ok(f'{w}px saved example shows the Demo tag in My Projects', g.locator('#projList .demotag').count() == 1)
        ok(f'{w}px removeDemo removes it', g.evaluate("FlossFoxProjects.removeDemo()") == 1 and json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects'] == [])
        # DEMO-2: own text, user-typed name "Example project" stays real
        g.wait_for_timeout(800)  # projects.js ignores a second Save within 800ms of the first; without this the run races that guard (seen at 1280 after the refresh)
        g.click('#tabConvert')
        if g.locator('#exitExample').is_visible(): g.click('#exitExample')
        g.fill('#inp', '310 x2\n898 x1'); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(150)
        g.fill('#newProjName', 'Example project'); g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(200)
        ps = json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects']
        ok(f'{w}px real project named "Example project" stays real and is backed up', len(ps) == 1 and 'demo' not in ps[0] and len(g.evaluate("FlossFoxProjects.fullBackup()")['projects']) == 1, [(x['name'],x.get('demo')) for x in ps])
        # edited example is no longer the example: real
        g.evaluate("localStorage.clear()"); g.reload(); g.wait_for_load_state('networkidle')
        g.click('#sample'); g.wait_for_timeout(100); g.click('#tabConvert')
        g.fill('#inp', g.input_value('#inp') + '\n3799 x1'); g.click('#go'); g.wait_for_timeout(150)
        g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(200)
        ps = json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects']
        ok(f'{w}px an edited example (user changed it) saves as real', len(ps) == 1 and 'demo' not in ps[0], [(x['name'],x.get('demo')) for x in ps])
        ctx.close()
    br.close()
ok('no page errors', not errs, errs)
print(f"\nsample_save_e2e (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
