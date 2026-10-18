"""Builds the SYNTHETIC pattern fixtures (no real/copyrighted patterns) as text PDFs via Chrome print-to-PDF."""
import os
from playwright.sync_api import sync_playwright
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'patterns')
DOCS = {
 'column-table-legend.pdf': ["Synthetic Fox Sampler (TEST FIXTURE)", "Design size 180 x 240 stitches", "Fabric: 14 count Aida",
   "Symbol DMC Name Stitches Skeins", "X 310 Black 2400 2", "• Blanc White 300 1", "1. 3865 Winter White 120 1", "O 321 Red 800 1"],
 'ambiguous-qty-legend.pdf': ["Synthetic Meadow (TEST FIXTURE)", "DMC 666 Bright Red", "DMC 321 Red 2-3 skeins", "DMC 413 about 1 skein", "DMC 3865 Winter White 1 skein 2 strands"],
 'specialty-legend.pdf': ["Synthetic Night Sky (TEST FIXTURE)", "DMC 310 Black 1 skein", "DMC E310 Light Effects Black 1 skein", "DMC Satin S321 Red 1 skein",
   "Etoile C310 Black 1 skein", "Mill Hill beads 00557 Gold 1 pack", "DMC 115 variegated 1 skein", "Kreinik #4 braid 002 Gold 1 reel"],
 'misrecognition-legend.pdf': ["Synthetic Smudged Scan Text (TEST FIXTURE)", "DMC 3l0 Black 1 skein", "DMC 9999 Mystery 1 skein", "DMC 31O Black 1 skein",
   "DMC 321 Red 1200 skeins", "DMC 415 Pearl Gray 2400", "DMC 1 White Tin 1 skein"],
 'row-numbers-dimensions.pdf': ["Synthetic Garden (TEST FIXTURE)", "Design: 140 x 200 stitches", "Fabric: 14 ct Aida", "Row 12", "No. DMC Name Skeins", "1 310 Black", "3 321 Red 2", "12 3865 Winter White 1 skein"],
 'repeated-codes-2pages.pdf': ["Page one legend (TEST FIXTURE)", "DMC 310 Black 1200 stitches 1 skein", "DMC 321 Red 400 stitches", "<<PAGE>>", "Page two legend", "DMC 310 Black 900 stitches 1 skein", "DMC 3865 Winter White 50 stitches"],
}
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); g = b.new_page()
    for name, lines in DOCS.items():
        html = ''.join('<div style="page-break-after:always"></div>' if l == '<<PAGE>>' else f'<p style="font:14px Arial;margin:4px">{l}</p>' for l in lines)
        g.set_content(f'<html><body>{html}</body></html>'); g.pdf(path=os.path.join(OUT, name), format='Letter')
    print('wrote', len(DOCS), 'to', OUT)
