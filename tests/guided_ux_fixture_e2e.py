"""Fixture-only browser checks for guided-ux.js. They do NOT establish live-app regression results.
Usage: python3 -m http.server 8765 (from package root), then
       python3 tests/guided_ux_fixture_e2e.py http://127.0.0.1:8765/
"""
import json, sys, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
fixture_path = Path(__file__).parent/'fixtures/guided_ux_fixture.html'
fixture = fixture_path.read_text(encoding='utf-8').replace('<link rel="stylesheet" href="../../guided-ux/guided-ux.css">','').replace('<script src="../../guided-ux/guided-ux.js"></script>','')
project_root = Path(__file__).parent.parent
def find_asset(filename):
    for candidate in (project_root/'guided-ux'/filename, project_root/filename):
        if candidate.is_file():return candidate.read_text(encoding='utf-8')
    raise FileNotFoundError(filename)
style = find_asset('guided-ux.css')
script = find_asset('guided-ux.js')
def show(page, scenario=None):
    page.set_content(fixture, wait_until='load')
    if scenario=='saved':page.evaluate("window.__fixture.stores.projects=[{id:'finished',status:'done',name:'Already done',updated:'2026-10-11'},{id:'active',status:'progress',name:'Forest Sampler',updated:'2026-11-15'}]")
    elif scenario=='finished':page.evaluate("window.__fixture.stores.projects=[{id:'finished',status:'done',name:'Already done',updated:'2026-10-11'}]")
    elif scenario=='unsafe':page.evaluate("window.__fixture.stores.projects=[{id:'active',status:'progress',name:'<img src=x onerror=alert(1)>',updated:'2026-11-15'}]")
    page.add_style_tag(content=style)
    page.add_script_tag(content=script)
passed = failed = 0

def check(label, result, extra=''):
    global passed, failed
    passed += bool(result)
    failed += not bool(result)
    print(('PASS ' if result else 'FAIL ') + label + ((' -> '+str(extra)[:150]) if not result and extra else ''))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium') or None, args=['--no-sandbox'])
    for width in [360, 390, 768, 1280]:
        context=browser.new_context(viewport={'width':width,'height':900})
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        show(page)
        page.locator('#ffuxNavMore').wait_for()
        check(f'{width}: exactly 3 primary choices',page.locator('#ffLanding nav.choices > a.ch').count()==3)
        check(f'{width}: labels are task-oriented','Find colors for a pattern' in page.locator('#ffLanding nav.choices').inner_text())
        check(f'{width}: approved Pip greeting unchanged',page.locator('#ffLandSay').inner_text()=="Hi! I'm Pip. What are we stitching up today?")
        check(f'{width}: original tour remains',page.locator('#ffLandTour').count()==1)
        check(f'{width}: secondary cards closed',not page.locator('#ffLanding a[data-tab="tabShop"]').is_visible())
        page.locator('#ffuxLandingTools summary').click()
        check(f'{width}: Shop reachable',page.locator('#ffLanding a[data-tab="tabShop"]').is_visible())
        check(f'{width}: Fabric reachable',page.locator('#ffLanding a[data-tab="tabFabric"]').is_visible())
        page.locator('#ffuxNavSummary').click()
        check(f'{width}: all original secondary tabs accessible',all(page.locator('#'+s).is_visible() for s in ('tabShop','tabFabric','tabHelp','tabSettings')))
        page.locator('#tabShop').click()
        check(f'{width}: old tab navigation works',page.locator('#viewStatus').inner_text()=='tabShop')
        check(f'{width}: selected secondary indicated', 'Shopping' in page.locator('#ffuxNavSummary').inner_text())
        check(f'{width}: no errors',not errors,errors)
        context.close()
    ctx=browser.new_context(viewport={'width':390,'height':850})
    page=ctx.new_page();show(page,'saved')
    before=page.evaluate('JSON.stringify(window.__fixture.stores)')
    check('returning user: resume button shown',page.locator('#ffuxResume').is_visible())
    check('returning user: next unfinished project', 'Forest Sampler' in page.locator('#ffuxResume').inner_text())
    check('returning user: no data change on arrival',before==page.evaluate('JSON.stringify(window.__fixture.stores)'))
    page.locator('#ffuxResume').click()
    check('returning user: existing project-open API used',page.evaluate('window.__fixture.opened')==['active'])
    check('returning user: project editor opens',page.locator('#projEdit').is_visible())
    check('returning user: no data change on navigation',before==page.evaluate('JSON.stringify(window.__fixture.stores)'))
    check('idempotency',page.evaluate('window.FlossFoxGuidedUX.boot(); document.querySelectorAll("#ffuxNavMore").length')==1)
    ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':850});page=ctx.new_page();show(page,'finished')
    check('only finished projects: no resume',page.locator('#ffuxResume').count()==0)
    ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':850});page=ctx.new_page();show(page,'unsafe')
    check('malicious project title: rendered as text, not HTML', page.locator('#ffuxResume img').count()==0 and '<img src=x onerror=alert(1)>' in page.locator('#ffuxResume').inner_text())
    ctx.close()
    browser.close()
print(f'\n{passed} passed / {failed} failed')
sys.exit(1 if failed else 0)
