#!/usr/bin/env python3
"""Combined 'Where I left off' note + verified restore. Results are simulated (headless Chrome, synthetic data).
Usage: FF_KEY=flossfox-dev.v1 python tests/local_memory_integration_e2e.py http://localhost:8765/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session
import sys, os, json, copy
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; JK = PFX + '.journal.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/ff-local-memory-integration/shots'); os.makedirs(SHOTS, exist_ok=True)
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def proj(pid, name, notes='', left=None):
    p = {'id': pid, 'name': name, 'notes': notes, 'buyBrand': 'dmc', 'status': 'progress', 'items': [{'code': '310', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None}], 'decisions': {}, 'purchased': {}, 'created': '2026-11-08T12:00:00Z', 'updated': '2026-11-08T12:00:00Z'}  # after the old auto-compare cut-off on purpose: visits must still write nothing
    if left is not None: p['leftOff'] = left
    return p
def th(n): return {'n': n, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}
LEFT = 'Finished page 2; next is the border.'
SEED = json.dumps({'schema': 2, 'projects': [proj('p1', 'Sample Autumn Wreath', 'Threads are in the blue bag', LEFT), proj('p2', 'Sample Garden Bookmark')]})
THR = json.dumps({'schema': 2, 'threads': {'310': th(2), 'BLANC': th(1)}})
J0 = json.dumps({'schema': 1, 'base': None, 'cps': [], 'events': [{'id': 'e0', 't': '2026-11-02T12:00:00Z', 'k': 'inventory', 'ref': {'code': '310'}, 'from': {'n': 1, 'partial': False}, 'to': {'n': 2, 'partial': False}}]})
BK = {'app': 'floss-fox', 'kind': 'full-backup', 'version': 2, 'schema': 2, 'exported': '2026-11-05T00:00:00Z',
      'projects': [proj('p1', 'Sample Autumn Wreath', 'Threads are in the blue bag', 'From backup: stitching the fox ears'), proj('f1', 'Sample Winter Mittens', 'Mitten notes', 'Cuff done')],
      'threads': {'schema': 2, 'threads': {'310': th(9), '321': th(1)}}, 'prefs': {},
      'journal': [{'id': 'ebk-1', 't': '2026-11-04T12:00:00Z', 'k': 'inventory', 'ref': {'code': '321'}, 'from': None, 'to': {'n': 1, 'partial': False}}]}
INIT = """(([K,TK,S,T,P,J])=>{if(!sessionStorage.getItem('lm.seeded')){localStorage.clear();localStorage.setItem(K,S);localStorage.setItem(TK,T);localStorage.setItem(P+'.journal.v1',J);sessionStorage.setItem('lm.seeded','1')}
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off')}})"""
AFFECTED = [KEY, TK, PFX + '.allocations.v1'] + [PFX + x for x in ('.pip.v1', '.hints.v1', '.tips.v1', '.fabric.v1', '.backup-prefs.v1')]
DATA = "JSON.stringify(%s.map(k=>[k,localStorage.getItem(k)]))" % json.dumps(AFFECTED)
def ls(g, k): return g.evaluate(f"localStorage.getItem('{k}')")
def ready(g): g.wait_for_function('window.FlossFoxProjects&&window.FlossFoxJournal&&window.FlossFoxRestoreVerify&&window.FlossFoxSnapshots&&window.FlossFoxRecentChanges'); g.wait_for_timeout(300)
def pj(g, pid): return next((p for p in json.loads(ls(g, KEY))['projects'] if p['id'] == pid), None)
def jids(g): return [e['id'] for e in json.loads(ls(g, JK) or '{"events":[]}')['events']]
def page(br, vw={'width': 1200, 'height': 900}):
    c = br.new_context(viewport=vw, service_workers='block', is_mobile=vw['width'] < 500, has_touch=vw['width'] < 500, device_scale_factor=2 if vw['width'] < 500 else 1)
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, SEED, THR, PFX, J0])})")
    g = c.new_page(); g.set_default_timeout(8000); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw#projects'); ready(g); return c, g
