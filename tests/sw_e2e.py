#!/usr/bin/env python3
"""1.8.1 S-004/S-005: offline Pip images from the SW precache, and ?nosw true bypass. Fresh contexts only.
Usage: python tests/sw_e2e.py [BASE_URL]   (preview: set FF_KEY)"""
import sys, os, json, argparse
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome')
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1')
R = {'pass': 0, 'fail': 0}
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {info}'))
PR = {'schema': 2, 'projects': [{'id': 'o1', 'name': 'o1', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [{'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['310 x2'], 'stitchCount': 1500}], 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}]}
BROKEN = "[...document.images].filter(i=>/assets\\/pip\\//.test(i.currentSrc||i.src)&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc||i.src)"
SHOWN = "[...document.images].filter(i=>/assets\\/pip\\//.test(i.currentSrc||i.src)&&i.naturalWidth&&i.offsetParent).length"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 1200, 'height': 900}, service_workers='allow')
    ctx.add_init_script("if(!localStorage.getItem('%s'))localStorage.setItem('%s',%s)" % (KEY, KEY, json.dumps(json.dumps(PR))))
    g = ctx.new_page(); g.goto(B); g.wait_for_load_state('networkidle')
    g.wait_for_function("navigator.serviceWorker.controller||navigator.serviceWorker.ready.then(()=>true)", timeout=20000); g.reload(); g.wait_for_load_state('networkidle')
    core = g.evaluate("fetch('sw.js').then(r=>r.text()).then(t=>t.match(/\"assets\\/pip\\/[^\"]+\"/g).map(s=>s.slice(1,-1)))")
    ok('SW controls the page before going offline', g.evaluate("!!navigator.serviceWorker.controller"))
    ctx.set_offline(True)
    miss = g.evaluate("u=>Promise.all(u.map(x=>fetch(x).then(r=>r.ok?null:x,()=>x))).then(a=>a.filter(Boolean))", core)
    ok(f'offline: all {len(core)} precached Pip images served', not miss, miss)
    g.reload(); g.wait_for_load_state('load')
    g.click('#tabThreads'); g.wait_for_timeout(400); a = g.evaluate(SHOWN); b1 = g.evaluate(BROKEN)
    g.click('#tabProjects'); g.click('[data-open="o1"]'); g.wait_for_timeout(500); b2 = g.evaluate(BROKEN); n = g.evaluate(SHOWN)
    ok(f'offline: collection/tips + project/estimator Pip images load (shown {a}+{n})', not b1 and not b2 and a + n > 0, (b1, b2))
    ctx.set_offline(False)
    # ?nosw: existing SW is unregistered, page not controlled
    g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); g.wait_for_timeout(500)
    regs = g.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")
    g.reload(); g.wait_for_load_state('networkidle')
    ctl = g.evaluate("!!navigator.serviceWorker.controller")
    ok('?nosw unregisters the existing SW and the page is not controlled', regs == 0 and not ctl, (regs, ctl))
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
