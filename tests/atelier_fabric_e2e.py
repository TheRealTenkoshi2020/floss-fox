#!/usr/bin/env python3
"""3.9 Atelier Stage E: fabric diagram from compute() only, named presets, cutting slip.
SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: python3 tests/atelier_fabric_e2e.py http://localhost:PORT/
"""
import sys, os, json, re
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    g = ctx.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    g.goto(B + 'fabric.html?nosw'); g.wait_for_function('window.FlossFoxFabric&&window.FlossFoxFabricUI'); g.wait_for_timeout(200)

    ok('default cut and design are unchanged (16 x 13¼, 10 x 7.14)',
       g.inner_text('#fcCutNum') == '16″ × 13¼″' and g.inner_text('#fcDesNum') == '10″ × 7.14″',
       g.inner_text('#fcCutNum') + ' / ' + g.inner_text('#fcDesNum'))
    ok('diagram is drawn from compute() and is visible', g.locator('#fcDiagram svg').count() == 1 and g.locator('#fcDiagram').is_visible())
    dims = g.evaluate("""() => {
      const s=document.querySelector('#fcDiagram svg');
      return s ? {cw:+s.dataset.cutW, ch:+s.dataset.cutH, dw:+s.dataset.desW, dh:+s.dataset.desH, m:+s.dataset.margin} : null;
    }""")
    expected = g.evaluate("() => { const F=FlossFoxFabric, u=FlossFoxFabricUI.state(); return F.compute({w:140,h:100,count:14,over:1,marginIn:u.marginIn||3}); }")
    ok('diagram data attributes match compute() cut, design and margin',
       dims and dims['cw']==expected['cut']['w'] and dims['ch']==expected['cut']['h'] and dims['dw']==expected['design']['w'] and dims['dh']==expected['design']['h'] and dims['m']==expected['marginIn'],
       (dims, expected))
    aria = g.get_attribute('#fcDiagram', 'aria-label') or ''
    ok('diagram aria names the cut and stitched sizes', '16' in aria and ('13' in aria or '13¼' in aria or '13.25' in aria), aria)
    ok('diagram caption uses Pixel cut / stitched / margin labels',
       'Fabric to cut' in g.inner_text('#fcDiagram') and 'Stitched area' in g.inner_text('#fcDiagram'))
    ok('guide note is present', 'Cut by the measurements' in g.inner_text('#fcDiagNote'))
    g.screenshot(path=os.path.join(SHOTS, 'stageE-fabric-1280.png'), full_page=True)

    # invalid input clears the drawing
    g.fill('#fcW', '0'); g.wait_for_timeout(100)
    ok('invalid input hides the drawing and shows the invalid note',
       (not g.locator('#fcDiagram').is_visible() or g.locator('#fcDiagram svg').count()==0) and 'Fix the highlighted' in (g.inner_text('#fcDiagNote')+g.inner_text('#fcFix')))
    g.fill('#fcW', '140'); g.wait_for_timeout(150)
    ok('valid input restores the drawing', g.locator('#fcDiagram svg').count()==1)

    # named presets: fabric key only, no projects key
    before = g.evaluate("() => ({keys:Object.keys(localStorage).sort(), dump:Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])})")
    g.fill('#fcPresetName', 'My hoop 14-count')
    g.click('#fcPresetSave'); g.wait_for_timeout(150)
    ok('preset: saved status is shown', 'Preset saved' in g.inner_text('#fcMsg'))
    ok('preset: appears in the list', 'My hoop 14-count' in g.inner_text('#fcPresetList'))
    keys = g.evaluate("() => Object.keys(localStorage)")
    ok('preset: only the versioned fabric key was written (no projects key)',
       all(re.search(r'\.fabric\.v1$', k) or True for k in keys) and not any(re.search(r'^flossfox(-dev)?\.v1$', k) for k in keys),
       keys)
    # change values, then use the preset
    g.fill('#fcW', '80'); g.fill('#fcH', '60'); g.check('input[name=fcMargin][value=small]'); g.wait_for_timeout(150)
    g.click('#fcPresetList [data-use="0"]'); g.wait_for_timeout(200)
    st = g.evaluate('() => FlossFoxFabricUI.state()')
    ok('preset: Use restores the saved width, height and margin',
       g.input_value('#fcW')=='140' and g.input_value('#fcH')=='100' and st.get('margin')=='framing',
       (g.input_value('#fcW'), g.input_value('#fcH'), st))
    ok('preset: diagram still matches compute() after Use',
       g.evaluate("() => { const s=document.querySelector('#fcDiagram svg'); const r=FlossFoxFabric.compute({w:+document.getElementById('fcW').value,h:+document.getElementById('fcH').value,count:14,over:1,marginIn:FlossFoxFabricUI.state().marginIn}); return s && +s.dataset.cutW===r.cut.w && +s.dataset.desW===r.design.w; }"))

    # cut slip
    g.click('#fcCopy'); g.wait_for_timeout(100)
    slip = g.evaluate('navigator.clipboard.readText()')
    ok('cut slip copy includes fabric to cut, design, and the guide note',
       'Fabric to cut:' in slip and 'Your finished design' in slip and 'room to finish' in slip and 'Cut by the measurements' in slip, slip)
    ok('print button is labeled as a cutting slip', 'cutting slip' in g.inner_text('#fcPrint').lower())

    g.click('#fcPresetList [data-del="0"]'); g.wait_for_timeout(100)
    ok('preset: delete removes it', 'My hoop 14-count' not in g.inner_text('#fcPresetList'))
    ok('no page errors', not g.errs, g.errs)
    ctx.close()

    # 390 touch
    ctx = br.new_context(viewport={'width': 390, 'height': 860}, service_workers='block', has_touch=True, is_mobile=True)
    g = ctx.new_page(); g.set_default_timeout(8000); g.errs=[]
    g.goto(B + 'fabric.html?nosw'); g.wait_for_function('window.FlossFoxFabricUI'); g.wait_for_timeout(200)
    ok('390: diagram is visible', g.locator('#fcDiagram svg').count()==1)
    small = g.evaluate("[...document.querySelectorAll('#fc input,#fc select,#fc button,#fc summary')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44&&e.type!=='radio').map(e=>e.id||e.textContent.trim()).slice(0,8)")
    ok('390: new fabric controls meet 44px', small==[], small)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-fabric-390.png'), full_page=True)
    ok('390: no page errors', not g.errs, g.errs)
    ctx.close(); br.close()

print(f"\natelier_fabric_e2e (simulated): {R[0]} passed, {R[1]} failed")
sys.exit(1 if R[1] else 0)
