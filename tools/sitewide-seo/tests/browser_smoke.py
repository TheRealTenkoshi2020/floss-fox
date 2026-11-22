#!/usr/bin/env python3
"""Isolated static-guide Chromium checks; this is NOT full-site acceptance."""
from pathlib import Path
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from seo.guide_pages import GUIDES,render_guide
from playwright.sync_api import sync_playwright

with tempfile.TemporaryDirectory(prefix='flossfox-seo-browser-') as d:
    root=Path(d)
    for page in GUIDES:
        (root/page).write_text(render_guide(page,'production'),encoding='utf-8')
    (root/'index.html').write_text('<html><head><title>Floss Fox</title></head><body>Floss Fox home</body></html>')
    for filename in ('fabric.html','about.html','privacy.html'):
        (root/filename).write_text('<html><body>Floss Fox</body></html>')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        checks=0
        for width in (320,360,390,768,1280):
            page=browser.new_page(viewport={'width':width,'height':800})
            for filename in GUIDES:
                page.set_content((root/filename).read_text(encoding='utf-8'),wait_until='domcontentloaded')
                assert page.locator('h1').count()==1,filename
                assert page.locator('meta[name=description]').get_attribute('content')
                assert page.locator('link[rel=canonical]').get_attribute('href')=='https://flossfox.com/'+filename
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),f'{filename} overflows at {width}px'
                assert page.locator('a[href="index.html"]').count()>=1
                checks+=5
            page.close()
        browser.close()
print(f'PASS: {checks} isolated Chromium checks over {len(GUIDES)} pages x 5 viewport sizes.')
