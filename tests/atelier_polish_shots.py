#!/usr/bin/env python3
"""Stage D theme polish screenshots for Pixel. SIMULATED. Not a pass/fail suite of record;
prints a short log and writes logs/shots/stageD-polish-*.png.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_polish_shots.py http://localhost:PORT/
"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c, 3 if c=='310' else 1) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321', '3865', '797', '725', '433'], leftOff='Finished page 2'),
    proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z')]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 2, 'partial': True, 'restock': True, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z', 'storage': {'container': 'Box 2', 'slot': 'Row B'}},
    'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}

def seed(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET}
    if extra: s.update(extra)
    return s

def ctx(br, seed, w=1280, h=900, color_scheme='light', touch=False):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block', color_scheme=color_scheme)
    if touch: kw.update(has_touch=True, is_mobile=True)
    c = br.new_context(**kw)
    c.add_init_script("if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k]);try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}}" % json.dumps(seed))
    g = c.new_page(); g.set_default_timeout(8000)
    if touch:
        try:
            ses=c.new_cdp_session(g)
            ses.send('Emulation.setEmulatedMedia', {'features':[{'name':'hover','value':'none'},{'name':'pointer','value':'coarse'}]})
        except Exception:
            pass
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxThreadsUI')
    g.wait_for_timeout(200)

def shot(g, name):
    path = os.path.join(SHOTS, 'stageD-polish-' + name + '.png')
    g.screenshot(path=path, full_page=True)
    print('WROTE', path)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    moon = {AK: json.dumps({'v': 1, 'theme': 'moon'})}

    # Shelf 1280 (Moonlit, after polish)
    c, g = ctx(br, seed(moon), 1280, 900, color_scheme='dark')
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabThreads'); g.wait_for_timeout(250)
    if g.locator('#ffLibV-shelf').count():
        g.click('#ffLibV-shelf'); g.wait_for_timeout(200)
    shot(g, 'shelf-1280')
    c.close()

    # Store mode BLANC (Moonlit 1280 and 390): BLANC is still to find so its big swatch is on the list
    thr_no_blanc = {'schema': 2, 'threads': {k: v for k, v in THR['threads'].items() if k not in ('BLANC', 'WHITE')}}
    for w, touch, tag in ((1280, False, '1280'), (390, True, '390')):
        c, g = ctx(br, seed({**moon, TK: json.dumps(thr_no_blanc)}), w, 900 if w==1280 else 860, color_scheme='dark', touch=touch)
        g.goto(B + '?nosw'); ready(g)
        g.evaluate("FlossFoxProjects.open('p1')"); g.wait_for_timeout(250)
        g.click('#tabShop'); g.wait_for_timeout(250)
        if g.locator('#pStoreBtn').count() and g.get_attribute('#pStoreBtn','aria-pressed')!='true':
            g.click('#pStoreBtn'); g.wait_for_timeout(250)
        if g.locator('#smLeft .ffsm-row:has-text("DMC BLANC")').count():
            g.locator('#smLeft .ffsm-row:has-text("DMC BLANC")').first.scroll_into_view_if_needed()
            g.wait_for_timeout(150)
        shot(g, 'store-blanc-' + tag)
        c.close()

    # Undo size: confirmed check-in shows #pMsgUndo at 44px (viewport shot, button in frame)
    for w, touch, tag in ((1280, False, '1280'), (390, True, '390')):
        c, g = ctx(br, seed(moon), w, 900 if w==1280 else 860, color_scheme='dark', touch=touch)
        g.goto(B + '?nosw'); ready(g)
        g.evaluate("FlossFoxProjects.open('p1')"); g.wait_for_timeout(200)
        g.click('#tabShop'); g.wait_for_timeout(200)
        # leave Store mode if we landed in it; check-in lives on the regular shopping list
        if g.locator('#pStoreBtn').count() and g.get_attribute('#pStoreBtn','aria-pressed')=='true':
            g.click('#pStoreBtn'); g.wait_for_timeout(150)
        if g.locator('#pb-dmc\\:310').count():
            g.check('#pb-dmc\\:310'); g.wait_for_timeout(200)
        elif g.locator('#smLeft li:has-text("DMC 310") [data-smb]').count():
            g.click('#smLeft li:has-text("DMC 310") [data-smb]'); g.wait_for_timeout(200)
        if g.locator('#pAwBox').count():
            g.evaluate("document.getElementById('pAwBox').open=true")
        if g.locator('#rq-dmc_310').count():
            if g.locator('#rb-dmc_310').count():
                g.click('#rb-dmc_310')
            g.fill('#rq-dmc_310', '1'); g.click('#rc-dmc_310'); g.wait_for_timeout(300)
        elif g.locator('#smRecv').count() and g.locator('#smRecv').is_visible():
            g.click('#smRecv'); g.wait_for_timeout(200)
            if g.locator('#rq-dmc_310').count():
                g.fill('#rq-dmc_310', '1'); g.click('#rc-dmc_310'); g.wait_for_timeout(300)
        if g.locator('#pMsgUndo').count():
            g.locator('#pMsgUndo').scroll_into_view_if_needed()
            g.wait_for_timeout(150)
        path = os.path.join(SHOTS, 'stageD-polish-undo-' + tag + '.png')
        g.screenshot(path=path, full_page=False)
        print('WROTE', path)
        c.close()

    # N4: search keyboard hint at 390 touch
    c, g = ctx(br, seed(moon), 390, 860, color_scheme='dark', touch=True)
    g.goto(B + '?nosw'); ready(g)
    if g.locator('#ffSearchBtn').count():
        g.click('#ffSearchBtn'); g.wait_for_timeout(250)
        if g.locator('#ffSearchIn').count():
            g.fill('#ffSearchIn', 'BLANC'); g.wait_for_timeout(300)
    shot(g, 'n4-search-390')
    c.close()

    # Moonlit re-shots after polish: workbasket, threads, shop, settings at 1280 and 390
    for w, touch in ((1280, False), (390, True)):
        c, g = ctx(br, seed(moon), w, 900 if w==1280 else 860, color_scheme='dark', touch=touch)
        g.goto(B + '?nosw'); ready(g)
        for view, tab in (('workbasket','#tabWorkbasket'),('threads','#tabThreads'),('shop','#tabShop'),('settings','#tabSettings')):
            g.click(tab); g.wait_for_timeout(250)
            if view=='settings' and g.locator('#ffAtelierPrefs').count():
                g.locator('#ffAtelierPrefs').scroll_into_view_if_needed()
            shot(g, f'moon-{view}-{w}')
        c.close()

    # Compare and gallery in Morning Linen, Forest Twilight and Moonlit Threads
    for theme, os_scheme in (('morning', 'light'), ('forest', 'light'), ('moon', 'dark')):
        extra = {AK: json.dumps({'v': 1, 'theme': theme, 'projectsView': 'gallery'})}
        for w, touch in ((1280, False), (390, True)):
            c, g = ctx(br, seed(extra), w, 900 if w==1280 else 860, color_scheme=os_scheme, touch=touch)
            g.goto(B + '?nosw'); ready(g)
            g.click('#tabProjects'); g.wait_for_timeout(250)
            if g.locator('#ffaViewBar [data-view=gallery]').count():
                g.click('#ffaViewBar [data-view=gallery]'); g.wait_for_timeout(250)
            shot(g, f'{theme}-gallery-{w}')
            g.click('#tabConvert'); g.wait_for_timeout(200)
            g.fill('#inp', '321, BLANC, WHITE, B5200, 310'); g.click('#go'); g.wait_for_timeout(400)
            if g.locator('#dest').count():
                g.select_option('#dest', 'sullivans'); g.wait_for_timeout(200)
            if g.locator('#ffStudio').count():
                g.locator('#ffStudio').scroll_into_view_if_needed()
            shot(g, f'{theme}-compare-{w}')
            c.close()

    br.close()
print('polish shots done')
