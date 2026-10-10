#!/usr/bin/env python3
"""Floss Fox headless regression suite.
Usage: python tests/regression.py [BASE_URL] [--chrome /path/to/chrome] [--shots DIR]
Default BASE_URL: http://localhost:8765/ (serve the site folder with `python3 -m http.server 8765`).
Needs: pip install playwright (uses an installed Chrome/Chromium; set --chrome if not at /usr/bin/google-chrome).
"""
import sys, json, os, argparse, subprocess
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
def expand(pg, code):
    b = pg.locator(f'#x-{code}')
    if b.get_attribute('aria-expanded') != 'true': b.click()
def setnum(pg, sel, v): pg.fill(sel, str(v)); pg.locator(sel).dispatch_event('change')
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
    expand(pg, '310'); expand(pg, 'WHITE')
    ok('original requirement text preserved', '"310 Black"' in pg.inner_text('#projEdit') and '"BLANC"' in pg.inner_text('#projEdit'))
    ok('new project not ready; all not checked', 'Not ready yet: 0 thread(s) to buy, 0 bought awaiting confirmation, 10 to review' in pg.inner_text('#pSum'), pg.inner_text('#pSum')[:200])
    pg.check('#st-310-have'); pg.check('#st-415-check'); pg.click('#pAllBuy'); pl = pg.inner_text('#pSum') + pg.inner_text('#pPlan')
    ok('Have/Check/Buy buckets', 'Not ready yet: 8 thread(s) to buy, 0 bought awaiting confirmation, 1 to review' in pl and 'Check: confirm' in pl, pl[:400])
    pg.select_option('#pDest', 'sullivans'); pl = pg.inner_text('#pPlan'); ok('project buy-in Sullivans uses official numbers', 'Sullivans 45219 × 1' in pl and 'Sullivans 45001 × 1' in pl, pl[:300])
    pg.check('#pb-sullivans\\:45219'); pg.click('.pmore summary'); pg.fill('#pNotes', 'threads in the blue bag'); pg.locator('#pNotes').blur(); pg.fill('#pName', 'Real pattern v2'); pg.locator('#pName').blur()
    pg.reload(); pg.click('#tabProjects'); pg.click('[data-open]'); pg.wait_for_timeout(100); pl = pg.inner_text('#pPlan')
    ok('persistence after reload (statuses, brand, bought, notes, name)', pg.is_checked('#st-310-have') and pg.is_checked('#st-415-check') and pg.input_value('#pDest') == 'sullivans' and pg.is_checked('#pb-sullivans\\:45219') and pg.input_value('#pNotes') == 'threads in the blue bag' and pg.input_value('#pName') == 'Real pattern v2', pl[:200])
    pg.click('#pCopy'); pg.wait_for_timeout(150); clip = pg.evaluate('navigator.clipboard.readText()')
    ok('reopened plan copy is accurate', '[x] Sullivans 45219 x1' in clip and 'NEEDS REVIEW' in clip and 'DMC 415' in clip and 'CONFIRMED SUFFICIENT' in clip and 'BOUGHT, AWAITING' in clip and 'Notes: threads in the blue bag' in clip, clip)
    with pg.expect_download() as d: pg.click('#pCsv')
    c = open(d.value.path(), encoding='utf-8').read()
    ok('CSV export', c.startswith('project,dmc_code') and 'BLANC (White)' in c and '45001' in c and c.count('\n') == 11 and 'readiness' in c.split('\n')[0], c[:300])
    pg.emulate_media(media='print'); pg.pdf(path='/tmp/ff-project-print.pdf'); pg.emulate_media(media='screen')
    import subprocess; txt = subprocess.run(['pdftotext', '-layout', '/tmp/ff-project-print.pdf', '-'], capture_output=True, text=True).stdout if os.path.exists('/usr/bin/pdftotext') else ''
    ok('print shows plan with review + bought state', ('Real pattern v2' in txt and 'Needs review' in txt and '45219' in txt) if txt else True, txt[:300])
    # Unknown-quantity cases
    pg.click('#pClose'); pg.click('#newEmpty'); pg.fill('#pAdd', '310 x2, 415 x?'); pg.click('#pAddBtn')
    pg.check('#st-310-check'); pl = pg.inner_text('#pSum') + pg.inner_text('#pPlan'); ok('310 x2 with unknown owned (Check) is NOT ready', 'Not ready' in pl and 'Check: confirm' in pl, pl[:300])
    pg.check('#st-310-buy'); pl = pg.inner_text('#pPlan'); ok('Buy with owned blank buys full need (no assumed skein)', 'DMC 310 × 2' in pl, pl[:300])
    expand(pg, '310'); setnum(pg, '#o-310', '0.5'); pl = pg.inner_text('#pPlan'); ok('owned 0.5 -> buy 2 (rounded up)', 'DMC 310 × 2' in pl, pl[:300])
    setnum(pg, '#o-310', '1'); pl = pg.inner_text('#pPlan'); ok('owned 1 -> buy 1', 'DMC 310 × 1' in pl, pl[:300])
    pg.check('#st-310-have'); pl = pg.inner_text('#pPlan'); ok('Have but owned < needed -> review', 'less than 2 needed' in pl, pl[:400])
    pg.check('#st-415-buy'); pl = pg.inner_text('#pPlan'); ok('unknown requirement + Buy -> review, not a quantity', 'UNKNOWN' in pl and 'DMC 415 ×' not in pl, pl[:400])
    setnum(pg, '#q-310', '0'); ok('invalid needed qty rejected', pg.input_value('#q-310') == '2' and "isn't a whole number" in pg.inner_text('#projStatus'))
    expand(pg, '415'); pg.click('#rm-415'); ok('remove thread (confirmed)', 'DMC 415' not in pg.inner_text('#projEdit'))
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
    # ---------- Milestone 1.1: readiness + receipt workflow, mobile cards ----------
    FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'backup-v1.json')
    def newproj(pg, text, name='T'):
        pg.goto(B); pg.click('#tabProjects'); pg.click('#newEmpty'); pg.fill('#pName', name); pg.locator('#pName').blur()
        pg.fill('#pAdd', text); pg.click('#pAddBtn'); pg.wait_for_timeout(50)
    def summ(pg): return {k: pg.inner_text('#' + k) for k in ['sSuf', 'sBuy', 'sAw', 'sRev']}
    def ready(pg): return pg.inner_text('#pSummary').strip().startswith('✓')
    m = page()
    newproj(m, '310 x2'); m.check('#st-310-have'); ok('T1 ready after confirming owned (Have)', ready(m) and summ(m)['sSuf'] == '1 / 1', summ(m))
    expand(m, '310'); setnum(m, '#o-310', '1'); ok('T1b Have with owned 1 < 2 is not ready', not ready(m) and summ(m)['sRev'] == '1', summ(m))
    m.check('#st-310-buy'); m.check('#pb-dmc\\:310')
    ok('T2 purchased is not received/ready', not ready(m) and summ(m)['sAw'] == '1' and summ(m)['sSuf'] == '0 / 1', summ(m))
    m.click('#rb-dmc_310'); m.click('#rc-dmc_310'); ok('T2b empty receipt amount rejected', 'Nothing changed' in m.inner_text('#pMsg') and summ(m)['sAw'] == '1')
    m.fill('#rq-dmc_310', '1'); m.click('#rc-dmc_310')
    ok('T3 ready after receipt covering outstanding', ready(m) and 'received 1' in m.inner_text('#pPlan'), (summ(m), m.inner_text('#pMsg')))
    newproj(m, '310 x3', 'Partial'); m.check('#st-310-buy'); m.check('#pb-dmc\\:310'); m.click('#rb-dmc_310'); m.fill('#rq-dmc_310', '1'); m.click('#rc-dmc_310'); pl = m.inner_text('#pPlan')
    ok('T4 partial receipt does not cover need', not ready(m) and summ(m)['sBuy'] == '1' and 'DMC 310 × 2' in pl and '1 already received' in pl and not m.is_checked('#pb-dmc\\:310'), (summ(m), pl[:300]))
    newproj(m, '415 x?', 'Unknown'); ok4 = []
    for st in ['have', 'check', 'buy']:
        m.check(f'#st-415-{st}'); ok4.append(not ready(m) and summ(m)['sRev'] == '1')
    ok('T5 unknown needed stays unresolved for Have/Check/Buy', all(ok4), ok4)
    newproj(m, 'BLANC, 321', 'Subs'); m.select_option('#pDest', 'anchor'); m.check('#st-WHITE-have'); m.check('#st-321-buy')
    ok('T6 unapproved substitution blocks ready (disputed + multi-option)', not ready(m) and summ(m)['sRev'] == '2', summ(m))
    expand(m, 'WHITE'); m.select_option('#anc-WHITE', '2'); expand(m, '321'); m.select_option('#anc-321', '47'); m.check('#pb-anchor\\:47'); m.click('#rb-anchor_47'); m.fill('#rq-anchor_47', '1'); m.click('#rc-anchor_47')
    ok('T6b ready once substitutions approved and received', ready(m), summ(m))
    newproj(m, '310 x2, 415 x1', 'Persist'); m.click('#pAllBuy'); m.check('#pb-dmc\\:310'); m.check('#pb-dmc\\:415'); m.click('#rb-dmc_415'); m.fill('#rq-dmc_415', '1'); m.click('#rc-dmc_415')
    m.reload(); m.click('#tabProjects'); m.locator('[data-open]').first.click()
    ok('T7 purchased + received persist after reload', summ(m)['sAw'] == '1' and summ(m)['sSuf'] == '1 / 2' and m.is_checked('#pb-dmc\\:310'), summ(m))
    st = m.evaluate("JSON.parse(localStorage.getItem('flossfox.v1'))"); ok('T7b stored schema is 2 with recv record', st['schema'] == 2 and any(p['decisions'].get('415', {}).get('recv') for p in st['projects']), st['schema'])
    # T8 migration
    v1 = open(FIX, encoding='utf-8').read(); mg = page(); mg.goto(B); mg.evaluate("v=>localStorage.setItem('flossfox.v1',v)", v1); mg.reload(); mg.click('#tabProjects')
    ok('T8 v1 localStorage project loads', 'V1 fixture' in mg.inner_text('#projList') and not mg.locator('#storeMsg').is_visible())
    mg.click('[data-open]'); s8 = summ(mg)
    ok('T8b v1 data intact (Have counted, Check in review, bought awaiting)', s8 == {'sSuf': '1 / 3', 'sBuy': '0', 'sAw': '1', 'sRev': '1'}, s8)
    mg.click('.pmore summary') if not mg.locator('#pNotes').is_visible() else None
    ok('T8c v1 notes/brand/owned preserved', mg.input_value('#pNotes') == 'made with schema 1' and mg.input_value('#pDest') == 'sullivans' and 'after subtracting owned' in mg.inner_text('#pPlan'))
    mg2 = page(); mg2.goto(B); mg2.click('#tabProjects'); mg2.set_input_files('#restoreFile', FIX); mg2.wait_for_timeout(200); mg2.click('#rGo')
    ok('T8d v1 backup file restores', '1 added' in mg2.inner_text('#projStatus') and 'V1 fixture' in mg2.inner_text('#projList'), mg2.inner_text('#projStatus'))
    # T9/T10 cards
    newproj(m, '310 x2, 321', 'Cards')
    ok('T9 cards start collapsed, details hidden', m.get_attribute('#x-310', 'aria-expanded') == 'false' and m.locator('#det-310').is_hidden())
    m.click('#x-310'); ok('T9b expand shows details + aria-expanded true', m.get_attribute('#x-310', 'aria-expanded') == 'true' and m.locator('#o-310').is_visible() and 'Hide details' in m.inner_text('#x-310'))
    m.click('#x-310'); ok('T9c collapse hides again', m.locator('#det-310').is_hidden() and m.get_attribute('#x-310', 'aria-expanded') == 'false')
    m.locator('#x-321').focus(); m.keyboard.press('Enter'); ok('T9d keyboard expand', m.get_attribute('#x-321', 'aria-expanded') == 'true')
    m.click('label:has(#st-310-buy)'); ok('T10 status change without expanding', m.is_checked('#st-310-buy') and m.locator('#det-310').is_hidden() and 'Buy 2' in m.inner_text('#card-310'), m.inner_text('#card-310'))
    m.locator('#st-321-buy').focus(); m.keyboard.press('ArrowLeft'); ok('T10b keyboard status change (arrow keys)', m.is_checked('#st-321-check'))
    # T11 performance
    timings = {}
    codes = m.evaluate("Object.keys(DMC).filter(c=>fam(c)==='solid'&&/^\\d+$/.test(c))")
    for n in [15, 50, 150]:
        pp = page(412, True); pp.goto(B); pp.click('#tabProjects'); pp.click('#newEmpty')
        pp.fill('#pAdd', '\n'.join(f'{c} x2' for c in codes[:n])); t0 = pp.evaluate('performance.now()'); pp.click('#pAddBtn'); t1 = pp.evaluate('performance.now()')
        pp.click('#pAllBuy'); t2 = pp.evaluate('performance.now()')
        tc = pp.evaluate("()=>{const c=document.querySelector('.cards [data-st][value=have]');const t=performance.now();c.click();return performance.now()-t}")
        te = pp.evaluate("()=>{const b=document.querySelector('[data-exp]');const t=performance.now();b.click();return performance.now()-t}")
        cnt = pp.locator('.tcard').count(); ow = pp.evaluate('document.documentElement.scrollWidth')
        timings[n] = {'add_ms': round(t1 - t0), 'mark_all_ms': round(t2 - t1), 'status_click_ms': round(tc), 'expand_ms': round(te), 'cards': cnt}
        ok(f'T11 {n} threads render + interact (<1500ms each), no overflow', cnt == n and ow <= 412 and max(t1 - t0, t2 - t1, tc, te) < 1500, timings[n])
        pp.context.close()
    print('TIMINGS', json.dumps(timings))
    # T12 widths
    bad = []
    for w in [360, 412, 600, 700, 768, 880, 1024, 1280]:
        pw = page(w, w < 700); pw.goto(B + '?sample'); pw.wait_for_timeout(150); o1 = pw.evaluate('document.documentElement.scrollWidth')
        pw.fill('#newProjName', 'W'); pw.click('#saveProj'); pw.click('#tabProjects'); pw.click('[data-open]'); pw.click('#pAllBuy'); pw.click('[data-exp]'); o2 = pw.evaluate('document.documentElement.scrollWidth')
        if o1 > w or o2 > w: bad.append((w, o1, o2))
        if A.shots and w == 412:
            pw.evaluate("document.getElementById('pSummary').scrollIntoView()"); pw.screenshot(path=os.path.join(A.shots, 'm11-summary-mobile.png'))
            pw.evaluate("document.getElementById('pThreads').scrollIntoView()"); pw.screenshot(path=os.path.join(A.shots, 'm11-cards-mobile.png'))
        if A.shots and w == 1280: pw.screenshot(path=os.path.join(A.shots, 'm11-desktop.png'), full_page=False)
        pw.context.close()
    ok('T12 no horizontal overflow at 360/412/600/700/768/880/1024/1280', not bad, bad)
    # T13 consistency
    c13 = page(); newproj(c13, '310 x2, 415 x?, 817, 3865 x3', 'Consist'); c13.check('#st-310-buy'); c13.check('#st-415-check'); c13.check('#st-817-have'); c13.check('#st-3865-buy'); c13.check('#pb-dmc\\:3865')
    s13 = summ(c13); c13.click('#pCopy'); c13.wait_for_timeout(100); txt13 = c13.evaluate('navigator.clipboard.readText()')
    with c13.expect_download() as d: c13.click('#pCsv')
    csv13 = open(d.value.path(), encoding='utf-8').read()
    c13.emulate_media(media='print'); c13.pdf(path='/tmp/ff-m11-print.pdf'); c13.emulate_media(media='screen')
    pdf13 = subprocess.run(['pdftotext', '-layout', '/tmp/ff-m11-print.pdf', '-'], capture_output=True, text=True).stdout if os.path.exists('/usr/bin/pdftotext') else ''
    cons = s13 == {'sSuf': '1 / 4', 'sBuy': '1', 'sAw': '1', 'sRev': '1'} and 'left to buy 1 · bought, awaiting confirmation 1 · needs review 1' in txt13 \
        and csv13.count('to buy') == 1 and csv13.count('bought, awaiting confirmation') == 1 and csv13.count('needs review') == 1 and 'confirmed sufficient (owned)' in csv13 and 'UNKNOWN' in csv13 \
        and (not pdf13 or ('Confirmed sufficient' in pdf13 and 'awaiting' in pdf13 and 'UNKNOWN' in pdf13))
    ok('T13 summary, copy, CSV and print agree', cons, (s13, txt13[:300], csv13[:300]))
    with c13.expect_download() as d: c13.click('#pClose') or c13.click('#backupBtn')
    bk13 = open(d.value.path(), encoding='utf-8').read(); c13.locator('[data-del]').first.click()
    c13.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': bk13.encode()}); c13.wait_for_timeout(150); c13.click('#rGo'); c13.click('[data-open]')
    c13.click('#pCopy'); c13.wait_for_timeout(100); ok('T13b backup/restore round-trip gives identical plan text', c13.evaluate('navigator.clipboard.readText()') == txt13)
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
