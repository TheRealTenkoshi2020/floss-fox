#!/usr/bin/env python3
"""Floss Fox headless regression suite.
Usage: python tests/regression.py [BASE_URL] [--chrome /path/to/chrome] [--shots DIR]
Default BASE_URL: http://localhost:8765/ (serve the site folder with `python3 -m http.server 8765`).
Needs: pip install playwright (uses an installed Chrome/Chromium; set --chrome if not at /usr/bin/google-chrome).
"""
import sys, json, os, argparse
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/')
ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
REAL = "310 Black\n415 Chrome grey\n817 Japanese red\n948 Pale peach\n3863 Otter brown\n413 Iron grey\n815 Cherry red\n898 Teak brown\n3771 Sandy rose\nBLANC"
SULL = {'310':'45053','415':'45091','817':'45219','948':'45286','3863':'45461','413':'45089','815':'45217','898':'45249','3771':'45496','BLANC (White)':'45001'}
R = {'pass': 0, 'fail': 0}; FAILS = []
def ok(name, cond, info=''):
    R['pass' if cond else 'fail'] += 1
    if not cond: FAILS.append(f'{name}: {info}')
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else f'  -> {info}'))

def shop(pg): return [x.strip() for x in pg.locator('#shop li').all_inner_texts()]
def conv(pg, text, dest=None):
    pg.fill('#inp', text); pg.click('#go')
    if dest: pg.select_option('#dest', dest)
    pg.wait_for_timeout(80)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    errs = []
    def page(w=1280, mobile=False, init=None):
        ctx = br.new_context(viewport={'width': w, 'height': 900}, is_mobile=mobile, device_scale_factor=2 if mobile else 1, accept_downloads=True)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        if init: ctx.add_init_script(init)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda c: c.type == 'error' and errs.append(c.text)); pg.on('dialog', lambda d: d.accept())
        return pg
    pg = page()
    # ---------- Quick convert ----------
    pg.goto(B + '?sample'); pg.wait_for_timeout(200)
    ok('sample loads, default DMC', pg.input_value('#dest') == 'dmc' and len(shop(pg)) == 14, shop(pg))
    conv(pg, '310 x2\nDMC 310 Black 3 skeins', 'anchor'); ok('duplicates summed', shop(pg) == ['Anchor 403 × 5 (for DMC 310 · chart)'], shop(pg))
    for t, exp in [('310 ×2', '× 2'), ('310x2', '× 2'), ('310 x 2', '× 2'), ('310 (2)', '× 2'), ('310 2 skeins', '× 2')]:
        conv(pg, t, 'dmc'); ok(f'qty format {t!r}', len(shop(pg)) == 1 and exp in shop(pg)[0], shop(pg))
    conv(pg, '310', 'dmc'); ok('no qty -> 1 (assumed) shown', '1 (assumed)' in pg.inner_text('#tbl'), pg.inner_text('#tbl')[:200])
    conv(pg, '310 x2.5, 310 x0, 310 x-2, 310 two skeins, 310 x'); e = pg.inner_text('#errs')
    ok('invalid quantities rejected with original text', all(s in e for s in ['"310 x2.5"', '"310 x0"', '"310 x-2"', '"310 two skeins"', '"310 x"']) and pg.locator('#shopcard').is_hidden(), e)
    conv(pg, '310 x?', 'dmc'); ok('x? = unknown quantity', shop(pg) and '× ?' in shop(pg)[0] and 'unknown' in pg.inner_text('#totals').lower(), (shop(pg), pg.inner_text('#totals')))
    conv(pg, '310 x2, 310 x?', 'dmc'); ok('known + unknown aggregates to unknown, not a number', '× ?' in shop(pg)[0], shop(pg))
    conv(pg, '9999, hello world, 310', 'dmc'); ok('mixed valid/invalid keeps valid, flags invalid', len(shop(pg)) == 1 and '"9999"' in pg.inner_text('#errs') and '"hello world"' in pg.inner_text('#errs'), pg.inner_text('#errs'))
    conv(pg, '310 321 415'); ok('space-separated codes rejected whole', 'more than one number' in pg.inner_text('#errs'), pg.inner_text('#errs'))
    conv(pg, '415 2 strands'); ok('"2 strands" never becomes 2 skeins', 'more than one number' in pg.inner_text('#errs'), pg.inner_text('#errs'))
    conv(pg, '48, 5282', 'anchor'); rv = pg.inner_text('#review')
    ok('specialty not substituted (Anchor)', 'variegated' in rv and 'metallic' in rv and 'Nothing ready' in shop(pg)[0], rv)
    pg.select_option('#dest', 'sullivans'); ok('specialty not substituted (Sullivans)', 'variegated' in pg.inner_text('#review'), pg.inner_text('#review'))
    conv(pg, '762, 01', 'anchor'); ok('no chart match -> review, never auto-guessed', shop(pg) == ['Anchor 234 × 1 (for DMC 762 · chart)'] and 'DMC 01' in pg.inner_text('#review'), (shop(pg), pg.inner_text('#review')))
    conv(pg, '798', 'anchor'); t = pg.inner_text('#tbl'); ok('798 only chart options, no computed alternates', all(x in t for x in ['131', '137', '142', '146']) and 'ΔE' not in t and '1217' not in t, t)
    conv(pg, '321 x2', 'anchor'); pg.select_option('select.pick[data-code="321"]', '47')
    ok('explicit selection reflected in list', shop(pg) == ['Anchor 47 × 2 (for DMC 321 · your choice of chart options)'], shop(pg))
    pg.locator('#shop input').first.check(); pg.click('#copy'); pg.wait_for_timeout(150)
    clip = pg.evaluate('navigator.clipboard.readText()'); ok('copy keeps check + choice + costs', '[x] Anchor 47 x2' in clip and 'Estimated costs' in clip and '✓' in pg.inner_text('#copymsg'), clip)
    pg.select_option('#dest', 'sullivans'); ok('Sullivans numbers populate list', shop(pg) == ['Sullivans 45062 × 2 (for DMC 321 · official chart)'], shop(pg))
    pg.select_option('#dest', 'anchor'); ok('check preserved across brand switch', pg.locator('#shop input').first.is_checked())
    conv(pg, 'WHITE, 3865', 'anchor'); ok('disputed white needs choice', 'disputed' in pg.inner_text('#review'))
    pg.select_option('select.pick[data-code="WHITE"]', '2'); ok('merge warning when two colours share a thread', 'different pattern colours' in shop(pg)[0], shop(pg))
    conv(pg, '48', 'dmc'); ok('no priced matches shown as unknown, not $0', '$0.00' not in pg.inner_text('#totals') and 'unknown' in pg.inner_text('#totals'), pg.inner_text('#totals'))
    conv(pg, '310 x3, 01', 'anchor'); ok('partial total labelled incomplete', 'project incomplete' in pg.inner_text('#totals'), pg.inner_text('#totals'))
    # real pattern
    pg.goto(B); conv(pg, REAL, 'dmc'); s = shop(pg)
    ok('real pattern DMC: 10 lines, BLANC label, no review', len(s) == 10 and any('DMC BLANC (White) × 1' in x for x in s) and not pg.inner_text('#review'), s)
    pg.select_option('#dest', 'sullivans'); s = shop(pg)
    ok('real pattern Sullivans numbers match official chart', all(any(f'Sullivans {v} × 1 (for DMC {k} ·' in x for x in s) for k, v in SULL.items()) and not pg.inner_text('#review'), s)
    pg.select_option('#dest', 'anchor'); ok('real pattern Anchor: only BLANC in review', pg.inner_text('#review').count('DMC ') == 1 and 'BLANC' in pg.inner_text('#review'), pg.inner_text('#review'))
    pg2 = page(); pg2.goto(B); pg2.evaluate("Object.defineProperty(navigator,'clipboard',{value:undefined})"); conv(pg2, '310', 'dmc'); pg2.click('#copy')
    ok('copy failure shows fallback text', pg2.locator('#copyfallback').is_visible() and "Couldn't copy" in pg2.inner_text('#copymsg'))

    # ---------- Projects ----------
    conv(pg, REAL, 'dmc'); pg.fill('#newProjName', 'Real pattern'); pg.click('#saveProj')
    ok('save as project', 'Saved "Real pattern"' in pg.inner_text('#copymsg'), pg.inner_text('#copymsg'))
    pg.click('#tabProjects'); ok('project listed', 'Real pattern' in pg.inner_text('#projList') and '10 thread(s)' in pg.inner_text('#projList'), pg.inner_text('#projList'))
    pg.click('[data-open]'); pg.wait_for_timeout(100)
    ok('original requirement text preserved', 'from "310 Black"' in pg.inner_text('#projEdit') and 'from "BLANC"' in pg.inner_text('#projEdit'))
    ok('new project not ready; all not checked', 'Not ready yet: 0 thread(s) to buy, 10 to review' in pg.inner_text('#pPlan'), pg.inner_text('#pPlan')[:200])
    pg.check('#st-310-have'); pg.check('#st-415-check'); pg.click('#pAllBuy'); pl = pg.inner_text('#pPlan')
    ok('Have/Check/Buy buckets', 'Not ready yet: 8 thread(s) to buy, 1 to review' in pl and 'Check: confirm' in pl, pl[:400])
    pg.select_option('#pDest', 'sullivans'); pl = pg.inner_text('#pPlan'); ok('project buy-in Sullivans uses official numbers', 'Sullivans 45219 × 1' in pl and 'Sullivans 45001 × 1' in pl, pl[:300])
    pg.check('#pb-sullivans\\:45219'); pg.fill('#pNotes', 'threads in the blue bag'); pg.locator('#pNotes').blur(); pg.fill('#pName', 'Real pattern v2'); pg.locator('#pName').blur()
    pg.reload(); pg.click('#tabProjects'); pg.click('[data-open]'); pg.wait_for_timeout(100); pl = pg.inner_text('#pPlan')
    ok('persistence after reload (statuses, brand, bought, notes, name)', pg.is_checked('#st-310-have') and pg.is_checked('#st-415-check') and pg.input_value('#pDest') == 'sullivans' and pg.is_checked('#pb-sullivans\\:45219') and pg.input_value('#pNotes') == 'threads in the blue bag' and pg.input_value('#pName') == 'Real pattern v2', pl[:200])
    pg.click('#pCopy'); pg.wait_for_timeout(150); clip = pg.evaluate('navigator.clipboard.readText()')
    ok('reopened plan copy is accurate', '[x] Sullivans 45219 x1' in clip and 'NEEDS REVIEW' in clip and 'DMC 415' in clip and 'HAVE' in clip and 'Notes: threads in the blue bag' in clip, clip)
    with pg.expect_download() as d: pg.click('#pCsv')
    c = open(d.value.path(), encoding='utf-8').read()
    ok('CSV export', c.startswith('project,dmc_code') and 'BLANC (White)' in c and '45001' in c and c.count('\n') == 11, c[:300])
    pg.emulate_media(media='print'); pg.pdf(path='/tmp/ff-project-print.pdf'); pg.emulate_media(media='screen')
    import subprocess; txt = subprocess.run(['pdftotext', '-layout', '/tmp/ff-project-print.pdf', '-'], capture_output=True, text=True).stdout if os.path.exists('/usr/bin/pdftotext') else ''
    ok('print shows plan with review + bought state', ('Real pattern v2' in txt and 'Needs review' in txt and '45219' in txt) if txt else True, txt[:300])
    # Unknown-quantity cases
    pg.click('#pClose'); pg.click('#newEmpty'); pg.fill('#pAdd', '310 x2, 415 x?'); pg.click('#pAddBtn')
    pg.check('#st-310-check'); pl = pg.inner_text('#pPlan'); ok('310 x2 with unknown owned (Check) is NOT ready', 'Not ready' in pl and 'Check: confirm' in pl, pl[:300])
    pg.check('#st-310-buy'); pl = pg.inner_text('#pPlan'); ok('Buy with owned blank buys full need (no assumed skein)', 'DMC 310 × 2' in pl, pl[:300])
    pg.fill('#o-310', '0.5'); pg.locator('#o-310').dispatch_event('change'); pl = pg.inner_text('#pPlan'); ok('owned 0.5 -> buy 2 (rounded up)', 'DMC 310 × 2' in pl, pl[:300])
    pg.fill('#o-310', '1'); pg.locator('#o-310').dispatch_event('change'); pl = pg.inner_text('#pPlan'); ok('owned 1 -> buy 1', 'DMC 310 × 1' in pl, pl[:300])
    pg.check('#st-310-have'); pl = pg.inner_text('#pPlan'); ok('Have but owned < needed -> review', 'less than 2 needed' in pl, pl[:400])
    pg.check('#st-415-buy'); pl = pg.inner_text('#pPlan'); ok('unknown requirement + Buy -> review, not a quantity', 'UNKNOWN' in pl and 'DMC 415 ×' not in pl, pl[:400])
    pg.fill('#q-310', '0'); pg.locator('#q-310').dispatch_event('change'); ok('invalid needed qty rejected', pg.input_value('#q-310') == '2' and "isn't a whole number" in pg.inner_text('#projStatus'))
    pg.click('#rm-415'); ok('remove thread (confirmed)', 'DMC 415' not in pg.inner_text('#projEdit'))
    # Backup / restore
    pg.click('#pClose'); n0 = pg.locator('[data-open]').count()
    with pg.expect_download() as d: pg.click('#backupBtn')
    bk = open(d.value.path(), encoding='utf-8').read(); bj = json.loads(bk)
    ok('backup JSON valid', bj.get('app') == 'floss-fox' and len(bj['projects']) == n0 == 2, (n0, len(bj.get('projects', []))))
    pg.locator('[data-del]').first.click(); ok('delete with confirmation', pg.locator('[data-open]').count() == 1)
    def restore(buf, name='b.json'): pg.set_input_files('#restoreFile', {'name': name, 'mimeType': 'application/json', 'buffer': buf}); pg.wait_for_timeout(200)
    restore(bk.encode()); pg.check('input[name=rmode][value=skip]'); pg.click('#rGo')
    ok('restore adds missing, skips existing (no duplicates)', pg.locator('[data-open]').count() == 2 and '1 added' in pg.inner_text('#projStatus') and '1 skipped' in pg.inner_text('#projStatus'), pg.inner_text('#projStatus'))
    restore(bk.encode()); pg.check('input[name=rmode][value=replace]'); pg.click('#rGo'); ok('restore replace keeps count', pg.locator('[data-open]').count() == 2, pg.inner_text('#projStatus'))
    restore(bk.encode()); pg.check('input[name=rmode][value=copy]'); pg.click('#rGo'); ok('restore as copy is explicit', pg.locator('[data-open]').count() == 4 and 'restored copy' in pg.inner_text('#projList'))
    restore(b'{not json'); ok('malformed backup rejected, nothing changed', "isn't a valid Floss Fox backup" in pg.inner_text('#restorePanel') and pg.locator('[data-open]').count() == 4)
    restore(json.dumps({'app': 'other', 'projects': []}).encode()); ok('wrong-app file rejected', "isn't a valid" in pg.inner_text('#restorePanel'))
    bad = dict(bj); bad['projects'] = bj['projects'] + [{'id': 'x1', 'items': [{'code': 'NOPE', 'qty': 1}]}, bj['projects'][0]]
    restore(json.dumps(bad).encode()); ok('damaged/duplicate entries skipped and counted', 'skipped' in pg.inner_text('#restorePanel'), pg.inner_text('#restorePanel')); pg.click('#rCancel')
    # Storage failure modes
    pc = page(); pc.goto(B); pc.evaluate("localStorage.setItem('flossfox.v1','{bad json')"); pc.reload(); pc.click('#tabProjects')
    ok('corrupt storage: warning, data untouched', "couldn't be read" in pc.inner_text('#storeMsg') and pc.evaluate("localStorage.getItem('flossfox.v1')") == '{bad json')
    pu = page(init="Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})"); pu.goto(B); pu.click('#tabProjects')
    ok('storage unavailable: clear message, app still works', 'Saving is unavailable' in pu.inner_text('#storeMsg'))
    pu.click('#tabConvert'); conv(pu, '310', 'dmc'); ok('convert works without storage', len(shop(pu)) == 1)
    pq = page(init="Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}"); pq.goto(B); conv(pq, '310', 'dmc'); pq.click('#saveProj')
    ok('storage full: save reports not saved', 'storage is full' in pq.inner_text('#projStatus') or "Saved for this session only" in pq.inner_text('#copymsg'), (pq.inner_text('#projStatus'), pq.inner_text('#copymsg')))
    # ---------- Phone layout ----------
    pm = page(412, True); pm.goto(B + '?sample'); pm.wait_for_timeout(200)
    ok('phone convert: no horizontal overflow', pm.evaluate('document.documentElement.scrollWidth') <= 412)
    if A.shots: pm.screenshot(path=os.path.join(A.shots, 'live-mobile.png'), full_page=True)
    pm.fill('#newProjName', 'Phone test'); pm.click('#saveProj'); pm.click('#tabProjects'); pm.click('[data-open]'); pm.click('#pAllBuy'); pm.wait_for_timeout(100)
    ok('phone projects: no horizontal overflow', pm.evaluate('document.documentElement.scrollWidth') <= 412, pm.evaluate('document.documentElement.scrollWidth'))
    small = pm.evaluate("""[...document.querySelectorAll('#projectsView button, #projectsView select, #projectsView input[type=number], #projectsView input[type=text], #projectsView .seg label, .tabs button')].filter(e=>e.offsetParent).map(e=>[e.id||e.textContent.trim().slice(0,20),Math.round(e.getBoundingClientRect().height)]).filter(x=>x[1]<44)""")
    ok('phone touch targets >= 44px', not small, small)
    if A.shots: pm.screenshot(path=os.path.join(A.shots, 'projects-mobile.png'), full_page=True)
    if A.shots:
        pd = page(); pd.goto(B + '?sample'); pd.wait_for_timeout(200); pd.screenshot(path=os.path.join(A.shots, 'live.png'), full_page=True)
    ok('no JS errors', not errs, errs)
    print(f"\n{R['pass']} passed, {R['fail']} failed")
    for f in FAILS: print('  FAIL', f)
    sys.exit(1 if R['fail'] else 0)
