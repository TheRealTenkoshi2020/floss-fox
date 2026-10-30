#!/usr/bin/env python3
"""Floss Fox landing (ci005-79, simulated browser run). Fresh session shows it; reload, back and deep links skip it;
each choice opens its tab; Start links and the wordmark return to it; reduced motion is still; no overflow at 344/390/882.
Usage: FF_KEY=flossfox-dev.v1 python tests/landing_e2e.py http://localhost:8811/floss-fox-dev/ [--shots DIR]"""
import sys, os
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
SH = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
ON = "document.documentElement.classList.contains('ff-landing')&&getComputedStyle(document.getElementById('ffLanding')).display!=='none'"
APPHID = "!document.querySelector('nav.tabs').checkVisibility()&&!document.querySelector('header').checkVisibility()&&!document.querySelector('.devbanner').checkVisibility()"
TABS = [('Find floss', 'tabConvert'), ('My threads', 'tabThreads'), ('Projects', 'tabProjects'), ('Shop', 'tabShop'), ('Help', 'tabHelp'), ('Settings', 'tabSettings')]
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def fresh(w=390, sch='light', rm='no-preference', h=844):
        c = br.new_context(viewport={'width': w, 'height': h}, color_scheme=sch, reduced_motion=rm)
        g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); return c, g
    c, g = fresh(); g.goto(B + '?nosw'); g.wait_for_load_state('networkidle')
    ok('fresh session shows the landing', g.evaluate(ON))
    ok('tabs, header and logo are hidden behind it', g.evaluate(APPHID))
    ok('one visible Pip', g.evaluate("[...document.images].filter(i=>i.offsetParent).length") == 1)
    ok('copy: bubble', g.inner_text('#ffLandSay') == "Hi! I'm Pip. What are we stitching up today?")
    fe = g.evaluate("document.activeElement&&document.activeElement.outerHTML.slice(0,80)")
    ok('no auto-focus ring on load', 'class="ch"' not in (fe or ''), fe)
    g.keyboard.press('Tab'); ok('first Tab reaches Find floss', g.evaluate("document.activeElement.dataset.tab")=='tabConvert')
    hs = g.evaluate("[...document.querySelectorAll('#ffLanding .ch')].map(e=>Math.round(e.getBoundingClientRect().height))")
    ok('five 58px buttons', hs == [58] * 5, hs)
    ok('Help/Settings tap targets >=44px tall and wide',all(v>=44 for v in g.evaluate("[...document.querySelectorAll('#ffLanding .quiet a')].flatMap(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})")));     ok('Help/Settings 44px quiet links', g.evaluate("[...document.querySelectorAll('#ffLanding .quiet a')].map(e=>Math.round(e.getBoundingClientRect().height))") == [44, 44])
    ok('no underline under the lantern', g.evaluate("getComputedStyle(document.querySelector('.lan')).textDecorationLine==='none'&&getComputedStyle(document.querySelector('.quiet a')).textDecorationLine==='none'&&getComputedStyle(document.querySelector('.quiet a .tx')).textDecorationLine==='underline'"))
    ok('app data still loaded under it (appname set)', g.evaluate("document.getElementById('appname').textContent.length>0"))
    an = g.evaluate("document.getAnimations().map(a=>a.animationName).sort()")
    ok('light: only the Pip fade-in', an == ['pip-in'], an)
    ok('fade is 0.9s', g.evaluate("getComputedStyle(document.querySelector('#ffLanding .lpip img')).animationDuration") == '0.9s')
    g.reload(); g.wait_for_load_state('networkidle')
    ok('reload skips it', not g.evaluate(ON))
    ok('Start link in footer and Help', g.locator('a.ffstart').count() == 2)
    g.click('#tabHelp'); g.click('#helpView a.ffstart'); g.wait_for_timeout(100)
    ok('Help Start link returns to it', g.evaluate(ON) and g.evaluate("document.activeElement.id")=='ffLanding')
    for name, tid in TABS:
        if not g.evaluate(ON): g.evaluate("ffShowLanding()")
        sel = f'#ffLanding .quiet a[data-tab={tid}]' if tid in ('tabHelp', 'tabSettings') else f'#ffLanding .ch[data-tab={tid}]'
        g.click(sel); g.wait_for_timeout(120)
        ok(f'{name} opens its tab', not g.evaluate(ON) and g.get_attribute('#' + tid, 'aria-pressed') == 'true')
    g.evaluate("ffShowLanding()"); tb = g.locator('#ffLanding #ffLandTour')
    ok('tour button exists with its name', tb.count() == 1 and tb.inner_text().strip() == 'Take the tour with Pip' and g.evaluate("document.getElementById('ffLandTour').textContent.trim()")=='Take the tour with Pip')
    ok('tour button is a real button, >=44px tall', g.evaluate("(()=>{const b=document.getElementById('ffLandTour');return b.tagName==='BUTTON'&&b.getBoundingClientRect().height>=44})()"))
    tb.click(); g.wait_for_timeout(250)
    ok('tour button hides the landing', not g.evaluate(ON))
    ok('tour button starts the tour at step 1', g.evaluate("window.FlossFoxTour.step()") == 0 and g.locator('#tourCard').is_visible())
    ok('landing flag set after the tour button', g.evaluate("sessionStorage.getItem('ff.landing.seen')") == '1')
    g.evaluate("FlossFoxTour.end('dismissed')")
    g.click('#tabConvert'); g.click('#appname'); g.wait_for_timeout(100); ok('wordmark (shown on Find floss) returns to it', g.evaluate(ON))
    g.evaluate("ffShowLanding()"); g.keyboard.press('Tab'); g.keyboard.press('Enter'); g.wait_for_timeout(100)
    ok('keyboard Enter on focused first button opens Find floss', g.get_attribute('#tabConvert', 'aria-pressed') == 'true' and not g.evaluate(ON))
    g.click('#tabConvert'); g.focus('#appname'); g.keyboard.press('Enter'); g.wait_for_timeout(100); ok('wordmark works by keyboard', g.evaluate(ON))
    g.click('#ffLanding .ch[data-tab=tabFabric]'); g.wait_for_load_state('networkidle')
    ok('Fabric opens the fabric page', 'fabric' in g.url)
    g.go_back(); g.wait_for_load_state('networkidle'); g.wait_for_timeout(200)
    ok('back navigation skips it', not g.evaluate(ON))
    c.close()
    for h in ('#projects', '#shop', '#settings'):
        c, g = fresh(); g.goto(B + '?nosw' + h); g.wait_for_load_state('networkidle'); g.wait_for_timeout(200)
        ok(f'deep link {h} skips it', not g.evaluate(ON)); c.close()
    c, g = fresh(sch='dark'); g.goto(B + '?nosw'); g.wait_for_load_state('networkidle')
    an = g.evaluate("document.getAnimations().map(a=>a.animationName).sort()")
    ok('dark: halo pulse + fade, no bob', an == ['halo-pulse', 'pip-in'], an)
    ok('dark uses starlight art', 'starlight' in g.evaluate("document.querySelector('#ffLanding img').currentSrc")); c.close()
    for sch in ('light', 'dark'):
        c, g = fresh(sch=sch, rm='reduce'); g.goto(B + '?nosw'); g.wait_for_load_state('networkidle')
        ok(f'{sch} reduced motion: no animations', g.evaluate("document.getAnimations().length") == 0)
        ok(f'{sch} reduced motion: Pip at full opacity', g.evaluate("getComputedStyle(document.querySelector('#ffLanding .lpip img')).opacity") == '1'); c.close()
    for w in (344, 390, 882):
        for sch in ('light', 'dark'):
            c, g = fresh(w=w, sch=sch, rm='reduce', h=844 if w < 800 else 1180); g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); g.wait_for_timeout(300)
            o = g.evaluate("({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight})")
            ok(f'[{w} {sch}] tour button fits', g.evaluate("(()=>{const r=document.getElementById('ffLandTour').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&r.height>=44})()"))
            ok(f'[{w} {sch}] no overflow', o['x'] <= 0 and o['y'] <= 0, o)
            if SH and (w, sch) in ((390, 'light'), (344, 'dark')): os.makedirs(SH, exist_ok=True); g.screenshot(path=f'{SH}/landing-{sch}-{w}.png')
            c.close()
    br.close()
ok('no page errors', not errs, errs[:3])
print(f"landing_e2e (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
