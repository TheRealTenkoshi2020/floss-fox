#!/usr/bin/env python3
"""v2 increment 2: read-only combined shopping planner (planner.js) with the kit fixtures. Usage: python tests/planner_e2e.py [BASE_URL] [--shots DIR]"""
import os, json, argparse
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'
FX = os.path.join(os.path.dirname(__file__), 'fixtures', 'v2')
R = {'pass': 0, 'fail': 0}
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {info}'))
def proj(p):
    return {'id': p['id'], 'name': p['name'], 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [{**i, 'src': [i['code']]} for i in p['items']], 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}
def load(n): return json.load(open(os.path.join(FX, n)))
f1, f2 = load('two-projects-shared-stash.json'), load('unknown-and-partial.json')
# fixture 2 project gets its own id; plus an unconfirmed-stock project (3865 x1, 2 unconfirmed owned)
# the app's own projects.js rejects a non-whole qty (1.2) on load, so 310 is seeded as a stated 1 here; the partial-skein case is unchanged
f2p = dict(f2['projects'][0], id='test-c', items=[f2['projects'][0]['items'][0], {'code': '310', 'qty': 1, 'assumed': 0, 'stated': True}])
extra = {'id': 'test-d', 'name': 'Unconfirmed', 'items': [{'code': '3865', 'qty': 1, 'assumed': 0, 'stated': True}]}
PROJ = {'schema': 2, 'projects': [proj(p) for p in f1['projects'] + [f2p, extra]] + [dict(proj({'id': 'demo1', 'name': 'Demo', 'items': [{'code': '310', 'qty': 5, 'assumed': 0, 'stated': True}]}), demo=True)]}
TH = {'schema': 1, 'threads': {**f2['collection']['threads'], '3865': {'n': 2, 'partial': False, 'restock': False, 'updated': '2026-10-14T00:00:00Z'}}}
TH['threads']['310'] = f1['collection']['threads']['310']  # 1 confirmed full, no partial (fixture 1)
TH2 = dict(TH, threads={**TH['threads'], '310': f2['collection']['threads']['310']})  # 1 confirmed + partial (fixture 2)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    for w, mob in ((390, True), (673, True), (1280, False)):
        for th, tag in ((TH, 'A'), (TH2, 'B')):
            ctx = br.new_context(viewport={'width': w, 'height': 900}, is_mobile=mob, device_scale_factor=2 if mob else 1)
            ctx.add_init_script("if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s',%s);localStorage.setItem('%s',%s)}" % (PFX, KEY, json.dumps(json.dumps(PROJ)), TKEY, json.dumps(json.dumps(th))))
            g = ctx.new_page(); errs = []; g.on('pageerror', lambda e: errs.append(str(e)))
            g.goto(B); g.wait_for_load_state('networkidle'); g.click('#tabProjects')
            snap = lambda: (g.evaluate(f"localStorage.getItem('{KEY}')"), g.evaluate(f"localStorage.getItem('{TKEY}')"))
            before = snap(); t = f'[{w}{tag}] '
            g.click('#planOpen')
            ok(t + 'demo project not offered', g.locator('[data-plan="demo1"]').count() == 0 and g.locator('[data-plan]').count() == 4, g.locator('[data-plan]').count())
            if tag == 'A':
                g.check('[data-plan="test-a"]'); g.check('[data-plan="test-b"]'); g.click('#planGo')
                b = g.inner_text('#planBuy')
                ok(t + 'shared 310: 2 needed - 1 confirmed = buy 1 (stash once)', 'DMC 310' in b and 'buy 1' in b, b)
                ok(t + 'final total 1 shown', 'Need to buy (1 skein)' in g.inner_text('#planBuyH'), g.inner_text('#planBuyH'))
                if w == 390 and A.shots: os.makedirs(A.shots, exist_ok=True); g.locator('#planCard').screenshot(path=os.path.join(A.shots, 'planner-shared-390.png'))
                g.check('[data-plan="test-d"]'); g.click('#planGo'); c = g.inner_text('#planCheck')
                ok(t + 'unconfirmed stock -> Check first, no final total', 'DMC 3865' in c and 'not confirmed' in c and 'Not a final total' in g.inner_text('#planNote'), c)
                txt = g.evaluate("FlossFoxPlanner.text(FlossFoxPlanner.compute(['test-a','test-b','test-d']))")
                ok(t + 'copy text has both lists', 'NEED TO BUY' in txt and 'CHECK FIRST' in txt and 'DMC 3865' in txt, txt)
            else:
                g.check('[data-plan="test-c"]'); g.check('[data-plan="test-a"]'); g.click('#planGo')
                c, b = g.inner_text('#planCheck'), g.inner_text('#planBuy')
                ok(t + 'unknown 321 -> Check first (4 owned not used as answer)', 'DMC 321' in c and 'DMC 321' not in b, c)
                ok(t + 'partial of unknown size never a full skein -> 310 Check first', 'DMC 310' in c and 'partial' in c and 'DMC 310' not in b, c)
                ok(t + 'no final total', 'Not a final total' in g.inner_text('#planNote') and '(' not in g.inner_text('#planBuyH'))
                if w == 390 and A.shots: g.locator('#planCard').screenshot(path=os.path.join(A.shots, 'planner-checkfirst-390.png'))
            ok(t + 'Copy and Print buttons present', g.locator('#planCopy').count() == 1 and g.locator('#planPrint').count() == 1)
            sw = g.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(t + 'no horizontal overflow', sw[0] <= sw[1], sw)
            ok(t + 'read-only: storage unchanged', snap() == before)
            ok(t + 'no page errors', not errs, errs); ctx.close()
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed"); raise SystemExit(1 if R['fail'] else 0)
