#!/usr/bin/env python3
"""3.9 optional support links (Ko-fi / Stripe Payment Links). Results are simulated (headless Chrome, fake URLs).
Proves: hidden with the shipped empty config; shown only when fake test URLs are injected by this test;
unique ids per mount; correct rel/target; footer link stays in-app; no localStorage writes; no requests to payment
hosts on load; offline notice and no dead tab when offline; app still works offline from the SW cache;
first-visit classification unchanged; 360px, 200% zoom, 44px targets, focus ring, dark theme contrast.
No request ever reaches a real payment host: every payment-host request is intercepted and recorded.
Usage: FF_KEY=flossfox-dev.v1 python tests/support_links_e2e.py http://localhost:8796/"""
import os, sys, json, re
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/monetize39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(i)[:300]}'))

TIP = 'https://ko-fi.com/ff-e2e-fake-not-real'      # fake, test only; intercepted, never fetched
PACK = 'https://ko-fi.com/s/ffe2efake000'          # fake, test only
PAY = re.compile(r'^https?://([a-z0-9-]+\.)*(ko-fi\.com|stripe\.com|paypal\.com|paypal\.me|buymeacoffee\.com)(/|$)', re.I)
SEED = json.dumps({'schema': 2, 'projects': [{'id': 'p1', 'name': 'Secret Project', 'notes': 'do-not-leak', 'buyBrand': 'dmc', 'status': 'progress', 'items': [{'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None}], 'decisions': {'310': 'buy'}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 3, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}, 'BLANC': {'n': 1, 'partial': False, 'restock': True, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}}})
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
DUPIDS = "(()=>{const c={};document.querySelectorAll('[id]').forEach(e=>c[e.id]=(c[e.id]||0)+1);return Object.keys(c).filter(k=>c[k]>1&&/ffSupport/.test(k))})()"

def ctx(br, vw=None, urls=None, seed=True, scheme='light', sw='block', motion='no-preference'):
    vw = vw or {'width': 1000, 'height': 800}
    c = br.new_context(viewport=vw, service_workers=sw, color_scheme=scheme, reduced_motion=motion, is_mobile=vw['width'] < 500, has_touch=vw['width'] < 500)
    js = ''
    if seed:
        js += f"if(!sessionStorage.getItem('sl.seeded')){{localStorage.clear();localStorage.setItem({json.dumps(KEY)},{json.dumps(SEED)});localStorage.setItem({json.dumps(TK)},{json.dumps(THR)});"
        js += "for(const p of [%s,'flossfox']){localStorage.setItem(p+'.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem(p+'.hints.v1','off');localStorage.setItem(p+'.startHere.v1','seen')}" % json.dumps(PFX)
        js += "sessionStorage.setItem('sl.seeded','1')}"
    if urls is not None:
        js += f"window.__FF_SUPPORT_TEST={json.dumps(urls)};"
    if js: c.add_init_script(js)
    hits = []
    def route(r):
        hits.append(r.request.url)
        r.fulfill(status=200, content_type='text/html', body='<!doctype html><title>fake checkout</title><p>Fake checkout page (test)</p>')
    c.route(PAY, route)
    g = c.new_page(); g.set_default_timeout(15000); g.on('pageerror', lambda e: errs.append(str(e)))
    return c, g, hits

def settings(g, extra=''):
    g.goto(B + '?nosw' + extra + '#settings'); g.wait_for_load_state('load'); g.wait_for_timeout(400)
    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(200)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- 1. Shipped config (empty): nothing anywhere ----
    c, g, hits = ctx(br)
    settings(g)
    ok('HIDE-1 module loaded', g.evaluate('!!window.FlossFoxSupport'))
    ok('HIDE-2 config empty in shipped build', g.evaluate("(()=>{const k=FlossFoxSupport.config();return k.supportUrl===''&&k.packUrl===''})()"))
    ok('HIDE-3 Settings: no support section and no empty mount', g.locator('.ff-support').count() == 0 and g.locator('[data-ff-support-mount]').count() == 0)
    ok('HIDE-4 footer: no Support link', g.locator('#ffSupportFooter').count() == 0)
    ok('HIDE-5 no payment-host links in the page', g.evaluate("[...document.links].filter(a=>/ko-fi|stripe|paypal|buymeacoffee/i.test(a.href)).length") == 0)
    g.goto(B + 'about.html?nosw'); g.wait_for_load_state('load'); g.wait_for_timeout(300)
    ok('HIDE-6 About: mount stays empty', g.evaluate("document.querySelector('[data-ff-support-mount=about]').children.length") == 0)
    ok('HIDE-7 no requests to payment hosts', not hits, hits)
    c.close()

    # ---- 1b. Junk test URLs still fail closed ----
    c, g, hits = ctx(br, urls={'supportUrl': 'http://ko-fi.com/x', 'packUrl': 'https://ko-fi.com/s/a?utm_source=ff'})
    settings(g)
    ok('HIDE-8 http + tracking-query URLs fail closed (no section, no footer)', g.locator('.ff-support').count() == 0 and g.locator('#ffSupportFooter').count() == 0)
    c.close()

    # ---- 2. Fake test URLs injected: Settings + footer ----
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK})
    reqs = []; g.on('request', lambda r: reqs.append(r.url))
    settings(g)
    s = g.locator('#ffSupport-settings')
    ok('SHOW-1 Settings support section visible', s.is_visible())
    ok('SHOW-2 heading', g.inner_text('#ffSupportTitle-settings').strip() == "Keep Pip's lantern glowing")
    ok('SHOW-3 section labelled by its own heading', s.get_attribute('aria-labelledby') == 'ffSupportTitle-settings')
    links = g.locator('#ffSupport-settings a.ff-support-link')
    ok('SHOW-4 two links, tip then pack', links.count() == 2 and links.nth(0).get_attribute('data-kind') == 'tip' and links.nth(1).get_attribute('data-kind') == 'pack')
    ok('SHOW-5 hrefs exactly as configured', links.nth(0).get_attribute('href') == TIP and links.nth(1).get_attribute('href') == PACK)
    ok('SHOW-6 labels (Pixel copy)', links.nth(0).inner_text().strip() == 'Support Floss Fox' and links.nth(1).inner_text().strip() == 'Buy the printable \u00b7 $7')
    ok('SHOW-6b what-you-get line beside the pack button, linked by aria-describedby', g.inner_text('#ffSupportPackDetail-settings') == 'The Stitching Atelier Printable Companion: a 16-page US Letter PDF to print at home. $7, one time.' and links.nth(1).get_attribute('aria-describedby') == 'ffSupportPackDetail-settings')
    allrel = all(links.nth(i).get_attribute('target') == '_blank' and set((links.nth(i).get_attribute('rel') or '').split()) >= {'noopener', 'noreferrer'} and links.nth(i).get_attribute('referrerpolicy') == 'no-referrer' for i in range(2))
    ok('SHOW-7 target=_blank, rel=noopener noreferrer, referrerpolicy=no-referrer', allrel)
    ok('SHOW-8 aria-labels', links.nth(0).get_attribute('aria-label') == 'Support Floss Fox (opens external checkout)' and links.nth(1).get_attribute('aria-label') == 'Buy the Stitching Atelier Printable Companion, $7 (opens external checkout)')
    ext = g.inner_text('#ffSupport-settings .ff-support-external')
    ok('SHOW-9 visible external checkout + internet notice (plural for 2 links)', ext == 'These links open an external checkout in a new tab and need an internet connection.', ext)
    fine = g.inner_text('#ffSupport-settings')
    ok('SHOW-10 notes: free/optional and provider handles payment', "Supporting is optional and doesn't change your projects or thread collection." in fine and 'We never see your card details.' in fine, fine)
    ok('SHOW-10b no provider named anywhere in the visible section', not re.search(r'ko-?fi|stripe|paypal', fine, re.I))
    txt = g.inner_text('#ffSupport-settings')
    ok('SHOW-11 no em/en dashes, spaced hyphens or curly apostrophes in section', not re.search('[\u2014\u2013\u2019]| - ', txt))
    ok('SHOW-12 offline status empty while online', g.inner_text('#ffSupportOffline-settings').strip() == '')
    f = g.locator('#ffSupportFooter a')
    ok('FOOT-1 one small footer link, in-app to About#support (not straight to checkout)', f.count() == 1 and f.get_attribute('href') == 'about.html#support' and f.get_attribute('target') is None)
    ok('FOOT-2 footer link sits after Backup and settings', g.evaluate("(()=>{const s=document.getElementById('ffSupportFooter');return !!s&&s.previousElementSibling&&s.previousElementSibling.classList.contains('ffsettingslink')})()"))
    g.evaluate("document.getElementById('tabConvert').click()"); g.wait_for_timeout(200); g.evaluate('scrollTo(0,document.body.scrollHeight)')
    n0 = len(c.pages); f.click(); g.wait_for_timeout(500)
    ok('FOOT-3 footer link opens Settings and scrolls to the support section (no new tab, no checkout)', len(c.pages) == n0 and g.locator('#settingsView').is_visible() and g.evaluate("(()=>{const r=document.getElementById('ffSupport-settings').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0})()") and g.evaluate("document.activeElement&&document.activeElement.id")=='ffSupportTitle-settings' and not hits, g.evaluate("document.activeElement&&document.activeElement.id"))
    g.evaluate("FlossFoxSupport.mount();FlossFoxSupport.mount()")
    ok('UNIQ-1 remount twice: still one section, one footer link, no duplicate ids', g.locator('.ff-support').count() == 1 and g.locator('#ffSupportFooter').count() == 1 and g.evaluate(DUPIDS) == [], g.evaluate(DUPIDS))
    ok('NET-1 no request to any payment host on load/remount', not hits and not [u for u in reqs if PAY.match(u)], hits)
    ORIGIN = re.match(r'^https?://[^/]+', B).group(0)
    ok('NET-2 no cross-origin requests at all on dev load', not [u for u in reqs if not u.startswith(ORIGIN) and not u.startswith('data:')], [u for u in reqs if not u.startswith(ORIGIN)][:5])
    ok('LEAK-1 hrefs carry no project/thread/storage text', g.evaluate("[...document.querySelectorAll('.ff-support a')].every(a=>!/Secret|do-not-leak|BLANC|flossfox|\\?|#/.test(a.href))"))
    # dark-ish check for heading semantics
    ok('A11Y-1 links are keyboard reachable with a visible 3px focus ring', (lambda: (g.focus('#ffSupport-settings a.ff-support-tip'), g.keyboard.press('Shift+Tab'), g.keyboard.press('Tab'), g.evaluate("(()=>{const a=document.activeElement,c=getComputedStyle(a);return a.classList.contains('ff-support-tip')&&c.outlineStyle==='solid'&&parseFloat(c.outlineWidth)>=3})()"))[-1])())
    ok('A11Y-2 links at least 44px tall', g.evaluate("[...document.querySelectorAll('.ff-support a')].every(a=>a.getBoundingClientRect().height>=44)"))
    g.locator('#ffSupport-settings').scroll_into_view_if_needed(); g.screenshot(path=f'{SHOTS}/settings-desktop-light.png')
    # Click online: opens the (intercepted fake) checkout in a new tab with no opener
    with c.expect_page() as pi:
        links.nth(0).click()
    pop = pi.value; pop.wait_for_load_state('load')
    ok('CLICK-1 online tap opens a new tab at the configured URL', pop.url == TIP, pop.url)
    ok('CLICK-2 new tab has no opener (noopener)', pop.evaluate('window.opener===null'))
    ok('CLICK-3 Floss Fox shows no payment success of its own', not re.search(r'thank|success|purchased|paid', g.inner_text('#ffSupport-settings'), re.I))
    pop.close()
    # Offline tap: no dead tab, honest message
    c.set_offline(True); g.wait_for_timeout(200)
    ok('OFF-1 offline: offline note shown instead of the external-checkout line', g.inner_text('#ffSupportOffline-settings') == "You're offline. Tips and the printable need an internet connection. Everything else in Floss Fox works as usual." and not g.locator('#ffSupport-settings .ff-support-external').is_visible(), g.inner_text('#ffSupportOffline-settings'))
    ok('OFF-1b offline: links marked aria-disabled', all(links.nth(i).get_attribute('aria-disabled') == 'true' for i in range(2)))
    before_pages = len(c.pages)
    links.nth(1).click(force=True); g.wait_for_timeout(500)
    ok('OFF-2 offline tap opens no tab', len(c.pages) == before_pages, len(c.pages))
    ok('OFF-3 status region is polite live region', g.get_attribute('#ffSupportOffline-settings', 'aria-live') == 'polite' and g.get_attribute('#ffSupportOffline-settings', 'role') == 'status')
    c.set_offline(False); g.wait_for_timeout(200)
    ok('OFF-4 back online clears the notice, restores the external line and re-enables links', g.inner_text('#ffSupportOffline-settings').strip() == '' and g.locator('#ffSupport-settings .ff-support-external').is_visible() and links.nth(0).get_attribute('aria-disabled') is None)
    c.close()

    # ---- 3. Pack only: styled by kind ----
    c, g, hits = ctx(br, urls={'supportUrl': '', 'packUrl': PACK})
    settings(g)
    ok('PACK-1 only the pack link, classed as pack (not tip)', g.locator('.ff-support a').count() == 1 and g.locator('.ff-support a.ff-support-pack').count() == 1 and g.locator('.ff-support a.ff-support-tip').count() == 0)
    ok('PACK-2 singular external line for one link', g.inner_text('#ffSupport-settings .ff-support-external') == 'This link opens an external checkout in a new tab and needs an internet connection.')
    c.close()

    # ---- 4. About page mount ----
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK})
    g.goto(B + 'about.html?nosw#support'); g.wait_for_load_state('load'); g.wait_for_timeout(300)
    ok('ABOUT-1 About section visible with unique ids', g.locator('#ffSupport-about').is_visible() and g.locator('#ffSupportTitle-about').count() == 1 and g.evaluate(DUPIDS) == [])
    ok('ABOUT-1b About carries the three privacy points incl. not tax deductible', g.locator('#ffSupport-about .ff-support-privacy li').count() == 3 and "aren't tax deductible" in g.inner_text('#ffSupport-about'))
    ok('ABOUT-2 no footer support link on About (one footer link total, on the app page)', g.locator('#ffSupportFooter').count() == 0)
    ok('ABOUT-3 no payment-host requests', not hits, hits)
    g.screenshot(path=f'{SHOTS}/about-desktop-light.png', full_page=True)
    c.close()

    # ---- 5. Storage: byte-identical, nothing new created ----
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK})
    g.goto(B + '?nosw#convert'); g.wait_for_load_state('load'); g.wait_for_timeout(500)
    before = g.evaluate(DUMP)
    for tab in ('tabSettings', 'tabHelp', 'tabThreads', 'tabProjects', 'tabShop', 'tabConvert', 'tabSettings'):
        g.evaluate(f"document.getElementById('{tab}').click()"); g.wait_for_timeout(120)
        g.evaluate("FlossFoxSupport.mount()")
    after = g.evaluate(DUMP)
    ok('STORE-1 tab visits + remounts leave localStorage byte-identical', before == after)
    ok('STORE-2 project and thread data unchanged', g.evaluate(f"localStorage.getItem('{KEY}')") == SEED and g.evaluate(f"localStorage.getItem('{TK}')") == THR)
    c.close()
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK}, seed=False)
    g.goto(B + 'about.html?nosw'); g.wait_for_load_state('load'); g.wait_for_timeout(300)
    ok('STORE-3 fresh browser, About page with links: localStorage stays empty', g.evaluate(DUMP) == '[]', g.evaluate(DUMP))
    ok('STORE-4 no cookies set', c.cookies() == [])
    c.close()

    # ---- 6. First visit: classification unchanged, nothing on onboarding ----
    for urls in (None, {'supportUrl': TIP, 'packUrl': PACK}):
        tag = 'links' if urls else 'empty'
        c, g, hits = ctx(br, vw={'width': 390, 'height': 800}, urls=urls, seed=False)
        g.goto(B + '?nosw'); g.wait_for_timeout(800)
        ok(f'FV-1[{tag}] fresh visitor still classified fresh', g.evaluate('FlossFoxStartHere.fresh()') is True)
        ok(f'FV-2[{tag}] landing + Start here shown', g.locator('#ffLanding').is_visible() and g.locator('#ffStartHere').is_visible())
        ok(f'FV-3[{tag}] no support content on landing / Start here', g.locator('#ffLanding .ff-support').count() == 0 and not re.search(r'tip|support floss fox|ko-fi', g.inner_text('#ffLanding'), re.I))
        ok(f'FV-4[{tag}] no flossfox keys created on first load', not [k for k, _ in json.loads(g.evaluate(DUMP)) if k.startswith('flossfox')], g.evaluate(DUMP))
        ok(f'FV-5[{tag}] no dialogs or pop-ups', g.locator('dialog[open], [role=dialog]:visible, [aria-modal=true]:visible').count() == 0)
        c.close()

    # ---- 7. Layout: 360px, 200% zoom (640 CSS px), dark theme contrast, reduced motion ----
    for vw, name in (({'width': 360, 'height': 760}, '360'), ({'width': 640, 'height': 400}, 'zoom200')):
        c, g, hits = ctx(br, vw=vw, urls={'supportUrl': TIP, 'packUrl': PACK})
        settings(g)
        g.locator('#ffSupport-settings').scroll_into_view_if_needed()
        ok(f'LAY-1[{name}] no horizontal overflow', g.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'), g.evaluate('document.documentElement.scrollWidth'))
        ok(f'LAY-2[{name}] links >=44px and fit inside the section', g.evaluate("(()=>{const s=document.querySelector('#ffSupport-settings').getBoundingClientRect();return [...document.querySelectorAll('#ffSupport-settings a')].every(a=>{const r=a.getBoundingClientRect();return r.height>=44&&r.left>=s.left-1&&r.right<=s.right+1})})()"))
        g.screenshot(path=f'{SHOTS}/settings-{name}.png')
        c.close()
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK}, scheme='dark', motion='reduce')
    settings(g)
    CONTRAST = """(sel)=>{const a=document.querySelector(sel);const lum=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
      let e=a,bg='rgba(0, 0, 0, 0)';while(e){const b=getComputedStyle(e).backgroundColor;if(!/rgba\\(0, 0, 0, 0\\)|transparent/.test(b)){bg=b;break}e=e.parentElement}
      if(bg==='rgba(0, 0, 0, 0)')bg='rgb(15, 29, 26)';const L1=lum(getComputedStyle(a).color),L2=lum(bg);return (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05)}"""
    for sel, nm in (('#ffSupport-settings a.ff-support-tip', 'link'), ('#ffSupport-settings .ff-support-note', 'fine print'), ('#ffSupport-settings h3', 'heading')):
        r_ = g.evaluate(CONTRAST, sel); ok(f'DARK-1 {nm} contrast >= 4.5 in dark theme ({r_:.2f})', r_ >= 4.5, r_)
    ok('MOTION-1 reduced motion: no transitions on links', g.evaluate("getComputedStyle(document.querySelector('.ff-support a')).transitionDuration") in ('0s', '0s, 0s'))
    g.locator('#ffSupport-settings').scroll_into_view_if_needed(); g.screenshot(path=f'{SHOTS}/settings-desktop-dark.png')
    c.close()
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK})
    settings(g)
    for sel, nm in (('#ffSupport-settings a.ff-support-tip', 'link'), ('#ffSupport-settings .ff-support-note', 'fine print')):
        r_ = g.evaluate(CONTRAST, sel); ok(f'LIGHT-1 {nm} contrast >= 4.5 in light theme ({r_:.2f})', r_ >= 4.5, r_)
    c.close()

    # ---- 8. Offline app via service worker: module cached, app works, links say they need internet ----
    c, g, hits = ctx(br, urls={'supportUrl': TIP, 'packUrl': PACK}, sw='allow')
    g.goto(B + '#settings'); g.wait_for_load_state('networkidle')
    g.wait_for_function("navigator.serviceWorker.ready.then(()=>true)", timeout=20000); g.reload(); g.wait_for_load_state('networkidle')
    ok('SW-1 service worker controls the page', g.evaluate('!!navigator.serviceWorker.controller'))
    ok('SW-2 cache is ci005-106 and holds support files', g.evaluate("caches.keys().then(async ks=>{const k=ks.find(x=>/ci005-106/.test(x));if(!k)return false;const c=await caches.open(k);return !!(await c.match('support/links.js'))&&!!(await c.match('support/links.css'))})"))
    c.set_offline(True)
    g.reload(); g.wait_for_load_state('load'); g.wait_for_timeout(600)
    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(200)
    ok('SW-3 offline reload: app loads and support module runs from cache', g.evaluate('!!window.FlossFoxSupport') and g.locator('#ffSupport-settings').count() == 1)
    ok('SW-4 offline: section says links need internet and links are disabled', "You're offline" in g.inner_text('#ffSupportOffline-settings') and g.get_attribute('#ffSupport-settings a.ff-support-tip', 'aria-disabled') == 'true')
    g.evaluate("document.getElementById('tabThreads').click()"); g.wait_for_timeout(300)
    ok('SW-5 offline: core app (My threads) still works', g.locator('#threadsView').is_visible() and '310' in g.inner_text('#threadsView'))
    ok('SW-6 offline: project data intact', g.evaluate(f"localStorage.getItem('{KEY}')") == SEED)
    c.set_offline(False); c.close()

    ok('ERR-1 no page errors', not errs, errs[:3])
    br.close()

print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)")
sys.exit(0 if R['fail'] == 0 else 1)
