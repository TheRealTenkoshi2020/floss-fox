#!/usr/bin/env python3
"""'Where I left off' project note: save/reload, isolation, clear, unicode/malicious text, backups, restore, journal, failures.
Results are simulated (headless Chrome, synthetic data). Usage: FF_KEY=flossfox-dev.v1 python tests/where_left_off_e2e.py http://localhost:8765/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; JK = PFX + '.journal.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/project-resume-note-logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def proj(pid, name, notes=''): return {'id': pid, 'name': name, 'notes': notes, 'buyBrand': 'dmc', 'status': 'progress', 'items': [{'code': '310', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None}], 'decisions': {}, 'purchased': {}, 'created': '2026-11-01T00:00:00Z', 'updated': '2026-11-01T00:00:00Z'}
SEED = json.dumps({'schema': 2, 'projects': [proj('p1', 'Sample Autumn Wreath', 'Threads are in the blue bag'), proj('p2', 'Sample Garden Bookmark')]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}})
INIT = """(([K,TK,S,T,P])=>{if(!localStorage.getItem('wlo.seeded')){localStorage.setItem(K,S);localStorage.setItem(TK,T);localStorage.setItem('wlo.seeded','1')}
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off')}})"""
def store(g): return json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))
def pj(g, pid): return next(p for p in store(g)['projects'] if p['id'] == pid)
def jcount(g): return len(json.loads(g.evaluate(f"localStorage.getItem('{JK}')") or '{"events":[]}')['events'])
def openp(g, pid): g.evaluate(f"FlossFoxProjects.openProject('{pid}')"); g.wait_for_selector('#pLeftOff', state='attached')
def setnote(g, v): g.evaluate("v=>{const t=document.getElementById('pLeftOff');t.value=v;t.dispatchEvent(new Event('change',{bubbles:true}))}", v); g.wait_for_timeout(150)
def ready(g): g.wait_for_function('window.FlossFoxProjects&&window.FlossFoxJournal'); g.wait_for_timeout(300)
NOTE = 'Finished page 2; next is the border.\nUse 2 strands. Fil BLANC 🌷 é'
EVIL = '<img src=x onerror="window.__xss=1">'
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block', accept_downloads=True)
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, SEED, THR, PFX])})")
    g = c.new_page(); g.set_default_timeout(8000); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw#projects'); ready(g)
    ok('LOAD-1 existing projects unchanged on load (no leftOff added)', all('leftOff' not in x for x in store(g)['projects']) and g.evaluate(f"localStorage.getItem('{KEY}')") == SEED)
    openp(g, 'p1')
    ok('UI-1 labelled field visible outside collapsed details', g.is_visible('#pLeftOff') and 'Where I left off' in g.inner_text('label[for=pLeftOff]'))
    ok('UI-2 empty field has example placeholder', g.get_attribute('#pLeftOff', 'placeholder') and g.input_value('#pLeftOff') == '')
    ok('UI-3 general Notes still there and unchanged', g.input_value('#pNotes') == 'Threads are in the blue bag')
    j0 = jcount(g); setnote(g, NOTE)
    ok('SAVE-1 multiline unicode note saved exactly', pj(g, 'p1').get('leftOff') == NOTE, pj(g, 'p1'))
    ok('SAVE-2 general notes not overwritten', pj(g, 'p1')['notes'] == 'Threads are in the blue bag')
    ok('ISO-1 other project unaffected', 'leftOff' not in pj(g, 'p2'))
    ok('JRN-1 saving a note adds no journal events', jcount(g) == j0, jcount(g))
    setnote(g, NOTE); ok('DUP-1 saving same note again changes nothing', pj(g, 'p1')['leftOff'] == NOTE and jcount(g) == j0)
    g.reload(); ready(g); openp(g, 'p1')
    ok('RELOAD-1 note shown after reload', g.input_value('#pLeftOff') == NOTE)
    openp(g, 'p2'); ok('ISO-2 second project shows empty note', g.input_value('#pLeftOff') == '')
    setnote(g, EVIL); g.reload(); ready(g); openp(g, 'p2')
    ok('XSS-1 malicious note stored and shown as plain text', g.input_value('#pLeftOff') == EVIL and g.evaluate('window.__xss') is None and g.locator('#projEdit img[src=x]').count() == 0)
    setnote(g, 'x' * 900); ok('LEN-1 note limited to 500 characters', len(pj(g, 'p2')['leftOff']) == 500 and g.get_attribute('#pLeftOff', 'maxlength') == '500')
    setnote(g, '   '); ok('CLEAR-1 blank note removes the field', 'leftOff' not in pj(g, 'p2'), pj(g, 'p2'))
    # backups
    bk = g.evaluate("FlossFoxProjects.fullBackup()")
    bp = next(x for x in bk['projects'] if x['id'] == 'p1') if 'projects' in bk else None
    ok('BK-1 backup carries the note', bp is not None and bp.get('leftOff') == NOTE, list(bk.keys()))
    m = g.evaluate("b=>FlossFoxProjects.migrate(b)", bk)
    ok('BK-2 backup roundtrip keeps the note through import normalize', next(x for x in m['data']['projects'] if x['id'] == 'p1').get('leftOff') == NOTE)
    old = {'schema': 2, 'projects': [proj('o1', 'Old backup project', 'old notes')]}
    m2 = g.evaluate("b=>FlossFoxProjects.migrate(b)", old)
    ok('OLD-1 older backup without the field imports unchanged', m2 and 'leftOff' not in m2['data']['projects'][0] and m2['data']['projects'][0]['notes'] == 'old notes')
    bad = {'schema': 2, 'projects': [dict(proj('b1', 'Bad'), leftOff={'x': 1}), dict(proj('b2', 'Bad2'), leftOff=42)]}
    m3 = g.evaluate("b=>FlossFoxProjects.migrate(b)", bad)
    ok('BAD-1 malformed leftOff dropped, project kept', m3 and len(m3['data']['projects']) == 2 and all('leftOff' not in x for x in m3['data']['projects']))
    # automatic copy restore
    g.evaluate("FlossFoxSnapshots.take('open',{force:true})")
    setnote(g, ''); openp(g, 'p1'); setnote(g, 'Changed later')
    g.evaluate("FlossFoxSnapshots.restore(0)") if False else None
    i = g.evaluate("FlossFoxSnapshots.list().findIndex(s=>{try{return JSON.parse(s.keys[%r]).projects.some(p=>p.leftOff===%r)}catch(e){return false}})" % (KEY, NOTE))
    with g.expect_navigation(): g.evaluate(f"FlossFoxSnapshots.restore({i})")
    ready(g); ok('SNAP-1 restoring an automatic copy brings the note back', pj(g, 'p1').get('leftOff') == NOTE, i)
    # failed write: value stays in the box, save message shown, stored data untouched
    openp(g, 'p1'); before = g.evaluate(f"localStorage.getItem('{KEY}')")
    g.evaluate("void(window.__si=Storage.prototype.setItem,Storage.prototype.setItem=function(k,v){if(k===%r)throw new Error('quota');return window.__si.call(this,k,v)})" % KEY)
    setnote(g, 'Will not save'); g.wait_for_timeout(200)
    ok('FAIL-1 failed write keeps typed text and leaves saved data intact', g.input_value('#pLeftOff') == 'Will not save' and g.evaluate(f"localStorage.getItem('{KEY}')") == before)
    g.evaluate("void(Storage.prototype.setItem=window.__si)")
    ok('ERR-1 no page errors', not errs, errs[:3])
    c.close()
    # mobile screenshot with ordinary synthetic data
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2, service_workers='block')
    S2 = json.loads(SEED); S2['projects'][0]['leftOff'] = 'Finished page 2; next is the border.'
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, json.dumps(S2), THR, PFX])})")
    g = c.new_page(); g.goto(B + '?nosw#projects'); ready(g); openp(g, 'p1')
    ok('MOB-1 no horizontal overflow at 390px', g.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
    ok('MOB-2 field at least 44px tall', g.evaluate("document.getElementById('pLeftOff').getBoundingClientRect().height>=44"))
    g.locator('label[for=pLeftOff]').evaluate("e=>e.scrollIntoView({block:'center'})"); g.wait_for_timeout(200); g.screenshot(path=f'{SHOTS}/where-i-left-off-mobile.png'); c.close()
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
