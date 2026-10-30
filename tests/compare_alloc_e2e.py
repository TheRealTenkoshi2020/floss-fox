#!/usr/bin/env python3
"""ci005-72 (simulated browser run): "Compare with my thread collection" and its "Use my collection" Apply leave out skeins set aside
for OTHER projects; a project's own set-asides still count. Real taps; undo restores; project A, My threads and set-asides stay unchanged.
Usage: FF_KEY=flossfox-dev.v1 python tests/compare_alloc_e2e.py http://localhost:8812/floss-fox-dev/"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''): R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
ALS = "JSON.parse(localStorage.getItem('flossfox-dev.allocations.v1')||'{\"allocations\":[]}').allocations"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw'); g.evaluate('localStorage.clear()'); g.reload(); g.wait_for_timeout(500)
    S = lambda: json.loads(g.evaluate(f"localStorage.getItem({json.dumps(KEY)})"))
    TH = lambda: g.evaluate(f"localStorage.getItem({json.dumps(KEY + '.threads.v1')})")
    PJ = lambda i: [x for x in S()['projects'] if x['id'] == i][0]
    def opn(i): g.evaluate(f"FlossFoxProjects.open({json.dumps(i)})"); g.wait_for_timeout(400)
    def mkproj(txt, name):
        g.locator('#tabConvert').tap(); g.wait_for_timeout(200)
        if g.locator('#exitExample').is_visible(): g.locator('#exitExample').tap()
        g.fill('#inp', txt); g.locator('#go').tap(); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(150)
        g.fill('#newProjName', name); g.locator('#saveProj').scroll_into_view_if_needed(); g.locator('#saveProj').tap(); g.wait_for_timeout(500)
        i = g.evaluate("FlossFoxProjects.lastProject().id"); opn(i); return i
    def tap(sel): l = g.locator(sel); l.scroll_into_view_if_needed(); l.tap(); g.wait_for_timeout(350)
    def use_and_apply():
        g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(250)
        g.locator('#pCmpBox').evaluate('e=>e.open=true'); g.wait_for_timeout(150); tap('#pUseColl'); prev = g.inner_text('#pCmpPrev') if g.locator('#pCmpPrev').count() else ''
        if g.locator('#pApplyColl').count(): tap('#pApplyColl')
        return prev
    # projects first (no threads yet, so the new-project auto-apply has nothing to fill in)
    a = mkproj('310 x3', 'Project A'); b = mkproj('310 x2\n434 x1', 'Project B')
    g.locator('#tabThreads').tap(); g.wait_for_timeout(300); g.locator('#thAdd').tap(); g.keyboard.type('310 x3, 434 x2'); g.locator('#thAddBtn').tap(); g.wait_for_timeout(400)
    opn(a); g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(300)
    g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(200); tap('#pKitGo'); g.locator('#pKit').evaluate('e=>e.open=true'); g.wait_for_timeout(150); tap('#pKit [data-kadd="310"]')
    al = g.evaluate(ALS); ok('A: 3 skeins of 310 set aside (tap)', any(x['code'] == '310' and x['qty'] == 3 and x['projectId'] == a for x in al), al)
    ok('the compare box shows the approved line', "Each project is checked against your whole collection, minus any skeins set aside for other projects." in g.evaluate("document.getElementById('pCmp').textContent"))
    use_and_apply()
    ok("A: its own set-aside skeins still count (310 Have enough)", PJ(a)['decisions']['310']['status'] == 'have', PJ(a)['decisions']['310'])
    a0, th0, b0 = PJ(a), TH(), PJ(b)
    opn(b); g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(300)
    prev = use_and_apply(); d = PJ(b)['decisions']
    ok("B: Apply does not claim A's set-aside 310 (not Have enough)", d['310']['status'] != 'have', (d['310'], prev[:300]))
    ok('B: free skeins still count (434 Have enough)', d['434']['status'] == 'have', d['434'])
    ok('B: undo button offered', g.locator('#pUndoColl').count() == 1)
    tap('#pUndoColl')
    ok('B: undo restores the saved decisions', PJ(b)['decisions'] == b0['decisions'], (PJ(b)['decisions'], b0['decisions']))
    ok('A unchanged', PJ(a)['decisions'] == a0['decisions'] and PJ(a)['items'] == a0['items'])
    ok('My threads unchanged', TH() == th0)
    ok('set-asides unchanged', g.evaluate(ALS) == al)
    ok('no page errors', not errs, errs); br.close()
print(f"\ncompare_alloc (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
