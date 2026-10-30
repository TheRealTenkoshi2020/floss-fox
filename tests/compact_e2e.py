#!/usr/bin/env python3
"""Compact pass (ci005-77, simulated browser run): closed-by-default sections, auto-open rules,
compact thread and color rows, Kit in Shop, Help and Fabric expanders, keyboard, 44px targets.
Usage: FF_KEY=flossfox-dev.v1 python tests/compact_e2e.py http://localhost:8812/floss-fox-dev/"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
import sys, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def ev(g, s): return g.evaluate(s)
def vis(g, s): return ev(g, f"(()=>{{const e=document.querySelector({json.dumps(s)});return !!e&&e.checkVisibility()}})()")
def mk(g, name, text):
    g.click('#tabConvert')
    if g.locator('#exitExample').is_visible(): g.click('#exitExample')
    g.fill('#inp', text); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(120)
    g.fill('#newProjName', name); ev(g, "document.getElementById('saveProj').click()"); g.wait_for_timeout(250)
    return ev(g, "FlossFoxProjects.lastProject().id")
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    g = c.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
    g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); ev(g, "localStorage.clear()"); g.reload(); g.wait_for_load_state('networkidle')
    # Threads compact rows
    ev(g, "FlossFoxThreadsUI.replaceAll({threads:{'310':{n:4},'321':{n:1},'498':{n:1},'666':{n:1},'700':{n:1}}})")
    g.click('#tabThreads'); g.wait_for_timeout(200)
    tg = '#thList .thtog[data-tog]'
    ok('thread rows render a toggle button', g.locator(tg).count() >= 5, g.locator(tg).count())
    first = g.locator(tg).first; oid = first.get_attribute('aria-controls')
    ok('thread row starts closed (aria-expanded=false)', first.get_attribute('aria-expanded') == 'false')
    ok('thread options hidden when closed', not vis(g, '#' + oid))
    ok('stepper stays visible on compact row', g.locator('#thList .stepper').first.is_visible())
    ok('toggle is at least 44px tall', first.bounding_box()['height'] >= 44, first.bounding_box())
    ok('closed row says Edit, named Edit DMC', first.text_content().strip().endswith('Edit') and (first.get_attribute('aria-label') or '').startswith('Edit DMC'), first.text_content())
    ok('Edit chip has a 44px hit area', ev(g, "parseFloat(getComputedStyle(document.querySelector('#thList .thedit'),'::after').height)") >= 44)
    first.click(); g.wait_for_timeout(100)
    ok('tap opens the full card', first.get_attribute('aria-expanded') == 'true' and vis(g, '#' + oid))
    ok('open row says Done', first.text_content().strip().endswith('Done'), first.text_content())
    first.focus(); g.keyboard.press('Enter'); g.wait_for_timeout(100)
    ok('Enter closes it again', first.get_attribute('aria-expanded') == 'false' and not vis(g, '#' + oid))
    g.keyboard.press('Space'); g.wait_for_timeout(100)
    ok('Space opens it', first.get_attribute('aria-expanded') == 'true')
    # Projects
    a = mk(g, 'Spring Fox', '310 x1\n321 x1\n498 x1\n666 x1\n700 x1\n725 x1\n796 x1')
    ev(g, f"FlossFoxProjects.open({json.dumps(a)})"); g.wait_for_timeout(300)
    ok('project details closed by default for a named project', ev(g, "document.getElementById('pDetails').open") is False)
    ok('Kit is not inside the project editor', ev(g, "!document.querySelector('#projEdit #pKit')"))
    ok('Kit link shown in the project', vis(g, '#pKitGo'), ev(g, "document.getElementById('pKitGo')&&document.getElementById('pKitGo').textContent"))
    ok('Kit link reads only "Kit this project (in Shop)"', (g.text_content('#pKitGo') or '').strip() == 'Kit this project (in Shop)', g.text_content('#pKitGo'))
    ok('answered colors show a compact row', g.locator('#pCards .tcard.cmp').count() >= 1, g.locator('#pCards .tcard.cmp').count())
    ht = g.locator('#pHaveTog')
    if ht.count():
        ok('have-enough colors are tucked behind a button', ht.get_attribute('aria-expanded') == 'false')
        n0 = ev(g, "[...document.querySelectorAll('#pCards .tcard')].filter(c=>!c.hidden).length")
        ht.click(); g.wait_for_timeout(150)
        n1 = ev(g, "[...document.querySelectorAll('#pCards .tcard')].filter(c=>!c.hidden).length")
        ok('Show button reveals them', n1 > n0 and g.locator('#pHaveTog').get_attribute('aria-expanded') == 'true', (n0, n1))
    else:
        ok('fewer than 3 have-enough colors: nothing tucked', ev(g, "[...document.querySelectorAll('#pCards .tcard')].every(c=>!c.hidden)"))
    g.click('#pKitGo'); g.wait_for_timeout(400)
    ok('Kit link opens Shop with Kit open', vis(g, '#pKit') and ev(g, "document.getElementById('pKit').open") is True)
    ok('Kit lives in the Shop view', ev(g, "!!document.querySelector('#shopView #pKit')"))
    ev(g, "FlossFoxProjects.showView('projects')"); g.wait_for_timeout(200)
    # Help expanders
    g.click('#tabHelp') if g.locator('#tabHelp').count() else ev(g, "location.hash='#help'")
    g.wait_for_timeout(300)
    n = ev(g, "document.querySelectorAll('#helpView details.helpsec').length")
    ok('Help has five closed expanders', n == 5 and ev(g, "[...document.querySelectorAll('#helpView details.helpsec')].every(d=>!d.open)"), n)
    ok('Pip level setting lives in Pip section', ev(g, "!!document.querySelector('#helpPipSec #pipSettings')"))
    ok('Tour button stays visible', vis(g, '#helpTour'))
    s0 = g.locator('#helpView details.helpsec > summary').first
    ok('Help summary 44px tall', s0.bounding_box()['height'] >= 44, s0.bounding_box())
    s0.focus(); g.keyboard.press('Enter'); g.wait_for_timeout(100)
    ok('Help expander opens with keyboard', ev(g, "document.querySelector('#helpView details.helpsec').open") is True)
    ok('Help first expander reads How Floss Fox works', (s0.text_content() or '').strip().startswith('How Floss Fox works'), s0.text_content())
    ok('Help heading reads Help (not a copy of the first expander)', (ev(g, "document.querySelector('#helpView .helphead h2').textContent") or '').strip() == 'Help')
    ok('no "?" chip inside any summary (axe nested-interactive)', ev(g, "document.querySelectorAll('summary button, summary a, summary input').length") == 0)
    g.click('#tabSettings'); g.wait_for_timeout(200)
    ok('Settings has the Help link', (g.text_content('#setHelpLink') or '').strip() == 'See how Floss Fox works in Help')
    g.click('#setHelpLink'); g.wait_for_timeout(200)
    ok('Settings link opens Help', ev(g, "!document.getElementById('helpView').hidden") is True)
    ok('every visible summary is at least 44px', ev(g, "[...document.querySelectorAll('summary')].filter(s=>s.getClientRects().length).every(s=>s.getBoundingClientRect().height>=43.5)") is True)
    ok('at most one Pip picture on screen', ev(g, "[...document.querySelectorAll('img[src*=\"assets/pip\"]')].filter(i=>i.checkVisibility()&&i.getBoundingClientRect().width>0).length") <= 1)
    ok('Pip note is not a fixed bar on phones', ev(g, "(()=>{const c=document.querySelector('.pipc');return !c||getComputedStyle(c).position!=='fixed'})()") is True)
    # Fabric
    g2 = c.new_page(); g2.on('pageerror', lambda e: errs.append('fabric: ' + str(e)))
    g2.goto(B + 'fabric.html'); g2.wait_for_load_state('networkidle')
    ok('Fabric how-it-works closed by default', ev(g2, "document.getElementById('fcHow').open") is False)
    g2.click('#fcHow > summary'); g2.wait_for_timeout(100)
    ok('Fabric how-it-works opens with one tap', ev(g2, "document.getElementById('fcHow').open") is True)
    ok('no page errors', not errs, errs)
    br.close()
print(f"{R['pass']} passed, {R['fail']} failed"); sys.exit(1 if R['fail'] else 0)
