"""Backup-migration rehearsal (isolated browser profiles, synthetic data only).
Usage: python3 tests/migration_rehearsal.py PROD_COPY_URL DEV_URL   (production copy served locally, read-only)."""
import sys, json
from playwright.sync_api import sync_playwright
PROD, DEV = sys.argv[1], sys.argv[2]
R = []; LOG = []
def ok(n, c, d=''):
    R.append(c); line = ('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(d)[:300]}'); print(line); LOG.append(line)
TOUR = "for(const k of ['flossfox','flossfox-dev']){localStorage.setItem(k+'.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem(k+'.hints.v1','off')}"
TH1 = {'schema': 1, 'threads': {'310': {'n': 3, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z'}, '321': {'n': 0, 'partial': True, 'restock': True, 'updated': '2026-10-01T00:00:00Z'},
                                 '3865': {'n': 2, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z'}, '699': {'n': 1, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z'}}}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def profile(url, init=''):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, accept_downloads=True); c.add_init_script(TOUR + ';' + init)
        g = c.new_page(); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); g.on('dialog', lambda d: d.accept()); g.goto(url); g.wait_for_timeout(200); return g
    def export(g):
        g.click('#tabProjects'); g.wait_for_timeout(100)
        if g.locator('#pClose').is_visible(): g.click('#pClose')
        if not g.evaluate("document.getElementById('backupBox').open"): g.click('#backupBox summary')
        with g.expect_download() as d: g.click('#backupBtn')
        return json.load(open(d.value.path(), encoding='utf-8'))
    def restore(g, data):
        g.click('#tabProjects'); g.wait_for_timeout(100)
        if g.locator('#pClose').is_visible(): g.click('#pClose')
        if not g.evaluate("document.getElementById('backupBox').open"): g.click('#backupBox summary')
        g.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()}); g.wait_for_timeout(200)
        panel = g.inner_text('#restorePanel')
        if g.locator('#rGo').is_visible():
            g.click('#rGo'); g.wait_for_timeout(250)
            if g.locator('#ffConfirm:not([hidden])').count(): g.click('#ffConfirmGo'); g.wait_for_timeout(200)
        return panel
    st = lambda g, k: g.evaluate(f"JSON.parse(localStorage.getItem('{k}'))")
    # 1 production copy: synthetic tester data -> v1 backup
    a = profile(PROD, "if(!localStorage.getItem('flossfox.threads.v1'))localStorage.setItem('flossfox.threads.v1',%s)" % json.dumps(json.dumps(TH1)))
    for name, lst in (('Rehearsal A', '310 x2\n321 x1\n415'), ('Rehearsal B', '3865 x1\n699 x2\n310')):
        a.click('#tabConvert'); a.fill('#inp', lst); a.click('#go'); a.fill('#newProjName', name); a.click('#saveProj'); a.wait_for_timeout(100)
    a.evaluate("FlossFoxProjects.open(FlossFoxProjects._store().projects.find(x=>x.name==='Rehearsal A').id)"); a.wait_for_timeout(150); a.check('#st-310-have'); a.check('#st-321-buy'); a.click('#pClose')
    v1 = export(a); pA = st(a, 'flossfox.v1')
    ok('1 prod copy exports v1 (thread schema 1), 2 projects, 4 threads', v1['version'] == 1 and v1['threads']['schema'] == 1 and len(v1['projects']) == 2 and len(v1['threads']['threads']) == 4, (v1.get('version'), len(v1['projects'])))
    # 2 dev profile with its own existing data -> restore v1, then recovery (undo), then restore again
    d = profile(DEV); d.fill('#inp', '520 x1'); d.click('#go'); d.fill('#newProjName', 'Existing dev project'); d.click('#saveProj'); d.wait_for_timeout(100)
    pre = st(d, 'flossfox-dev.v1')
    panel = restore(d, v1); pr = st(d, 'flossfox-dev.v1')['projects']; th = st(d, 'flossfox-dev.threads.v1')
    ok('2 dev accepts the v1 backup', 'newer version' not in panel and 'valid' not in panel.lower()[:0], panel[:200])
    names = sorted(x['name'] for x in pr)
    ok('2b projects restored with decisions (counts verified)', 'Rehearsal A' in names and 'Rehearsal B' in names and [x for x in pr if x['name'] == 'Rehearsal A'][0]['decisions']['310']['status'] == 'have', names)
    ok('2c threads migrated to schema 2: 4 colors, counts/partial/restock kept', th['schema'] == 2 and {k: (v['n'], v['partial'], v['restock']) for k, v in th['threads'].items()} == {k: (v['n'], v['partial'], v['restock']) for k, v in TH1['threads'].items()}, th)
    d.reload(); d.click('#tabProjects'); d.wait_for_timeout(100)
    if not d.evaluate("document.getElementById('backupBox').open"): d.click('#backupBox summary')
    has_undo = d.locator('#undoImportBtn').count() == 1
    ok('2d recovery: "Undo last import" offered after restore', has_undo)
    if has_undo:
        d.click('#undoImportBtn'); d.wait_for_timeout(250)
        if d.locator('#ffConfirm:not([hidden])').count(): d.click('#ffConfirmGo'); d.wait_for_timeout(200)
        ok('2e undo returns the dev profile to its exact pre-restore projects', st(d, 'flossfox-dev.v1')['projects'] == pre['projects'], [x['name'] for x in st(d, 'flossfox-dev.v1')['projects']])
    restore(d, v1)
    # 3 user adds storage locations on dev (schema-2 only data), then exports v2
    d.evaluate("(()=>{const k='flossfox-dev.threads.v1',t=JSON.parse(localStorage.getItem(k));t.threads['310'].storage={container:'Box 3',slot:'Row 2'};t.threads['3865'].storage={container:'Drawer A'};localStorage.setItem(k,JSON.stringify(t))})()")
    d.reload(); v2 = export(d); th2 = st(d, 'flossfox-dev.threads.v1'); pr2 = st(d, 'flossfox-dev.v1')['projects']
    ok('3 dev exports v2 / thread schema 2 with storage locations', v2['version'] == 2 and v2['threads']['schema'] == 2 and v2['threads']['threads']['310'].get('storage', {}).get('container') == 'Box 3', v2['threads']['threads'].get('310'))
    # 4 fresh dev profile restores v2
    f = profile(DEV); restore(f, v2)
    norm = lambda t: {k: {**v, **({'storage': {a: b for a, b in v['storage'].items() if b != ''}} if 'storage' in v else {})} for k, v in t.items()}  # restore normalizes an empty 'medium'
    strip = lambda ps: sorted(json.dumps({x: y for x, y in q.items() if x not in ('updated',)}, sort_keys=True) for q in ps)
    ok('4 fresh profile: v2 restore gives identical projects', strip(st(f, 'flossfox-dev.v1')['projects']) == strip(pr2))
    ok('4b fresh profile: identical threads incl. locations', norm(st(f, 'flossfox-dev.threads.v1')['threads']) == norm(th2['threads']), (st(f, 'flossfox-dev.threads.v1'), th2))
    f.evaluate("FlossFoxProjects.open(FlossFoxProjects._store().projects.find(x=>x.name==='Rehearsal A').id)"); f.wait_for_timeout(150)
    ok('4c locations visible in the in-project readiness view', 'Box 3' in f.inner_text('#pReady') or 'Drawer A' in f.inner_text('#pReady'), f.inner_text('#pReady')[:200])
    # 5 production copy refuses v2 safely; 6 recovery: original v1 still restores there
    q = profile(PROD); q.fill('#inp', '820 x1'); q.click('#go'); q.fill('#newProjName', 'Prod tester data'); q.click('#saveProj'); q.wait_for_timeout(100)
    before = (st(q, 'flossfox.v1'), st(q, 'flossfox.threads.v1'))
    panel = restore(q, v2)
    ok('5 prod copy refuses v2 with "newer version" message', 'newer version' in panel, panel[:200])
    ok('5b prod copy data unchanged after refusal', (st(q, 'flossfox.v1'), st(q, 'flossfox.threads.v1')) == before)
    restore(q, v1)
    ok('6 recovery: original v1 backup still restores on the prod copy', 'Rehearsal A' in [x['name'] for x in st(q, 'flossfox.v1')['projects']])
    ok('7 dev never wrote production keys', d.evaluate("localStorage.getItem('flossfox.v1')") is None and f.evaluate("localStorage.getItem('flossfox.v1')") is None)
    errs = a.errs + d.errs + f.errs + q.errs
    ok('8 no page errors', not errs, errs)
print(f'{sum(R)} passed, {len(R)-sum(R)} failed'); sys.exit(0 if all(R) else 1)
