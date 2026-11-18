#!/usr/bin/env python3
"""3.9 Atelier Stage B: Workbasket, Continue project, Resume where I was (opt-in) with precedence, Reset display settings,
universal search (keyboard, live refresh, local only, BLANC/WHITE/B5200 distinct), +/- skein Undo and rollback, no data writes
from visiting, no horizontal overflow at 360/390/768/1280. SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_stageb_e2e.py http://localhost:8765/floss-fox-dev/"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
def it(c, q=1): return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status, 'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {}, 'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', '321', '3865', '797', '725', '433', '3371'], leftOff='Finished page 2, next is the border'),
                                  proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z'),
                                  proj('p3', 'Older Planning Piece', ['B5200'], status='planning', upd='2026-10-01T10:00:00.000Z')]}
THR = {'schema': 2, 'threads': {'310': {'n': 2, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z', 'storage': {'container': 'Box 2', 'slot': 'Row B'}},
                                'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
                                '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
def ctx(br, seed, w=1200, h=900, landing_seen=True):
    c = br.new_context(viewport={'width': w, 'height': h}, service_workers='block')
    c.add_init_script("if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}%s"
                      % (json.dumps(seed), "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" if landing_seen else ''))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); g.reqs = []
    g.on('request', lambda r: g.reqs.append(r.url)); return c, g
def ready(g): g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxThreadsUI'); g.wait_for_timeout(250)
def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET}
    if extra: s.update(extra)
    return s
def view(g): return g.evaluate("['workbasket','convert','threads','projects','shop','help','settings'].find(v=>{const b=document.getElementById('tab'+v[0].toUpperCase()+v.slice(1));return b&&b.getAttribute('aria-pressed')==='true'})")
def nooverflow(g): return g.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # 1. New visitor: landing + Start here intact, no Workbasket, nothing written by visiting tabs or searching
    c, g = ctx(br, {}, 390, 800, landing_seen=False); g.goto(B + '?nosw'); ready(g)
    ok('new: landing shown with Start here', g.locator('#ffLanding').is_visible() and g.locator('#ffStartHere').count() == 1)
    g.click('#ffLanding a[data-tab="tabConvert"]'); g.wait_for_timeout(300)
    base = g.evaluate(DUMP)
    ok('new: Workbasket tab hidden', g.locator('#tabWorkbasket').is_hidden())
    ok('new: search button present (44px)', g.evaluate("(()=>{const r=document.getElementById('ffSearchBtn').getBoundingClientRect();return r.width>=44&&r.height>=44})()"))
    for tab in ('Threads', 'Projects', 'Shop', 'Help', 'Settings', 'Convert'): g.click('#tab' + tab); g.wait_for_timeout(120)
    g.click('#ffSearchBtn'); g.fill('#ffSearchIn', '310'); g.wait_for_timeout(300); g.keyboard.press('Escape')
    ok('new: tabs + search wrote nothing', g.evaluate(DUMP) == base, g.evaluate(DUMP))
    ok('new: resume result off', g.evaluate("FlossFoxAtelier.resumeResult()") == 'off')
    ok('new: no page errors', not g.errs, g.errs); c.close()
    # 2. Returning visitor: Workbasket
    c, g = ctx(br, seed_all()); g.goto(B + '?nosw'); ready(g)
    base = g.evaluate(DUMP)
    ok('ret: Workbasket tab visible, first in nav', g.locator('#tabWorkbasket').is_visible() and g.evaluate("document.querySelector('nav.tabs').firstElementChild.id") == 'tabWorkbasket')
    ok('ret: default view still Find floss (no forced dashboard)', view(g) == 'convert')
    g.click('#tabWorkbasket'); g.wait_for_timeout(200)
    t = g.inner_text('#workbasketView')
    ok('ret: title "Your workbasket"', 'Your workbasket' in t)
    ok('ret: last active (not done, newest) project shown', 'Sample Autumn Wreath' in t and 'Sample Done Bookmark' not in t, t[:300])
    ok('ret: real status label + leftOff note', 'In progress' in t and 'Finished page 2, next is the border' in t)
    ok('ret: owned = distinct colors (3), not skeins (8)', '3 colors in My threads' in t, t)
    ok('ret: to-buy / check-first counts from planner, labeled', 'to buy' in t and 'to check first' in t)
    ok('ret: no percentage anywhere', '%' not in t)
    ok('ret: palette strip 6 + "+2", labelled', g.locator('#workbasketView .ffa-strip li.ffa-floss').count() == 6 and '+2' in t)
    ok('ret: BLANC swatch keeps its own label', g.locator('#workbasketView .ffa-floss[aria-label^="DMC BLANC"]').count() == 1)
    ok('ret: quick links present', all(x in t for x in ('Find a color', 'My threads', 'Shop missing threads', 'Fabric calculator')))
    g.screenshot(path=f'{SHOTS}/stageB-workbasket-1200.png', full_page=True)
    ok('ret: viewing Workbasket wrote nothing', g.evaluate(DUMP) == base)
    g.click('#ffWbContinue'); g.wait_for_timeout(300)
    ok('ret: Continue opens that project in Projects', view(g) == 'projects' and g.evaluate("FlossFoxProjects.openId()") == 'p1')
    ok('ret: Continue focuses the Where I left off note', g.evaluate("document.activeElement&&document.activeElement.id") == 'pLeftOff')
    ok('ret: note text intact', g.input_value('#pLeftOff') == 'Finished page 2, next is the border')
    for tab in ('Workbasket', 'Threads', 'Shop', 'Help', 'Settings', 'Convert', 'Workbasket'): g.click('#tab' + tab); g.wait_for_timeout(120)
    after = dict(json.loads(g.evaluate(DUMP)))
    ok('ret: projects + threads byte-identical after Continue and every tab', after.get(KEY) == json.dumps(PROJ) and after.get(TK) == json.dumps(THR), [k for k in after])
    ok('ret: no Atelier preference written (Resume off)', AK not in after)
    ok('ret: no page errors', not g.errs, g.errs); c.close()
    # 2b. finished-only and threads-only states
    only_done = {'schema': 2, 'projects': [proj('p2', 'Sample Done Bookmark', ['310'], status='done')]}
    c, g = ctx(br, {KEY: json.dumps(only_done), TK: json.dumps(THR), **QUIET}); g.goto(B + '?nosw#workbasket'); ready(g)
    t = g.inner_text('#workbasketView'); ok('done-only: "Every project here is finished", no reopen', 'Every project here is finished' in t and 'Continue project' not in t, t[:200]); c.close()
    c, g = ctx(br, {TK: json.dumps(THR), **QUIET}); g.goto(B + '?nosw#workbasket'); ready(g)
    t = g.inner_text('#workbasketView'); ok('threads-only: "No projects in the hoop yet" + Start a project', 'No projects in the hoop yet' in t and 'Start a project' in t, t[:200])
    ok('threads-only: Workbasket tab visible', g.locator('#tabWorkbasket').is_visible()); c.close()
    # 3. Resume where I was precedence
    pref = lambda **kw: json.dumps({'v': 1, 'theme': 'system', 'rememberPlace': True, 'lastTab': 'threads', 'lastProjectId': None, 'collectionView': 'list', 'lowStockThreshold': 1, 'seasonalPip': False, 'recentConversions': [], **kw})
    c, g = ctx(br, seed_all({AK: pref()}), landing_seen=False); g.goto(B + '?nosw'); ready(g); g.wait_for_timeout(200)
    ok('resume: returning + Resume on skips welcome and reopens last tab', view(g) == 'threads' and not g.locator('#ffLanding').is_visible(), (view(g), g.evaluate("FlossFoxAtelier.resumeResult()")))
    ok('resume: result tab', g.evaluate("FlossFoxAtelier.resumeResult()") == 'tab'); c.close()
    c, g = ctx(br, seed_all({AK: pref()}), landing_seen=False); g.goto(B + '?nosw#shop'); ready(g); g.wait_for_timeout(300)
    ok('resume: deep link #shop beats saved tab', view(g) == 'shop' and g.evaluate("FlossFoxAtelier.resumeResult()") == 'hash', (view(g), g.evaluate("FlossFoxAtelier.resumeResult()")))
    ok('resume: #shop left projects unchanged', g.evaluate(f"localStorage.getItem('{KEY}')") == json.dumps(PROJ)); c.close()
    c, g = ctx(br, seed_all({AK: pref(lastTab='projects', lastProjectId='gone-project')})); g.goto(B + '?nosw'); ready(g); g.wait_for_timeout(300)
    ok('resume: deleted last project falls back to Projects list with a note', view(g) == 'projects' and g.evaluate("FlossFoxProjects.openId()") in (None, '') and 'couldn\'t find the last project' in g.inner_text('#projectsView'), g.evaluate("FlossFoxAtelier.resumeResult()"))
    ok('resume: no page errors on missing project', not g.errs, g.errs); c.close()
    c, g = ctx(br, seed_all({AK: pref(lastTab='projects', lastProjectId='p3')})); g.goto(B + '?nosw'); ready(g); g.wait_for_timeout(300)
    ok('resume: existing last project reopens', g.evaluate("FlossFoxProjects.openId()") == 'p3' and g.evaluate("FlossFoxAtelier.resumeResult()") == 'project'); c.close()
    c, g = ctx(br, {AK: pref()}, 390, 800, landing_seen=False); g.goto(B + '?nosw'); ready(g)
    ok('resume: preference-only fresh visitor still gets landing + Start here', g.locator('#ffLanding').is_visible() and g.locator('#ffStartHere').count() == 1)
    ok('resume: onboarding wins', g.evaluate("FlossFoxAtelier.resumeResult()") == 'onboarding'); c.close()
    c, g = ctx(br, seed_all({AK: '{"v":7,"rememberPlace":true,"lastTab":"threads"}'}), landing_seen=False); g.goto(B + '?nosw'); ready(g)
    ok('resume: newer-schema preference ignored (landing shown, value untouched)', g.locator('#ffLanding').is_visible() and g.evaluate(f"localStorage.getItem('{AK}')") == '{"v":7,"rememberPlace":true,"lastTab":"threads"}'); c.close()
    # 4. Settings: opt-in toggle, recording, Reset
    c, g = ctx(br, seed_all()); g.goto(B + '?nosw#settings'); ready(g)
    ok('settings: Resume off by default', not g.is_checked('#ffResume'))
    g.check('#ffResume'); g.wait_for_timeout(150)
    v = json.loads(g.evaluate(f"localStorage.getItem('{AK}')") or 'null')
    ok('settings: turning on saves a verified preference', v and v['rememberPlace'] is True and 'Saved' in g.inner_text('#ffPrefStatus'), v)
    g.click('#tabThreads'); g.wait_for_timeout(150); v = json.loads(g.evaluate(f"localStorage.getItem('{AK}')"))
    ok('settings: last tab recorded only after opt-in', v['lastTab'] == 'threads')
    g.evaluate("FlossFoxProjects.open('p1')"); g.wait_for_timeout(200); v = json.loads(g.evaluate(f"localStorage.getItem('{AK}')"))
    ok('settings: open project recorded', v['lastTab'] == 'projects' and v['lastProjectId'] == 'p1', v)
    pre = dict(json.loads(g.evaluate(DUMP)))
    g.click('#tabSettings'); g.click('#ffPrefReset'); g.wait_for_selector('#ffConfirm:not([hidden])'); g.click('#ffConfirmKeep'); g.wait_for_timeout(100)
    ok('settings: Keep my settings changes nothing', g.evaluate(f"localStorage.getItem('{AK}')") is not None)
    g.click('#ffPrefReset'); g.wait_for_selector('#ffConfirm:not([hidden])'); g.click('#ffConfirmGo'); g.wait_for_timeout(150)
    post = dict(json.loads(g.evaluate(DUMP)))
    ok('settings: Reset removes only the preference key', AK not in post and {k: v for k, v in pre.items() if k != AK} == post, set(pre) ^ set(post))
    ok('settings: Reset says done and unticks', 'reset' in g.inner_text('#ffPrefStatus').lower() and not g.is_checked('#ffResume'))
    g.evaluate("(()=>{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(/atelier/.test(k))throw new DOMException('full','QuotaExceededError');return o.call(this,k,v)}})()")
    g.click('#ffResume'); g.wait_for_timeout(100)
    ok('settings: blocked save is reported, box unticked, never "Saved"', not g.is_checked('#ffResume') and 'Not saved' in g.inner_text('#ffPrefStatus'), g.inner_text('#ffPrefStatus'))
    ok('settings: no page errors', not g.errs, g.errs); c.close()
    # 5. Search
    c, g = ctx(br, seed_all()); g.goto(B + '?nosw'); ready(g)
    base = g.evaluate(DUMP); g.click('#tabHelp'); g.focus('#tabHelp')
    g.keyboard.press('Control+k'); g.wait_for_timeout(150)
    ok('search: Ctrl+K opens and focuses the field', g.locator('#ffSearch').is_visible() and g.evaluate("document.activeElement.id") == 'ffSearchIn')
    def q(s): g.fill('#ffSearchIn', s); g.wait_for_timeout(260)
    def keys(kind): return g.evaluate(f"[...document.querySelectorAll('#ffSearchList .ffa-sgroup')].filter(x=>x.querySelector('h3').textContent==={json.dumps(kind)}).flatMap(x=>[...x.querySelectorAll('[role=option] b')].map(b=>b.textContent))")
    q('BLANC'); ok('search: BLANC -> DMC BLANC color first, own row', keys('Colors')[:1] and keys('Colors')[0].startswith('DMC BLANC'), keys('Colors'))
    ok('search: BLANC also finds the project that uses it', 'Sample Autumn Wreath' in keys('Projects'))
    q('WHITE'); ok('search: WHITE -> DMC WHITE first, BLANC never relabelled', keys('Colors')[0].startswith('DMC WHITE') and not any(k.startswith('DMC BLANC') and 'white' in k.lower().split('·')[0] for k in keys('Colors')), keys('Colors'))
    ok('search: owned WHITE shows in My threads group', 'DMC WHITE' in keys('My threads'))
    q('B5200'); ok('search: B5200 own row', keys('Colors')[0].startswith('DMC B5200'))
    q('white'); ok('search: whites note when 2+ whites match', '3 different colors' in g.inner_text('#ffSearchNote'), g.inner_text('#ffSearchNote'))
    q('Box 2'); ok('search: storage location finds DMC 310 with its spot', keys('My threads') == ['DMC 310'] and 'Box 2' in g.inner_text('#ffSearchList'))
    q('zqxv'); ok('search: no results state', 'No matches for' in g.inner_text('#ffSearchList'))
    q('wreath'); g.keyboard.press('ArrowDown'); g.wait_for_timeout(50)
    ok('search: arrow sets aria-activedescendant', (g.get_attribute('#ffSearchIn', 'aria-activedescendant') or '').startswith('ffsr-'))
    g.keyboard.press('Enter'); g.wait_for_timeout(300)
    ok('search: Enter on project opens it, panel closes', g.evaluate("FlossFoxProjects.openId()") == 'p1' and g.locator('#ffSearch').is_hidden())
    g.click('#ffSearchBtn'); q('310'); g.keyboard.press('Escape'); g.wait_for_timeout(100)
    ok('search: Escape closes and returns focus to the button', g.locator('#ffSearch').is_hidden() and g.evaluate("document.activeElement.id") == 'ffSearchBtn')
    g.click('#ffSearchBtn'); q('310'); i = [x for x in keys('My threads')]
    g.evaluate("(()=>{const o=[...document.querySelectorAll('#ffSearchList [role=option]')].find(x=>x.closest('.ffa-sgroup').querySelector('h3').textContent==='My threads');o.click()})()"); g.wait_for_timeout(300)
    ok('search: thread result opens My threads at that color', view(g) == 'threads' and g.evaluate("document.activeElement.closest('li')&&document.activeElement.closest('li').dataset.code") == '310')
    ok('search: query never left the page', not [u for u in g.reqs if 'zqxv' in u.lower() or 'wreath' in u.lower() or 'box' in u.lower()])
    ok('search: only same-origin requests', all(u.startswith(B.split('/floss-fox-dev')[0]) or u.startswith('data:') for u in g.reqs), [u for u in g.reqs if not u.startswith('http://localhost')][:3])
    ok('search: searching wrote nothing', g.evaluate(DUMP) == base)
    g.evaluate("FlossFoxThreadsUI.addItems([{code:'3865',qty:1}])"); g.wait_for_timeout(100)
    g.click('#ffSearchBtn'); q('3865'); ok('search: refreshes after a save (ff:data-saved)', 'DMC 3865' in keys('My threads'), keys('My threads'))
    g.keyboard.press('Escape')
    ok('search: no page errors', not g.errs, g.errs); c.close()
    # 6. +/- skein: verified save, Undo, rollback on blocked write
    c, g = ctx(br, seed_all()); g.goto(B + '?nosw#threads'); ready(g)
    n = lambda: json.loads(g.evaluate(f"localStorage.getItem('{TK}')"))['threads']['321']['n']
    g.click('#tp-321'); g.wait_for_timeout(150)
    ok('step: + saves 6 and says Saved', n() == 6 and 'Saved' in g.inner_text('#thStatus'), g.inner_text('#thStatus'))
    ok('step: Undo offered', g.locator('#thStepUndo').is_visible())
    g.click('#thStepUndo'); g.wait_for_timeout(150)
    ok('step: Undo restores 5 (verified)', n() == 5 and g.locator('#thStepUndo').is_hidden())
    g.evaluate("(()=>{const o=Storage.prototype.setItem;window.__o=o;Storage.prototype.setItem=function(k,v){if(/threads\\.v1$/.test(k))throw new DOMException('full','QuotaExceededError');return o.call(this,k,v)}})()")
    g.click('#tp-321'); g.wait_for_timeout(150)
    ok('step: blocked save keeps storage at 5', n() == 5)
    ok('step: page shows 5 again, plain Not saved message, no Undo', g.input_value('#tn-321') == '5' and 'Not saved' in g.inner_text('#thStatus') and 'Saved:' not in g.inner_text('#thStatus') and g.locator('#thStepUndo').is_hidden(), (g.input_value('#tn-321'), g.inner_text('#thStatus')))
    g.evaluate("()=>{Storage.prototype.setItem=window.__o}")
    g.evaluate("(()=>{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(/threads\\.v1$/.test(k))return;return o.call(this,k,v)}})()")
    g.click('#tm-321'); g.wait_for_timeout(150)
    ok('step: silently ignored write detected by read-back, rolled back', n() == 5 and g.input_value('#tn-321') == '5' and 'Not saved' in g.inner_text('#thStatus'))
    ok('step: no page errors', not g.errs, g.errs); c.close()
    # 7. widths: no horizontal overflow, screenshots
    for w in (360, 390, 768, 1280):
        c, g = ctx(br, seed_all(), w, 900); g.goto(B + '?nosw#workbasket'); ready(g)
        g.click('#tabWorkbasket'); g.wait_for_timeout(150)
        ok(f'[{w}] Workbasket: no horizontal overflow', nooverflow(g)); g.screenshot(path=f'{SHOTS}/stageB-workbasket-{w}.png', full_page=True)
        g.click('#ffSearchBtn'); g.fill('#ffSearchIn', 'white'); g.wait_for_timeout(300)
        ok(f'[{w}] search open: no horizontal overflow', nooverflow(g)); g.screenshot(path=f'{SHOTS}/stageB-search-{w}.png', full_page=False)
        small = g.evaluate("[...document.querySelectorAll('#workbasketView button,#workbasketView a,#ffSearchBtn,#ffSearch button,#ffSearch [role=option]')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return[e.textContent.trim().slice(0,20),Math.round(r.width),Math.round(r.height)]}).filter(x=>x[1]<44||x[2]<44)")
        ok(f'[{w}] all Workbasket/search controls >= 44px', not small, small)
        ok(f'[{w}] no page errors', not g.errs, g.errs); c.close()
    c, g = ctx(br, {}, 360, 800, landing_seen=False); g.goto(B + '?nosw'); ready(g); g.click('#ffLanding a[data-tab="tabConvert"]'); g.wait_for_timeout(200)
    ok('[360] fresh: header + nav no overflow with search button', nooverflow(g)); g.screenshot(path=f'{SHOTS}/stageB-fresh-360.png'); c.close()
    # 8. 200% zoom approximation: 640px CSS viewport at deviceScaleFactor 2
    c = br.new_context(viewport={'width': 640, 'height': 900}, device_scale_factor=2, service_workers='block'); c.add_init_script("if(!sessionStorage.getItem('__s')){sessionStorage.setItem('__s','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])};sessionStorage.setItem('ff.landing.seen','1')" % json.dumps(seed_all()))
    g = c.new_page(); g.goto(B + '?nosw#workbasket'); g.wait_for_function('window.FlossFoxAtelier'); g.wait_for_timeout(300); g.click('#tabWorkbasket')
    ok('[zoom~200%] Workbasket no overflow', g.evaluate("document.documentElement.scrollWidth<=innerWidth+1")); c.close()
    # 9. reduced motion: no transitions on new elements
    c = br.new_context(viewport={'width': 390, 'height': 800}, reduced_motion='reduce', service_workers='block'); c.add_init_script("sessionStorage.setItem('ff.landing.seen','1');localStorage.setItem(%s,%s)" % (json.dumps(TK), json.dumps(json.dumps(THR))))
    g = c.new_page(); g.goto(B + '?nosw#workbasket'); g.wait_for_function('window.FlossFoxAtelier'); g.wait_for_timeout(300); g.click('#tabWorkbasket')
    ok('[reduced motion] no transitions on Workbasket buttons', g.evaluate("[...document.querySelectorAll('.ffa-qbtn')].every(e=>getComputedStyle(e).transitionDuration.split(',').every(d=>parseFloat(d)===0))")); c.close()
    br.close()
print(f'atelier_stageb_e2e: {R[0]} passed, {R[1]} failed (simulated)'); sys.exit(1 if R[1] else 0)
