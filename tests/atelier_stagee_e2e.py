#!/usr/bin/env python3
"""3.9 Atelier Stage E: optional manual % done ring (FF39-14) and Stitch Session focus mode and timer (FF39-16).
Progress is saved on the project and in backups; 100% never auto-completes; celebration once per
real status transition to Completed. Focus is in-memory (reload returns to the full project). Timer is OFF by default, lives inside the session, in-memory only, counts from a start
timestamp (keeps going if the tab is hidden), resets on close, never touches inventory or stitches.
SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_stagee_e2e.py http://localhost:PORT/
"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': 40}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321'], leftOff='Finished page 2'),
    proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z')]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 2, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z', 'storage': {'container':'Top drawer','slot':'A1','medium':''}},
    'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}

def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET}
    if extra: s.update(extra)
    return s

def ctx(br, seed, w=1280, h=900, landing_seen=True, touch=False, reduced_motion=None):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block')
    if touch:
        kw['has_touch'] = True; kw['is_mobile'] = True
    if reduced_motion:
        kw['reduced_motion'] = reduced_motion
    c = br.new_context(**kw)
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}%s"
        % (json.dumps(seed), "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" if landing_seen else ''))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects')
    g.wait_for_timeout(200)

def dump_inv(g):
    return g.evaluate(f"()=>JSON.stringify([localStorage.getItem({KEY!r}), localStorage.getItem({TK!r})])")

def backup(g):
    return g.evaluate("()=>FlossFoxProjects.fullBackup()")

def open_p1(g):
    g.click('#tabProjects'); g.wait_for_timeout(200)
    g.evaluate("() => window.FlossFoxProjects.openProject('p1')")
    g.wait_for_function("() => FlossFoxProjects.openId && FlossFoxProjects.openId()==='p1' && document.getElementById('pProgress')")
    g.wait_for_timeout(150)

def enter_session(g):
    g.wait_for_selector('#ffaSessionStart')
    g.click('#ffaSessionStart')
    g.wait_for_function("() => document.getElementById('ffaFocus') && document.getElementById('projEdit').classList.contains('ffa-focus-on')")
    g.wait_for_timeout(100)

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- Progress: unset ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g); open_p1(g)
    ok('progress: no ring when unset', g.locator('#pProgress .ffa-ring').count()==0)
    ok('progress: empty hint and Set progress are shown', 'No progress set' in g.inner_text('#pProgress') and g.locator('#ffaPctOpen').count()==1)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-progress-none-1280.png'), full_page=False)
    # p2 (old, no field) stays without progressPct
    raw = g.evaluate(f"()=>JSON.parse(localStorage.getItem({KEY!r}))")
    ok('progress: old project without a % is unchanged', 'progressPct' not in raw['projects'][1], raw['projects'][1].keys())
    before = dump_inv(g)

    # set 35
    g.click('#ffaPctOpen'); g.fill('#ffaPct', '35'); g.click('#ffaPctSave'); g.wait_for_timeout(300)
    ok('progress: ring appears after save', g.locator('#pProgress .ffa-ring').count()==1)
    ok('progress: number is shown as text', '35%' in g.inner_text('#pProgress'))
    aria = g.get_attribute('#pProgress .ffa-ring', 'aria-label') or ''
    ok('progress: aria is "35% done, your own estimate"', '35% done, your own estimate' in aria, aria)
    ok('progress: status is still In progress', g.input_value('#pStatus')=='progress')
    stored = g.evaluate(f"()=>JSON.parse(localStorage.getItem({KEY!r})).projects.find(p=>p.id==='p1')")
    ok('progress: 35 is saved on the project', stored.get('progressPct')==35, stored)
    bak = backup(g)
    p1b = [x for x in bak['projects'] if x['id']=='p1'][0]
    p2b = [x for x in bak['projects'] if x['id']=='p2'][0]
    ok('progress: backup includes the % on p1 like other fields', p1b.get('progressPct')==35, p1b)
    ok('progress: backup leaves p2 without a % field', 'progressPct' not in p2b, p2b)
    ok('progress: threads were not written when saving a %', json.loads(dump_inv(g))[1]==json.loads(before)[1])
    g.screenshot(path=os.path.join(SHOTS, 'stageE-progress-35-1280.png'))

    # 100% never auto-completes
    g.click('#ffaPctOpen'); g.fill('#ffaPct', '100'); g.click('#ffaPctSave'); g.wait_for_timeout(300)
    ok('progress: 100% still does not change status', g.input_value('#pStatus')=='progress' and g.evaluate("()=>FlossFoxProjects._store().projects.find(p=>p.id==='p1').status")=='progress')
    ok('progress: 100% copy says the project stays In progress', '100%' in g.inner_text('#pProgress') and 'In progress' in g.inner_text('#pProgress'))
    ok('progress: no completion celebration at 100%', 'is marked Completed' not in g.inner_text('body'))
    g.screenshot(path=os.path.join(SHOTS, 'stageE-progress-100-1280.png'))

    # celebration once per real transition
    g.evaluate("() => { const s=document.getElementById('pStatus'); s.value='done'; s.dispatchEvent(new Event('change',{bubbles:true})); }"); g.wait_for_timeout(250)
    body = g.inner_text('#projEdit') + g.inner_text('#projStatus')
    ok('progress: celebrating when marked Completed', 'marked Completed' in body or 'Sample Autumn Wreath is marked Completed' in body, body[:300])
    ok('progress: 100% still did not have to be the trigger (status is now done by choice)', g.input_value('#pStatus')=='done')
    ok('progress: 100% hint is hidden once the project is Completed', g.locator('#ffaProgFull').count()==0)
    # set back and forward: a new real transition should celebrate again, but we mainly check no crash
    g.evaluate("() => { const s=document.getElementById('pStatus'); s.value='progress'; s.dispatchEvent(new Event('change',{bubbles:true})); }"); g.wait_for_timeout(150)
    g.evaluate("() => { const s=document.getElementById('pStatus'); s.value='done'; s.dispatchEvent(new Event('change',{bubbles:true})); }"); g.wait_for_timeout(150)
    ok('progress: a later real transition to Completed still works', g.input_value('#pStatus')=='done')

    # clear hides the ring
    g.click('#ffaPctOpen'); g.click('#ffaPctClear'); g.wait_for_timeout(250)
    ok('progress: clearing hides the ring', g.locator('#pProgress .ffa-ring').count()==0)
    ok('progress: cleared % is omitted from the stored project',
       'progressPct' not in g.evaluate("()=>FlossFoxProjects._store().projects.find(p=>p.id==='p1')"),
       g.evaluate("()=>FlossFoxProjects._store().projects.find(p=>p.id==='p1')"))
    ok('progress: no page errors', not g.errs, g.errs)
    c.close()

    # ---- Focus mode + timer (timer stays off by default; lives inside the session) ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g); open_p1(g)
    ok('focus: Start a stitch session is on the full project', g.locator('#ffaSessionStart').count()==1 and 'Start a stitch session' in g.inner_text('#pSession'))
    ok('timer: no clock on the full project while the pref is off', g.locator('#ffaTimerStart').count()==0)
    enter_session(g)
    ok('focus: panel shows the project name', 'Sample Autumn Wreath' in g.inner_text('#ffaFocusTitle'))
    ok('focus: last note is shown', 'Finished page 2' in g.inner_text('#ffaFocus'))
    ok('focus: planned colors are listed', 'DMC 310' in g.inner_text('#ffaFocus') and 'DMC WHITE' in g.inner_text('#ffaFocus') and 'DMC BLANC' in g.inner_text('#ffaFocus'))
    ok('focus: storage location is shown for an owned color', 'In Top drawer' in g.inner_text('#ffaFocus') and 'A1' in g.inner_text('#ffaFocus'))
    ok('focus: exit control uses Pixel copy', g.locator('#ffaSessionExit').count()==1 and g.inner_text('#ffaSessionExit').strip()=='Back to the full project')
    fbox = g.locator('#ffaFocus').bounding_box()
    ok('focus: panel is scrolled into view', fbox and fbox['y']>=-1, fbox)
    ok('focus: heading is focused and is tabindex -1', g.evaluate("() => document.activeElement && document.activeElement.id")=='ffaFocusTitle' and g.get_attribute('#ffaFocusTitle','tabindex')=='-1')
    sw = g.evaluate("""() => [...document.querySelectorAll('#ffaFocus .ffa-colors .ffa-floss')].map(el => ({c: getComputedStyle(el).getPropertyValue('--c').trim(), bg: getComputedStyle(el).backgroundColor, edge: el.classList.contains('edge'), label: (el.nextElementSibling&&el.nextElementSibling.textContent)||''}))""")
    ok('focus: swatches set --c from the catalog, not the grey default', sw and all(x['c'] and x['c']!='#9a9a9a' for x in sw), sw)
    blanc = next((x for x in sw if 'BLANC' in x['label'] or 'WHITE' in x['label']), None)
    ok('focus: BLANC/WHITE keep a swatch edge', blanc and blanc['edge'], sw)
    ok('timer: still no timer inside the session while the pref is off', g.locator('#ffaTimerStart').count()==0)
    before_focus = dump_inv(g)
    g.click('#ffaSessionExit'); g.wait_for_timeout(150)
    ok('focus: exit restores the full project editor', g.locator('#pProgress').is_visible() and g.locator('#ffaSessionStart').is_visible() and 'ffa-focus-on' not in (g.get_attribute('#projEdit','class') or '') and g.locator('#ffaFocus:visible').count()==0)
    ok('focus: exit focuses Start a stitch session', g.evaluate("() => document.activeElement && document.activeElement.id")=='ffaSessionStart')
    ok('focus: exit does not write projects or threads', dump_inv(g)==before_focus)
    g.click('#tabSettings'); g.wait_for_timeout(200)
    ok('timer: settings switch is off by default', g.evaluate("()=>document.getElementById('ffTimer').checked") is False)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-timer-off-1280.png'))
    g.check('#ffTimer'); g.wait_for_timeout(200)
    ok('timer: turning the switch on saves only the atelier pref, not elapsed time',
       g.evaluate(f"()=>{{const a=JSON.parse(localStorage.getItem({AK!r})||'{{}}');return a.sessionTimer===true && !('elapsed' in a) && !('timer' in a && typeof a.timer==='number')}}"))
    open_p1(g)
    ok('timer: start-session stays on the full project when the pref is on', g.locator('#ffaSessionStart').count()==1 and g.locator('#ffaTimerStart').count()==0)
    enter_session(g)
    ok('timer: session card appears inside the focus panel once the pref is on', g.locator('#ffaFocus #ffaSession').count()==1)
    ok('timer: starts at 0:00 and is not running yet', '0:00' in g.inner_text('#ffaSession') and g.locator('#ffaTimerStart').count()==1)
    before = dump_inv(g)
    stitches_before = g.evaluate("()=>FlossFoxProjects._store().projects.find(p=>p.id==='p1').items.map(i=>i.stitchCount)")
    g.click('#ffaTimerStart'); g.wait_for_timeout(1200)
    clock = g.inner_text('#ffaSession .ffa-clock')
    ok('timer: counts up from a start timestamp while running', clock not in ('0:00','0:00:00') and 'Timer running' in g.inner_text('#ffaSession'), clock)
    # hidden tab keeps counting
    g.evaluate("""() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); }""")
    g.wait_for_timeout(1100)
    g.evaluate("""() => { Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange')); }""")
    g.wait_for_timeout(200)
    clock2 = g.inner_text('#ffaSession .ffa-clock')
    def to_s(s):
        parts=[int(x) for x in s.strip().split(':')]
        if len(parts)==2: return parts[0]*60+parts[1]
        if len(parts)==3: return parts[0]*3600+parts[1]*60+parts[2]
        return 0
    ok('timer: keeps counting while the tab is hidden', to_s(clock2) >= to_s(clock)+1, (clock, clock2))
    ok('timer: start does not write projects or threads', dump_inv(g)==before)
    ok('timer: stitch counts are untouched', g.evaluate("()=>FlossFoxProjects._store().projects.find(p=>p.id==='p1').items.map(i=>i.stitchCount)")==stitches_before)
    bak = backup(g)
    blob = json.dumps(bak)
    ok('timer: elapsed time is not in the backup', 'sessionTimer' not in blob and 'ffaTimer' not in blob and '"elapsed"' not in blob)
    # in-memory only: not in atelier key either as elapsed
    ak = g.evaluate(f"()=>localStorage.getItem({AK!r})")
    ok('timer: atelier key has the switch, not a start time or elapsed value',
       ak and 'sessionTimer' in ak and 'start' not in ak and 'elapsed' not in ak, ak)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-timer-running-1280.png'))
    g.click('#ffaTimerStop'); g.wait_for_timeout(200)
    summary = g.inner_text('#ffaSession')
    ok('timer: stop shows a sitting summary and does not save the time',
       'We don\'t save this time' in summary and 'under 1 min' in summary, summary)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-timer-stopped-1280.png'))
    # reload returns to the full project and resets the clock (focus and timer are in-memory)
    g.reload(); ready(g); open_p1(g)
    ok('focus: reload returns to the full project, not the session', g.locator('#ffaSessionStart').count()==1 and g.locator('#pProgress').is_visible() and g.locator('#ffaFocus:visible').count()==0)
    enter_session(g)
    ok('timer: reload (page close) resets the clock and does not restore elapsed',
       '0:00' in g.inner_text('#ffaSession') and g.locator('#ffaTimerStart').count()==1)
    ok('timer: no page errors', not g.errs, g.errs)
    c.close()

    # 390 touch shots
    c, g = ctx(br, seed_all({AK: json.dumps({'v':1,'theme':'system','sessionTimer':True,'projectsView':'gallery'})}), w=390, h=860, touch=True)
    g.goto(B + '?nosw'); ready(g); open_p1(g)
    g.click('#ffaPctOpen'); g.fill('#ffaPct', '35'); g.click('#ffaPctSave'); g.wait_for_timeout(250)
    ok('390: progress ring and 35% text', g.locator('#pProgress .ffa-ring').count()==1 and '35%' in g.inner_text('#pProgress'))
    box = g.locator('#ffaPctOpen').bounding_box()
    ok('390: Change estimate meets 44px', box and box['height']>=44, box)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-progress-35-390.png'), full_page=True)
    sbox = g.locator('#ffaSessionStart').bounding_box()
    ok('390: Start a stitch session meets 44px', sbox and sbox['height']>=44, sbox)
    enter_session(g)
    ok('390: timer is present inside the session when pref is on', g.locator('#ffaTimerStart').count()==1)
    tbox = g.locator('#ffaTimerStart').bounding_box()
    ok('390: Start timer meets 44px', tbox and tbox['height']>=44, tbox)
    ebox = g.locator('#ffaSessionExit').bounding_box()
    ok('390: Back to the full project meets 44px', ebox and ebox['height']>=44, ebox)
    g.click('#ffaTimerStart'); g.wait_for_timeout(400)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-timer-running-390.png'), full_page=False)
    ok('390: no page errors', not g.errs, g.errs)
    c.close()

    # reduced motion: ring has no animation
    c, g = ctx(br, seed_all(), reduced_motion='reduce')
    g.goto(B + '?nosw'); ready(g); open_p1(g)
    g.click('#ffaPctOpen'); g.fill('#ffaPct', '35'); g.click('#ffaPctSave'); g.wait_for_timeout(200)
    trans = g.evaluate("() => { const el=document.querySelector('.ffa-ring-val'); return el?getComputedStyle(el).transitionDuration:'missing' }")
    ok('motion: ring has no transition when reduced motion is on', trans=='missing' or all(x.strip()=='0s' for x in trans.split(',')), trans)
    c.close(); br.close()

print(f"\natelier_stagee_e2e (simulated): {R[0]} passed, {R[1]} failed")
sys.exit(1 if R[1] else 0)
