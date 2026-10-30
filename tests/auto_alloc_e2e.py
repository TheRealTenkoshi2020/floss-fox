#!/usr/bin/env python3
"""ci005-69 (simulated browser run): the new-project auto-apply from My threads respects skeins set aside for other projects.
Real taps: add threads, save project A and set its skeins aside, save project B needing the same color; B must not mark it
Have enough with A's skeins, free skeins still count, and A plus My threads stay unchanged.
Usage: FF_KEY=flossfox-dev.v1 python tests/auto_alloc_e2e.py http://localhost:8812/floss-fox-dev/"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''): R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw'); g.evaluate('localStorage.clear()'); g.reload(); g.wait_for_timeout(500)
    S = lambda: json.loads(g.evaluate(f"localStorage.getItem({json.dumps(KEY)})"))
    TH = lambda: g.evaluate(f"localStorage.getItem({json.dumps(KEY + '.threads.v1')})")
    PJ = lambda i: [x for x in S()['projects'] if x['id'] == i][0]
    g.locator('#tabThreads').tap(); g.wait_for_timeout(300); g.locator('#thAdd').tap(); g.keyboard.type('310 x3, 434 x2'); g.locator('#thAddBtn').tap(); g.wait_for_timeout(400)
    def mkproj(txt, name):
        g.locator('#tabConvert').tap(); g.wait_for_timeout(200)
        if g.locator('#exitExample').is_visible(): g.locator('#exitExample').tap()
        g.fill('#inp', txt); g.locator('#go').tap(); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(150)
        g.fill('#newProjName', name); g.locator('#saveProj').scroll_into_view_if_needed(); g.locator('#saveProj').tap(); g.wait_for_timeout(500)
        i = g.evaluate("FlossFoxProjects.lastProject().id"); g.evaluate(f"FlossFoxProjects.open({json.dumps(i)})"); g.wait_for_timeout(400); return i
    a = mkproj('310 x3', 'Project A')
    ok('A: 310 marked Have enough from My threads (existing auto-apply)', PJ(a)['decisions']['310']['status'] == 'have', PJ(a)['decisions'])
    g.evaluate("FlossFoxProjects.showView('shop')"); g.wait_for_timeout(300); g.locator('#pKit').evaluate('e=>e.open=true'); g.wait_for_timeout(150)
    g.locator('#pKit [data-kadd="310"]').scroll_into_view_if_needed(); g.locator('#pKit [data-kadd="310"]').tap(); g.wait_for_timeout(400)
    al = g.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.allocations.v1')||'{\"allocations\":[]}').allocations")
    ok('A: 3 skeins of 310 set aside (tap)', any(x['code'] == '310' and x['qty'] == 3 and x['projectId'] == a for x in al), al)
    a0, th0 = PJ(a), TH()
    b = mkproj('310 x2\n434 x1', 'Project B'); d = PJ(b)['decisions']
    ok("B: 310 is NOT Have enough with A's set-aside skeins", d['310']['status'] != 'have', d['310'])
    ok('B: free skeins still count (434 Have enough)', d['434']['status'] == 'have', d['434'])
    g.locator('#tabShop').tap(); g.wait_for_timeout(500)
    ok('B Shop: 310 not in Ready', 'DMC 310 · needs' not in g.inner_text('#pPlan'), g.inner_text('#pPlan')[:300])
    ok('A saved statuses unchanged', PJ(a)['decisions'] == a0['decisions'] and PJ(a)['items'] == a0['items'])
    ok('My threads unchanged', TH() == th0)
    ok('set-aside allocations unchanged', g.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.allocations.v1')||'{\"allocations\":[]}').allocations") == al)
    ok('no page errors', not errs, errs); br.close()
print(f"\nauto_alloc (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
