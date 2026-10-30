#!/usr/bin/env python3
"""Phase 0 quick win: storage.persist + automatic local snapshots + Restore. Results are simulated (headless Chrome, synthetic data).
Usage: FF_KEY=flossfox-dev.v1 python tests/snapshots_e2e.py http://localhost:8765/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; SN = PFX + '.snapshots.v1'; MK = PFX + '.snapmeta.v1'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def proj(pid, name): return {'id': pid, 'name': name, 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [{'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['DMC 310 x2'], 'stitchCount': None}], 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}
SEED = json.dumps({'schema': 2, 'projects': [proj('p1', 'Snapshot fixture')]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}}})
INIT = """(([K,TK,S,T,P,mode])=>{if(!localStorage.getItem('ff.snap.seeded')){localStorage.setItem(K,S);localStorage.setItem(TK,T);localStorage.setItem('ff.snap.seeded','1')}
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off')}
window.__persistCalls=0;if(mode==='none'){try{Object.defineProperty(navigator,'storage',{value:undefined,configurable:true})}catch(e){}}
else if(navigator.storage){navigator.storage.persisted=async()=>false;navigator.storage.persist=async()=>{window.__persistCalls++;if(mode==='throw')throw new Error('nope');return true}}})"""
def ls(g, k): return g.evaluate(f"localStorage.getItem('{k}')")
def snaps(g): return json.loads(ls(g, SN) or '[]')
def ctx_page(br, mode='ok', w=390):
    c = br.new_context(viewport={'width': w, 'height': 844}, service_workers='block')
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, SEED, THR, PFX, mode])})")
    g = c.new_page(); g.set_default_timeout(6000); g.on('pageerror', lambda e: errs.append(str(e)))
    g.goto(B + '?nosw'); g.wait_for_function('window.FlossFoxSnapshots'); g.wait_for_timeout(300); return c, g
def age_all(g):  # make existing snapshots look older than the throttle window
    g.evaluate(f"(()=>{{const a=JSON.parse(localStorage.getItem('{SN}'));a.forEach((s,i)=>s.at=new Date(Date.now()-864e5*(i+1)).toISOString());localStorage.setItem('{SN}',JSON.stringify(a))}})()")
def edit_and_reload(g, name):
    g.evaluate(f"(()=>{{const d=JSON.parse(localStorage.getItem('{KEY}'));d.projects[0].name={json.dumps(name)};localStorage.setItem('{KEY}',JSON.stringify(d))}})()")
    age_all(g); g.reload(); g.wait_for_function('window.FlossFoxSnapshots'); g.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c, g = ctx_page(br)
    real0 = (ls(g, KEY), ls(g, TK))
    ok('PERSIST-1 persist() called once when user has data', g.evaluate('window.__persistCalls') == 1)
    ok('PERSIST-2 result recorded quietly in meta', json.loads(ls(g, MK) or '{}').get('persist') == 'granted')
    a = snaps(g)
    ok('SNAP-1 first open makes one snapshot', len(a) == 1 and a[0]['reason'] == 'open' and a[0]['counts'] == {'projects': 1, 'colors': 1}, a and a[0].get('counts'))
    ok('SNAP-1 snapshot did not alter real data', (ls(g, KEY), ls(g, TK)) == real0)
    g.reload(); g.wait_for_function('window.FlossFoxSnapshots'); g.wait_for_timeout(200)
    ok('SNAP-2 unchanged data on reload makes no new snapshot', len(snaps(g)) == 1)
    g.evaluate(f"(()=>{{const d=JSON.parse(localStorage.getItem('{KEY}'));d.projects[0].name='Throttled';localStorage.setItem('{KEY}',JSON.stringify(d))}})()"); g.reload(); g.wait_for_function('window.FlossFoxSnapshots')
    ok('SNAP-3 changed data makes a new copy on the next open', len(snaps(g)) == 2 and snaps(g)[0]['reason'] == 'open')
    for n in ('Version B', 'Version C', 'Version D', 'Version E'): edit_and_reload(g, n)
    names = [json.loads(s['keys'][KEY])['projects'][0]['name'] for s in snaps(g)]
    ok('ROT-1 rotation keeps only 3, newest first', names == ['Version E', 'Version D', 'Version C'], names)
    # Quota: make setItem on the snapshot key throw; saving real data must still work
    g.evaluate(f"(()=>{{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){{if(k==='{SN}')throw new DOMException('full','QuotaExceededError');return o.call(this,k,v)}}}})()")
    before = ls(g, SN)
    r = g.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('%s'));d.projects[0].name='Quota';localStorage.setItem('%s',JSON.stringify(d));return FlossFoxSnapshots.take('open',{force:true})})()" % (KEY, KEY))
    ok('QUOTA-1 quota error caught, reported as skipped', r.get('ok') is False and r.get('skipped') == 'quota', r)
    ok('QUOTA-2 old snapshots untouched and real data saved', ls(g, SN) == before and json.loads(ls(g, KEY))['projects'][0]['name'] == 'Quota')
    ok('QUOTA-3 app save still works', g.evaluate("FlossFoxProjects.add({id:'q2',name:'After quota',items:[],decisions:{},purchased:{},buyBrand:'dmc',status:'planning',notes:'',created:'2026-10-01T00:00:00Z',updated:'2026-10-01T00:00:00Z'})") is not None and 'After quota' in ls(g, KEY))
    g.reload(); g.wait_for_function('window.FlossFoxSnapshots'); g.wait_for_timeout(200)
    # Restore with confirm: cancel first
    g.click('#tabSettings'); g.wait_for_selector('#snapBox button[data-snap]')
    box = g.inner_text('#snapBox')
    ok('COPY-1 Pixel heading, body and footer shown exactly', 'Automatic copies on this device' in box and "We keep up to 3 recent copies of your projects and thread collection in this browser. We save one when you open the app after changes, and before an import or restore. These copies are deleted if you clear this site's data, so keep saving backup files too." in box and 'Your browser may clear Floss Fox data if space runs low. A backup file you save keeps a copy outside the browser.' in box)
    al = g.get_attribute('#snapBox button[data-snap="0"]', 'aria-label') or ''
    ok('COPY-2 Restore button aria-label is "Restore the copy from {date}"', al.startswith('Restore the copy from ') and len(al) > 22, al)
    import re as _re
    ok('COPY-3 timestamps show no seconds', not _re.search(r'\d:\d\d:\d\d', box + al), box[:200])
    ok('UI-1 Restore list shows 3 copies with counts', g.locator('#snapBox li').count() == 3 and 'project' in g.inner_text('#snapBox li >> nth=0'))
    cur = ls(g, KEY)
    g.once('dialog', lambda d: d.dismiss()); g.click('#snapBox button[data-snap="2"]'); g.wait_for_timeout(300)
    ok('RESTORE-1 cancel at confirm changes nothing', ls(g, KEY) == cur and len(snaps(g)) == 3)
    target = json.loads(snaps(g)[2]['keys'][KEY])['projects'][0]['name']
    g.once('dialog', lambda d: d.accept())
    with g.expect_navigation(): g.click('#snapBox button[data-snap="2"]')
    g.wait_for_function('window.FlossFoxSnapshots'); g.wait_for_timeout(200)
    now = json.loads(ls(g, KEY))['projects']
    ok('RESTORE-2 confirmed restore brings back the chosen copy', now[0]['name'] == target and len(now) == 1, [x['name'] for x in now])
    a = snaps(g)
    ok('RESTORE-3 pre-restore copy saved first (undoable)', a[0]['reason'] == 'restore' and 'After quota' in a[0]['keys'][KEY])
    g.once('dialog', lambda d: d.accept())
    with g.expect_navigation(): g.click('#snapBox button[data-snap="0"]')
    g.wait_for_function('window.FlossFoxSnapshots')
    ok('RESTORE-4 undo: restoring the safety copy returns the pre-restore data', 'After quota' in ls(g, KEY))
    # Import makes a snapshot
    data = g.evaluate('JSON.stringify(FlossFoxProjects.fullBackup())'); n0 = len(snaps(g))
    d = json.loads(data); d['projects'][0]['name'] = 'Imported'
    g.evaluate(f"(()=>{{const d=JSON.parse(localStorage.getItem('{KEY}'));d.projects.push({json.dumps(proj('p9','Unsaved before import'))});localStorage.setItem('{KEY}',JSON.stringify(d))}})()")
    g.reload(); g.wait_for_function('window.FlossFoxSnapshots')
    g.click('#tabSettings'); g.set_input_files('#restoreFile', files=[{'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(d).encode()}]); g.wait_for_selector('#rGo')
    g.on('dialog', lambda d: d.accept()); g.check('input[name=imode][value=replace]'); g.click('#rGo'); g.wait_for_timeout(500)
    a = snaps(g)
    ok('IMPORT-1 import makes a snapshot of pre-import data', a[0]['reason'] == 'import' and 'Unsaved before import' in a[0]['keys'][KEY], a[0]['reason'])
    ok('IMPORT-2 import still applied', 'Imported' in ls(g, KEY))
    c.close()
    # Feature-detect: no navigator.storage, and persist() rejecting
    for mode in ('none', 'throw'):
        c, g = ctx_page(br, mode)
        ok(f'PERSIST-3 [{mode}] app loads without errors and still snapshots', len(snaps(g)) == 1 and g.locator('#tabSettings').is_visible())
        c.close()
    # Empty data: no snapshot, no persist request
    c = br.new_context(service_workers='block'); g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e)))
    g.add_init_script("window.__persistCalls=0;if(navigator.storage)navigator.storage.persist=async()=>{window.__persistCalls++;return true}")
    g.goto(B + '?nosw'); g.wait_for_function('window.FlossFoxSnapshots'); g.wait_for_timeout(300)
    ok('EMPTY-1 new user: no snapshot and no persist request', ls(g, SN) is None and g.evaluate('window.__persistCalls') == 0)
    c.close(); br.close()
ok('no page errors', not errs, errs)
print(f"\nsnapshots_e2e (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
