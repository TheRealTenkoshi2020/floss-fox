#!/usr/bin/env python3
"""Leave a review button: hidden when URL empty; Help + Settings + footer when set;
new tab + noopener; no localStorage in the URL; tab visits leave storage byte-identical;
mobile 390px screenshot. Results are simulated (headless Chrome).
Usage: FF_KEY=flossfox-dev.v1 python tests/review_button_e2e.py http://localhost:8765/"""
import os, sys, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/review-button-logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))

FORM = 'https://example.com/forms/d/e/TEST_REVIEW_ONLY/viewform'
SEED = json.dumps({'schema': 2, 'projects': [{'id': 'p1', 'name': 'Secret Project', 'notes': 'do-not-leak', 'buyBrand': 'dmc', 'status': 'progress', 'items': [{'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None}], 'decisions': {'310': 'buy'}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z', 'leftOff': 'row 12 do-not-leak'}]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 3, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}, 'BLANC': {'n': 1, 'partial': False, 'restock': True, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}}})
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
INIT = """(([K,TK,S,T,P,FORM])=>{if(!sessionStorage.getItem('rv.seeded')){localStorage.clear();if(S)localStorage.setItem(K,S);if(T)localStorage.setItem(TK,T);sessionStorage.setItem('rv.seeded','1')}
if(FORM)window.__FF_REVIEW_FORM_URL=FORM;
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off');localStorage.setItem(p+'.startHere.v1','seen')}})"""

def ctx(br, vw, form):
    c = br.new_context(viewport=vw, service_workers='block', is_mobile=vw['width'] < 500, has_touch=vw['width'] < 500)
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, SEED, THR, PFX, form])})")
    g = c.new_page(); g.set_default_timeout(10000); g.on('pageerror', lambda e: errs.append(str(e))); return c, g

def open_settings(g):
    g.goto(B + '?nosw#settings'); g.wait_for_function('window.FlossFoxReview'); g.wait_for_timeout(300)
    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(150)
    g.evaluate("FlossFoxReview.mount()")

def open_help(g):
    g.goto(B + '?nosw#help'); g.wait_for_function('window.FlossFoxReview'); g.wait_for_timeout(300)
    g.evaluate("document.getElementById('tabHelp').click()"); g.wait_for_timeout(150)
    g.evaluate("FlossFoxReview.mount()")

