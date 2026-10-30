#!/usr/bin/env python3
"""Phase 3 (STORE-1..6, KIT-1..5, simulated browser run): Store Mode view and kitting set-asides.
Usage: FF_KEY=flossfox-dev.v1 python tests/p3_store_kit_e2e.py http://localhost:8811/floss-fox-dev/"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; AKEY = PFX + '.allocations.v1'; TKEY = PFX + '.threads.v1'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def ls(g, k): return g.evaluate(f"localStorage.getItem({json.dumps(k)})")
def mk(g, name, text):
    g.click('#tabConvert')
    if g.locator('#exitExample').is_visible(): g.click('#exitExample')
    g.fill('#inp', text); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(120)
    g.fill('#newProjName', name)
    for _ in range(3):  # saveProj ignores a second click within 800ms (double-tap guard); the compact layout gets here faster than that
        g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(200)
        if any(x['name'] == name for x in json.loads(ls(g, KEY) or '{"projects":[]}')['projects']): break
        g.wait_for_timeout(700)
    return [x for x in json.loads(ls(g, KEY))['projects'] if x['name'] == name][0]['id']
def restore(g, obj, mode='merge'):
    g.evaluate("FlossFoxProjects.showView('projects')")
    if g.locator('#pClose').is_visible(): g.click('#pClose'); g.wait_for_timeout(150)  # ci005-77: the kit lives in Shop, so a reload can land with a project open
    g.evaluate("document.getElementById('backupBox').open=true")
    g.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': json.dumps(obj).encode()}); g.wait_for_timeout(300)
    if g.locator('#rGo').count():
        g.check(f'input[name=imode][value={mode}]'); g.click('#rGo'); g.wait_for_timeout(300)
    return g.inner_text('#restorePanel') + ' | ' + g.inner_text('#projStatus')
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (390, 344, 1280):
        ctx = br.new_context(viewport={'width': w, 'height': 800}, is_mobile=w < 600, has_touch=w < 600)
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); g.evaluate("localStorage.clear()"); g.reload(); g.wait_for_load_state('networkidle')
        a = mk(g, 'Fox A', 'B5200 x1\n3799 x2\n310 x2\n898 x1'); b = mk(g, 'Fox B', '310 x3')
        ok(f'[{w}] no allocations key written on load', ls(g, AKEY) is None)
        # ---- Store Mode ----
        g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(150); g.evaluate("document.getElementById('pAllBuy').click()"); g.wait_for_timeout(150)
        g.evaluate("FlossFoxProjects.showView('shop')"); g.wait_for_timeout(200)
        before = ls(g, KEY)
        g.click('#pStoreBtn'); g.wait_for_timeout(150)
        codes = g.eval_on_selector_all('#smLeft .ffsm-code', 'els=>els.map(e=>e.textContent.trim().split(" ").pop())')
        ok(f'[{w}] STORE-1 store mode sorts by color number', codes == ['310', '898', '3799', 'B5200'], codes)
        ok(f'[{w}] STORE-2 opening store mode changes no data', ls(g, KEY) == before)
        g.select_option('#smSort', 'pattern'); g.wait_for_timeout(100)
        codes2 = g.eval_on_selector_all('#smLeft .ffsm-code', 'els=>els.map(e=>e.textContent.trim().split(" ").pop())')
        ok(f'[{w}] STORE-3 pattern order sort', codes2 == ['B5200', '3799', '310', '898'], codes2)
        g.select_option('#smSort', 'number'); g.fill('#smFind', '379'); g.wait_for_timeout(100)
        ok(f'[{w}] STORE-4 search filters', g.locator('#smLeft .ffsm-row').count() == 1)
        g.fill('#smFind', ''); g.wait_for_timeout(100)
        g.click('#smLeft [data-smb]'); g.wait_for_timeout(150)
        pa = [x for x in json.loads(ls(g, KEY))['projects'] if x['id'] == a][0]
        th = ls(g, TKEY)
        ok(f'[{w}] STORE-5 Bought uses existing purchased map, not received', len(pa['purchased']) == 1 and g.locator('#smDone .ffsm-row').count() == 1 and all(not (d or {}).get('recv') for d in pa['decisions'].values()), pa['purchased'])
        g.click('#smDone [data-smu]'); g.wait_for_timeout(150)
        pa = [x for x in json.loads(ls(g, KEY))['projects'] if x['id'] == a][0]
        ok(f'[{w}] STORE-5 undo returns it to Still to find', pa['purchased'] == {} and g.locator('#smLeft .ffsm-row').count() == 4)
        # ---- Store Mode Buy (reuses verified skein links) ----
        nb = g.locator('#smLeft [data-smbuy]').count(); nr = g.locator('#smLeft .ffsm-row').count()
        ok(f'[{w}] BUY-1 Buy button on each row with links', nb == nr == 4, [nb, nr])
        ok(f'[{w}] BUY-1b Buy label minimal', g.locator('#smLeft [data-smbuy]').first.inner_text().strip() == 'Buy')
        ok(f'[{w}] BUY-2 chooser hidden until tapped', g.locator('#smLeft .ffsm-buy:visible').count() == 0)
        before = ls(g, KEY)
        g.click('#smLeft li:has-text("DMC 310") [data-smbuy]'); g.wait_for_timeout(100)
        hrefs = g.eval_on_selector_all('#smLeft .ffsm-buy:visible a', 'els=>els.map(a=>[a.href,a.target,a.rel,a.dataset.store,a.dataset.match])')
        exp = g.evaluate("FlossFoxSkeinPreview.linksFor({brand:'dmc',code:'310',family:'six-strand-cotton',pack:'single-skein',qty:2},'preview').map(l=>l.url)")
        ok(f'[{w}] BUY-3 shows both stores using existing verified links', [h[0] for h in hrefs] == exp and len(exp) == 2 and {h[3] for h in hrefs} == {'hobbylobby', 'everythingcrossstitch'}, [hrefs, exp])
        ok(f'[{w}] BUY-4 new tab, noopener, untracked', all(h[1] == '_blank' and 'noopener' in h[2] for h in hrefs))
        ok(f'[{w}] BUY-5 Buy marks nothing bought', ls(g, KEY) == before and g.locator('#smDone').count() == 0)
        ok(f'[{w}] BUY-6 plain-link disclosure shown', "doesn't earn anything" in (g.text_content('#smBuyNote') or ''))
        ok(f'[{w}] BUY-7 aria-expanded toggles', g.get_attribute('#smLeft li:has-text("DMC 310") [data-smbuy]', 'aria-expanded') == 'true')
        lay = g.evaluate("""[...document.querySelectorAll('#smLeft .ffsm-row')].map(r=>{const a=r.querySelector('[data-smbuy]').getBoundingClientRect(),b=r.querySelector('[data-smb]').getBoundingClientRect(),c=r.querySelector('.ffsm-code').getBoundingClientRect();return Math.abs(a.top-b.top)<2&&a.right<=b.left&&r.querySelector('.ffsm-txt').scrollWidth<=r.querySelector('.ffsm-txt').clientWidth+1&&c.right<=a.left+1&&b.right<=innerWidth})""")
        ok(f'[{w}] BUY-8 Buy and Bought share one line, no overlap', all(lay), lay)
        tx = g.inner_text('#pStore'); ok(f'[{w}] BUY-9 no em dashes', '\u2014' not in tx)
        g.click('#smLeft li:has-text("DMC 310") [data-smbuy]'); g.wait_for_timeout(80)
        g.click('#smLeft [data-smb]'); g.wait_for_timeout(150)
        ok(f'[{w}] BUY-10 bought rows have no Buy', g.locator('#smDone [data-smbuy]').count() == 0 and g.locator('#smLeft [data-smbuy]').count() == 3)
        g.click('#smDone [data-smu]'); g.wait_for_timeout(150)
        ok(f'[{w}] STORE-6 no horizontal overflow', g.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), g.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
        g.click('#pStoreBtn'); g.wait_for_timeout(100)
        # ---- Kitting ----
        g.evaluate("FlossFoxThreadsUI.replaceAll({threads:{'310':{n:4},'898':{n:1}}})")
        g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(200)
        g.evaluate("FlossFoxProjects.showView('shop');document.getElementById('pKit').open=true")
        ok(f'[{w}] KIT-1 kit shows count', '0 of 6 skeins set aside' in g.inner_text('#pKitH'), g.inner_text('#pKitH'))
        g.click('[data-kadd="310"]'); g.wait_for_timeout(150)
        al = json.loads(ls(g, AKEY))
        ok(f'[{w}] KIT-2 set aside 2 of 310 for A, with undo', al['allocations'] == [{'projectId': a, 'code': '310', 'qty': 2}] and g.locator('#kUndo').count() == 1 and '2 of 6 skeins' in g.inner_text('#pKitH'))
        g.click('#kUndo'); g.wait_for_timeout(150)
        ok(f'[{w}] KIT-2 undo clears it', json.loads(ls(g, AKEY))['allocations'] == [])
        g.click('[data-kadd="310"]'); g.wait_for_timeout(150)
        g.evaluate(f"FlossFoxProjects.open({json.dumps(b)})"); g.wait_for_timeout(200); g.evaluate("FlossFoxProjects.showView('shop');document.getElementById('pKit').open=true")
        t = g.inner_text('[data-kit="310"]')
        ok(f'[{w}] KIT-3 no double count: B can set aside only the 2 free', 'Set aside 2' in t and '(2 for other projects)' in t, t)
        g.click('[data-kadd="310"]'); g.wait_for_timeout(150)
        tot = sum(r['qty'] for r in json.loads(ls(g, AKEY))['allocations'] if r['code'] == '310')
        ok(f'[{w}] KIT-3 total set aside never exceeds owned', tot == 4, tot)
        ok(f'[{w}] KIT-4 unknown stock not set aside', g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})") is None and g.locator('[data-kadd="3799"]').count() == 0)
        g.evaluate("FlossFoxThreadsUI.replaceAll({threads:{'310':{n:3},'898':{n:1}}})"); g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(150); g.evaluate("FlossFoxProjects.showView('shop');document.getElementById('pKit').open=true")
        ok(f'[{w}] KIT-4 conflict shown, not clamped', 'More is set aside than you have' in g.inner_text('#pKit') and tot == sum(r['qty'] for r in json.loads(ls(g, AKEY))['allocations'] if r['code'] == '310'))
        g.evaluate("FlossFoxThreadsUI.replaceAll({threads:{'310':{n:4},'898':{n:1}}})")
        # ---- Backup round trip ----
        bk = g.evaluate("FlossFoxProjects.fullBackup()")
        ok(f'[{w}] BK-1 backup includes allocations, stays v2', bk['version'] == 2 and len(bk['allocations']['allocations']) == 2)
        g.evaluate(f"localStorage.removeItem({json.dumps(AKEY)})"); g.reload(); g.wait_for_load_state('networkidle')
        msg = restore(g, bk, 'replace')
        ok(f'[{w}] BK-2 round trip restores allocations', json.loads(ls(g, AKEY) or 'null') == bk['allocations'], msg)
        old = {k: v for k, v in bk.items() if k != 'allocations'}
        msg = restore(g, old, 'merge')
        ok(f'[{w}] BK-3 old backup without allocations keeps local set-asides (merge)', json.loads(ls(g, AKEY))['allocations'] == bk['allocations']['allocations'], msg)
        new = dict(bk); new['allocations'] = {'schema': 9, 'allocations': []}; snap = ls(g, KEY), ls(g, AKEY)
        msg = restore(g, new, 'replace')
        ok(f'[{w}] BK-4 newer allocation schema fails closed', 'newer version' in msg and (ls(g, KEY), ls(g, AKEY)) == snap, msg)
        g.evaluate(f"localStorage.setItem({json.dumps(AKEY)}, JSON.stringify({{schema:9,allocations:[]}}))"); g.reload(); g.wait_for_load_state('networkidle')
        g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(150); g.evaluate("FlossFoxProjects.showView('shop');document.getElementById('pKit').open=true")
        ok(f'[{w}] BK-5 newer stored schema is read-only and untouched', "read-only" in g.inner_text('#pKit') and json.loads(ls(g, AKEY))['schema'] == 9 and 'allocations' not in g.evaluate("FlossFoxProjects.fullBackup()"))
        g.evaluate(f"localStorage.setItem({json.dumps(AKEY)}, JSON.stringify({json.dumps(bk['allocations'])}))"); g.reload(); g.wait_for_load_state('networkidle')
        # ---- Delete releases ----
        g.evaluate("FlossFoxProjects.showView('projects')"); g.evaluate(f"FlossFoxProjects.open({json.dumps(b)})"); g.wait_for_timeout(150)
        g.evaluate("document.getElementById('pDelete').click()"); g.wait_for_timeout(200)
        dlg = g.locator('.ffconfirm, [role=dialog]').last.inner_text() if g.locator('.ffconfirm, [role=dialog]').count() else ''
        ok(f'[{w}] KIT-5 delete says set-asides go back', 'set-aside skein' in dlg, dlg[:200])
        btn = g.locator('[role=dialog] button', has_text='Delete')
        if btn.count(): btn.last.click(); g.wait_for_timeout(200)
        ok(f'[{w}] KIT-5 deleting B releases only its set-asides', json.loads(ls(g, AKEY))['allocations'] == [{'projectId': a, 'code': '310', 'qty': 2}], ls(g, AKEY))
        # ---- Offline ----
        ctx.set_offline(True); g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.evaluate("FlossFoxProjects.showView('shop')"); g.wait_for_timeout(100)
        g.click('#pStoreBtn'); g.wait_for_timeout(100)
        ok(f'[{w}] OFF-1 store mode and kit work offline', g.locator('#smLeft .ffsm-row').count() == 4)
        g.click('#pStoreBtn'); ctx.set_offline(False)
        ctx.close()
    br.close()
ok('no page errors', not errs, errs[:3])
print(f"\nSIMULATED p3_store_kit_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
