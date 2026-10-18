"""One in-project readiness view (2.0A). Usage: FF_KEY=flossfox-dev.v1 python3 tests/readiness_inline_e2e.py URL"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1]; KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY.replace('.v1', '')
R = []
def ok(n, c, d=''):
    R.append(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(d)[:300]}'))
TH = {'schema': 2, 'threads': {'310': {'n': 3, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z', 'storage': {'container': 'Box 3', 'slot': 'Row 2'}},
                                '321': {'n': 1, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z', 'storage': {'container': 'Red bag'}}}}
SEED = "localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s.hints.v1','off');if(!localStorage.getItem('%s.threads.v1'))localStorage.setItem('%s.threads.v1',%s)" % (PFX, PFX, PFX, PFX, json.dumps(json.dumps(TH)))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (390, 884):
        c = b.new_context(viewport={'width': w, 'height': 900}, is_mobile=w < 700, accept_downloads=True); c.add_init_script(SEED)
        g = c.new_page(); E = []; g.on('pageerror', lambda e: E.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B); g.fill('#inp', '310 x2\n321 x2\n3865 x1\n699'); g.click('#go'); g.fill('#newProjName', 'Readiness demo'); g.click('#saveProj'); g.click('#openSaved'); g.wait_for_timeout(150)
        ok(f'[{w}] standalone readiness panel with its own picker is gone', g.locator('#pipProjectReadiness').count() == 0 and g.locator('#ffReadinessProject').count() == 0)
        ok(f'[{w}] readiness details live inside the project, after the summary', g.evaluate("document.getElementById('pReady').previousElementSibling.id") == 'pSum' and g.locator('#pReady details').count() == 1)
        g.check('#st-310-have'); g.check('#st-321-buy'); g.check('#st-3865-buy'); g.wait_for_timeout(150)
        txt = g.inner_text('#pReady')
        grp = g.evaluate("Object.fromEntries([...document.querySelectorAll('#pReady [data-group]')].map(x=>[x.dataset.group,[...x.querySelectorAll('li')].map(l=>l.dataset.code)]))")
        ok(f'[{w}] groups: confirmed 310, buy 321+3865, not sure 699', grp == {'have': ['310'], 'buy': ['321', '3865'], 'review': ['699']}, grp)
        ok(f'[{w}] storage locations from My threads shown', 'Stored: Box 3 · Row 2' in txt and 'Stored: Red bag' in txt, txt)
        q321 = g.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).lines.find(l=>l.from.includes('321')).q")
        ok(f'[{w}] to-buy amount is the shopping plan amount (321)', f'{q321} to buy' in g.inner_text('#pReady [data-code="321"]'), (q321, g.inner_text('#pReady [data-code="321"]')))
        sm = g.evaluate("(()=>{const P=FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]);return [P.sum.sufficient,P.sum.toBuy,P.sum.review,P.sum.total]})()")
        ok(f'[{w}] counts equal the project summary (no double counting)', f'{sm[0]} of {sm[3]} have enough · {sm[1]} to buy' in txt and g.inner_text('#sSuf').startswith(f'{sm[0]} of {sm[3]}'), (sm, txt[:120]))
        before = g.evaluate(f"[localStorage.getItem('{KEY}'),localStorage.getItem('{PFX}.threads.v1')]")
        g.click('#pReady summary'); g.click('#pReady summary'); g.click('[data-flow=ready]'); g.wait_for_timeout(100)
        ok(f'[{w}] viewing readiness never writes project or thread data', g.evaluate(f"[localStorage.getItem('{KEY}'),localStorage.getItem('{PFX}.threads.v1')]") == before)
        # Ask Pip routes to the project readiness view
        g.click('#pClose'); g.wait_for_timeout(100); g.click('#askPipBtn'); g.click('[data-piph-open]'); g.wait_for_timeout(100)
        g.click('#pipHybridDialog button:has-text("Check my project readiness")'); g.wait_for_timeout(100)
        g.click('#pipHybridDialog .piph-choices button:has-text("Readiness demo")'); g.wait_for_timeout(300)
        ok(f'[{w}] Ask Pip opens the project and its readiness view (no separate answer panel)', g.locator('#projEdit').is_visible() and g.locator('#pReady details[open]').count() == 1 and not g.evaluate("(document.getElementById('pipHybridDialog')||{}).open"))
        g.click('#pClose'); g.click('#backupBox summary')
        with g.expect_download() as dl: g.click('#backupBtn')
        bk = json.load(open(dl.value.path(), encoding='utf-8'))
        ok(f'[{w}] backup format unchanged (v2, no readiness fields stored)', bk['version'] == 2 and set(bk['projects'][0]) == {'id', 'name', 'notes', 'buyBrand', 'status', 'items', 'decisions', 'purchased', 'created', 'updated'}, (bk.get('version'), [k for k in bk['projects'][0]], json.dumps(bk['projects'])[:200]))
        ok(f'[{w}] no page errors', not E, E)
        c.close()
print(f'{sum(R)} passed, {len(R)-sum(R)} failed'); sys.exit(0 if all(R) else 1)