def leak_check(href, dump):
    if not href: return 'missing href'
    bad = []
    if 'Secret Project' in href or 'do-not-leak' in href or 'BLANC' in href: bad.append('project/thread text')
    if KEY in href or TK in href or 'flossfox' in href.lower() and 'example.com' not in href: bad.append('storage key')
    try:
        for k, v in json.loads(dump):
            if v and len(v) > 8 and v in href: bad.append('value of ' + k)
            if k in href and 'example.com' not in href: bad.append('key ' + k)
    except Exception as e:
        bad.append('dump ' + str(e))
    return ', '.join(bad)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # 1. Empty URL: buttons stay hidden (no override)
    c, g = ctx(br, {'width': 1000, 'height': 800}, None)
    g.goto(B + '?nosw#help'); g.wait_for_function('window.FlossFoxReview'); g.wait_for_timeout(300)
    g.evaluate("document.getElementById('tabHelp').click()"); g.wait_for_timeout(100)
    g.evaluate("window.__FF_REVIEW_FORM_URL=undefined; FlossFoxReview.mount()")
    ok('HIDE-1 Help: no review block when URL empty', g.locator('#ffReviewHelp').count() == 0)
    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(100)
    g.evaluate("FlossFoxReview.mount()")
    ok('HIDE-2 Settings: no review block when URL empty', g.locator('#ffReviewSettings').count() == 0)
    ok('HIDE-3 Footer: no review link when URL empty', g.locator('#ffReviewFooter').count() == 0)
    ok('HIDE-4 FlossFoxReview.url() empty', g.evaluate('FlossFoxReview.url()') == '')
    c.close()

    # 2. URL set: visible in Help, Settings, footer; attrs correct; no leaks
    c, g = ctx(br, {'width': 1000, 'height': 800}, FORM)
    open_help(g)
    ok('HELP-1 Leave a review visible in Help', g.locator('#ffReviewHelp a.btnlink').count() == 1)
    a = g.locator('#ffReviewHelp a.btnlink')
    ok('HELP-2 label text', a.inner_text().strip() == 'Leave a review')
    href = a.get_attribute('href')
    ok('HELP-3 href is the form URL', href == FORM, href)
    ok('HELP-4 target=_blank', a.get_attribute('target') == '_blank')
    ok('HELP-5 rel includes noopener and noreferrer', 'noopener' in (a.get_attribute('rel') or '') and 'noreferrer' in (a.get_attribute('rel') or ''))
    ok('HELP-6 aria-label mentions new tab', 'new tab' in (a.get_attribute('aria-label') or '').lower())
    hint = g.inner_text('#ffReviewHelp .hint')
    ok('HELP-7 privacy hint present', 'privately' in hint.lower() and 'nothing from your collection' in hint.lower())
    ok('HELP-8 no em dash in hint', '\u2014' not in hint)
    dump = g.evaluate(DUMP)
    ok('HELP-9 no localStorage values in Help href', leak_check(href, dump) == '', leak_check(href, dump))

    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(100)
    g.evaluate("FlossFoxReview.mount()")
    ok('SET-1 Leave a review visible in Settings', g.locator('#ffReviewSettings a.btnlink').count() == 1)
    sa = g.locator('#ffReviewSettings a.btnlink')
    ok('SET-2 Settings href/target/rel', sa.get_attribute('href') == FORM and sa.get_attribute('target') == '_blank' and 'noopener' in (sa.get_attribute('rel') or ''))
    ok('SET-3 Settings Feedback heading', g.locator('#ffReviewSettings h3').inner_text().strip() == 'Feedback')
    ok('SET-4 no localStorage values in Settings href', leak_check(sa.get_attribute('href'), dump) == '')

    ok('FOOT-1 footer Leave a review link', g.locator('#ffReviewFooter a').count() == 1)
    fa = g.locator('#ffReviewFooter a')
    ok('FOOT-2 footer href/target/rel', fa.get_attribute('href') == FORM and fa.get_attribute('target') == '_blank' and 'noopener' in (fa.get_attribute('rel') or ''))
    ok('FOOT-3 no localStorage values in footer href', leak_check(fa.get_attribute('href'), dump) == '')
    g.screenshot(path=f'{SHOTS}/desktop-help-settings.png', full_page=False)
    c.close()

    # 3. Tab visits leave localStorage byte-identical
    c, g = ctx(br, {'width': 1000, 'height': 800}, FORM)
    g.goto(B + '?nosw#convert'); g.wait_for_function('window.FlossFoxReview'); g.wait_for_timeout(400)
    g.evaluate("FlossFoxReview.mount()")
    before = g.evaluate(DUMP)
    for tab in ('tabHelp', 'tabSettings', 'tabThreads', 'tabProjects', 'tabShop', 'tabConvert', 'tabHelp'):
        g.evaluate(f"document.getElementById('{tab}').click()"); g.wait_for_timeout(120)
        g.evaluate("FlossFoxReview.mount()")
    after = g.evaluate(DUMP)
    ok('STORE-1 tab visits leave localStorage byte-identical', before == after, f'before keys={len(json.loads(before))} after={len(json.loads(after))}')
    ok('STORE-2 project and thread keys unchanged', g.evaluate(f"localStorage.getItem('{KEY}')") == SEED and g.evaluate(f"localStorage.getItem('{TK}')") == THR)
    c.close()

    # 4. Mobile 390px layout + screenshot
    c, g = ctx(br, {'width': 390, 'height': 800}, FORM)
    open_help(g)
    ok('MOB-1 Help review visible at 390px', g.locator('#ffReviewHelp a.btnlink').is_visible())
    ok('MOB-2 no horizontal overflow', g.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'), g.evaluate('document.documentElement.scrollWidth'))
    ok('MOB-3 review link at least 44px tall', g.evaluate("document.querySelector('#ffReviewHelp a.btnlink').getBoundingClientRect().height>=44"))
    g.locator('#ffReviewHelp').scroll_into_view_if_needed()
    g.screenshot(path=f'{SHOTS}/mobile-390-help.png')
    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(150)
    g.evaluate("FlossFoxReview.mount()")
    g.locator('#ffReviewSettings').scroll_into_view_if_needed()
    g.screenshot(path=f'{SHOTS}/mobile-390-settings.png')
    c.close()

    # 5. http / junk override rejected (stays hidden)
    c, g = ctx(br, {'width': 800, 'height': 700}, 'http://insecure.example/form')
    g.goto(B + '?nosw#help'); g.wait_for_function('window.FlossFoxReview'); g.wait_for_timeout(200)
    g.evaluate("FlossFoxReview.mount()")
    ok('SAFE-1 http URL rejected, stays hidden', g.locator('#ffReviewHelp').count() == 0 and g.evaluate('FlossFoxReview.url()') == '')
    c.close()

    ok('ERR-1 no page errors', not errs, errs[:3])
    br.close()

print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)")
sys.exit(0 if R['fail'] == 0 else 1)
