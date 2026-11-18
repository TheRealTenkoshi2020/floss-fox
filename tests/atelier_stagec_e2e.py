#!/usr/bin/env python3
"""3.9 Atelier Stage C: in-store checklist (one checkbox per line, Mark bought never touches My threads), By store,
share/print (no notes or private fields), confirmed check-in adds full skeins to My threads (verified, Undo, rollback, no
double count), restock section (decision 6), collection views / sort / Running low / suggestions, Settings (Display settings,
seasonal ON by default), search fixes (white siblings, Pip greeting hidden while searching), widths, screenshots.
SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_stagec_e2e.py http://localhost:8765/floss-fox-dev/"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'; B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
def it(c, q=1): return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None}
def dec(status=None, owned=None, src=None): return {'status': status, 'owned': owned, 'ownedSource': src, 'ownedPartial': False, 'anchor': None, 'recv': None, 'estimateChecked': None}
def proj(pid, name, items, decs, dest='dmc', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'PRIVATE-NOTE-xyz', 'buyBrand': dest, 'status': 'progress', 'items': items, 'decisions': decs, 'purchased': {}, 'created': '2026-11-01T00:00:00.000Z', 'updated': upd, 'leftOff': 'SECRET-LEFTOFF'}
    p.update(kw); return p
P1 = proj('p1', 'Meadow Sampler', [it('310', 5), it('797', 2), it('433', 4), it('BLANC', 1)],
          {'310': dec('buy', 2, 'user'), '797': dec('buy'), '433': dec(), 'BLANC': dec('buy')})
P2 = proj('p2', 'Anchor Piece', [it('321', 2)], {'321': {**dec('buy'), 'anchor': '9046'}}, dest='anchor', upd='2026-11-01T10:00:00.000Z')
PROJ = {'schema': 2, 'projects': [P1, P2]}
TH = lambda n, **k: {'n': n, 'partial': False, 'restock': False, 'confirmed': True, 'updated': k.pop('u', '2026-11-01T00:00:00Z'), **k}
THR = {'schema': 2, 'threads': {'310': TH(2, storage={'container': 'SECRET-BOX', 'slot': 'Row B'}), '433': TH(1, u='2026-11-08T00:00:00Z'),
                                'WHITE': TH(1, u='2026-11-03T00:00:00Z'), '321': TH(5, u='2026-11-02T00:00:00Z'), '666': TH(0, u='2026-11-04T00:00:00Z')}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}
DUMP = "JSON.stringify(Object.keys(localStorage).filter(k=>!/backup-first/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))"  # backup-first = when the backup tip was first shown (display only)
def ctx(br, seed, w=1200, h=900):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block')
    if w <= 520:
        kw['has_touch'] = True; kw['is_mobile'] = True
    c = br.new_context(**kw)
    c.add_init_script("if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" % json.dumps(seed))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); return c, g
def ready(g): g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxThreadsUI'); g.wait_for_timeout(250)
def seed(extra=None, proj=None, thr=None):
    s = {KEY: json.dumps(proj or PROJ), TK: json.dumps(thr or THR), **QUIET}
    if extra: s.update(extra)
    return s
def store(g): return json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))
def threads(g): return json.loads(g.evaluate(f"localStorage.getItem('{TK}')"))['threads']
def pj(g, pid='p1'): return [p for p in store(g)['projects'] if p['id'] == pid][0]
def open_store(g, pid='p1'):
    g.evaluate(f"FlossFoxProjects.open('{pid}')"); g.wait_for_timeout(250); g.click('#tabShop'); g.wait_for_timeout(250)
    if g.get_attribute('#pStoreBtn', 'aria-pressed') != 'true': g.click('#pStoreBtn'); g.wait_for_timeout(200)
def lines(g, pid='p1'): return g.evaluate(f"(()=>{{const p=FlossFoxProjects._store().projects.find(x=>x.id==='{pid}');return FlossFoxProjects.plan(p).lines.map(l=>[l.key,l.q,l.bought])}})()")
def checkin(g, key, n):
    k = key.replace(':', '_')
    if g.locator('#pAwBox').count() == 0 or not g.locator('#pAwBox').is_visible(): g.click('#tabShop'); g.wait_for_timeout(200)
    if g.get_attribute('#pStoreBtn', 'aria-pressed') == 'true': g.click('#pStoreBtn'); g.wait_for_timeout(150)
    g.evaluate("document.getElementById('pAwBox').open=true"); g.click(f'#rb-{k}'); g.fill(f'#rq-{k}', str(n)); g.click(f'#rc-{k}'); g.wait_for_timeout(250)
def nooverflow(g): return g.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
def block(g, rx, mode='throw'):
    g.evaluate("""([rx,mode])=>{window.__o=window.__o||Storage.prototype.setItem;const o=window.__o,re=new RegExp(rx);Storage.prototype.setItem=function(k,v){if(re.test(k)){if(mode==='throw')throw new DOMException('full','QuotaExceededError');return}return o.call(this,k,v)}}""", [rx, mode])
def unblock(g): g.evaluate("()=>{if(window.__o)Storage.prototype.setItem=window.__o}")

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # 1. In-store checklist: one checkbox per line, Mark bought never touches My threads
    c, g = ctx(br, seed(), 390, 860); g.goto(B + '?nosw'); ready(g); open_store(g)
    t0 = g.evaluate(f"localStorage.getItem('{TK}')")
    rows = g.locator('#smLeft .ffsm-row'); n = rows.count()
    ok('checklist: one checkbox per line', n >= 2 and g.locator('#smLeft .ffsm-row input[type=checkbox]').count() == n, n)
    ok('checklist: checkboxes are 44px', g.evaluate("[...document.querySelectorAll('#pStore .ffsm-cb')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44})"))
    ok('checklist 390: Bought label is visible', g.evaluate("[...document.querySelectorAll('#smLeft .ffsm-check span')].every(s=>{const r=s.getBoundingClientRect();return r.width>=8&&r.height>=8&&s.textContent.includes('Bought')})"))
    ok('checklist: rows 72px or taller', g.evaluate("[...document.querySelectorAll('#smLeft .ffsm-row')].every(r=>r.getBoundingClientRect().height>=71)"))
    ok('checklist: BLANC stays BLANC', g.locator('#smLeft .ffsm-code', has_text='DMC BLANC').count() == 1 and g.locator('#smLeft .ffsm-code', has_text='WHITE').count() == 0)
    g.screenshot(path=f'{SHOTS}/stageC-checklist-390.png', full_page=True)
    g.click('#smLeft li:has-text("DMC 310") [data-smb]'); g.wait_for_timeout(200)
    ok('bought: purchased flag set (verified in storage)', pj(g)['purchased'].get('dmc:310') is True)
    ok('bought: My threads byte-identical', g.evaluate(f"localStorage.getItem('{TK}')") == t0)
    ok('bought: focus moved to the status line', g.evaluate("document.activeElement&&document.activeElement.id") == 'smSum')
    ok('bought: row moved to Bought with checked box + "Not checked in yet"', g.locator('#smDone .ffsm-row:has-text("DMC 310") input:checked').count() == 1 and 'Not checked in yet' in g.inner_text('#smDone'))
    ok('bought: "Home with your floss?" card with I received it', g.locator('#smHome #smRecv').is_visible() and 'Check in what you bought' in g.inner_text('#smHome') and 'full skeins to My threads' in g.inner_text('#smHome'))
    g.screenshot(path=f'{SHOTS}/stageC-checklist-bought-390.png', full_page=True)
    g.click('#smDone [data-smu]'); g.wait_for_timeout(200)
    ok('unbought: back to list, threads untouched', 'dmc:310' not in pj(g)['purchased'] and g.evaluate(f"localStorage.getItem('{TK}')") == t0)
    # blocked save on Mark bought -> rolled back, Not saved
    before = g.evaluate(f"localStorage.getItem('{KEY}')"); block(g, r'^' + KEY.replace('.', r'\.') + '$')
    g.click('#smLeft li:has-text("DMC 310") [data-smb]'); g.wait_for_timeout(200)
    ok('bought blocked: storage unchanged, row still unchecked, Not saved shown', g.evaluate(f"localStorage.getItem('{KEY}')") == before and g.locator('#smLeft li:has-text("DMC 310") [data-smb]').count() == 1 and 'Not saved' in g.inner_text('#smSum'))
    unblock(g)
    # share: Web Share stub captures text; never notes, project name, storage or leftOff
    g.evaluate("navigator.share=async d=>{window.__shared=d}")
    g.click('#smShare'); g.wait_for_timeout(200); sh = g.evaluate("window.__shared") or {}
    txt = sh.get('text', '')
    ok('share: Web Share used with list text', 'Floss Fox shopping list' in txt and 'DMC 310: 3 skeins' in txt, txt)
    ok('share: no notes, project name, leftOff or storage', not any(x in txt for x in ('PRIVATE-NOTE', 'Meadow', 'SECRET', 'Box', 'Row B')), txt)
    ok('share: no Check first colors -> plain list without sections', 'Check first' not in txt and 'Ready to buy' not in txt, txt)
    g.evaluate("delete navigator.share;Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__clip=t}},configurable:true})")
    g.click('#smShare'); g.wait_for_timeout(200)
    ok('share fallback: copied to clipboard + message', 'DMC 310' in (g.evaluate("window.__clip") or '') and 'List copied' in g.inner_text('#smShareMsg'))
    g.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{throw new Error('no')}},configurable:true})")
    g.click('#smShare'); g.wait_for_timeout(200)
    ok('share fallback 2: text shown to copy by hand, Print suggested', g.locator('#smShareText').is_visible() and 'Print list' in g.inner_text('#smShareMsg'))
    g.evaluate("window.print=()=>{window.__printed=document.documentElement.classList.contains('ffsm-printing')}")
    g.click('#smPrint'); g.wait_for_timeout(100)
    ok('print: store list printed in its own print layout', g.evaluate("window.__printed") is True)
    ok('checklist: no em dashes', '\u2014' not in g.inner_text('#pStore'))
    ok('checklist 390: no overflow', nooverflow(g))
    ok('no page errors (checklist)', not g.errs, g.errs); c.close()

    # 1b. By store: each color once, under the chosen store, others listed as "Also at"
    c, g = ctx(br, seed(), 1280, 900); g.goto(B + '?nosw'); ready(g); open_store(g)
    if g.locator('#smViewStore').count():
        n0 = g.locator('#smLeft .ffsm-row').count(); g.click('#smViewStore'); g.wait_for_timeout(200)
        codes = g.evaluate("[...document.querySelectorAll('#smLeft .ffsm-code')].map(e=>e.textContent)")
        ok('by store: every color exactly once', len(codes) == n0 == len(set(codes)), codes)
        ok('by store: unlinked colors under "No store link"', 'No store link: find it in any store' in g.inner_text('#smLeft'))
        ub = g.evaluate("""(()=>{const h=[...document.querySelectorAll('#smLeft .ffsm-store')].find(e=>/No store link/.test(e.textContent));if(!h)return{found:false};const ul=h.nextElementSibling;return{found:true,buys:ul.querySelectorAll('[data-smbuy]').length,blancBuy:!![...ul.querySelectorAll('.ffsm-row')].find(r=>/BLANC/.test(r.textContent)&&r.querySelector('[data-smbuy]')),n:ul.querySelectorAll('.ffsm-row').length}})()""")
        ok('by store: unassigned group has no Buy (BLANC case)', ub.get('found') and ub.get('buys')==0 and not ub.get('blancBuy'), ub)
        opts = g.evaluate("[...document.querySelectorAll('#smAt option')].map(o=>[o.value,o.textContent])")
        pick = [o for o in opts if o[0]][-1]; g.select_option('#smAt', pick[0]); g.wait_for_timeout(200)
        heads = g.evaluate("[...document.querySelectorAll('#smLeft .ffsm-store')].map(e=>e.textContent)")
        ok('by store: chosen store heads the list', heads and heads[0] == pick[1], (heads, pick))
        ok('by store: still each color once after choosing', len(g.evaluate("[...document.querySelectorAll('#smLeft .ffsm-code')].map(e=>e.textContent)")) == n0)
        g.screenshot(path=f'{SHOTS}/stageC-bystore-1280.png', full_page=True)
        g.click('#smViewList'); g.wait_for_timeout(150); ok('by store -> Checklist again', g.get_attribute('#smViewList', 'aria-pressed') == 'true')
    else:
        ok('by store: hidden when no store links (non-preview build)', g.locator('#smViewStore').count() == 0)
    ok('no page errors (by store)', not g.errs, g.errs); c.close()

    # 2. Confirmed check-in adds full skeins to My threads (explicit decision; increments existing)
    c, g = ctx(br, seed(), 1200, 900); g.goto(B + '?nosw'); ready(g); open_store(g)
    g.click('#smLeft li:has-text("DMC 310") [data-smb]'); g.wait_for_timeout(200)
    ok('mark bought: 310 still 2 in My threads', threads(g)['310']['n'] == 2)
    g.click('#smRecv'); g.wait_for_timeout(250)
    ok('I received it: opens the amount form for the bought color', g.locator('#rq-dmc_310').is_visible() and g.evaluate("document.activeElement&&document.activeElement.id") in ('rq-dmc_310',), g.evaluate("document.activeElement&&document.activeElement.id"))
    ok('amount form says it also adds to My threads', 'adds the full skeins to My threads' in g.inner_text('#rf-dmc_310'))
    pre_p = g.evaluate(f"localStorage.getItem('{KEY}')"); pre_t = g.evaluate("JSON.stringify(FlossFoxThreadsUI.data().threads)")
    g.fill('#rq-dmc_310', '3'); g.click('#rc-dmc_310'); g.wait_for_timeout(300)
    ok('check-in: My threads 310 incremented 2 -> 5 (verified)', threads(g)['310']['n'] == 5)
    ok('check-in: storage spot and other fields kept', threads(g)['310'].get('storage', {}).get('container') == 'SECRET-BOX')
    ok('check-in: project receipt recorded, purchased cleared', pj(g)['decisions']['310']['recv']['qty'] == 3 and 'dmc:310' not in pj(g)['purchased'])
    ok('check-in: 310 no longer on the list', not any(l[0] == 'dmc:310' for l in lines(g)))
    m = g.inner_text('#pMsg'); ok('check-in: message says My threads (receipt copy rule)', 'My threads' in m and 'checked in' in m, m)
    ok('undo: control is at least 44px tall', g.evaluate("(()=>{const b=document.getElementById('pMsgUndo');const r=b.getBoundingClientRect();return !!b&&r.height>=44})()"))
    g.screenshot(path=f'{SHOTS}/stageC-checkin-1200.png', full_page=False)
    g.click('#pMsgUndo'); g.wait_for_timeout(250)
    ok('undo: project and My threads restored (same data)', json.loads(g.evaluate(f"localStorage.getItem('{TK}')"))['threads'] == json.loads(pre_t) and json.loads(g.evaluate(f"localStorage.getItem('{KEY}')"))['projects'][0]['decisions'] == json.loads(pre_p)['projects'][0]['decisions'])
    ok('undo: 310 back as bought, waiting to check in', any(l[0] == 'dmc:310' and l[2] for l in lines(g)))
    # create-if-missing: 797 not in My threads
    g.evaluate("FlossFoxProjects.open('p1')"); g.wait_for_timeout(150); g.click('#tabShop'); g.wait_for_timeout(200)
    g.check('#pb-dmc\\:797'); g.wait_for_timeout(200); checkin(g, 'dmc:797', 2)
    e = threads(g).get('797'); ok('check-in: missing color created with n=2, confirmed', e and e['n'] == 2 and e.get('confirmed') is True and e['restock'] is False, e)
    # no double count: 433 blank decision, owned 1 from My threads, needs 4 -> buy 3; receive 1 -> remaining 2
    l433 = [l for l in lines(g) if l[0] == 'dmc:433']
    ok('overlay color 433 starts at 3 to buy', l433 and l433[0][1] == 3, l433)
    g.check('#pb-dmc\\:433'); g.wait_for_timeout(200); checkin(g, 'dmc:433', 1)
    l433 = [l for l in lines(g) if l[0] == 'dmc:433']
    ok('no double count: My threads 433 = 2, project keeps no receipt, 2 left to buy', threads(g)['433']['n'] == 2 and pj(g)['decisions']['433']['recv'] is None and l433 and l433[0][1] == 2, (threads(g)['433'], l433))
    # invalid amount: nothing changes
    snap = g.evaluate(DUMP); g.evaluate("document.getElementById('pAwBox').open=true")
    g.check('#pb-dmc\\:BLANC'); g.wait_for_timeout(200); snap = g.evaluate(DUMP)
    g.evaluate("document.getElementById('pAwBox').open=true"); g.click('#rb-dmc_BLANC'); g.fill('#rq-dmc_BLANC', '0'); g.click('#rc-dmc_BLANC'); g.wait_for_timeout(200)
    ok('invalid amount: nothing changed', g.evaluate(DUMP) == snap and 'Nothing changed' in g.inner_text('#pMsg'))
    # threads write blocked -> both rolled back
    block(g, r'threads\.v1$'); snap = g.evaluate(DUMP); checkin(g, 'dmc:BLANC', 1)
    ok('threads blocked: project and threads unchanged (rolled back)', g.evaluate(DUMP) == snap)
    ok('threads blocked: plain Not saved, no Undo', 'Not saved' in g.inner_text('#pMsg') and g.locator('#pMsgUndo').count() == 0)
    unblock(g)
    # threads write silently ignored -> rolled back too
    block(g, r'threads\.v1$', 'ignore'); snap = g.evaluate(DUMP); checkin(g, 'dmc:BLANC', 1)
    ok('threads silently ignored: rolled back, Not saved', g.evaluate(DUMP) == snap and 'Not saved' in g.inner_text('#pMsg'))
    unblock(g)
    # project write blocked -> nothing changes
    block(g, r'^' + KEY.replace('.', r'\.') + '$'); snap = g.evaluate(DUMP); checkin(g, 'dmc:BLANC', 1)
    ok('project blocked: nothing changed', g.evaluate(DUMP) == snap and 'Not saved' in g.inner_text('#pMsg'))
    unblock(g)
    checkin(g, 'dmc:BLANC', 1)
    ok('BLANC check-in goes to BLANC, never WHITE', threads(g).get('BLANC', {}).get('n') == 1 and threads(g)['WHITE']['n'] == 1)
    # undo refused if My threads changed since
    g.evaluate("FlossFoxThreadsUI.set('BLANC',{n:4})"); g.wait_for_timeout(100)
    g.click('#pMsgUndo'); g.wait_for_timeout(200)
    ok('undo after a later edit: refused, newer edit kept', threads(g)['BLANC']['n'] == 4 and 'changed since' in g.inner_text('#pMsg'), g.inner_text('#pMsg'))
    ok('no page errors (check-in)', not g.errs, g.errs); c.close()

    # 3. Non-DMC project: project-only receipt, My threads untouched
    c, g = ctx(br, seed(), 1200, 900); g.goto(B + '?nosw'); ready(g)
    g.evaluate("FlossFoxProjects.open('p2')"); g.wait_for_timeout(200); g.click('#tabShop'); g.wait_for_timeout(200)
    k = [l for l in lines(g, 'p2')][0][0]
    g.check(f'#pb-{k.replace(":", "\\:")}'); g.wait_for_timeout(200)
    t0 = g.evaluate(f"localStorage.getItem('{TK}')"); kk = k.replace(':', '_')
    g.evaluate("document.getElementById('pAwBox').open=true"); g.click(f'#rb-{kk}')
    ok('anchor: no My threads promise in the form', 'My threads' not in g.inner_text(f'#rf-{kk}'))
    g.fill(f'#rq-{kk}', '2'); g.click(f'#rc-{kk}'); g.wait_for_timeout(250)
    ok('anchor: My threads byte-identical, project receipt recorded', g.evaluate(f"localStorage.getItem('{TK}')") == t0 and pj(g, 'p2')['decisions']['321']['recv']['qty'] == 2)
    ok('anchor: message does not claim My threads', 'My threads' not in g.inner_text('#pMsg'), g.inner_text('#pMsg'))
    c.close()

    # 4. Programmatic API uses the same verified check-in (renderShop's 'Shop my list' mode has no entry point on dev main; its form is wired to checkIn too)
    c, g = ctx(br, seed(), 390, 860); g.goto(B + '?nosw'); ready(g)
    g.evaluate("(()=>{const p=FlossFoxProjects._store().projects[0];p.purchased['dmc:310']=true})()")
    r = g.evaluate("FlossFoxProjects.checkIn('p1','dmc:310',3)")
    ok('API check-in: ok, My threads 310 = 5', r.get('ok') is True and threads(g)['310']['n'] == 5, r)
    r2 = g.evaluate("FlossFoxProjects.undoCheckIn()")
    ok('API undo: My threads 310 back to 2', r2.get('ok') is True and threads(g)['310']['n'] == 2, r2)
    ok('API: bad amount refused', g.evaluate("FlossFoxProjects.checkIn('p1','dmc:310',0).ok") is False)
    c.close()

    # 5. My threads: views, sort, Running low, suggestions, restock section
    c, g = ctx(br, seed(), 390, 860); g.goto(B + '?nosw'); ready(g); g.click('#tabThreads'); g.wait_for_timeout(250)
    base = g.evaluate(DUMP)
    ok('library: tools shown', g.locator('#ffLibTools').is_visible())
    ok('low hint: singular when threshold is 1', '1 full skein or fewer' in g.inner_text('#ffLowHint') and 'skeins' not in g.inner_text('#ffLowHint'))
    order = lambda: g.evaluate("[...document.querySelectorAll('#thList > li.th:not(.demo)')].filter(l=>getComputedStyle(l).display!=='none').map(l=>l.dataset.code)")
    ok('library: default order by DMC number', order() == ['310', '321', '433', '666', 'WHITE'], order())
    ok('library: visiting wrote nothing', g.evaluate(DUMP) == base)
    g.select_option('#ffLibSort', 'amount'); g.wait_for_timeout(150)
    ok('sort amount: fewest first', order()[:2] == ['666', '433'] or order()[0] == '666', order())
    g.select_option('#ffLibSort', 'recent'); g.wait_for_timeout(150)
    ok('sort recent: newest change first', order()[0] == '433', order())
    g.select_option('#ffLibSort', 'location'); g.wait_for_timeout(150)
    ok('sort location: colors with a spot first', order()[0] == '310', order())
    g.select_option('#ffLibSort', 'family'); g.wait_for_timeout(150)
    ok('sort family: every color still listed once', sorted(order()) == ['310', '321', '433', '666', 'WHITE'], order())
    ok('sort saved only to the preference key', json.loads(g.evaluate(f"localStorage.getItem('{AK}')"))['collectionSort'] == 'family' and g.evaluate(f"localStorage.getItem('{TK}')") == json.dumps(THR))
    g.select_option('#ffLibSort', 'code')
    g.click('#ffLibV-grid'); g.wait_for_timeout(150)
    ok('view grid: class + aria-pressed', 'ffa-view-grid' in g.get_attribute('#thList', 'class') and g.get_attribute('#ffLibV-grid', 'aria-pressed') == 'true')
    g.screenshot(path=f'{SHOTS}/stageC-threads-grid-390.png', full_page=True)
    g.click('#ffLibV-shelf'); g.wait_for_timeout(150); ok('view shelf: no overflow', nooverflow(g))
    g.screenshot(path=f'{SHOTS}/stageC-threads-shelf-390.png', full_page=True)
    g.click('#ffLibV-list'); g.wait_for_timeout(100)
    g.click('#ffLowOnly'); g.wait_for_timeout(150)
    ok('Running low (<=1): 433, 666, WHITE', sorted(order()) == ['433', '666', 'WHITE'], order())
    g.fill('#ffLowN', '2'); g.press('#ffLowN', 'Tab'); g.wait_for_timeout(150)
    ok('threshold 2: 310 joins', sorted(order()) == ['310', '433', '666', 'WHITE'], order())
    ok('low hint: plural when threshold is 2', '2 full skeins or fewer' in g.inner_text('#ffLowHint'))
    g.fill('#ffLowN', '99'); g.press('#ffLowN', 'Tab'); g.wait_for_timeout(150)
    ok('threshold invalid: refused, kept 2', g.input_value('#ffLowN') == '2' and 'Nothing changed' in g.inner_text('#ffLibStatus'))
    g.fill('#ffLowN', '0'); g.press('#ffLowN', 'Tab'); g.wait_for_timeout(150)
    ok('threshold 0: only 666', order() == ['666'], order())
    g.fill('#ffLowN', '1'); g.press('#ffLowN', 'Tab'); g.click('#ffLowOnly'); g.wait_for_timeout(150)
    ok('library changes never touched My threads', g.evaluate(f"localStorage.getItem('{TK}')") == json.dumps(THR))
    sugg = g.locator('#ffLowSuggest .ffa-sug').count()
    ok('suggestions: up to 3 low colors, explicit buttons', 1 <= sugg <= 3 and g.locator('#ffLowSuggest button:has-text("Add to shopping list")').count() == sugg and g.locator('#ffLowSuggest button:has-text("Not now")').count() == sugg, sugg)
    g.screenshot(path=f'{SHOTS}/stageC-suggest-390.png', full_page=False)
    first = g.evaluate("document.querySelector('#ffLowSuggest .ffa-sug .pri').id.split('-').pop()")
    g.click(f'#ffSugNo-{first}'); g.wait_for_timeout(150)
    ok('Not now: hidden, nothing written', g.locator(f'#ffSugAdd-{first}').count() == 0 and g.evaluate(f"localStorage.getItem('{TK}')") == json.dumps(THR))
    second = g.evaluate("document.querySelector('#ffLowSuggest .ffa-sug .pri').id.split('-').pop()")
    g.click(f'#ffSugAdd-{second}'); g.wait_for_timeout(200)
    ok('Add to shopping list: restock flag set (verified), n unchanged', threads(g)[second]['restock'] is True and threads(g)[second]['n'] == THR['threads'][second]['n'])
    ok('Add: confirmation message', 'shopping list' in g.inner_text('#ffSugMsg'))
    block(g, r'threads\.v1$'); third = g.evaluate("(document.querySelector('#ffLowSuggest .ffa-sug .pri')||{id:''}).id.split('-').pop()")
    if third:
        g.click(f'#ffSugAdd-{third}'); g.wait_for_timeout(150)
        ok('Add blocked: restock not set, Not saved', threads(g)[third]['restock'] is False and 'Not saved' in g.inner_text('#ffSugMsg'))
    unblock(g)
    g.click('#tabShop'); g.wait_for_timeout(250)
    ok('Shop: Restock for My threads lists the flagged color only', g.locator('#ffRestock').is_visible() and g.locator('#ffRestock li').count() == 1 and g.locator(f'#ffRestock li[data-code="{second}"]').count() == 1)
    g.screenshot(path=f'{SHOTS}/stageC-restock-390.png', full_page=False)
    g.click(f'#ffRsRm-{second}'); g.wait_for_timeout(200)
    ok('Restock Remove: flag cleared (verified), message', threads(g)[second]['restock'] is False and 'off the restock list' in g.inner_text('#ffRestock'))
    ok('no page errors (library)', not g.errs, g.errs); c.close()

    # 6. Settings: Display settings heading, seasonal ON by default with no-art note, Reset; screenshots
    c, g = ctx(br, seed(), 390, 900); g.goto(B + '?nosw'); ready(g); g.click('#tabSettings'); g.wait_for_timeout(200)
    ok('settings: heading "Display settings"', g.inner_text('#ffPrefH') == 'Display settings')
    ok('settings: seasonal ON by default, no-art note', g.is_checked('#ffSeasonal') and 'No seasonal art yet' in g.inner_text('#ffSeasonalState'))
    ok('settings: visiting wrote no pref', g.evaluate(f"localStorage.getItem('{AK}')") is None)
    g.click('#ffResume'); g.wait_for_timeout(100)
    g.locator('#ffAtelierPrefs').scroll_into_view_if_needed(); g.screenshot(path=f'{SHOTS}/stageC-settings-resume-390.png', full_page=False)
    g.click('#ffSeasonal'); g.wait_for_timeout(100)
    ok('seasonal off saved to pref only', json.loads(g.evaluate(f"localStorage.getItem('{AK}')"))['seasonalPip'] is False)
    g.click('#ffPrefReset'); g.wait_for_timeout(250)
    g.screenshot(path=f'{SHOTS}/stageC-settings-reset-dialog-390.png', full_page=False)
    g.click('#ffConfirmGo'); g.wait_for_timeout(200)
    ok('reset: seasonal back ON, Resume off, projects/threads intact', g.is_checked('#ffSeasonal') and not g.is_checked('#ffResume') and g.evaluate(f"localStorage.getItem('{TK}')") == json.dumps(THR) and g.evaluate(f"localStorage.getItem('{KEY}')") == json.dumps(PROJ))
    g.locator('#ffAtelierPrefs').scroll_into_view_if_needed(); g.screenshot(path=f'{SHOTS}/stageC-settings-reset-done-390.png', full_page=False)
    # skein Undo screenshot
    g.click('#tabThreads'); g.wait_for_timeout(200); g.click('#tp-321'); g.wait_for_timeout(200)
    ok('skein step: Undo visible', g.locator('#thStepUndo').is_visible())
    ok('skein step: Undo is at least 44px tall', g.evaluate("(()=>{const b=document.getElementById('thStepUndo');const r=b.getBoundingClientRect();return !!b&&r.height>=44})()"))
    g.locator('#thStatus').scroll_into_view_if_needed(); g.screenshot(path=f'{SHOTS}/stageC-skein-undo-390.png', full_page=False)
    c.close()

    # 7. Search fixes: white siblings visible, Pip greeting hidden while open, panel beside Pip at 1280, focus shot
    c, g = ctx(br, seed(), 1280, 900); g.goto(B + '?nosw'); ready(g)
    g.click('#ffSearchBtn'); g.fill('#ffSearchIn', 'white'); g.wait_for_timeout(350)
    labels = g.evaluate("[...document.querySelectorAll('#ffSearchList [role=option] b')].slice(0,3).map(b=>b.textContent)")
    ok('search white: WHITE, BLANC, B5200 first', [x.split(' ·')[0] for x in labels] == ['DMC WHITE', 'DMC BLANC', 'DMC B5200'], labels)
    ok('search white: siblings say they are different colors', g.locator('#ffSearchList .ffa-sibnote').count() == 2 and 'A different color from DMC WHITE' in g.inner_text('#ffSearchList'))
    ok('search: Pip greeting hidden while open', g.evaluate("[...document.querySelectorAll('.pipc .pipbubble,.pipc .ffpipline,.pipc .pipA-bubble')].every(e=>getComputedStyle(e).visibility==='hidden'||e.offsetParent===null)"))
    gap = g.evaluate("(()=>{const s=document.getElementById('ffSearch').getBoundingClientRect(),p=document.querySelector('.pipc');if(!p||p.offsetParent===null)return 999;const r=p.getBoundingClientRect();return r.left-s.right})()")
    ok('search 1280: panel stops 16px+ before the Pip column', gap >= 16, gap)
    g.keyboard.press('ArrowDown'); g.keyboard.press('ArrowDown'); g.wait_for_timeout(100)
    g.screenshot(path=f'{SHOTS}/stageC-search-focus-1280.png', full_page=False)
    g.keyboard.press('Escape'); g.wait_for_timeout(100)
    ok('search closed: Pip greeting visible again', g.evaluate("!document.body.classList.contains('ffa-searching')"))
    c.close()

    # 8. Widths: no overflow (threads tools, store mode, restock), screenshots
    for w in (360, 390, 768, 1280):
        c, g = ctx(br, seed(), w, 900); g.goto(B + '?nosw'); ready(g)
        g.click('#tabThreads'); g.wait_for_timeout(200); ok(f'[{w}] My threads + tools no overflow', nooverflow(g))
        g.evaluate("FlossFoxThreadsUI.setRestock('310',true)"); g.click('#tabShop'); g.wait_for_timeout(200)
        ok(f'[{w}] Shop + restock no overflow', nooverflow(g))
        open_store(g); ok(f'[{w}] Store checklist no overflow', nooverflow(g))
        small = g.evaluate("[...document.querySelectorAll('#pStore button,#pStore input,#pStore select,#ffRestock button')].filter(e=>e.offsetParent).filter(e=>{const r=e.getBoundingClientRect();return r.height<44}).map(e=>e.id||e.textContent.trim()).slice(0,5)")
        ok(f'[{w}] checklist + restock targets 44px', not small, small)
        g.screenshot(path=f'{SHOTS}/stageC-checklist-{w}.png', full_page=True)
        ok(f'[{w}] no page errors', not g.errs, g.errs); c.close()
    br.close()
print(f'atelier_stagec_e2e: {R[0]} passed, {R[1]} failed (simulated)'); sys.exit(1 if R[1] else 0)
