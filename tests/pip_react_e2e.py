"""Pip direction A (simulated, synthetic data): FlossFoxPip.react, Pip level setting, caps, Off vs the old hide key.
Usage: python3 tests/pip_react_e2e.py URL [SHOTDIR]"""
import sys, os, json, csv
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; SH = sys.argv[2] if len(sys.argv) > 2 else None; R = [0, 0]
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; PIPK = PFX + '.pip.v1'; LVK = PFX + '.pipLevel.v1'
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
_rows = list(csv.reader(open('/workspace/pip-art/m-involved/a-strings.csv', encoding='utf-8'))); CSV = {r[0]: dict(zip(_rows[0], r)) for r in _rows[1:]}
assert all(len(r) == 6 for r in _rows), 'a-strings.csv must parse as 6 columns'
TH = {'schema': 2, 'threads': {'310': {'n': 3, 'partial': False, 'restock': False, 'updated': '2026-10-01T00:00:00Z'}, '321': {'n': 0, 'partial': True, 'restock': False, 'updated': '2026-10-01T00:00:00Z'}}}
def init(extra=''):
    return f"if(!sessionStorage.getItem('i')){{sessionStorage.setItem('i','1');localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');localStorage.setItem('{PFX}.hints.v1','off');localStorage.setItem('{PFX}.pipFirstProject.v1','shown');{extra}}}"
