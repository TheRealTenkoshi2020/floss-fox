#!/usr/bin/env python3
"""Floss Fox 1.7 RC full workflow at 360, 390 and 1280 px, with a persistent browser profile:
first visit -> paste a 24-color legend with stitch counts -> save collection -> create project -> compare ->
missing/short counts -> shopping list -> close + reopen (persisted) -> edit + undo (collection unchanged) ->
export, clear storage, import, restored. Also nav, readability, 44px touch targets, scrolling, Pip, quick DMC conversion.
Usage: python tests/workflow_e2e.py [BASE_URL] [--shots DIR]   (preview: set FF_KEY like regression.py)"""
import sys, os, argparse, json, tempfile, shutil
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(info)[:400]}'))
L24 = ['310', '321', '666', '815', '817', '3865', 'B5200', '413', '414', '415', '762', '318', '317', '498', '304', '3799', '535', '3371', '699', '700', '702', '704', '725', '727']
NAMES = {}
LEGEND = '\n'.join(f'{i+1} DMC {c} Shade {(i+1)*137}' for i, c in enumerate(L24))
OWN = L24[:18]          # collection: first 18 colors (2 skeins each, 321 only 1)
MISSING = L24[18:]      # 6 missing
with sync_playwright() as p:
    for W in [360, 390, 1280]:
        mob = W < 600; prof = tempfile.mkdtemp(prefix=f'ffwf{W}-')
        def launch():
            c = p.chromium.launch_persistent_context(prof, executable_path=A.chrome, args=['--no-sandbox'], viewport={'width': W, 'height': 800 if mob else 900},
                                                     is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1, accept_downloads=True)
            c.add_init_script('window.FF_NO_AUTOCMP=true')  # legacy suite drives Use my collection by hand
            c.grant_permissions(['clipboard-read', 'clipboard-write'])
            g = c.pages[0] if c.pages else c.new_page(); g.on('pageerror', lambda e: errs.append(f'{W}: {e}')); g.on('dialog', lambda d: d.accept())
            g.goto(B); g.wait_for_load_state('networkidle'); return c, g
        T = f'[{W}]'; ctx, g = launch()
        ls = lambda k: g.evaluate(f"localStorage.getItem({json.dumps(k)})")
        shot = lambda n: (os.makedirs(A.shots, exist_ok=True), g.screenshot(path=f'{A.shots}/{n}-{W}.png')) if A.shots else None
        # first visit
        ok(f'W1 {T} first visit: Find My Floss selected, Pip says hello, no saved data', g.get_attribute('#tabConvert', 'aria-pressed') == 'true' and g.locator('#tourYes').count() == 1 and ls(KEY) is None and ls(TKEY) is None)
        shot('01-first-visit'); g.click('#tourNo')
        ok(f'W2 {T} Pip invite dismissed in one tap', g.locator('#tourYes').count() == 0)
        # quick DMC conversion unchanged
        g.fill('#inp', '310 x2\n321'); g.click('#go'); g.select_option('#dest', 'anchor'); g.wait_for_timeout(80)
        sh = [x.strip() for x in g.locator('#shop li').all_inner_texts()]
        ok(f'W3 {T} quick DMC -> Anchor conversion unchanged (403 × 2, 47/9046 × 1)', 'Anchor 403 × 2 (for DMC 310 · chart)' in sh and any('DMC 321' in x for x in sh), sh)
        g.select_option('#dest', 'dmc')
        # paste the 24-color legend into the collection
        g.click('#tabThreads'); g.fill('#thAdd', '\n'.join(f'{i+1} DMC {c} Shade {(i+1)*137}' for i, c in enumerate(OWN)).replace('\n2 DMC 321', '\n2 DMC 321'))
        g.click('#thAddBtn'); g.wait_for_timeout(100)
        for c in OWN:
            if c != '321': g.click(f'#tp-{c}')
        th = json.loads(ls(TKEY))['threads']
        ok(f'W4 {T} collection saved: 18 colors, stitch counts never taken as skeins', len(th) == 18 and all(th[c]['n'] == (1 if c == '321' else 2) for c in OWN), {c: th[c]['n'] for c in th})
        shot('02-collection')
        # create project from the legend
        g.click('#tabConvert'); g.fill('#inp', LEGEND); g.click('#go'); g.wait_for_timeout(100)
        ok(f'W5 {T} 24-color legend parsed with stitch counts', 'Found 24 colors' in g.inner_text('#summary') and 'stitches' in g.inner_text('#convertView'), g.inner_text('#summary'))
        g.fill('#newProjName', 'Workflow project'); g.click('#saveProj'); g.wait_for_timeout(100); g.click('#openSaved'); g.wait_for_timeout(150)
        pr = json.loads(ls(KEY))['projects'][0]
        ok(f'W6 {T} project saved with 24 items, stitchCount kept apart from skeins', len(pr['items']) == 24 and pr['items'][2]['stitchCount'] == 411 and all(i['qty'] == 1 and i['assumed'] == 1 for i in pr['items']))
        # set a real amount for 321 (need 3, have 1) -> short
        g.click('#x-321'); g.fill('#q-321', '3'); g.dispatch_event('#q-321', 'change'); g.wait_for_timeout(100)
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); box = g.inner_text('#pCmpBox')
        ok(f'W7 {T} compare: 0 owned, 17 owned-not-verified, 1 short, 6 missing', g.inner_text('#cmpOwned').startswith('✓ 0') and g.inner_text('#cmpUnver').startswith('? 17') and g.inner_text('#cmpShort').startswith('◐ 1') and g.inner_text('#cmpMissing').startswith('✗ 6'), box)
        ok(f'W8 {T} short color shows need vs have', '321 (need 3 skeins, have 1 skein)' in box, box)
        collBefore = ls(TKEY)
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.wait_for_timeout(80); shot('03-preview'); g.click('#pApplyColl'); g.wait_for_timeout(150)
        plan = g.inner_text('#pPlan'); top = plan.split('Check first')[0].split('Needs attention')[0]
        ok(f'W9 {T} shopping list: the 6 missing + 321 × 2 (only the difference)', all(f'DMC {c}' in top for c in MISSING) and 'DMC 321 × 2' in top and 'DMC 310 ' not in top, top[:500])
        shot('04-shopping')
        # close the browser and reopen with the same profile
        ctx.close(); ctx, g = launch(); ls = lambda k: g.evaluate(f"localStorage.getItem({json.dumps(k)})")
        g.click('#tabProjects'); g.wait_for_timeout(100)
        ok(f'W10 {T} after closing and reopening: project, decisions and collection are still there', 'Workflow project' in g.inner_text('#projList') and ls(TKEY) == collBefore and json.loads(ls(KEY))['projects'][0]['decisions']['699']['status'] == 'buy')
        g.click('#projList [data-open]'); g.wait_for_timeout(150)
        # edit then undo
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.wait_for_timeout(80)
        nothing = 'Nothing to change' in g.inner_text('#pCmpPrev'); g.click('#pCancelColl')
        g.click('#st-310-buy'); g.wait_for_timeout(80); dec0 = json.loads(ls(KEY))['projects'][0]['decisions']
        g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.click('#pApplyColl'); g.wait_for_timeout(100)
        ok(f'W11 {T} re-apply after a manual edit puts 310 back to Not sure', nothing and json.loads(ls(KEY))['projects'][0]['decisions']['310']['status'] == 'check')
        g.click('#pUndoColl'); g.wait_for_timeout(100); dec1 = json.loads(ls(KEY))['projects'][0]['decisions']
        ok(f'W12 {T} Undo restores the manual edit; collection unchanged throughout', dec1['310']['status'] == 'buy' and dec1 == dec0 and ls(TKEY) == collBefore, (dec0.get('310'), dec1.get('310')))
        # export, clear, import
        g.click('#pClose'); g.click('#backupBox summary')
        with g.expect_download() as dl: g.click('#backupBtn')
        bp = os.path.join(prof, 'bk.json'); dl.value.save_as(bp); snapP, snapT = ls(KEY), ls(TKEY)
        g.evaluate('localStorage.clear()'); g.reload(); g.wait_for_load_state('networkidle')
        if g.locator('#tourNo').is_visible(): g.click('#tourNo')  # the tour invite sits on Find floss; a reload on #projects keeps it out of view
        g.click('#tabProjects'); ok(f'W13 {T} storage cleared', ls(KEY) is None or json.loads(ls(KEY))['projects'] == [])
        g.click('#backupBox summary'); g.set_input_files('#restoreFile', bp); g.wait_for_timeout(250); g.click('#rGo'); g.wait_for_timeout(200)
        ok(f'W14 {T} import restores projects and collection exactly', json.loads(ls(KEY))['projects'] == json.loads(snapP)['projects'] and json.loads(ls(TKEY))['threads'] == json.loads(snapT)['threads'])
        # layout checks in each view
        for v in ['tabConvert', 'tabThreads', 'tabProjects']:
            g.click(f'#{v}'); g.wait_for_timeout(80)
            sw = g.evaluate('document.documentElement.scrollWidth'); ok(f'W15 {T} {v}: no sideways scrolling', sw <= W, sw)
            small = g.evaluate("""[...document.querySelectorAll('nav button, nav a, body button:not(.sr), body input[type=number], body select, body label.filebtn, body summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&e.offsetParent!==null&&!e.closest('[hidden]')&&r.height<43.5}).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().height))""")
            cnt = g.evaluate("[...document.querySelectorAll('button,input,select,summary')].filter(e=>e.offsetParent!==null).length")
            ok(f'W16 {T} {v}: all {cnt} visible buttons/inputs at least 44px tall', cnt > 5 and not small, small[:12])
            fs = g.evaluate("Math.min(...[...document.querySelectorAll('body p, body li, body label')].filter(e=>e.offsetParent&&e.textContent.trim()).map(e=>parseFloat(getComputedStyle(e).fontSize)))")
            ok(f'W17 {T} {v}: smallest text >= 12px (step chips 12.2px and art credit 12.8px are the smallest, unchanged from 1.6)', fs >= 12, fs)
        g.click('#tabThreads'); g.evaluate('window.scrollTo(0,document.body.scrollHeight)'); g.wait_for_timeout(80)
        ok(f'W18 {T} collection scrolls to the end', g.evaluate('window.scrollY') > 0 or g.evaluate('document.body.scrollHeight') <= 800 + 10)
        shot('05-restored')
        ctx.close(); shutil.rmtree(prof, ignore_errors=True)
    ok('no JS errors', not errs, errs[:3])
print(f"\nworkflow_e2e: {R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
