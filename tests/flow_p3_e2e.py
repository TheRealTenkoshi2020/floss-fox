"""Flow phase 3 (SIMULATED browser testing: headless Chrome, 390px, mobile + touch emulation; not real devices).
One primary button per screen from the current state, inline empty states, folded project page, status words,
one backup label, accessible names, reasons next to disabled controls, and saved data left untouched.
Usage: python3 tests/flow_p3_e2e.py BASE_URL"""
import sys, json
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; KEY = 'flossfox-dev.v1'; TKEY = 'flossfox-dev.threads.v1'; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
it = lambda c, q: {'code': c, 'qty': q, 'assumed': 0, 'stated': True, 'src': [c]}
PROJ = {'schema': 2, 'projects': [{'id': 't3', 'name': 'Fox sampler', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [it('310', 2), it('321', 1), it('666', None), it('3865', 1), it('415', 1)], 'decisions': {'310': {'status': 'buy'}, '321': {'status': 'buy'}, '3865': {'status': 'check'}, '415': {'status': 'have', 'owned': 2}}, 'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'}]}
TH = {'schema': 1, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'}}}
def init(seed):
    s = "localStorage.setItem('flossfox-dev.tour.v1','{\"status\":\"dismissed\"}');"
    if seed: s += "localStorage.setItem('%s',%s);localStorage.setItem('%s',%s);" % (KEY, json.dumps(json.dumps(PROJ)), TKEY, json.dumps(json.dumps(TH)))
    return "if(!sessionStorage.s){sessionStorage.s=1;" + s + "}"
PRI = "s=>[...document.querySelectorAll(s+' button.pri')].filter(b=>b.offsetParent&&!b.closest('dialog,.ffconfirm,#pipHybridDialog,.askpip,#askPip,.pip,.ffhelp,.skein-panel,.rform,.panel')).map(b=>b.id||b.textContent.trim().slice(0,30))"
DUMP = "(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/flossfox-dev\\.(v1|threads\\.v1)$/.test(k))o[k]=localStorage.getItem(k)}return o})()"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); ERR = []
    def page(seed):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); c.add_init_script(init(seed))
        g = c.new_page(); g.on('pageerror', lambda e: ERR.append(str(e))); g.goto(B + '?nosw'); g.wait_for_timeout(600); return g
    # empty states
    g = page(False)
    ok('p1 Find floss, empty box: one primary = Import a pattern (PDF)', g.evaluate(PRI, '#convertView .card') == ['Import a pattern (PDF)'], g.evaluate(PRI, '#convertView .card'))
    g.fill('#inp', '310, 321'); g.wait_for_timeout(150)
    ok('p2 Find floss, typed colors: one primary = Add my colors', g.evaluate(PRI, '#convertView .card') == ['go'], g.evaluate(PRI, '#convertView .card'))
    g.click('#go'); g.wait_for_timeout(300)
    ok('p3 Find floss results: one primary = Save project', g.evaluate(PRI, '#shopcard') == ['saveProj'], g.evaluate(PRI, '#shopcard'))
    g.click('#tabThreads'); g.wait_for_timeout(200)
    ok('p4 empty collection: one primary = Add to my collection', g.evaluate(PRI, '#threadsView') == ['thAddBtn'], g.evaluate(PRI, '#threadsView'))
    m = g.locator('#thEmptyMsg'); ok('p5 empty collection: inline empty state next to the list', m.is_visible() and m.inner_text() == 'No threads here yet. Type the DMC numbers you own in the box above, then tap Add to my collection.', m.count())
    ok('p6 disabled Undo shows why, next to it', g.is_visible('#ffBulkUndoWhy') and g.get_attribute('#ffBulkUndo', 'aria-describedby') == 'ffBulkUndoWhy' if g.locator('#ffBulkUndo').is_visible() else True)
    g.click('#tabProjects'); g.wait_for_timeout(200)
    ok('p7 no projects: one primary = Import a pattern (PDF)', g.evaluate(PRI, '#projListCard') == ['emptyImport'], g.evaluate(PRI, '#projListCard'))
    ok('p8 one backup label: Download a backup', g.inner_text('#backupBox summary') == 'Download a backup' and 'Back up my projects and threads' not in g.content())
    g.click('#tabShop'); g.wait_for_timeout(200)
    ok('p9 Shopping with no projects: empty state with one primary', g.evaluate(PRI, '#shopCard') == ['shopEmptyImport'] and g.is_visible('#shopEmpty h2'), g.evaluate(PRI, '#shopCard'))
    g.click('#tabConvert'); g.click('#convertView .pat-launch'); g.wait_for_timeout(300)
    ok('p10 import window: file input and paste box have accessible names', g.get_attribute('#patFile', 'aria-label') == 'Choose a PDF' and g.get_attribute('#patPaste', 'aria-label') == 'Pattern color key')
    ok('p11 disabled Create project says why, next to it', g.locator('#patImport').is_disabled() and g.is_visible('#patImportWhy') and 'patWhy' in (g.get_attribute('#patImport', 'aria-describedby') or ''), g.get_attribute('#patImport', 'aria-describedby'))
    # seeded
    g = page(True); before = g.evaluate(DUMP)
    g.click('#tabThreads'); g.wait_for_timeout(200)
    ok('p12 collection has threads: one primary = Next', g.evaluate(PRI, '#threadsView') == ['thNext'] and not g.is_visible('#thEmptyMsg'), g.evaluate(PRI, '#threadsView'))
    g.click('#tabProjects'); g.wait_for_timeout(200)
    ok('p13 projects list: one primary = open the last project', g.evaluate(PRI, '#projListCard') == ['projOpenLast'], g.evaluate(PRI, '#projListCard'))
    g.click('[data-open]'); g.wait_for_timeout(400)
    pr = g.evaluate(PRI, '#projEdit'); ok('p14 project with undecided colors: exactly one primary', len(pr) == 1, pr)
    ok('p15 project page: name, steps and summary on top, before the color list', g.evaluate("(()=>{const y=id=>document.getElementById(id).getBoundingClientRect().top;return y('pTitle')<y('pFlow')&&y('pFlow')<y('pSummary')&&y('pSummary')<y('pThreads')&&y('pSummary')<y('pDetails')&&document.getElementById('pReady').previousElementSibling.id==='pSum'})()"))
    ok('p16 project details folded (name, status, brand, notes)', not g.evaluate("document.getElementById('pDetails').open") and g.inner_text('#pDetails summary') == 'Project details')
    ok('p17 Needs attention open because it has colors; Ready folded', g.evaluate("document.getElementById('pReviewBox').open&&!document.getElementById('pHaveBox').open"))
    g.click('#pDetails summary'); g.select_option('#pStatus', 'progress'); g.wait_for_timeout(300)
    ok('p18 a folded section stays open after the page re-renders', g.evaluate("document.getElementById('pDetails').open"))
    g.fill('#pName', 'Fox sampler 2'); g.wait_for_timeout(300)
    ok('p19 the name heading follows the name field', g.inner_text('#pTitle') == 'Fox sampler 2', g.inner_text('#pTitle'))
    ok('p20 filter says Not ready yet (not Still to do)', 'Not ready yet' in g.inner_text('#f-todo') and 'Still to do' not in g.content())
    g.evaluate("dispatchEvent(new Event('beforeprint'))"); ok('p21 printing opens every folded section', g.evaluate("[...document.querySelectorAll('#projEdit details.psec')].every(d=>d.open)"))
    g.evaluate("dispatchEvent(new Event('afterprint'))"); ok('p22 after printing, folded sections close again', not g.evaluate("document.getElementById('pHaveBox').open"))
    for c in ('310', '321', '3865', '666'):
        if g.locator(f'#st-{c}-have').count(): g.check(f'#st-{c}-have')
    g.wait_for_timeout(300); pr = g.evaluate(PRI, '#projEdit'); ok('p23 project state change still leaves at most one primary', len(pr) <= 1, pr)
    g.click('#tabShop'); g.wait_for_timeout(200)
    ok('p24 Shopping, project not picked: says pick a project, no import buttons', g.is_visible('#shopPickMsg') and not g.is_visible('#shopEmptyImport') or g.locator('#shopPick').input_value() != '', g.inner_text('#shopCard')[:200])
    # Find floss errbox wording
    g = page(False); g.fill('#inp', '310\n5200 x2'); g.click('#go'); g.wait_for_timeout(300); rv = g.inner_text('#review') if g.locator('#review').count() else ''
    ok('p25 Find floss: "Not on your list yet" box (not Needs attention)', ('Not on your list yet' in rv or rv == '') and 'Needs attention (not on the list yet)' not in g.content(), rv)
    # data untouched by browsing (seeded page without edits)
    g = page(True); before = g.evaluate(DUMP)
    for t in ('Threads', 'Projects', 'Shop', 'Convert', 'Projects'): g.click('#tab' + t); g.wait_for_timeout(200)
    g.click('[data-open]'); g.wait_for_timeout(300); g.click('#pDetails summary'); g.click('#tabShop'); g.wait_for_timeout(300); g.click('#pHaveBox summary'); g.wait_for_timeout(200)
    ok('p26 browsing and folding never change saved projects or threads', g.evaluate(DUMP) == before)
    ok('p27 no page errors', not ERR, ERR[:3])
    print(f'{R[0]} passed, {R[1]} failed')
