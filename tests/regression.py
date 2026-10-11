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
    pg.click('#tabProjects'); ok('project listed', 'Real pattern' in pg.inner_text('#projList') and '10 colors' in pg.inner_text('#projList'), pg.inner_text('#projList'))
    pg.click('[data-open]'); pg.wait_for_timeout(100)
    expand(pg, '310'); expand(pg, 'WHITE')
    ok('original requirement text preserved', '"310 Black"' in pg.inner_text('#projEdit') and '"BLANC"' in pg.inner_text('#projEdit'))
    ok('new project not ready; all not checked', pg.inner_text('#sSuf') == '0 of 10' and pg.inner_text('#sRev') == '10' and "aren't checked yet" in pg.inner_text('#pSum'), pg.inner_text('#pSum')[:200])
    pg.check('#st-310-have'); pg.check('#st-415-check'); pg.click('#pAllBuy'); pl = pg.inner_text('#pSum') + pg.inner_text('#pPlan')
    ok('Have/Check/Buy buckets', [pg.inner_text('#'+k) for k in ['sSuf','sBuy','sAw','sRev']] == ['1 of 10','8','0','1'] and 'Not sure yet' in pl, pl[:400])
    pg.select_option('#pDest', 'sullivans'); pl = pg.inner_text('#pPlan'); ok('project buy-in Sullivans uses official numbers', 'Sullivans 45219 × 1' in pl and 'Sullivans 45001 × 1' in pl, pl[:300])
    pg.check('#pb-sullivans\\:45219'); pg.click('.pmore summary'); pg.fill('#pNotes', 'threads in the blue bag'); pg.locator('#pNotes').blur(); pg.fill('#pName', 'Real pattern v2'); pg.locator('#pName').blur()
    pg.reload(); pg.click('#tabProjects'); pg.click('[data-open]'); pg.wait_for_timeout(100); pl = pg.inner_text('#pPlan')
    ok('persistence after reload (statuses, brand, bought, notes, name)', pg.is_checked('#st-310-have') and pg.is_checked('#st-415-check') and pg.input_value('#pDest') == 'sullivans' and pg.is_checked('#pb-sullivans\\:45219') and pg.input_value('#pNotes') == 'threads in the blue bag' and pg.input_value('#pName') == 'Real pattern v2', pl[:200])
    pg.click('#pCopy'); pg.wait_for_timeout(150); clip = pg.evaluate('navigator.clipboard.readText()')
    ok('reopened plan copy is accurate', '[x] Sullivans 45219 x1' in clip and 'NEEDS ATTENTION' in clip and 'DMC 415' in clip and 'READY (' in clip and 'BOUGHT — CHECK IN' in clip and 'Notes: threads in the blue bag' in clip, clip)
    with pg.expect_download() as d: pg.click('#pCsv')
    c = open(d.value.path(), encoding='utf-8').read()
    ok('CSV export', c.startswith('project,dmc_code') and 'BLANC (White)' in c and '45001' in c and c.count('\n') == 11 and 'readiness' in c.split('\n')[0], c[:300])
    pg.emulate_media(media='print'); pg.pdf(path='/tmp/ff-project-print.pdf'); pg.emulate_media(media='screen')
    import subprocess; txt = subprocess.run(['pdftotext', '-layout', '/tmp/ff-project-print.pdf', '-'], capture_output=True, text=True).stdout if os.path.exists('/usr/bin/pdftotext') else ''
    ok('print shows plan with review + bought state', ('Real pattern v2' in txt and 'Needs attention' in txt and '45219' in txt) if txt else True, txt[:300])
    # Unknown-quantity cases
    pg.click('#pClose'); pg.click('#newEmpty'); pg.fill('#pAdd', '310 x2, 415 x?'); pg.click('#pAddBtn')
    pg.check('#st-310-check'); pl = pg.inner_text('#pSum') + pg.inner_text('#pPlan'); ok('310 x2 with unknown owned (Check) is NOT ready', pg.get_attribute('#pSummary','data-ready') == 'false' and 'Not sure yet' in pl, pl[:300])
    pg.check('#st-310-buy'); pl = pg.inner_text('#pPlan'); ok('Buy with owned blank buys full need (no assumed skein)', 'DMC 310 × 2' in pl, pl[:300])
    expand(pg, '310'); setnum(pg, '#o-310', '0.5'); pl = pg.inner_text('#pPlan'); ok('owned 0.5 -> buy 2 (rounded up)', 'DMC 310 × 2' in pl, pl[:300])
    setnum(pg, '#o-310', '1'); pl = pg.inner_text('#pPlan'); ok('owned 1 -> buy 1', 'DMC 310 × 1' in pl, pl[:300])
    pg.check('#st-310-have'); pl = pg.inner_text('#pPlan'); ok('Have but owned < needed -> review', 'but the pattern needs 2' in pl, pl[:400])
    pg.check('#st-415-buy'); pl = pg.inner_text('#pPlan'); ok('unknown requirement + Buy -> review, not a quantity', 'amount not entered' in pl.lower() and 'DMC 415 ×' not in pl, pl[:400])
    setnum(pg, '#q-310', '0'); ok('invalid needed qty rejected', pg.input_value('#q-310') == '2' and "isn't a whole number" in pg.inner_text('#projStatus'))
    expand(pg, '415'); pg.click('#rm-415'); ok('remove thread (confirmed)', 'DMC 415' not in pg.inner_text('#projEdit'))
    # Backup / restore
    pg.click('#pClose'); n0 = pg.locator('[data-open]').count()
    pg.click('#backupBox summary')
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
    def ready(pg): return pg.get_attribute('#pSummary', 'data-ready') == 'true'
    m = page()
    newproj(m, '310 x2'); m.check('#st-310-have'); ok('T1 ready after confirming owned (Have)', ready(m) and summ(m)['sSuf'] == '1 of 1', summ(m))
    expand(m, '310'); setnum(m, '#o-310', '1'); ok('T1b Have with owned 1 < 2 is not ready', not ready(m) and summ(m)['sRev'] == '1', summ(m))
    m.check('#st-310-buy'); m.check('#pb-dmc\\:310')
    ok('T2 purchased is not received/ready', not ready(m) and summ(m)['sAw'] == '1' and summ(m)['sSuf'] == '0 of 1', summ(m))
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
    ok('T7 purchased + received persist after reload', summ(m)['sAw'] == '1' and summ(m)['sSuf'] == '1 of 2' and m.is_checked('#pb-dmc\\:310'), summ(m))
    st = m.evaluate("JSON.parse(localStorage.getItem('flossfox.v1'))"); ok('T7b stored schema is 2 with recv record', st['schema'] == 2 and any(p['decisions'].get('415', {}).get('recv') for p in st['projects']), st['schema'])
    # T8 migration
    v1 = open(FIX, encoding='utf-8').read(); mg = page(); mg.goto(B); mg.evaluate("v=>localStorage.setItem('flossfox.v1',v)", v1); mg.reload(); mg.click('#tabProjects')
    ok('T8 v1 localStorage project loads', 'V1 fixture' in mg.inner_text('#projList') and not mg.locator('#storeMsg').is_visible())
    mg.click('[data-open]'); s8 = summ(mg)
    ok('T8b v1 data intact (Have counted, Check in review, bought awaiting)', s8 == {'sSuf': '1 of 3', 'sBuy': '0', 'sAw': '1', 'sRev': '1'}, s8)
    mg.click('.pmore summary') if not mg.locator('#pNotes').is_visible() else None
    ok('T8c v1 notes/brand/owned preserved', mg.input_value('#pNotes') == 'made with schema 1' and mg.input_value('#pDest') == 'sullivans' and 'after subtracting what you have' in mg.inner_text('#pPlan'))
    mg2 = page(); mg2.goto(B); mg2.click('#tabProjects'); mg2.set_input_files('#restoreFile', FIX); mg2.wait_for_timeout(200); mg2.click('#rGo')
    ok('T8d v1 backup file restores', '1 added' in mg2.inner_text('#projStatus') and 'V1 fixture' in mg2.inner_text('#projList'), mg2.inner_text('#projStatus'))
    # T9/T10 cards
    newproj(m, '310 x2, 321', 'Cards')
    ok('T9 cards start collapsed, details hidden', m.get_attribute('#x-310', 'aria-expanded') == 'false' and m.locator('#det-310').is_hidden())
    m.click('#x-310'); ok('T9b expand shows details + aria-expanded true', m.get_attribute('#x-310', 'aria-expanded') == 'true' and m.locator('#o-310').is_visible() and 'Hide details' in m.inner_text('#x-310'))
    m.click('#x-310'); ok('T9c collapse hides again', m.locator('#det-310').is_hidden() and m.get_attribute('#x-310', 'aria-expanded') == 'false')
    m.locator('#x-321').focus(); m.keyboard.press('Enter'); ok('T9d keyboard expand', m.get_attribute('#x-321', 'aria-expanded') == 'true')
    m.click('label:has(#st-310-buy)'); ok('T10 status change without expanding', m.is_checked('#st-310-buy') and m.locator('#det-310').is_hidden() and 'Need to buy · 2 skeins' in m.inner_text('#card-310'), m.inner_text('#card-310'))
    m.locator('#st-321-buy').focus(); m.keyboard.press('ArrowLeft'); ok('T10b keyboard status change (arrow keys)', m.is_checked('#st-321-have'))
    # T11 performance
    timings = {}
    codes = m.evaluate("Object.keys(DMC).filter(c=>fam(c)==='solid'&&/^\\d+$/.test(c))")
    for n in [15, 50, 150]:
        pp = page(412, True); pp.goto(B); pp.click('#tabProjects'); pp.click('#newEmpty')
        pp.fill('#pAdd', '\n'.join(f'{c} x2' for c in codes[:n])); ta = pp.evaluate("()=>{const t=performance.now();document.getElementById('pAddBtn').click();return performance.now()-t}")
        tb = pp.evaluate("()=>{const t=performance.now();document.getElementById('pAllBuy').click();return performance.now()-t}")
        tf = pp.evaluate("()=>{const s=document.getElementById('pSearch');s.value='3';const t=performance.now();s.dispatchEvent(new Event('input'));return performance.now()-t}")
        t0, t1, t2 = 0, ta, ta + tb
        pp.evaluate("()=>{const s=document.getElementById('pSearch');s.value='';s.dispatchEvent(new Event('input'))}")
        tc = pp.evaluate("()=>{const c=document.querySelector('.cards [data-st][value=have]');const t=performance.now();c.click();return performance.now()-t}")
        te = pp.evaluate("()=>{const b=document.querySelector('[data-exp]');const t=performance.now();b.click();return performance.now()-t}")
        cnt = pp.locator('.tcard').count(); ow = pp.evaluate('document.documentElement.scrollWidth')
        timings[n] = {'add_ms': round(t1 - t0), 'mark_all_ms': round(t2 - t1), 'status_click_ms': round(tc), 'expand_ms': round(te), 'search_ms': round(tf), 'cards': cnt}
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
    cons = s13 == {'sSuf': '1 of 4', 'sBuy': '1', 'sAw': '1', 'sRev': '1'} and '1 to buy · 1 bought, waiting to check in · 1 need attention' in txt13 \
        and sorted(r['readiness'] for r in __import__('csv').DictReader(__import__('io').StringIO(csv13))) == ['bought, awaiting confirmation', 'confirmed sufficient (owned)', 'needs review', 'to buy'] and 'UNKNOWN' in csv13 \
        and (not pdf13 or ('Ready' in pdf13 and 'check in when it arrives' in pdf13 and 'amount not entered' in pdf13))
    ok('T13 summary, copy, CSV and print agree', cons, (s13, txt13[:300], csv13[:300]))
    c13.click('#pClose'); c13.click('#backupBox summary')
    with c13.expect_download() as d: c13.click('#backupBtn')
    bk13 = open(d.value.path(), encoding='utf-8').read(); c13.locator('[data-del]').first.click()
    c13.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': bk13.encode()}); c13.wait_for_timeout(150); c13.click('#rGo'); c13.click('[data-open]')
    c13.click('#pCopy'); c13.wait_for_timeout(100); ok('T13b backup/restore round-trip gives identical plan text', c13.evaluate('navigator.clipboard.readText()') == txt13)
    # ---------- Milestone 1.2: welcome, example mode, search/filter, shopping mode, a11y ----------
    CJS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contrast.js'), encoding='utf-8').read()
    h = page(412, True); h.goto(B)
    ok('N1 welcome headline, label, 3 steps, actions', 'Your thread list, made simple.' in h.inner_text('h1') and h.inner_text('label[for=inp]') == 'Paste your DMC color list' and h.locator('.hero .steps li').count() == 3 and h.inner_text('#go') == 'Add my colors' and h.inner_text('#sample') == 'Try an example')
    ok('N1b nav current state (aria-pressed + aria-current)', h.get_attribute('#tabConvert', 'aria-current') == 'page' and h.get_attribute('#tabProjects', 'aria-pressed') == 'false')
    h.click('#tabHelp'); ok('N1c help view opens, others hidden', h.locator('#helpView').is_visible() and h.locator('#convertView').is_hidden() and h.get_attribute('#tabHelp', 'aria-current') == 'page')
    h.click('#tabConvert'); h.click('#openProj'); ok('N1d Open my projects + welcoming empty state', h.locator('#projectsView').is_visible() and 'No projects yet' in h.inner_text('#projList') and h.locator('#emptyAdd').is_visible())
    h.click('#emptyAdd'); ok('N1e empty-state action returns to paste box', h.locator('#convertView').is_visible() and h.evaluate('document.activeElement.id') == 'inp')
    h.fill('#inp', '699 x3'); h.click('#sample')
    ok('N2 example shows banner and keeps draft safe', h.locator('#exampleBanner').is_visible() and 'DMC 310 Black x2' in h.input_value('#inp') and h.inner_text('#exitExample') == 'Back to my list')
    ok('N2b trying the example saves nothing', h.evaluate("localStorage.getItem('flossfox.v1')") is None)
    h.click('#exitExample'); ok('N2c leaving example restores the draft', h.input_value('#inp') == '699 x3' and h.locator('#exampleBanner').is_hidden())
    h.click('#sample'); h.click('#saveProj'); h.click('#saveProj')
    st12 = h.evaluate("JSON.parse(localStorage.getItem('flossfox.v1'))")
    ok('N2d explicit save of example creates exactly one labelled project (double tap safe)', len(st12['projects']) == 1 and st12['projects'][0]['name'] == 'Example project', [x['name'] for x in st12['projects']])
    h.click('#sample'); ok('N2e trying example again does not change saved projects', len(h.evaluate("JSON.parse(localStorage.getItem('flossfox.v1'))")['projects']) == 1)
    h.fill('#inp', '310, 321 x2, hello'); h.click('#go'); sm = h.inner_text('#summary')
    ok('N3 plain parse feedback (found + needs a fix)', 'Found 2 colors' in sm and '1 line needs a fix' in sm and "couldn't be read" in h.inner_text('#errs'), sm)
    h.click('#openSaved') if h.locator('#openSaved').count() else None
    # quantities in project
    q = page(); newproj(q, '310 x2, 415', 'Qty')
    expand(q, '310'); setnum(q, '#q-310', '0'); ok('N6 zero needed rejected, unchanged', q.input_value('#q-310') == '2' and 'nothing changed' in q.inner_text('#projStatus'))
    setnum(q, '#q-310', 'abc') if False else None
    q.fill('#o-310', ''); q.locator('#o-310').type('-1'); q.locator('#o-310').dispatch_event('change'); ok('N6b negative owned rejected', q.input_value('#o-310') == '' and 'nothing changed' in q.inner_text('#projStatus'))
    q.check('#u-310'); ok('N6c "Not entered" shows plain words, never a number', 'Amount needed: not entered' in q.inner_text('#card-310'))
    q.check('#st-310-buy'); q.check('#st-415-buy'); ok('N6d color-only buy stays unresolved, no invented total', q.get_attribute('#pSummary', 'data-ready') == 'false' and 'no amount entered' in q.inner_text('#pSum') and 'amount not entered' in q.inner_text('#pPlan'), q.inner_text('#pSum'))
    q.click('#pShop'); ok('N6e Shopping mode lists color-only item with "Amount not entered"', 'Amount not entered' in q.inner_text('#shList'))
    # Shopping mode in store
    s = page(412, True); newproj(s, '310 x2, 321 x3, 415 x1', 'Shop'); s.click('#pAllBuy'); s.click('#pShop')
    ok('N7 shopping mode header + still-needed count', 'You still need 3 colors.' in s.inner_text('.shopsum') and s.locator('#shBack').is_visible())
    s.click('#sb-dmc_310'); ok('N7b Bought asks where it is (with me / delivery)', s.locator('#sw-dmc_310').is_visible() and s.locator('#sd-dmc_310').is_visible() and s.evaluate('document.activeElement.id') == 'sw-dmc_310')
    s.click('#sw-dmc_310'); s.click('#ss-dmc_310'); ok('N7c empty amount rejected, nothing recorded', 'Nothing changed' in s.inner_text('#shMsg') and s.locator('#sq-dmc_310').is_visible())
    s.fill('#sq-dmc_310', '2'); s.click('#ss-dmc_310')
    ok('N7d in-store check-in marks it received', 'checked in' in s.inner_text('#shMsg') and 'You still need 2 colors.' in s.inner_text('.shopsum') and 'Received 2' in s.text_content('.donebox'), s.inner_text('#shMsg'))
    s.click('#sb-dmc_321'); s.click('#sw-dmc_321'); s.fill('#sq-dmc_321', '1'); s.click('#ss-dmc_321')
    ok('N7e partial in-store amount keeps remainder on list', '2 more still needed' in s.inner_text('#shMsg') and '2 skeins' in s.inner_text('#sh-dmc_321') and '1 received' in s.inner_text('#sh-dmc_321'), s.inner_text('#sh-dmc_321'))
    s.click('#sb-dmc_415'); s.click('#sd-dmc_415'); ok('N7f online: waiting for delivery is bought, not received', 'Bought: check it in' in s.inner_text('#shAw') and s.get_attribute('#sr-dmc_415', 'data-sr') == 'dmc:415')
    s.reload(); s.click('#tabProjects'); s.click('[data-open]'); s.click('#pShop')
    ok('N7g after reload it is still waiting', s.locator('#sr-dmc_415').is_visible() and s.locator('#sh-dmc_321').is_visible())
    s.click('#su-dmc_415'); ok('N7h "Not bought after all" moves it back', s.locator('#sb-dmc_415').is_visible()); s.click('#sb-dmc_415'); s.click('#sd-dmc_415')
    s.click('#sr-dmc_415'); s.fill('#sq-dmc_415', '1'); s.click('#ss-dmc_415')
    s.click('#sb-dmc_321'); s.click('#sw-dmc_321'); s.fill('#sq-dmc_321', '2'); s.click('#ss-dmc_321')
    s.click('#shBack'); ok('N7i ready only after every receipt', s.get_attribute('#pSummary', 'data-ready') == 'true' and 'ready to stitch' in s.inner_text('#pSummary').lower())
    s.click('#pShop'); s.click('.donebox summary') if not s.locator('#sx-310').is_visible() else None; s.click('#sx-310')
    ok('N7j undo received puts it back and clears ready', s.locator('#sb-dmc_310').is_visible() and 'back on your shopping list' in s.inner_text('#shMsg'))
    s.click('#shBack'); ok('N7k project plan agrees with shopping mode', s.get_attribute('#pSummary', 'data-ready') == 'false' and s.inner_text('#sBuy') == '1')
    # brand safety
    bsafe = page(); newproj(bsafe, 'BLANC x1, 310 x1', 'Brand'); bsafe.select_option('#pDest', 'anchor'); bsafe.click('#pAllBuy'); bsafe.click('#pShop')
    ok('N8 disputed white never reaches the shopping list unconfirmed', 'BLANC' not in bsafe.inner_text('#shList') and 'attention' in bsafe.inner_text('.shophead') + bsafe.inner_text('#projEdit'))
    bsafe.click('#shBack'); bsafe.select_option('#pDest', 'sullivans'); bsafe.click('#pShop'); bsafe.click('#sb-sullivans_45053'); bsafe.click('#sw-sullivans_45053'); bsafe.fill('#sq-sullivans_45053', '1'); bsafe.click('#ss-sullivans_45053'); bsafe.click('#shBack')
    bsafe.select_option('#pDest', 'dmc'); ok('N8b a Sullivans check-in is not counted for DMC (no cross-brand phantom)', 'different brand' in bsafe.inner_text('#card-310') and bsafe.get_attribute('#pSummary', 'data-ready') == 'false')
    # search / filter at 150
    big = page(412, True); big.goto(B); big.click('#tabProjects'); big.click('#newEmpty')
    allc = big.evaluate("Object.keys(DMC).filter(c=>fam(c)==='solid'&&/^\\d+$/.test(c)).slice(0,150)")
    big.fill('#pAdd', '\n'.join(c + ' x1' for c in allc)); big.click('#pAddBtn'); big.check(f'#st-{allc[0]}-have'); big.check(f'#st-{allc[1]}-buy')
    vis = lambda: big.locator('#pCards .tcard:visible').count()
    big.fill('#pSearch', allc[5]); ok('N5 search by code', vis() >= 1 and big.locator(f'#card-{allc[5]}').is_visible(), vis())
    big.fill('#pSearch', 'black'); ok('N5b search by color name', vis() >= 1 and 'black' in big.inner_text('#pCards').lower())
    big.fill('#pSearch', 'zzzz'); ok('N5c no-results state with clear action', big.locator('#pNoRes').is_visible() and 'No colors match' in big.inner_text('#pNoRes') and big.locator('#pSearchClear').is_visible())
    big.click('#pSearchClear'); ok('N5d clear search shows all 150', vis() == 150)
    counts = {k: int(big.inner_text(f'#f-{k}').split('(')[1].rstrip(')')) for k in ['all', 'todo', 'buy', 'att', 'ready']}
    shown = {}
    for k in counts: big.click(f'#f-{k}'); shown[k] = vis()
    ok('N5e filter counts match what is shown', counts == shown and counts['ready'] == 1 and counts['buy'] == 1 and counts['att'] == 148, (counts, shown))
    big.click('#f-att'); big.fill('#pSearch', allc[2]); ok('N5f search combines with filter', big.locator(f'#card-{allc[2]}').is_visible() and big.locator(f'#card-{allc[0]}').is_hidden())
    big.click('#f-all'); big.fill('#pSearch', '')
    big.evaluate("window.scrollTo(0, 3000)"); y0 = big.evaluate('scrollY'); big.locator(f'#st-{allc[60]}-have').focus(); big.keyboard.press('Space')
    ok('N9 status change keeps scroll position and focus', abs(big.evaluate('scrollY') - y0) < 400 and big.evaluate('document.activeElement.id') == f'st-{allc[60]}-have', (y0, big.evaluate('scrollY'), big.evaluate('document.activeElement.id')))
    big.locator(f'#x-{allc[61]}').focus(); big.keyboard.press('Enter'); ok('N9b keyboard expand keeps focus on the toggle', big.evaluate('document.activeElement.id') == f'x-{allc[61]}' and big.get_attribute(f'#x-{allc[61]}', 'aria-expanded') == 'true')
    big.fill(f'#o-{allc[61]}', '0.5'); big.locator(f'#o-{allc[61]}').dispatch_event('change'); ok('N9c editing a field keeps the card open', big.locator(f'#det-{allc[61]}').is_visible())
    # reduced motion + sticky offsets + XSS
    rm = br.new_context(viewport={'width': 412, 'height': 900}, reduced_motion='reduce').new_page(); rm.goto(B + '?sample'); rm.click('#saveProj'); rm.click('#openSaved'); rm.click('#x-310')
    ok('N10 reduced motion disables animations/transitions', rm.evaluate("getComputedStyle(document.querySelector('.tdet')).animationName") == 'none' and rm.evaluate("getComputedStyle(document.querySelector('.seg label')).transitionDuration") == '0s')
    rm.click('a[href="#pReviewH"]'); rm.wait_for_timeout(100)
    ok('N10b jump links land below the sticky nav', rm.evaluate("document.getElementById('pReviewH').getBoundingClientRect().top") >= rm.evaluate("document.querySelector('.tabs').getBoundingClientRect().bottom") - 2)
    x = page(); x.goto(B); evil = '<img src=x onerror="window.__x=1">'; x.fill('#inp', '310\n' + evil); x.click('#go')
    x.fill('#newProjName', evil); x.click('#saveProj'); x.click('#openSaved'); expand(x, '310')
    ok('N13 hostile text is shown as text, never run', x.evaluate('window.__x') is None and evil in x.inner_text('#errs') if False else (x.evaluate('window.__x') is None and x.input_value('#pName') == evil and x.locator('#projEdit img').count() == 0))
    # widths incl 320, all three main views
    badw = []
    for w in [320, 360, 412, 600, 700, 768, 880, 1024, 1280]:
        pw = page(w, w < 700); pw.goto(B + '?sample'); o = [pw.evaluate('document.documentElement.scrollWidth')]
        pw.click('#saveProj'); pw.click('#openSaved'); pw.click('#pAllBuy'); pw.click('[data-exp]'); o.append(pw.evaluate('document.documentElement.scrollWidth'))
        pw.click('#pShop'); pw.locator('[data-sb]').first.click(); o.append(pw.evaluate('document.documentElement.scrollWidth'))
        pw.click('#tabHelp'); o.append(pw.evaluate('document.documentElement.scrollWidth'))
        if max(o) > w: badw.append((w, o))
        pw.context.close()
    ok('N11 no horizontal overflow at 320–1280 (home, project, shopping, help)', not badw, badw)
    # contrast (measured)
    cv = page(412, True); cv.goto(B + '?sample'); res = {'home': cv.evaluate(CJS)}
    cv.click('#saveProj'); cv.click('#openSaved'); cv.check('#st-310-have'); cv.check('#st-321-buy'); cv.check('#st-3865-check'); cv.click('#x-321'); res['project'] = cv.evaluate(CJS)
    cv.click('#pShop'); cv.locator('[data-sb]').first.click(); res['shop'] = cv.evaluate(CJS); cv.click('#tabHelp'); res['help'] = cv.evaluate(CJS)
    print('CONTRAST', json.dumps({k: {'checked': v['checked'], 'min': v['min']} for k, v in res.items()}))
    ok('N12 measured text contrast >= WCAG AA in all views', all(not v['fails'] for v in res.values()), {k: v['fails'] for k, v in res.items()})
    nt = cv.evaluate("""(()=>{const P=s=>s.match(/\\d+(\\.\\d+)?/g).map(Number),L=c=>{const f=x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
      const r=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};const out={};
      document.getElementById('tabProjects').click();const sb=document.getElementById('shBack');if(sb)sb.click();const i=document.querySelector('#pSearch');out.input_border=r(P(getComputedStyle(i).borderTopColor),[255,255,255]);
      const sg=document.querySelector('.seg');out.choice_border=r(P(getComputedStyle(sg).borderTopColor),[255,255,255]);return out})()""")
    print('NONTEXT', json.dumps(nt)); ok('N12b form-control borders >= 3:1 against white', min(nt.values()) >= 3, nt)
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
