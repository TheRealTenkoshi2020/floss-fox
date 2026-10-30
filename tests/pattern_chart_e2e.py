"""Pattern check v2 e2e: key vs chart on SYNTHETIC PDFs (simulated, 390px). Usage: python3 tests/pattern_chart_e2e.py URL [shot.png]"""
import sys, os
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; SHOT = sys.argv[2] if len(sys.argv) > 2 else None
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'chart-check')
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))
INIT = f"localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');localStorage.setItem('{PFX}.hints.v1','off')"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); c.add_init_script(INIT); g = c.new_page()
    ERR = []; g.on('pageerror', lambda e: ERR.append(str(e)))
    def load(name):
        g.goto(B + '?nosw'); g.wait_for_timeout(500); g.click('#convertView .pat-launch'); g.set_input_files('#patFile', os.path.join(D, name + '.pdf'))
        g.wait_for_selector('#patCheck', timeout=15000); g.wait_for_timeout(200); return g.inner_text('#patCheck')
    box = load('match'); ok('match: no flags, chart compared note', g.get_attribute('#patCheck', 'data-flags') == '0' and 'Nothing caught my eye.' in box and 'We also compared the chart with the color key.' in box, box)
    box = load('extra-symbol'); ok('extra symbol %: flagged', "The chart uses the symbol % (9 stitches), but the color key doesn't list it." in box, box)
    box = load('unused-color'); ok('unused color 797: flagged', 'DMC 797 (symbol =) is in the color key, but that symbol never shows up in the chart.' in box, box)
    box = load('wrong-counts'); ok('wrong count 310 flagged, 321 not', 'The key says DMC 310 has' in box and 'DMC 321 has' not in box, box)
    box = load('image-chart'); ok('image chart: gentle note, no flags', "We couldn't read the chart's symbols (it might be a picture), so we only checked the color key." in box and g.get_attribute('#patCheck', 'data-flags') == '0', box)
    box = load('two-column'); ok('two-column key: no flags', g.get_attribute('#patCheck', 'data-flags') == '0', box)
    box = load('ghost-replica')
    for frag in ["The symbol H is used for more than one color (DMC 602 and 6003).", "The symbol V is used for more than one color (DMC 3685 and 211).", "The chart uses the symbol @", "The chart uses the symbol ii",
                 "Chart row number 49 shows up twice.", "Chart row numbers 37 to 40 are missing.", "We couldn't find 6003 in the DMC catalog.", "listed more than once"]:
        ok('ghost replica: ' + frag[:50], frag in box, box)
    ok('no em dashes in the box', '\u2014' not in box)
    if SHOT:
        g.locator('#patCheck').scroll_into_view_if_needed(); g.wait_for_timeout(150); g.locator('#patCheck').screenshot(path=SHOT)
    g.check('#patAll'); ok('saving is not blocked', g.is_enabled('#patImport'))
    g.click('#patImport'); g.wait_for_timeout(500)
    st = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'{{}}')"); pr = (st.get('projects') or [{}])[-1]; codes = {i['code'] for i in pr.get('items', [])}
    ok('saved project has the key colors', {'310', '602', '3608', '3607', '3685', '211'} <= codes, codes)
    ok('no page errors', not ERR, ERR[:3])
    print(f'{R[0]} passed, {R[1]} failed')
