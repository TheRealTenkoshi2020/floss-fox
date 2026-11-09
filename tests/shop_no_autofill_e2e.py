#!/usr/bin/env python3
"""Shop and opening a project NEVER fill colors on their own (any created date); only an explicit
"Use my collection" tap fills blank colors, never user choices, and Undo restores exact decisions.
Results are simulated (headless Chrome, synthetic data). Usage: FF_KEY=flossfox-dev.v1 python tests/shop_no_autofill_e2e.py http://localhost:8765/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.allocations.v1'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
DATES = ['2026-10-01T00:00:00.000Z', '2026-10-30T13:04:00.000Z', '2026-10-30T13:05:00.000Z', '2026-10-30T13:30:00.000Z', '2026-10-30T14:29:00.000Z', '2026-10-30T14:30:00.000Z', '2026-11-01T00:00:00.000Z', '2026-11-08T12:00:00.000Z', 'NOW']
CODES = ['310', '321', '699']
BLANK = {'status': None, 'owned': None}
MIXED = {'310': {'status': 'buy', 'owned': None}, '321': {'status': 'have', 'owned': 3, 'ownedSource': 'user', 'ownedPartial': True}, '699': dict(BLANK)}
def proj(pid, created, dec, demo=False):
    p = {'id': pid, 'name': pid, 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [{'code': c, 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None} for c in CODES],
         'decisions': {c: dict(dec.get(c, BLANK)) for c in CODES}, 'purchased': {}, 'created': created, 'updated': created}
    if demo: p['demo'] = True
    return p
PROJS = [proj(f'd{i}_{v}', d, {} if v == 'blank' else MIXED) for i, d in enumerate(DATES) for v in ('blank', 'mixed')] + [proj('demo_now', 'NOW', {}, demo=True)]
def th(n, part=False): return {'n': n, 'partial': part, 'restock': False, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}
INV = {'partial': {'schema': 2, 'threads': {'310': th(2), '321': th(1, True)}}, 'empty': {'schema': 2, 'threads': {}},
       'setaside': {'schema': 2, 'threads': {'310': th(2), '321': th(1)}}}
ALLOC = {'schema': 1, 'allocations': [{'projectId': 'd0_blank', 'code': '310', 'qty': 2}]}
INIT = """(([K,TK,AK,PJ,T,A,P])=>{if(sessionStorage.getItem('sn.seeded'))return;const now=new Date().toISOString();
localStorage.clear();localStorage.setItem(K,JSON.stringify({schema:2,projects:PJ.map(p=>Object.assign(p,p.created==='NOW'?{created:now,updated:now}:{}))}));localStorage.setItem(TK,JSON.stringify(T));if(A)localStorage.setItem(AK,JSON.stringify(A));
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off')}sessionStorage.setItem('sn.seeded','1')})"""
SNAP = f"JSON.stringify([localStorage.getItem('{KEY}'),localStorage.getItem('{TK}'),localStorage.getItem('{AK}')])"
def ready(g): g.wait_for_function('window.FlossFoxProjects&&window.FlossFoxThreadsUI'); g.wait_for_timeout(300)
def decs(g, pid): return next(p for p in json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects'] if p['id'] == pid)['decisions']
def mem(g, pid): return g.evaluate("id=>JSON.parse(JSON.stringify(FlossFoxProjects._store().projects.find(p=>p.id===id).decisions))", pid)
def ctx(br, inv):
    c = br.new_context(viewport={'width': 1200, 'height': 900}, service_workers='block')
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, AK, PROJS, INV[inv], ALLOC if inv == 'setaside' else None, PFX])})")
    g = c.new_page(); g.set_default_timeout(8000); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw#projects'); ready(g); return c, g
