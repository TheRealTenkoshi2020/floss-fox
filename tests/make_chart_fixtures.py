"""SYNTHETIC fixtures for Barbara's report (A): a PDF that is a full DMC color chart (every code, one per row, and a
3-column layout), plus a pattern PDF whose last page is such a chart. Names come from Floss Fox's own DMC table."""
import os, sys
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18930/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'patterns')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); g = b.new_page(); g.goto(B)
    dmc = g.evaluate("Object.entries(DMC).map(([c,v])=>[c,v.name])")
    num = lambda c: (int(c) if c.isdigit() else -1)
    dmc.sort(key=lambda x: (num(x[0]) < 0, num(x[0]), x[0]))
    P = lambda s: f'<p style="font:9px Arial;margin:0">{s}</p>'
    rows = ''.join(P(f'{c} {n}') for c, n in dmc)
    g.set_content('<html><body>' + P('DMC Six-Strand Embroidery Floss Color Chart (TEST FIXTURE)') + rows + '</body></html>')
    g.pdf(path=os.path.join(OUT, 'dmc-color-chart.pdf'), format='Letter')
    cols = ''.join('<tr>' + ''.join(f'<td style="font:8px Arial;padding:0 6px">{c}</td><td style="font:8px Arial;padding:0 12px 0 0">{n}</td>' for c, n in dmc[i:i+3]) + '</tr>' for i in range(0, len(dmc), 3))
    g.set_content('<html><body>' + P('DMC Color Card (TEST FIXTURE)') + f'<table>{cols}</table></body></html>')
    g.pdf(path=os.path.join(OUT, 'dmc-color-chart-3col.pdf'), format='Letter')
    legend = ''.join(P(x) for x in ['Synthetic Vampire Duo (TEST FIXTURE)', 'Symbol DMC Name Stitches Skeins', 'X 310 Black 2400 2', 'O 321 Red 800 1', '* 3865 Winter White 120 1', '+ 815 Garnet Medium 300 1'])
    g.set_content('<html><body>' + legend + '<div style="page-break-after:always"></div>' + P('Full DMC color chart for reference') + rows + '</body></html>')
    g.pdf(path=os.path.join(OUT, 'pattern-with-dmc-chart.pdf'), format='Letter')
    print(len(dmc), 'codes; wrote 3 fixtures')
