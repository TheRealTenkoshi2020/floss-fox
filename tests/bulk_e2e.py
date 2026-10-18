#!/usr/bin/env python3
"""v2 increment 1: strict bulk list review (bulk-review.js). Usage: python tests/bulk_e2e.py [BASE_URL] [--shots DIR]"""
import os, json, argparse
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'
R = {'pass': 0, 'fail': 0}
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {info}'))
SEED = {'schema': 1, 'threads': {'310': {'n': 2, 'partial': True, 'restock': True, 'updated': '2026-10-01T00:00:00Z', 'confirmed': True}, '321': {'n': 1, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z'}}}
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    for w, mob in ((390, True), (673, True), (1280, False)):
        ctx = br.new_context(viewport={'width': w, 'height': 900}, is_mobile=mob, device_scale_factor=2 if mob else 1)
        ctx.add_init_script("if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s',%s)}" % (PFX, TKEY, json.dumps(json.dumps(SEED))))
        g = ctx.new_page(); errs = []; g.on('pageerror', lambda e: errs.append(str(e)))
        g.goto(B); g.wait_for_load_state('networkidle'); g.click('#tabThreads')
        ls = lambda: json.loads(g.evaluate(f"localStorage.getItem('{TKEY}')"))
        t = f'[{w}] '
        g.fill('#thAdd', '310 x3\n321 1160\nDMC 3865: 1'); g.click('#thBulkBtn')
        ok(t + 'ambiguous "321 1160" rejected, save disabled', 'Line 2' in g.inner_text('#bkPanel') and g.is_disabled('#bkSave'))
        g.click('#bkCancel'); ok(t + 'cancel writes nothing', ls() == SEED)
        g.fill('#thAdd', '310 x3\n321 x25\n3865\n# note'); g.click('#thBulkBtn')
        ok(t + 'save disabled until Set/Add chosen', g.is_disabled('#bkSave'))
        g.check('input[name="bkMode"][value="set"]')
        ok(t + '>20 needs tick', g.is_disabled('#bkSave') and g.locator('[data-ok="321"]').count() == 1)
        g.check('[data-ok="321"]'); ok(t + 'save enabled after tick', g.is_enabled('#bkSave'))
        if w == 390 and A.shots:
            os.makedirs(A.shots, exist_ok=True); g.fill('#thAdd', g.input_value('#thAdd'))
            g.locator('#thCard').screenshot(path=os.path.join(A.shots, 'bulk-review-390.png'))
        sw = g.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(t + 'no horizontal page overflow', sw[0] <= sw[1], sw)
        ok(t + 'still nothing written before save', ls() == SEED)
        g.click('#bkSave'); g.wait_for_timeout(100); d = ls()['threads']
        ok(t + 'set 310=3 keeps partial+restock, confirmed', d['310']['n'] == 3 and d['310']['partial'] and d['310']['restock'] and d['310'].get('confirmed') is True, d['310'])
        ok(t + '321=25 confirmed', d['321']['n'] == 25 and d['321'].get('confirmed') is True, d['321'])
        ok(t + '3865 no amount -> 1 unconfirmed', d['3865']['n'] == 1 and 'confirmed' not in d['3865'] and d['3865']['partial'] is False, d['3865'])
        ok(t + 'shape unchanged', all(set(v) <= {'n', 'partial', 'restock', 'updated', 'confirmed'} for v in d.values()) and set(ls()) == {'schema', 'threads'})
        g.click('#bkUndo'); g.wait_for_timeout(100); ok(t + 'undo restores exact threads (schema may be 2 per CI005 contract)', ls()['threads'] == SEED['threads'] and ls()['schema'] in (1, 2), ls())
        g.fill('#thAdd', '310 x2'); g.click('#thBulkBtn'); g.check('input[name="bkMode"][value="add"]'); g.click('#bkSave'); g.wait_for_timeout(100)
        ok(t + 'add mode adds on top', ls()['threads']['310']['n'] == 4)
        g.fill('#thAdd', '321'); g.click('#thBulkBtn'); ok(t + 'existing no-amount: nothing to save', g.is_disabled('#bkSave'))
        g.click('#bkCancel'); ok(t + 'no page errors', not errs, errs); ctx.close()
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed"); raise SystemExit(1 if R['fail'] else 0)
