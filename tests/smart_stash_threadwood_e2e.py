#!/usr/bin/env python3
"""3.9 V4: Smart Stash + Threadwood integrated into the real dev app.
SIMULATED: headless Chrome, synthetic data and files, no camera, no real device.
Usage: FF_KEY=flossfox.v1 python3 tests/smart_stash_threadwood_e2e.py URL [--shots DIR]"""
import sys, os, json, io, struct
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
SH = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; TWK = PFX + '.threadwood.v1'
FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'smart-stash')
R = {'pass': 0, 'fail': 0}; errs = []; offsite = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(i)[:400]}'))
items = [{'code': c, 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None} for c in ('310', 'BLANC', '321')]
PR = [{'id': 'pa', 'name': 'Autumn fox sampler', 'notes': '', 'buyBrand': 'dmc', 'status': 'progress', 'progressPct': 40, 'items': items, 'decisions': {}, 'purchased': {}, 'created': '2026-11-01T00:00:00Z', 'updated': '2026-11-10T00:00:00Z'},
      {'id': 'pb', 'name': 'Finished bookmark', 'notes': '', 'buyBrand': 'dmc', 'status': 'done', 'items': items, 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-10T00:00:00Z'}]
SEED = json.dumps({'schema': 2, 'projects': PR})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
                                           'BLANC': {'n': 1, 'partial': True, 'restock': True, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}})
# snapmeta.persistAt is the existing snapshots.js persistent-storage request time (pre-existing, unchanged file); everything else must be byte-identical
SNAP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,/\\.snapmeta\\.v1$/.test(k)?String(localStorage.getItem(k)).replace(/\"persistAt\":\"[^\"]*\"/,''):localStorage.getItem(k)]))"
WIDE = """(W=>{const o=[];document.querySelectorAll('body *').forEach(e=>{if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return;const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0)o.push((e.id?'#'+e.id:e.tagName+'.'+String(e.className).slice(0,30))+':'+Math.round(r.right))});return{sw:document.documentElement.scrollWidth,o:o.slice(0,6)}})"""
def wide(g, label):
    w = g.viewport_size['width']; r = g.evaluate(WIDE, w); ok(label + ': no sideways scroll', r['sw'] <= w, r)
def ls(g, k): return g.evaluate(f"localStorage.getItem({json.dumps(k)})")
def jpeg():
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (900, 640), (238, 226, 205)); d = ImageDraw.Draw(im)
    for x in range(40, 860, 24):
        for y in range(40, 600, 24): d.line((x, y, x + 10, y + 10), fill=(180, 60, 50), width=3); d.line((x + 10, y, x, y + 10), fill=(180, 60, 50), width=3)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=85); return b.getvalue()
def new(br, w, seed=True, sw='block', theme=None):
    c = br.new_context(viewport={'width': w, 'height': 900}, is_mobile=w < 500, has_touch=w < 500, service_workers=sw, accept_downloads=True)
    if seed: c.add_init_script("(([K,TK,S,T])=>{if(!sessionStorage.getItem('ss.seeded')){localStorage.clear();localStorage.setItem(K,S);localStorage.setItem(TK,T);sessionStorage.setItem('ss.seeded','1')}})(" + json.dumps([KEY, TK, SEED, THR]) + ")")
    g = c.new_page(); g.set_default_timeout(15000); g.on('pageerror', lambda e: errs.append(str(e)))
    g.on('request', lambda r: (not r.url.startswith(B) and not r.url.startswith('data:') and not r.url.startswith('blob:')) and offsite.append(r.url))
    g.on('dialog', lambda d: d.accept())
    return c, g
def boot(g, q='?nosw'):
    g.goto(B + q); g.wait_for_function('window.FlossFoxGuidedUX&&window.FlossFoxThreadwood&&document.readyState==="complete"'); g.wait_for_timeout(400)
def open_more(g, tab):
    if not g.locator('#' + tab).is_visible(): g.click('#ffuxNavSummary')
    g.click('#' + tab); g.wait_for_timeout(300)
