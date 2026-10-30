#!/usr/bin/env python3
"""Unfinished-list recovery (DRAFT-1..8) + one-time first backup prompt (BACKUP-1/2) + offline + restore. Results are simulated (headless Chrome).
Usage: FF_KEY=flossfox-dev.v1 python tests/draft_backup_e2e.py http://localhost:8811/floss-fox-dev/"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; SK = PFX + '.scratch.v1'; FK = PFX + '.backup-first.v1'; TK = PFX + '.threads.v1'
U = B + '?nosw'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
LIST = '\n'.join(f'DMC {c} x{q}' for c, q in [('310', 2), ('321', 1), ('498', 3), ('699', 1), ('700', 2), ('742', 1), ('797', 1), ('3799', 2), ('B5200', 1), ('01', 1)])
BAD = 'DMC 310 x\n???? 12 skeins of\n  ecru,, 3865 (two)\n'
def ls(g, k): return g.evaluate(f"localStorage.getItem('{k}')")
def fresh(g, url=U):
    g.goto(url); g.wait_for_load_state('networkidle')
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (390, 1280):
        ctx = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 600, has_touch=w < 600)
        g = ctx.new_page(); g.set_default_timeout(6000); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        fresh(g)
        ok(f'{w}px INVITE-0 no card: first-visit invite shows as before', g.locator('#tourInvite').is_visible())
        ok(f'{w}px fresh: no recovery card, no draft key', g.locator('#ffDraftRecovery').is_hidden() and ls(g, SK) is None)
        # DRAFT-1
        g.evaluate("(()=>{const d=document.getElementById('dest');d.value='anchor';d.dispatchEvent(new Event('change',{bubbles:true}))})()"); g.fill('#inp', LIST); g.wait_for_timeout(900)
        d = json.loads(ls(g, SK) or 'null')
        ok(f'{w}px DRAFT-1 typing keeps the exact text and brand', d and d['text'] == LIST and d['brand'] == 'anchor', d)
        g.reload(); g.wait_for_load_state('networkidle')
        ok(f'{w}px DRAFT-1 after refresh: Restore/Discard offered, no project made', g.locator('#ffDraftRecovery').is_visible() and g.locator('#ffDraftRestore').is_visible() and g.locator('#ffDraftDiscard').is_visible() and json.loads(ls(g, KEY) or '{"projects":[]}')['projects'] == [])
        ok(f'{w}px INVITE-1 tour invite hidden while the recovery card shows', g.locator('#tourInvite').count() == 1 and g.locator('#tourInvite').is_hidden())
        ok(f'{w}px DRAFT-1 card says backups leave unfinished lists out', "backups don't include unfinished lists" in g.inner_text('#ffDraftRecovery'))
        g.click('#ffDraftRestore'); g.wait_for_timeout(200)
        ok(f'{w}px INVITE-2 invite returns once the card closes (restore)', g.locator('#tourInvite').is_visible())
        ok(f'{w}px DRAFT-1 restore brings back the same text and brand', g.input_value('#inp') == LIST and g.input_value('#dest') == 'anchor' and g.locator('#ffDraftRecovery').is_hidden())
        sw = g.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
        ok(f'{w}px no horizontal overflow', sw)
        # DRAFT-2 malformed verbatim
        g.fill('#inp', BAD); g.wait_for_timeout(900); g.reload(); g.wait_for_load_state('networkidle'); g.click('#ffDraftRestore'); g.wait_for_timeout(150)
        ok(f'{w}px DRAFT-2 malformed text restored verbatim', g.input_value('#inp') == BAD, repr(g.input_value('#inp')))
        # DRAFT-3 internal tabs keep DOM text; fabric.html and back offers draft
        g.fill('#inp', LIST); g.click('#tabThreads'); g.click('#tabConvert')
        ok(f'{w}px DRAFT-3 internal tab switch keeps the text', g.input_value('#inp') == LIST)
        g.click('#tabFabric'); g.wait_for_load_state('networkidle'); g.go_back(); g.wait_for_load_state('networkidle')
        if g.locator('#ffDraftRestore').is_visible(): g.click('#ffDraftRestore'); g.wait_for_timeout(150)
        ok(f'{w}px DRAFT-3 after fabric.html and back the list is there', g.input_value('#inp') == LIST)
        # DRAFT-6 example does not overwrite the real draft
        g.click('#sample'); g.wait_for_timeout(100); g.click('#tabConvert'); g.fill('#inp', g.input_value('#inp') + ' ')  # edit while example banner up
        g.wait_for_timeout(900)
        ok(f'{w}px DRAFT-6 example text never replaces the real draft', json.loads(ls(g, SK))['text'] == LIST)
        g.click('#exitExample'); g.wait_for_timeout(100)
        ok(f'{w}px DRAFT-6 leaving the example gives back my list', g.input_value('#inp') == LIST)
        # DRAFT-4 save real project -> draft cleared, no recreate on pagehide
        g.click('#go'); g.wait_for_timeout(150); g.click('#saveProj'); g.wait_for_timeout(300)
        ok(f'{w}px DRAFT-4 real tap on Save project clears the draft', ls(g, SK) is None and len(json.loads(ls(g, KEY))['projects']) == 1)
        g.reload(); g.wait_for_load_state('networkidle')
        ok(f'{w}px DRAFT-4 after refresh: project kept, no stale card, pagehide did not recreate', ls(g, SK) is None and g.locator('#ffDraftRecovery').is_hidden() and len(json.loads(ls(g, KEY))['projects']) == 1)
        # DRAFT-8 corrupt and newer schema left untouched
        for label, raw in (('corrupt', '{oops'), ('newer schema', json.dumps({'schema': 2, 'text': 'x', 'brand': 'dmc', 'updatedAt': 1}))):
            g.evaluate(f"localStorage.setItem('{SK}',{json.dumps(raw)})"); g.reload(); g.wait_for_load_state('networkidle')
            g.fill('#inp', '310'); g.wait_for_timeout(900)
            ok(f'{w}px DRAFT-8 {label}: explained, Restore disabled, bytes untouched while typing', g.locator('#ffDraftRecovery').is_visible() and g.locator('#ffDraftRestore').is_disabled() and ls(g, SK) == raw)
        g.click('#ffDraftDiscard'); g.click('#ffConfirmGo'); g.wait_for_timeout(200)
        ok(f'{w}px INVITE-3 invite returns once the card closes (discard)', g.locator('#tourInvite').is_visible())
        ok(f'{w}px DRAFT-8 Discard (confirmed) removes it and resumes keeping my typing', ls(g, SK) is not None and json.loads(ls(g, SK))['text'] == '310')
        # DRAFT-7 another tab writes a newer draft -> pause, no overwrite
        g2 = ctx.new_page(); fresh(g2); g2.evaluate("document.getElementById('ffDraftRecovery').hidden||document.getElementById('ffDraftDiscard')")
        g.fill('#inp', '310\n898'); g.wait_for_timeout(900)
        g2.evaluate(f"localStorage.setItem('{SK}',JSON.stringify({{schema:1,text:'OTHER TAB',brand:'dmc',updatedAt:Date.now()}}))"); g.wait_for_timeout(200)
        g.fill('#inp', '310\n898\n699'); g.wait_for_timeout(900); g.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        ok(f'{w}px DRAFT-7 newer draft from another tab not overwritten, conflict shown', json.loads(ls(g, SK))['text'] == 'OTHER TAB' and 'another tab' in g.inner_text('#ffDraftRecovery'))
        g2.close()
        # DRAFT-5 blocked storage: failed project save keeps draft, warns, no false claim
        g.evaluate("localStorage.clear()"); fresh(g); g.fill('#inp', LIST); g.wait_for_timeout(900)
        g.evaluate("(()=>{const o=Storage.prototype.setItem;window.__o=o;Storage.prototype.setItem=function(k,v){if(k.endsWith('.v1')&&!k.endsWith('.scratch.v1'))throw new DOMException('full','QuotaExceededError');return o.call(this,k,v)}})()")
        g.click('#go'); g.wait_for_timeout(150); g.click('#saveProj'); g.wait_for_timeout(300)
        ok(f'{w}px DRAFT-5 failed project save keeps the draft, no "saved" claim', ls(g, SK) is not None and json.loads(ls(g, SK))['text'] == LIST and g.locator('#copymsg .ffsaved').count() == 0)
        g.evaluate("(()=>{Storage.prototype.setItem=function(k,v){throw new DOMException('full','QuotaExceededError')};return 1})()")
        g.fill('#inp', LIST + '\n898'); g.wait_for_timeout(900)
        ok(f'{w}px DRAFT-5 draft write failing says so plainly', "couldn't keep your unfinished list" in g.inner_text('#ffDraftMsg'))
        g.evaluate("(()=>{Storage.prototype.setItem=window.__o;return 1})()")
        # BACKUP-1: demo threads -> no prompt; real thread -> once
        g.evaluate("localStorage.clear()"); fresh(g)
        g.evaluate("FlossFoxThreadsUI.addItems([{code:'310',qty:2}],{demo:true})"); g.wait_for_timeout(100)
        ok(f'{w}px BACKUP-1 demo-only threads: no prompt', g.locator('#bkFirst').is_hidden() and ls(g, FK) is None)
        g.evaluate(f"(()=>{{const d=JSON.parse(localStorage.getItem('{TK}'));d.threads['898']={{n:0,partial:false,restock:false,updated:''}};localStorage.setItem('{TK}',JSON.stringify(d));return 1}})()"); g.reload(); g.wait_for_load_state('networkidle'); g.evaluate("FlossFoxThreadsUI.set('898',{restock:true})"); g.wait_for_timeout(100)
        ok(f'{w}px BACKUP-1 zero-count row only: no prompt', g.locator('#bkFirst').is_hidden())
        g.evaluate("FlossFoxThreadsUI.addItems([{code:'310',qty:1}])"); g.wait_for_timeout(100)
        ok(f'{w}px BACKUP-1 first real thread: gentle prompt once', g.locator('#bkFirst').is_visible() and json.loads(ls(g, FK))['schema'] == 1 and 'live in this browser' in g.inner_text('#bkFirst'))
        ok(f'{w}px BACKUP-1 prompt fits the screen', g.evaluate("document.getElementById('bkFirst').getBoundingClientRect().right<=innerWidth+1"))
        # BACKUP-2: download start is not a confirmed backup
        with g.expect_download() as dl: g.click('#bkFirstExport')
        g.wait_for_timeout(200); st = json.loads(ls(g, PFX + '.backup-state.v1') or '{"lastConfirmedAt":null}')
        ok(f'{w}px BACKUP-2 download started is NOT recorded as saved; asks to confirm', st['lastConfirmedAt'] is None and g.locator('#bkConfirmSave').is_visible() and 'does not confirm' in g.inner_text('#bkFeedbackMsg'))
        bk = json.loads(open(dl.value.path()).read())
        ok(f'{w}px backup file holds my real thread, no demo, no draft', '310' in bk['threads']['threads'] and 'demo' not in bk['threads'] and 'scratch' not in json.dumps(bk))
        g.click('#bkConfirmSave'); g.wait_for_timeout(100)
        ok(f'{w}px BACKUP-2 only "I saved the file" records it', json.loads(ls(g, PFX + '.backup-state.v1'))['lastConfirmedAt'] is not None)
        g.evaluate("FlossFoxThreadsUI.addItems([{code:'321',qty:1}])"); g.reload(); g.wait_for_load_state('networkidle'); g.evaluate("FlossFoxThreadsUI.addItems([{code:'322',qty:1}])"); g.wait_for_timeout(100)
        ok(f'{w}px BACKUP-1 never shown again', g.locator('#bkFirst').is_hidden())
        g.evaluate(f"localStorage.clear();localStorage.setItem('{FK}','{{\"schema\":9}}')"); fresh(g); g.evaluate("FlossFoxThreadsUI.addItems([{code:'310',qty:1}])"); g.wait_for_timeout(100)
        ok(f'{w}px unknown flag schema: fail closed (no prompt, flag untouched)', g.locator('#bkFirst').is_hidden() and ls(g, FK) == '{"schema":9}')
        # restore of that backup with a draft present: draft untouched, data restored
        g.evaluate("localStorage.clear()"); fresh(g); g.fill('#inp', BAD); g.wait_for_timeout(900)
        g.click('#tabProjects'); g.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(bk).encode()}); g.wait_for_timeout(300); g.click('#rGo'); g.wait_for_timeout(300)
        t = json.loads(ls(g, TK) or '{"threads":{}}')['threads']
        ok(f'{w}px restore: backup threads back, unfinished list untouched', '310' in t and json.loads(ls(g, SK))['text'] == BAD, t)
        ctx.close()
    # offline: SW-controlled page, cold reload offline still has the new scripts and the recovery card
    ctx = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True); g = ctx.new_page(); g.on('dialog', lambda d: d.accept())
    g.goto(B); g.wait_for_load_state('networkidle'); g.wait_for_function("navigator.serviceWorker.ready.then(()=>true)", timeout=20000); g.reload(); g.wait_for_load_state('networkidle')
    g.fill('#inp', LIST); g.wait_for_timeout(900); ctx.set_offline(True); g.reload(); g.wait_for_load_state('domcontentloaded'); g.wait_for_timeout(500)
    ok('390px offline reload: recovery card works from cache', g.evaluate("!!window.FlossFoxDraftUI&&!!window.FlossFoxDraftCore") and g.locator('#ffDraftRecovery').is_visible())
    g.click('#ffDraftRestore'); ok('390px offline restore gives the list back', g.input_value('#inp') == LIST)
    ok('sw cache is ci005-84', 'ci005-84' in g.evaluate("caches.keys().then(k=>k.join(','))"))
    ctx.close(); br.close()
ok('no page errors', not errs, errs)
print(f"\ndraft_backup_e2e (simulated): {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
