#!/usr/bin/env python3
"""Floss Fox 1.7 paste checks (Barbara's 24-color list). Usage: python tests/parse_e2e.py [BASE_URL] [--shots DIR]"""
import sys, os, argparse, json
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = os.environ.get('FF_PIP_KEY', 'flossfox.pip.v1').replace('.pip.v1', '')
SEED = "try{localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s.hints.v1','off')}catch(e){}" % (PFX, PFX)
CODES = ['310','321','666','03','04','09','3865','B5200','Ecru','415','762','699','740','742','798','813','3354','01','3799','413','815','898','3771','948']
NAMES = ['Black','Red','Bright Red','Tin - Medium','Tin - Dark','Cocoa - Very Dark','Winter White','Snow White','Ecru','Pearl Gray','Pearl Gray - Very Light','Green','Tangerine','Tangerine - Light','Delft Blue - Dark','Blue - Light','Dusty Rose - Light','White Tin','Pewter Gray - Very Dark','Pewter Gray - Dark','Garnet - Medium','Coffee Brown - Very Dark','Terra Cotta - Ultra Very Light','Peach - Very Light']
LEGEND = '\n'.join(f'{i+1} DMC {c} {n} {100+i*37}' for i, (c, n) in enumerate(zip(CODES, NAMES)))
DESC = '\n'.join(f'DMC {c} {n}' for c, n in zip(CODES, NAMES))
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {info}'))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    for w in (360, 390, 1280):
        mob = w < 600
        ctx = br.new_context(viewport={'width': w, 'height': 780 if mob else 900}, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write']); ctx.add_init_script(SEED)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(B); pg.wait_for_load_state('networkidle')
        for label, text in (('descriptions', DESC), ('numbered legend + stitch counts', LEGEND)):
            pg.click('#clear'); pg.evaluate('t=>navigator.clipboard.writeText(t)', text)
            pg.focus('#inp'); pg.keyboard.press('Control+V'); pg.wait_for_timeout(100)
            ok(f'{w}px {label}: real paste puts all 24 lines in the box', pg.input_value('#inp').count('\n') == 23, pg.input_value('#inp')[:80])
            ok(f'{w}px {label}: line counter says 24', '24 lines' in pg.inner_text('#inpCount'), pg.inner_text('#inpCount'))
            h = pg.eval_on_selector('#inp', 'e=>e.clientHeight')
            ok(f'{w}px {label}: box grows past 3 lines (now {h}px) and stays within 60% of screen', 160 <= h <= max(160, 0.6 * (780 if mob else 900)) + 6, h)
            sc = pg.eval_on_selector('#inp', 'e=>{const o=getComputedStyle(e).overflowY;e.scrollTop=99999;return [o,e.scrollTop>0||e.scrollHeight<=e.clientHeight]}')
            ok(f'{w}px {label}: box scrolls to the last line', sc[0] == 'auto' and sc[1], sc)
            pg.click('#go'); pg.wait_for_timeout(150)
            n = pg.locator('#tbl tbody tr').count(); e = pg.locator('#errs li').count()
            ok(f'{w}px {label}: 24 colors, 0 errors', n == 24 and e == 0, (n, e, pg.inner_text('#errs')[:200]))
            ok(f'{w}px {label}: summary says Found 24', 'Found 24 colors' in pg.inner_text('#summary'), pg.inner_text('#summary'))
            if 'legend' in label:
                st = pg.evaluate("state.items.find(i=>i.code==='03').stitches")
                ok(f'{w}px legend: DMC 03 kept (not 3), stitches 211 shown', st == 211 and '211 stitches' in pg.inner_text('#tbl'), st)
            ov = pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            ok(f'{w}px {label}: no sideways scrolling', ov)
            if A.shots and 'legend' in label:
                os.makedirs(A.shots, exist_ok=True); pg.locator('#inp').scroll_into_view_if_needed()
                pg.screenshot(path=f'{A.shots}/paste-{w}.png'); pg.locator('#results').scroll_into_view_if_needed(); pg.screenshot(path=f'{A.shots}/results-{w}.png')
        # unrecognized lines: shown with original text and fixable in one tap
        pg.click('#clear'); pg.fill('#inp', DESC + '\n310 1160\nDMC 9999 Mystery\nhello'); pg.click('#go'); pg.wait_for_timeout(100)
        t = pg.inner_text('#errs')
        ok(f'{w}px 3 bad lines listed with their text and line number', pg.locator('#errs mark.badline').count() == 3 and '"310 1160"' in t and '(line 25)' in t and '"hello"' in t, t[:300])
        if A.shots:
            pg.locator('#errs').scroll_into_view_if_needed(); pg.screenshot(path=f'{A.shots}/fix-{w}.png')
        pg.locator('#errs button', has_text='DMC 310, 1160 stitches').click(); pg.wait_for_timeout(100)
        ok(f'{w}px one-tap fix rewrites that line and re-reads', 'DMC 310 1160 stitches' in pg.input_value('#inp') and pg.locator('#errs mark.badline').count() == 2 and pg.evaluate("state.items.find(i=>i.code==='310').stitches") == 1160)
        pg.fill('#fx-0', 'DMC 3799'); pg.locator('#errs li >> nth=0').locator('button', has_text='Use this').click(); pg.wait_for_timeout(100)
        ok(f'{w}px edit + Use this', 'DMC 9999' not in pg.input_value('#inp') and pg.locator('#errs mark.badline').count() == 1)
        pg.locator('#errs button', has_text='Remove line').click(); pg.wait_for_timeout(100)
        ok(f'{w}px Remove line clears the last error', pg.locator('#errs li').count() == 0 and 'hello' not in pg.input_value('#inp') and 'Found 24 colors' in pg.inner_text('#summary'), pg.inner_text('#summary'))
        if w == 390:
            pg.fill('#inp', LEGEND); pg.click('#go'); pg.fill('#newProjName', 'Barbara 24'); pg.click('#saveProj'); pg.wait_for_timeout(200)
            pg.reload(); pg.wait_for_load_state('networkidle')
            d = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects.find(p=>p.name==='Barbara 24')")
            ok('saved project keeps 24 colors and stitch counts after reload', d and len(d['items']) == 24 and next(i for i in d['items'] if i['code'] == '03')['stitches'] == 211, d and d['items'][:2])
        ctx.close()
    ok('no JS errors', not errs, errs)
    br.close()
print(f"\nparse_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
