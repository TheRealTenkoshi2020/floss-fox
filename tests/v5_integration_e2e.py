#!/usr/bin/env python3
"""V5 full-site SEO, real guide-to-app routes, and previous-dev SW upgrade.
Isolated synthetic data only. Run with FF_CHROME and a local full-repository URL.
"""
import functools
import html
import http.server
import json
import os
import re
from pathlib import Path
import sys
import threading
from playwright.sync_api import sync_playwright

def unfold(g):
    # calm pass: secondary tools sit in folded details.ffcalm sections; open them like a tester would
    g.wait_for_timeout(50); g.evaluate("document.querySelectorAll('details.ffcalm').forEach(d=>d.open=true)")

ROOT = Path(__file__).resolve().parents[1]
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8775/').rstrip('/') + '/'
GUIDES = ['tools.html', 'floss-conversion-guide.html', 'thread-inventory-guide.html', 'cross-stitch-project-planning.html']
PAGES = ['index.html', 'about.html', 'fabric.html', 'privacy.html', *GUIDES]
COUNT = 0
errors = []
outside = []

def ok(name, value, detail=''):
    global COUNT
    assert value, name + (': ' + str(detail) if detail else '')
    COUNT += 1
    print('PASS ' + name, flush=True)

def monitor(page, origin):
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: outside.append(r.url) if not r.url.startswith((origin, 'data:', 'blob:')) else None)

