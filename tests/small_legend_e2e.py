"""Small pattern legends (SIMULATED browser testing: headless Chrome, 390px; SYNTHETIC PDFs, not real patterns).
Sorted single-family keys, two-column keys and bare symbol/code/count rows must import every color, with unlabeled
numbers left as Unknown. Full DMC color-chart PDFs must still be rejected.
Usage: python3 tests/small_legend_e2e.py BASE_URL"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; H = os.path.dirname(os.path.abspath(__file__)); FX = os.path.join(H, 'fixtures', 'patterns')
EXP = json.load(open(os.path.join(FX, 'small', 'expected.json'))); R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
INIT = "localStorage.setItem('flossfox-dev.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('flossfox-dev.hints.v1','off')"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); c.add_init_script(INIT); g = c.new_page()
    ERR = []; g.on('pageerror', lambda e: ERR.append(str(e))); g.goto(B + '?nosw'); g.wait_for_timeout(600)
    def load(path):
        g.click('#convertView .pat-launch'); g.set_input_files('#patFile', path)
        g.wait_for_function("!/Reading selected file/.test(document.getElementById('patInfo').textContent)", timeout=30000); g.wait_for_timeout(250)
        info = g.inner_text('#patInfo') + ' ' + (g.inner_text('#patUnreadable') if g.locator('#patUnreadable').count() else '')
        rows = g.evaluate("[...document.querySelectorAll('#patRows .pat-row')].map(r=>({code:r.querySelector('b').textContent.replace('DMC ',''),t:r.textContent}))")
        g.click('#ffPatternDialog .pat-header button'); g.wait_for_timeout(120); return info, rows
    for fn, want in sorted(EXP.items()):
        info, rows = load(os.path.join(FX, 'small', fn)); got = sorted(r['code'].upper() for r in rows)
        ok(f'S {fn}: all {len(want)} colors, none extra, not called a color chart', got == sorted(want) and 'color chart' not in info, (got, info[:160]))
        ok(f'S {fn}: unlabeled numbers left Unknown (no amounts invented)', all('?/' in r['t'] or 'Unknown' in r['t'] for r in rows), [r['t'][:80] for r in rows[:3]])
    for fn in ('dmc-color-chart.pdf', 'dmc-color-chart-3col.pdf'):
        info, rows = load(os.path.join(FX, fn)); ok(f'C {fn}: full color chart still rejected, nothing added', rows == [] and 'color chart' in info, (len(rows), info[:160]))
    info, rows = load(os.path.join(FX, 'pattern-with-dmc-chart.pdf'))
    ok('C pattern-with-dmc-chart.pdf: legend kept, chart page skipped', sorted(r['code'] for r in rows) == ['310', '321', '3865', '815'] and 'color chart' in info, ([r['code'] for r in rows][:10], info[:160]))
    ok('no page errors', not ERR, ERR[:3])
    print(f'{R[0]} passed, {R[1]} failed')
