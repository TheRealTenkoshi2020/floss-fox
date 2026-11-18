#!/usr/bin/env python3
"""Long unbroken user text (project names) must wrap: no sideways page scroll at 360/390/412,
light and dark themes, in project detail, projects list, guided home Continue, Workbasket, Shopping.
Simulated (headless Chrome, synthetic data). Usage: FF_KEY=flossfox.v1 python3 tests/long_names_e2e.py URL [--shots DIR]"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
SH = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
LIVE = '--live' in sys.argv
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'
NAME = 'GermaphobicScoutCaptainCrossStitchPattern_DiscoArd_261025_1128.pdf'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(i)[:400]}'))
items = [{'code': c, 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None} for c in ('310', 'BLANC', '321')]
P = {'id': 'plong', 'name': NAME, 'notes': '', 'buyBrand': 'dmc', 'status': 'progress', 'items': items, 'decisions': {}, 'purchased': {}, 'created': '2026-11-01T00:00:00Z', 'updated': '2026-11-10T00:00:00Z', 'leftOff': NAME}
SEED = json.dumps({'schema': 2, 'projects': [P]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}})
SNAP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
WIDE = """(W=>{o=[];document.querySelectorAll('body *').forEach(e=>{if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return;const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0)o.push((e.id?'#'+e.id:e.tagName+'.'+String(e.className).split(' ')[0])+':'+Math.round(r.right))});return{sw:document.documentElement.scrollWidth,iw:innerWidth,W,o:o.slice(0,6)}})"""
def check(g, label):
    # Compare with the device width, not innerWidth: mobile Chrome widens the layout viewport to fit wide content.
    w = g.viewport_size['width']; r = g.evaluate(WIDE, w); ok(label, r['sw'] <= w and r['iw'] <= w, r)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for th in ('moon', 'morning'):
        for w in (360, 390, 412):
            c = br.new_context(viewport={'width': w, 'height': 860}, is_mobile=True, has_touch=True, service_workers='block')
            c.add_init_script("(([K,TK,S,T])=>{if(!sessionStorage.getItem('ln.seeded')){localStorage.clear();localStorage.setItem(K,S);localStorage.setItem(TK,T);sessionStorage.setItem('ln.seeded','1')}})(" + json.dumps([KEY, TK, SEED, THR]) + ")")
            g = c.new_page(); g.set_default_timeout(10000); g.on('pageerror', lambda e: errs.append(str(e)))
            g.goto(B + ('' if LIVE else '?nosw')); g.wait_for_function('window.FlossFoxGuidedUX&&document.readyState==="complete"'); g.wait_for_timeout(500)
            g.evaluate(f"FlossFoxAtelierTheme.apply('{th}')"); s0 = g.evaluate(SNAP); t = f'[{th} {w}] '
            ok(t + 'Continue shows the long name', g.locator('#ffuxResume').count() == 1 and 'GermaphobicScout' in g.inner_text('#ffuxResume'))
            check(g, t + 'guided home with Continue: no sideways scroll')
            g.click('#ffuxResume'); g.wait_for_timeout(500)
            ok(t + 'name unchanged in the detail heading', NAME in g.inner_text('#projEdit'))
            check(g, t + 'project detail: no sideways scroll')
            if SH and th == 'moon' and w == 390: g.screenshot(path=f'{SH}/longname-390.png')
            g.evaluate("document.querySelectorAll('#projEdit details').forEach(d=>d.open=true)"); g.wait_for_timeout(200)
            check(g, t + 'project detail, all sections open (comparison etc.): no sideways scroll')
            g.click('#pClose'); g.wait_for_timeout(300); check(g, t + 'projects list: no sideways scroll')
            if g.locator('#tabWorkbasket').is_visible():
                g.click('#tabWorkbasket'); g.wait_for_timeout(300); check(g, t + 'Workbasket: no sideways scroll')
            g.click('#ffuxNavSummary'); g.click('#tabShop'); g.wait_for_timeout(400); check(g, t + 'Shopping: no sideways scroll')
            ok(t + 'saved data unchanged (name not altered)', g.evaluate(SNAP) == s0)
            c.close()
    br.close()
ok('no page errors', not errs, errs[:3])
print(f"\nlong_names_e2e (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
