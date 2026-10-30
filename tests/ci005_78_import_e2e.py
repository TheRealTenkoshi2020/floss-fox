"""CI005-78: pattern import through the real file path (PDF.js in headless Chrome) on SYNTHETIC fixtures
(tests/make_ci005_78_fixtures.py). Usage: FF_KEY=flossfox-dev.v1 python3 tests/ci005_78_import_e2e.py URL"""
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
import sys, os
from playwright.sync_api import sync_playwright
B = sys.argv[1]; KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY.replace('.v1', '')
FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'patterns'); R = []
def ok(n, c, d=''):
    R.append(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(d)[:300]}'))
SEED = "localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s.hints.v1','off')" % (PFX, PFX)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def load(name):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); c.add_init_script(SEED); g = c.new_page(); g.goto(B); g.wait_for_timeout(300)
        g.click('.pat-launch'); g.set_input_files('#patFile', os.path.join(FX, name)); g.wait_for_function("!/Reading selected file/.test(document.getElementById('patInfo').textContent)", timeout=30000); g.wait_for_timeout(200)
        return g, g.evaluate("[...document.querySelectorAll('#patRows .pat-row b')].map(b=>b.textContent)")
    g, codes = load('card-grid-dcodes.pdf')
    ok('G1 card grid with D-codes: 4 colors', codes == ['DMC 208', 'DMC 310', 'DMC 3865', 'DMC 725'], codes)
    if g.locator('#patAll').count() and not g.locator('#patAll').is_checked(): g.check('#patAll')
    g.fill('#patName', 'Grid'); g.click('#patImport'); g.wait_for_timeout(400)
    pr = g.evaluate(f"(JSON.parse(localStorage.getItem('{KEY}'))||{{projects:[]}}).projects")
    items = {i['code']: (i['stitchCount'], i['qty']) for i in pr[0]['items']} if pr else {}
    ok('G2 saved with stitches and skeins (2,417 and 1,050 read whole)', items == {'208': (23, 1), '310': (2417, 4), '3865': (7, 1), '725': (1050, 2)}, items)
    g, codes = load('chart-side-key.pdf')
    ok('G3 chart with row numbers + (DMC) side key: only the 5 key colors', sorted(codes) == sorted(['DMC BLANC', 'DMC 3865', 'DMC 208', 'DMC 3799', 'DMC 973']), codes)
    g, codes = load('many-colors-no-counts.pdf'); n = len(codes)
    box = g.inner_text('#patManyBox') if g.locator('#patManyBox').count() else ''
    ok('G4 many colors, no counts: approved warning with the real count', n >= 40 and f'This PDF lists {n} colors but no stitch counts, so it may be a full color chart, not your pattern key. Add all {n} colors?' in box and g.locator('#patManyAll').inner_text() == f'Add all {n} colors' and g.locator('#patManyPick').inner_text() == 'Let me pick', (n, box))
    g.click('#patManyAll'); g.wait_for_timeout(100)
    ok('G4b "Add all" removes the warning and ticks the confirmation', not g.locator('#patManyBox').count() and g.locator('#patAll').is_checked())
    g, codes = load('card-grid-dcodes.pdf')
    ok('G4c a normal key shows no full-chart warning', not g.locator('#patManyBox').count())
    b.close()
print(f'{sum(R)} passed, {len(R) - sum(R)} failed'); sys.exit(0 if all(R) else 1)
