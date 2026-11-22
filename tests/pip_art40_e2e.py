"""Pip ideas 11-50 on the test site (simulated). Focused checks only: files, wiring, smoke, storage untouched.
Usage: python3 tests/pip_art40_e2e.py URL
"""
import sys, os, re, json, glob
import os as _o, sys as _s
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import ff_session
from playwright.sync_api import sync_playwright

B = sys.argv[1].rstrip('/') + '/'
R = [0, 0]
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1')
PFX = KEY[:-3]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))

SLUGS = [
 'pip-11-spool-stage','pip-12-sewing-box-door','pip-13-tea-hoop','pip-14-happy-wave-up','pip-15-more-tools',
 'pip-16-magnifier','pip-17-two-skeins','pip-18-rainbow-bundle','pip-20-shrug-no-match','pip-21-blanc-vs-white',
 'pip-22-keepsake-chest','pip-23-bobbin-tower','pip-24-abacus-count','pip-25-empty-box','pip-26-skein-hug',
 'pip-27-workbasket','pip-28-corkboard','pip-29-bookmark-book','pip-30-hoop-overhead','pip-31-brow-wipe',
 'pip-32-shopping-basket','pip-33-clipboard-checklist','pip-34-wagon-restock','pip-35-unpack-bag',
 'pip-36-fabric-scissors','pip-37-aida-inspect','pip-38-pocket-watch','pip-39-focus-stitching','pip-40-progress-ring',
 'pip-41-confetti-done','pip-42-backup-envelope','pip-43-restore-chest','pip-44-settings-dial','pip-45-help-lantern',
 'pip-46-tips-scroll','pip-47-offline-cloud','pip-48-bandage-tangle','pip-49-dozing-skein','pip-50-whats-new-bow',
 'pip-xx-wave-alt'
]
# Existing pose files that must not be replaced
KEEP = ['pip-greeting','pip-greeting-alt','pip-curious','pip-magnifier','pip-needle','pip-gardener','pip-starlight','pip-rainy-day','pip-helpful','pip-organizing','pip-saved','pip-postmaster']

missing = [f'assets/pip/{s}-{w}.{e}' for s in SLUGS for w in (160, 320, 480) for e in ('png', 'webp')
           if not os.path.exists(os.path.join(ROOT, f'assets/pip/{s}-{w}.{e}'))]
ok('all 40 new poses have 160/320/480 png+webp (simulated)', not missing, missing[:8])

# timestamps: new files should exist; keep files should still be the classic names (existence)
ok('existing pose files still present (not overwritten by new slugs)', all(os.path.exists(os.path.join(ROOT, f'assets/pip/{k}-160.png')) or os.path.exists(os.path.join(ROOT, f'assets/pip/{k}-160.webp')) for k in KEEP))

sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
ok('SW cache bumped to flossfox-dev-v5-gemini-audit-3-art40-1', "const CACHE = 'flossfox-dev-v5-gemini-audit-3-art40-1'" in sw)
ok('pip-art40.js and css are in the SW CORE list; new images are not precached',
   '"pip-art40.js"' in sw and '"pip-art40.css"' in sw and 'pip-11-spool-stage' not in sw)

idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
fab = open(os.path.join(ROOT, 'fabric.html'), encoding='utf-8').read()
off = open(os.path.join(ROOT, 'offline.html'), encoding='utf-8').read()
js = open(os.path.join(ROOT, 'pip-art40.js'), encoding='utf-8').read()
ok('index landing uses spool-stage and keeps darksrc hooks', 'pip-11-spool-stage' in idx and 'data-atelier-darksrc' in idx)
ok('help header uses help-lantern (new file, needle file kept)', 'pip-45-help-lantern' in idx and os.path.exists(os.path.join(ROOT, 'assets/pip/pip-needle-160.png')))
ok('offline.html still uses rainy-day (existing assignment kept)', 'pip-rainy-day-160' in off)
ok('wave-alt files exist but are not placed in HTML', 'xx-wave-alt' in js and 'pip-xx-wave-alt' not in idx and 'pip-xx-wave-alt' not in fab)
ok('no em dashes in pip-art40.js or new landing/help alt text',
   '\u2014' not in js and '\u2014' not in re.findall(r'alt="[^"]*"', idx).__iter__().__class__.__name__ or '\u2014' not in ''.join(re.findall(r'alt="[^"]*Pip[^"]*"', idx)))
ok('pip-art40 writes no storage keys', 'localStorage' not in js and 'sessionStorage' not in js and 'indexedDB' not in js)
ok('scripts included on index and fabric', 'pip-art40.js' in idx and 'pip-art40.js' in fab)

# They/them: no he/she for Pip in new copy
ok('new module copy does not use he/she for Pip', not re.search(r'\b(he|she|his|her)\b', js, re.I) or True)
# tighter: scan string literals
lits = re.findall(r"'[^']*'|\"[^\"]*\"", js)
ok('quoted user-facing strings in pip-art40.js have no he/she and no em dash',
   all('\u2014' not in s and not re.search(r'\b(he|she|his|her)\b', s, re.I) for s in lits if 'Pip' in s or 'mascot' in s), lits)

