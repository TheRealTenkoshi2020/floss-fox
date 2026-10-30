"""First-time flow phases 1-2 (SIMULATED browser testing: headless Chrome, 390px, mobile + touch emulation; not real devices).
Usage: python3 tests/flow_p12_e2e.py BASE_URL"""
import sys, json, os
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; KEY = 'flossfox-dev.v1'; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
INIT = "if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('flossfox-dev.tour.v1','{\"status\":\"dismissed\"}');%s}"
it = lambda c, q: {'code': c, 'qty': q, 'assumed': 0, 'stated': True, 'src': [c]}
def dec(st=None, own=None, src=None): return {'status': st, 'owned': own, 'anchor': None, 'recv': None, 'ownedSource': src, 'ownedPartial': False, 'estimateChecked': None}
TH = {'schema': 1, 'threads': {'310': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'}, '321': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'}, '666': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'}}}
def seed(projects=None, threads=True):
    s = ''
    if projects is not None: s += "localStorage.setItem('%s',%s);" % (KEY, json.dumps(json.dumps({'schema': 2, 'projects': projects})))
    if threads: s += "localStorage.setItem('flossfox-dev.threads.v1',%s);" % json.dumps(json.dumps(TH))
    return s
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); ERR = []
    def page(init='', w=390):
        c = b.new_context(viewport={'width': w, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2); c.add_init_script(INIT % init)
        g = c.new_page(); g.on('pageerror', lambda e: ERR.append(str(e))); g.on('dialog', lambda d: d.accept()); g.goto(B + '?nosw'); g.wait_for_timeout(400); return g
    def store(g): return g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects")
    def paste_save(g, txt, name=''):
        g.click('#tabConvert'); g.fill('#inp', txt); g.click('#go'); g.wait_for_timeout(250)
        if name: g.fill('#newProjName', name)
        g.click('#saveProj'); g.wait_for_timeout(300)
    # (a) auto-compare on a new project, with Undo
    g = page(seed([]))
    paste_save(g, '310 x1\n321 x1\n666\n3865\n815')
    g.click('#openSaved'); g.wait_for_timeout(400); g.click('#pAutoMore'); g.wait_for_timeout(60); a = g.inner_text('#pAuto')
    ok('a1 new project: Pip checks My threads automatically and says so', 'Pip checked your threads: you have enough of 2 of these 5 colors.' in a, a)
    ok('a2 banner explains Not sure and Need to buy with exact plurals', "1 color you own needs an amount check, so it's marked Not sure." in a and '2 colors are short or missing, so they went on Need to buy.' in a, a)
    d = store(g)[0]['decisions']; ok('a3 auto-compare used the existing engine result (310/321 Have enough, 666 Not sure, 3865/815 Need to buy)', [d[c]['status'] for c in ['310', '321', '666', '3865', '815']] == ['have', 'have', 'check', 'buy', 'buy'], d)
    g.click('#tabThreads'); g.click('#tabProjects'); g.wait_for_timeout(200)
    ok('a4 Undo survives switching tabs (until the project changes or reload)', g.is_visible('#pAutoUndo'))
    g.click('#pAutoUndo'); g.wait_for_timeout(200); d = store(g)[0]['decisions']
    ok('a5 Undo puts every color back and says so with the right plural', all(d[c]['status'] is None for c in d) and 'Undone: 5 colors put back as they were.' in g.inner_text('#pAuto'), (d, g.inner_text('#pAuto')))
    g.reload(); g.wait_for_timeout(400); g.click('#tabProjects'); g.click('[data-open]'); g.wait_for_timeout(300)
    ok('a6 after Undo, reopening does not silently re-apply', all(x['status'] is None for x in store(g)[0]['decisions'].values()) and not g.is_visible('#pAutoUndo'))
    # (a) never overwrite a user decision
    now = '2026-10-21T00:00:00.000Z'
    g = page(seed([{'id': 'u1', 'name': 'Mine', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [it('310', 1), it('321', 1), it('815', 1)], 'decisions': {'310': dec('buy'), '321': dec(), '815': dec('have', 3, 'user')}, 'purchased': {}, 'created': now, 'updated': now}]))
    g.click('#tabProjects'); g.click('[data-open="u1"]'); g.wait_for_timeout(300); d = store(g)[0]['decisions']
    ok('a7 user-made choices are never overwritten (310 stays Need to buy, 815 stays Have enough 3)', d['310']['status'] == 'buy' and d['815']['status'] == 'have' and d['815']['owned'] == 3 and d['321']['status'] == 'have', d)
    # (a) old projects: offered, not altered
    old = '2026-10-01T00:00:00.000Z'
    g = page(seed([{'id': 'o1', 'name': 'Old one', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [it('310', 1), it('321', 1)], 'decisions': {'310': dec(), '321': dec()}, 'purchased': {}, 'created': old, 'updated': old}]))
    raw0 = g.evaluate(f"localStorage.getItem('{KEY}')"); g.click('#tabProjects'); g.click('[data-open="o1"]'); g.wait_for_timeout(300)
    ok('a8 older project is NOT altered on open', g.evaluate(f"localStorage.getItem('{KEY}')") == raw0)
    ok('a9 older project gets an offer instead', g.is_visible('#pAutoApply'), g.inner_text('#pAuto'))
    g.click('#pAutoApply'); g.wait_for_timeout(200); ok('a10 accepting the offer applies and can be undone', store(g)[0]['decisions']['310']['status'] == 'have' and g.is_visible('#pAutoUndo'))
    # empty collection
    g = page(seed([], threads=False)); paste_save(g, '310 x1'); g.click('#openSaved'); g.wait_for_timeout(300)
    ok('a11 empty collection: says so with Go to My threads, changes nothing', 'Your thread collection is empty' in g.inner_text('#pAuto') and g.is_visible('#pAutoThreads') and store(g)[0]['decisions']['310']['status'] is None, g.inner_text('#pAuto'))
    # (b) one shopping view
    g = page(seed([], threads=False)); g.click('#tabShop'); g.wait_for_timeout(200); t = g.inner_text('#shopCard')
    ok('b1 empty Shopping guides you to import or add colors (not a dead end)', 'Nothing in the basket yet' in t and g.is_visible('#shopEmptyImport') and g.is_visible('#shopEmptyPaste'), t)
    ok('b2 Plan shopping for several projects is hidden with 0 projects', not g.is_visible('#shopSeveral'))
    g.click('#shopEmptyImport'); ok('b3 Import from empty Shopping opens the importer', g.is_visible('#ffPatternDialog')); g.click('#ffPatternDialog .pat-header button')
    paste_save(g, '310 x1\n321 x2', 'Alpha'); paste_save(g, '815 x1', 'Beta')
    g.click('#tabShop'); g.wait_for_timeout(200)
    opts = g.eval_on_selector_all('#shopPick option', 'o=>o.map(x=>x.textContent)')
    ok('b4 Shopping has a project picker at the top listing every project', g.is_visible('#shopPick') and 'Alpha' in opts and 'Beta' in opts, opts)
    ok('b2b with projects, Plan shopping for several projects is on Shopping', g.is_visible('#shopSeveral'))
    g.select_option('#shopPick', label='Alpha'); g.wait_for_timeout(300); ok('b5 picking a project shows its list in the same view', 'Alpha' in g.inner_text('#shopProj') and g.is_visible('#shopBody'), g.inner_text('#shopProj'))
    g.click('#tabProjects'); g.wait_for_timeout(200)
    if g.is_visible('#pClose'): g.click('#pClose')
    g.click('#projOpenLast'); g.wait_for_timeout(200); g.click('#pShop'); g.wait_for_timeout(200); v1 = g.is_visible('#shopView')
    g.click('#tabProjects'); g.click('[data-flow="shop"]'); g.wait_for_timeout(200); v2 = g.is_visible('#shopView')
    ok('b6 Shop my list, step 4 and the Shopping tab all land on the one Shopping view', v1 and v2)
    g.click('#shopSeveral'); g.wait_for_timeout(300); ok('b7 several-projects planner opens from Shopping', g.is_visible('#planCard'))
    # (c) Next chain
    g = page(seed([])); g.click('#tabThreads'); ok('c1 My threads ends with one Next', g.locator('#thNext').count() == 1 and 'Next' in g.inner_text('#thNext'))
    g.click('#thNext'); g.wait_for_timeout(200); ok('c2 threads Next carries you to adding a pattern', g.is_visible('#convertView'))
    g.fill('#inp', '310 x1\n321'); g.click('#go'); g.wait_for_timeout(250); ok('c3 results show one Next: save as a project', g.is_visible('#findNextBtn') and 'save as a project' in g.inner_text('#findNextBtn'))
    g.click('#saveProj'); g.wait_for_timeout(300); g.click('#openSaved'); g.wait_for_timeout(300)
    ok('c4 project keeps one Next: see what to buy (#pNext); duplicate Next buttons removed in ci005-59, readiness is the Readiness step', g.locator('[data-ffgo="ready"]').count() == 0 and g.locator('#pNext').count() == 1 and g.locator('#pFlow [data-flow="ready"]').count() == 1)
    g.click('#pNext'); g.wait_for_timeout(200); ok('c5 project Next carries the project into Shopping', g.is_visible('#shopView') and g.is_visible('#shopBody'))
    ok('c6 Shopping has Back to my project', g.is_visible('#shopBack') and g.inner_text('#shopBack') == 'Back to my project')
    # (d) import label everywhere
    g = page(seed([], threads=False)); L = 'Import a pattern (PDF)'
    lf = g.inner_text('#convertView .pat-launch'); top = g.evaluate("document.querySelector('#convertView .pat-launch').parentElement===document.getElementById('go').parentElement")
    g.click('#tabProjects'); le = g.inner_text('#emptyImport'); lp = g.inner_text('#patLaunchProjects')
    ok('d1 one label on Find floss (in the Add my colors row, top of the add area), My Projects and the empty Projects state', lf == L and le == L and lp == L and top, (lf, le, lp, top))
    ok('d2 old label gone', 'Import a full pattern' not in g.inner_text('body'))
    # (e) save feedback + name prompt
    g = page(seed([])); paste_save(g, '310 x1'); m = g.inner_text('#copymsg')
    ok('e1 Find floss save: one clear saved line, default name My project, name field offered', '✓ “My project” is safely tucked away in this browser on this device.' in m and g.input_value('#savedName') == 'My project', m)
    g.fill('#savedName', 'Fox sampler'); g.click('#savedRename'); g.wait_for_timeout(200); ok('e2 renaming from the prompt saves the name', store(g)[0]['name'] == 'Fox sampler')
    g.click('#openSaved'); g.wait_for_timeout(300); ok('e3 project shows the saved badge in the same wording', g.inner_text('#pSaved').startswith('Saved in this browser · '), g.inner_text('#pSaved'))
    g.click('#tabConvert'); g.click('#convertView .pat-launch'); g.set_input_files('#patFile', 'tests/fixtures/patterns/native-legend.pdf'); g.wait_for_timeout(2500)
    ok('e4 import name defaults to the PDF file name', g.input_value('#patName') == 'native-legend', g.input_value('#patName'))
    g.check('#patAll'); g.click('#patImport'); g.wait_for_timeout(400); ok('e5 import saved box uses the same saved style', g.locator('#patSavedBox .ffsaved').count() == 1)
    # (f) per-tab help + bubble
    g = page(seed([], threads=False)); seen = {}
    for tab, k in (('#tabThreads', 'threads'), ('#tabProjects', 'projects'), ('#tabShop', 'shop'), ('#tabHelp', 'help')):
        g.click(tab); g.wait_for_timeout(200); seen[k] = g.inner_text('#pipMsg')
        g.click('#askPipBtn'); g.wait_for_timeout(150); a = g.inner_text('#askPip'); g.click('#askPip [data-a="close"]')
        e = g.evaluate(f"FF_STR.help.{k}.title"); ok(f'f1 Ask Pip on {k} shows that screen\'s help ("{e}") with a Do this next button', e in a and g.locator('#askPip [data-ffnext]').count() <= 1, a[:200])
    ok('f2 bubble changes per tab and never says the stale line', len(set(seen.values())) == 4 and not any('Your colors are ready' in v for v in seen.values()), seen)
    g.click('#tabThreads'); g.wait_for_timeout(150); ok('f3 threads bubble is the empty-collection line', seen['threads'] in (g.evaluate("FF_P12['p12.bubble.threads.empty.1']"), g.evaluate("FF_P12['p12.bubble.threads.empty.2']")), seen['threads'])
    ok('f4 Ready to stitch never shown when not ready', not any('Ready to stitch' in v for v in seen.values()))
    g = page(seed([{'id': 'r1', 'name': 'Done', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning', 'items': [it('310', 1)], 'decisions': {'310': dec('have', 2, 'user')}, 'purchased': {}, 'created': now, 'updated': now}]))
    g.click('#tabProjects'); g.click('[data-open="r1"]'); g.wait_for_timeout(300); ok('f5 ready project: bubble says Ready to stitch (readiness says ready)', 'Ready to stitch' in g.inner_text('#pipMsg') and g.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).ready"), g.inner_text('#pipMsg'))
    g.click('#tabConvert'); g.click('#convertView .pat-launch'); g.wait_for_timeout(200); g.click('#ffImportPip'); ok('f6 import window has Pip help inside it', g.is_visible('#ffImportPipBox') and 'Bring in a PDF pattern' in g.inner_text('#ffImportPipBox'))
    g.click('#ffPatternDialog .pat-header button'); g.click('#tabProjects'); g.click('#pClose') if g.is_visible('#pClose') else None; g.click('#backupBox summary'); g.wait_for_timeout(150)
    ok('f7 backup box has Pip help', 'Keep a copy of your work' in g.inner_text('#ffBackupPip'))
    # (g) term chips
    g = page(seed([])); chips = g.eval_on_selector_all('.ffterm', 'e=>e.map(x=>x.dataset.term)')
    g.locator('.ffterm[data-term="dmc"]').click(); t = g.inner_text('#ffTermPop')
    ok('g1 "?" chip next to DMC opens a short explanation', 'best-known brand' in t, t)
    sz = g.evaluate("(()=>{const r=document.querySelector('.ffterm').getBoundingClientRect();return[r.width,r.height]})()"); ok('g2 chip touch target at least 44px', sz[0] >= 44 and sz[1] >= 44, sz)
    g.keyboard.press('Escape'); ok('g3 Escape closes the explanation', g.locator('#ffTermPop').count() == 0)
    g.click('#tabThreads'); g.wait_for_timeout(150); ok('g4 skein chip on My threads', g.locator('#threadsView .ffterm[data-term="skein"]').count() == 1)
    paste_save(g, '310 x1\n321'); g.click('#openSaved'); g.wait_for_timeout(300)
    ok('g5 readiness and Needs attention chips in a project', g.locator('#pReady .ffterm[data-term="readiness"]').count() == 1, g.eval_on_selector_all('.ffterm', 'e=>e.map(x=>x.dataset.term)'))
    g.click('#convertView .pat-launch') if g.is_visible('#convertView .pat-launch') else (g.click('#tabConvert'), g.click('#convertView .pat-launch')); g.wait_for_timeout(200)
    ok('g6 legend chip in the import window', g.locator('#ffPatternDialog .ffterm[data-term="legend"]').count() == 1); g.click('#ffPatternDialog .pat-header button')
    f = page(seed([])); f.goto(B + 'fabric.html?nosw'); f.wait_for_timeout(500)
    ok('g7 fabric count chip on Fabric', f.locator('.ffterm[data-term="count"]').count() == 1)
    # (i) Fabric Ask Pip + Pip slot
    ok('i1 Fabric page has an Ask Pip entry and a Pip slot', f.is_visible('#ffFabricAsk') and f.is_visible('#ffFabricPip') and len(f.inner_text('#ffFabricPip')) > 10)
    f.click('#ffFabricAsk'); ok('i2 Fabric Ask Pip opens its screen help', 'How much fabric to cut' in f.inner_text('#ffFabricPanel'))
    f.click('#ffFabricPanel [data-ffnext]'); ok('i3 its Do this next focuses the pattern size', f.evaluate("document.activeElement.id") == 'fcW')
    # (h) tour: 5 steps, switches tabs
    g = page(seed([])); g.click('#tabHelp'); g.click('#helpTour'); g.wait_for_timeout(200); views = []; titles = []
    for i in range(5):
        titles.append(g.inner_text('#tourH')); views.append([v for v in ('convertView', 'threadsView', 'projectsView', 'shopView') if g.is_visible('#' + v)])
        if i < 4: g.click('#tourCard [data-t="next"]'); g.wait_for_timeout(200)
    ok('h1 tour is 5 steps with Pixel titles', titles == ["Add your pattern's colors", 'Tell me what you own', 'Save it as a project', 'Get your shopping list', "You're all set"], titles)
    ok('h2 tour switches tabs per step (threads, projects, shopping)', views[1] == ['threadsView'] and views[2] == ['projectsView'] and views[3] == ['shopView'], views)
    g.click('#tourCard [data-t="close"]'); ok('h3 tour closes', g.locator('#tourCard').count() == 0)
    g = page(seed([])); g.click('#tabHelp'); g.click('#helpTour'); g.click('#tourCard [data-t="skip"]'); ok('h4 tour is skippable', g.locator('#tourCard').count() == 0)
    # photo picked opens paste box
    g = page(seed([])); g.click('#convertView .pat-launch'); fx = 'tests/fixtures/patterns/legend-scan.png'
    if os.path.exists(fx): g.set_input_files('#patFile', fx); g.wait_for_timeout(1500); ok('d3 picking a photo opens the paste box', g.evaluate("document.querySelector('details.pat-manual').open"))
    if os.path.exists(fx):
        inf = g.inner_text('#patInfo'); ok('d4 PDF only: picking a photo says only PDFs work right now', inf == 'Only PDFs work right now. Choose a PDF file, or type the color key into the box below.', inf)
        ok('d5 PDF only: no photo preview drawn', g.locator('#patImagePreview canvas').count() == 0)
    dlg = g.inner_text('#ffPatternDialog'); ok('d6 PDF only: modal text and help never offer photos or images', 'Choose a PDF, up to 20 MB. We read its text on this device to find the color key. Chart symbols and scanned pages can\'t be read.' in dlg and not any(w in dlg.lower() for w in ('photo', 'png', 'jpg', 'webp', 'image')), dlg[:400])
    ok('d7 PDF only: file input accept is .pdf,application/pdf', g.get_attribute('#patFile', 'accept') == '.pdf,application/pdf')
    # offline Ask Pip answers for inventory and privacy do not suggest online AI can be turned on
    g = page(seed([]))
    for q, want in (('inventory', 'Your collection stays in this browser.'), ('privacy', "Ask Pip's built-in help works on this device and never sends anything over the network. Online AI is off.")):
        g.click('#tabHelp'); g.wait_for_timeout(150); g.click('#helpPip [data-piph-open]'); g.wait_for_timeout(150); g.fill('#piphMessage', q); g.click('#pipHybridDialog button:has-text("Ask offline")'); g.wait_for_timeout(300)
        t = g.inner_text('#pipHybridDialog'); ok(f'd8 Ask Pip {q} answer is Pixel\'s text, no "enable online AI"', want in t and 'enable online AI' not in t and "shared with Pip's online AI" not in t, t[-300:])
        ok(f'd9 online AI stays off ({q})', g.evaluate("!(window.PIP_PATTERN_CONFIG&&window.PIP_PATTERN_CONFIG.enabled===true)") and not g.locator('#pipHybridDialog button:has-text("Ask online AI")').is_visible())
        g.keyboard.press('Escape'); g.wait_for_timeout(150)
    # 344px no overflow, touch targets
    g = page(seed([]), 344); ov = g.evaluate("document.documentElement.scrollWidth<=344")
    ok('w1 344px: no horizontal overflow on Find floss', ov)
    small = g.evaluate("[...document.querySelectorAll('.ffnext button,.ffbanner button,.ffterm,#shopPick,.pat-launch')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect()).filter(r=>r.height<44).length")
    ok('w2 new controls are at least 44px tall', small == 0, small)
    txt = g.evaluate("JSON.stringify(window.FF_P12)+JSON.stringify(FF_STR)"); ok('w3 no em dashes in the new strings', '\u2014' not in txt)
    # Pip line: on every tab the single companion carries that tab's line (strip art retired in the one-Pip build), no layout push, not clipped, reduced motion respected
    for w in (344, 390):
        g = page(seed([], threads=False), w); hconv = g.evaluate("document.querySelector('header').getBoundingClientRect().height")
        ok(f'j0 {w}px Find floss keeps the full Pip (strip hidden there)', g.locator('#pipStrip').count() == 0 or g.locator('#pipStrip').is_hidden())
        for tab, k in (('#tabThreads', 'threads'), ('#tabProjects', 'projects'), ('#tabShop', 'shop'), ('#tabHelp', 'help')):
            g.click(tab); g.wait_for_timeout(250)
            # one-Pip build: the strip art is gone; the tab's approved line now shows in the single companion Pip (bottom bar)
            r = g.evaluate("(()=>{const s=document.getElementById('pipStrip'),c=document.querySelector('.pipc'),m=document.getElementById('pipMsg'),h=document.querySelector('header').getBoundingClientRect();return{strip:!!s&&!s.hidden&&s.getBoundingClientRect().height>0,vis:!!c&&c.getBoundingClientRect().height>0,txt:m.textContent.trim(),clip:m.scrollHeight>m.clientHeight+1,hh:h.height,key:FFHelp.bubbleLine(),img:document.getElementById('pipImg').getBoundingClientRect().width}})()")
            want = g.evaluate("k=>{const t=FF_P12[k];return typeof t==='function'?null:t}", r['key']) if r['key'] else None
            ok(f'j1 {w}px {k}: the one Pip shows this tab\'s line (no separate strip)', not r['strip'] and r['vis'] and r['key'] and r['key'].startswith(f'p12.bubble.{k}') and (want is None or r['txt'] == want), r)
            ok(f'j2 {w}px {k}: full line shown (not clipped), header no taller than on Find floss', not r['clip'] and r['hh'] <= hconv + 1 and r['img'] >= 40, (r, hconv))
        g.click('#tabConvert'); g.evaluate("document.getElementById('pipToggle').click()"); g.click('#tabThreads'); g.wait_for_timeout(200)
        ok(f'j3 {w}px Hide Pip also hides the strip', g.locator('#pipStrip').is_hidden())
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, reduced_motion='reduce'); c.add_init_script(INIT % ''); g = c.new_page(); g.goto(B + '?nosw'); g.wait_for_timeout(300); g.click('#tabHelp'); g.wait_for_timeout(200)
    ok('j4 reduced motion: strip has no animation', g.evaluate("getComputedStyle(document.getElementById('pipStrip')).animationName") == 'none')
    ok('j5 strip is decorative only (no new tap targets, hidden from screen readers; Ask Pip stays the entry)', g.locator('#pipStrip button, #pipStrip a').count() == 0 and g.get_attribute('#pipStrip', 'aria-hidden') == 'true')
    # Pixel batch 2
    g = page(seed([])); paste_save(g, '310 x1\n321 x1\n815'); g.click('#openSaved'); g.wait_for_timeout(300); g.click('#pAutoMore'); g.wait_for_timeout(60)
    ok('k1 banner says how many colors Pip filled in (n wired)', "Pip filled in 3 colors you hadn't decided yet." in g.inner_text('#pAuto'), g.inner_text('#pAuto'))
    g.reload(); g.wait_for_timeout(300); g.click('#tabProjects'); g.click('[data-open]') if g.is_visible('[data-open]') else None; g.wait_for_timeout(300)
    ok('k2 reload: nothing-to-fill banner shown once', 'nothing to fill in' in g.inner_text('#pAuto'), g.inner_text('#pAuto'))
    g.click('#pAutoHide'); g.reload(); g.wait_for_timeout(300); g.click('#tabProjects'); g.click('[data-open]') if g.is_visible('[data-open]') else None; g.wait_for_timeout(300)
    ok('k3 Hide on that banner is remembered across reloads', not g.is_visible('#pAuto'))
    g.click('#pShop'); g.wait_for_timeout(300)
    ok('k4 picker shows the name once (no extra For project line)', g.is_visible('#shopPick') and not g.is_visible('#shopProj'))
    g.click('#askPipBtn'); g.wait_for_timeout(150); nb = g.locator('#askPip [data-ffnext]'); lbl = nb.inner_text()
    nb.click(); g.wait_for_timeout(200)
    ok('k5 Ask Pip on Shopping with a project: Copy, download or print, and it goes there', lbl == 'Copy, download or print' and g.evaluate("document.activeElement.id") == 'pCopy', (lbl, g.evaluate("document.activeElement.id")))
    g = page(seed([])); g.click('#tabProjects'); t = g.inner_text('#projList')
    ok('k6 empty Projects says Find floss tab, no italics', 'Find floss tab' in t and g.locator('#projList i').count() == 0, t)
    g.click('#newEmpty'); g.wait_for_timeout(300); ok('k7 Start an empty project defaults to My project', store(g)[-1]['name'] == 'My project')
    g = page(seed([])); paste_save(g, '310 x1')
    r = g.evaluate("(()=>{const i=document.getElementById('savedName').getBoundingClientRect(),b=document.getElementById('savedRename').getBoundingClientRect(),h=document.getElementById('savedNameHint').getBoundingClientRect();return{same:Math.abs((i.top+i.bottom)-(b.top+b.bottom))<8,hintBelow:h.top>=i.bottom-1,d:[i.top,i.bottom,i.right,b.top,b.bottom,b.left,getComputedStyle(document.querySelector('.ffrename')).display]}})()")
    ok('k8 Rename sits beside the name field and the hint is on its own line below', r['same'] and r['hintBelow'] and "Type a new name and tap Rename." in g.inner_text('#copymsg'), r)
    ok('k9 no "full pattern" left in Find floss help', 'full pattern' not in g.inner_text('body') + g.evaluate("document.querySelector('.pastehelp').textContent"))
    f = page(seed([])); f.goto(B + 'fabric.html?nosw'); f.wait_for_timeout(500)
    r = f.evaluate("(()=>{const c=document.querySelector('.ffterm[data-term=count]'),l=c.closest('label');return{inLabel:!!l,lab:l&&Math.abs(c.getBoundingClientRect().top-l.getBoundingClientRect().top)<14}})()")
    ok('k10 Fabric: count chip sits in the label line; tab says Shopping', r['inLabel'] and 'Shopping' in f.inner_text('.fcnav') and 'Shopping list' not in f.inner_text('.fcnav'), r)
    ok('w4 no page errors', not ERR, ERR[:3])
    print(f'{R[0]} passed, {R[1]} failed')
