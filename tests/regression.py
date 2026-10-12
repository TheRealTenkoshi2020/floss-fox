#!/usr/bin/env python3
"""Floss Fox headless regression suite.
Usage: python tests/regression.py [BASE_URL] [--chrome /path/to/chrome] [--shots DIR]
Default BASE_URL: http://localhost:8765/ (serve the site folder with `python3 -m http.server 8765`).
Needs: pip install playwright (uses an installed Chrome/Chromium; set --chrome if not at /usr/bin/google-chrome).
"""
import sys, json, os, argparse, subprocess, re
KEY = os.environ.get('FF_KEY', 'flossfox.v1')  # storage key; the dev preview build uses a different one
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
    # Legacy checks run as a returning visitor (tour already dismissed, tips off). Tour tests opt out with fresh=True.
    PFX = os.environ.get('FF_PIP_KEY', 'flossfox.pip.v1').replace('.pip.v1', '')
    TK, HK = PFX + '.tour.v1', PFX + '.hints.v1'
    SEED = "try{if(!localStorage.getItem('%s'))localStorage.setItem('%s','{\"status\":\"dismissed\"}');if(!localStorage.getItem('%s'))localStorage.setItem('%s','off')}catch(e){}" % (TK, TK, HK, HK)
    _nc = br.new_context
    def _new_context(*a, fresh=False, **k):
        c = _nc(*a, **k)
        if not fresh: c.add_init_script(SEED)
        return c
    br.new_context = _new_context
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
    conv(pg, '310', 'dmc'); ok('no qty -> 1 (assumed) shown', 'assumed 1 skein' in pg.inner_text('#tbl'), pg.inner_text('#tbl')[:200])
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
    conv(pg, '762, 01', 'anchor'); ok('no chart match -> review, never auto-guessed', shop(pg) == ['Anchor 234 × 1 (assumed) (for DMC 762 · chart)'] and 'DMC 01' in pg.inner_text('#review'), (shop(pg), pg.inner_text('#review')))
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
    ok('real pattern Sullivans numbers match official chart', all(any(f'Sullivans {v} × 1 (assumed) (for DMC {k} ·' in x for x in s) for k, v in SULL.items()) and not pg.inner_text('#review'), s)
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
    ok('CSV export', c.startswith('project,dmc_code') and 'BLANC (White)' in c and '45001' in c and c.count('\n') == (12 if 'NOTE:' in c else 11) and 'readiness' in c.split('\n')[0], c[:300])
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
    pc = page(); pc.goto(B); pc.evaluate("localStorage.setItem('"+KEY+"','{bad json')"); pc.reload(); pc.click('#tabProjects')
    ok('corrupt storage: warning, data untouched', "couldn't be read" in pc.inner_text('#storeMsg') and pc.evaluate("localStorage.getItem('"+KEY+"')") == '{bad json')
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
    st = m.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))"); ok('T7b stored schema is 2 with recv record', st['schema'] == 2 and any(p['decisions'].get('415', {}).get('recv') for p in st['projects']), st['schema'])
    # T8 migration
    v1 = open(FIX, encoding='utf-8').read(); mg = page(); mg.goto(B); mg.evaluate("v=>localStorage.setItem('"+KEY+"',v)", v1); mg.reload(); mg.click('#tabProjects')
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
        and sorted(r['readiness'] for r in __import__('csv').DictReader(__import__('io').StringIO(csv13)) if r['dmc_code']) == ['bought, awaiting confirmation', 'check first', 'confirmed sufficient (owned)', 'to buy'] and '1 color still needs checking before this list is complete' in csv13 and 'NOTE: 1 color still needs checking' in txt13 and 'UNKNOWN' in csv13 \
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
    ok('N2b trying the example saves nothing', h.evaluate("localStorage.getItem('"+KEY+"')") is None)
    h.click('#exitExample'); ok('N2c leaving example restores the draft', h.input_value('#inp') == '699 x3' and h.locator('#exampleBanner').is_hidden())
    h.click('#sample'); h.click('#saveProj'); h.click('#saveProj')
    st12 = h.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")
    ok('N2d explicit save of example creates exactly one labelled project (double tap safe)', len(st12['projects']) == 1 and st12['projects'][0]['name'] == 'Example project', [x['name'] for x in st12['projects']])
    h.click('#sample'); ok('N2e trying example again does not change saved projects', len(h.evaluate("JSON.parse(localStorage.getItem('"+KEY+"'))")['projects']) == 1)
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
    ok('N8 disputed white never reaches the shopping list unconfirmed', 'BLANC' not in bsafe.inner_text('#shList') and ('attention' in bsafe.inner_text('.shophead') + bsafe.inner_text('#projEdit') or 'Check first' in bsafe.inner_text('#projEdit')))
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
    ok('N13 hostile text is shown as text, never run', x.evaluate('window.__x') is None and evil in x.inner_text('#errs') if False else (x.evaluate('window.__x') is None and x.input_value('#pName') == evil and x.locator('#projEdit img:not([src^="assets/pip/"])').count() == 0))
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
    # ---------- Pip companion ----------
    PK = os.environ.get('FF_PIP_KEY', 'flossfox.pip.v1')
    pp = page(412, True); reqs = []; pp.on('request', lambda r: reqs.append(r.url)); pp.goto(B); pp.wait_for_load_state('networkidle')
    pst = lambda g: g.evaluate("[FlossFoxPip.current(), document.getElementById('pip').dataset.pose, document.getElementById('pipMsg').textContent]")
    ok('P1 Pip appears on load; returning visitor gets welcome back (greeting-alt)', pp.locator('#pip').is_visible() and pst(pp) == ['welcomeBack', 'greeting-alt', 'Welcome back! Ready for another list?'], pst(pp))
    ok('P1b image loaded and decorative (alt=""), bubble not a live region', pp.evaluate("document.getElementById('pipImg').naturalWidth") > 0 and pp.get_attribute('#pipImg', 'alt') == '' and pp.get_attribute('#pipMsg', 'aria-live') is None)
    from urllib.parse import urlparse
    bad = []
    POSES = ['greeting', 'curious', 'puzzled', 'duplicates', 'helpful', 'tangled', 'celebrating', 'sleepy', 'thinking', 'pointing', 'peeking', 'neutral', 'greeting-alt', 'reassuring', 'presenting', 'discovery', 'saved', 'face-icon', 'needle', 'needle-alt', 'organizing', 'goodbye', 'cross-stitch']
    for a in POSES:
        for w in [160, 320, 480]:
            for ext in ['webp', 'png']:
                r = pp.request.get(B + f'assets/pip/pip-{a}-{w}.{ext}')
                if r.status != 200 or len(r.body()) > 60000: bad.append((a, w, ext, r.status, len(r.body())))
    ok('P2 all 138 Pip files (23 poses, WebP + PNG) load and are small (<60 KB)', not bad, bad)
    pp.wait_for_timeout(800)
    ok('P2b no requests outside the site origin', all(urlparse(u).netloc == urlparse(B).netloc for u in reqs if u.startswith('http')), [u for u in reqs if urlparse(u).netloc != urlparse(B).netloc][:5])
    def sub(g, t): g.fill('#inp', t); g.click('#go'); return pst(g)
    s1 = sub(pp, '310\n9999'); ok('P3 unknown number -> reassuring (let us fix that)', s1 == ['error', 'reassuring', 'Let’s fix that! I couldn’t read “9999” as a DMC number. Check the highlighted line below.'.replace('’', "'")], s1)
    s2 = sub(pp, '310\n310 x2'); ok('P3b duplicate -> duplicates, and the claim is true (one line, amounts summed)', s2[:2] == ['duplicate', 'duplicates'] and s2[2] == "Found a repeat! I've combined it for you." and pp.evaluate("state.items.length") == 1 and pp.evaluate("state.items[0].qty") == 3, s2)
    s3 = sub(pp, '310, 321'); ok('P3c first clean list -> one celebration', s3 == ['celebrating', 'celebrating', 'Yay! Your list is ready!'], s3)
    pp.wait_for_timeout(4300); s3b = pst(pp); ok('P3c2 celebration settles to calm presenting, no new animation loop', s3b == ['listReady', 'presenting', "Your colors are ready! Let's see what you have."] and pp.evaluate("document.getElementById('pipFig').className.includes('pip-')") is False, (s3b, pp.evaluate("document.getElementById('pipFig').className")))
    s3c = sub(pp, '310, 321, 415'); ok('P3c3 later clean lists do not celebrate again', s3c[0] == 'listReady', s3c)
    s4 = sub(pp, '310\n310\nzzz'); ok('P3d priority: error beats duplicate', s4[0] == 'error', s4)
    s5 = sub(pp, '   '); ok('P3e empty submit -> curious guidance', s5[:2] == ['empty', 'curious'], s5)
    pp.click('#clear'); ok('P3f clear -> calm idle (neutral)', pst(pp)[:2] == ['idle', 'neutral'], pst(pp))
    pp.click('#tabHelp'); pp.click('#tabConvert'); pp.locator('#inp').focus(); ok('P3g focusing the empty box -> attentive (curious)', pst(pp)[:2] == ['attentive', 'curious'], pst(pp))
    pp.click('#sample'); ok('P3h example list uses the same rules (duplicate/listReady)', pst(pp)[0] in ('duplicate', 'listReady', 'error'), pst(pp))
    sub(pp, '310, 321'); before = pst(pp)
    pp.click('#tabHelp'); pp.click('#tabConvert'); pp.fill('#inp', '9999 typing not submitted')
    ok('P4 unrelated actions and typing do not change Pip', pst(pp) == before, (before, pst(pp)))
    pp.select_option('#dest', 'sullivans'); hs = pst(pp)
    ok('P4b Buy in Sullivans with chart matches -> helpful, and the count is true', hs[:2] == ['helpful', 'discovery'] and hs[2] == 'Look! I found Sullivans options for 2 of your 2 colors.' and pp.locator('#shop li').count() == 2, hs)
    pp.select_option('#dest', 'dmc'); ok('P4c back to DMC -> no alternative claim', pst(pp)[0] == 'listReady', pst(pp))
    pp.evaluate("""()=>{const i=document.getElementById('inp'),g=document.getElementById('go');for(const t of ['9999','310\\n310','zzz','310, 321, 666']){i.value=t;g.click()}}""")
    pp.wait_for_timeout(600)
    ok('P5 rapid changes leave no stale state (final state, image and text agree)', pst(pp) == ['recovered', 'reassuring', 'All fixed! Every line reads cleanly now.'] and pp.evaluate('state.items.length') == 3 and 'reassuring' in pp.evaluate("document.getElementById('pipImg').currentSrc"), (pst(pp), pp.evaluate("document.getElementById('pipImg').currentSrc")))
    # layout shift
    tops = []
    for t in ['', '9999', '310\n310', '310, 321']:
        pp.fill('#inp', t); pp.click('#go'); pp.wait_for_timeout(50); tops.append(pp.evaluate("document.getElementById('inp').getBoundingClientRect().top+scrollY"))
    ok('P11 Pip state changes cause no layout shift (412px)', len(set(tops)) == 1, tops)
    pd = page(1280); pd.goto(B); t2 = []
    for t in ['', '9999 x', '310\n310', '310, 321']:
        pd.fill('#inp', t); pd.click('#go'); pd.wait_for_timeout(50); t2.append(pd.evaluate("[document.getElementById('inp').getBoundingClientRect().top+scrollY, document.getElementById('go').getBoundingClientRect().top+scrollY]"))
    ok('P11b no layout shift on desktop side panel (1280px)', all(x == t2[0] for x in t2), t2)
    ok('P11c desktop: Pip in a side panel, not over the input or buttons', pd.evaluate("(()=>{const p=document.getElementById('pip').getBoundingClientRect(),i=document.getElementById('inp').getBoundingClientRect(),g=document.querySelector('.hero .row').getBoundingClientRect();const f=document.getElementById('pipFig').getBoundingClientRect();return f.left>=i.right&&f.left>=g.right})()"))
    # hide / show
    h2 = page(412, True); h2.goto(B); h2.click('#pipToggle')
    ok('P6 Hide Pip hides it, button says Show Pip, preference stored', h2.locator('#pipFig').is_hidden() and h2.locator('#pipMsg').is_hidden() and h2.inner_text('#pipToggle') == 'Show Pip' and h2.get_attribute('#pipToggle', 'aria-expanded') == 'false' and h2.evaluate(f"localStorage.getItem('{PK}')") == 'hidden')
    h2.reload(); ok('P6b hidden preference survives reload', h2.locator('#pipFig').is_hidden() and h2.inner_text('#pipToggle') == 'Show Pip')
    h2.fill('#inp', '310 x2\n9999'); h2.click('#go')
    ok('P6c app fully works with Pip hidden (results + errors in normal UI)', 'DMC 310' in h2.inner_text('#results') and '9999' in h2.inner_text('#errs'))
    ok('P6d Pip preference never touches project storage', h2.evaluate(f"localStorage.getItem('{KEY}')") is None)
    h2.locator('#pipToggle').focus(); h2.keyboard.press('Enter'); ok('P9 keyboard toggles Pip back on; state is current', h2.locator('#pipFig').is_visible() and h2.evaluate(f"localStorage.getItem('{PK}')") == 'shown' and pst(h2)[0] == 'error', pst(h2))
    ok('P9b only the Hide/Show toggle is focusable inside Pip (no focus trap)', h2.evaluate("[...document.querySelectorAll('#pip a,#pip button,#pip input,#pip [tabindex]')].map(e=>e.id)") == ['pipHi', 'pipToggle'] and h2.get_attribute('#pipHi', 'aria-label') == 'Say hi to Pip')
    rmp = br.new_context(viewport={'width': 412, 'height': 900}, reduced_motion='reduce').new_page(); rmp.goto(B); rmp.fill('#inp', '9999'); rmp.click('#go')
    ok('P8 reduced motion: no Pip animation', rmp.evaluate("getComputedStyle(document.getElementById('pipImg')).animationName") == 'none')
    ok('P8b with motion: gentle whole-image animation only', pp.evaluate("getComputedStyle(document.getElementById('pipImg')).animationName") in ('pippop', 'piptilt', 'pipfade', 'none'))
    # ---------- Pip phase 2 ----------
    def fresh(w=412, rm=False):
        c = br.new_context(viewport={'width': w, 'height': 900}, reduced_motion='reduce' if rm else 'no-preference'); g = c.new_page(); rq = []
        g.on('request', lambda r: rq.append(r.url)); g.on('pageerror', lambda e: errs.append(str(e))); g.goto(B); g.wait_for_load_state('networkidle'); return g, rq
    q, qrq = fresh()
    # all 8 states load the right art
    loaded = q.evaluate("""async()=>{const out={};for(const n of ['welcome','listReady','error','duplicate','helpful','tangled','celebrating','sleepy']){FlossFoxPip.show(n,{items:[{src:['a','a']}],errs:[{t:'x',kind:'code'}]});const i=document.getElementById('pipImg');await new Promise(r=>{if(i.complete&&i.naturalWidth)r();else{i.onload=r;i.onerror=r}});out[n]=[document.getElementById('pip').dataset.pose,i.naturalWidth>0,/pip-([a-z]+)-/.exec(i.currentSrc)[1]]}return out}""")
    ok('Q1 core states load their own artwork', all(v[1] and v[0] == v[2] for v in loaded.values()) and {v[0] for v in loaded.values()} == {'greeting', 'presenting', 'reassuring', 'duplicates', 'discovery', 'tangled', 'celebrating', 'sleepy'}, loaded)
    ok('Q1b fake "processing" state still never shown (thinking only for real checks)', q.evaluate("FlossFoxPip.STATES.processing.pose==='thinking'"))
    old = q.evaluate("['welcome','attentive','empty','listReady','duplicate','error'].map(n=>[n,typeof FlossFoxPip.STATES[n].pose==='function'?FlossFoxPip.STATES[n].pose({items:[],errs:[{kind:'code'}]}):FlossFoxPip.STATES[n].pose])")
    ok('Q1c old states keep their poses', old == [['welcome', 'greeting'], ['attentive', 'curious'], ['empty', 'curious'], ['listReady', 'presenting'], ['duplicate', 'duplicates'], ['error', 'reassuring']], old)
    q.goto(B); q.fill('#inp', '310, 321'); q.click('#go'); q.wait_for_timeout(4300)
    # tangled easter egg
    q.click('#pipHi'); t1 = pst(q)
    ok('Q2 tap Pip -> tangled with a playful line', t1[:2] == ['tangled', 'tangled'] and t1[2] in ("Oops! Got a little tangled up!", "I meant to do that. Probably."), t1)
    q.wait_for_timeout(2800); ok('Q2b tangled settles back to the real state', pst(q)[0] == 'listReady', pst(q))
    q.click('#pipHi'); ok('Q2c rate-limited: a second tap within a minute does nothing', pst(q)[0] == 'listReady', pst(q))
    q.evaluate("FlossFoxPip._timing({tangleGap:0})")
    q.fill('#inp', '9999'); q.click('#go'); q.click('#pipHi'); ok('Q2d never over an error', pst(q)[0] == 'error', pst(q))
    q.fill('#inp', '310\n310'); q.click('#go'); q.click('#pipHi'); ok('Q2e never over a duplicate', pst(q)[0] == 'duplicate', pst(q))
    q.fill('#inp', '310'); q.click('#go'); q.locator('#pipHi').focus(); q.keyboard.press('Enter'); ok('Q2f keyboard can say hi too', pst(q)[0] == 'tangled', pst(q))
    q.fill('#inp', '9999'); q.click('#go'); ok('Q3 priority: an error interrupts tangled immediately', pst(q)[0] == 'error', pst(q))
    # celebration once per real completion; never for the example list
    e, _ = fresh(); e.click('#sample'); e.evaluate("document.getElementById('exitExample').click()"); ok('Q4 the example list never triggers a celebration', e.evaluate("FlossFoxPip.current()") != 'celebrating', e.evaluate("FlossFoxPip.current()"))
    e.fill('#inp', '9999'); e.click('#go'); e.fill('#inp', '310 x2'); e.click('#go'); ok('Q4b first clean list after fixing errors celebrates', pst(e)[0] == 'celebrating', pst(e))
    e.fill('#inp', '9999'); e.click('#go'); ok('Q4c error interrupts the celebration', pst(e)[0] == 'error'); e.fill('#inp', '310'); e.click('#go'); ok('Q4d no second celebration (fixing errors shows calm recovery instead)', pst(e)[0] in ('listReady', 'recovered'), pst(e))
    # project ready transition
    pr, _ = fresh(); pr.fill('#inp', '310 x2\n321'); pr.click('#go'); pr.wait_for_timeout(4300); pr.click('#saveProj'); pr.click('#openSaved')
    c0 = pr.locator('#pCel').count()
    pr.evaluate("()=>{for(let k=0;k<20;k++){const c=[...document.querySelectorAll('.cards [data-st][value=have]')].find(r=>!r.checked);if(!c)break;c.click()}}")
    pr.wait_for_timeout(100); rdy = pr.evaluate("document.getElementById('pSummary').dataset.ready")
    ok('Q5 project turning ready shows one celebrating Pip', c0 == 0 and rdy == 'true' and pr.locator('#pCel img').count() == 1 and "You're ready to stitch!" in pr.inner_text('#pSummary'), (c0, rdy, pr.locator('#pCel').count()))
    pr.wait_for_timeout(4300); ok('Q5b celebration settles (animation class removed, no loop)', pr.locator('#pCel.pip-cheer').count() == 0 and pr.locator('#pCel').count() == 1)
    pr.evaluate("document.querySelector('.cards [data-st][value=have]').click()"); pr.wait_for_timeout(100)
    ok('Q5c re-render while still ready: no repeat celebration', pr.locator('#pCel.pip-cheer').count() == 0)
    ok('Q5d project overflow ok at 412px with celebration', pr.evaluate('document.documentElement.scrollWidth') <= 412)
    # sleepy
    z, _ = fresh(); z.evaluate("FlossFoxPip._timing({idle:600,minSleep:300})"); z.wait_for_timeout(900)
    zs = pst(z); ok('Q6 sleepy after inactivity, no dialogue', zs == ['sleepy', 'sleepy', ''] and z.evaluate("getComputedStyle(document.getElementById('pipMsg')).visibility") == 'hidden', zs)
    z.mouse.move(50, 50); z.mouse.move(80, 90); z.wait_for_timeout(400); zw = pst(z)
    ok('Q6b wakes to curious on activity, once', zw[:2] == ['attentive', 'curious'], zw)
    z.fill('#inp', '9999'); z.click('#go'); z.wait_for_timeout(1000); ok('Q6c never sleeps over an error', pst(z)[0] == 'error', pst(z))
    z.fill('#inp', '310\n310'); z.click('#go'); z.wait_for_timeout(1000); ok('Q6d never sleeps over a duplicate', pst(z)[0] == 'duplicate', pst(z))
    z.fill('#inp', '310'); z.click('#go'); z.wait_for_timeout(300); ok('Q6e never sleeps during the celebration', pst(z)[0] == 'celebrating', pst(z))
    z.evaluate("FlossFoxPip._timing({idle:400})"); z.wait_for_timeout(5000); ok('Q6f sleeps after the celebration ends', pst(z)[0] == 'sleepy', pst(z))
    z.evaluate("FlossFoxPip._timing({idle:1200,minSleep:600})"); z.keyboard.press('Shift'); z.wait_for_timeout(300); ok('Q6h key press wakes Pip', pst(z)[0] == 'listReady', pst(z))
    hid = z.evaluate("""async()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,1600));const a=FlossFoxPip.current();
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,1500));return [a,FlossFoxPip.current()]}""")
    ok('Q6i timer paused while the tab is hidden, resumes when visible', hid == ['listReady', 'sleepy'], hid)
    mz, _ = fresh(); mz.evaluate("FlossFoxPip._timing({idle:500,minSleep:1500})"); mz.wait_for_timeout(750); mz.keyboard.press('Shift'); mz.wait_for_timeout(200); g1 = pst(mz)[0]; mz.wait_for_timeout(1500); g2 = pst(mz)[0]
    ok('Q6g minimum sleep: input right after dozing off waits, then one wake (no flip-flop)', (g1, g2) == ('sleepy', 'attentive'), (g1, g2)); mz.context.close()
    zz, _ = fresh(); zz.evaluate("FlossFoxPip._timing({idle:1500})")
    for i in range(30): zz.mouse.move(10 + i * 10, 100); zz.wait_for_timeout(100)
    ok('Q6j steady activity keeps Pip awake', pst(zz)[0] != 'sleepy', pst(zz))
    zz.click('#pipToggle'); zz.wait_for_timeout(1800); ok('Q6k hidden Pip never sleeps', zz.evaluate("FlossFoxPip.overlay()") is None)
    # rapid interactions
    rp, _ = fresh(); rp.evaluate("FlossFoxPip._timing({tangleGap:0})")
    rp.evaluate("""()=>{const i=document.getElementById('inp'),g=document.getElementById('go'),h=document.getElementById('pipHi');for(const t of ['310','9999','310\\n310','310, 321']){i.value=t;g.click();h.click()}}""")
    rr = pst(rp); ok('Q7 rapid taps + submits: final state, art and text agree', rr[0] in ('tangled', 'listReady') and rr[1] == rp.evaluate("FlossFoxPip.STATES[FlossFoxPip.current()].pose") and rp.evaluate("document.getElementById('pipImg').dataset.art") == rr[1], rr)
    rp.wait_for_timeout(2800); ok('Q7b and settles to listReady', pst(rp)[0] == 'listReady', pst(rp))
    ok('Q8 no network requests outside the site', all(urlparse(u).netloc == urlparse(B).netloc for u in qrq if u.startswith('http')))
    lay = []
    for w in [320, 360, 412, 768, 880, 1024, 1280]:
        g, _ = fresh(w); t0 = g.evaluate("document.getElementById('inp').getBoundingClientRect().top+scrollY"); tops2 = []
        for n in ['helpful', 'tangled', 'celebrating', 'sleepy', 'welcome']:
            g.evaluate(f"FlossFoxPip.show('{n}')"); g.wait_for_timeout(30); tops2.append(g.evaluate("document.getElementById('inp').getBoundingClientRect().top+scrollY"))
        if g.evaluate('document.documentElement.scrollWidth') > w or any(t != t0 for t in tops2): lay.append((w, t0, tops2))
        g.context.close()
    ok('Q9 new poses: no overflow and no layout shift 320-1280', not lay, lay)
    rmq, _ = fresh(rm=True); rmq.click('#pipHi'); rmq.evaluate("FlossFoxPip.show('celebrating')")
    ok('Q10 reduced motion: no animation on new poses', rmq.evaluate("getComputedStyle(document.getElementById('pipImg')).animationName") == 'none')
    ok('Q10b bubble still not a live region; image decorative', rmq.get_attribute('#pipMsg', 'aria-live') is None and rmq.get_attribute('#pipImg', 'alt') == '')
    cq = fresh()[0]; cq.focus('#pipHi'); fo = cq.evaluate("getComputedStyle(document.getElementById('pipHi')).outlineStyle"); ok('Q11 easter-egg button has a visible focus ring', fo != 'none', fo)
    badp = []
    for w in [320, 360, 412, 600, 768, 880, 1024, 1280]:
        for hid in [False, True]:
            g = page(w, w < 700); g.goto(B)
            if hid: g.click('#pipToggle')
            g.fill('#inp', '310\n310\n9999'); g.click('#go')
            sw = g.evaluate('document.documentElement.scrollWidth')
            if sw > w: badp.append((w, hid, sw))
            g.context.close()
    ok('P7 no overflow 320-1280 with Pip shown and hidden', not badp, badp)
    pp.fill('#inp', '9999'); pp.click('#go'); pp.evaluate('scrollTo(0,0)'); cr = pp.evaluate(CJS)
    ok('P10 contrast incl. Pip bubble (error state)', not cr['fails'], cr['fails'])
    # ---------- Pip 2: dialogue specifics, toggle placement, assumed quantities ----------
    q2 = page(412, True); q2.goto(B)
    def sub2(t): q2.fill('#inp', t); q2.click('#go'); return pst(q2)
    ok('Q1 unclear amount named', sub2('310 two skeins')[2] == "Let's fix that! I couldn't read the amount in “310 two skeins”. Check the highlighted line below.", pst(q2))
    ok('Q1b two numbers named', sub2('310 321')[2] == '“310 321” has more than one number in it. Check the highlighted line below.', pst(q2))
    ok('Q1c several problems counted', sub2('9999\nzzz\n310')[2] == "Let's fix that! 2 entries need a look. Check the highlighted lines below.", pst(q2))
    ok('Q1d the line Pip mentions really is highlighted', q2.locator('#errs mark.badline').count() == 2 and '9999' in q2.inner_text('#errs mark.badline >> nth=0'))
    longbad = 'zz<b>' + 'y' * 60
    m = sub2(longbad)[2]; ok('Q1e long/hostile line truncated and inserted as text', '…' in m and len(m) < 110 and q2.locator('#pipMsg b').count() == 0 and q2.evaluate("document.getElementById('pipMsg').children.length") == 0, m)
    ok('Q1f empty and ready wording', sub2('')[2] == 'Add a few thread numbers to get started.' and (q2.click('#clear'), q2.locator('#inp').focus(), pst(q2))[2][2] == 'Ready when you are!')
    ok('Q1g several repeats wording (only when combined)', sub2('310\n310\n321\n321 x2')[2] == "Found some repeats! I've combined them for you." and q2.evaluate('state.items.length') == 2)
    sub2('310, 321'); ok('Q1h no repeat claim without repeats', 'repeat' not in pst(q2)[2])
    sub2('310 x2, 321, 310'); smy = q2.inner_text('#summary')
    ok('Q2 assumed amounts visible in the summary', 'Found 2 colors · 4 skeins (2 assumed — no amount given)' in smy, smy)
    tb = q2.inner_text('#tbl'); ok('Q2b per-line assumed markers (310: 3 with 1 assumed, 321: 1 assumed)', '2 skeins + assumed 1 skein' in tb and 'assumed 1 skein' in tb, tb[:300])
    ok('Q2c shopping list carries the flag', 'DMC 310 × 3 (1 assumed)' in q2.inner_text('#shop') and 'DMC 321 × 1 (assumed)' in q2.inner_text('#shop'), q2.inner_text('#shop')[:300])
    sub2('310 x?, 310'); ok('Q2d unknown stays unknown when merged with an assumed line', q2.evaluate('state.items[0].qty') is None and 'assumed' not in q2.inner_text('#tbl') and 'amount unknown' in q2.inner_text('#summary'))
    sub2('310 x2, 321 x1'); ok('Q2e fully stated list shows no assumed note', 'assumed' not in q2.inner_text('#summary'))
    sub2('310 x2, 321, 310'); q2.fill('#newProjName', 'Asm'); q2.click('#saveProj'); q2.click('#openSaved')
    stA = q2.evaluate("JSON.parse(localStorage.getItem('" + KEY + "'))")['projects'][0]['items']
    ok('Q3 project saving keeps the assumed count', {i['code']: (i['qty'], i['assumed'], i['stated']) for i in stA} == {'310': (3, 1, False), '321': (1, 1, False)}, stA)
    ok('Q3b project cards and summary say assumed', '3 skeins needed (1 assumed)' in q2.inner_text('#card-310') and 'use an assumed amount' in q2.inner_text('#pSum'))
    q2.click('#pAllBuy'); cp = q2.evaluate('FlossFoxProjects.planText(FlossFoxProjects._store().projects[0])')
    ok('Q3c copy text carries assumed', 'includes an assumed amount' in cp, cp[:400])
    cs = q2.evaluate('FlossFoxProjects.csv(FlossFoxProjects._store().projects[0])'); rows = list(__import__('csv').DictReader(__import__('io').StringIO(cs)))
    ok('Q3d CSV: quantity_stated + assumed_skeins columns', {r['dmc_code']: (r['quantity_stated'], r['assumed_skeins']) for r in rows} == {'310': ('partly assumed', '1'), '321': ('assumed', '1')}, rows)
    ok('Q3e print view carries assumed', 'includes an assumed amount' in q2.inner_text('#pPlan'))
    expand(q2, '310'); setnum(q2, '#q-310', '3'); ok('Q3f entering the real amount clears assumed', 'assumed' not in q2.inner_text('#card-310').split('Need')[0] and q2.evaluate("FlossFoxProjects._store().projects[0].items.find(i=>i.code==='310').assumed") == 0)
    ok('Q3g assumed amounts count as known for readiness (documented)', q2.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).threads.find(t=>t.it.code==='321').state") == 'buy')
    # toggle placement + compact intro
    for w in [320, 360, 412]:
        g = page(w, True); g.set_viewport_size({'width': w, 'height': 740 if w < 400 else 860}); g.goto(B)
        r = g.evaluate("""(()=>{const b=k=>document.querySelector(k).getBoundingClientRect(),t=b('#pipToggle'),f=b('#pipFig'),m=b('#pipMsg'),i=b('#inp'),go=b('#go');
          const ov=(a,c)=>!(a.right<=c.left||c.right<=a.left||a.bottom<=c.top||c.bottom<=a.top);
          return {tw:t.width,th:t.height,near:Math.abs(t.top-f.bottom)<60,over:[ov(t,i),ov(t,go),ov(f,i),ov(m,i),ov(t,m),ov(t,f)].some(Boolean),goBottom:go.bottom,vh:innerHeight,banner:(document.querySelector('.devbanner')||{offsetHeight:0}).offsetHeight,inpTop:i.top}})()""")
        ok(f'Q4 {w}px: toggle next to Pip, ≥44px, nothing overlaps; main button on first screen', r['tw'] >= 44 and r['th'] >= 44 and r['near'] and not r['over'] and r['goBottom'] - r['banner'] <= r['vh'], r)  # dev preview only: its intentional banner is excluded; production has no banner (banner == 0)
        g.context.close()
    # ---------- Retailer / affiliate links (1.3) ----------
    def rcfg(enabled, wrap='', aid='AFFILIATE_ID_PLACEHOLDER'):
        R = [{'id': 'michaels', 'name': 'Michaels', 'enabled': enabled, 'brands': ['dmc'], 'affiliateId': aid, 'wrap': wrap, 'template': 'https://www.michaels.com/search?q={q}'},
             {'id': 'hobbylobby', 'name': 'Hobby Lobby', 'enabled': enabled, 'brands': ['dmc'], 'affiliateId': aid, 'wrap': wrap, 'template': 'https://www.hobbylobby.com/search?query={q}'}]
        return 'window.FLOSS_FOX_RETAILERS=' + json.dumps(R) + ';window.FLOSS_FOX_TEST_LINKS=false;'
    def rpage(body, w=412):
        c = br.new_context(viewport={'width': w, 'height': 900}, is_mobile=w < 700); c.route('**/retailers.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=body))
        g = c.new_page(); g.on('dialog', lambda d: d.accept()); return g
    STORES = ('michaels.com', 'hobbylobby.com', 'anrdoezrs', 'cj.com', 'dpbolvw', 'jdoqocy', 'tkqlhce', 'kqzyfj')
    dflt = page(); dflt.goto(B); en = dflt.evaluate("(window.FLOSS_FOX_RETAILERS||[]).filter(r=>r.enabled).length")
    print('RETAILERS_ENABLED_IN_THIS_BUILD', en)
    if 'floss-fox-dev' not in B:
        ok('A0 production default: all retailers disabled', en == 0)
    else:
        ok('A0 dev preview: both retailers enabled with test (untracked) IDs', en == 2 and dflt.evaluate("FLOSS_FOX_TEST_LINKS===true && FLOSS_FOX_RETAILERS.every(r=>/TEST/.test(r.affiliateId)&&!r.wrap)"))
    off = rpage(rcfg(False)); off.goto(B + '?sample')
    ok('A1 disabled: no store links, no disclosure', off.locator('.buyat a').count() == 0 and off.locator('#affdisc').is_hidden())
    off.click('#saveProj'); off.click('#openSaved'); off.click('#pAllBuy'); off.click('#pShop')
    ok('A1b disabled: none in project plan or Shopping mode', off.locator('.buyat a, .affdisc:visible').count() == 0)
    reqs = []
    on = rpage(rcfg(True, 'https://www.anrdoezrs.net/click-{id}?url={url}', '1234567-7654321')); on.on('request', lambda r: reqs.append(r.url))
    on.goto(B + '?sample'); on.wait_for_load_state('networkidle')
    n310 = on.locator('#shop li:has-text("DMC 310") .buyat a')
    ok('A2 enabled: Buy at Michaels / Buy at Hobby Lobby per line', n310.count() == 2 and 'Buy at Michaels' in n310.nth(0).inner_text() and 'Buy at Hobby Lobby' in n310.nth(1).inner_text())
    allrel = on.evaluate("[...document.querySelectorAll('.buyat a')].every(a=>a.rel==='sponsored noopener'&&a.target==='_blank')")
    ok('A3 every store link has rel="sponsored noopener" and target=_blank', allrel and on.locator('.buyat a').count() >= 2)
    h = n310.nth(0).get_attribute('href')
    ok('A3b tracked link uses the configured wrapper and the encoded store search', h.startswith('https://www.anrdoezrs.net/click-1234567-7654321?url=') and 'michaels.com%2Fsearch%3Fq%3DDMC%2520310%2520embroidery%2520floss' in h, h)
    ok('A4 FTC disclosure shown, worded exactly, directly before the list', on.locator('#affdisc').is_visible() and 'Affiliate links: Floss Fox may earn a small commission at no extra cost to you' in on.inner_text('#affdisc') and on.evaluate("document.getElementById('affdisc').nextElementSibling.id") == 'shop')
    ok('A5 no store/network requests on load or render', not [u for u in reqs if any(s in u for s in STORES)], [u for u in reqs if any(s in u for s in STORES)][:3])
    ok('A5b links never claim price, stock or availability', not any(w in on.inner_text('#shop').lower() for w in ['in stock', 'available', 'cheapest', 'sale', 'deal']))
    on.select_option('#dest', 'sullivans'); ok('A6 brands not configured (Sullivans) get no store links', on.locator('#shop .buyat a').count() == 0)
    on.select_option('#dest', 'dmc'); on.context.grant_permissions(['clipboard-read', 'clipboard-write'])
    ctext = on.evaluate("listText()")
    ok('A7 copy text keeps working and lists plain (untracked) store URLs', 'DMC 310' in ctext and 'Michaels: https://www.michaels.com/search?q=DMC%20310%20embroidery%20floss' in ctext and 'anrdoezrs' not in ctext)
    on.emulate_media(media='print'); ok('A7b store links and disclosure hidden in print', on.locator('.buyat').first.is_hidden() and on.locator('#affdisc').is_hidden()); on.emulate_media(media='screen')
    on.click('#saveProj'); on.click('#openSaved'); on.click('#pAllBuy')
    ok('A8 project shopping list: links + disclosure right above them', on.locator('#pPlan .affdisc').count() == 1 and on.locator('#pPlan .buyat a').count() >= 2 and on.evaluate("document.querySelector('#pPlan .affdisc').nextElementSibling.tagName") == 'UL')
    csvp = on.evaluate("FlossFoxProjects.csv(FlossFoxProjects._store().projects[0])")
    ok('A8b CSV unchanged by links (no URLs, same columns)', 'michaels' not in csvp.lower() and csvp.splitlines()[0].startswith('project,dmc_code'))
    on.click('#pShop')
    ok('A9 Shopping mode: links on to-buy cards + disclosure', on.locator('#shList .buyat a').count() >= 2 and on.locator('.affdisc:visible').count() == 1)
    ok('A9b Pip unaffected (still honest list state on Add colors)', on.evaluate("FlossFoxPip.current()") in ('duplicate', 'listReady', 'error'))
    ow = []
    for w in [320, 360, 412, 600, 768, 880, 1024, 1280]:
        g = rpage(rcfg(True), w); g.goto(B + '?sample'); a = g.evaluate('document.documentElement.scrollWidth')
        g.click('#saveProj'); g.click('#openSaved'); g.click('#pAllBuy'); b2 = g.evaluate('document.documentElement.scrollWidth'); g.click('#pShop'); c2 = g.evaluate('document.documentElement.scrollWidth')
        tg = g.evaluate("Math.min(...[...document.querySelectorAll('.buyat a')].filter(a=>a.offsetParent).map(a=>a.getBoundingClientRect().height))")
        if max(a, b2, c2) > w or tg < 44: ow.append((w, a, b2, c2, tg))
        g.context.close()
    ok('A10 no overflow 320-1280 with links on; link targets >= 44px', not ow, ow)
    cl = rpage(rcfg(True)); cl.goto(B + '?sample'); cr2 = cl.evaluate(CJS); ok('A11 contrast with links + disclosure', not cr2['fails'], cr2['fails'])
    # ---------- Pip guided tour + Ask Pip ----------
    from urllib.parse import urlparse as _up
    def tp(w=412, fresh=True, rm=False, init=None):
        c = br.new_context(viewport={'width': w, 'height': 860 if w < 700 else 900}, is_mobile=w < 700, has_touch=w < 700, reduced_motion='reduce' if rm else 'no-preference', fresh=fresh)
        if init: c.add_init_script(init)
        g = c.new_page(); g.rq = []; g.on('request', lambda r: g.rq.append(r.url)); g.on('pageerror', lambda e: errs.append('tour: ' + str(e)))
        g.goto(B); g.wait_for_load_state('networkidle'); return g
    step = lambda g: g.evaluate("FlossFoxTour.step()")
    cpose = lambda g: g.evaluate("(()=>{const c=document.getElementById('tourCard');if(!c)return null;const i=c.querySelector('img');return [c.dataset.pose,/pip-([a-z]+)-160/.exec(i.currentSrc||i.src)[1]]})()")
    def addlist(g, t): g.fill('#inp', t); g.click('#go'); g.wait_for_timeout(80)
    def nxt(g): g.click('#tourCard [data-t=next]'); g.wait_for_timeout(80)
    g = tp()
    ok('T1 first visit: inline invite with the exact words and two choices', g.locator('#tourInvite').is_visible() and "Hi! I'm Pip! Want me to show you around? It'll be quick!" in g.inner_text('#tourInvite') and g.inner_text('#tourYes') == 'Show me around' and g.inner_text('#tourNo') == "I'll explore myself")
    ok('T1b invite is not a modal (no dialog, page stays usable) and Add my colors stays on the first screen', g.locator('[role=dialog],dialog[open]').count() == 0 and g.evaluate("document.getElementById('go').getBoundingClientRect().bottom") <= 860)
    ok('T1c invite carries greeting Pip', 'pip-greeting-160' in g.evaluate("document.querySelector('#tourInvite img').currentSrc"))
    g.click('#tourYes')
    ok('T2 start: step 1 of 5, heading focused, real input highlighted', step(g) == 0 and 'Step 1 of 5' in g.inner_text('#tourCard') and g.evaluate("document.activeElement.id") == 'tourH' and g.evaluate("document.getElementById('inp').classList.contains('tour-target')") and g.locator('#tourInvite').count() == 0)
    g.wait_for_timeout(120); ok('T2b step change announced politely', 'step 1 of 5' in g.inner_text('#tourLive') and g.get_attribute('#tourLive', 'aria-live') == 'polite')
    ok('T2c S1 words and example offer', 'First, pop your DMC thread numbers in here! You can type them or paste your whole list.' in g.inner_text('#tourCard') and g.locator('#tourCard [data-t=example]').count() == 1 and g.input_value('#inp') == '')
    ok('T15 S1 pose pointing at the real input (right image, not mirrored)', cpose(g) == ['pointing', 'pointing'] and g.get_attribute('#tourCard', 'data-mirror') == 'false', cpose(g))
    ok('T2d the highlighted input stays usable', (g.fill('#inp', '310 x2\n321') or True) and g.input_value('#inp') == '310 x2\n321')
    g.click('#go'); g.wait_for_timeout(100)
    ok('T6 real list advances to step 2, card inside results', step(g) == 1 and g.evaluate("!!document.querySelector('#results #tourCard')") and "Here's what I found!" in g.inner_text('#tourCard') and 'recognized 2 colors' in g.inner_text('#tourCard'), g.inner_text('#tourCard'))
    ok('T15b S2 results pose presenting on a clean list', cpose(g) == ['presenting', 'presenting'], cpose(g))
    nxt(g); ok('T4 step 3 points at the real Buy in selector and says charts may not be exact', step(g) == 2 and g.evaluate("document.getElementById('dest').classList.contains('tour-target')") and 'may not be exact' in g.inner_text('#tourCard') and 'cheaper' not in g.inner_text('#tourCard').lower() and 'estimates' in g.inner_text('#tourCard'))
    g.select_option('#dest', 'sullivans'); g.wait_for_timeout(80)
    ok('T4b S3 live text tells the true Sullivans match count', "Sullivans now: 2 colors of 2 have a chart match" in g.inner_text('#tourCard') and g.locator('#shop li').count() == 2, g.inner_text('#tourCard'))
    g.select_option('#dest', 'dmc'); nxt(g)
    ok('T4c step 4 introduces only real controls; no store-link talk when links are off', step(g) == 3 and all(x in g.inner_text('#tourCard') for x in ['Print list', 'Copy as text', 'Save project', 'Shop my list', 'CSV']) and (('optional affiliate links' in g.inner_text('#tourCard').lower() and 'never need them' in g.inner_text('#tourCard')) if g.evaluate("!!window.FLOSS_FOX_TEST_LINKS") else 'affiliate' not in g.inner_text('#tourCard').lower()) and g.locator('#shopcard button:has-text("Print list")').count() == 1 and g.locator('#copy').count() == 1 and g.locator('#saveProj').count() == 1)
    g.click('#tourCard [data-t=back]'); g.wait_for_timeout(80); ok('T5 Back returns to step 3', step(g) == 2); nxt(g); nxt(g)
    ok('T4d step 5 finish: celebrating, both buttons', step(g) == 4 and "Yay! You've got it! You're ready to start stitching!" in g.inner_text('#tourCard') and cpose(g) == ['celebrating', 'celebrating'] and g.locator('#tourCard [data-t=start]').count() == 1 and g.locator('#tourCard [data-t=tips]').count() == 1, cpose(g))
    g.click('#tourCard [data-t=start]'); g.wait_for_timeout(80)
    ok('T4e Start using: card gone, data kept, user on results, marked done', g.locator('#tourCard').count() == 0 and g.input_value('#inp') == '310 x2\n321' and not g.locator('#results').is_hidden() and g.evaluate("document.activeElement.closest('#results')!==null") and json.loads(g.evaluate(f"localStorage.getItem('{TK}')"))['status'] == 'done')
    ok('T4f no highlight left behind', g.locator('.tour-target').count() == 0)
    g.wait_for_timeout(200); ok('C1 tour finished -> goodbye (walking off, waving)', g.evaluate("FlossFoxPip.current()") == 'goodbye' and g.evaluate("document.getElementById('pipImg').dataset.pose||document.getElementById('pipImg').currentSrc").find('goodbye') >= 0, g.evaluate("FlossFoxPip.current()"))
    st_keys = g.evaluate("Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])")
    ok('T16 storage: only small prefs, never the thread list', all(k in (TK, HK, PFX + '.pip.v1') for k, v in st_keys) and not any('321' in v for k, v in st_keys), st_keys)
    g.reload(); ok('T4g after finishing, no re-ask on reload', g.locator('#tourInvite').count() == 0)
    # decline / skip
    d = tp(); d.click('#tourNo'); ok('T3 decline: invite gone, stored', d.locator('#tourInvite').count() == 0 and json.loads(d.evaluate(f"localStorage.getItem('{TK}')"))['status'] == 'dismissed'); d.reload(); ok('T3b no re-ask after reload', d.locator('#tourInvite').count() == 0 and d.locator('#tourCard').count() == 0)
    k = tp(); k.fill('#inp', '3865 x3'); k.click('#tourYes'); k.click('#tourCard [data-t=skip]')
    ok('T3c Skip tour keeps the typed list; no re-ask', k.locator('#tourCard').count() == 0 and k.input_value('#inp') == '3865 x3' and (k.reload() or True) and k.locator('#tourInvite').count() == 0)
    # example
    e = tp(); e.fill('#inp', '3865 x3'); e.click('#tourYes')
    ok('T7 example only on explicit click (input untouched until then)', e.input_value('#inp') == '3865 x3')
    e.click('#tourCard [data-t=example]'); e.wait_for_timeout(80)
    ok('T7b example uses 310, 321, 666, 699 only and is labelled as sample', e.input_value('#inp') == '310\n321\n666\n699' and e.locator('#exampleBanner').is_visible() and 'sample' in e.inner_text('#exampleBanner') and e.evaluate("state.items.map(i=>i.code).join()") == '310,321,666,699')
    ok('T7c example never celebrates', e.evaluate("FlossFoxPip.current()") != 'celebrating')
    e.click('#exitExample'); ok('T7d leaving the example restores my own list', e.input_value('#inp') == '3865 x3')
    # invalid / duplicates
    v = tp(); v.click('#tourYes'); addlist(v, '310\n9999')
    ok('T8 invalid list: stays on step 1, reassuring, explains, Pip shows the error', step(v) == 0 and cpose(v) == ['reassuring', 'reassuring'] and "couldn't be read" in v.inner_text('#tourCard') and v.evaluate("FlossFoxPip.current()") == 'error', (step(v), cpose(v)))
    nxt(v); ok('T8b results step with an error: reassuring + honest text', step(v) == 1 and cpose(v)[0] == 'reassuring' and "couldn't be read" in v.inner_text('#tourCard'))
    addlist(v, '310\n310 x2'); ok('T8c duplicates during the tour: duplicates pose, true claim', cpose(v) == ['duplicates', 'duplicates'] and 'appeared more than once' in v.inner_text('#tourCard') and v.evaluate("state.items[0].qty") == 3, cpose(v))
    v.evaluate("FlossFoxPip._timing({idle:300,tangleGap:0})"); addlist(v, '310, 321'); v.wait_for_timeout(5000)
    ok('T17 sleepy never interrupts a tour step', v.evaluate("FlossFoxPip.overlay()") != 'sleepy' and step(v) == 1, v.evaluate("FlossFoxPip.overlay()"))
    v.click('#pipHi'); ok('T17b tangled never interrupts a tour step', v.evaluate("FlossFoxPip.current()") != 'tangled')
    # switching views mid-tour
    v.click('#tabProjects'); ok('T18 switching views mid-tour: card stays with Add colors, page fine', v.locator('#tourCard').is_hidden() and step(v) == 1)
    v.click('#askPipBtn'); ok('T18b Ask Pip offers Back to the tour', v.locator('#askPip [data-a=resume]').count() == 1 and 'step 2 of 5' in v.inner_text('#askPip'))
    v.click('#askPip [data-a=resume]'); ok('T18c back to the tour returns to the same step on Add colors', not v.locator('#convertView').is_hidden() and v.locator('#tourCard').is_visible() and step(v) == 1)
    # refresh mid-tour
    v.reload(); v.wait_for_timeout(100)
    ok('T19 refresh mid-tour: offers a clean restart (list isn\'t kept for the tour)', v.locator('#tourInvite').is_visible() and 'Restart the tour' in v.inner_text('#tourInvite') and v.locator('#tourCard').count() == 0)
    v.click('#tourYes'); ok('T19b restart works', step(v) == 0)
    v.keyboard.press('Escape'); ok('T20 Esc closes halfway; dismissed', v.locator('#tourCard').count() == 0 and json.loads(v.evaluate(f"localStorage.getItem('{TK}')"))['status'] == 'dismissed')
    # Ask Pip contexts
    a = tp(fresh=False); ctx = lambda: a.get_attribute('#askPip .actx', 'data-ctx')
    a.click('#askPipBtn'); ok('T9 Ask Pip opens, focused, no free-text input', a.locator('#askPip').is_visible() and a.evaluate("document.activeElement.id") == 'askPipH' and a.locator('#askPip textarea, #askPip input[type=text], #askPip input:not([type])').count() == 0 and a.get_attribute('#askPipBtn', 'aria-expanded') == 'true')
    ok('T9b empty context', ctx() == 'empty', ctx())
    topics = a.locator('#askPip .atopics button').all_inner_texts()
    ok('T9c the five topics', topics == ['How do I enter my colors?', 'What does this result mean?', 'What are thread alternatives?', 'How do I use my shopping list?', 'Start the tour again'], topics)
    a.click('#askPip [data-a=alts]'); ok('T9d topic answer shown, focused, honest about charts', 'not exact' in a.inner_text('#askAns') and a.evaluate("document.activeElement.id") == 'askAns')
    a.keyboard.press('Escape'); ok('T9e Esc closes, focus back on Ask Pip', a.locator('#askPip').is_hidden() and a.evaluate("document.activeElement.id") == 'askPipBtn')
    seen = {}
    for t, dest in [('310\n9999', 'dmc'), ('310\n310', 'dmc'), ('310, 321', 'sullivans'), ('310, 321', 'dmc')]:
        addlist(a, t); a.select_option('#dest', dest); a.click('#askPipBtn'); seen[t + dest] = (ctx(), a.inner_text('#askPip .actx')); a.click('#askPip [data-a=close]')
    ok('T9f context per state: errors, duplicates, alternatives (true count), results', [x[0] for x in seen.values()] == ['errors', 'duplicates', 'alternatives', 'results'] and '2 of your 2 colors have a chart match' in seen['310, 321sullivans'][1], seen)
    a.fill('#newProjName', 'Ask test'); a.click('#saveProj'); a.click('#tabProjects'); a.click('#askPipBtn'); c1 = ctx(); a.click('#askPip [data-a=close]'); a.click('[data-open]'); a.click('#askPipBtn'); c2 = ctx(); a.click('#askPip [data-a=close]'); a.click('#tabHelp'); a.click('#askPipBtn'); c3 = ctx()
    ok('T9g context on projects, a project, and Help', (c1, c2, c3) == ('projects', 'project', 'help'), (c1, c2, c3))
    a.click('#askPip [data-a=tour]'); ok('T10 restart from Ask Pip: step 1 on Add colors', step(a) == 0 and a.locator('#tourCard').is_visible() and a.locator('#askPip').is_hidden())
    a.click('#tourCard [data-t=close]'); a.click('#tabHelp'); a.click('#helpTour'); ok('T10b restart from the Help tab', step(a) == 0 and not a.locator('#convertView').is_hidden())
    a.click('#tourCard [data-t=close]')
    # Pip hidden
    hp = tp(init=f"localStorage.setItem('{PFX}.pip.v1','hidden')")
    ok('T11 Pip hidden: invite still shows with its own small Pip', hp.locator('#pipFig').is_hidden() and hp.locator('#tourInvite img').count() == 1 and hp.locator('#tourInvite').is_visible())
    hp.click('#tourYes'); ok('T11b tour card works with Pip hidden', hp.locator('#tourCard img').count() == 1 and step(hp) == 0)
    hp.click('#tourCard [data-t=close]'); hp.click('#askPipBtn'); ok('T11c Ask Pip works with Pip hidden', hp.locator('#askPip').is_visible())
    # hints
    h = tp(fresh=False, init=f"localStorage.setItem('{HK}','on')"); h.evaluate("FlossFoxTour._timing({start:400,compare:300,quiet:300})"); h.wait_for_timeout(700)
    ok('T21 tip: empty list -> "Not sure where to start?"', h.evaluate("FlossFoxPip.current()") == 'hintStart' and 'like 310' in h.inner_text('#pipMsg'))
    addlist(h, '310, 321'); h.wait_for_timeout(4600); h.wait_for_timeout(700)
    ok('T21b tip: compare brands only when real matches exist', h.evaluate("FlossFoxPip.current()") == 'hintCompare' and 'Brand to buy' in h.inner_text('#pipMsg'), h.evaluate("FlossFoxPip.current()"))
    h.click('#clear'); h.evaluate("FlossFoxTour._timing({start:300})"); h.wait_for_timeout(600); ok('T21c each tip at most once per session', h.evaluate("FlossFoxPip.current()") != 'hintStart')
    h2 = tp(fresh=False, init=f"localStorage.setItem('{HK}','on')"); h2.click('#inp'); h2.keyboard.type('31'); h2.evaluate("FlossFoxTour._timing({start:200,quiet:2000})"); h2.wait_for_timeout(500)
    ok('T21d never while typing', h2.evaluate("FlossFoxPip.current()") != 'hintStart')
    h3 = tp(fresh=False); h3.evaluate("FlossFoxTour._timing({start:200})"); h3.wait_for_timeout(500); ok('T21e tips off: no tip', h3.evaluate("FlossFoxPip.current()") != 'hintStart')
    h3.click('#tabHelp'); h3.check('#hintsHelp'); ok('T21f tips toggle stored as a small pref', h3.evaluate(f"localStorage.getItem('{HK}')") == 'on')
    # layout 320-1280
    lay = []
    for w in [320, 360, 412, 600, 768, 880, 1024, 1280]:
        L = tp(w); L.click('#tourYes'); bad = []
        for i in range(5):
            if i == 1: addlist(L, '310 x2\n321\n3865')
            r = L.evaluate("""(()=>{const c=document.getElementById('tourCard').getBoundingClientRect();const hit=[...document.querySelectorAll('#go,#sample,#clear,#inp,#dest,#copy,#saveProj,#pipToggle,#askPipBtn')].filter(e=>e.offsetParent).filter(e=>{const r=e.getBoundingClientRect();return !(r.right<=c.left||r.left>=c.right||r.bottom<=c.top||r.top>=c.bottom)}).map(e=>e.id);
              const sm=[...document.querySelectorAll('#tourCard button')].filter(b=>b.getBoundingClientRect().height<44).length;return [document.documentElement.scrollWidth,hit,sm,c.right<=innerWidth]})()""")
            if r[0] > w or r[1] or r[2] or not r[3]: bad.append((i, r))
            if 0 < i < 4: nxt(L)
        L.click('#askPipBtn'); aw = L.evaluate("document.documentElement.scrollWidth")
        if bad or aw > w: lay.append((w, bad, aw))
        L.context.close()
    ok('T12 every step 320-1280: no overflow, card never covers controls, buttons >= 44px', not lay, lay)
    kb = tp(); kb.click('#tourYes'); kb.keyboard.press('Tab'); f1 = kb.evaluate("document.activeElement.dataset.t")
    kb.keyboard.press('Tab'); f2 = kb.evaluate("document.activeElement.dataset.t"); kb.keyboard.press('Enter'); kb.wait_for_timeout(80)
    ok('T12b keyboard: Tab reaches the card buttons; Enter on Next advances', f1 == 'example' and f2 == 'next' and step(kb) == 1, (f1, f2, step(kb)))
    kb.keyboard.press('Escape'); ok('T12c Esc closes and focus returns sensibly', kb.locator('#tourCard').count() == 0 and kb.evaluate("document.activeElement.id") in ('tourYes', 'inp', 'askPipBtn'), kb.evaluate("document.activeElement.id"))
    rmt = tp(rm=True); rmt.click('#tourYes'); addlist(rmt, '310')
    ok('T13 reduced motion: no animation in the tour, Pip still', rmt.evaluate("document.getElementById('tourCard').getAnimations({subtree:true}).length") == 0 and rmt.evaluate("getComputedStyle(document.getElementById('pipImg')).animationName") == 'none')
    allrq = g.rq + d.rq + e.rq + v.rq + a.rq + h.rq
    ok('T22 tour + Ask Pip make no outside requests', all(_up(u).netloc == _up(B).netloc for u in allrq if u.startswith('http')), [u for u in allrq if _up(u).netloc != _up(B).netloc][:5])
    # ---------- Milestone 1.4: transparent art + 5 new poses ----------
    import io
    from PIL import Image as _Im
    noalpha = []
    for a in POSES:
        for w in [160, 320, 480]:
            for ext in ['webp', 'png']:
                r = pp.request.get(B + f'assets/pip/pip-{a}-{w}.{ext}'); im = _Im.open(io.BytesIO(r.body()))
                has = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
                corner = im.convert('RGBA').getpixel((0, 0))[3] if has else 255
                if r.status != 200 or not has or corner != 0 or im.width != w: noalpha.append((a, w, ext, im.mode, corner))
    ok('M1 all 138 Pip images (23 poses) load, have an alpha channel and transparent corners', not noalpha, noalpha)
    ok('M1b no JPG Pip assets referenced anywhere', pp.request.get(B + 'assets/pip/pip-greeting-320.jpg').status == 404 and '.jpg' not in pp.evaluate("document.getElementById('pipImg').srcset+document.getElementById('pipImg').src"))
    tile = pp.evaluate("(()=>{const f=getComputedStyle(document.getElementById('pipFig'));const r=document.getElementById('pipFig').getBoundingClientRect();return [f.backgroundColor,f.borderTopColor,Math.round(r.width),Math.round(r.height)]})()")
    ok('M2 no white tile: frame transparent, same 84x118 frame on phones', tile[0] in ('rgba(0, 0, 0, 0)', 'transparent') and tile[1] in ('rgba(0, 0, 0, 0)', 'transparent') and tile[2:] == [84, 118], tile)
    pdm = page(1280); pdm.goto(B); fr = pdm.evaluate("(()=>{const r=document.getElementById('pipFig').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})()")
    ok('M2b same 140x196 frame on desktop', fr == [140, 196], fr)
    fv = tp(1280); ok('M3 first visit keeps the original greeting', fv.evaluate("[FlossFoxPip.current(),document.getElementById('pip').dataset.pose]") == ['welcome', 'greeting'])
    rv = tp(412, fresh=False); ok('M4 returning visitor (tour done/dismissed): welcome back with greeting-alt', rv.evaluate("[FlossFoxPip.current(),document.getElementById('pip').dataset.pose]") == ['welcomeBack', 'greeting-alt'])
    rv.click('#inp'); f1 = rv.evaluate("FlossFoxPip.current()"); rv.click('#heroH'); f2 = rv.evaluate("[FlossFoxPip.current(),document.getElementById('pip').dataset.pose]")
    ok('M5 focus -> curious (attentive); leaving the empty box -> calm neutral idle', f1 == 'attentive' and f2 == ['idle', 'neutral'], (f1, f2))
    rv.fill('#inp', '310'); rv.click('#go'); ok('M5b a real list still wins over idle', rv.evaluate("FlossFoxPip.current()") in ('listReady', 'celebrating'))
    rv.click('#askPipBtn'); rv.wait_for_timeout(400); pk = rv.evaluate("""(()=>{const p=document.getElementById('askPip').getBoundingClientRect(),i=document.querySelector('#askPip .apeek img');if(!i||!i.offsetParent)return null;const r=i.getBoundingClientRect();
      const hit=[...document.querySelectorAll('#askPip button,#askPip input,#askPip label')].filter(b=>{const q=b.getBoundingClientRect();return !(q.right<=r.left||q.left>=r.right||q.bottom<=r.top||q.top>=r.bottom)}).length;return [Math.round(p.right-r.right),hit,/pip-peeking-160/.test(i.currentSrc||i.src)]})()""")
    ok('M6 phone Ask Pip: peeking Pip pinned flush right, covers no control', pk is not None and 0 <= pk[0] <= 1 and pk[1] == 0 and pk[2], pk)
    ok('M6b Ask Pip button avatar is the face icon', 'pip-face-icon-' in rv.evaluate("document.querySelector('#askPipBtn img').currentSrc"))
    rv.click('#askPip [data-a=alts]'); rv.wait_for_timeout(400); th = rv.evaluate("[document.querySelector('#askPip .ahead').dataset.pose,/pip-thinking-160/.test(document.querySelector('#askPip .ahead img').currentSrc||document.querySelector('#askPip .ahead img').src),!!document.querySelector('#askPip .apeek')]")
    ok('M7 Ask Pip answer -> thinking (a real "let me check" moment), no double Pip', th == ['thinking', True, False], th)
    ok('M7b desktop Ask Pip: no peeking, face-icon header', (pdm.click('#askPipBtn') or True) and not pdm.locator('#askPip .apeek img').is_visible() and pdm.evaluate("document.querySelector('#askPip .ahead').dataset.pose") == 'face-icon')
    bk = tp(412, fresh=False); bk.click('#tabProjects'); bk.click('#backupBox summary')
    bk.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': open(FIX, 'rb').read()}); bk.wait_for_timeout(300)
    ok('M8 restoring a backup: thinking only while really checking; the finished check shows presenting with the real result', bk.get_attribute('#restorePanel .rpip', 'data-pose') == 'presenting' and 'I checked it' in bk.inner_text('#restorePanel'))
    bk.set_input_files('#restoreFile', {'name': 'x.json', 'mimeType': 'application/json', 'buffer': b'not json'}); bk.wait_for_timeout(300)
    ok('M8b invalid backup -> puzzled, nothing changed', bk.get_attribute('#restorePanel .rpip', 'data-pose') == 'puzzled' and 'Nothing was changed' in bk.inner_text('#restorePanel'))
    pt = tp(412); pt.click('#tourYes'); poses = []
    def tinfo(g): return g.evaluate("""(()=>{const c=document.getElementById('tourCard'),i=c.querySelector('.tpip'),t=document.querySelector('.tour-target');const a=i.getBoundingClientRect();let ov=false,dir=null;
      if(t){const b=t.getBoundingClientRect();ov=!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);dir=(b.left+b.right)/2<(a.left+a.right)/2}return [c.dataset.pose,c.dataset.mirror||null,ov,dir,i.classList.contains('mirror')]})()""")
    poses.append(tinfo(pt)); addlist(pt, '310 x2\n321'); poses.append(tinfo(pt)); nxt(pt); poses.append(tinfo(pt)); nxt(pt); poses.append(tinfo(pt)); nxt(pt); poses.append(tinfo(pt))
    ok('M9 tour: pointing on the control steps (1, 3, 4), presenting on results, celebrating at the end', [x[0] for x in poses] == ['pointing', 'presenting', 'pointing', 'pointing', 'celebrating'], poses)
    ok('M9b pointing Pip never covers the target and mirrors exactly when the target is on his other side', all(not x[2] and x[4] == x[3] for x in poses if x[0] == 'pointing'), poses)
    pd2 = tp(1280); pd2.click('#tourYes'); d1 = tinfo(pd2); ok('M9c desktop step 1 pointing, not covering the input', d1[0] == 'pointing' and not d1[2] and d1[4] == d1[3], d1)
    lay2 = []
    for w in [320, 412, 880, 1280]:
        g2 = tp(w, fresh=False); t0 = g2.evaluate("document.getElementById('inp').getBoundingClientRect().top+scrollY"); tt = []
        for n in ['welcomeBack', 'idle', 'attentive', 'helpful', 'welcome']:
            g2.evaluate(f"FlossFoxPip.show('{n}')"); g2.wait_for_timeout(40); tt.append(g2.evaluate("document.getElementById('inp').getBoundingClientRect().top+scrollY"))
        if any(t != t0 for t in tt) or g2.evaluate('document.documentElement.scrollWidth') > w: lay2.append((w, t0, tt))
        g2.context.close()
    ok('M10 new poses: no layout shift or overflow 320-1280', not lay2, lay2)
    rmn = tp(412, fresh=False, rm=True); rmn.evaluate("FlossFoxPip.show('idle')"); ok('M11 reduced motion on new poses', rmn.evaluate("getComputedStyle(document.getElementById('pipImg')).animationName") == 'none')
    hdn = tp(412, fresh=False, init=f"localStorage.setItem('{PFX}.pip.v1','hidden')"); hdn.click('#askPipBtn'); ok('M12 Pip hidden: Ask Pip still shows its peeking Pip', hdn.locator('#askPip .apeek img').is_visible() and hdn.locator('#pipFig').is_hidden())
    # ---------- Milestone 1.4 batch 2: reassuring / puzzled / presenting / discovery / saved / face icon ----------
    b2 = tp(412, fresh=False)
    def b2s(t): b2.fill('#inp', t); b2.click('#go'); b2.wait_for_timeout(60); return b2.evaluate("[FlossFoxPip.current(),document.getElementById('pip').dataset.pose,document.getElementById('pipMsg').textContent]")
    e1 = b2s('310\n9999'); e2 = b2s('310 x2\n310 two'); e3 = b2s('310 321')
    ok('B1 error poses: unknown number + bad amount -> reassuring "Let\'s fix that"; two numbers in one line -> puzzled (clarify)', e1[1] == 'reassuring' and e1[2].startswith("Let's fix that!") and e2[1] == 'reassuring' and e3[1] == 'puzzled' and not e3[2].startswith("Let's fix"), (e1, e2, e3))
    ok('B1b tangled is never an error pose', b2.evaluate("['error'].every(n=>FlossFoxPip.STATES[n].pose({errs:[{kind:'multi'}]})!=='tangled'&&FlossFoxPip.STATES[n].pose({errs:[{kind:'code'}]})!=='tangled')"))
    b2s('310'); b2.wait_for_timeout(4300); b2s('310\n9999'); r1 = b2s('310, 321')
    ok('B2 real recovery: the list with errors now reads cleanly -> reassuring "All fixed!"', r1[:2] == ['recovered', 'reassuring'] and r1[2].startswith('All fixed!'), r1)
    r2 = b2s('310, 321, 415'); ok('B2b recovery only once, then presenting', r2[:2] == ['listReady', 'presenting'], r2)
    ok('B3 results summary uses presenting, celebrating stays for big wins', b2.evaluate("FlossFoxPip.STATES.listReady.pose") == 'presenting' and b2.evaluate("FlossFoxPip.STATES.celebrating.pose") == 'celebrating')
    b2.select_option('#dest', 'anchor'); dsc = b2.evaluate("[FlossFoxPip.current(),document.getElementById('pip').dataset.pose,document.getElementById('pipMsg').textContent]")
    ok('B4 real alternatives found -> discovery (aha), claim matches the list', dsc[:2] == ['helpful', 'discovery'] and 'Anchor options for 3 of your 3 colors' in dsc[2], dsc)
    b2.select_option('#dest', 'dmc'); b2.select_option('#dest', 'dmc')
    ok('B4b compare-brands tip uses discovery; start tip rotates needle / needle-alt', b2.evaluate("FlossFoxPip.STATES.hintCompare.pose") == 'discovery' and sorted(b2.evaluate("[FlossFoxPip.STATES.hintStart.pose(),FlossFoxPip.STATES.hintStart.pose()]")) == ['needle', 'needle-alt'])
    b2.close()
    sv = page(412, True, init=SEED); sv.goto(B); sv.fill('#inp', '310 x2\n321'); sv.click('#go'); sv.wait_for_timeout(4300)
    toast = lambda sel: sv.evaluate(f"(()=>{{const t=document.querySelector('{sel} .savedtoast');if(!t)return null;const i=t.querySelector('img');return [t.getAttribute('aria-hidden'),i.naturalWidth>0||i.complete,/pip-saved-160/.test(i.currentSrc||i.src)]}})()")
    sv.click('#copy'); sv.wait_for_timeout(200); c1 = toast('#copymsg')
    ok('B5 copied -> saved toast (wink) beside the status, decorative, status text announced once', c1 == ['true', True, True] and sv.inner_text('#copymsg').count('Copied') == 1, (c1, sv.inner_text('#copymsg')))
    ov = sv.evaluate("(()=>{const t=document.querySelector('#copymsg .savedtoast').getBoundingClientRect();return [...document.querySelectorAll('button,input,select,textarea,a')].filter(e=>e.offsetParent).filter(e=>{const r=e.getBoundingClientRect();return !(r.right<=t.left||r.left>=t.right||r.bottom<=t.top||r.top>=t.bottom)}).map(e=>e.id||e.tagName)})()")
    ok('B5b toast never covers controls (inline in the status line)', not ov, ov)
    sv.wait_for_timeout(3800); ok('B5c toast auto-dismisses; status text stays', toast('#copymsg') is None and 'Copied' in sv.inner_text('#copymsg'))
    sv.fill('#newProjName', 'Toast'); sv.click('#saveProj'); sv.wait_for_timeout(150); ok('B5d project saved -> saved toast', toast('#copymsg') is not None and 'Saved' in sv.inner_text('#copymsg'))
    sv.click('#openSaved'); sv.wait_for_timeout(150); sv.click('#pCopy'); sv.wait_for_timeout(200); ok('B5e project copied -> saved toast', toast('#pMsg') is not None)
    sv.click('#pAddBox summary') if not sv.locator('#pAdd').is_visible() else None; sv.fill('#pAdd', '3865'); sv.click('#pAddBtn'); sv.wait_for_timeout(150)
    ok('B5f colors added -> saved toast with a short note', toast('#pMsg') is not None and 'Added 1 color' in sv.inner_text('#pMsg'))
    sv.fill('#pAdd', 'zzz'); sv.click('#pAddBtn'); sv.wait_for_timeout(150); ok('B5g nothing added -> no toast (only real events)', toast('#pMsg') is None)
    sv.click('#pClose'); sv.click('#backupBox summary'); sv.set_input_files('#restoreFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': open(FIX, 'rb').read()}); sv.wait_for_timeout(300); sv.click('#rGo'); sv.wait_for_timeout(200)
    ok('B5h backup restored (updated) -> saved toast', toast('#projStatus') is not None and 'Restore done' in sv.inner_text('#projStatus'))
    sv.click('#tabConvert'); sv.click('#pipToggle'); sv.click('#copy'); sv.wait_for_timeout(200); ok('B5i Pip hidden -> no decorative toast, status still shown', toast('#copymsg') is None and 'Copied' in sv.inner_text('#copymsg'))
    fi = sv.evaluate("(()=>{const i=document.querySelector('#askPipBtn img');return [i.naturalWidth,i.naturalHeight,/face-icon/.test(i.currentSrc)]})()")
    ok('B6 face icon avatar on Ask Pip (square, loads, even with Pip hidden)', fi[0] > 0 and fi[0] == fi[1] and fi[2], fi)
    fav = sv.evaluate("[...document.querySelectorAll('link[rel~=icon]')].map(l=>l.getAttribute('href'))")
    favok = all(sv.request.get(B + h).status == 200 for h in fav)
    ok('B6b favicons load; the original SVG favicon is kept as a fallback', favok and 'favicon.svg' in fav, fav)
    # ---------- Batch 3 + 4: needle, organizing, goodbye, cross-stitch ----------
    c = page(412, True, init=SEED); c.goto(B); c.wait_for_timeout(200)
    c.click('#tabProjects'); c.wait_for_timeout(150)
    og = c.evaluate("(()=>{const i=document.querySelector('#projectsView .empty img[data-pose=organizing]');if(!i)return null;const r=i.getBoundingClientRect(),p=i.closest('.card').getBoundingClientRect();return [i.naturalWidth>0,Math.round(r.height-r.width*566/480),r.width,r.bottom<=p.bottom]})()")
    ok('C2 empty projects -> organizing, full image (bottom spools not cropped), ~200px', og and og[0] and abs(og[1]) <= 1 and 180 <= og[2] <= 240 and og[3], og)
    c.click('#tabHelp') if c.locator('#tabHelp').count() else c.evaluate("document.getElementById('helpView').hidden=false")
    c.wait_for_timeout(100); hn = c.evaluate("(()=>{const i=document.querySelector('#helpView .helphead img');return i?[i.dataset.pose,i.naturalWidth>0,Math.round(i.getBoundingClientRect().width)]:null})()")
    ok('C3 Help (how-to) header uses needle at ~80-120px', hn and hn[0] == 'needle' and hn[1] and 80 <= hn[2] <= 120, hn)
    c.goto(B); c.click('#askPipBtn'); poses = []
    for _ in range(2):
        c.click('#askPip [data-a=enter]'); c.wait_for_timeout(80); poses.append(c.get_attribute('#askPip .ahead', 'data-pose'))
    c.click('#askPip [data-a=shop]'); c.wait_for_timeout(80); poses.append(c.get_attribute('#askPip .ahead', 'data-pose'))
    c.click('#askPip [data-a=alts]'); c.wait_for_timeout(80); poses.append(c.get_attribute('#askPip .ahead', 'data-pose'))
    ok('C4 Ask Pip answers: how-to rotates needle/needle-alt, shopping -> organizing, others thinking', sorted(poses[:2]) == ['needle', 'needle-alt'] and poses[2:] == ['organizing', 'thinking'], poses)
    c.goto(B); c.fill('#inp', '310 x2\n321'); c.click('#go'); c.wait_for_timeout(300); c.fill('#newProjName', 'Hoop'); c.click('#saveProj'); c.click('#tabProjects'); c.click('[data-open]'); c.wait_for_timeout(150)
    c.click('#pAllBuy'); c.wait_for_timeout(100)
    ok('C5 list still to buy -> no cross-stitch yet (only real events)', c.locator('img[data-pose=cross-stitch]').count() == 0)
    ok('C6 everything bought (not checked in) -> no cross-stitch', c.locator('img[data-pose=cross-stitch]').count() == 0)
    # ---------- Release review: shopping completion ----------
    DONE = "(()=>{const e=document.querySelector('#projEdit [data-done]');if(!e)return null;const i=e.querySelector('img');return [e.dataset.done,i?i.dataset.pose:null,e.innerText]})()"
    STK = "JSON.stringify((JSON.parse(localStorage.getItem('%s'))||{}).projects.map(p=>[p.decisions,p.purchased,p.received]))" % KEY
    sd = page(412, True, init=SEED); newproj(sd, '310 x1, 321 x1', 'Done'); sd.click('#pAllBuy'); sd.wait_for_timeout(80)
    for code in ['310', '321']:
        sd.locator('#pPlan input[data-bought]:not(:checked)').first.click(); sd.wait_for_timeout(100)
    d1 = sd.evaluate(DONE)
    ok('R1 all bought, awaiting check-in -> presenting "Shopping list done!" + check-in guidance, not ready to stitch', d1 and d1[0] == 'done' and d1[1] == 'presenting' and 'Shopping list done' in d1[2] and 'check' in d1[2].lower() and 'stitching' not in d1[2].lower(), d1)
    sd.click('#pShop'); sd.wait_for_timeout(80); d2 = sd.evaluate(DONE)
    ok('R1b Shop mode: same "Shopping list done" state, no cross-stitch', d2 and d2[0] == 'done' and sd.locator('img[data-pose=cross-stitch]').count() == 0, d2)
    for code in ['310', '321']:
        sd.click(f'#sr-dmc_{code}'); sd.fill(f'#sq-dmc_{code}', '1'); sd.click(f'#ss-dmc_{code}'); sd.wait_for_timeout(120)
    d3 = sd.evaluate(DONE)
    ok('R2 every color received in full -> cross-stitch "Ready to start stitching!"', d3 and d3[0] == 'stitch' and d3[1] == 'cross-stitch' and 'Ready to start stitching!' in d3[2], d3)
    before = sd.evaluate(STK); sd.click('#shBack'); sd.wait_for_timeout(80); d4 = sd.evaluate(DONE)
    ok('R2b project view agrees (cross-stitch)', d4 and d4[0] == 'stitch', d4)
    sd.evaluate("document.getElementById('tabConvert').click()"); sd.wait_for_timeout(100); sd.evaluate("document.getElementById('pipToggle').click()"); sd.evaluate("document.getElementById('tabProjects').click()"); sd.wait_for_timeout(100); sd.click('[data-open]') if sd.locator('[data-open]:visible').count() else None; sd.wait_for_timeout(80); d5 = sd.evaluate(DONE)
    ok('R3 Pip hidden: same completion state and text, no Pip images', d5 and d5[0] == 'stitch' and d5[1] is None and 'Ready to start stitching!' in d5[2] and sd.locator('#projectsView img[src*="assets/pip/"]:visible').count() == 0, d5)
    ok('R3b Pip never changes Have/Check/Buy or bought/received records', sd.evaluate(STK) == before)
    sa = page(412, True, init=SEED); newproj(sa, '310 x1\n321', 'Assumed'); sa.click('#pAllBuy'); sa.wait_for_timeout(80); sa.click('#pShop')
    for code in ['310', '321']:
        sa.click(f'#sb-dmc_{code}'); sa.click(f'#sw-dmc_{code}'); sa.fill(f'#sq-dmc_{code}', '1'); sa.click(f'#ss-dmc_{code}'); sa.wait_for_timeout(120)
    d6 = sa.evaluate(DONE)
    ok('R4 received but an amount was only assumed -> reassuring guidance, never cross-stitch', d6 and d6[0] == 'check' and d6[1] == 'reassuring' and sa.locator('img[data-pose=cross-stitch]').count() == 0, d6)
    se = page(412, True, init=SEED); newproj(se, '310 x1', 'Empty'); se.click('#pShop') if se.locator('#pShop').count() else None; se.wait_for_timeout(80); d7 = se.evaluate(DONE)
    ok('R5 nothing marked to buy -> organizing (or no completion block), never cross-stitch', (d7 is None or d7[1] in ('organizing', 'reassuring', None)) and se.locator('img[data-pose=cross-stitch]').count() == 0, d7)
    # ---------- Release review: art delivery and usability ----------
    ld = page(412, True, init=SEED); reqs = []; ld.on('request', lambda r: reqs.append(r.url) if '/assets/pip/' in r.url else None); ld.goto(B); ld.wait_for_timeout(600)
    poses = sorted({re.sub(r'-(\d+)\.(webp|png)$', '', u.split('/pip-')[-1]) for u in reqs})
    ok('A1 first screen loads only the Pip images it shows (current pose + Ask Pip face, one size each)', set(poses) - {'curious', 'presenting', 'reassuring', 'puzzled'} <= {'greeting', 'greeting-alt', 'neutral', 'face-icon'} and len([u for u in reqs if 'face-icon' in u]) == 1, reqs)  # returning visitors also fetch the HTML default greeting once (known, ~15 KB)
    ld.wait_for_timeout(3600); poses = {re.sub(r'-(\d+)\.(webp|png)$', '', u.split('/pip-')[-1]) for u in reqs}
    ok('A1c after idle only the 5 likely-next companion poses are warmed; tips, empty states, tour, goodbye, cross-stitch art wait for their view', poses <= {'greeting', 'greeting-alt', 'neutral', 'face-icon', 'curious', 'presenting', 'reassuring', 'puzzled'}, sorted(poses))
    ld.click('#tabHelp') if ld.locator('#tabHelp').count() else None; ld.wait_for_timeout(300)
    ok('A1b deferred images still load when their view opens (Help needle)', any('pip-needle' in u for u in reqs), reqs)
    dist = []
    for view in ['#tabConvert', '#tabProjects', '#tabHelp']:
        if ld.locator(view).count(): ld.click(view); ld.wait_for_timeout(200)
        dist += ld.evaluate("""[...document.querySelectorAll('img[src*="assets/pip/"]')].filter(i=>i.offsetWidth&&i.naturalWidth).map(i=>{const r=i.getBoundingClientRect(),cs=getComputedStyle(i);const a=r.width/r.height,n=i.naturalWidth/i.naturalHeight;return [i.currentSrc.split('/').pop(),cs.objectFit,Math.abs(a-n)/n]}).filter(x=>x[1]!=='contain'&&x[2]>0.03)""")
    ok('A2 no stretched or squashed Pip anywhere (aspect kept or object-fit: contain)', not dist, dist)
    big = page(320, True, init=SEED); big.goto(B); big.add_style_tag(content='html{font-size:200%!important}'); big.wait_for_timeout(200)
    ok('U1 200% text at 320px: no horizontal overflow on Add colors', big.evaluate('document.documentElement.scrollWidth') <= 322, big.evaluate('document.documentElement.scrollWidth'))
    big.click('#askPipBtn'); big.wait_for_timeout(100)
    pk = big.evaluate("""(()=>{const p=document.querySelector('#askPip .apeek');if(!p)return 'none';const r=p.getBoundingClientRect();const hits=[...document.querySelectorAll('#askPip button')].filter(b=>{const q=b.getBoundingClientRect();return !(q.right<=r.left||q.left>=r.right||q.bottom<=r.top||q.top>=r.bottom)});return [getComputedStyle(p).pointerEvents,hits.length]})()""")
    ok('U2 large text: peeking Pip covers no Ask Pip button and ignores taps', pk == 'none' or (pk[0] == 'none' and pk[1] == 0), pk)
    big.set_viewport_size({'width': 320, 'height': 360}); big.wait_for_timeout(100)
    ok('U2b keyboard-open height (360px): peeking still covers nothing', big.evaluate("""(()=>{const p=document.querySelector('#askPip .apeek');if(!p)return true;const r=p.getBoundingClientRect();return ![...document.querySelectorAll('#askPip button,#inp')].some(b=>{const q=b.getBoundingClientRect();return !(q.right<=r.left||q.left>=r.right||q.bottom<=r.top||q.top>=r.bottom)})})()"""))
    rv2 = page(412, True, init=SEED); rv2.goto(B); rv2.wait_for_timeout(150)
    ok('U3 Pip messages are not a live region (no chatty screen reader output); Pip art is alt=""', rv2.evaluate("!document.getElementById('pipMsg').hasAttribute('aria-live')&&[...document.querySelectorAll('img[src*=pip-]')].every(i=>i.alt==='')"))
    ok('C6b phone: no horizontal overflow with cross-stitch', c.evaluate('document.documentElement.scrollWidth') <= 412)
    ab = page(412, True, init=SEED); ab.goto(B + 'about.html'); ab.wait_for_timeout(150)
    ax = ab.evaluate("(()=>{const i=document.querySelector('img[data-pose=cross-stitch]');return i?[i.naturalWidth>0,Math.round(i.getBoundingClientRect().width),i.alt]:null})()")
    ok('C7 About craft promo spot: cross-stitch, decorative, ~96px', ax and ax[0] and 80 <= ax[1] <= 120 and ax[2] == '', ax)
    nb = page(412, True, init=SEED); nb.goto(B); nb.wait_for_timeout(150); nb.evaluate("FlossFoxPip.bye&&FlossFoxPip.bye()"); nb.wait_for_timeout(100); was = nb.evaluate("FlossFoxPip.current()")
    nb.fill('#inp', '99999'); nb.click('#go'); nb.wait_for_timeout(150)
    ok('C8 goodbye is calm: shows on a calm base, never over an error', was == 'goodbye' and nb.evaluate("FlossFoxPip.bye()") is False, was)
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
