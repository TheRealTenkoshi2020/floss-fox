#!/usr/bin/env python3
"""ci005-82: DMC BLANC is its own color and is never mapped to DMC WHITE (Myke).
Usage: FF_KEY=flossfox-dev.v1 python3 tests/blanc_e2e.py URL
Private real-PDF checks use local files that are never committed: set BLANC_PDF_DIR to a folder holding
full-list.pdf and solo-leveling.pdf (skipped when missing)."""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'
PDFS = os.environ.get('BLANC_PDF_DIR', '/workspace/test-pdfs')
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(i)[:300]}'))
WARN = ("doesn't list", "can't tell", 'more than once', 'never show up', 'not sure')
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page(w=390):
        c = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 600, has_touch=w < 600)
        g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); return g
    g = page()
    # B1 the app's DMC data has BLANC as its own entry, with the existing white swatch (no hex invented)
    d = g.evaluate("({b:DMC.BLANC,w:DMC.WHITE,s:[SULL.BLANC,SULL.WHITE]})")
    ok('B1 DMC data has BLANC as its own color', bool(d['b']) and d['b']['name'] == 'blanc', d)
    ok('B1b BLANC uses the existing white swatch value, WHITE unchanged', d['b']['hex'] == d['w']['hex'] == '#fafafa' and d['w']['name'] == 'white', d)
    # B2 pasted list: BLANC and WHITE stay separate and are shown as themselves
    g.click('#tabConvert')
    if g.locator('#exitExample').is_visible(): g.click('#exitExample')
    g.fill('#inp', 'BLANC x2\nwhite x1\n310 x1'); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(150)
    out = g.inner_text('#out') if g.locator('#out').count() else g.inner_text('body')
    ok('B2 paste shows DMC BLANC and DMC WHITE separately', 'DMC BLANC' in out and 'DMC WHITE' in out and 'BLANC (White)' not in out, out[:400])
    g.fill('#newProjName', 'Whites'); g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(300)
    raw = g.evaluate(f"localStorage.getItem('{KEY}')"); ps = json.loads(raw)['projects']
    codes = sorted(i['code'] for i in ps[0].get('items', [])) if ps else []
    ok('B2b saved project keeps BLANC and WHITE as two colors', codes == ['310', 'BLANC', 'WHITE'], codes)
    # B3 no migration: existing saved WHITE data is left exactly as it is
    legacy = json.dumps({'projects': [{'id': 'legacy1', 'name': 'Old', 'dest': 'dmc', 'text': 'BLANC x1', 'items': [{'code': 'WHITE', 'qty': 1, 'src': ['BLANC x1'], 'stated': True}], 'decisions': {}}]})
    g.evaluate("([k,v])=>{localStorage.setItem(k,v)}", [KEY, legacy]); g.reload(); g.wait_for_load_state('networkidle'); g.wait_for_timeout(300)
    after = json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))
    it = after['projects'][0]['items'] if after.get('projects') else []
    ok('B3 a saved project with WHITE is not migrated to BLANC', [x['code'] for x in it] == ['WHITE'], it)
    g.context.close()
    # B4 private real PDFs
    fl, so = os.path.join(PDFS, 'full-list.pdf'), os.path.join(PDFS, 'solo-leveling.pdf')
    if os.path.exists(fl) and os.path.exists(so):
        g = page()
        def imp(f):
            g.evaluate("FFImportOpen()"); g.set_input_files('#patFile', f)
            g.wait_for_function("!/Reading selected file/.test(document.getElementById('patInfo').textContent)", timeout=60000); g.wait_for_timeout(400)
            return g.evaluate("[...document.querySelectorAll('#patRows .pat-row b')].map(b=>b.firstChild.textContent.replace('DMC ',''))"), (g.inner_text('#patCheck') if g.locator('#patCheck').count() else '')
        c, t = imp(fl)
        ok('B4a full-list.pdf imports 9 colors with BLANC, not WHITE', len(c) == 9 and 'BLANC' in c and 'WHITE' not in c, c)
        ok('B4b full-list review row reads DMC BLANC', 'DMC BLANC' in g.inner_text('#patRows'), g.inner_text('#patRows')[:300])
        ok('B4c full-list pattern check gives no false warnings', not any(w in t for w in WARN) and 'Nothing stood out' in t, t[:300])
        g.reload(); g.wait_for_load_state('networkidle')
        c, t = imp(so)
        ok('B4d solo-leveling still imports 151/304/321/335', sorted(c) == ['151', '304', '321', '335'], c)
        ok('B4e solo-leveling pattern check gives no false warnings', not any(w in t for w in WARN) and 'Nothing stood out' in t, t[:300])
        g.context.close()
    else:
        print('SKIP B4 private PDFs (set BLANC_PDF_DIR)')
    ok('no page errors', not errs, errs)
    br.close()
print(f"blanc_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