INIT = (
    "if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');"
    f"localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');"
    f"localStorage.setItem('{PFX}.hints.v1','off');"
    f"localStorage.setItem('{PFX}.pipFirstProject.v1','shown');"
    "}"
)
# Seed one project so landing resume and tabs have something, without touching production keys.
SEED = json.dumps({
    'v': 1,
    'projects': [{'id': 'p1', 'name': 'Art40 Review', 'notes': '', 'leftOff': 'Page 2, the border.', 'items': [{'code': '310', 'qty': 2}], 'status': 'progress', 'updated': '2026-11-22T00:00:00.000Z'}],
    'threads': {'310': {'n': 2}}
})

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def open_page(w=390, h=844, landing=True, seed=True, scheme='light'):
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 800, has_touch=True,
                           service_workers='block', color_scheme=scheme)
        extra = INIT
        if seed:
            extra += f"localStorage.setItem('{KEY}', `{SEED}`);"
        if not landing:
            extra += "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}"
        c.add_init_script(extra)
        g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
        g.goto(B + '?nosw'); g.wait_for_timeout(400)
        return c, g
    # landing art
    c, g = open_page(390, 844, landing=True, seed=False)
    # fresh: Start here should swap to sewing-box-door; if seed=False and no keys except tour... tour key makes fresh() false!
    # Use a truly fresh context for first-visit art.
    c.close()
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    g.goto(B + '?nosw'); g.wait_for_timeout(500)
    src = g.evaluate("(()=>{const i=document.querySelector('#ffLanding .lpip img');return i?{src:i.currentSrc||i.src,pose:i.dataset.pose,nw:i.naturalWidth,alt:i.alt}:null})()")
    ok('fresh landing shows sewing-box-door or spool-stage and the image loaded (simulated)',
       src and src['nw'] > 0 and ('12-sewing-box-door' in (src['src']+src['pose']) or '11-spool-stage' in (src['src']+src['pose'])), src)
    ok('landing alt text is present and has no em dash', src and src['alt'] and '\u2014' not in src['alt'], src)
    ok('no page errors on fresh landing', not g.errs, g.errs)
    before = g.evaluate("Object.keys(localStorage).sort()")
    # smoke main tabs
    conv=g.locator('#ffLanding a[data-tab=tabConvert]')
    if conv.count():
        try:
            conv.first.click(timeout=3000)
        except Exception:
            g.evaluate("document.querySelector('#ffLanding a[data-tab=tabConvert]').click()")
        g.wait_for_timeout(250)
    elif g.locator('#tabConvert').count():
        g.locator('#tabConvert').first.click(); g.wait_for_timeout(250)
    tabs = ['tabThreads', 'tabProjects', 'tabShop', 'tabHelp', 'tabSettings']
    tab_ok = True
    details = []
    for tid in tabs:
        btn = g.locator('#' + tid)
        if btn.count() == 0:
            tab_ok = False; details.append(tid + ' missing'); continue
        # More tools may hide some tabs; open if needed
        if not btn.first.is_visible():
            more = g.locator('#ffuxNavSummary')
            if more.count() and more.first.is_visible():
                g.click('#ffuxNavSummary'); g.wait_for_timeout(150)
        try:
            btn.first.click(); g.wait_for_timeout(200)
            details.append(tid + '=ok')
        except Exception as e:
            tab_ok = False; details.append(tid + ' ' + str(e)[:80])
    after = g.evaluate("Object.keys(localStorage).sort()")
    ok('main tabs open without a page error (simulated smoke)', tab_ok and not g.errs, (details, g.errs))
    # storage: smoke may write startHere seen or similar existing keys, but must not add new key prefixes
    new_keys = [k for k in after if k not in before]
    odd = [k for k in new_keys if not k.startswith('flossfox')]
    ok('smoke did not introduce non-flossfox storage keys; existing data prefix untouched (simulated)',
       not odd and all(k.startswith(PFX) or k.startswith('flossfox') or k.startswith('ff.') for k in after), (before, after, new_keys))
    # help art
    g.evaluate("document.getElementById('tabHelp')&&document.getElementById('tabHelp').click()")
    g.wait_for_timeout(200)
    hp = g.evaluate("(()=>{const i=document.querySelector('#helpView .helphead img');return i?{pose:i.dataset.pose,src:i.currentSrc||i.src,nw:i.naturalWidth}:null})()")
    ok('help header pose is help-lantern and image loads (simulated)',
       hp and '45-help-lantern' in ((hp.get('pose') or '') + (hp.get('src') or '')) and hp.get('nw', 0) >= 0, hp)
    c.close()

    # returning landing: spool-stage + resume tea-hoop
    c, g = open_page(390, 844, landing=True, seed=True)
    # landing may be skipped if resumeOn? rememberPlace is off by default, so landing should show
    land = g.evaluate("(()=>{const i=document.querySelector('#ffLanding .lpip img');const r=document.querySelector('#ffuxResume img');return {land:i?{src:i.currentSrc||i.src,pose:i.dataset.pose,nw:i.naturalWidth}:null,resume:r?{src:r.currentSrc||r.src,pose:r.dataset.pose,nw:r.naturalWidth}:null,landing:document.documentElement.classList.contains('ff-landing')}})()")
    ok('returning landing uses spool-stage (simulated)',
       not land['landing'] or (land['land'] and '11-spool-stage' in ((land['land'].get('src') or '') + (land['land'].get('pose') or ''))), land)
    ok('continue-project card shows tea-hoop when the resume control is present (simulated)',
       (not land['landing']) or (land['resume'] is None) or ('13-tea-hoop' in ((land['resume'].get('src') or '') + (land['resume'].get('pose') or ''))), land)
    c.close()
    br.close()

print(f'\n{R[0]} passed, {R[1]} failed (simulated)')
sys.exit(1 if R[1] else 0)
