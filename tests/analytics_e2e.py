"""GoatCounter gate (simulated). Usage: python3 tests/analytics_e2e.py LOCAL_URL [PREVIEW_URL]
- localhost and the dev preview: no gc.zgo.at / goatcounter request, no counter script tag, on every page.
- flossfox.com and www.flossfox.com SIMULATED: Playwright serves this repo's files for those hosts and
  stubs gc.zgo.at (nothing leaves the box). Checks the tag: async, right src, data-goatcounter.
- Offline on localhost with the service worker: pages still load, the SW never answers cross-origin."""
import sys, os, re
from playwright.sync_api import sync_playwright
L = sys.argv[1].rstrip('/') + '/'; PV = sys.argv[2].rstrip('/') + '/' if len(sys.argv) > 2 else None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PAGES = ['', 'about.html', 'privacy.html', 'fabric.html']; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
GC = re.compile(r'gc\.zgo\.at|goatcounter\.com')
TAG = "[...document.querySelectorAll('script[src*=\"gc.zgo.at\"]')].map(s=>({src:s.src,async:s.async,gc:s.getAttribute('data-goatcounter')}))"
MIME = {'html': 'text/html', 'js': 'text/javascript', 'mjs': 'text/javascript', 'css': 'text/css', 'json': 'application/json', 'svg': 'image/svg+xml', 'png': 'image/png', 'webmanifest': 'application/manifest+json'}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for label, base in [('localhost', L)] + ([('dev preview', PV)] if PV else []):
        c = b.new_context(service_workers='block'); hits = []; c.on('request', lambda r: GC.search(r.url) and hits.append(r.url)); g = c.new_page()
        for pg in PAGES:
            g.goto(base + pg + ('?nosw' if not pg else '')); g.wait_for_timeout(700)
            ok(f'{label} /{pg}: no counter script tag', g.evaluate(TAG) == [], g.evaluate(TAG))
        ok(f'{label}: no request to gc.zgo.at or goatcounter.com', not hits, hits); c.close()
    for host in ('flossfox.com', 'www.flossfox.com'):
        c = b.new_context(service_workers='block'); gc = []
        def serve(route):
            path = route.request.url.split(host, 1)[1].split('?')[0].lstrip('/') or 'index.html'; f = os.path.join(ROOT, path)
            if os.path.isfile(f): route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': MIME.get(path.rsplit('.', 1)[-1], 'application/octet-stream')})
            else: route.fulfill(status=404, body='')
        c.route(f'https://{host}/**', serve)
        c.route(re.compile(r'https://(gc\.zgo\.at|[^/]*goatcounter\.com)/.*'), lambda r: (gc.append(r.request.url), r.fulfill(status=200, body='', headers={'content-type': 'text/javascript'})))
        c.route(re.compile(r'^https://(?!(gc\.zgo\.at|www\.flossfox\.com|flossfox\.com)/).*'), lambda r: r.abort())
        g = c.new_page()
        for pg in PAGES:
            g.goto(f'https://{host}/{pg}'); g.wait_for_timeout(500); t = g.evaluate(TAG)
            ok(f'{host} (simulated) /{pg}: one async gc.zgo.at/count.js tag with data-goatcounter=https://flossfox.goatcounter.com/count',
               t == [{'src': 'https://gc.zgo.at/count.js', 'async': True, 'gc': 'https://flossfox.goatcounter.com/count'}], t)
        ok(f'{host} (simulated): count.js requested (stubbed, nothing sent)', any('gc.zgo.at/count.js' in u for u in gc), gc); c.close()
    sw = open(os.path.join(ROOT, 'sw.js')).read()
    ok('sw.js ignores cross-origin requests (gc.zgo.at passes straight to the network)', "u.origin !== location.origin" in sw)
    ok('sw.js precaches analytics.js', '"analytics.js"' in sw)
    c = b.new_context(); g = c.new_page(); g.goto(L); g.wait_for_function("navigator.serviceWorker&&navigator.serviceWorker.controller", timeout=20000) if g.evaluate("navigator.serviceWorker.ready.then(()=>1)") else None
    g.reload(); g.wait_for_timeout(800); c.set_offline(True); errs = []
    for pg in PAGES:
        try: r = g.goto(L + pg); ok(f'offline /{pg} loads from the service worker', r is not None and r.ok and g.locator('body').inner_text().strip() != '', r and r.status)
        except Exception as e: ok(f'offline /{pg} loads', False, e)
    c.close(); print(f'{R[0]} passed, {R[1]} failed')
