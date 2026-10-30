#!/usr/bin/env python3
"""ci005-65 (simulated browser run): Myke's case. PDF-imported project, 15 colors, no amounts, all not checked.
Shop tab Check first is Buy-only: no Have enough / Need to buy buttons, rows show "DMC x · amount not set yet",
the My threads link opens My threads with a real tap, Buy opens the store chooser without changing data,
and heading, row count, Pip bubble and summary counts all agree (also after a status change in Projects).
Usage: FF_KEY=flossfox-dev.v1 python tests/shop_noamt_e2e.py http://localhost:8812/floss-fox-dev/ [pdf] [shot_dir]"""
import sys, os, json, re
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
PDF = sys.argv[2] if len(sys.argv) > 2 else '/workspace/flow-pass/myke-example.pdf'
SHOT = sys.argv[3] if len(sys.argv) > 3 else None
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''): R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
NOTE = "These colors still need a look. Check them in My threads, or buy any you already know you need."
if not os.path.exists(PDF): print('SKIP no PDF fixture'); sys.exit(0)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw'); g.evaluate('localStorage.clear()'); g.reload(); g.wait_for_timeout(500)
    g.click('#tabConvert'); g.click('#convertView .pat-launch'); g.set_input_files('#patFile', PDF); g.wait_for_timeout(3000)
    g.check('#patAll'); g.click('#patImport'); g.wait_for_timeout(500)
    st = lambda: json.loads(g.evaluate(f"localStorage.getItem({json.dumps(KEY)})"))['projects'][-1]
    p0 = st(); ok('fixture: 15 colors, no amounts, none checked', len(p0['items']) == 15 and all(i['qty'] is None for i in p0['items']) and not any(d['status'] for d in p0['decisions'].values()))
    g.evaluate("FlossFoxProjects.open(FlossFoxProjects.lastProject().id)"); g.wait_for_timeout(300); g.click('#tabShop'); g.wait_for_timeout(500)
    def counts():
        g.evaluate("window.FFHelp&&FFHelp.tick()"); g.wait_for_timeout(100)
        h = int(re.search(r'\((\d+)\)', g.inner_text('#pCheckH')).group(1)) if g.locator('#pCheckH').count() else 0
        pip = g.evaluate("(document.getElementById('pipMsg')||{}).textContent||''"); m = re.search(r'(\d+) colors? still to check', pip)
        sc = g.evaluate("(document.getElementById('sCf')||{}).textContent||'0'")
        return h, g.locator('#pCheck > li').count(), int(m.group(1)) if m else None, int(sc)
    h, n, pip, sc = counts(); ok(f'start: heading, rows, summary agree on 15 (Pip {pip})', h == n == sc == 15 and pip in (15, None), (h, n, pip, sc))
    ok('section line is the approved plural wording', g.inner_text('#pCfNote').strip() == NOTE, g.inner_text('#pCfNote'))
    ok('no Have enough / Need to buy buttons in Check first', g.locator('#pCheck [data-cfst]').count() == 0)
    ok('every row has exactly one Buy', g.evaluate("[...document.querySelectorAll('#pCheck > li')].every(li=>li.querySelectorAll('[data-cfbuy]').length===1)"))
    rows = g.evaluate("[...document.querySelectorAll('#pCheck > li')].map(li=>li.firstChild.textContent.trim())")
    ok('rows read "DMC x · amount not set yet" only', all(re.fullmatch(r'DMC [^·]+ · amount not set yet', r) for r in rows), rows[:3])
    txt = g.inner_text('#pCheck')
    ok('long instruction and reason text removed', 'needs amount not entered' not in txt and 'full-cross stitch count' not in txt and 'not checked yet' not in txt, txt[:200])
    ok('no em dashes on the Shop page', '\u2014' not in g.inner_text('#shopView'))
    if SHOT: g.locator('#pCheck > li').nth(3).scroll_into_view_if_needed(); g.screenshot(path=SHOT + '/noamt-shop-390.png')
    nd = g.locator('.shopdone[data-done=check]')
    ok('Not quite done line uses the approved wording (ci005-66)', 'Give those colors a look in My threads, then come back here.' in nd.inner_text() and 'choose Have enough or Need to buy' not in nd.inner_text(), nd.inner_text())
    if SHOT: nd.scroll_into_view_if_needed(); g.wait_for_timeout(150); g.screenshot(path=SHOT + '/notdone-390.png')
    nd.locator('a', has_text='My threads').tap(); g.wait_for_timeout(400)
    ok('Not quite done My threads link (tap) opens My threads', g.locator('#threadsView').is_visible() and not g.locator('#shopView').is_visible())
    g.locator('#thAdd').tap(); g.keyboard.type('310 x3, 415 x2'); g.locator('#thAddBtn').tap(); g.wait_for_timeout(400)
    g.locator('#tabShop').tap(); g.wait_for_timeout(500)
    ok('ci005-67: owned colors count as checked on return to Shop, derived without saving', g.inner_text('#pCheckH') == 'Check first (13)' and st()['decisions'] == p0['decisions'])
    # Buy: real tap, scroll stays, no data change
    b = g.locator('#pCheck > li').nth(3).locator('[data-cfbuy]'); b.scroll_into_view_if_needed(); g.wait_for_timeout(150); y0 = g.evaluate('scrollY')
    b.tap(); g.wait_for_timeout(300)
    ok('Buy tap opens the store chooser with links', b.get_attribute('aria-expanded') == 'true' and g.locator('#pCheck .ffcf-buy:visible a').count() > 0)
    ok('scroll stays put after Buy', abs(g.evaluate('scrollY') - y0) < 120 and y0 > 200, (y0, g.evaluate('scrollY')))
    ok('Buy changed no data', st() == p0)
    if SHOT: g.screenshot(path=SHOT + '/noamt-chooser-390.png')
    # My threads link: real tap
    g.evaluate('scrollTo(0,0)'); a = g.locator('#pCfNote a', has_text='My threads'); a.scroll_into_view_if_needed(); a.tap(); g.wait_for_timeout(400)
    ok('My threads link tap opens the My threads view', g.locator('#threadsView').is_visible() and not g.locator('#shopView').is_visible() and g.get_attribute('#tabThreads', 'aria-pressed') == 'true', g.evaluate('location.hash'))
    g.click('#tabShop'); g.wait_for_timeout(400)
    # status change elsewhere (Projects), counts still agree
    code = p0['items'][0]['code']
    g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(300); g.locator(f'label:has(#st-{code}-buy)').click(); g.wait_for_timeout(300)
    ok('Need to buy still works in Projects (existing logic)', st()['decisions'][code]['status'] == 'buy')
    g.click('#tabShop'); g.wait_for_timeout(400)
    h, n, pip, sc = counts(); ok(f'counts agree at 13, 310 already counted from My threads (Pip {pip})', h == n == sc == 13 and pip in (13, None), (h, n, pip, sc))
    ok('it shows under Need to buy as amount not entered', re.search(r'DMC \S+ · amount not entered', g.inner_text('#pPlan')) is not None)
    ok('no page errors', not errs, errs); br.close()
print(f"\nshop_noamt (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
