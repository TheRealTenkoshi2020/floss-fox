#!/usr/bin/env python3
"""Tab row scroll hint (simulated browser run): fade + chevron only where more tabs exist.
Usage: FF_KEY=flossfox-dev.v1 python tests/tab_hint_e2e.py http://localhost:8811/floss-fox-dev/"""
import sys
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
ST = "(()=>{const n=document.querySelector('nav.tabs'),b=getComputedStyle(n,'::before'),a=getComputedStyle(n,'::after');return {x:n.scrollLeft,max:n.scrollWidth-n.clientWidth,l:b.content!=='none'&&b.opacity==='1',r:a.content!=='none'&&a.opacity==='1'}})()"
SET = "v=>{const n=document.querySelector('nav.tabs');n.style.scrollBehavior='auto';n.scrollLeft=v==='end'?n.scrollWidth:v}"
LS = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (344, 390, 1280):
        ctx = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 600, has_touch=w < 600, reduced_motion='reduce' if w == 344 else 'no-preference')
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e)))
        g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); g.wait_for_timeout(300)
        before = g.evaluate(LS); s = g.evaluate(ST); t = f'[{w}] '
        if w == 1280:
            ok(t + 'no overflow and no hint on wide screens', s['max'] <= 2 and not s['l'] and not s['r'], s)
        else:
            ok(t + 'start: right hint shown, left hidden', s['max'] > 2 and s['x'] == 0 and s['r'] and not s['l'], s)
            g.evaluate(SET, 120); g.wait_for_timeout(350); s = g.evaluate(ST)
            ok(t + 'middle: both hints shown', s['l'] and s['r'], s)
            g.evaluate(SET, 'end'); g.wait_for_timeout(350); s = g.evaluate(ST)
            ok(t + 'end: right hint hidden, left shown', s['l'] and not s['r'], s)
            g.evaluate(SET, 0); g.wait_for_timeout(350)
            box = g.evaluate("(()=>{const r=document.querySelector('nav.tabs').getBoundingClientRect();return [r.right-8,r.top+r.height/2]})()")
            g.mouse.click(box[0], box[1]); g.wait_for_timeout(700); s = g.evaluate(ST)
            ok(t + 'tapping the right chevron scrolls the row', s['x'] > 40, s)
            ok(t + 'chevron tap did not switch tabs', g.get_attribute('#tabConvert', 'aria-pressed') == 'true')
            g.evaluate(SET, 0); g.wait_for_timeout(300)
            g.focus('#tabSettings'); g.wait_for_timeout(400); s = g.evaluate(ST)
            ok(t + 'keyboard focus on last tab scrolls it into view and updates hint', s['l'] and g.evaluate("(()=>{const b=document.getElementById('tabSettings').getBoundingClientRect();return b.right<=innerWidth+1&&b.left>=0})()"), s)
            lab = g.evaluate("[...document.querySelectorAll('nav.tabs > button')].every(b=>{const r=b.getBoundingClientRect();return r.width>40&&r.height>=44})")
            ok(t + 'tabs still full size', lab)
            if w == 344: ok(t + 'reduced motion: no hint transition', g.evaluate("getComputedStyle(document.querySelector('nav.tabs'),'::after').transitionDuration") in ('0s', ''))
        ok(t + 'hints are not elements (nothing new in tab order or a11y tree)', g.evaluate("document.querySelectorAll('nav.tabs .tabhint, nav.tabs > :not(button):not(a)').length") == 0)
        ok(t + 'no data change', g.evaluate(LS) == before)
        ctx.close()
    br.close()
ok('no page errors', not errs, errs[:3])
print(f"\nSIMULATED tab_hint_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
