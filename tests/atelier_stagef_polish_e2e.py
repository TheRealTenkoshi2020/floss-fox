#!/usr/bin/env python3
"""3.9 Atelier Stage F polish (Pixel REVIEW-39-stageF.md, no blockers).
pattern-reader pose, unclamped Pip lines, focus swatches and scroll/focus,
fabric .num bar, singular hoop-ready verb.
SIMULATED: headless Chrome with synthetic data, not real phones.
Phone shots use full_page=False so mobile emulation holds.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_stagef_polish_e2e.py http://localhost:PORT/
"""
import sys, os, json, re
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]
TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'; LVK = PFX + '.pipLevel.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': 40}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321'], leftOff='Finished page 2 of the chart and parked the needle on the wreath bow'),
    proj('p3', 'Single Color Motif', ['310'])]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 8, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z', 'storage': {'container':'Top drawer','slot':'A1','medium':''}},
    'WHITE': {'n': 8, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 8, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 8, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off', PFX + '.pipFirstProject.v1': 'shown'}

def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET, LVK: 'important'}
    if extra: s.update(extra)
    return s

def ctx(br, seed, w=1280, h=900, landing_seen=True, touch=False):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block')
    if touch:
        kw['has_touch'] = True; kw['is_mobile'] = True
    c = br.new_context(**kw)
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}%s"
        % (json.dumps(seed), "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" if landing_seen else ''))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxPip')
    g.wait_for_timeout(200)

def clear_bubbles(g):
    g.evaluate("() => { if (window.FlossFoxPip && FlossFoxPip.closeBubble) FlossFoxPip.closeBubble(); if (window.FlossFoxPip && FlossFoxPip._capsReset) FlossFoxPip._capsReset(); }")
    g.wait_for_timeout(80)

def bubble_info(g):
    return g.evaluate("""() => {
      const b = document.querySelector('.pipA-bubble');
      if (!b) return {pose:'', src:'', text:'', act:'', clamp:0};
      const img = b.querySelector('img');
      const tx = b.querySelector('.pipA-text');
      const act = b.querySelector('.pipA-act');
      const src = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
      const clamp = tx ? Math.max(0, tx.scrollHeight - tx.clientHeight) : 0;
      return {pose: b.dataset.pose||'', src, text: tx ? (tx.textContent||'') : '', act: act ? act.className : '', clamp};
    }""")

def parse_rgb(s):
    if not s: return None
    m = re.search(r'rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)', s)
    if not m: return None
    r, g, b = [float(m.group(i)) for i in (1, 2, 3)]
    a = float(m.group(4)) if m.group(4) is not None else 1.0
    return (r, g, b, a)

def styles(g, sel):
    return g.evaluate("""sel => { const el=document.querySelector(sel); if(!el) return null; const cs=getComputedStyle(el); return {bg:cs.backgroundColor, color:cs.color}; }""", sel)

