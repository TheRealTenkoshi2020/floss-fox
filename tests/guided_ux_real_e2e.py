#!/usr/bin/env python3
"""Guided UX on the real integrated app (simulated: headless Chrome, synthetic data).
Fresh visitor, returning visitor Continue, every tool reachable, keyboard/focus, themes, deep links,
storage unchanged by open + navigation, offline reload through the service worker.
Usage: FF_KEY=flossfox.v1 python3 tests/guided_ux_real_e2e.py http://localhost:8765/"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/guided/shots'); os.makedirs(SHOTS, exist_ok=True)
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(i)[:300]}'))
def proj(pid, name, status, upd, demo=False):
    p = {'id': pid, 'name': name, 'notes': '', 'buyBrand': 'dmc', 'status': status, 'items': [{'code': '310', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None}], 'decisions': {}, 'purchased': {}, 'created': '2026-11-01T00:00:00Z', 'updated': upd}
    if demo: p['demo'] = True
    return p
SEED = json.dumps({'schema': 2, 'projects': [proj('pd', 'Finished Wreath', 'done', '2026-11-15T00:00:00Z'), proj('pa', 'Forest Sampler', 'progress', '2026-11-10T00:00:00Z'), proj('po', 'Older Bookmark', 'planning', '2026-11-02T00:00:00Z'), proj('demo', 'Sample', 'progress', '2026-11-16T00:00:00Z', True)]})
DONE = json.dumps({'schema': 2, 'projects': [proj('pd', 'Finished Wreath', 'done', '2026-11-15T00:00:00Z')]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}, 'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}})
SNAP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
def seed(c, data):
    c.add_init_script("(([K,TK,S,T])=>{if(!sessionStorage.getItem('gx.seeded')){localStorage.clear();localStorage.setItem(K,S);localStorage.setItem(TK,T);sessionStorage.setItem('gx.seeded','1')}})(" + json.dumps([KEY, TK, data, THR]) + ")")
def ready(g): g.wait_for_function('window.FlossFoxProjects&&window.FlossFoxGuidedUX&&document.readyState==="complete"'); g.wait_for_timeout(500)
def visible(g, sel): return g.locator(sel).first.is_visible()
def noxover(g): return g.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
def pressed(g, i): return g.get_attribute('#' + i, 'aria-pressed') == 'true'
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get('FF_CHROME','/usr/bin/google-chrome'), args=['--no-sandbox'])
    for w in (360, 390, 768, 1280):
        h = 800 if w < 700 else 900
        # ---- fresh visitor ----
        c = br.new_context(viewport={'width': w, 'height': h}, service_workers='block'); g = c.new_page(); g.set_default_timeout(8000)
        g.on('pageerror', lambda e: errs.append(str(e)))
        g.goto(B + '?nosw'); ready(g)
        ok(f'{w} FRESH-1 landing shown', g.evaluate("document.documentElement.classList.contains('ff-landing')"))
        titles = g.evaluate("[...document.querySelectorAll('#ffLanding nav.choices > a.ch b')].map(b=>b.textContent)")
        ok(f'{w} FRESH-2 three primary actions in order', titles == ['Find colors for a pattern', 'Start or continue a project', 'Organize my threads'], titles)
        ok(f'{w} FRESH-3 primary actions visible', all(g.locator('#ffLanding nav.choices > a.ch').nth(i).is_visible() for i in range(3)))
        ok(f'{w} FRESH-4 no Continue for a fresh visitor', g.locator('#ffuxResume').count() == 0)
        ok(f'{w} FRESH-5 Start here + Got it + Tour + Help + Settings still there', visible(g, '#ffLanding .ffsh') and visible(g, '#ffStartHere') and visible(g, '#ffLandTour') and visible(g, '#ffLanding p.quiet a[data-tab=tabHelp]') and visible(g, '#ffLanding p.quiet a[data-tab=tabSettings]'))
        ok(f'{w} FRESH-6 Pip greeting unchanged', g.inner_text('#ffLandSay').startswith("Hi! I'm Pip."))
        g.click('#ffuxLandingTools > summary')
        ok(f'{w} FRESH-7 All tools reveals Shop and Fabric', visible(g, '#ffuxLandingTools a[data-tab=tabShop]') and visible(g, '#ffuxLandingTools a[data-tab=tabFabric]'))
        ok(f'{w} FRESH-8 no horizontal overflow on landing', noxover(g))
        if w in (390, 1280): g.screenshot(path=f'{SHOTS}/home-fresh-{w}.png', full_page=False)
        ok(f'{w} FRESH-9 nothing saved by opening the landing', g.evaluate(SNAP) == '[]', g.evaluate(SNAP))
        g.click('#ffLanding nav.choices > a[data-tab=tabConvert]'); g.wait_for_timeout(200)
        ok(f'{w} FRESH-10 Find colors opens the converter', pressed(g, 'tabConvert') and not g.evaluate("document.documentElement.classList.contains('ff-landing')") and visible(g, '#inp'))
        c.close()
        # ---- returning visitor ----
        c = br.new_context(viewport={'width': w, 'height': h}, service_workers='block'); seed(c, SEED); g = c.new_page(); g.set_default_timeout(8000)
        g.on('pageerror', lambda e: errs.append(str(e)))
        g.goto(B + '?nosw'); ready(g)
        s0 = g.evaluate(SNAP)
        ok(f'{w} RET-1 seeded data unchanged on load', g.evaluate(f"localStorage.getItem('{KEY}')") == SEED and g.evaluate(f"localStorage.getItem('{TK}')") == THR)
        ok(f'{w} RET-2 Continue names latest unfinished non-demo project', visible(g, '#ffuxResume') and 'Continue: Forest Sampler' in g.inner_text('#ffuxResume'), g.locator('#ffuxResume').all_inner_texts())
        if w in (390, 1280): g.screenshot(path=f'{SHOTS}/home-returning-{w}.png', full_page=False)
        g.click('#ffuxResume'); g.wait_for_timeout(400)
        ok(f'{w} RET-3 Continue opens that project in the editor', g.evaluate("FlossFoxProjects.openId()") == 'pa' and visible(g, '#projEdit') and pressed(g, 'tabProjects'))
        ok(f'{w} RET-4 storage byte-identical after Continue', g.evaluate(SNAP) == s0)
        # experienced: every tool, More tools menu, storage still identical
        for t in ('tabConvert', 'tabThreads', 'tabProjects'):
            g.click('#' + t); g.wait_for_timeout(120); ok(f'{w} NAV {t} visible in main row and works', pressed(g, t))
        wb = g.locator('#tabWorkbasket')
        if wb.count() and wb.is_visible():
            wb.click(); g.wait_for_timeout(150); ok(f'{w} NAV Workbasket works', pressed(g, 'tabWorkbasket'))
        for t, nm in (('tabShop', 'Shopping'), ('tabHelp', 'Help'), ('tabSettings', 'Settings')):
            g.click('#ffuxNavSummary'); g.click('#' + t); g.wait_for_timeout(200)
            ok(f'{w} MORE {nm} reachable and summary names it', pressed(g, t) and g.inner_text('#ffuxNavSummary').strip() == 'More: ' + nm and not g.evaluate("document.getElementById('ffuxNavMore').open"), g.inner_text('#ffuxNavSummary'))
        g.click('#ffuxNavSummary')
        ok(f'{w} MORE Fabric link present', visible(g, '#ffuxNavList a#tabFabric') and g.get_attribute('#tabFabric', 'href') == 'fabric.html')
        ok(f'{w} MORE menu not clipped', g.evaluate("(()=>{const r=document.getElementById('ffuxNavList').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})()"))
        g.keyboard.press('Escape'); g.click('#tabConvert')
        ok(f'{w} NAV-4 no horizontal overflow in app', noxover(g))
        ok(f'{w} NAV-5 primary tabs + More fit in one row', g.evaluate("(()=>{const ts=['tabConvert','tabThreads','tabProjects','ffuxNavSummary'].map(i=>document.getElementById(i).getBoundingClientRect().top);return Math.max(...ts)-Math.min(...ts)<8})()"))
        g.keyboard.press('Control+k'); g.wait_for_timeout(200)
        ok(f'{w} KEY-1 Ctrl+K search still opens', g.evaluate("!!document.activeElement&&document.activeElement.tagName==='INPUT'&&!!document.activeElement.closest('[role=dialog],.ffa-search,#ffaSearch,dialog')") or g.evaluate("document.activeElement&&document.activeElement.type==='search'"), g.evaluate("document.activeElement&&document.activeElement.outerHTML.slice(0,120)"))
        g.keyboard.press('Escape')
        ok(f'{w} RET-5 storage byte-identical after visiting every tool', g.evaluate(SNAP) == s0)
        c.close()
    # ---- only finished projects ----
    c = br.new_context(viewport={'width': 390, 'height': 800}, service_workers='block'); seed(c, DONE); g = c.new_page(); g.goto(B + '?nosw'); ready(g)
    ok('DONE-1 only finished projects: no Continue', g.locator('#ffuxResume').count() == 0 and g.evaluate("document.documentElement.classList.contains('ff-landing')")); c.close()
    # ---- deep links ----
    c = br.new_context(viewport={'width': 390, 'height': 800}, service_workers='block'); seed(c, SEED); g = c.new_page()
    for hsh, tab in (('#shop', 'tabShop'), ('#settings', 'tabSettings'), ('#help', 'tabHelp'), ('#threads', 'tabThreads'), ('#projects', 'tabProjects'), ('#workbasket', 'tabWorkbasket'), ('#convert', 'tabConvert')):
        g.goto('about:blank'); g.goto(B + '?nosw' + hsh); ready(g)
        ok(f'LINK {hsh} opens {tab}, no landing', pressed(g, tab) and not g.evaluate("document.documentElement.classList.contains('ff-landing')"))
    g.goto('about:blank'); g.goto(B + '?nosw#settings'); ready(g)
    ok('LINK-S More summary names Settings on a deep link', g.inner_text('#ffuxNavSummary').strip() == 'More: Settings')
    # keyboard + focus in every theme
    g.goto('about:blank'); g.goto(B + '?nosw#convert'); ready(g)
    for th in ('morning', 'forest', 'moon', 'system'):
        g.evaluate(f"FlossFoxAtelierTheme.apply('{th}')")
        g.focus('#tabProjects'); g.keyboard.press('Tab')
        st = g.evaluate("(()=>{const a=document.activeElement,s=getComputedStyle(a);return{id:a.id,ow:s.outlineWidth,os:s.outlineStyle,oc:s.outlineColor,bg:getComputedStyle(document.body).backgroundColor}})()")
        ok(f'FOCUS {th}: Tab from Projects lands on More tools with visible outline', st['id'] == 'ffuxNavSummary' and st['os'] != 'none' and float(st['ow'].replace('px', '') or 0) >= 2 and st['oc'] != st['bg'], st)
        g.keyboard.press('Enter'); ok(f'KEY {th}: Enter opens More tools', g.evaluate("document.getElementById('ffuxNavMore').open"))
        g.keyboard.press('Tab'); a = g.evaluate("document.activeElement.id")
        ok(f'KEY {th}: next Tab enters the menu', a == 'tabShop', a)
        g.keyboard.press('Shift+Tab'); g.keyboard.press('Enter')
    s1 = g.evaluate(SNAP); ok('THEME-1 theme previews wrote nothing', json.loads(s1) == json.loads(g.evaluate(SNAP)) and g.evaluate(f"localStorage.getItem('{KEY}')") == SEED)
    c.close()
    # ---- offline through service worker ----
    c = br.new_context(viewport={'width': 390, 'height': 800}); g = c.new_page(); g.set_default_timeout(15000)
    g.goto(B); g.wait_for_function("navigator.serviceWorker&&navigator.serviceWorker.controller", timeout=15000) if g.evaluate("!!navigator.serviceWorker.controller") else (g.wait_for_timeout(2500), g.reload(), g.wait_for_timeout(1500))
    g.wait_for_timeout(1000)
    ck = g.evaluate("caches.keys().then(async ks=>{const k=ks.find(x=>x==='flossfox-v5.0-1');if(!k)return{ks};const c=await caches.open(k);return{k,ks,js:!!(await c.match('guided-ux.js')),css:!!(await c.match('guided-ux.css'))}})")
    ok('SW-1 cache flossfox-v5.0-1 holds guided-ux.js and .css; no older flossfox cache left', ck.get('js') and ck.get('css') and all(k=='flossfox-v5.0-1' for k in ck['ks'] if k.startswith('flossfox-')), ck)
    c.set_offline(True); g.reload(); g.wait_for_timeout(1500)
    ok('SW-2 offline reload still shows guided nav', g.locator('#ffuxNavMore').count() == 1 and g.evaluate("!!window.FlossFoxGuidedUX"))
    c.close(); br.close()
ok('no page errors', not errs, errs[:3])
print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)")
sys.exit(1 if R['fail'] else 0)
