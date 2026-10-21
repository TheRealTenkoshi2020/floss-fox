"""SYNTHETIC fixtures for Pattern check v2 (key vs chart). Extends flow-p12/small-legend/make.py.
Each PDF: a title, a color key (Symbol / DMC / Name / Stitches) and a text-layer chart grid (one symbol per cell).
Writes tests/fixtures/chart-check/*.pdf and expected.json (true chart counts)."""
import os, json, random, base64
from playwright.sync_api import sync_playwright
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'chart-check'); os.makedirs(OUT, exist_ok=True)
KEY = [('X', '310', 'Black'), ('O', '321', 'Red'), ('+', '699', 'Green'), ('*', '725', 'Topaz'), ('=', '797', 'Royal Blue'), ('@', '3865', 'Winter White')]
W, H = 24, 18
def chart(syms, seed, extra=None):
    r = random.Random(seed); g = [[r.choice(syms + ['']) for _ in range(W)] for _ in range(H)]
    if extra:  # a symbol the key never mentions, in 9 cells
        for i in range(9): g[2 + i][3] = extra
    return g
def counts(g):
    c = {}
    for row in g:
        for s in row:
            if s: c[s] = c.get(s, 0) + 1
    return c
def grid_html(g):
    td = 'style="width:13px;height:13px;border:1px solid #999;text-align:center;font:9px monospace;padding:0"'
    return '<table style="border-collapse:collapse;margin-top:14px">' + ''.join('<tr>' + ''.join(f'<td {td}>{s}</td>' for s in row) + '</tr>' for row in g) + '</table>'
def key_html(rows, cnt, two=False, override=None):
    override = override or {}
    line = lambda s, c, n: f'<tr><td>{s}</td><td>{c}</td><td>{n}</td><td>{override.get(c, cnt.get(s, 0))}</td></tr>'
    tab = lambda rs: '<table style="font:12px Arial"><tr><th>Symbol</th><th>DMC</th><th>Name</th><th>Stitches</th></tr>' + ''.join(line(*x) for x in rs) + '</table>'
    if not two: return tab(rows)
    h = (len(rows) + 1) // 2; return f'<div style="display:flex;gap:60px">{tab(rows[:h])}{tab(rows[h:])}</div>'