def is_transparent(bg):
    if not bg: return True
    if 'transparent' in bg or bg in ('rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)'): return True
    rgb = parse_rgb(bg)
    return bool(rgb and rgb[3] == 0)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- 1. Import shows pattern-reader art (not the greeting pose) ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    clear_bubbles(g)
    shown = g.evaluate("""() => {
      const a = document.getElementById('pip') || document.body;
      return FlossFoxPip.react('pip.import', {n: 4}, a, {siteAnnounces: false, action: {label: 'Review colors', go: function(){}}});
    }""")
    g.wait_for_timeout(250)
    info = bubble_info(g)
    ok('import: react shows a bubble', shown and info['pose'], info)
    ok('import: data-pose is pattern-reader', info['pose']=='pattern-reader', info)
    ok('import: the image is pattern-reader art, not greeting', 'pattern-reader' in (info['src'] or '') and 'pip-greeting-' not in (info['src'] or ''), info)
    ok('import: action button uses pipA-act sec', 'pipA-act' in info['act'] and 'sec' in info['act'].split(), info)
    g.screenshot(path=os.path.join(SHOTS, 'stageF-polish-import-pose-1280.png'), full_page=False)
    c.close()

    # ---- 2. Unclamped Pip line + sec action, from a real return ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(150)
    clear_bubbles(g)
    g.evaluate("() => { FlossFoxPip._capsReset(); FlossFoxProjects.openProject('p1') }")
    g.wait_for_timeout(400)
    info = bubble_info(g)
    ok('return: quotes the leftOff note in full', 'Welcome back' in info['text'] and 'Finished page 2' in info['text'], info)
    ok('return: CSS does not clamp mid-sentence', info['clamp']<=1, info)
    ok('return: action uses pipA-act sec', 'pipA-act' in info['act'] and 'sec' in info['act'].split(), info)
    g.screenshot(path=os.path.join(SHOTS, 'stageF-polish-unclamped-return-1280.png'), full_page=False)
    c.close()

    # ---- 3+4. Focus swatches, scroll into view, heading focus, exit focuses start ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(150)
    clear_bubbles(g)
    g.evaluate("() => FlossFoxProjects.openProject('p1')")
    g.wait_for_selector('#ffaSessionStart')
    g.click('#ffaSessionStart')
    g.wait_for_function("() => document.getElementById('ffaFocus') && document.getElementById('projEdit').classList.contains('ffa-focus-on')")
    g.wait_for_timeout(150)
    fbox = g.locator('#ffaFocus').bounding_box()
    ok('focus: #ffaFocus is scrolled into view', fbox and fbox['y']>=-1, fbox)
    ok('focus: heading is focused and tabindex is -1', g.evaluate("() => document.activeElement && document.activeElement.id")=='ffaFocusTitle' and g.get_attribute('#ffaFocusTitle','tabindex')=='-1')
    sw = g.evaluate("""() => [...document.querySelectorAll('#ffaFocus .ffa-colors .ffa-floss')].map(el => {
      const cs = getComputedStyle(el);
      return {c: cs.getPropertyValue('--c').trim(), bg: cs.backgroundColor, edge: el.classList.contains('edge'), label: (el.nextElementSibling && el.nextElementSibling.textContent) || ''};
    })""")
    ok('focus: every swatch sets --c from the catalog, not #9a9a9a', sw and len(sw)>=4 and all(x['c'] and x['c']!='#9a9a9a' for x in sw), sw)
    blacks = [x for x in sw if '310' in x['label']]
    whites = [x for x in sw if 'BLANC' in x['label'] or 'WHITE' in x['label']]
    ok('focus: DMC 310 is not the grey fallback', blacks and blacks[0]['c'].lower() not in ('#9a9a9a','#ccc','#cccccc'), blacks)
    ok('focus: BLANC and WHITE keep a swatch edge', whites and all(x['edge'] for x in whites), whites)
    g.screenshot(path=os.path.join(SHOTS, 'stageF-polish-focus-swatches-1280.png'), full_page=False)
    g.click('#ffaSessionExit'); g.wait_for_timeout(200)
    ok('focus: exit focuses #ffaSessionStart', g.evaluate("() => document.activeElement && document.activeElement.id")=='ffaSessionStart')
    ok('focus: no page errors', not g.errs, g.errs)
    c.close()

    # 390: same focus movement, full_page=False
    c, g = ctx(br, seed_all(), w=390, h=844, touch=True)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(150)
    clear_bubbles(g)
    g.evaluate("() => FlossFoxProjects.openProject('p1')")
    g.wait_for_selector('#ffaSessionStart')
    g.click('#ffaSessionStart')
    g.wait_for_function("() => document.getElementById('ffaFocus') && document.getElementById('projEdit').classList.contains('ffa-focus-on')")
    g.wait_for_timeout(200)
    fbox = g.locator('#ffaFocus').bounding_box()
    ok('390 focus: panel is scrolled into view', fbox and fbox['y']>=-1, fbox)
    ok('390 focus: heading is focused', g.evaluate("() => document.activeElement && document.activeElement.id")=='ffaFocusTitle')
    g.screenshot(path=os.path.join(SHOTS, 'stageF-polish-focus-390.png'), full_page=False)
    g.click('#ffaSessionExit'); g.wait_for_timeout(200)
    ok('390 focus: exit focuses Start a stitch session', g.evaluate("() => document.activeElement && document.activeElement.id")=='ffaSessionStart')
    c.close()

    # ---- 5. Fabric result numbers have no theme-colored bar, screen and print ----
    for theme, label in (('moon','Moonlit'),('forest','Forest')):
        c, g = ctx(br, seed_all({AK: json.dumps({'v':1,'theme':theme})}))
        g.goto(B + 'fabric.html?nosw')
        g.wait_for_function('window.FlossFoxFabric&&window.FlossFoxFabricUI')
        g.wait_for_timeout(200)
        num = styles(g, '#fcCutNum')
        ok(f'screen {label}: .fcres .num has no theme-colored bar', num and is_transparent(num['bg']), num)
        g.emulate_media(media='print')
        g.wait_for_timeout(80)
        num = styles(g, '#fcCutNum')
        ok(f'print {label}: .fcres .num has no theme-colored bar', num and is_transparent(num['bg']), num)
        g.screenshot(path=os.path.join(SHOTS, f'stageF-polish-print-num-{theme}-1280.png'), full_page=False)
        g.emulate_media(media='screen')
        c.close()

    # ---- 6. Singular verb when the total is 1 ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(150)
    clear_bubbles(g)
    g.evaluate("() => FlossFoxProjects.openProject('p3')")
    g.wait_for_timeout(250)
    body = g.inner_text('#pSum') if g.locator('#pSum').count() else g.inner_text('#projEdit')
    ok('singular: 1 of 1 uses has / has been', 'has enough or has been checked in' in body and 'have enough or have been checked in' not in body, body[:400])
    g.screenshot(path=os.path.join(SHOTS, 'stageF-polish-singular-1280.png'), full_page=False)
    ok('singular: no page errors', not g.errs, g.errs)
    c.close()

    br.close()

print(f"\natelier_stagef_polish_e2e (simulated): {R[0]} passed, {R[1]} failed")
sys.exit(1 if R[1] else 0)