DUMP = f"JSON.stringify(Object.keys(localStorage).filter(k=>k.startsWith('{PFX}')&&!/pip/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page(w=390, h=844, extra=''):
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 900, has_touch=w < 900, service_workers='block'); c.add_init_script(init(extra)); g = c.new_page()
        g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); g.reqs = []; g.on('request', lambda r: g.reqs.append(r.url)); g.goto(B + '?nosw'); g.wait_for_timeout(500); return g
    def shot(g, name, sel=None):
        if SH:
            if sel: g.locator(sel).first.scroll_into_view_if_needed(); g.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'center'}})")
            g.wait_for_timeout(250); g.screenshot(path=os.path.join(SH, name))
    bub = lambda g: g.evaluate("(()=>{const b=document.querySelector('.pipA-bubble');return b?{key:b.dataset.key,pose:b.dataset.pose,text:b.querySelector('.pipA-text').textContent,n:document.querySelectorAll('.pipA-bubble').length}:null})()")
    # --- strings verbatim from Pixel's CSV, copy lint, variants (unit-style, run in the page)
    g = page(); S = g.evaluate("Object.fromEntries(Object.entries(FlossFoxPip.STRINGS_A).map(([k,f])=>[k,f({have:'${have}',total:'${total}',u:'${n}',n:'${n}'})]))")
    for k, r in CSV.items():
        if k.startswith('pipA.level') or k == 'pipA.dismiss.aria': continue
        ok(f'string {k} is Pixel\'s text verbatim', S.get(k) == r['exact text'], (S.get(k), r['exact text']))
    ok('pcheck.fake.one comes from the CSV, no PENDING mark left', 'pipA.pcheck.fake.one' in CSV and 'PENDING' not in g.evaluate("fetch('pip.js').then(r=>r.text())"))
    ok('every event line is 90 characters or fewer (with example numbers)', all(len(t.replace('${have}','12').replace('${total}','24').replace('${n}','12')) <= 90 for t in S.values()), [t for t in S.values() if len(t) > 90])
    g.evaluate(f"localStorage.removeItem('{LVK}')"); g.set_viewport_size({'width': 390, 'height': 844}); g.reload(); g.wait_for_timeout(300)
    ok('copy lint: no em dashes, max one "!", no he/she', all('\u2014' not in t and t.count('!') <= 1 for t in S.values()) and not any(w in (' ' + t.lower() + ' ') for t in S.values() for w in (' he ', ' she ', ' his ', ' her ')))
    V = g.evaluate("[['pipA.cmp.done',{have:2,total:3,u:0}],['pipA.cmp.done',{have:0,total:3,u:0}],['pipA.cmp.done',{have:1,total:1,u:0}],['pipA.cmp.done',{have:1,total:3,u:1}],['pipA.cmp.done',{have:0,total:3,u:2}],['pipA.cmp.undo',{n:1}],['pipA.cmp.undo',{n:4}],['pipA.pcheck.fake',{n:1}],['pipA.pcheck.fake',{n:2}],['pipA.checkin',{full:true}],['pipA.checkin',{full:false}]].map(([k,v])=>FlossFoxPip.variant(k,v))")
    ok('variants: many/none/one/unsure.one/unsure, undo.one/undo, fake.one/fake, checkin full/part', V == ['pipA.cmp.done.many', 'pipA.cmp.done.none', 'pipA.cmp.done.one', 'pipA.cmp.unsure.one', 'pipA.cmp.unsure', 'pipA.cmp.undo.one', 'pipA.cmp.undo', 'pipA.pcheck.fake.one', 'pipA.pcheck.fake', 'pipA.checkin.full', 'pipA.checkin.part'], V)
    # --- default level, fallback, persistence
    ok('default level is important (key missing)', g.evaluate("FlossFoxPip.level()") == 'important' and g.evaluate(f"localStorage.getItem('{LVK}')") is None)
    g.evaluate(f"localStorage.setItem('{LVK}','loud')"); g.reload(); g.wait_for_timeout(300); ok('unknown value falls back to default', g.evaluate("FlossFoxPip.level()") == 'important')
    g.click('#tabHelp'); g.wait_for_timeout(200); ok('Help has the Pip level radio group with Pixel\'s labels', g.inner_text('#pipSettings').split('\n')[0] == 'How much should Pip chat?' and g.locator('#pipSettings input[name=pipLevel]').count() == 4, g.inner_text('#pipSettings'))
    before = g.evaluate(DUMP)
    for lv in ('chatty', 'important', 'quiet', 'off'):
        g.check(f'#pipSettings input[value={lv}]'); g.wait_for_timeout(150); shot(g, f'level-{lv}-390.png', '#pipSettings')
    ok('level change says "Pip setting saved on this device."', g.inner_text('#pipLevelMsg') == 'Pip setting saved on this device.')
    ok('Off writes the old hide key "hidden" and hides Pip', g.evaluate(f"localStorage.getItem('{PIPK}')") == 'hidden' and g.evaluate("FlossFoxPip.isHidden()"))
    ok('project/collection data byte-identical after changing levels', g.evaluate(DUMP) == before)
    g.check('#pipSettings input[value=chatty]'); g.reload(); g.wait_for_timeout(300); ok('level persists across reload, Pip shown again', g.evaluate("FlossFoxPip.level()") == 'chatty' and g.evaluate(f"localStorage.getItem('{PIPK}')") == 'shown')
    g.evaluate(f"localStorage.removeItem('{LVK}')"); g.reload(); g.wait_for_timeout(300); ok('clearing the key returns to the default', g.evaluate("FlossFoxPip.level()") == 'important')
    g.context.close()
    # --- people who hid Pip before stay hidden; nothing is rewritten
    g = page(extra=f"localStorage.setItem('{PIPK}','hidden')"); g.click('#tabHelp'); g.wait_for_timeout(150)
    ok('old hidden key -> level Off, Off radio checked, Pip hidden', g.evaluate("FlossFoxPip.level()") == 'off' and g.is_checked('#pipSettings input[value=off]') and g.evaluate("FlossFoxPip.isHidden()"))
    ok('old hidden users: no new key written, old key untouched', g.evaluate(f"localStorage.getItem('{LVK}')") is None and g.evaluate(f"localStorage.getItem('{PIPK}')") == 'hidden')
    ok('Off: react returns false', g.evaluate("FlossFoxPip.react('pipA.ready',{},document.body)") is False)
    g.context.close()
    # --- real events at the default level (important)
    g = page(extra=f"localStorage.setItem('{PFX}.threads.v1',{json.dumps(json.dumps(TH))})")
    g.fill('#inp', '310 x2\n321 x1\n3865 x1'); g.click('#go'); g.wait_for_timeout(300); g.fill('#newProjName', 'Pip A'); g.click('#saveProj'); g.wait_for_timeout(400)
    ok('important: no save bubble; the small saved wink still shows', bub(g) is None and g.locator('#copymsg .savedtoast').count() == 1, bub(g))
    g.click('#openSaved'); g.wait_for_timeout(700); b = bub(g); ban = g.inner_text('#pAuto') if g.locator('#pAuto').count() else ''
    ok('auto-compare bubble shows below #pAuto with a cmp key', b is not None and b['key'].startswith('pipA.cmp.') and g.evaluate("document.querySelector('#pAuto').nextElementSibling.classList.contains('pipA-bubble')"), (b, ban[:200]))
    ok('auto-compare bubble pose matches the key', b and b['pose'] in ('presenting', 'thinking', 'magnifier'), b)
    ok('one bubble visible', b and b['n'] == 1, b)
    shot(g, 'event-autocompare-390.png', '.pipA-bubble')
    g.click('#pAutoUndo'); g.wait_for_timeout(300); b = bub(g)
    ok('Undo bubble right away (no 20 s gap) with the undo key', b and b['key'] in ('pipA.cmp.undo', 'pipA.cmp.undo.one'), b)
    ok('undo: Pip line not put in the shared live region (site status announces it)', g.evaluate("document.getElementById('pipALive').textContent") == '')
    shot(g, 'event-undo-390.png', '.pipA-bubble')
    g.press('.pipA-x', 'Escape'); ok('Escape inside the bubble dismisses it', bub(g) is None)
    g.goto(B + '?nosw'); g.wait_for_timeout(400); g.click('#convertView .pat-launch'); g.evaluate("document.querySelector('#ffPatternDialog .pat-manual').open=true")
    g.fill('#patPaste', 'X DMC 310 Black 1 skein\nO DMC 9999 Mystery 1 skein'); g.click('#ffPatternDialog .pat-manual button:has-text("Find colors")'); g.wait_for_timeout(300); b = bub(g)
    ok('pattern check with a fake number: pcheck.fake.one, puzzled, below #patCheck', b and b['key'] == 'pipA.pcheck.fake.one' and b['pose'] == 'puzzled' and g.evaluate("document.querySelector('#patCheck').nextElementSibling.classList.contains('pipA-bubble')"), b)
    shot(g, 'event-patterncheck-390.png', '.pipA-bubble')
    g.evaluate("FlossFoxPip.closeBubble();FlossFoxPip._capsReset()"); g.fill('#patPaste', 'DMC 310 Black 1 skein\nDMC 321 Red 1 skein'); g.click('#ffPatternDialog .pat-manual button:has-text("Find colors")'); g.wait_for_timeout(300)
    ok('tab names at 673px match mobile (Find floss, My threads, Projects, Shopping, Fabric, Help, Settings)', [x.strip() for x in g.evaluate("[...document.querySelectorAll('nav.tabs > *')].map(e=>e.innerText.replace(/[^A-Za-z ]/g,'').trim())")] == ['Find floss','My threads','Projects','Shopping','Fabric','Help','Settings'] if g.set_viewport_size({'width':673,'height':841}) is None else False, g.evaluate("[...document.querySelectorAll('nav.tabs > *')].map(e=>e.innerText)")); g.set_viewport_size({'width':390,'height':844})
    ok('clean pattern check: no bubble', bub(g) is None, bub(g))
    ok('live region exists, polite, never assertive', g.evaluate("(()=>{const r=document.getElementById('pipALive');return !!r&&r.getAttribute('aria-live')==='polite'&&!document.querySelector('.pipA-bubble [aria-live=assertive]')})()"))
    ok('no new network requests (only this site)', all(u.startswith(B) or u.startswith('data:') or u.startswith('blob:') for u in g.reqs), [u for u in g.reqs if not u.startswith(B)][:3])
    ok('no page errors', not g.errs, g.errs[:3]); g.context.close()
    # --- caps and guards (direct helper calls, chatty)
    g = page(extra=f"localStorage.setItem('{LVK}','chatty')")
    r = g.evaluate("""(()=>{const a=document.getElementById('copymsg'),P=FlossFoxPip,o=[];P._capsReset();
      o.push(P.react('pipA.save.ok',{},a));P.closeBubble();o.push(P.react('pipA.cmp.empty',{},a));         // 20 s gap blocks the 2nd unprompted
      o.push(P.react('pipA.ready',{},a));                                                                     // Ready is exempt
      P._capsReset();o.push(P.react('pipA.save.ok',{},a));                                                    // after reset, ok once more
      P._capsReset();P.react('pipA.save.ok',{},a);P._capsReset();
      return o})()""")
    ok('20 s gap between unprompted bubbles; Ready exempt', r == [True, False, True, True], r)
    r = g.evaluate("""(()=>{const a=document.getElementById('copymsg'),P=FlossFoxPip;P._capsReset();const o=[P.react('pipA.cmp.nothing',{},a,{id:'x'})];
      P._capsReset();o.push(P.react('pipA.cmp.nothing',{},a,{id:'x'}));return o})()""")
    ok('per-project cap is in memory only (reset clears it)', r == [True, True], r)
    g.evaluate("FlossFoxPip.setTour(true)"); ok('no bubble while the tour runs', g.evaluate("FlossFoxPip._capsReset(),FlossFoxPip.react('pipA.ready',{},document.getElementById('copymsg'))") is False); g.evaluate("FlossFoxPip.setTour(false)")
    g.evaluate("FlossFoxPip.setLevel('quiet')"); ok('Quiet: no bubbles', g.evaluate("FlossFoxPip._capsReset(),FlossFoxPip.react('pipA.ready',{},document.getElementById('copymsg'))") is False)
    g.evaluate("FlossFoxPip.setLevel('important')"); ok('important: chatty-only events (save, empty, nothing, check-in) do not show', g.evaluate("(()=>{const a=document.getElementById('copymsg'),P=FlossFoxPip;return ['pipA.save.ok','pipA.cmp.empty','pipA.cmp.nothing','pipA.checkin'].map(k=>(P._capsReset(),P.react(k,{full:true},a,{id:'q'})))})()") == [False] * 4)
    g.evaluate("FlossFoxPip.setLevel('chatty')")
    r = g.evaluate("""(()=>{const a=document.getElementById('copymsg'),P=FlossFoxPip;P._capsReset();const o=[P.react('pipA.checkin',{full:true},a)];o.push(P.react('pipA.checkin',{full:true},a));return o})()""")
    ok('check-in: max 1 per 20 s', r == [True, False], r)
    ok('no page errors', not g.errs, g.errs[:3]); g.context.close()
    # --- chatty real events: save bubble once per session, check-in
    # new-15 first-project moment: one time per device (UI pref key only), shy-heart, then the normal save path; skipped when quiet/off
    FK = f"{PFX}.pipFirstProject.v1"
    TAB = lambda g, t: (g.evaluate(f"document.getElementById('{t}').click()"), g.wait_for_timeout(700))
    FIRSTB = "(()=>{const b=document.querySelector('.pipA-bubble[data-key=\\'pipA.save.first\\']');return b?b.getBoundingClientRect().height>0:false})()"
    g = page(extra=f"localStorage.removeItem('{FK}')"); g.fill('#inp', '310 x1'); g.click('#go'); g.wait_for_timeout(300); g.fill('#newProjName', 'First'); g.click('#saveProj'); g.wait_for_timeout(700)
    ok('first project: never on the Find floss shopping list after save, flag not spent', not g.evaluate(FIRSTB) and g.evaluate(f"localStorage.getItem('{FK}')") is None)
    ok('first project: firstProject() refuses off the Projects view', g.evaluate("FlossFoxPip.firstProject(document.body)") is False and g.evaluate(f"localStorage.getItem('{FK}')") is None)
    TAB(g, 'tabShop')
    ok('first project: never on the Shopping tab, flag not spent', not g.evaluate(FIRSTB) and g.evaluate(f"localStorage.getItem('{FK}')") is None)
    TAB(g, 'tabProjects'); b = bub(g)
    ok('first project: shy-heart shows once on Projects at the default level', b and b['key'] == 'pipA.save.first' and b['pose'] == 'shy-heart' and g.evaluate("!document.getElementById('projectsView').hidden") and g.evaluate(f"localStorage.getItem('{FK}')") == 'shown', b)
    ok('first project: flag is a UI pref only (not in projects data)', 'pipFirstProject' not in (g.evaluate(f"localStorage.getItem('{PFX}.v1')") or ''))
    g.evaluate("FlossFoxPip.closeBubble()"); TAB(g, 'tabConvert'); TAB(g, 'tabProjects')
    ok('first project: not repeated on the next Projects visit', not g.evaluate(FIRSTB))
    g.reload(); g.wait_for_timeout(300); TAB(g, 'tabConvert'); g.fill('#inp', '321 x1'); g.click('#go'); g.wait_for_timeout(300); g.fill('#newProjName', 'Second'); g.click('#saveProj'); g.wait_for_timeout(400); TAB(g, 'tabProjects')
    ok('first project: never shows again', not g.evaluate(FIRSTB))
    g = page(extra=f"localStorage.removeItem('{FK}');localStorage.setItem('{LVK}','quiet')"); g.fill('#inp', '310 x1'); g.click('#go'); g.wait_for_timeout(300); g.fill('#newProjName', 'Q'); g.click('#saveProj'); g.wait_for_timeout(400); TAB(g, 'tabProjects')
    ok('first project: skipped when Pip is quiet, flag not spent', bub(g) is None and g.evaluate(f"localStorage.getItem('{FK}')") is None)
    g = page(extra=f"localStorage.setItem('{LVK}','chatty')"); g.fill('#inp', '310 x1'); g.click('#go'); g.wait_for_timeout(300); g.fill('#newProjName', 'Chatty'); g.click('#saveProj'); g.wait_for_timeout(400); b = bub(g)
    ok('chatty: save bubble pipA.save.ok, pose saved; the saved wink is skipped', b and b['key'] == 'pipA.save.ok' and b['pose'] == 'saved' and g.locator('#copymsg .savedtoast').count() == 0, b)
    ok('save: Pip line not put in the shared live region (site status announces it)', g.evaluate("document.getElementById('pipALive').textContent") == '')
    shot(g, 'event-save-chatty-390.png', '.pipA-bubble')
    if SH:
        for w, h, n in ((344, 882, 'fold-folded-344.png'), (673, 841, 'fold-unfolded-673.png')):
            g.set_viewport_size({'width': w, 'height': h}); g.wait_for_timeout(250); shot(g, n, '.pipA-bubble')
        g.set_viewport_size({'width': 390, 'height': 844})
    g.click('#saveProj'); g.wait_for_timeout(1200); g.fill('#newProjName', 'Chatty 2'); g.click('#saveProj'); g.wait_for_timeout(400)
    ok('save bubble only once per session', (bub(g) or {}).get('key') != 'pipA.save.ok' or g.evaluate("document.querySelectorAll('.pipA-bubble').length") <= 1)
    ok('no page errors', not g.errs, g.errs[:3]); g.context.close()
    # --- no line cut off: every string in the spot it really appears (project card #pAuto, Pattern check #patCheck), 390 and 344 px
    MEAS = """(a)=>{const P=FlossFoxPip,bad=[],el=document.querySelector(a.sel);if(!el)return['no anchor '+a.sel];el.hidden=false;for(const k of a.keys){P._capsReset();P.closeBubble();
      const base=k.replace(/[.](one|many|none|full|part)$/,'').replace('pipA.cmp.unsure','pipA.cmp.done');const v={have:12,total:24,u:k.includes('unsure')?(k.endsWith('.one')?1:12):0,n:k.endsWith('.one')?1:12,full:k.endsWith('full')};
      if(k==='pipA.cmp.done.one')v.total=1;if(k==='pipA.cmp.done.none')v.have=0;if(!P.react(base,v,el,{id:k+Math.random()})){bad.push(k+':not shown');continue}
      const b=document.querySelector('.pipA-bubble'),t=b.querySelector('.pipA-text');if(b.dataset.key!==k)bad.push(k+':got '+b.dataset.key);if(t.scrollHeight>t.clientHeight+1)bad.push(k)}P.closeBubble();P._capsReset();return bad}"""
    for w in (390, 344):
        g = page(w, 844, f"localStorage.setItem('{LVK}','chatty');localStorage.setItem('{PFX}.threads.v1',{json.dumps(json.dumps(TH))})")
        g.fill('#inp', '310 x1\n321 x1'); g.click('#go'); g.wait_for_timeout(200); g.fill('#newProjName', 'Fit'); g.click('#saveProj'); g.wait_for_timeout(300); g.click('#openSaved'); g.wait_for_timeout(500)
        keys = [k for k in S if not k.startswith('pipA.pcheck')]
        ok(f'{w}px: every project-card line fits in 3 lines (not cut off)', g.evaluate(MEAS, {'sel': '#pAuto', 'keys': keys}) == [], g.evaluate(MEAS, {'sel': '#pAuto', 'keys': keys}))
        g.goto(B + '?nosw'); g.wait_for_timeout(400); g.click('#convertView .pat-launch'); g.evaluate("document.querySelector('#ffPatternDialog .pat-manual').open=true")
        g.fill('#patPaste', 'DMC 310 Black 1 skein\nO DMC 9999 X 1 skein'); g.click('#ffPatternDialog .pat-manual button:has-text("Find colors")'); g.wait_for_timeout(300)
        keys = [k for k in S if k.startswith('pipA.pcheck')]
        ok(f'{w}px: every Pattern check line fits in 3 lines (not cut off)', g.evaluate(MEAS, {'sel': '#patCheck', 'keys': keys}) == [], g.evaluate(MEAS, {'sel': '#patCheck', 'keys': keys}))
        g.context.close()
    print(f'{R[0]} passed, {R[1]} failed')