def to_threads(g):
    g.evaluate("document.documentElement.classList.remove('ff-landing')"); g.click('#tabThreads'); g.wait_for_selector('#thMoreAdd', state='attached'); g.evaluate("document.getElementById('thMoreAdd').open=true"); g.wait_for_selector('#ffSmartStash')
def ssbtn(g, text): g.locator('#ffSmartStash button', has_text=text).first.click(); g.wait_for_timeout(250)
def focus_ring(g, sel):
    g.keyboard.press('Tab'); g.locator(sel).first.focus()
    return g.locator(sel).first.evaluate("e=>{const s=getComputedStyle(e);return document.activeElement===e&&((s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none')}")

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get('FF_CHROME','/usr/bin/google-chrome'), args=['--no-sandbox'])
    # ---------- 1. Every width, light and dark: entry points, layout, keyboard, read-only navigation ----------
    for w in (360, 390, 768, 1280):
        for th in ('morning', 'moon'):
            t = f'[{w} {th}] '; c, g = new(br, w); boot(g)
            g.evaluate(f"FlossFoxAtelierTheme.apply('{th}')"); g.wait_for_timeout(150); s0 = g.evaluate(SNAP)
            ok(t + 'guided home keeps Continue and adds the quiet Pip\'s Den link', g.locator('#ffuxResume').is_visible() and g.locator('#ffuxDenLink').is_visible())
            ok(t + 'still exactly three main choices (no second landing page)', g.locator('#ffLanding nav.choices > a.ffux-choice, #ffLanding nav.choices > a[data-tab="tabConvert"], #ffLanding nav.choices > a[data-tab="tabThreads"], #ffLanding nav.choices > a[data-tab="tabProjects"]').count() == 3)
            wide(g, t + 'guided home')
            g.click('#ffuxDenLink'); g.wait_for_timeout(400)
            ok(t + 'floating Pip companion steps aside inside the Den (no double Pip)', g.evaluate("(e=>!e||getComputedStyle(e).display==='none')(document.getElementById('pip'))"))
            ok(t + "Pip's Den opens from the guided home", g.locator('#threadwoodView').is_visible() and "Pip's Den" in g.inner_text('#threadwoodView h1'))
            ok(t + "nav shows More: Pip's Den (Den lives under More tools, not a new first tab)", g.inner_text('#ffuxNavSummary') == "More: Pip's Den" and g.evaluate("document.getElementById('tabThreadwood').parentElement.id") == 'ffuxNavList')
            ok(t + 'Den uses the existing approved Pip image', g.evaluate("[...document.querySelectorAll('#threadwoodView .tw-pip img')].every(i=>/assets\\/pip\\/pip-greeting-160\\.(png|webp)/.test(i.currentSrc||i.src)&&i.naturalWidth>0)"))
            g.evaluate("document.querySelectorAll('#threadwoodView details').forEach(d=>d.open=true)"); g.wait_for_timeout(150)
            wide(g, t + "Pip's Den, all sections open")
            ok(t + 'Den tiles have a visible keyboard focus ring', focus_ring(g, '#threadwoodView .tw-tile'))
            if SH and th == 'morning' and w in (390, 1280):
                g.evaluate("document.querySelectorAll('#threadwoodView details').forEach((d,i)=>d.open=i===0)"); g.evaluate('scrollTo(0,0)'); g.screenshot(path=f'{SH}/pips-den-{w}.png', full_page=True)
            open_more(g, 'tabThreadwood'); ok(t + "Pip's Den reachable from More tools", g.locator('#threadwoodView').is_visible())
            g.click('#tabThreads'); g.wait_for_selector('#thMoreAdd', state='attached'); g.evaluate("document.getElementById('thMoreAdd').open=true"); g.wait_for_selector('#ffSmartStash')
            ok(t + 'floating Pip companion is back on My threads after leaving the Den', g.evaluate("(e=>!!e&&getComputedStyle(e).display!=='none')(document.getElementById('pip'))"))
            ok(t + 'My threads shows the Smart Stash entry; Den closes', g.locator('#ffSmartStash').is_visible() and not g.locator('#threadwoodView').is_visible())
            ok(t + 'scanners say they are free, no prices or upgrade prompts', (('Free for now' in g.inner_text('#ffSmartStash')) or ('Free during testing' in g.inner_text('#ffSmartStash'))) and not any(x in g.inner_text('body') for x in ('$', 'Upgrade', 'Subscribe', 'Checkout', 'per month')))
            ok(t + 'Smart Stash choices have a visible keyboard focus ring', focus_ring(g, '#ffSmartStash .ffss-choice'))
            g.click('#ffssInventoryTools summary'); ssbtn(g, 'Import a list'); wide(g, t + 'My threads with Smart Stash import and audit open')
            if SH and th == 'morning' and w == 390:
                ssbtn(g, 'Import a list'); g.click('#ffssInventoryTools summary'); g.locator('#ffSmartStash').scroll_into_view_if_needed(); g.evaluate("scrollBy(0,-90)"); g.screenshot(path=f'{SH}/my-threads-smart-stash-390.png')
            g.click('#tabProjects'); g.wait_for_timeout(200)
            if w == 1280:
                open_more(g, 'tabThreadwood'); g.click('#tabThreads'); g.wait_for_timeout(200); g.go_back(); g.wait_for_timeout(400)
                ok(t + "browser Back returns to Pip's Den", g.locator('#threadwoodView').is_visible())
            g.reload(); g.wait_for_function('window.FlossFoxThreadwood'); g.wait_for_timeout(300)
            ok(t + 'saved data byte-identical after opening, navigating and reloading (no Threadwood key created)', g.evaluate(SNAP) == s0 and ls(g, TWK) is None)
            c.close()

    # ---------- 2. Smart Stash imports through review, apply, undo (390) ----------
    c, g = new(br, 390); boot(g); to_threads(g)
    def run_import(label, fname=None, paste=None, sheet=False, expect=(), absent=(), keep310=True):
        before = ls(g, TK)
        ssbtn(g, 'Import a list')
        if fname: g.set_input_files('#ffssFile', os.path.join(FX, fname))
        else: g.fill('#ffssPaste', paste); ssbtn(g, 'Review pasted list')
        g.wait_for_timeout(400)
        if sheet:
            g.wait_for_selector('#ffSmartStash select[aria-label="Worksheet name"]'); opts = g.locator('#ffSmartStash select[aria-label="Worksheet name"] option').all_inner_texts()
            ok(label + ': both worksheets offered', len(opts) >= 2, opts); g.locator('#ffSmartStash select[aria-label="Worksheet name"]').select_option(index=len(opts) - 1); ssbtn(g, 'Import this worksheet'); g.wait_for_timeout(300)
        if g.locator('#ffSmartStash h4', has_text='Match your list columns').count(): ssbtn(g, 'Review ')
        ok(label + ': review shown, nothing saved yet', g.locator('#ffSmartStash h4', has_text='review before saving').count() == 1 and ls(g, TK) == before)
        for txt in ('I reviewed the skipped', 'unnumbered quantities', 'unusually large'):
            box = g.locator('#ffSmartStash label', has_text=txt).locator('input')
            if box.count() and not box.first.is_checked(): box.first.check(); g.wait_for_timeout(150)
        save = g.locator('#ffSmartStash button', has_text='Save ').first
        ok(label + ': save enabled after review', save.is_enabled(), g.inner_text('#ffSmartStash')[-300:])
        save.click(); g.wait_for_timeout(300)
        th = json.loads(ls(g, TK))['threads']
        ok(label + ': applied ' + ','.join(expect), all(k in th for k in expect), list(th))
        if absent: ok(label + ': not imported ' + ','.join(absent), not any(k in th for k in absent), list(th))
        if keep310: ok(label + ': existing 310 count, BLANC partial/restock kept', th['310']['n'] == 2 and th['BLANC'].get('partial') is True and th['BLANC'].get('restock') is True, th.get('310'))
        g.locator('#ffSmartStash button', has_text='Undo this import').click(); g.wait_for_timeout(300)
        ok(label + ': Undo restores the collection exactly', ls(g, TK) == before)
    run_import('TXT', 'inventory-plain.txt', expect=('321', 'B5200', 'BLANC', 'WHITE'))
    run_import('CSV', 'inventory-from-app.csv', expect=('03', 'WHITE', 'B5200'))
    th_csv = None
    run_import('JSON', 'inventory-export.json', expect=('321', 'B5200'))
    run_import('XLSX', 'inventory-with-two-sheets.xlsx', sheet=True, expect=())
    run_import('Ambiguous CSV', 'ambiguous-and-unsupported.csv', expect=('B5200',), absent=('403', '321'))
    run_import('Pasted list', paste='DMC 310 x2\nWHITE x3\n03 x1', expect=('WHITE', '03'))
    # BLANC and WHITE stay distinct
    ssbtn(g, 'Import a list'); g.set_input_files('#ffssFile', os.path.join(FX, 'inventory-from-app.csv')); g.wait_for_timeout(300); ssbtn(g, 'Review ')
    g.locator('#ffSmartStash label', has_text='Replace existing counts').locator('input').check(); g.wait_for_timeout(200)
    g.locator('#ffSmartStash button', has_text='Save ').first.click(); g.wait_for_timeout(300); th = json.loads(ls(g, TK))['threads']
    ok('BLANC and WHITE saved as two separate colors (BLANC 2, WHITE 1), 03 kept as 03', th['BLANC']['n'] == 2 and th['WHITE']['n'] == 1 and '03' in th and '3' not in th, {k: th[k].get('n') for k in th})
    g.locator('#ffSmartStash button', has_text='Undo this import').click(); g.wait_for_timeout(300)
    # catalog
    before = ls(g, TK); ssbtn(g, 'Choose colors'); g.fill('#ffSmartStash input[type=search]', 'B5200'); g.wait_for_timeout(200)
    g.locator('#ffSmartStash .ffss-color', has_text='B5200').first.click(); ssbtn(g, 'Review selected colors')
    g.locator('#ffSmartStash button', has_text='Save ').first.click(); g.wait_for_timeout(300)
    ok('Choose colors: B5200 added through review', 'B5200' in json.loads(ls(g, TK))['threads'])
    g.locator('#ffSmartStash button', has_text='Undo this import').click(); g.wait_for_timeout(300); ok('Choose colors: Undo restores exactly', ls(g, TK) == before)
    # export
    g.click('#ffssInventoryTools summary'); g.wait_for_timeout(200)
    with g.expect_download() as d: g.locator('#ffssInventoryTools button', has_text='Export CSV').click()
    csv = open(d.value.path(), encoding='utf-8').read(); ok('Export CSV downloads and lists 310 and BLANC', '310' in csv and 'BLANC' in csv, csv[:200])
    with g.expect_download() as d: g.locator('#ffssInventoryTools button', has_text='Export JSON').click()
    js = json.load(open(d.value.path())); ok('Export JSON downloads valid JSON', bool(js))
    ok('exports did not change the collection', ls(g, TK) == before)
    # Premium scanners free during testing on the dev test site; real Tesseract on a SYNTHETIC label
    ssbtn(g, 'Photograph threads'); g.wait_for_timeout(300)
    txt = g.inner_text('#ffSmartStash')
    ok('Photograph threads opens (free for now), no subscription lock', (('Free for now' in txt) or ('Free during testing' in txt)) and 'verified Premium subscription' not in txt and g.locator('#ffSmartStash input[type=file][accept="image/*"]').count() == 1)
    ok('OCR engine not loaded until the photo scanner runs', g.evaluate("!window.Tesseract"))
    before = ls(g, TK)
    g.set_input_files('#ffSmartStash input[type=file][accept="image/*"]', os.path.join(FX, 'synthetic-ocr-label-test-only.png'))
    g.locator('#ffSmartStash button', has_text='Find thread numbers').click()
    try: g.wait_for_selector('#ffSmartStash h4:has-text("Photographed threads: review before saving")', timeout=120000); got = True
    except Exception: got = False
    ok('SYNTHETIC label: self-hosted OCR suggests DMC 310 into the same review, nothing saved', got and g.locator('#ffSmartStash input[aria-label="Correct DMC code 310"]').count() == 1 and ls(g, TK) == before, g.inner_text('#ffSmartStash')[-300:])
    if g.locator('#ffSmartStash button', has_text='Cancel review').count(): g.locator('#ffSmartStash button', has_text='Cancel review').click()
    ssbtn(g, 'Scan barcodes'); g.wait_for_timeout(800); txt = g.inner_text('#ffSmartStash')
    ok('Scan barcodes opens (free for now); headless has no camera, nothing saved', 'verified Premium subscription' not in txt and ls(g, TK) == before)
    ssbtn(g, 'Scan barcodes')
    c.close()
    # production build-config makes scanners free; entitlement bridge stays fail-closed if the config is absent
    c, g = new(br, 390); boot(g); to_threads(g); ssbtn(g, 'Photograph threads'); g.wait_for_timeout(400); txt = g.inner_text('#ffSmartStash')
    ok('production build-config keeps photo recognition free, no subscription lock', (('Free for now' in txt) or ('Free during testing' in txt)) and g.locator('#ffSmartStash input[accept="image/*"]').count() == 1, txt[-300:])
    c.close()
    c, g = new(br, 390); g.route('**/build-config.js', lambda r: r.fulfill(status=404, body=''))
    boot(g); to_threads(g); ssbtn(g, 'Photograph threads'); g.wait_for_timeout(1500); txt = g.inner_text('#ffSmartStash')
    ok('without the production build-config the photo scanner stays locked (fail-closed) and import stays free', 'Premium scanning is not activated in this build' in txt or 'verified Premium subscription is required' in txt or 'Premium flagship' in txt, txt[-300:])
    ok('without the production build-config the file input is not offered', g.locator('#ffSmartStash input[accept="image/*"]').count() == 0, txt[-300:])
    c.close()

    # ---------- 3. Threadwood features (390) ----------
    c, g = new(br, 390); boot(g); g.evaluate("document.documentElement.classList.remove('ff-landing')")
    k0, t0 = ls(g, KEY), ls(g, TK)
    open_more(g, 'tabThreadwood')
    g.click('#twSession summary') if not g.locator('#twRun').is_visible() else None
    g.select_option('#twSessionProject', 'pa'); g.click('#twRun'); g.wait_for_timeout(2300)
    ok('Stitchside timer runs', g.inner_text('#twRun') == 'Pause session')
    g.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange',{bubbles:true}))"); g.wait_for_timeout(200)
    ok('Stitchside pauses when the page is hidden', g.inner_text('#twRun') == 'Resume session')
    g.evaluate("delete document.hidden"); g.click('#twEnd'); g.wait_for_timeout(300)
    tw = json.loads(ls(g, TWK)); ok('Stitchside session logged with project, no project change', len(tw['sessions']) == 1 and tw['sessions'][0]['projectId'] == 'pa' and ls(g, KEY) == k0, tw['sessions'])
    g.click('#twTreasures summary'); g.wait_for_timeout(150); g.locator('#twTreasures button', has_text='Save this discovery').click(); g.wait_for_timeout(200)
    ok("Pip's Treasures: discovery saved", len(json.loads(ls(g, TWK))['favorites']) == 1)
    g.locator('#threadwoodView .tw-undo').click(); g.wait_for_timeout(200)
    ok('Undo last Threadwood change removes it', json.loads(ls(g, TWK))['favorites'] == [])
    if not g.locator('#twTreasures').evaluate('e=>e.open'): g.click('#twTreasures summary')
    g.locator('#twTreasures button', has_text='Save this discovery').click(); g.wait_for_timeout(200)
    if not g.locator('#twJourney').evaluate('e=>e.open'): g.click('#twJourney summary')
    g.select_option('#twJourneyProject', 'pa'); g.fill('#twNote', 'Finished the fox ears tonight.')
    g.set_input_files('#twPhoto', files=[{'name': 'progress.jpg', 'mimeType': 'image/jpeg', 'buffer': jpeg()}]); g.wait_for_selector('#threadwoodView img.tw-preview:not([hidden])')
    g.locator('#twJourney button', has_text='Save this moment').click(); g.wait_for_timeout(300)
    tw = json.loads(ls(g, TWK)); e = tw['entries'][0] if tw['entries'] else {}
    ok('Stitching Journey: note + local re-encoded JPEG saved with real 40% progress', e.get('note', '').startswith('Finished the fox') and e.get('photo', '').startswith('data:image/jpeg;base64,') and len(e['photo']) <= 180000 and e.get('progressPct') == 40, {k: (v if k != 'photo' else len(v)) for k, v in e.items()})
    ok('projects and threads unchanged by Threadwood', ls(g, KEY) == k0 and ls(g, TK) == t0)
    with g.expect_download() as d: g.locator('#twJourney button', has_text='Stitch & Share postcard').first.click()
    png = open(d.value.path(), 'rb').read()
    ok('Stitch & Share: postcard PNG downloaded locally (1100x780), never posted', png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1100, 780) and d.value.suggested_filename.endswith('.png'))
    if SH:
        open(f'{SH}/stitch-and-share-postcard.png', 'wb').write(png)
    with g.expect_download() as d: g.locator('#twJourney button', has_text='Download Threadwood backup').click()
    twfile = open(d.value.path()).read(); ok('Threadwood export downloads all memories', json.loads(twfile)['app'] == 'flossfox-threadwood' and len(json.loads(twfile)['memories']['entries']) == 1)
    g.click('#twKeepsakes summary'); g.wait_for_timeout(150)
    ok('Keepsake Collection lists the finished project only', 'Finished bookmark' in g.inner_text('#twKeepsakes') and 'Autumn fox' not in g.inner_text('#twKeepsakes'))
    g.locator('#twKeepsakes button', has_text='Open project').click(); g.wait_for_timeout(400)
    ok('Keepsake opens the real project editor; Den closes', g.locator('#projEdit').is_visible() and 'Finished bookmark' in g.inner_text('#projEdit') and not g.locator('#threadwoodView').is_visible())
    # canonical full backup includes Threadwood
    g.click('#pClose') if g.locator('#pClose').is_visible() else None
    g.click('#tabProjects'); g.evaluate("(()=>{const b=document.getElementById('backupBox');b.open=true;b.scrollIntoView()})()"); g.wait_for_timeout(200)
    with g.expect_download() as d: g.click('#backupBtn')
    full = json.load(open(d.value.path()))
    ok('full FlossFox backup includes Threadwood memories (photo, session, discovery), backup version unchanged', full.get('version') == 2 and len(full.get('threadwood', {}).get('entries', [])) == 1 and full['threadwood']['entries'][0]['photo'].startswith('data:image/jpeg') and len(full['threadwood']['sessions']) == 1 and len(full['threadwood']['favorites']) == 1)
    c.close()
    # restore full backup into a fresh browser
    c, g = new(br, 390, seed=False); boot(g, '?nosw#projects'); g.evaluate("document.documentElement.classList.remove('ff-landing')")
    def restore(g, data):
        g.set_input_files('#restoreFile', files=[{'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()}])
        g.wait_for_function("(()=>{const r=document.getElementById('restorePanel');return r&&!r.hidden&&(document.getElementById('rGo')||/Nothing was changed/.test(r.textContent))})()")
        if g.locator('#rGo').count(): g.click('#rGo'); g.wait_for_timeout(600)
    restore(g, full); tw = json.loads(ls(g, TWK) or '{}')
    ok('full backup restores projects, threads and Threadwood memories on a fresh device', len(json.loads(ls(g, KEY))['projects']) == 2 and len(tw.get('entries', [])) == 1 and len(tw.get('sessions', [])) == 1 and 'Threadwood memories: 3 added' in g.inner_text('#restorePanel'), g.inner_text('#restorePanel')[:300])
    restore(g, full); ok('restoring the same backup again adds no duplicate memories', len(json.loads(ls(g, TWK))['entries']) == 1)
    c.close()
    c, g = new(br, 390, seed=False); boot(g, '?nosw#projects'); g.evaluate("document.documentElement.classList.remove('ff-landing')")
    legacy = {k: v for k, v in full.items() if k != 'threadwood'}
    restore(g, legacy)
    ok('legacy backup without Threadwood still restores; no Threadwood data invented', len(json.loads(ls(g, KEY))['projects']) == 2 and ls(g, TWK) is None and g.locator('#restoreThreadwood').count() == 0)
    open_more(g, 'tabThreadwood'); g.click('#twJourney summary')
    with g.expect_file_chooser() as fc: g.locator('#twJourney button', has_text='Restore Threadwood backup').click()
    fc.value.set_files(files=[{'name': 'tw.json', 'mimeType': 'application/json', 'buffer': twfile.encode()}]); g.wait_for_timeout(500)
    ok('separate Threadwood file restores as a fallback', len(json.loads(ls(g, TWK) or '{"entries":[]}')['entries']) == 1)
    c.close()

    # ---------- 4. Offline: service worker flossfox-v5.0-1 ----------
    c, g = new(br, 390, sw='allow'); boot(g, '')
    g.wait_for_function("navigator.serviceWorker&&navigator.serviceWorker.controller", timeout=20000) if False else g.evaluate("navigator.serviceWorker.ready.then(()=>1)")
    g.wait_for_timeout(1500)
    ck = g.evaluate("caches.keys().then(async ks=>{const k=ks.find(x=>x==='flossfox-v5.0-1');if(!k)return{ks};const c=await caches.open(k),r=await c.keys();return{k,ks,u:r.map(x=>x.url)}})")
    u = ck.get('u', [])
    ok('SW cache flossfox-v5.0-1 holds Smart Stash, Threadwood and the production build config', all(any(x.endswith(f) for x in u) for f in ('smart-stash/ui.js', 'threadwood/ui.js', 'threadwood/style.css', 'smart-stash/vendor/jszip.min.js', 'build-config.js')) and not any('dev-build-config.js' in x for x in u), ck.get('ks'))
    ok('large OCR files are NOT precached', not any('/vendor/ocr/' in x for x in u))
    ok('no older flossfox cache left', all(k=='flossfox-v5.0-1' for k in ck.get('ks', []) if k.startswith('flossfox-')), ck.get('ks'))
    c.set_offline(True); g.reload(); g.wait_for_function('window.FlossFoxThreadwood&&window.FlossFoxSmartStashUI', timeout=20000); g.evaluate("document.documentElement.classList.remove('ff-landing')")
    g.click('#tabThreads'); g.wait_for_timeout(300); g.evaluate("document.getElementById('thMoreAdd').open=true"); ok('offline reload: Smart Stash works', g.locator('#ffSmartStash').is_visible())
    open_more(g, 'tabThreadwood'); ok("offline reload: Pip's Den works", g.locator('#threadwoodView').is_visible())
    c.close()
    # direct link
    c, g = new(br, 1280); boot(g, '?nosw#threadwood'); g.wait_for_timeout(300)
    ok('direct link #threadwood opens the Den', g.locator('#threadwoodView').is_visible())
    c.close()
    br.close()
ok('no page errors', not errs, errs[:3])
ok('nothing requested from any other site (all local)', not offsite, offsite[:5])
print(f"\nsmart_stash_threadwood_e2e (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