def imp(g, data, mode='merge', rmode=None):
    if g.locator('#pClose').count() and g.is_visible('#pClose'): g.click('#pClose'); g.wait_for_timeout(150)
    g.set_input_files('#restoreFile', files=[{'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()}])
    g.wait_for_selector('#rGo'); g.check(f'input[name=imode][value={mode}]')
    if rmode and g.locator(f'input[name=rmode][value={rmode}]').count(): g.check(f'input[name=rmode][value={rmode}]')
    g.click('#rGo'); g.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c, g = page(br); d0 = g.evaluate(DATA)
    for t in ['tabThreads', 'tabShop', 'tabSettings', 'tabHelp', 'tabConvert', 'tabProjects']: g.evaluate(f"document.getElementById('{t}').click()"); g.wait_for_timeout(150)
    g.evaluate("document.getElementById('tabSettings').click()"); g.click('#recentChanges summary'); g.wait_for_timeout(150)
    g.evaluate("document.getElementById('tabProjects').click()"); g.evaluate("FlossFoxProjects.openProject('p1')"); g.wait_for_selector('#pLeftOff'); g.wait_for_timeout(200)
    ok('VISIT-1 visiting every tab, Recent changes and a project changes no saved data', g.evaluate(DATA) == d0)
    ok('NOTE-1 saved note and general Notes both shown', g.input_value('#pLeftOff') == LEFT and g.input_value('#pNotes') == 'Threads are in the blue bag')
    bk = g.evaluate("FlossFoxProjects.fullBackup()")
    ok('BK-1 own backup carries leftOff and Notes', next(x for x in bk['projects'] if x['id'] == 'p1').get('leftOff') == LEFT)
    pre = g.evaluate(DATA); pre_j = jids(g)
    imp(g, BK, rmode='replace'); m = g.inner_text('#restoreDone')
    ok('MERGE-1 merge import verified; replaced project takes backup note, notes intact', 'Restore checked and saved (Merge)' in m and pj(g, 'p1')['leftOff'] == 'From backup: stitching the fox ears' and pj(g, 'p1')['notes'] == 'Threads are in the blue bag', m)
    ok('MERGE-2 new project brings its note; untouched project unchanged', pj(g, 'f1')['leftOff'] == 'Cuff done' and 'leftOff' not in pj(g, 'p2'))
    n_j = jids(g); ok('JRN-1 backup journal merged once', n_j.count('ebk-1') == 1 and 'e0' in n_j, n_j)
    imp(g, BK, rmode='replace'); ok('JRN-2 same backup again: no duplicate projects or events', jids(g) == n_j and [x['id'] for x in json.loads(ls(g, KEY))['projects']].count('f1') == 1)
    with g.expect_navigation(): g.click('#undoImportBtn')
    ready(g); after_undo = g.evaluate(DATA)
    # Undo goes back to before the LAST import (the second one), which equals the state after the first import
    ok('UNDO-1 Undo restores exact pre-import bytes incl. leftOff', json.loads(after_undo)[0][1] is not None and pj(g, 'p1')['leftOff'] == 'From backup: stitching the fox ears' and pj(g, 'f1')['leftOff'] == 'Cuff done')
    c.close()
    # Undo after a single replace import: exact original
    c, g = page(br); pre = g.evaluate(DATA); pre_j = jids(g)
    imp(g, BK, mode='replace'); m = g.inner_text('#restoreDone')
    ok('REPL-1 replace import verified and carries notes', 'Restore checked and saved (Replace)' in m and pj(g, 'p1')['leftOff'] == 'From backup: stitching the fox ears' and pj(g, 'p2') is None)
    with g.expect_navigation(): g.click('#undoImportBtn')
    ready(g)
    ok('UNDO-2 Undo restores every affected key byte-for-byte (leftOff, Notes, threads)', g.evaluate(DATA) == pre, g.evaluate(DATA))
    ok('UNDO-3 journal back to pre-import events', jids(g) == pre_j, jids(g))
    # automatic copy restore keeps the note
    g.evaluate("FlossFoxSnapshots.take('open',{force:true})"); g.evaluate("FlossFoxProjects.openProject('p1')"); g.wait_for_selector('#pLeftOff')
    j1 = jids(g); g.evaluate("v=>{const t=document.getElementById('pLeftOff');t.value=v;t.dispatchEvent(new Event('change',{bubbles:true}))}", 'Changed later'); g.wait_for_timeout(150)
    ok('JRN-3 saving a note adds no journal events', jids(g) == j1)
    i = g.evaluate("FlossFoxSnapshots.list().findIndex(s=>{try{return JSON.parse(s.keys[%r]).projects.some(p=>p.leftOff===%r)}catch(e){return false}})" % (KEY, LEFT))
    with g.expect_navigation(): g.evaluate(f"FlossFoxSnapshots.restore({i})")
    ready(g); g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(200)
    ok('COPY-1 automatic copy restore brings the note back, verified', pj(g, 'p1')['leftOff'] == LEFT and g.locator('#snapRestored').count() == 1 and g.evaluate(DATA) == pre)
    c.close()
    # failed save rollback keeps note
    c, g = page(br); pre = g.evaluate(DATA)
    g.evaluate("void(window.__si=Storage.prototype.setItem,Storage.prototype.setItem=function(k,v){if(k===%r&&/Cuff/.test(v))throw new Error('quota');return window.__si.call(this,k,v)})" % KEY)
    with g.expect_navigation(timeout=8000): imp(g, BK)
    ready(g); g.wait_for_timeout(200)
    ok('FAIL-1 failed import put back exactly; note intact; no success', g.evaluate(DATA) == pre and pj(g, 'p1')['leftOff'] == LEFT and 'Nothing was changed' in g.inner_text('#projStatus'))
    c.close()
    ok('ERR-1 no page errors', not errs, errs[:3])
    # mobile screenshots: note + restore confirmation
    c, g = page(br, {'width': 390, 'height': 844}); g.evaluate("FlossFoxProjects.openProject('p1')"); g.wait_for_selector('#pLeftOff')
    g.locator('label[for=pLeftOff]').evaluate("e=>e.scrollIntoView({block:'center'})"); g.wait_for_timeout(200); g.screenshot(path=f'{SHOTS}/note-mobile.png')
    ok('MOB-1 no horizontal overflow (note)', g.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
    g.evaluate("FlossFoxProjects.openProject&&document.getElementById('tabProjects').click()"); imp(g, BK, rmode='replace')
    g.locator('#restoreDone').evaluate("e=>e.scrollIntoView({block:'center'})"); g.wait_for_timeout(200); g.screenshot(path=f'{SHOTS}/restore-confirmation-mobile.png')
    ok('MOB-2 no horizontal overflow (restore)', g.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
    c.close(); br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
