#!/usr/bin/env python3
"""Floss Fox 1.7 RC data protection: real 1.4 / 1.6 / current storage fixtures, full backup export/import
(merge, replace + confirm, undo import, invalid/damaged/wrong-version files), demo data kept apart from real data,
'Use my collection' preview + undo (collection never changes), owned-not-verified bucket, storage key separation.
Usage: python tests/data_e2e.py [BASE_URL]   (preview: set FF_KEY / FF_PIP_KEY like regression.py)"""
import sys, os, argparse, json, tempfile
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome')
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'; PRE = PFX + '.preimport.v1'
DEV = 'floss-fox-dev' in B
QUIET = "try{localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}')}catch(e){}" % PFX
FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
R = {'pass': 0, 'fail': 0}; errs = []; DLG = {'m': 'accept', 'seen': []}
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(info)[:400]}'))
def remap(d): return {(PFX + k[len('flossfox'):] if k.startswith('flossfox.') else k): v for k, v in d.items()}
def seed_js(d): return 'if(!sessionStorage.getItem("seeded")){sessionStorage.setItem("seeded","1");' + ''.join(f'localStorage.setItem({json.dumps(k)},{json.dumps(v)});' for k, v in d.items()) + '}'
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    def page(seed=None, w=390):
        mob = w < 600
        ctx = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=mob, has_touch=mob, accept_downloads=True)
        ctx.add_init_script(QUIET)
        if seed: ctx.add_init_script(seed_js(seed))
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e)))
        def h(d):
            DLG['seen'].append(d.message); d.accept() if DLG['m'] == 'accept' else d.dismiss()
        g.on('dialog', h); g.goto(B); g.wait_for_load_state('networkidle'); return g
    ls = lambda g, k: g.evaluate(f"localStorage.getItem({json.dumps(k)})")
    allkeys = lambda g: g.evaluate("Object.keys(localStorage)")
    def proj(g): return json.loads(ls(g, KEY))['projects']

    # ---- F: real old-version fixtures ----
    for ver in ['1.4', '1.6']:
        raw = remap(json.load(open(os.path.join(FIX, f'storage-{ver}.json'))))
        g = page(raw); g.click('#tabProjects')
        names = g.inner_text('#projList')
        ok(f'F1 {ver}: real {ver} storage opens with both projects', 'Old real project' in names and 'Second old project' in names, names)
        orig = json.loads(raw[KEY])['projects'][0]; now = [x for x in proj(g) if x['name'] == 'Old real project']
        g.click('#projList [data-open]'); g.wait_for_timeout(100)
        now = [x for x in json.loads(ls(g, KEY) or raw[KEY])['projects'] if x['name'] == 'Old real project'][0]
        ok(f'F2 {ver}: decisions kept exactly (have/buy/owned 1/check/none)', all(now['decisions'].get(c, {}).get('status') == orig['decisions'].get(c, {}).get('status') and now['decisions'].get(c, {}).get('owned') == orig['decisions'].get(c, {}).get('owned') for c in orig['decisions']), now['decisions'])
        ok(f'F3 {ver}: items kept (codes, amounts, assumed)', [(i['code'], i['qty'], i['assumed']) for i in now['items']] == [(i['code'], i['qty'], i['assumed']) for i in orig['items']])
        ok(f'F4 {ver}: Pip stays hidden', ls(g, PFX + '.pip.v1') == 'hidden' and g.locator('#threadsView .piptip:not([hidden])').count() == 0)
        if ver == '1.6': ok('F5 1.6: fabric settings untouched', ls(g, PFX + '.fabric.v1') == raw[PFX + '.fabric.v1'])
        ok(f'F6 {ver}: no unreadable copy made, collection starts empty', not any('unreadable' in k for k in allkeys(g)) and (ls(g, TKEY) is None or json.loads(ls(g, TKEY))['threads'] == {}))
        g.context.close()
    # current-format backup fixture (schema 1 projects backup) still restores
    g = page(); g.click('#tabProjects'); g.click('#backupBox summary'); g.set_input_files('#restoreFile', os.path.join(FIX, 'backup-v1.json')); g.wait_for_timeout(250)
    ok('F7 old projects-only backup is accepted and says the collection is not touched', 'projects-only' in g.inner_text('#restorePanel'), g.inner_text('#restorePanel'))
    g.click('#rGo'); g.wait_for_timeout(150); ok('F8 projects-only backup restored', len(proj(g)) >= 1 and 'Restore done' in g.inner_text('#projStatus'), g.inner_text('#projStatus'))
    g.context.close()

    # ---- K: full backup round trip ----
    g = page(); g.click('#tabThreads'); g.fill('#thAdd', '310 x2\n321\n666 x3'); g.click('#thAddBtn'); g.wait_for_timeout(80)
    g.click('#tabConvert'); g.fill('#inp', '1 DMC 310 Black 1200\n2 DMC 321 Red 800\n699'); g.click('#go'); g.fill('#newProjName', 'Backup me'); g.click('#saveProj'); g.wait_for_timeout(100)
    g.evaluate(f"localStorage.setItem('{PFX}.hints.v1','off')")
    g.click('#tabProjects'); g.click('#backupBox summary')
    with g.expect_download() as dl: g.click('#backupBtn')
    path = dl.value.path(); bk = json.load(open(path))
    ok('K1 backup is versioned (app, kind full-backup, version 1)', bk.get('app') == 'floss-fox' and bk.get('kind') == 'full-backup' and bk.get('version') == 1, {k: bk.get(k) for k in ['app', 'kind', 'version']})
    ok('K2 backup has projects, the collection and prefs', len(bk['projects']) == 1 and set(bk['threads']['threads']) == {'310', '321', '666'} and bk['prefs'].get('hints') == 'off')
    ok('K3 stitch counts and amounts kept apart in the backup', [(i['code'], i['qty'], i['assumed'], i.get('stitchCount')) for i in bk['projects'][0]['items']] == [('310', 1, 1, 1200), ('321', 1, 1, 800), ('699', 1, 1, None)], bk['projects'][0]['items'])
    snapP, snapT = ls(g, KEY), ls(g, TKEY)
    # invalid files: nothing changes
    for nm, buf, want in [('not json', b'{oops', "isn't a valid"), ('other app', json.dumps({'app': 'x', 'projects': []}).encode(), "isn't a valid"),
                          ('newer version', json.dumps({**bk, 'version': 99}).encode(), 'newer version'),
                          ('damaged collection', json.dumps({**bk, 'threads': 'garbage'}).encode(), "isn't a valid"),
                          ('newer collection schema', json.dumps({**bk, 'threads': {'schema': 9, 'threads': {}}}).encode(), 'newer version'),
                          ('unknown kind', json.dumps({**bk, 'kind': 'something'}).encode(), "isn't a valid"), ('empty file', b'', "isn't a valid")]:
        g.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': buf}); g.wait_for_timeout(200)
        t = g.inner_text('#restorePanel')
        ok(f'K4 {nm}: plain error, nothing changed', want in t and 'Nothing was changed' in t and ls(g, KEY) == snapP and ls(g, TKEY) == snapT and ls(g, PRE) is None, t)
    # clear storage, import into an empty browser
    g.evaluate('localStorage.clear()'); g.reload(); g.wait_for_load_state('networkidle'); g.click('#tabProjects'); g.click('#backupBox summary')
    g.set_input_files('#restoreFile', path); g.wait_for_timeout(250); t = g.inner_text('#restorePanel')
    ok('K5 import summary counts projects, colors and prefs', '1 project(s)' in t and '3 thread colors' in t and 'preference' in t, t)
    ok('K6 merge or replace offered, merge is the default', g.is_checked('input[name=imode][value=merge]') and g.locator('input[name=imode][value=replace]').count() == 1)
    g.click('#rGo'); g.wait_for_timeout(200)
    ok('K7 after clear + import, projects and collection are back', [x['name'] for x in proj(g)] == ['Backup me'] and json.loads(ls(g, TKEY))['threads'].keys() == {'310', '321', '666'} and json.loads(ls(g, TKEY))['threads']['666']['n'] == 3)
    # merge keeps my counts
    g.click('#tabThreads'); g.fill('#tn-310', '7'); g.dispatch_event('#tn-310', 'change'); g.fill('#thAdd', '898'); g.click('#thAddBtn'); g.wait_for_timeout(80)
    g.click('#tabProjects'); g.click('#backupBox summary') if not g.evaluate("document.getElementById('backupBox').open") else None
    g.set_input_files('#restoreFile', path); g.wait_for_timeout(250); g.check('input[name=rmode][value=skip]'); g.click('#rGo'); g.wait_for_timeout(200)
    th = json.loads(ls(g, TKEY))['threads']
    ok('K8 merge keeps my skein counts and my extra colors', th['310']['n'] == 7 and '898' in th and len(proj(g)) == 1, th)
    ok('K9 a pre-import copy is kept and Undo last import is offered', ls(g, PRE) is not None and g.is_visible('#undoImportBtn'))
    # replace: cancelled confirm changes nothing
    before = (ls(g, KEY), ls(g, TKEY))
    g.set_input_files('#restoreFile', path); g.wait_for_timeout(250); g.check('input[name=imode][value=replace]')
    DLG['m'] = 'dismiss'; DLG['seen'].clear(); g.click('#rGo'); g.wait_for_timeout(150); DLG['m'] = 'accept'
    ok('K10 replace asks for confirmation; Cancel changes nothing', any('Replace your data' in m for m in DLG['seen']) and (ls(g, KEY), ls(g, TKEY)) == before, DLG['seen'])
    g.click('#rGo'); g.wait_for_timeout(250)
    th = json.loads(ls(g, TKEY))['threads']
    ok('K11 confirmed replace makes data match the backup', th['310']['n'] == 2 and '898' not in th and ls(g, PFX + '.hints.v1') == 'off')
    g.click('#undoImportBtn'); g.wait_for_load_state('networkidle'); g.wait_for_timeout(200)
    th = json.loads(ls(g, TKEY))['threads']
    ok('K12 Undo last import restores exactly the data from before it', th['310']['n'] == 7 and '898' in th and ls(g, KEY) == before[0] and ls(g, PRE) is None, th)
    g.evaluate("localStorage.setItem('x','1');localStorage.removeItem('x')"); g.set_input_files('#restoreFile', path); g.wait_for_timeout(250); g.click('#rGo'); g.wait_for_timeout(150)
    own = 'flossfox-dev.' if DEV else 'flossfox.'; ks = allkeys(g)
    ok(f'K14 backup, pre-import copy and hints keys all use this build\'s prefix ({own})', PRE in ks and all(k.startswith(own) for k in ks), ks)
    g.context.close()

    # ---- D: demo data kept apart (seeded in demo format; the dev-only button uses the same format) ----
    real = {'schema': 1, 'threads': {'310': {'n': 1, 'partial': False, 'restock': False, 'updated': ''}, '898': {'n': 2, 'partial': True, 'restock': True, 'updated': ''}},
            'demo': {'310': {'n': 9, 'partial': False, 'restock': False, 'updated': ''}, '666': {'n': 4, 'partial': False, 'restock': False, 'updated': ''}}}
    rp = {'id': 'real-1', 'name': 'My real one', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [{'code': '310', 'qty': 3, 'stated': True, 'assumed': 0, 'src': ['310 x3']}], 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}
    dp = {**rp, 'id': 'demo-1', 'name': 'Demogorgon (demo)', 'demo': True}
    seed = {TKEY: json.dumps(real), KEY: json.dumps({'schema': 2, 'projects': [rp, dp]})}
    g = page(seed); g.click('#tabThreads')
    ok('D1 demo threads listed separately and labelled Demo', g.locator('#thList li.th.demo').count() == 2 and g.locator('#thList li.th.demo .demotag').first.inner_text() == 'Demo' and g.locator('#thList li.th:not(.demo)').count() == 2)
    ok('D2 real 310 and demo 310 are separate rows with their own counts', g.input_value('#tn-310') == '1' and g.input_value('#tn-d_310') == '9')
    g.click('#tp-d_310'); ok('D3 changing demo 310 never changes real 310', json.loads(ls(g, TKEY))['threads']['310']['n'] == 1 and json.loads(ls(g, TKEY))['demo']['310']['n'] == 10)
    g.click('#tabProjects'); lst = g.inner_text('#projList')
    ok('D4 demo project tagged Demo in the list', 'Demo' in g.inner_text('#projList [data-open="demo-1"]') if g.locator('[data-open="demo-1"]').count() else 'Demo' in lst, lst)
    g.click('[data-open="real-1"]'); g.wait_for_timeout(100)
    ok('D5 real project compared with real threads only (310: need 3, have 1 = short)', g.inner_text('#cmpShort').startswith('◐ 1'), g.inner_text('#pCmpBox'))
    g.click('#pClose') if g.locator('#pClose').count() else None
    g.click('#tabProjects'); g.click('[data-open="demo-1"]'); g.wait_for_timeout(100)
    ok('D6 demo project compared with demo threads only (310: have 10 = owned)', g.inner_text('#cmpOwned').startswith('✓ 1') and 'demo threads' in g.inner_text('#pCmpBox'), g.inner_text('#pCmpBox'))
    g.click('#pClose'); g.click('#backupBox summary')
    with g.expect_download() as dl: g.click('#backupBtn')
    b2 = json.load(open(dl.value.path()))
    ok('D7 demo items are never in a backup', [x['id'] for x in b2['projects']] == ['real-1'] and set(b2['threads']['threads']) == {'310', '898'} and 'demo' not in b2['threads'])
    g.click('#tabThreads'); DLG['seen'].clear(); g.click('#thRemoveDemo'); g.wait_for_timeout(150)
    d = json.loads(ls(g, TKEY)); ps = proj(g)
    ok('D8 Remove demo data asks first, then removes only tagged demo items', any('Remove demo data' in m for m in DLG['seen']) and 'demo' not in d and [x['id'] for x in ps] == ['real-1'])
    ok('D9 real data untouched by demo removal (incl. real 310 with same DMC number)', d['threads'] == real['threads'] and [(i['code'], i['qty'], i['assumed']) for i in ps[0]['items']] == [('310', 3, 0)] and ps[0]['name'] == 'My real one', (d, ps))
    ok('D10 Remove demo button gone once there is no demo data', g.locator('#thRemoveDemo').count() == 0)
    g.context.close()

    # ---- U: Use my collection: preview, apply, undo; owned-not-verified ----
    coll = {'schema': 1, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'updated': ''}, '321': {'n': 1, 'partial': False, 'restock': False, 'updated': ''}, '815': {'n': 1, 'partial': False, 'restock': False, 'updated': ''}}}
    pr = {**rp, 'id': 'u-1', 'name': 'Undo test', 'items': [{'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['310 x2'], 'stitchCount': 1500},
          {'code': '321', 'qty': 3, 'stated': True, 'assumed': 0, 'src': ['321 x3']}, {'code': '815', 'qty': 1, 'stated': False, 'assumed': 1, 'src': ['815']}, {'code': '699', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['699 x1']}],
          'decisions': {'699': {'status': 'have', 'owned': 1, 'anchor': None, 'recv': None}}}
    g = page({TKEY: json.dumps(coll), KEY: json.dumps({'schema': 2, 'projects': [pr]})}); g.click('#tabProjects')
    ok('S1 project list card shows the stitch total labelled stitches', '1,500 stitches' in g.inner_text('#projList'), g.inner_text('#projList'))
    g.click('[data-open="u-1"]'); g.wait_for_timeout(100); box = g.inner_text('#pCmpBox')
    ok('S2 thread card shows "1,500 stitches" apart from "2 skeins needed"', '1,500 stitches' in g.inner_text('#pCards') and '2 skeins needed' in g.inner_text('#pCards'), g.inner_text('#pCards')[:300])
    ok('Q1 counts kept apart: 1 owned, 1 quantity not verified, 1 short, 1 missing', g.inner_text('#cmpOwned').startswith('✓ 1') and g.inner_text('#cmpUnver').startswith('? 1') and g.inner_text('#cmpShort').startswith('◐ 1') and g.inner_text('#cmpMissing').startswith('✗ 1'), box)
    ok('Q2 assumed + owned says "Color owned, quantity not verified", not have enough', 'quantity not verified' in box.lower(), box)
    ok('Q3 independence note in plain words', "Each project is checked against your whole collection; floss isn't reserved between projects." in box, box)
    before = proj(g)[0]['decisions']; collBefore = ls(g, TKEY)
    g.click('#pUseColl'); g.wait_for_timeout(100); pv = g.inner_text('#pCmpPrev')
    ok('U1 preview shows a compact summary before anything is applied', 'Will mark 1 Have enough, 1 Not sure, 2 Need to buy' in pv and proj(g)[0]['decisions'] == before, pv)
    g.click('#pCancelColl'); ok('U2 Cancel leaves the project unchanged', proj(g)[0]['decisions'] == before and g.locator('#pCmpPrev').count() == 0)
    g.click('#pUseColl'); g.click('#pApplyColl'); g.wait_for_timeout(100); dec = proj(g)[0]['decisions']
    ok('U3 apply: owned -> Have, not verified -> Not sure, short/missing -> Need to buy', dec['310']['status'] == 'have' and dec['815']['status'] == 'check' and dec['321']['status'] == 'buy' and dec['699']['status'] == 'buy', dec)
    ok('U4 the collection itself never changes', ls(g, TKEY) == collBefore)
    g.click('#pUndoColl'); g.wait_for_timeout(100); dec = proj(g)[0]['decisions']
    ok('U5 Undo restores the previous Have/Need state exactly', all(dec.get(c, {}).get('status') == before.get(c, {}).get('status') for c in ['310', '321', '815', '699']) and dec['699']['owned'] == 1, dec)
    ok('U6 collection still unchanged after undo', ls(g, TKEY) == collBefore and g.locator('#pUndoColl').count() == 0)
    g.context.close()

    # ---- P: Pip tip compact on mobile ----
    g = page({PFX + '.pip.v1': 'shown'}); g.click('#tabThreads'); g.wait_for_timeout(100)
    if g.locator('#thTip:not([hidden])').count():
        txt = g.inner_text('#thTip p'); ok('P1 tip is one short line with a More expander', len(txt) < 70 and g.locator('#thTip details summary').inner_text() == 'More', txt)
        sh = g.locator('#thTip').bounding_box()['height']; g.click('#thTip summary')
        ok('P2 More expands the full tip', g.locator('#thTip details[open]').count() == 1 and 'Partial skein' in g.inner_text('#thTip'))
        ok('P3 collapsed tip is compact on a phone (<= 260px)', sh <= 260, sh)
        g.click('[data-tipx]'); ok('P4 tip dismissible', g.locator('#thTip:not([hidden])').count() == 0)
    else: ok('P1 tip shown with Pip on', False, 'no tip')
    g.context.close()

    # ---- S: storage key separation ----
    g = page(); g.click('#tabThreads'); g.fill('#thAdd', '310'); g.click('#thAddBtn'); g.click('#tabConvert'); g.fill('#inp', '310'); g.click('#go'); g.fill('#newProjName', 'k'); g.click('#saveProj'); g.wait_for_timeout(100)
    g.evaluate("document.getElementById('pipToggle')&&document.getElementById('pipToggle').click()")
    g.goto(B + 'fabric.html'); g.wait_for_load_state('networkidle'); g.evaluate("document.querySelectorAll('input').forEach(i=>{if(i.type==='number'){i.value='50';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))}})"); g.wait_for_timeout(200)
    ks = allkeys(g); own = 'flossfox-dev.' if DEV else 'flossfox.'; other = 'flossfox.' if DEV else 'flossfox-dev.'
    ok(f'K13 every key this build writes starts with {own} (none with {other})', ks and all(k.startswith(own) for k in ks), ks)
    print('   keys:', sorted(ks))
    g.context.close()
    ok('no JS errors', not errs, errs[:3])
    br.close()
print(f"\ndata_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
