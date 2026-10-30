#!/usr/bin/env python3
"""1.8.1 inventory regressions S-001 / S-002 via the real UI (threads.js -> projects.js). Fresh contexts only.
Usage: python tests/inventory_e2e.py [BASE_URL] [--shots DIR]"""
import sys, os, argparse, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('base', nargs='?', default='http://localhost:8765/'); ap.add_argument('--chrome', default='/usr/bin/google-chrome'); ap.add_argument('--shots', default=None)
A = ap.parse_args(); B = A.base if A.base.endswith('/') else A.base + '/'
KEY = os.environ.get('FF_KEY', 'flossfox.v1'); PFX = KEY[:-3]; TKEY = PFX + '.threads.v1'
R = {'pass': 0, 'fail': 0}
def ok(n, c, info=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {info}'))
def P(id, item, dec): return {'schema': 2, 'projects': [{'id': id, 'name': id, 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [item], 'decisions': dec, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}]}
def shot(g, n):
    if A.shots: os.makedirs(A.shots, exist_ok=True); g.screenshot(path=os.path.join(A.shots, n), full_page=True)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=A.chrome, args=['--no-sandbox'])
    def page(seed):
        ctx = br.new_context(viewport={'width': 1200, 'height': 900})
        ctx.add_init_script("if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');const S=%s;for(const k in S)localStorage.setItem(k,S[k])}" % (PFX, json.dumps(seed)))
        g = ctx.new_page(); g.goto(B); g.wait_for_load_state('networkidle'); return g
    ls = lambda g, k: json.loads(g.evaluate(f"localStorage.getItem('{k}')") or 'null')
    # S-001: 310 added without amount (1 unconfirmed) + project "310 x1" stated
    g = page({KEY: json.dumps(P('s1', {'code': '310', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['310 x1']}, {}))})
    g.click('#tabThreads'); g.fill('#thAdd', '310'); g.click('#thAddBtn'); g.wait_for_timeout(100)
    e = ls(g, TKEY)['threads']['310']; print('S-001 collection entry:', e)
    g.click('#tabProjects'); g.click('[data-open="s1"]'); g.wait_for_timeout(150)
    own, unv = g.inner_text('#cmpOwned'), g.inner_text('#cmpUnver'); print('S-001 compare:', own, '|', unv)
    g.evaluate("(()=>{const d=document.getElementById('pCmpBox');if(d&&!d.open)d.querySelector('summary').click()})()"); g.click('#pUseColl'); g.wait_for_timeout(100); print('S-001 preview:', g.inner_text('#pPrevSum')); g.click('#pApplyColl'); g.wait_for_timeout(150)
    d = ls(g, KEY)['projects'][0]['decisions']['310']; body = g.inner_text('#pSum'); print('S-001 decision:', d); print('S-001 summary:', body[:200].replace('\n', ' / '))
    shot(g, 's001.png')
    ok('S-001a unconfirmed stock is unverified, not owned', own.startswith('✓ 0') and unv.startswith('? 1'), own + ' ' + unv)
    ok('S-001b Use my collection marks it Not sure, not Have enough', d['status'] == 'check', d)
    ok('S-001c project is not Ready to stitch', 'ready to stitch' not in body.lower() and 'to check first' in body, body[:200])
    # confirmed stock still counts as owned (no over-correction)
    g = page({TKEY: json.dumps({'schema': 1, 'threads': {'310': {'n': 1, 'partial': False, 'restock': False, 'updated': '', 'confirmed': True}}}), KEY: json.dumps(P('s1b', {'code': '310', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['310 x1']}, {}))})
    g.click('#tabProjects'); g.click('[data-open="s1b"]'); g.wait_for_timeout(150)
    ok('S-001d confirmed stock covering a stated need is still owned', g.inner_text('#cmpOwned').startswith('✓ 1'), g.inner_text('#cmpOwned'))
    # S-002: 310 x2 Have enough with 0.5 owned -> import
    def imp(dec, tag):
        g = page({KEY: json.dumps(P('s2', {'code': '310', 'qty': 2, 'stated': True, 'assumed': 0, 'src': ['310 x2']}, {'310': dec}))})
        g.click('#tabThreads'); g.click('#thImport'); g.wait_for_timeout(150); shot(g, f's002{tag}.png')
        e = ls(g, TKEY)['threads']['310']; print(f'S-002{tag} imported:', e); return e
    e = imp({'status': 'have', 'owned': 0.5, 'ownedSource': 'user', 'anchor': None, 'recv': None}, '')
    ok('S-002a explicit 0.5 owned imports as 0 full + partial', e['n'] == 0 and e['partial'] is True, e)
    e = imp({'status': 'have', 'owned': None, 'anchor': None, 'recv': None}, 'b')
    ok('S-002b no owned amount: count from needed amount is unconfirmed', e['n'] == 2 and not e.get('confirmed'), e)
    e = imp({'status': 'have', 'owned': 3, 'ownedSource': 'user', 'anchor': None, 'recv': None}, 'c')
    ok('S-002c explicit 3 owned imports as 3, confirmed', e['n'] == 3 and e.get('confirmed') is True, e)
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
