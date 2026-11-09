#!/usr/bin/env python3
"""Recent changes view in the real page: read-only, no storage writes, safe text, mobile layout.
Results are simulated (headless Chrome, synthetic data). Usage: FF_KEY=flossfox-dev.v1 python tests/recent_changes_e2e.py http://localhost:8765/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; JK = PFX + '.journal.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/recent-changes-logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
EVIL = '<img src=x onerror="window.__xss=1">'
P1 = {'id': 'p1', 'name': EVIL, 'notes': '', 'buyBrand': 'dmc', 'status': 'done', 'items': [{'code': '310', 'qty': 1, 'stated': True, 'assumed': 0, 'src': ['DMC 310'], 'stitchCount': None}], 'decisions': {}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}
SEED = json.dumps({'schema': 2, 'projects': [P1]})
THR = json.dumps({'schema': 2, 'threads': {'310': {'n': 3, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}, 'BLANC': {'n': 1, 'partial': False, 'restock': True, 'confirmed': True, 'updated': '2026-10-01T00:00:00Z'}}})
def ev(i, t, k, ref, f, to): return {'id': i, 't': t, 'k': k, 'ref': ref, 'from': f, 'to': to}
EVS = [ev('e1', '2026-11-01T15:00:00Z', 'inventory', {'code': '310'}, {'n': 2, 'partial': False}, {'n': 3, 'partial': True}),
       ev('e2', '2026-11-02T15:00:00Z', 'project', {'pid': 'p1'}, 'progress', 'done'),
       ev('e3', '2026-11-03T15:00:00Z', 'shopping', {'code': 'BLANC'}, False, True),
       ev('e4', '2026-11-04T15:00:00Z', 'shopping', {'pid': 'p1', 'code': '<b>9</b>'}, False, True)]
EVS += [ev('m%02d' % i, '2026-10-%02dT12:00:00Z' % (i + 1), 'inventory', {'code': str(100 + i)}, None, {'n': 1, 'partial': False}) for i in range(28)]
def journal(evs): return json.dumps({'schema': 1, 'base': None, 'cps': [], 'events': evs})
INIT = """(([K,TK,JK,S,T,J,P])=>{if(!sessionStorage.getItem('rc.seeded')){localStorage.clear();if(S)localStorage.setItem(K,S);if(T)localStorage.setItem(TK,T);if(J!==null)localStorage.setItem(JK,J);sessionStorage.setItem('rc.seeded','1')}
for(const p of [P,'flossfox']){localStorage.setItem(p+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(p+'.hints.v1','off')}})"""
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
def ctx(br, vw, seed, thr, j):
    c = br.new_context(viewport=vw, service_workers='block', is_mobile=vw['width'] < 500, has_touch=vw['width'] < 500)
    c.add_init_script(INIT[:-1] + f")({json.dumps([KEY, TK, JK, seed, thr, j, PFX])})")
    g = c.new_page(); g.set_default_timeout(8000); g.on('pageerror', lambda e: errs.append(str(e))); return c, g
def open_rc(g):
    g.goto(B + '?nosw#settings'); g.wait_for_function('window.FlossFoxJournal&&window.FlossFoxRecentChanges&&document.getElementById("recentChanges")'); g.wait_for_timeout(400)
    g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(150)
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # 1. Desktop with a seeded journal: render, order, read-only
    c, g = ctx(br, {'width': 1200, 'height': 900}, SEED, THR, journal(EVS)); open_rc(g)
    before = g.evaluate(DUMP); wbefore = g.evaluate("localStorage.getItem('%s')+'|'+localStorage.getItem('%s')" % (KEY, TK))
    g.evaluate("(()=>{window.__w=0;const S=Storage.prototype,o=S.setItem,r=S.removeItem,cl=S.clear;S.setItem=function(...a){window.__w++;return o.apply(this,a)};S.removeItem=function(...a){window.__w++;return r.apply(this,a)};S.clear=function(){window.__w++;return cl.apply(this)}})()")
    g.click('#recentChanges summary'); g.wait_for_timeout(200)
    rows = g.locator('#recentChanges .rclist li'); n = rows.count()
    ok('RENDER-1 first page bounded to 25 rows', n == 25, n)
    t = [rows.nth(i).inner_text() for i in range(4)]
    ok('ORDER-1 newest first (shopping project color first)', 'marked Need to buy' in t[0] and 'Floss BLANC added to your shopping list' in t[1], t)
    ok('PROJ-1 project status change readable', 'In progress → Completed' in t[2], t[2])
    ok('INV-1 inventory before/after readable', '2 skeins → 3 skeins plus a partial' in t[3], t[3])
    ok('BLANC-1 BLANC never shown as WHITE', 'white' not in g.inner_text('#recentChanges').lower() and 'Floss BLANC' in t[1])
    ok('XSS-1 project name and code shown as plain text', g.evaluate('window.__xss') is None and g.locator('#recentChanges img').count() == 0 and EVIL in t[0] and '<b>9</b>' in t[0], t[0])
    ok('DATE-1 local formatted time with machine datetime', g.locator('#recentChanges time').first.get_attribute('datetime') == '2026-11-04T15:00:00Z' and '2026' in g.locator('#recentChanges time').first.inner_text())
    ok('LIMITS-1 history limits shown', '500' in g.inner_text('#recentChanges .rclimits') and '10 minutes' in g.inner_text('#recentChanges .rclimits') and 'another open tab' in g.inner_text('#recentChanges .rclimits'))
    ok('NOCTRL-1 no edit/delete/undo controls', g.locator('#recentChanges button:not(.rcmore), #recentChanges input, #recentChanges a').count() == 0)
    g.click('#recentChanges .rcmore'); g.wait_for_timeout(100)
    ok('MORE-1 Show more reveals the rest then hides', rows.count() == 32 and g.locator('#recentChanges .rcmore').is_hidden(), rows.count())
    g.click('#recentChanges summary'); g.wait_for_timeout(100); g.click('#recentChanges summary'); g.evaluate("FlossFoxRecentChanges.render()"); g.wait_for_timeout(100)
    ok('NOWRITE-1 opening, closing, rendering made zero storage writes', g.evaluate('window.__w') == 0, g.evaluate('window.__w'))
    ok('NOWRITE-2 every key byte-identical after viewing', g.evaluate(DUMP) == before)
    ok('NOWRITE-3 collection and project keys byte-identical', g.evaluate("localStorage.getItem('%s')+'|'+localStorage.getItem('%s')" % (KEY, TK)) == wbefore)
    ok('NOWRITE-4 journal event count unchanged', len(json.loads(g.evaluate(f"localStorage.getItem('{JK}')"))['events']) == len(EVS))
    g.screenshot(path=f'{SHOTS}/desktop.png', full_page=False); c.close()
    # 2. Mobile 360px: layout and accessibility
    c, g = ctx(br, {'width': 360, 'height': 740}, SEED, THR, journal(EVS)); open_rc(g); g.click('#recentChanges summary'); g.wait_for_timeout(200)
    ok('MOB-1 no horizontal overflow at 360px', g.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'), g.evaluate('document.documentElement.scrollWidth'))
    ok('MOB-2 summary and Show more are at least 44px tall', g.evaluate("['#recentChanges summary','#recentChanges .rcmore'].every(s=>document.querySelector(s).getBoundingClientRect().height>=44)"))
    ok('A11Y-1 list labelled and status region present', g.get_attribute('#recentChanges .rclist', 'aria-label') and g.get_attribute('#recentChanges .rcmsg', 'role') == 'status')
    g.locator('#recentChanges').scroll_into_view_if_needed(); g.screenshot(path=f'{SHOTS}/mobile-360.png'); c.close()
    # 3. Missing journal: friendly empty state, still no writes
    c, g = ctx(br, {'width': 390, 'height': 800}, SEED, THR, None); open_rc(g); b2 = g.evaluate(DUMP); g.click('#recentChanges summary'); g.wait_for_timeout(150)
    ok('EMPTY-1 friendly empty state', 'No changes yet' in g.inner_text('#recentChanges .rcmsg') and g.locator('#recentChanges .rclist li').count() == 0)
    ok('EMPTY-2 no writes', g.evaluate(DUMP) == b2); g.screenshot(path=f'{SHOTS}/empty.png'); c.close()
    # 4. Corrupt journal and unknown events
    c, g = ctx(br, {'width': 1000, 'height': 800}, SEED, THR, '{not json'); open_rc(g); g.click('#recentChanges summary'); g.wait_for_timeout(150)
    ok('CORRUPT-1 corrupt journal shows empty state, app still works', 'No changes yet' in g.inner_text('#recentChanges') and g.locator('#tabThreads').is_visible()); c.close()
    odd = json.dumps({'schema': 1, 'base': None, 'cps': [], 'events': [EVS[0], ev('z1', '2026-11-05T00:00:00Z', 'milestone', {'pid': 'p1'}, 1, 2), ev('z2', '2026-11-05T00:00:00Z', 'project', {'pid': 'p1'}, 'x', 'done')]})
    c, g = ctx(br, {'width': 1000, 'height': 800}, SEED, THR, odd); open_rc(g); g.click('#recentChanges summary'); g.wait_for_timeout(150)
    ok('UNKNOWN-1 unknown/invalid events skipped, valid one shown', g.locator('#recentChanges .rclist li').count() == 1 and 'milestone' not in g.inner_text('#recentChanges').lower()); c.close()
    # 5. Storage that throws on read
    c, g = ctx(br, {'width': 1000, 'height': 800}, SEED, THR, journal(EVS)); open_rc(g)
    g.evaluate("void(Storage.prototype.getItem=function(){throw new Error('denied')})"); g.click('#recentChanges summary'); g.wait_for_timeout(150)
    ok('STORE-1 failed storage read does not break the view', g.locator('#recentChanges .rcmsg').is_visible() and g.locator('#tabThreads').is_visible()); c.close()
    ok('ERR-1 no page errors', not errs, errs[:3])
    br.close()
print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
