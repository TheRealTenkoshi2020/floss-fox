"""CI005-78: SYNTHETIC fixtures for two real-world layouts (no real pattern content).
 card-grid-dcodes.pdf : 'DMC Stranded (D)' color list, 4-card grid, symbol box + D-prefixed code / name / 'Stitches: N - Skeins: N'
                        (one count with a comma thousands separator), plus traps: a lone 'D' header, 'see D2' page ref, 'Page 3 of 3'.
 chart-side-key.pdf   : text-layer chart whose rows carry row numbers on both sides, a key beside it as 'symbol CODE (DMC)',
                        and stitching notes that name key colors again.
Run: python3 tests/make_ci005_78_fixtures.py"""
import os
from playwright.sync_api import sync_playwright
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'patterns')
A = 'position:absolute;font:9px Arial;white-space:nowrap'
cards = [('#', 'D208', 'Very Dark Lavender', 'Stitches: 23 - Skeins: 1'), ('@', 'D310', 'Black', 'Stitches: 2,417 - Skeins: 4'),
         ('&', 'D3865', 'Winter White', 'Stitches: 7 - Skeins: 1'), ('%', 'D725', 'Topaz', 'Stitches: 1,050 - Skeins: 2')]
grid = f'<div style="{A};left:40px;top:20px;font-size:14px;font-weight:bold">DMC Stranded (D)</div><div style="{A};left:40px;top:44px">D</div>'
for i, (s, c, n, a) in enumerate(cards):
    x = 40 + i * 170
    grid += f'<div style="{A};left:{x}px;top:70px;border:1px solid #000;width:14px;text-align:center">{s}</div>'
    grid += f'<div style="{A};left:{x+24}px;top:62px">{c}</div><div style="{A};left:{x+24}px;top:79px">{n}</div><div style="{A};left:{x+24}px;top:96px">{a}</div>'
grid += f'<div style="{A};left:40px;top:140px">Backstitch: see D2 for outline</div><div style="{A};left:300px;top:1000px">Color List Page 3 of 3 (SYNTHETIC TEST)</div>'
rows = ['', '– – – –', '– = = –', '– = + + = –', '* * – –', '– – * *', '', '* * * *', '= = = =', '+ + + +', '']
key = {0: '+ BLANC (DMC)', 1: '/ 3865 (DMC)', 3: '208 (DMC)', 5: '* 3799 (DMC)', 8: '& 973 (DMC)'}
notes = {9: 'Outline - DMC 3799 - 1 strand', 10: 'Eyes - DMC 208 - 2 strand french knot'}
chart = f'<div style="{A};left:40px;top:10px;font-size:13px">Synthetic Pond (TEST FIXTURE)</div><div style="{A};left:40px;top:28px">Count Size: 12 x 12</div>'
for r, cells in enumerate(rows):
    y = 50 + r * 14; n = r + 1
    chart += f'<div style="{A};left:40px;top:{y}px">{n}</div><div style="{A};left:60px;top:{y}px">{cells}</div><div style="{A};left:200px;top:{y}px">{n}</div>'
    if r in key: chart += f'<div style="{A};left:260px;top:{y + (0 if r == 0 else 7)}px">{key[r]}</div>'  # most key rows sit between chart rows
    if r in notes: chart += f'<div style="{A};left:260px;top:{y}px">{notes[r]}</div>'
# many-colors-no-counts.pdf: 45 'DMC code Name' lines, no counts (what a reference list looks like); every 3rd code, so no catalog run.
import json, re
_DMC = json.loads(re.search(r'const DMC=(\{.*?\});', open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'index.html')).read()).group(1))
many = ''.join(f'<p style="font:10px Arial;margin:1px">DMC {c} Shade</p>' for c in [c for c in _DMC if re.fullmatch(r'\d{3}', c)][::3][:45])
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); g = b.new_page()
    for name, body in (('card-grid-dcodes.pdf', grid), ('chart-side-key.pdf', chart), ('many-colors-no-counts.pdf', many)):
        g.set_content(f'<html><body style="margin:0;position:relative;height:1050px">{body}</body></html>'); g.pdf(path=os.path.join(OUT, name), format='Letter')
    print('wrote 3 to', OUT)