HEAD = '<h3>Little Fox Sampler (SYNTHETIC TEST)</h3><p>Design size 24 x 18 stitches. 14 count Aida. 2 strands cross stitch.</p>'
exp = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page()
    def make(name, key_rows, g, two=False, override=None, image=False, note=''):
        cnt = counts(g); k = key_html(key_rows, cnt, two, override)
        if image:
            pg.set_content('<html><body>' + grid_html(g) + '</body></html>')
            png = pg.locator('table').screenshot(); ch = f'<img style="margin-top:14px" src="data:image/png;base64,{base64.b64encode(png).decode()}">'
        else: ch = grid_html(g)
        pg.set_content(f'<html><body style="font-family:Arial">{HEAD}{k}<p>Chart</p>{ch}</body></html>'); pg.pdf(path=os.path.join(OUT, name + '.pdf'), format='Letter')
        exp[name] = {'chartCounts': cnt, 'keySymbols': [s for s, _, _ in key_rows], 'listedOverride': override or {}, 'note': note}
    S4 = [s for s, _, _ in KEY[:4]]
    make('match', KEY[:4], chart(S4, 1), note='key and chart agree')
    make('extra-symbol', KEY[:4], chart(S4, 2, extra='%'), note='% in chart, not in key')
    make('unused-color', KEY[:5], chart(S4, 3), note='= (797) in key, never in chart')
    g = chart(S4, 4); c = counts(g)
    make('wrong-counts', KEY[:4], g, override={'310': c['X'] + 60, '321': c['O'] + 2}, note='310 off by 60 (flag); 321 off by 2 (tolerated)')
    make('image-chart', KEY[:4], chart(S4, 5), image=True, note='chart is a picture; no symbols readable')
    S6 = [s for s, _, _ in KEY]
    make('two-column', KEY, chart(S6, 6), two=True, note='two-column key, all agree')
    make('two-column-bad', KEY, chart(S6[:5], 7, extra='%'), two=True, note='two-column key, @ unused, % extra')
    # Replicas of Myke's two real AI-generated pattern images (barrel, ghost), rebuilt as text-layer PDFs with the same legend mistakes.
    def side(name, legend_html, g, labels, title, note, colhead=None, stacked=False):
        td = 'style="width:8px;height:8px;border:1px solid #bbb;text-align:center;font:6px monospace;padding:0"'
        lab = 'style="font:6px Arial;padding:0 3px 0 0;text-align:right"'
        head = ('<tr><td></td>' + ''.join(f'<td {td}>{c}</td>' for c in colhead) + '</tr>') if colhead else ''
        tb = '<table style="border-collapse:collapse">' + head + ''.join(f'<tr><td {lab}>{labels[i]}</td>' + ''.join(f'<td {td}>{s}</td>' for s in row) + '</tr>' for i, row in enumerate(g[:len(labels)])) + '</table>'
        pg.set_content(f'<html><body style="font-family:Arial"><div style="display:{"block" if stacked else "flex"};gap:16px">{tb}<div style="font:9px Arial">{legend_html}</div></div><h3>{title}</h3><p>FOR 14-COUNT AIDA CLOTH. PATTERN SIZE: 60 x 60 STITCHES.</p></body></html>')
        pg.pdf(path=os.path.join(OUT, name + '.pdf'), format='Letter'); exp[name] = {'chartCounts': counts(g[:len(labels)]), 'rows': len(labels), 'note': note}
    r = random.Random(11)
    gs = [[('' if (x - 30) ** 2 + (y - 28) ** 2 > 380 else r.choice(['L', 'L', 'M', 'M', 'V', 'K', 'H', 'S', '@', 'ii'])) for x in range(60)] for y in range(60)]
    glabels = list(range(1, 37)) + list(range(41, 50)) + [49] + list(range(50, 61)) + [60]
    glabels = glabels[:60]
    gleg = [('S', '310'), ('H', '602'), ('L', '3608'), ('M', '3607'), ('L', '3608'), ('M', '3607'), ('V', '3685'), ('K', '3685'), ('H', '6003'), ('L', '3608'), ('L', '3608'), ('M', '3607'), ('V', '211'), ('V', '211'), ('K', '3685'), ('K', '3685')]
    side('ghost-replica', '<p>FLOSS LEGEND FOR GHOST CHARACTER</p>' + ''.join(f'<p style="margin:6px 0">{s} = DMC {c}</p>' for s, c in gleg), gs, glabels, 'GHOST (SYNTHETIC REPLICA)', 'Myke ghost image errors', colhead=[chr(65 + i % 26) for i in range(60)])
    side('ghost-below', '<p>FLOSS LEGEND FOR GHOST CHARACTER</p>' + ''.join(f'<p style="margin:6px 0">{s} = DMC {c}</p>' for s, c in gleg), gs, glabels, 'GHOST (SYNTHETIC REPLICA)', 'legend below the chart; Myke ghost image errors', colhead=[chr(65 + i % 26) for i in range(60)], stacked=True)
    gb = [[('' if (x - 30) ** 2 + (y - 30) ** 2 > 500 else r.choice(['M', 'M', 'S', 'S', 'B', 'X', 'x', '*', 'Y', '♥'])) for x in range(60)] for y in range(60)]
    bleg = [('X', '310', 'Black', 120), ('x', '310', 'Ponne', 120), ('*', '370', 'Coimlrat Grewn', 39), ('=', '160', 'Dumr/Brown', 26), ('Z', '210', 'Dumrt Pens', 47), ('N', '260', 'Normain', 32), ('E', '215', 'Crean', 37), ('Y', '318', 'Plommoath', 36),
            ('o', '226', 'Grazy Comhoreses', 13), ('M', '315', 'Count Pens', 13), ('B', '304', 'Broam Brown', 29), ('B', '574', 'Cream Brown', 15), ('#', '475', 'Bream Brown', 34), ('%', '484', 'Reat Pens', 25), ('k', '530', 'Snunter', 33), ('/', '667', 'Blach', 15),
            ('S', '936', 'Cream Cruntimord', 38), ('W', '894', 'Wind Dvowr', 26), ('&', '801', 'Mowrl Brown', 12), ('R', '789', 'Reod Park Brown', 33), ('C', '669', 'Cream', 17), ('Q', '644', 'Cream Wxan', 13), ('U', '789', 'Cream Brown', 19), ('-', '242', 'Red', 12), ('X', '310', 'Black', 120)]
    blabels = list(range(1, 61))
    side('barrel-replica', '<table style="font:8px Arial"><tr><th>Symbol</th><th>DMC</th><th>Color Name</th><th>Number of Stitches</th></tr>' + ''.join(f'<tr><td>{s}</td><td>{c}</td><td>{n}</td><td>{k}</td></tr>' for s, c, n, k in bleg) + '</table>', gb, blabels, 'BARREL CHARACTER (SYNTHETIC REPLICA)', 'Myke barrel image errors', colhead=[str(i) if i % 10 == 0 else '' for i in range(1, 61)])
    side('barrel-below', '<table style="font:8px Arial"><tr><th>Symbol</th><th>DMC</th><th>Color Name</th><th>Number of Stitches</th></tr>' + ''.join(f'<tr><td>{s}</td><td>{c}</td><td>{n}</td><td>{k}</td></tr>' for s, c, n, k in bleg) + '</table>', gb, blabels, 'BARREL CHARACTER (SYNTHETIC REPLICA)', 'legend below the chart; Myke barrel image errors', colhead=[str(i) if i % 10 == 0 else '' for i in range(1, 61)], stacked=True)
    b.close()
json.dump(exp, open(os.path.join(OUT, 'expected.json'), 'w'), indent=1); print(len(exp), 'fixtures')
