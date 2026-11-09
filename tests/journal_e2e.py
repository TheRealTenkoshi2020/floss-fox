#!/usr/bin/env python3
"""Phase 1 event journal in the real page: additive key, real save/undo/import/undo-import paths, old backups.
Results are simulated (headless Chrome, synthetic data). Usage: FF_KEY=flossfox-dev.v1 python tests/journal_e2e.py http://localhost:8765/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # skip the fresh-session landing
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; JK = PFX + '.journal.v1'; SN = PFX + '.snapshots.v1'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def proj(pid, name, codes): return {'id': pid, 'name': name, 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [{'code': c, 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None} for c in codes], 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}
P1 = proj('p1', 'Journal fixture', ['310', '321']); P1['decisions'] = {'321': {'status': 'have'}}
SEED = json.dumps({'schema': 2, 'projects': [P1]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}}})
INIT = """(([K,TK,S,T,P])=>{if(!localStorage.getItem('ff.j.seeded')){localStorage.setItem(K,S);localStorage.setItem(TK,T);localStorage.setItem('ff.j.seeded','1')}
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off')}})"""
def ls(g, k): return g.evaluate(f"localStorage.getItem('{k}')")
def evs(g): return json.loads(ls(g, JK) or '{"events":[]}')['events']
def ready(g): g.wait_for_function('window.FlossFoxJournal&&window.FlossFoxThreadsUI'); g.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block', accept_downloads=True)
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, SEED, THR, PFX])})")
    g = c.new_page(); g.set_default_timeout(8000); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw'); ready(g)
    ok('LOAD-1 journal has its own key and a baseline, no events', ls(g, JK) is not None and evs(g) == [])
    ok('LOAD-2 opening the app did not rewrite user data', ls(g, KEY) == SEED and ls(g, TK) == THR)
    g.evaluate("FlossFoxThreadsUI.addFromProjects()"); g.wait_for_timeout(100)
    e = evs(g); ok('INV-1 adding a color logs one inventory event', len(e) == 1 and e[0]['k'] == 'inventory' and e[0]['ref'] == {'code': '321'}, e)
    g.evaluate("FlossFoxThreadsUI.undoFromProjects()"); g.wait_for_timeout(100)
    ok('UNDO-1 Undo removes the matching event (no phantom history)', evs(g) == [], evs(g))
    g.evaluate("FlossFoxProjects.openProject('p1')"); g.wait_for_selector('#pStatus', state='attached')
    g.evaluate("(()=>{const s=document.getElementById('pStatus');s.value='done';s.dispatchEvent(new Event('change',{bubbles:true}));s.dispatchEvent(new Event('input',{bubbles:true}))})()"); g.wait_for_timeout(150)
    e = evs(g); ok('PROJ-1 marking Completed logs a project event', any(x['k'] == 'project' and x['to'] == 'done' and x['ref'] == {'pid': 'p1'} for x in e), e)
    ok('PROJ-2 project data saved normally', json.loads(ls(g, KEY))['projects'][0]['status'] == 'done')
    bk = g.evaluate("FlossFoxProjects.fullBackup()")
    ok('BK-1 backup carries an optional journal array', isinstance(bk.get('journal'), list) and len(bk['journal']) == len(evs(g)))
    ok('BK-2 backup revision ignores the journal (reminder logic unchanged)', g.evaluate("(b=>{const x=JSON.parse(JSON.stringify(b));delete x.journal;return FlossFoxBackupCore.revision(b)===FlossFoxBackupCore.revision(x)})", bk))
    n_before = len(evs(g))
    def restore(obj, mode):
        g.evaluate("([t])=>FlossFoxProjects.restoreFile(new File([t],'b.json',{type:'application/json'}))", [json.dumps(obj)])
        g.wait_for_function("(()=>{const b=document.getElementById('rGo');return b&&!b.dataset.used})()")
        g.evaluate("(m)=>{document.querySelector('input[name=imode][value='+m+']').checked=true;const b=document.getElementById('rGo');b.dataset.used='1';b.click()}", mode); g.wait_for_timeout(300)
    restore(bk, 'merge')
    ok('IMP-1 importing a backup of this same data adds no duplicate events', len(evs(g)) == n_before, (n_before, len(evs(g))))
    other = dict(bk); other['threads'] = {'schema': 2, 'threads': {'310': {'n': 5, 'partial': False, 'restock': True, 'confirmed': True, 'updated': '2026-10-02T00:00:00Z'}, '666': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-02T00:00:00Z'}}}
    other['journal'] = bk['journal'] + [{'id': 'eimp-1', 't': '2026-10-02T00:00:00Z', 'k': 'inventory', 'ref': {'code': '666'}, 'from': None, 'to': {'n': 1, 'partial': False}}]
    restore(other, 'replace')
    e = evs(g)
    ok('IMP-2 replace import re-bases silently (only the backup\'s own new event is added)', len(e) == n_before + 1 and sum(1 for x in e if x['id'] == 'eimp-1') == 1, e)
    restore(other, 'replace')
    ok('IMP-3 importing the same backup again adds nothing', len(evs(g)) == n_before + 1)
    old = {k: v for k, v in bk.items() if k != 'journal'}
    restore(old, 'merge')
    ok('OLD-1 an older backup without a journal imports fine', len(evs(g)) == n_before + 1 and g.evaluate("document.body.textContent.includes('Restore checked and saved')"))
    old_proj = {'app': 'floss-fox', 'schema': 2, 'projects': [proj('p9', 'Old projects-only', ['550'])]}
    restore(old_proj, 'merge')
    ok('OLD-2 an old projects-only backup imports and adds no events', len(evs(g)) == n_before + 1 and any(x['id'] == 'p9' for x in json.loads(ls(g, KEY))['projects']))
    # Undo last import: back to a state seen earlier -> history recorded after it is dropped, and the imported event too
    g.goto(B + '?nosw#projects'); ready(g)
    g.evaluate("(()=>{const b=document.getElementById('undoImportBtn');if(b)b.click()})()"); g.wait_for_timeout(800); ready(g)
    e = evs(g); ok('UNDO-IMP-1 Undo last import restores data and adds no events', not any(x['id'] == 'p9' for x in json.loads(ls(g, KEY))['projects']) and len(e) == n_before + 1, e)
    # failure tolerance: a broken journal never blocks a save
    g.evaluate(f"localStorage.setItem('{JK}','{{broken')"); g.evaluate("FlossFoxThreadsUI.addFromProjects()"); g.wait_for_timeout(100)
    ok('ROBUST-1 a corrupt journal does not break saving', '"321"' in (ls(g, TK) or ''))
    g.evaluate(f"(()=>{{const real=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){{if(k==='{JK}')throw new Error('quota');return real.call(this,k,v)}};window.__restore=()=>Storage.prototype.setItem=real}})()")
    g.evaluate("FlossFoxThreadsUI.undoFromProjects()"); g.wait_for_timeout(100); g.evaluate("(()=>{window.__restore()})()")
    ok('ROBUST-2 a journal write failure does not affect the save', '"321"' not in (ls(g, TK) or ''))
    ok('KEYS-1 no snapshot was taken or altered by journaling alone', all(json.dumps(s['keys']).find('journal.v1') < 0 for s in json.loads(ls(g, SN) or '[]')))
    ok('ERR-1 no page errors', not errs, errs)
    br.close()
print(f"journal_e2e: {R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
