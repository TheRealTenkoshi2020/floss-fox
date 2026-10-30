#!/usr/bin/env python3
"""ci005-67 (simulated browser run): Shop readiness follows My threads, derived when drawn (nothing saved).
Myke's PDF (15 colors, no amounts). Real taps: add threads in My threads, come back to Shop with no reload, Check first drops
by the right amount and heading, summary and Pip agree. Partial skein keeps its caution, explicit Projects status wins,
removing a thread brings the color back, a short amount goes to Need to buy for the shortfall, and skeins set aside
for another project are not counted again.
Usage: FF_KEY=flossfox-dev.v1 python tests/shop_collection_e2e.py http://localhost:8812/floss-fox-dev/ [pdf] [shot_dir]"""
import sys, os, json, re
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
PDF = sys.argv[2] if len(sys.argv) > 2 else '/workspace/flow-pass/myke-example.pdf'
SHOT = sys.argv[3] if len(sys.argv) > 3 else None
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''): R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
if not os.path.exists(PDF): print('SKIP no PDF fixture'); sys.exit(0)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw'); g.evaluate('localStorage.clear()'); g.reload(); g.wait_for_timeout(500)
    g.click('#tabConvert'); g.click('#convertView .pat-launch'); g.set_input_files('#patFile', PDF); g.wait_for_timeout(3000)
    g.check('#patAll'); g.click('#patImport'); g.wait_for_timeout(500)
    pidM = g.evaluate("FlossFoxProjects.lastProject().id")
    def mkproj(txt, name):
        g.locator('#tabConvert').tap(); g.wait_for_timeout(200)
        if g.locator('#exitExample').is_visible(): g.click('#exitExample')
        g.fill('#inp', txt); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(150)
        g.fill('#newProjName', name); g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(300)
        return g.evaluate("FlossFoxProjects.lastProject().id")
    p2 = mkproj('310 x5\n434 x1\n700 x1', 'Short case'); p3 = mkproj('310 x2\n434 x1', 'Third')
    for q in (p2, p3): g.evaluate(f"FlossFoxProjects.open({json.dumps(q)})"); g.wait_for_timeout(250)  # opened before any threads exist, so the save-time auto-apply has nothing to write
    S = lambda: json.loads(g.evaluate(f"localStorage.getItem({json.dumps(KEY)})"))
    pid = pidM; pj = lambda: [x for x in S()['projects'] if x['id'] == pid][0]
    p0 = pj()
    g.evaluate(f"FlossFoxProjects.open({json.dumps(pid)})"); g.wait_for_timeout(300); g.locator('#tabShop').tap(); g.wait_for_timeout(500)
    def counts():
        g.evaluate("window.FFHelp&&FFHelp.tick()"); g.wait_for_timeout(150)
        h = int(re.search(r'\((\d+)\)', g.inner_text('#pCheckH')).group(1)) if g.locator('#pCheckH').count() else 0
        pip = g.evaluate("(document.getElementById('pipMsg')||{}).textContent||''"); m = re.search(r'(\d+) colors? still to check', pip)
        sc = g.evaluate("(document.getElementById('sCf')||{}).textContent||'0'")
        return h, g.locator('#pCheck > li').count(), int(m.group(1)) if m else None, int(sc or 0)
    def agree(n, label):
        h, r, pip, sc = counts(); ok(f'{label}: heading, rows, summary, Pip agree on {n} (Pip {pip})', h == r == sc == n and pip in (n, None), (h, r, pip, sc))
    cf = lambda: g.eval_on_selector_all('#pCheck > li [data-cfbuy]', 'e=>e.map(b=>b.getAttribute("aria-label").replace(/^Buy DMC (\\S+).*/,"$1").replace(/:$/,""))')
    agree(15, 'start')
    if SHOT: g.evaluate('scrollTo(0,0)'); g.screenshot(path=SHOT + '/before-390.png'); g.screenshot(path=SHOT + '/before-390-full.png', full_page=True)
    def threads_add(txt):
        g.locator('#tabThreads').tap(); g.wait_for_timeout(300); g.locator('#thAdd').tap(); g.keyboard.type(txt); g.locator('#thAddBtn').tap(); g.wait_for_timeout(400)
    def shop(): g.locator('#tabShop').tap(); g.wait_for_timeout(500)
    g.locator('#pCfNote a', has_text='My threads').tap(); g.wait_for_timeout(300)
    threads_add('310 x3, BLANC x2, 415 x2, 434 x1'); shop()  # ci005-82: the pattern lists BLANC; owning BLANC (not WHITE) covers it
    agree(11, 'after adding 4 colors in My threads, no reload')
    ok('the 4 owned colors left Check first', not {'310', 'BLANC', '415', '434'} & set(cf()), cf())
    ok('they count as ready, not on the buy list', g.locator('#pPlan > ul:first-of-type li').count() == 0 and g.locator('#pSummary').get_attribute('data-ready') == 'false')
    ok('nothing written into the saved project (derived only)', pj()['decisions'] == p0['decisions'] and pj()['items'] == p0['items'])
    if SHOT: g.evaluate('scrollTo(0,0)'); g.screenshot(path=SHOT + '/after-390.png'); g.screenshot(path=SHOT + '/after-390-full.png', full_page=True)
    g.locator('#pStoreBtn').tap(); g.wait_for_timeout(300)
    ok('Store Mode Check first agrees (11)', g.locator('#smCheck > li').count() == 11)
    g.locator('#pStoreBtn').tap(); g.wait_for_timeout(200)
    # partial skein caution kept
    g.locator('#tabThreads').tap(); g.wait_for_timeout(300); g.locator('#thList [data-part="434"]').tap(); g.wait_for_timeout(300); shop()
    agree(12, 'partial skein of 434 keeps its caution (back in Check first)'); ok('434 is in Check first', '434' in cf(), cf())
    # explicit status wins
    g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(300); g.locator('label:has(#st-310-check)').tap(); g.wait_for_timeout(300); shop()
    agree(13, 'explicit Not sure on 310 in Projects beats My threads'); ok('310 back in Check first', '310' in cf())
    ok('the explicit status is saved as chosen', pj()['decisions']['310']['status'] == 'check')
    g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(300); g.locator('label:has(#st-415-buy)').tap(); g.wait_for_timeout(300); shop()
    ok('explicit Need to buy on 415 beats My threads (on the buy list)', 'DMC 415' in g.inner_text('#pPlan') and '415' not in cf() and pj()['decisions']['415']['status'] == 'buy')
    agree(13, 'after Need to buy on 415')
    # removing a thread brings it back
    g.locator('#tabThreads').tap(); g.wait_for_timeout(300); g.locator('#thList [data-del="BLANC"]').tap(); g.wait_for_timeout(300)
    if g.locator('#ffConfirmGo').is_visible(): g.locator('#ffConfirmGo').tap(); g.wait_for_timeout(400); shop()
    agree(14, 'removing BLANC from My threads brings it back'); ok('BLANC back in Check first', 'BLANC' in cf(), cf())
    # short amount: project with known amounts, verified stock
    g.evaluate(f"FlossFoxProjects.open({json.dumps(p2)})"); g.wait_for_timeout(300)
    d2 = [x for x in S()['projects'] if x['id'] == p2][0]['decisions']; blank = all(v['status'] is None for v in d2.values())
    ok('short-case project starts with no saved statuses', blank, d2)
    shop(); nb = g.inner_text('#pPlan > ul:first-of-type')
    ok('310 short (own 3, need 5) is on Need to buy for the shortfall of 2', re.search(r'DMC 310\D{1,4}2 \(for', nb) is not None and '310' not in cf(), (nb[:200], cf()))
    ok('700 (not owned) stays in Check first', '700' in cf(), cf())
    # set-aside: reserve 310 for the short-case project, then a third project should not count those skeins
    g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(300)
    g.evaluate("FlossFoxProjects.showView('shop')"); k = g.locator('#pKit'); k.evaluate('e=>e.open=true'); g.wait_for_timeout(150)
    if g.locator('#pKit [data-kadd="310"]').count(): g.locator('#pKit [data-kadd="310"]').tap(); g.wait_for_timeout(300)
    al = g.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.allocations.v1')||'{\"allocations\":[]}').allocations")
    ok('3 skeins of 310 set aside for Short case', any(a['code'] == '310' and a['qty'] == 3 and a['projectId'] == p2 for a in al), al)
    g.evaluate(f"FlossFoxProjects.open({json.dumps(p3)})"); g.wait_for_timeout(300); shop()
    ok('skeins set aside elsewhere are not counted twice (310 not ready in Third)', '310' in cf() or 'DMC 310' in g.inner_text('#pPlan > ul:first-of-type'), (cf(), g.inner_text('#pPlan')[:300]))
    ok('no page errors', not errs, errs); br.close()
print(f"\nshop_collection (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