class UpgradeHandler(http.server.SimpleHTTPRequestHandler):
    before = True
    def log_message(self, *args): pass
    def do_GET(self):
        if self.path.split('?')[0] == '/sw.js' and self.before:
            body = (ROOT / 'tests/fixtures/pre-v5-sw.js').read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('FF_CHROME', '/usr/bin/chromium'), args=['--no-sandbox'])
    for width in (320, 360, 390, 768, 1280):
        context = browser.new_context(viewport={'width': width, 'height': 900}, is_mobile=width < 500, has_touch=width < 500, service_workers='block')
        page = context.new_page()
        monitor(page, BASE)
        titles = []
        descriptions = []
        for name in PAGES:
            page.goto(BASE + name + '?nosw')
            page.wait_for_load_state('networkidle')
            titles.append(page.title())
            expected_title=html.unescape(re.search(r'<title>(.*?)</title>', (ROOT/name).read_text(), re.S)[1])
            ok(f'{width}: {name} retains descriptive title after JavaScript', page.title() == expected_title)
            descriptions.append(page.locator('meta[name=description]').get_attribute('content'))
            ok(f'{width}: {name} dev indexing policy', page.locator('meta[name=robots]').get_attribute('content') == 'noindex, nofollow' and page.locator('link[rel=canonical]').count() == 0 and page.locator('script[type="application/ld+json"]').count() == 0)
            ok(f'{width}: {name} social metadata', all(page.locator(sel).count() == 1 for sel in ('meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]')))
            ok(f'{width}: {name} no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            if name in GUIDES:
                ok(f'{width}: {name} semantics and Pip', page.locator('main h1').count() == 1 and page.locator('nav[aria-label=Main]').count() == 1 and page.evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'))
                ok(f'{width}: {name} main action touch size', page.locator('.cta a').first.bounding_box()['height'] >= 44)
        ok(f'{width}: eight unique titles and descriptions', len(set(titles)) == 8 and len(set(descriptions)) == 8)
        context.close()

    # A guide opens the actual app from a fresh browser with no onboarding flag.
    for href, view in [('index.html#convert', 'convertView'), ('index.html#threads', 'threadsView'), ('index.html#projects', 'projectsView')]:
        context = browser.new_context(viewport={'width': 360, 'height': 900}, is_mobile=True, has_touch=True, service_workers='block')
        page = context.new_page()
        monitor(page, BASE)
        page.goto(BASE + 'tools.html')
        page.locator(f'a[href="{href}"]').click()
        page.wait_for_selector('#' + view)
        ok('guide route opens actual ' + view, page.locator('#' + view).is_visible() and not page.evaluate('document.documentElement.classList.contains("ff-landing")'))
        if view == 'threadsView':
            unfold(page); page.click('#ffauImport')
            ok('guide route reaches integrated Smart Stash importer', page.locator('#ffssFile').is_visible())
        context.close()

    context = browser.new_context(service_workers='block')
    page = context.new_page()
    page.goto(BASE + 'index.html?nosw')
    ok('snippet exclusion is limited to brand disclosure', page.locator('[data-nosnippet]').count() == 1 and 'About the brands' in page.locator('[data-nosnippet]').inner_text() and page.locator('#ffLanding[data-nosnippet], main[data-nosnippet]').count() == 0)
    ok('guided home keeps three primary choices', page.locator('#ffLanding nav.choices > a').count() == 3)
    ok('all four guides linked from main app', all(page.locator('#ffSeoGuides a[href="' + name + '"]').count() == 1 for name in GUIDES))
    context.close()

    # Real previous worker, then V5 update on the same origin and same browser.
    handler = functools.partial(UpgradeHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}/'
    try:
        context = browser.new_context(viewport={'width': 390, 'height': 900}, service_workers='allow')
        page = context.new_page()
        monitor(page, origin)
        page.goto(origin)
        page.evaluate('navigator.serviceWorker.ready')
        page.reload()
        page.wait_for_function('!!navigator.serviceWorker.controller')
        old = 'flossfox-dev-v3.9-gemini-audit-1'
        ok('previous worker is primed before upgrade', page.evaluate('(k)=>caches.open(k).then(c=>c.keys()).then(r=>r.length>=268)', old))
        page.evaluate("async()=>{await caches.open('flossfox-production-test-preserve');sessionStorage.setItem('ff.landing.seen','1')}")
        page.evaluate("""()=>{
          localStorage.setItem('flossfox-dev.v1',JSON.stringify({schema:2,projects:[{id:'v5-upgrade',name:'Upgrade sampler',notes:'Keep my notes',buyBrand:'dmc',status:'progress',items:[{code:'310',qty:2,stated:true,assumed:0,src:['310 x2'],stitchCount:null}],decisions:{},purchased:{},progressPct:37,created:'2026-11-01T00:00:00Z',updated:'2026-11-01T00:00:00Z'}]}));
          localStorage.setItem('flossfox-dev.threads.v1',JSON.stringify({schema:2,threads:{'310':{n:1,partial:false,restock:false,confirmed:true}}}));
          localStorage.setItem('flossfox-dev.stitch-sessions.v1',JSON.stringify({schema:1,sessions:[{id:'v5-s1',projectId:'v5-upgrade',date:'2026-11-17',stitches:100,minutes:25,notes:'Keep this session',usage:[]}]}));
        }""")
        page.reload()
        page.wait_for_function('!!window.FlossFoxAuditUI')
        keys = ['flossfox-dev.v1', 'flossfox-dev.threads.v1', 'flossfox-dev.stitch-sessions.v1']
        before = page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))', keys)
        UpgradeHandler.before = False
        page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())')
        expected = 'flossfox-dev-v5-gemini-audit-3-calm1'
        # Async predicates passed to wait_for_function can be truthy Promises.
        # Await the actual lifecycle/cache condition before cutting the network.
        page.evaluate('''async ({expected,old})=>{
          for(let attempt=0;attempt<600;attempt++){
            const r=await navigator.serviceWorker.getRegistration();
            if(r&&r.active&&r.active.state==='activated'&&navigator.serviceWorker.controller===r.active&&await caches.has(expected)&&!await caches.has(old))return;
            await new Promise(resolve=>setTimeout(resolve,50));
          }
          throw Error('V5 worker did not finish installation and claim this page');
        }''', {'expected':expected,'old':old})
        ok('V5 worker activates and removes prior dev cache', page.evaluate('(k)=>caches.has(k)', expected))
        ok('V5 worker preserves unrelated cache namespace', page.evaluate("caches.has('flossfox-production-test-preserve')"))
        cached = page.evaluate('(k)=>caches.open(k).then(c=>c.keys()).then(r=>r.map(x=>x.url))', expected)
        ok('new worker precaches every guide before offline navigation', all(origin + name in cached for name in GUIDES), {'cache_count':len(cached),'missing':[name for name in GUIDES if origin+name not in cached]})
        context.set_offline(True)
        for name in GUIDES:
            page.goto(origin + name)
            ok('offline guide: ' + name, page.locator('main h1').count() == 1 and page.evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'))
        page.goto(origin + 'index.html#projects')
        page.wait_for_function('!!window.FlossFoxAuditUI')
        ok('upgrade preserves browser projects, collection and sessions', before == page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))', keys))
        page.evaluate("FlossFoxProjects.open('v5-upgrade')")
        unfold(page); page.locator('#ffauSessions > summary').click()
        ok('offline upgraded journal displays saved entry', '100 stitches' in page.inner_text('#ffauRecent'))
        ok('offline upgraded progress stays manual and saved', page.input_value('#ffauPercent') == '37')
        page.evaluate("FlossFoxProjects.showView('shop')")
        unfold(page); page.click('#ffauShopStart')
        ok('offline upgraded combined list works', page.locator('#ffauTrip-310').count() == 1)
        backup = page.evaluate('FlossFoxProjects.fullBackup()')
        ok('offline backup still contains sessions after V5 update', len(backup['stitchSessions']['sessions']) == 1)
        context.close()
    finally:
        server.shutdown()
    browser.close()

ok('no page JavaScript errors', not errors)
ok('no runtime requests outside local test origins', not outside)
print(f'\n{COUNT} passed, 0 failed', flush=True)
