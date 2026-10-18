"""Backup v1 (production ed2cd1b, thread schema 1) -> dev v2 forward restore.
Usage: python3 tests/backup_forward_e2e.py PROD_URL DEV_URL   (both served locally; production is only read)."""
import sys, json
from playwright.sync_api import sync_playwright
PROD, DEV = sys.argv[1], sys.argv[2]
R = []
def ok(n, c, d=''):
    R.append(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {d}'))
TOUR = "for(const k of ['flossfox','flossfox-dev']){localStorage.setItem(k+'.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem(k+'.hints.v1','off')}"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def ctx():
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, accept_downloads=True); c.add_init_script(TOUR)
        g = c.new_page(); g.on('dialog', lambda d: d.accept()); return g
    # 1. make a real v1 backup on the production build
    g = ctx(); g.goto(PROD)
    g.evaluate("localStorage.setItem('flossfox.threads.v1', JSON.stringify({schema:1,threads:{'310':{n:3,partial:false,restock:false,updated:'2026-10-01T00:00:00Z'},'321':{n:0,partial:true,restock:true,updated:'2026-10-01T00:00:00Z'}}}))")
    g.reload(); g.fill('#inp', '310 x2\n321 x1\n415'); g.click('#go'); g.fill('#newProjName', 'Prod v1 project'); g.click('#saveProj')
    g.click('#openSaved'); g.check('#st-310-have'); g.check('#st-321-buy')
    g.click('#pClose'); g.click('#backupBox summary')
    with g.expect_download() as d: g.click('#backupBtn')
    v1 = json.load(open(d.value.path(), encoding='utf-8'))
    ok('production backup is version 1 with thread schema 1', v1.get('version') == 1 and v1['threads']['schema'] == 1, (v1.get('version'), v1.get('threads', {}).get('schema')))
    # 2. restore into the dev (v2) build
    h = ctx(); h.goto(DEV); h.click('#tabProjects'); h.click('#backupBox summary')
    h.set_input_files('#restoreFile', {'name': 'v1.json', 'mimeType': 'application/json', 'buffer': json.dumps(v1).encode()}); h.wait_for_timeout(200)
    ok('dev offers the v1 backup for restore (no error)', h.locator('#rGo').is_visible() and 'newer version' not in h.inner_text('#restorePanel'), h.inner_text('#restorePanel')[:300])
    h.click('#rGo'); h.wait_for_timeout(300)
    if h.locator('#ffConfirm:not([hidden])').count(): h.click('#ffConfirmGo'); h.wait_for_timeout(200)
    st = h.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.v1'))"); th = h.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.threads.v1'))")
    pr = (st or {}).get('projects', [])
    ok('project restored with name, items and decisions', len(pr) == 1 and pr[0]['name'] == 'Prod v1 project' and pr[0]['decisions']['310']['status'] == 'have' and pr[0]['decisions']['321']['status'] == 'buy' and len(pr[0]['items']) == 3, pr)
    ok('threads migrated to schema 2, counts/partial/restock kept', th and th.get('schema') == 2 and th['threads']['310']['n'] == 3 and th['threads']['321']['partial'] is True and th['threads']['321']['restock'] is True, th)
    ok('production keys untouched by the dev build', h.evaluate("localStorage.getItem('flossfox.v1')") is None)
    # 3. re-backup on dev is v2, and restoring v2 round-trips
    h.reload(); h.click('#tabProjects'); h.click('#backupBox summary')
    with h.expect_download() as d2: h.click('#backupBtn')
    v2 = json.load(open(d2.value.path(), encoding='utf-8'))
    ok('dev backup is version 2 / thread schema 2', v2.get('version') == 2 and v2['threads']['schema'] == 2, (v2.get('version'), v2['threads'].get('schema')))
    k = ctx(); k.goto(DEV); k.click('#tabProjects'); k.click('#backupBox summary')
    k.set_input_files('#restoreFile', {'name': 'v2.json', 'mimeType': 'application/json', 'buffer': json.dumps(v2).encode()}); k.wait_for_timeout(200); k.click('#rGo'); k.wait_for_timeout(300)
    if k.locator('#ffConfirm:not([hidden])').count(): k.click('#ffConfirmGo'); k.wait_for_timeout(200)
    st2 = k.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.v1'))"); th2 = k.evaluate("JSON.parse(localStorage.getItem('flossfox-dev.threads.v1'))")
    strip = lambda ps: [{x: y for x, y in q.items() if x not in ('updated', 'created')} for q in ps]
    ok('v2 restore round-trips projects and threads', strip(st2['projects']) == strip(pr) and th2['threads'] == th['threads'], (st2, th2))
    # 4. v2 backup refused by production (one-way upgrade, by design)
    q = ctx(); q.goto(PROD); q.click('#tabProjects'); q.click('#backupBox summary')
    q.set_input_files('#restoreFile', {'name': 'v2.json', 'mimeType': 'application/json', 'buffer': json.dumps(v2).encode()}); q.wait_for_timeout(200)
    ok('production refuses the v2 backup and changes nothing (expected one-way upgrade)', 'newer version' in q.inner_text('#restorePanel') and q.evaluate("localStorage.getItem('flossfox.v1')") in (None, 'null') or 'Nothing was changed' in q.inner_text('#restorePanel'), q.inner_text('#restorePanel')[:200])
print(f'{sum(R)} passed, {len(R)-sum(R)} failed'); sys.exit(0 if all(R) else 1)
