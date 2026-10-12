#!/usr/bin/env python3
"""Floss Fox 1.7 Stages C-E: My Thread Collection, project status + comparison, nav, Pip tips.
Usage: python tests/collection_e2e.py [BASE_URL] [--shots DIR]   (preview: set FF_KEY / FF_PIP_KEY like regression.py)"""
import sys, os, argparse, json
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'; TIPK = PFX + '.tips.v1'; PIPK = os.environ.get('FF_PIP_KEY', PFX + '.pip.v1')
QUIET = "try{localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}')}catch(e){}" % PFX
R = {'pass': 0, 'fail': 0}; errs = []; DLG = {'m': 'accept'}
def dlg(m): DLG['m'] = m
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {info}'))
DEMO = ['310','321','666','815','817','3865','B5200','413','414','415','762','318','317','498','304','3799','535','3371','ECRU']
LEGACY = {'schema': 2, 'projects': [{'id': 'legacy-1', 'name': 'Old project', 'notes': 'from 1.6', 'buyBrand': 'dmc',
  'items': [{'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['310 x2']}, {'code': '321', 'qty': 1, 'stated': False, 'assumed': 1, 'src': ['321']}],
  'decisions': {'310': {'status': 'have', 'owned': 2, 'anchor': None, 'recv': None}, '321': {'status': 'buy', 'owned': None, 'anchor': None, 'recv': None}},
  'purchased': {}, 'created': '2026-10-01T10:00:00.000Z', 'updated': '2026-10-01T10:00:00.000Z'}]}
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    def page(w=390, init=None, quiet=True):
        mob = w < 600
        ctx = br.new_context(viewport={'width': w, 'height': 800 if mob else 900}, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        if quiet: ctx.add_init_script(QUIET)
        if init: ctx.add_init_script(init)
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept() if DLG['m'] == 'accept' else d.dismiss()); g.goto(B); g.wait_for_load_state('networkidle'); return g
    def add(g, t): g.fill('#thAdd', t); g.click('#thAddBtn'); g.wait_for_timeout(60)
    def n(g, c): return int(g.input_value(f'#tn-{c}'))
    ls = lambda g, k: g.evaluate(f"localStorage.getItem('{k}')")

    # ---- C: collection basics, persistence, quantities, duplicates, search ----
    g = page(390); g.click('#tabThreads')
    ok('C0 storage note is shown in plain words', 'only in this browser' in g.inner_text('#thCard') and 'deletes it' in g.inner_text('#thCard'))
    add(g, '310, 321 x2\n310\n03')
    ok('C1 add several at once; duplicate lines merge (310 twice = 2)', n(g, '310') == 2 and n(g, '321') == 2 and n(g, '03') == 1 and g.locator('#thList .th').count() == 3)
    add(g, '310 x3'); ok('C2 adding an owned color again merges into one row', g.locator('#thList .th[data-code="310"]').count() == 1 and n(g, '310') == 5)
    g.click('#tp-321'); g.click('#tp-321'); g.click('#tm-310')
    ok('C3 + and − change full skeins inline', n(g, '321') == 4 and n(g, '310') == 4)
    for _ in range(3): g.click('#tm-03') if g.locator('#tm-03').is_enabled() else None
    ok('C4 − stops at 0, row stays as Out of stock', n(g, '03') == 0 and 'Out of stock' in g.inner_text('#thList .th[data-code="03"]') and g.locator('#tm-03').is_disabled())
    g.check('#tpa-03'); ok('C5 partial skein state', 'Partial skein only' in g.inner_text('#thList .th[data-code="03"]'))
    g.check('#tr-310'); ok('C6 restock flag shown in row and summary', 'restock' in g.inner_text('#thList .th[data-code="310"]') and '1 to restock' in g.inner_text('#thSum'))
    g.fill('#thSearch', '321'); ok('C7 search by DMC number', [x for x in g.locator('#thList .th').all() if x.is_visible()].__len__() == 1)
    g.fill('#thSearch', 'DMC 03'); ok('C7b search "DMC 03" finds 03 (not 30x)', [x.get_attribute('data-code') for x in g.locator('#thList .th').all() if x.is_visible()] == ['03'])
    g.fill('#thSearch', 'zzz'); ok('C7c no match message', g.locator('#thNoRes').is_visible()); g.fill('#thSearch', '')
    g.click('#thFilt [data-show="restock"]'); ok('C8 Restock filter', [x.get_attribute('data-code') for x in g.locator('#thList .th').all() if x.is_visible()] == ['310']); g.click('#thFilt [data-show="all"]')
    before = json.loads(ls(g, TKEY)); g.reload(); g.wait_for_load_state('networkidle'); g.click('#tabThreads')
    ok('C9 everything survives a refresh', n(g, '310') == 4 and n(g, '321') == 4 and g.is_checked('#tpa-03') and g.is_checked('#tr-310') and json.loads(ls(g, TKEY)) == before)
    ok('C10 stored in its own key; projects key untouched', ls(g, KEY) in (None, '{"schema":2,"projects":[]}') and set(before['threads']) == {'310', '321', '03'}, ls(g, KEY))
    # double submit
    g.fill('#thAdd', '666 x2'); g.dblclick('#thAddBtn'); g.wait_for_timeout(100); g.click('#thAddBtn'); g.wait_for_timeout(100)
    ok('C11 double tap on Add counts once', n(g, '666') == 2, n(g, '666'))
    add(g, '9999, hello, 815'); ok('C12 unreadable entries listed and left in the box; good ones added', n(g, '815') == 1 and '9999' in g.inner_text('#thErr') and 'hello' in g.input_value('#thAdd'))
    g.locator('#thList .th[data-code="815"] [data-del]').click(); ok('C13 remove (with confirm)', g.locator('#thList .th[data-code="815"]').count() == 0)
    # quantity safeguards in the collection (cap 20)
    g.fill('#tn-666', '19'); g.locator('#tn-666').dispatch_event('change'); g.click('#tp-666')
    ok('Q1 typed count 19 then + to 20: no question asked', n(g, '666') == 20)
    dlg('dismiss'); g.click('#tp-666'); ok('Q2 + past 20 asks first; cancel keeps 20', n(g, '666') == 20)
    dlg('accept'); g.click('#tp-666'); ok('Q3 confirming allows 21', n(g, '666') == 21)
    g.click('#tm-666'); ok('Q4 going back down never asks', n(g, '666') == 20)
    dlg('dismiss'); g.fill('#tn-666', '1160'); g.locator('#tn-666').dispatch_event('change'); g.wait_for_timeout(50)
    ok('Q5 typing 1160 asks first; cancel keeps 20', n(g, '666') == 20 and 'Nothing changed' in g.inner_text('#thStatus')); dlg('accept')
    for bad in ('-2', '1.5', 'abc'):
        g.fill('#tn-666', bad) if bad != 'abc' else g.evaluate("document.getElementById('tn-666').value='abc'"); g.locator('#tn-666').dispatch_event('change'); g.wait_for_timeout(30)
    ok('Q6 negative / fractional / text counts rejected', n(g, '666') == 20)
    add(g, '310 1160'); ok('Q7 "310 1160" in the collection is never 1160 skeins', n(g, '310') == 4 and 'stitches' in g.inner_text('#thErr'))
    dlg('dismiss'); add(g, '666 x2'); ok('Q8 adding that would pass 20 asks first; cancel adds nothing', n(g, '666') == 20); dlg('accept')
    g.fill('#thAdd', '')
    # converter works without the collection
    h = page(390); h.fill('#inp', '310, 321'); h.click('#go'); ok('C14 Find My Floss works with an empty collection', 'Found 2 colors' in h.inner_text('#summary') and ls(h, TKEY) is None)

    # ---- old data preserved ----
    seed = "if(!localStorage.getItem('%s'))localStorage.setItem('%s',%s)" % (KEY, KEY, json.dumps(json.dumps(LEGACY)))
    o = page(390, seed); raw0 = ls(o, KEY)
    ok('M1 1.6 projects load unchanged (no rewrite on load)', raw0 == json.dumps(LEGACY) or json.loads(raw0) == LEGACY)
    o.click('#tabProjects'); ok('M2 old project listed with default status Planning', 'Old project' in o.inner_text('#projList') and 'Planning' in o.inner_text('#projList'))
    o.click('#tabThreads'); o.click('#thImport'); ok('M3 import "Have enough" from projects (extends Have/Check/Buy, no duplicate entry)', n(o, '310') == 2 and o.locator('#thList .th').count() == 1)
    o.click('#thImport'); ok('M3b importing twice does not double', n(o, '310') == 2)
    lp = json.loads(ls(o, KEY))['projects'][0]; ok('M4 project data untouched by the collection', lp['decisions'] == LEGACY['projects'][0]['decisions'] and lp['items'] == LEGACY['projects'][0]['items'])

    # ---- D: projects: status, comparison, missing vs short, shopping list ----
    d = page(390); d.click('#tabThreads'); add(d, '\n'.join(c + ' x2' for c in DEMO[:13]))
    d.click('#tabConvert'); d.fill('#inp', '\n'.join(f'{i+1} DMC {c} Color {100+i}' for i, c in enumerate(DEMO))); d.click('#go')
    ok('D1 Demogorgon list parsed: 19 colors', 'Found 19 colors' in d.inner_text('#summary'))
    d.fill('#newProjName', 'Demogorgon'); d.dblclick('#saveProj'); d.wait_for_timeout(200)
    ok('D2 double tap on Save makes one project', len(json.loads(ls(d, KEY))['projects']) == 1)
    d.click('#openSaved'); d.wait_for_timeout(100)
    ok('D3 Demogorgon (no amounts): 13 owned-not-verified, 0 owned, 0 short, 6 missing', d.inner_text('#cmpUnver').startswith('? 13') and d.inner_text('#cmpOwned').startswith('✓ 0') and '0' in d.inner_text('#cmpShort') and d.inner_text('#cmpMissing').startswith('✗ 6'), d.inner_text('#pCmp'))
    ok('D4 stitch counts kept on the project', json.loads(ls(d, KEY))['projects'][0]['items'][0]['stitchCount'] == 100)
    d.click('#pUseColl'); d.click('#pApplyColl'); d.wait_for_timeout(100); plan = d.inner_text('#pPlan')
    ok('D5 shopping list holds exactly the 6 missing colors', all(f'DMC {c}' in plan for c in ['498', '304', '3799', '535', '3371']) and 'Ecru' in plan.replace('ECRU', 'Ecru') and 'DMC 310 ' not in plan.split('Check first')[0].split('Needs attention')[0], plan[:500])
    ok('D6 price estimate shown for the missing list', '$' in plan, plan[:300])
    d.click('#pCopy'); d.wait_for_timeout(150); clip = d.evaluate('navigator.clipboard.readText()')
    ok('D7 copy as text reuses the existing list', 'DMC 3371' in clip and 'DMC 310 x' not in clip, clip[:300])
    d.select_option('#pStatus', 'progress'); d.reload(); d.wait_for_load_state('networkidle'); d.click('#tabProjects')
    ok('D8 status saved (In progress) and shown in the list', 'In progress' in d.inner_text('#projList') and json.loads(ls(d, KEY))['projects'][0]['status'] == 'progress')
    # short vs missing
    d.click('#tabThreads'); d.click('#tm-310'); d.click('#tm-310'); d.click('#tm-321')  # 310 -> 0 (out), 321 -> 1 (short of 2)
    d.click('#tabConvert'); d.fill('#inp', '310 x1\n321 x2\n666 x2\n3865 x1'); d.click('#go'); d.fill('#newProjName', 'Short test'); d.click('#saveProj'); d.click('#openSaved'); d.wait_for_timeout(100)
    ok('D9 short counted apart from missing (out of stock = missing)', d.inner_text('#cmpOwned').startswith('✓ 2') and d.inner_text('#cmpShort').startswith('◐ 1') and d.inner_text('#cmpMissing').startswith('✗ 1') and '321 (need 2 skeins, have 1 skein)' in d.inner_text('#pCmp'), d.inner_text('#pCmp'))
    d.click('#pUseColl'); d.click('#pApplyColl'); d.wait_for_timeout(100); pl = d.inner_text('#pPlan')
    ok('D10 short color asks only for the difference (321 × 1), missing for the full amount (310 × 1)', 'DMC 321 × 1' in pl and 'DMC 310 × 1' in pl and 'DMC 666' not in pl.split('Needs attention')[0], pl[:400])
    if A.shots:
        os.makedirs(A.shots, exist_ok=True); d.locator('#pCmp').scroll_into_view_if_needed(); d.screenshot(path=f'{A.shots}/project-compare-390.png')
    # project restore: backup -> wipe -> restore keeps status + stitches
    d.click('#pClose'); d.locator('#backupBox summary').click()
    with d.expect_download() as dl: d.click('#backupBtn')
    path = dl.value.path(); bk = json.load(open(path))
    ok('R1 backup carries status and stitch counts', any(x.get('status') == 'progress' for x in bk['projects']) and any(i.get('stitchCount') == 100 for x in bk['projects'] for i in x['items']))
    d.evaluate(f"localStorage.removeItem('{KEY}')"); d.reload(); d.wait_for_load_state('networkidle'); d.click('#tabProjects'); d.locator('#backupBox summary').click()
    d.set_input_files('#restoreFile', path); d.wait_for_timeout(200); d.click('#rGo'); d.wait_for_timeout(200)
    rs = json.loads(ls(d, KEY))['projects']; ok('R2 restore brings back both projects with status + stitches', len(rs) == 2 and any(x['status'] == 'progress' and x['name'] == 'Demogorgon' for x in rs) and any(i.get('stitchCount') == 100 for x in rs for i in x['items']))
    d.set_input_files('#restoreFile', os.path.join(os.path.dirname(__file__), 'fixtures', 'backup-v1.json')); d.wait_for_timeout(200); d.click('#rGo'); d.wait_for_timeout(200)
    ok('R3 an old schema-1 backup still restores (status defaults to Planning)', any(x['name'] == 'V1 fixture' and x['status'] == 'planning' for x in json.loads(ls(d, KEY))['projects']))

    # ---- corrupted / unavailable storage ----
    c = page(390, "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.setItem('%s','{not json')}" % TKEY); c.click('#tabThreads')
    ok('S1 corrupted collection: plain message, saving paused', "couldn't be read" in c.inner_text('#thMsg') and c.evaluate('FlossFoxThreadsUI.canSave()') is False)
    add(c, '310'); ok('S2 corrupted data never overwritten, copy kept aside', ls(c, TKEY) == '{not json' and c.evaluate(f"Object.keys(localStorage).some(k=>k.startsWith('{TKEY}.unreadable-'))"))
    c.click('#thReset'); add(c, '310'); ok('S3 Start a new collection works after confirm', json.loads(ls(c, TKEY))['threads']['310']['n'] >= 1)
    c2 = page(390, "localStorage.setItem('%s',JSON.stringify({schema:9,threads:{}}))" % TKEY); c2.click('#tabThreads')
    ok('S4 newer-version collection left untouched', 'newer version' in c2.inner_text('#thMsg') and json.loads(ls(c2, TKEY))['schema'] == 9)
    u = page(390, "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})", quiet=False)
    u.fill('#inp', '310, 321'); u.click('#go'); ok('S5 storage blocked: Find My Floss still works', 'Found 2 colors' in u.inner_text('#summary'))
    u.click('#tabThreads'); ok('S6 storage blocked: collection explains it lasts only this tab', 'until this tab closes' in u.inner_text('#thMsg'))
    add(u, '310 x2'); u.click('#tp-310'); ok('S7 storage blocked: collection still usable in memory', n(u, '310') == 3)

    # ---- E: Pip tips ----
    t = page(390); t.click('#tabThreads')
    ok('E1 tip shows on first visit with an existing pose', t.locator('#thTip').is_visible() and t.locator('#thTip img').get_attribute('data-pose') == 'pointing')
    add(t, '310'); tb = t.locator('#thTip').bounding_box()
    over = t.evaluate("""b=>[...document.querySelectorAll('#threadsView button,#threadsView input,#threadsView textarea')].filter(e=>!e.closest('#thTip')&&e.offsetParent).some(e=>{const r=e.getBoundingClientRect(),y=b.y-scrollY;return !(r.bottom<=y||r.top>=y+b.height||r.right<=b.x||r.left>=b.x+b.width)})""", tb)
    ok('E2 tip is inline and never covers a control', not over and t.evaluate("getComputedStyle(document.getElementById('thTip')).position") == 'static')
    t.click('#tabProjects'); t.click('#tabThreads'); ok('E3 at most once per view: not shown again on the next visit', t.locator('#thTip').is_hidden())
    t2 = page(390); t2.click('#tabThreads'); t2.click('#thTip [data-tipx]'); ok('E4 dismiss hides it', t2.locator('#thTip').is_hidden())
    t2.reload(); t2.wait_for_load_state('networkidle'); t2.click('#tabThreads'); ok('E5 dismissed tip stays dismissed after reload', t2.locator('#thTip').is_hidden() and 'threads' in ls(t2, TIPK))
    t3 = page(390, "localStorage.setItem('%s','hidden')" % PIPK); t3.click('#tabThreads'); ok('E6 no tip when Pip is hidden', t3.locator('#thTip').is_hidden())
    t4 = page(390, "localStorage.setItem('%s.hints.v1','off')" % PFX); t4.click('#tabThreads'); ok('E7 no tip when tips are switched off', t4.locator('#thTip').is_hidden())

    # ---- nav + widths ----
    for w in (360, 390, 1280):
        v = page(w); nav = v.locator('nav.tabs')
        rows = v.evaluate("new Set([...document.querySelectorAll('nav.tabs > *')].map(e=>Math.round(e.getBoundingClientRect().top))).size")
        ok(f'N1 {w}px nav: 5 items in at most 2 rows', nav.locator('> *').count() == 5 and rows <= 2, rows)
        first = v.evaluate("[...document.querySelectorAll('nav.tabs > *')].slice(0,3).map(e=>e.id)")
        ok(f'N2 {w}px Find My Floss first and selected by default', first == ['tabConvert', 'tabThreads', 'tabProjects'] and v.get_attribute('#tabConvert', 'aria-current') == 'page')
        small = v.evaluate("[...document.querySelectorAll('nav.tabs > *')].filter(e=>e.getBoundingClientRect().height<44).length")
        ok(f'N3 {w}px nav touch targets >= 44px', small == 0)
        v.click('#tabThreads'); add(v, '310, 321 x2, 3865, B5200')
        ok(f'N4 {w}px collection: no sideways scrolling', v.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        tgt = v.evaluate("[...document.querySelectorAll('#thList button,#thList label')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44).length")
        ok(f'N5 {w}px collection controls >= 44px tall', tgt == 0, tgt)
        v.evaluate('scrollTo(0,99999)'); top = v.evaluate("document.querySelector('#thList .th:last-child').getBoundingClientRect().top"); nb = v.evaluate("document.querySelector('nav.tabs').getBoundingClientRect().bottom")
        v.locator('#thList .th:last-child [data-step="1"]').click(); ok(f'N6 {w}px sticky nav does not block the last row', n(v, 'B5200') == 2)
        navh = v.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--navh')"); real = v.evaluate("document.querySelector('nav.tabs').offsetHeight")
        ok(f'N7 {w}px nav-offset fix tracks the real nav height ({real}px)', navh.strip() == f'{real}px', (navh, real))
        if A.shots:
            v.evaluate('scrollTo(0,0)'); v.screenshot(path=f'{A.shots}/collection-{w}.png'); v.click('#tabConvert'); v.screenshot(path=f'{A.shots}/nav-find-{w}.png')
    q = page(390); q.goto(B + 'index.html#threads'); q.wait_for_timeout(800); ok('N8 #threads deep link opens the collection', q.get_attribute('#tabThreads', 'aria-pressed') == 'true')
    f = page(390); f.goto(B + 'fabric.html'); ok('N9 fabric page nav links to the collection', f.locator('nav a[href="index.html#threads"]').count() == 1)
    ok('no JS errors', not errs, errs)
    br.close()
print(f"\ncollection_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
