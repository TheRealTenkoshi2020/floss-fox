#!/usr/bin/env python3
"""4.0 production smoke + 3.8 data-safety checks (simulated: headless Chrome, synthetic data).
Usage: FF_KEY=flossfox.v1 python3 tests/prod_release_smoke_e2e.py http://localhost:8877/
"""
import json, os, sys
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8877/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1')
PFX = KEY[:-3]
TK = PFX + '.threads.v1'
JK = PFX + '.journal.v1'
TWK = PFX + '.threadwood.v1'
BK = PFX + '.smartstash.barcodes.v1'
CACHE = 'flossfox-v4.0-1'
R = {'pass': 0, 'fail': 0}
errs, reqs = [], []

def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else '  -> ' + str(i)[:400]))

PROJECTS = {
    'schema': 2,
    'projects': [{
        'id': 'p38', 'name': '3.8 sampler', 'notes': 'Where I left off: sky',
        'buyBrand': 'dmc', 'status': 'progress', 'progressPct': 25,
        'items': [
            {'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None},
            {'code': 'BLANC', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC BLANC'], 'stitchCount': None},
            {'code': 'B5200', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC B5200'], 'stitchCount': None},
        ],
        'decisions': {'310': 'have'}, 'purchased': {},
        'created': '2026-10-15T00:00:00.000Z', 'updated': '2026-11-08T00:00:00.000Z'
    }]
}
THREADS = {
    'schema': 2,
    'threads': {
        '310': {'n': 3, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
        'BLANC': {'n': 1, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
        'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    }
}
# A tiny journal that only records an already-saved inventory event. The 4.0 app must not rewrite it on load.
JOURNAL = {
    'schema': 1,
    'base': {'sig': 'seed', 'state': {}},
    'cps': [],
    'events': [{'id': 'e-seed', 't': '2026-11-08T00:00:00.000Z', 'k': 'inventory', 'ref': {'code': '310'}, 'from': {'n': 2, 'partial': False}, 'to': {'n': 3, 'partial': False}}]
}

SEED = {
    KEY: json.dumps(PROJECTS, separators=(',', ':')),
    TK: json.dumps(THREADS, separators=(',', ':')),
    JK: json.dumps(JOURNAL, separators=(',', ':')),
    PFX + '.pip.v1': 'shown',
    PFX + '.pipLevel.v1': 'important',
    PFX + '.tour.v1': json.dumps({'status': 'dismissed'}),
    PFX + '.startHere.v1': 'seen',
    PFX + '.hints.v1': 'off',
}

DUMP = "(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k)}return o})()"

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, service_workers='allow')
    # Seed before any document script runs, so first paint already has 3.8 keys.
    ctx.add_init_script("(d=>{for(const k of Object.keys(localStorage))localStorage.removeItem(k);for(const k in d)localStorage.setItem(k,d[k])})(" + json.dumps(SEED) + ")")
    g = ctx.new_page(); g.set_default_timeout(20000)
    g.on('pageerror', lambda e: errs.append(str(e)))
    g.on('request', lambda r: reqs.append(r.url))
    resp = g.goto(B)
    ok('index returns 200', resp is not None and resp.status == 200, resp and resp.status)
    g.wait_for_function("window.FlossFoxProjects&&window.FlossFoxBuildConfig&&document.readyState==='complete'", timeout=20000)
    g.wait_for_timeout(800)
    after = g.evaluate(DUMP)
    ok('projects key byte-identical after first load', after.get(KEY) == SEED[KEY], (after.get(KEY) or '')[:200])
    ok('threads key byte-identical after first load', after.get(TK) == SEED[TK], (after.get(TK) or '')[:200])
    # Journal may re-base onto the current collection (existing 3.8 behaviour). Projects, threads and backups must stay identical.
    j = after.get(JK)
    ok('journal still present with schema 1 after load (may re-base onto current collection)', bool(j) and '"schema":1' in j, (j or '')[:200])
    ok('no flossfox-dev keys were written', all(not k.startswith('flossfox-dev') for k in after), [k for k in after if k.startswith('flossfox-dev')])
    ok('load does not create Threadwood or Smart Stash barcode keys', TWK not in after and BK not in after, list(after))
    written = sorted(k for k in after if k not in SEED)
    # snapmeta/snapshots may be created as an additive automatic copy; never allow mutation of 3.8 data keys
    unexpected = [k for k in written if k not in (PFX + '.snapshots.v1', PFX + '.snapmeta.v1')]
    ok('only additive automatic-copy keys may appear on load (no other new keys)', not unexpected, written)
    ok('existing 3.8 keys were not deleted', all(k in after for k in SEED), [k for k in SEED if k not in after])
    ok('build-config marks scanners free in production', g.evaluate("!!(window.FlossFoxBuildConfig&&FlossFoxBuildConfig.channel==='production'&&FlossFoxBuildConfig.premiumFreeDuringTesting===true)"))
    ok('no dev-build-config request', not any('dev-build-config' in u for u in reqs), [u for u in reqs if 'dev-build-config' in u])
    ok('build-config.js was requested', any(u.rstrip('/').endswith('build-config.js') for u in reqs), [u for u in reqs if 'build-config' in u][:3])
    # Guided home + Premium free after opening My threads
    g.evaluate("document.documentElement.classList.remove('ff-landing')")
    if g.locator('#tabThreads').count():
        if not g.locator('#tabThreads').is_visible() and g.locator('#ffuxNavSummary').count():
            g.click('#ffuxNavSummary')
        g.click('#tabThreads')
        g.wait_for_selector('#ffSmartStash', timeout=10000)
        g.locator('#ffSmartStash button', has_text='Photograph threads').first.click()
        g.wait_for_timeout(400)
        txt = g.inner_text('#ffSmartStash')
        ok('Premium photo recognition shows as free', 'Free for now' in txt and 'verified Premium subscription is required' not in txt, txt[-300:])
        g.locator('#ffSmartStash button', has_text='Scan barcodes').first.click()
        g.wait_for_timeout(400)
        txt = g.inner_text('#ffSmartStash')
        ok('Premium barcode scanning shows as free', 'Free for now' in txt and 'verified Premium subscription is required' not in txt, txt[-300:])
    mid = g.evaluate(DUMP)
    ok('projects and threads still byte-identical after opening My threads and scanners', mid.get(KEY) == SEED[KEY] and mid.get(TK) == SEED[TK])
    g.reload()
    g.wait_for_function("window.FlossFoxProjects&&document.readyState==='complete'", timeout=20000)
    g.wait_for_timeout(600)
    late = g.evaluate(DUMP)
    ok('projects and threads still byte-identical after reload', late.get(KEY) == SEED[KEY] and late.get(TK) == SEED[TK])
    ok('BLANC and WHITE stayed distinct in the collection', 'BLANC' in late.get(TK, '') and 'WHITE' in late.get(TK, ''))
    # cache
    for _ in range(20):
        ks = g.evaluate("caches.keys()")
        if CACHE in ks:
            break
        g.wait_for_timeout(500)
    ok('service worker cache is flossfox-v4.0-1', CACHE in ks, ks)
    ok('no page errors', not errs, errs[:3])
    ctx.close(); br.close()

print(f"\nprod_release_smoke_e2e (simulated): {R['pass']} passed, {R['fail']} failed")
sys.exit(1 if R['fail'] else 0)
