#!/usr/bin/env python3
"""Projects tab scroll pass (ci005-59, simulated browser run): page height at 390/344 with realistic data,
collapsed sections open with one tap (mouse and keyboard), cautions stay visible on cards, no data written by toggles.
Usage: FF_KEY=flossfox-dev.v1 python tests/projects_scroll_e2e.py http://localhost:8812/floss-fox-dev/ [shot_dir]"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
SHOT = sys.argv[2] if len(sys.argv) > 2 else None
R = {'pass': 0, 'fail': 0}; errs = []; H = {}
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def mk(g, name, text):
    g.click('#tabConvert')
    if g.locator('#exitExample').is_visible(): g.click('#exitExample')
    g.fill('#inp', text); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(120)
    g.fill('#newProjName', name); g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(200)
    return g.evaluate("FlossFoxProjects.lastProject().id")
TXT = '\n'.join(f'{c} x{q}' for c, q in [('310',2),('321',1),('498',1),('666',1),('700',2),('725',1),('796',1),('820',1),('898',1),('3799',2),('3865',1),('B5200',1),('415',1),('762',1),('801',1)])
LS = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
HT = "Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)"
LIMIT = {390: 5900, 344: 6700}   # before: 9050 / 10608 (kit open); after ~5400 / ~6070
def vis(g, s): return g.evaluate(f"(()=>{{const e=document.querySelector({json.dumps(s)});return !!e&&e.checkVisibility()}})()")
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (390, 344):
        t = f'[{w}] '
        c = br.new_context(viewport={'width': w, 'height': 844}, is_mobile=True, has_touch=True)
        g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); g.evaluate("localStorage.clear()"); g.reload(); g.wait_for_load_state('networkidle')
        g.evaluate("FlossFoxThreadsUI.replaceAll({threads:{'310':{n:4},'898':{n:1},'321':{n:2},'700':{n:1},'B5200':{n:1}}})")
        a = mk(g, 'Spring Fox', TXT); mk(g, 'Winter Owl', '310 x3\n820 x1\n3865 x2'); mk(g, 'Tiny Mushroom', '321 x1\n700 x1')
        g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(300)
        ok(t + 'kit closed by default on open', g.evaluate("document.getElementById('pKit').open") is False)
        g.evaluate("FlossFoxProjects.showView('shop')"); g.wait_for_timeout(200); g.click('#pKit > summary'); g.wait_for_timeout(100)
        ok(t + 'kit opens with one tap', g.evaluate("document.getElementById('pKit').open") is True)
        for s in ('[data-kadd="310"]', '[data-kadd="321"]'):
            if g.locator(s).count(): g.click(s); g.wait_for_timeout(200)
        g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(200); g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(300)
        g.evaluate("document.getElementById('pKit').open=false"); g.wait_for_timeout(100)
        ok(t + 'Pip banner shown (Pip checked your threads)', vis(g, '#pAuto'))
        ok(t + 'Pip banner: Undo and Hide visible in the short view', vis(g, '#pAutoUndo') and vis(g, '#pAutoHide'))
        mo = g.locator('#pAutoMore')
        ok(t + 'Pip banner expander closed: "See what Pip filled in", aria-expanded=false, details hidden',
           mo.inner_text().strip() == 'See what Pip filled in' and mo.get_attribute('aria-expanded') == 'false' and not vis(g, '#pAutoDet'), mo.inner_text())
        ok(t + 'Ask Pip / Pip: exactly one following Pip', g.evaluate("document.querySelectorAll('.pip-follow,#pipFollow,[data-pip-follow]').length") <= 1)
        ok(t + 'no duplicate Next buttons after the comparison', g.locator('#pNextCmp, #pNextReady').count() == 0)
        ok(t + 'Shop my list header button still there', vis(g, '#pShop'))
        ok(t + 'comparison collapsed to its heading and counts', g.evaluate("document.getElementById('pCmpBox').open") is False and vis(g, '#cmpOwned') and vis(g, '#cmpMissing') and not vis(g, '#pUseColl'))
        ok(t + 'no "why" line visible on cards without a caution', g.evaluate("[...document.querySelectorAll('#pCards .why')].every(e=>!e.checkVisibility())"))
        h = g.evaluate(HT); H[w] = h
        ok(t + f'page height {h}px ({h/844:.2f} screens) under {LIMIT[w]}', h < LIMIT[w], h)
        if SHOT: g.screenshot(path=f'{SHOT}/projects-{w}-full.png', full_page=True)
        before = g.evaluate(LS)
        # one tap opens each, keyboard too
        g.click('#pAutoMore'); g.wait_for_timeout(80)
        ok(t + 'Pip banner opens with one tap: "Hide details", aria-expanded=true, details shown', mo.inner_text().strip() == 'Hide details' and mo.get_attribute('aria-expanded') == 'true' and vis(g, '#pAutoDet'))
        g.focus('#pAutoMore'); g.keyboard.press('Enter'); g.wait_for_timeout(80)
        ok(t + 'Pip banner closes with Enter key', mo.get_attribute('aria-expanded') == 'false' and not vis(g, '#pAutoDet'))
        g.keyboard.press('Space'); g.wait_for_timeout(80)
        ok(t + 'Pip banner opens with Space key', mo.get_attribute('aria-expanded') == 'true')
        g.click('#pCmpBox > summary'); g.wait_for_timeout(80)
        ok(t + 'comparison opens with one tap and shows Use my collection', g.evaluate("document.getElementById('pCmpBox').open") is True and vis(g, '#pUseColl'))
        g.focus('#pCmpBox > summary'); g.keyboard.press('Enter'); g.wait_for_timeout(80)
        ok(t + 'comparison closes with Enter key', g.evaluate("document.getElementById('pCmpBox').open") is False)
        g.keyboard.press('Enter'); g.wait_for_timeout(80)
        g.evaluate("FlossFoxProjects.showView('shop');document.getElementById('pKit').open=false"); g.wait_for_timeout(150)
        g.focus('#pKit > summary'); g.keyboard.press('Enter'); g.wait_for_timeout(80)
        ok(t + 'kit opens with Enter key', g.evaluate("document.getElementById('pKit').open") is True)
        g.evaluate("FlossFoxProjects.showView('projects')"); g.evaluate(f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(300)
        g.click('#x-310'); g.wait_for_timeout(120)
        ok(t + 'why sentence is in Details with no heading', vis(g, '#det-310 > .why') and g.evaluate("!document.querySelector('#det-310 > .why').previousElementSibling||!/^H\\d$/.test(document.querySelector('#det-310 > .why').previousElementSibling.tagName)"))
        ok(t + 'toggling sections wrote no data', g.evaluate(LS) == before)
        if SHOT and w == 390: g.evaluate("window.scrollTo(0,0)"); g.screenshot(path=f'{SHOT}/projects-390-opened-full.png', full_page=True)
        # flow tab "Check my threads" opens the comparison
        g.click('#pCmpBox > summary'); g.wait_for_timeout(60)
        fl = g.locator('#pFlow [data-flow="cmp"]')
        if fl.count(): fl.first.click(); g.wait_for_timeout(120); ok(t + 'Check my threads step opens the comparison', g.evaluate("document.getElementById('pCmpBox').open") is True)
        # cautions: visible short note on card, full sentence in Details
        b = mk(g, 'Caution', '310 x1\nB5200 x1\n3865 x1'); g.evaluate(f"FlossFoxProjects.open({json.dumps(b)})"); g.wait_for_timeout(300)
        if not g.evaluate("document.getElementById('pDetails').open"): g.click('#pDetails > summary')
        g.select_option('#pDest', 'anchor'); g.wait_for_timeout(300)
        cards = g.evaluate("[...document.querySelectorAll('#pCards .tcard')].map(c=>({id:c.id,kind:c.className,caut:c.querySelector('.caut')&&c.querySelector('.caut').checkVisibility()?c.querySelector('.caut').textContent:null,why:(c.querySelector('.tdet .why')||{}).textContent||'',pill:(c.querySelector('.stat')&&c.querySelector('.stat').checkVisibility()?c.querySelector('.stat').textContent.replace(/^\\S+\\s+/,'').trim():null)}))")
        m = [x for x in cards if 'k-match' in x['kind']]
        ok(t + 'uncertain substitution: exactly one of pill "Confirm the color match" / label "Check this match" visible', m and all((x['pill'] == 'Confirm the color match') + (x['caut'] == 'Check this match') == 1 for x in m), cards)
        ok(t + 'card with "Confirm the color match" pill hides "Check this match" label', all(x['caut'] is None for x in cards if x['pill'] == 'Confirm the color match'), cards)
        ok(t + 'uncertain substitution: full sentence still in Details', m and all('Anchor' in x['why'] for x in m), cards)
        ok(t + 'no caution note on plain cards', all(x['caut'] is None for x in cards if 'k-match' not in x['kind'] and 'k-other' not in x['kind'] and 'k-estimate' not in x['kind']), cards)
        if SHOT and w == 344:
            el = g.locator('#pCards .tcard.k-match').first; el.scroll_into_view_if_needed(); el.screenshot(path=f'{SHOT}/caution-344.png')
        g.select_option('#pDest', 'sullivans'); g.wait_for_timeout(300)
        o = g.evaluate("[...document.querySelectorAll('#pCards .tcard.k-other')].map(c=>[(c.querySelector('.caut')||{}).textContent,(c.querySelector('.tdet .why')||{}).textContent,c.querySelector('.stat').textContent])")
        ok(t + 'no-match brand caution visible ("Check this match") (no match pill) when a color has no Sullivans match', all(x[0] == 'Check this match' and x[1] and 'Confirm the color match' not in x[2] for x in o), o)
        nb = mk(g, 'NoMatch', '10 x1\n310 x1'); g.evaluate(f"FlossFoxProjects.open({json.dumps(nb)})"); g.wait_for_timeout(300)
        if not g.evaluate("document.getElementById('pDetails').open"): g.click('#pDetails > summary')
        g.select_option('#pDest', 'anchor'); g.wait_for_timeout(300); g.check('#st-10-buy'); g.wait_for_timeout(300)
        nm = g.evaluate("(()=>{const c=document.getElementById('card-10');return [c.querySelector('.stat').textContent,c.querySelector('.caut')&&c.querySelector('.caut').checkVisibility()?c.querySelector('.caut').textContent:null]})()")
        ok(t + 'card without the Confirm the color match pill keeps "Check this match" label', 'Confirm the color match' not in nm[0] and nm[1] == 'Check this match', nm)
        cm = g.evaluate("FlossFoxProjects._caut")
        ok(t + 'Pixel ci005-60 label wording', cm.get('partial') == 'Partial skein, check how much is left' and cm.get('recv') == 'Another brand is checked in', cm)
        cm = g.evaluate("FlossFoxProjects._caut")
        ok(t + 'caution labels defined', set(cm) == {'match', 'estimate', 'partial', 'have', 'recv'}, cm)
        c.close()
    ok('no page errors', not errs, errs[:3])
    print('heights:', json.dumps(H))
    print(f"\n{R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
