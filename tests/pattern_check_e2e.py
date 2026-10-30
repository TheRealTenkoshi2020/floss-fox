"""Pattern check e2e (simulated, 390px). Usage: python3 tests/pattern_check_e2e.py URL [shot.png]"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; SHOT = sys.argv[2] if len(sys.argv) > 2 else None
H = os.path.dirname(os.path.abspath(__file__)); K = json.load(open(os.path.join(H, 'fixtures', 'pattern-check', 'keys.json')))
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
INIT = f"localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');localStorage.setItem('{PFX}.hints.v1','off')"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); c.add_init_script(INIT); g = c.new_page()
    ERR = []; g.on('pageerror', lambda e: ERR.append(str(e))); g.goto(B + '?nosw'); g.wait_for_timeout(600)
    def paste(t):
        g.click('#convertView .pat-launch'); g.wait_for_timeout(150)
        g.evaluate("document.querySelector('#ffPatternDialog .pat-manual').open=true"); g.fill('#patPaste', t)
        g.click('#ffPatternDialog .pat-manual button:has-text("Find colors")'); g.wait_for_timeout(250)
    paste(K['ai_bad']); box = g.inner_text('#patCheck') if g.locator('#patCheck').count() else ''
    ok('Pattern check box shows after a pasted key', box.startswith('Pattern check'), box)
    for frag, n in [("We couldn't find 9999, 4000 in the DMC catalog.", 'fake codes'), ('DMC 310 is listed more than once.', 'duplicate'), ('DMC 3865 is listed as "Sky Blue", but the DMC catalog calls it winter white.', 'name mismatch'),
                    ('DMC 321 says 1 skein for 9000 stitches. Our estimate is about', 'low amount'), ('DMC 699 says 40 skeins for 200 stitches. Our estimate is about 1 on 14-count Aida, so it may look high.', 'high amount'), ('You can still save', 'never blocks note')]:
        ok(f'flags {n}', frag in box, box)
    ok('no em dashes in the box', '\u2014' not in box)
    if SHOT:
        g.locator('#patCheck').scroll_into_view_if_needed(); g.wait_for_timeout(150); g.screenshot(path=SHOT)
    g.check('#patAll'); ok('saving is not blocked', g.is_enabled('#patImport'))
    g.click('#patImport'); g.wait_for_timeout(500)
    st = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'{{}}')"); pr = (st.get('projects') or [{}])[-1]; items = {i['code']: i.get('qty') for i in pr.get('items', [])}
    ok('saved amounts are exactly what the key said (check changed nothing)', items.get('321') == 1 and items.get('699') == 40 and items.get('3865') == 1 and '9999' not in items, items)
    g.goto(B + '?nosw'); g.wait_for_timeout(500); paste(K['clean']); box = g.inner_text('#patCheck') if g.locator('#patCheck').count() else ''
    ok('clean key: one "Nothing caught my eye" line and no flags', 'Nothing caught my eye.' in box and g.get_attribute('#patCheck', 'data-flags') == '0', box)
    hl = g.evaluate("(window.FF_PCHECK_HELP||[])[0]||''"); ok('Pip help topic for the check is loaded', hl == 'What is the Pattern check?', hl)
    ha = g.evaluate("(window.FF_PCHECK_HELP||[])[1]||''"); ok('import help answer ends with the new sentence', ha.endswith('It can miss things, so still check each color against your pattern.'), ha)
    ok('Ask Pip offline answer matches the import help', ha in g.evaluate("document.documentElement.innerHTML") or g.evaluate("fetch('pip-hybrid/offline-knowledge.js').then(r=>r.text())").replace("\\'", "'").find(ha) >= 0)
    ok('no page errors', not ERR, ERR[:3])
    print(f'{R[0]} passed, {R[1]} failed')
