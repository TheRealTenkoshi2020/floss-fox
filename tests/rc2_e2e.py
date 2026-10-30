#!/usr/bin/env python3
"""Floss Fox 1.7 RC2: compact 'Use my collection' preview and the Need to buy / Check first split
(screen, shop view, Copy text, CSV, print, price estimate, Pip completion states).
Usage: python tests/rc2_e2e.py [BASE_URL] [--shots DIR] [--webkit]   (preview: set FF_KEY like regression.py)"""
import sys, os, argparse, json, subprocess, csv, io
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None); ap.add_argument('--webkit', action='store_true')
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'
QUIET = "try{localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}')}catch(e){}" % PFX
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(info)[:400]}'))
L24 = ['310', '321', '666', '815', '817', '3865', 'B5200', '413', '414', '415', '762', '318', '317', '498', '304', '3799', '535', '3371', '699', '700', '702', '704', '725', '727']
OWN, MISS = L24[:18], L24[18:]
coll = {'schema': 1, 'threads': {c: {'n': 2, 'partial': False, 'restock': False, 'updated': ''} for c in OWN}}
coll['threads']['310']['n'] = 3
items = [{'code': c, 'qty': 1, 'stated': False, 'assumed': 1, 'src': [f'{i+1} DMC {c} {(i+1)*137}'], 'stitchCount': (i+1)*137} for i, c in enumerate(L24)]
items[0] = {**items[0], 'qty': 2, 'stated': True, 'assumed': 0}   # 310: need 2, have 3 -> owned
items[1] = {**items[1], 'qty': 4, 'stated': True, 'assumed': 0}   # 321: need 4, have 2 -> short
proj = {'id': 'rc2', 'name': 'RC2 project', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': items, 'decisions': {}, 'purchased': {}, 'created': '2026-10-12T00:00:00Z', 'updated': '2026-10-12T00:00:00Z'}
SEED = 'if(!sessionStorage.getItem("s")){sessionStorage.setItem("s","1");localStorage.setItem(%s,%s);localStorage.setItem(%s,%s)}' % (json.dumps(TKEY), json.dumps(json.dumps(coll)), json.dumps(KEY), json.dumps(json.dumps({'schema': 2, 'projects': [proj]})))
with sync_playwright() as p:
    if A.webkit:
        br = p.webkit.launch(); dev = p.devices['iPhone 13']
    else:
        br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox']); dev = None
    for W in ([390] if A.webkit else [360, 390, 1280]):
        T = f'[{W}]'
        if dev: ctx = br.new_context(**dev, accept_downloads=True)
        else:
            mob = W < 600; ctx = br.new_context(viewport={'width': W, 'height': 800 if mob else 900}, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1, accept_downloads=True)
            ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        ctx.add_init_script(QUIET); ctx.add_init_script('window.FF_NO_AUTOCMP=true'); ctx.add_init_script(SEED)
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(f'{W}: {e}')); g.on('dialog', lambda d: d.accept())
        g.goto(B); g.wait_for_load_state('networkidle'); g.click('#tabProjects'); g.click('[data-open="rc2"]'); g.wait_for_timeout(150)
        ls = lambda k: g.evaluate(f"localStorage.getItem({json.dumps(k)})")
        dec = lambda: json.loads(ls(KEY))['projects'][0]['decisions']
        vh = g.evaluate('innerHeight')
        # ---- 1. compact preview ----
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.wait_for_timeout(150)
        sm = g.inner_text('#pPrevSum')
        ok(f'C1 {T} compact summary: "Will mark 1 Have enough, 16 Not sure, 7 Need to buy"', sm.startswith('Will mark 1 Have enough, 16 Not sure, 7 Need to buy'), sm)
        ok(f'C2 {T} full list is behind a closed "Show all 24 changes" expander', g.inner_text('#pPrevAll summary') == 'Show all 24 changes' and not g.evaluate("document.getElementById('pPrevAll').open") and g.locator('#pPrevAll li').count() == 24)
        bb = g.locator('#pCmpPrev').bounding_box(); ab = g.locator('#pApplyColl').bounding_box()
        ok(f'C3 {T} summary + Apply/Cancel fit in about one screen ({round(bb["height"])}px of {vh}px)', bb['height'] <= vh * 0.6, bb)
        ok(f'C4 {T} Apply is on screen right after tapping Use my collection', 0 <= ab['y'] and ab['y'] + ab['height'] <= vh, ab)
        if A.shots and W == 390: os.makedirs(A.shots, exist_ok=True); g.screenshot(path=f'{A.shots}/compact-preview-390{"-webkit" if A.webkit else ""}.png')
        g.click('#pPrevAll summary'); ok(f'C5 {T} expander lists every change', g.locator('#pPrevAll li:visible').count() == 24 and 'DMC 699 (missing)' in g.inner_text('#pPrevAll'))
        g.click('#pCancelColl'); ok(f'C6 {T} Cancel changes nothing', dec() == {} or all(not v.get('status') for v in dec().values()))
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.click('#pApplyColl'); g.wait_for_timeout(150); d = dec()
        ok(f'C7 {T} Apply: 1 have, 16 not sure, 7 buy', sum(v['status'] == 'have' for v in d.values()) == 1 and sum(v['status'] == 'check' for v in d.values()) == 16 and sum(v['status'] == 'buy' for v in d.values()) == 7)
        g.click('#pUndoColl'); g.wait_for_timeout(100); ok(f'C8 {T} Undo still restores the previous state', all(not v.get('status') for v in dec().values()))
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.click('#pApplyColl'); g.wait_for_timeout(100); g.click('#st-310-buy'); g.wait_for_timeout(100)
        ok(f'C9 {T} manual edit still clears Undo', g.locator('#pUndoColl').count() == 0)
        g.click('#st-310-have'); g.wait_for_timeout(100)
        # ---- 2. Need to buy vs Check first ----
        plan = g.inner_text('#pPlan'); nb = plan.split('Check first')[0]; cf = g.inner_text('#pCheck')
        ok(f'S1 {T} screen: Check first (16) is its own section', g.inner_text('#pCheckH') == 'Check first (16)' and g.locator('#pCheck li').count() == 16)
        ok(f'S2 {T} plain note (Pixel final, n>1, ci005-65)', g.inner_text('#pCfNote').strip() == "These colors still need a look. Check them in My threads, or buy any you already know you need.")
        ok(f'S3 {T} Need to buy holds only known short/missing (321 + 6 missing), no check-first color', all(f'DMC {c}' in nb for c in MISS) and 'DMC 321' in nb and not any(f'DMC {c} ' in nb for c in OWN[2:]), nb[:500])
        ok(f'S4 {T} owned, quantity not verified color is listed under Check first (ci005-65: color only, no reason line)', 'DMC 815' in cf and 'marked Not sure' not in cf)
        tot = g.inner_text('#pPlan .totals')
        ok(f'S5 {T} estimate is labelled "Need to buy only" and says check-first colors are not included', 'Need to buy only' in tot and 'Not included: 16 colors in Check first' in tot, tot)
        ok(f'S6 {T} headline not ready; Check first counted in the summary', g.get_attribute('#pSummary', 'data-ready') == 'false' and g.inner_text('#sCf') == '16')
        if not A.webkit:
            g.click('#pCopy'); g.wait_for_timeout(100); txt = g.evaluate('navigator.clipboard.readText()')
            ok(f'S7 {T} Copy text: note + CHECK FIRST section + estimate label', 'NOTE: 16 colors still need checking before this list is complete.' in txt and 'CHECK FIRST' in txt and txt.count('[?] DMC') == 16 and 'Need to buy only' in txt and 'NEED TO BUY' in txt, txt[:400])
        with g.expect_download() as dl: g.click('#pCsv')
        rows = list(csv.DictReader(io.StringIO(open(dl.value.path(), encoding='utf-8').read())))
        secs = [r['shopping_section'] for r in rows if r['dmc_code']]
        ok(f'S8 {T} CSV: shopping_section 16 check first / 7 need to buy / 1 ready + note row', secs.count('check first') == 16 and secs.count('need to buy') == 7 and secs.count('ready') == 1 and any('still need checking' in r['dmc_name'] for r in rows if not r['dmc_code']), secs)
        if not A.webkit:
            g.emulate_media(media='print'); g.pdf(path=f'/tmp/rc2-{W}.pdf'); g.emulate_media(media='screen')
            pdf = subprocess.run(['pdftotext', f'/tmp/rc2-{W}.pdf', '-'], capture_output=True, text=True).stdout
            ok(f'S9 {T} print: Check first section, note and estimate label are printed', 'Check first (16)' in pdf and 'still need checking before this list is complete' in pdf and 'Need to buy only' in pdf, pdf[:300])
        if A.shots and W == 390:
            g.locator('#pPlan').screenshot(path=f'{A.shots}/split-list-390{"-webkit" if A.webkit else ""}.png')
        # shop view
        g.click('#pShop'); g.wait_for_timeout(150)
        ok(f'S10 {T} shop view: Check first (16) apart from the buy list, note in the header', g.inner_text('#shCheckH') == 'Check first (16)' and '16 colors still need checking' in g.inner_text('.shopsum') and g.locator('#shList .scard').count() == 7, g.inner_text('.shopsum'))
        if A.shots and W == 390: g.locator('#projEdit').screenshot(path=f'{A.shots}/shop-view-check-first-390{"-webkit" if A.webkit else ""}.png')
        g.click('#shBack'); g.wait_for_timeout(100)
        # everything bought -> must NOT say Shopping list done while check-first remain
        for _ in range(12):
            u = g.locator('#pPlan [data-bought]:not(:checked)')
            if not u.count(): break
            u.first.click(); g.wait_for_timeout(80)
        dn = g.evaluate("(()=>{const e=document.querySelector('#pPlan [data-done]');return e?e.dataset.done:null})()")
        ok(f'P1 {T} all Need to buy bought: no "Shopping list done" while 16 check first remain', dn == 'check' and 'Shopping list done' not in g.inner_text('#pPlan') and 'Not complete yet' in g.inner_text('#pPlan'), (dn, g.inner_text('#pPlan')[:300]))
        g.click('#pShop'); g.wait_for_timeout(100)
        ok(f'P2 {T} shop view also not "done"', 'Shopping list done' not in g.inner_text('#projEdit') and 'Ready to start stitching' not in g.inner_text('#projEdit'))
        g.click('#shBack'); g.wait_for_timeout(100)
        # resolve the check-first colors with real amounts -> now done is allowed
        for c in OWN[2:]:
            g.click(f'#st-{c}-have'); g.wait_for_timeout(30)
        dn = g.evaluate("(()=>{const e=document.querySelector('#pPlan [data-done]');return e?e.dataset.done:null})()")
        ok(f'P3 {T} once nothing is left to check, "Shopping list done" appears', dn == 'done' and g.locator('#pCheckH').count() == 0, dn)
        ok(f'P4 {T} still not "Ready to start stitching" (bought, not checked in; amounts assumed)', 'Ready to start stitching' not in g.inner_text('#projEdit'))
        ctx.close()
    ok('no JS errors', not errs, errs[:3]); br.close()
print(f"\nrc2_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