ids = [p['id'] for p in PROJS]
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for inv in INV:
        c, g = ctx(br, inv); s0 = g.evaluate(SNAP)
        for pid in ids: g.evaluate(f"FlossFoxProjects.openProject('{pid}')"); g.wait_for_timeout(60)
        ok(f'{inv}: OPEN-1 opening all {len(ids)} projects (every date, blank+mixed, demo) writes nothing', g.evaluate(SNAP) == s0)
        g.evaluate("document.getElementById('tabShop').click()"); g.wait_for_timeout(300)
        ok(f'{inv}: SHOP-1 Shop tab visit writes nothing', g.evaluate(SNAP) == s0)
        for pid in ids: g.evaluate("id=>{const s=document.getElementById('shopPick');if(s&&[...s.options].some(o=>o.value===id)){s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}))}}", pid); g.wait_for_timeout(60)
        ok(f'{inv}: SHOP-2 Shop picker on every project writes nothing', g.evaluate(SNAP) == s0)
        for t in ['tabSettings', 'tabHelp', 'tabThreads', 'tabConvert', 'tabProjects']: g.evaluate(f"document.getElementById('{t}').click()"); g.wait_for_timeout(80)
        g.reload(); ready(g)
        for pid in ids[-5:]: g.evaluate(f"FlossFoxProjects.openProject('{pid}')"); g.wait_for_timeout(60)
        g.evaluate("document.getElementById('tabShop').click()"); g.wait_for_timeout(300)
        ok(f'{inv}: RELOAD-1 other tabs, reload, open again and Shop again: still nothing written', g.evaluate(SNAP) == s0)
        ok(f'{inv}: PIP-1 no automatic "done" message', g.locator('#pAuto [data-msg*="cmp.done"]').count() == 0)
        if inv != 'empty':
            for pid in ['d8_blank', 'd8_mixed', 'd0_mixed']:
                g.evaluate("document.getElementById('tabProjects').click()"); g.evaluate(f"FlossFoxProjects.openProject('{pid}')"); g.wait_for_timeout(200)
                before = mem(g, pid)  # the app's loaded (normalized) decisions, exactly as they would be saved
                has = g.locator('#pAutoApply').count() > 0 and g.is_visible('#pAutoApply')
                ok(f'{inv}/{pid}: OFFER-1 offer button shown', has)
                if not has: continue
                g.click('#pAutoApply'); g.wait_for_timeout(200); after = decs(g, pid)
                kept = all(after[c] == before[c] for c in CODES if before[c].get('status') is not None)
                filled = any(after[c].get('status') for c in CODES if before[c].get('status') is None)
                ok(f'{inv}/{pid}: TAP-1 explicit tap fills only blank colors, user choices kept exactly', kept and filled, (before, after))
                g.click('#pAutoUndo'); g.wait_for_timeout(200)
                ok(f'{inv}/{pid}: UNDO-1 Undo restores exact decisions (in app and in storage)', mem(g, pid) == before and decs(g, pid) == before, (decs(g, pid), before))
        c.close()
    # a project made today through the real UI: Find floss -> Save as project, then Shop / open / reload
    c, g = ctx(br, 'partial'); g.evaluate("document.getElementById('tabConvert').click()"); g.fill('#inp', '310\n321\n699'); g.click('#go'); g.wait_for_timeout(500)
    g.fill('#newProjName', 'Made today'); g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(600)
    s1 = g.evaluate(SNAP); new = [x for x in json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects'] if x['name'] == 'Made today']
    ok('UI-1 new project saved through the UI with undecided colors', len(new) == 1 and all(d.get('status') is None for d in new[0]['decisions'].values()), new)
    nid = new[0]['id']
    g.evaluate("document.getElementById('tabShop').click()"); g.wait_for_timeout(400); g.evaluate(f"FlossFoxProjects.openProject('{nid}')"); g.wait_for_timeout(300)
    g.reload(); ready(g); g.evaluate("document.getElementById('tabShop').click()"); g.wait_for_timeout(400)
    ok('UI-2 Shop, open and reload write nothing for a project made today', g.evaluate(SNAP) == s1)
    g.evaluate("document.getElementById('tabProjects').click()"); g.evaluate(f"FlossFoxProjects.openProject('{nid}')"); g.wait_for_timeout(200)
    ok('UI-3 offer shown for the new project', g.locator('#pAutoApply').count() == 1)
    c.close()
    ok('ERR-1 no page errors', not errs, errs[:3])
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
