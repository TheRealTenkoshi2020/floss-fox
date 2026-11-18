#!/usr/bin/env python3
"""3.9 Atelier Stage G: FF39-08 explicit Add to My threads / Add to project on the comparison screen.
Viewing the surface never writes inventory. Adds are intentional, verified, undoable, and keep
DMC BLANC, WHITE and B5200 distinct. SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_compare_actions_e2e.py http://localhost:PORT/
"""
import sys, os, json
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:500]))

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321'], leftOff='Finished page 2'),
    proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z')]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 2, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}

def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET}
    if extra: s.update(extra)
    return s

def ctx(br, seed, w=1280, h=900, touch=False):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block')
    if touch:
        kw['has_touch'] = True; kw['is_mobile'] = True
    c = br.new_context(**kw)
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}"
        % json.dumps(seed))
    g = c.new_page(); g.set_default_timeout(12000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelierStudio&&window.FlossFoxProjects&&window.FlossFoxThreadsUI')
    g.wait_for_timeout(200)

def dump_inv(g):
    return g.evaluate(f"()=>JSON.stringify([localStorage.getItem({KEY!r}), localStorage.getItem({TK!r})])")

def open_studio(g, colors='797, BLANC, WHITE, B5200'):
    g.click('#tabConvert'); g.wait_for_timeout(200)
    g.fill('#inp', colors)
    g.click('#go')
    g.wait_for_selector('#ffStudio .ffa-cmp')
    g.wait_for_timeout(200)

def threads(g):
    return g.evaluate(f"()=>JSON.parse(localStorage.getItem({TK!r}))")

def projects(g):
    return g.evaluate(f"()=>JSON.parse(localStorage.getItem({KEY!r}))")

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- viewing / clicking the surface does not write ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    before = dump_inv(g)
    open_studio(g)
    g.select_option('#dest', 'sullivans'); g.wait_for_timeout(200)
    if g.locator('#ffStudio .ffa-cmp').count():
        g.locator('#ffStudio .ffa-cmp').first.click()
        g.wait_for_timeout(100)
    after = dump_inv(g)
    ok('read-only comparison leaves projects and threads byte-identical', after == before)
    ok('Add to My threads and Add to project are present', g.locator('#ffStudio [data-add-threads]').count() >= 4 and g.locator('#ffStudio [data-add-project]').count() >= 4)
    ok('no page errors on the read-only pass', g.errs == [], g.errs)
    c.close()

    # ---- add to threads, undo, failed write rolls back ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    open_studio(g)
    before = dump_inv(g)
    before_n = (threads(g).get('threads') or {}).get('797')
    g.locator('#ffStudio .ffa-cmp[data-code="797"] [data-add-threads]').click()
    g.wait_for_selector('#ffaAddDlg #ffaAddQty')
    ok('threads dialog uses Pixel heading and qty label',
       'Add DMC 797 to My threads' in (g.inner_text('#ffaAddDlg') or '') and g.locator('#ffaAddQty').input_value() == '1')
    g.click('#ffaAddGo')
    g.wait_for_function("() => !document.getElementById('ffaAddDlg') || !document.getElementById('ffaAddDlg').open")
    msg = g.locator('#ffStudio .ffa-cmp[data-code="797"] [data-add-msg]').inner_text()
    ok('aria-live confirms a verified threads add',
       'Added 1 full skein of DMC 797 to My threads' in msg and g.locator('#ffStudio .ffa-cmp[data-code="797"] [data-add-msg]').get_attribute('aria-live') == 'polite', msg)
    th = threads(g)
    ok('797 was written to My threads as a new DMC color',
       th and th.get('threads', {}).get('797', {}).get('n') == 1, th.get('threads', {}).get('797') if th else None)
    ok('existing BLANC and WHITE counts are unchanged after adding 797',
       th['threads']['BLANC']['n'] == 1 and th['threads']['WHITE']['n'] == 1 and 'B5200' not in th['threads'])
    g.locator('#ffStudio .ffa-cmp[data-code="797"] [data-add-undo]').click()
    g.wait_for_timeout(200)
    th2 = threads(g)
    ok('undo removes the added 797 and leaves other colors',
       '797' not in th2.get('threads', {}) and th2['threads']['BLANC']['n'] == 1 and th2['threads']['WHITE']['n'] == 1, th2.get('threads', {}).keys())
    # failed save: localStorage rejects the threads key, in-memory change must roll back
    before = dump_inv(g)
    failed = g.evaluate(f"""() => {{
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {{
        if (k === {TK!r}) {{ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }}
        return orig.call(this, k, v);
      }};
      let r;
      try {{ r = FlossFoxAtelierStudio.addToThreads('797', 1); }}
      finally {{ Storage.prototype.setItem = orig; }}
      return r;
    }}""")
    ok('failed threads write reports not-saved', failed and failed.get('ok') is False, failed)
    ok('failed threads write leaves storage byte-identical', dump_inv(g) == before)
    c.close()

    # ---- add to project, duplicate, undo, BLANC/WHITE/B5200 stay distinct ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    open_studio(g, '797, BLANC, WHITE, B5200')
    g.locator('#ffStudio .ffa-cmp[data-code="797"] [data-add-project]').click()
    g.wait_for_selector('#ffaAddDlg #ffaAddProj')
    ok('project dialog lists projects and keeps BLANC out of the heading confusion',
       g.locator('#ffaAddProj option').count() >= 2 and 'Add DMC 797 to a project' in (g.inner_text('#ffaAddDlg') or ''))
    g.select_option('#ffaAddProj', 'p1')
    g.click('#ffaAddGo')
    g.wait_for_function("() => !document.getElementById('ffaAddDlg') || !document.getElementById('ffaAddDlg').open")
    msg = g.locator('#ffStudio .ffa-cmp[data-code="797"] [data-add-msg]').inner_text()
    ok('aria-live confirms a verified project add', 'Added DMC 797 to Sample Autumn Wreath' in msg, msg)
    p1 = next(x for x in projects(g)['projects'] if x['id'] == 'p1')
    ok('797 is on the project once and whites are still separate',
       sum(1 for i in p1['items'] if i['code'] == '797') == 1
       and any(i['code'] == 'BLANC' for i in p1['items'])
       and any(i['code'] == 'WHITE' for i in p1['items'])
       and not any(i['code'] == 'B5200' for i in p1['items']),
       [i['code'] for i in p1['items']])
    # duplicate of a color already on the project
    before = dump_inv(g)
    g.locator('#ffStudio .ffa-cmp[data-code="BLANC"] [data-add-project]').click()
    g.wait_for_selector('#ffaAddDlg #ffaAddProj')
    g.select_option('#ffaAddProj', 'p1')
    g.click('#ffaAddGo')
    g.wait_for_function("() => !document.getElementById('ffaAddDlg') || !document.getElementById('ffaAddDlg').open")
    dmsg = g.locator('#ffStudio .ffa-cmp[data-code="BLANC"] [data-add-msg]').inner_text()
    ok('duplicate add to project leaves storage unchanged and says so',
       dump_inv(g) == before and 'already in Sample Autumn Wreath' in dmsg and 'Nothing changed' in dmsg, dmsg)
    p1b = next(x for x in projects(g)['projects'] if x['id'] == 'p1')
    ok('duplicate did not alias BLANC to WHITE or add a second BLANC row',
       sum(1 for i in p1b['items'] if i['code'] == 'BLANC') == 1
       and sum(1 for i in p1b['items'] if i['code'] == 'WHITE') == 1, [i['code'] for i in p1b['items']])
    # add B5200 (distinct white) to the same project
    g.locator('#ffStudio .ffa-cmp[data-code="B5200"] [data-add-project]').click()
    g.wait_for_selector('#ffaAddDlg #ffaAddProj')
    g.select_option('#ffaAddProj', 'p1')
    g.click('#ffaAddGo')
    g.wait_for_function("() => !document.getElementById('ffaAddDlg') || !document.getElementById('ffaAddDlg').open")
    p1c = next(x for x in projects(g)['projects'] if x['id'] == 'p1')
    codes = [i['code'] for i in p1c['items']]
    ok('B5200 is added as its own color beside BLANC and WHITE',
       codes.count('B5200') == 1 and codes.count('BLANC') == 1 and codes.count('WHITE') == 1, codes)
    g.locator('#ffStudio .ffa-cmp[data-code="B5200"] [data-add-undo]').click()
    g.wait_for_timeout(200)
    p1d = next(x for x in projects(g)['projects'] if x['id'] == 'p1')
    ok('undo removes B5200 and leaves BLANC and WHITE in place',
       not any(i['code'] == 'B5200' for i in p1d['items'])
       and any(i['code'] == 'BLANC' for i in p1d['items'])
       and any(i['code'] == 'WHITE' for i in p1d['items']),
       [i['code'] for i in p1d['items']])
    # failed project write rolls back
    before = dump_inv(g)
    failed = g.evaluate(f"""() => {{
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v) {{
        if (k === {KEY!r}) {{ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }}
        return orig.call(this, k, v);
      }};
      let r;
      try {{ r = FlossFoxProjects.addColor('p1', 'B5200', 1); }}
      finally {{ Storage.prototype.setItem = orig; }}
      return r;
    }}""")
    ok('failed project write reports not-saved', failed and failed.get('ok') is False, failed)
    ok('failed project write leaves storage byte-identical', dump_inv(g) == before)
    ok('in-memory project list also lacks the failed B5200 add',
       g.evaluate("() => !(FlossFoxProjects._store().projects.find(p=>p.id==='p1').items.some(i=>i.code==='B5200'))"))
    ok('no page errors in the project add pass', g.errs == [], g.errs)
    c.close()

    # ---- phone width: buttons usable, shot of the comparison actions ----
    c, g = ctx(br, seed_all(), w=390, h=844, touch=True)
    g.goto(B + '?nosw'); ready(g)
    open_studio(g, '797, BLANC, WHITE')
    card = g.locator('#ffStudio .ffa-cmp[data-code="797"]')
    ok('comparison actions are visible at 390', card.locator('[data-add-threads]').is_visible() and card.locator('[data-add-project]').is_visible())
    box = card.locator('[data-add-threads]').bounding_box()
    ok('Add to My threads meets a 44px touch target at 390', box and box['height'] >= 44 and box['width'] >= 44, box)
    card.scroll_into_view_if_needed()
    g.screenshot(path=os.path.join(SHOTS, 'stageG-compare-390.png'), full_page=False)
    ok('no page errors at 390', g.errs == [], g.errs)
    c.close()

print(f"\natelier_compare_actions_e2e (simulated): {R[0]} passed, {R[1]} failed")
sys.exit(1 if R[1] else 0)
