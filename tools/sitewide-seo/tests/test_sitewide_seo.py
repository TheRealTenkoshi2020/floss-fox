"""Offline regression tests for the full-site SEO delta. Run: python -m pytest -q tests"""
from pathlib import Path
import importlib.util
import json
import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET
import pytest
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from apply_sitewide_seo import build,install,patch_page,patch_manifest,patch_sitemap,patch_sw,PAGES,GUIDES
from seo.guide_pages import render_guide


def fixture(tmp_path,site):
    for path in PAGES:
        canon=''
        if site=='production':
            suffix='' if path=='index.html' else path
            canon=f'<link rel="canonical" href="https://flossfox.com/{suffix}">'
        else:canon='<meta name="robots" content="noindex, nofollow">'
        intro="<h1 class=\"say\" id=\"ffLandSay\">Hi! I'm Pip. What are we stitching up today?</h1>" if path=='index.html' else '<h1>Tools</h1>'
        notes='<div class="notes"><b>About the brands</b>Poly-cotton and a bit fluffier</div>' if path=='index.html' else ''
        og='<meta property="og:title" content="Before"><meta property="og:description" content="Before">' if path=='index.html' else ''
        brand_init='<script>const APP_NAME="Floss Fox";document.title=APP_NAME;</script>' if path=='index.html' else ''
        text=f'''<!doctype html><html lang="en"><head>{canon}<title>Floss Fox</title><meta name="description" content="old">{og}</head><body><main>{intro}{notes}</main><footer><a href="about.html">About</a></footer>{brand_init}</body></html>'''
        (tmp_path/path).write_text(text,encoding='utf-8')
    prefix='flossfox-dev-v2.0a-ci005-106' if site=='dev' else 'flossfox-v4.0-1'
    (tmp_path/'sw.js').write_text("const CACHE = '"+prefix+"';\nconst CORE = [\n  \"about.html\",\n];",encoding='utf-8')
    (tmp_path/'manifest.webmanifest').write_text(json.dumps({'name':'Floss Fox','description':'old','short_name':'Floss Fox'}),encoding='utf-8')
    (tmp_path/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://flossfox.com/sitemap.xml\n',encoding='utf-8')
    if site=='production':(tmp_path/'sitemap.xml').write_text('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://flossfox.com/</loc></url></urlset>',encoding='utf-8')
    return tmp_path

@pytest.mark.parametrize('site',['dev','production'])
def test_sitewide_build_apply_idempotent(tmp_path,site):
    root=fixture(tmp_path,site)
    original={p:(root/p).read_bytes() for p in PAGES}
    changes=build(root,site)
    assert set(PAGES).issubset(changes)
    assert set(GUIDES).issubset(changes)
    assert 'sw.js' in changes and 'manifest.webmanifest' in changes
    assert ('sitemap.xml' in changes)==(site=='production')
    assert all((root/p).read_bytes()==original[p] for p in PAGES), 'Build must not write on dry-run'
    install(root,changes)
    assert build(root,site)=={},'Second run must be no-op'
    for page in [*PAGES,*GUIDES]:
        parsed=BeautifulSoup((root/page).read_text(),'html.parser')
        head=parsed.head
        assert head.title and head.find('meta',attrs={'name':'description'})
        assert len(head.find_all('meta',attrs={'name':'description'}))==1
        assert head.find('meta',attrs={'property':'og:title'})
        assert head.find('meta',attrs={'property':'og:description'})
        assert head.find('meta',attrs={'name':'twitter:card'})
        assert head.find('meta',attrs={'name':'twitter:image'})['content']=='https://flossfox.com/og-image.png'
        if site=='production':
            assert head.find('link',attrs={'rel':'canonical'})
            assert not head.find('meta',attrs={'name':'robots','content':'noindex, nofollow'})
        else:
            assert head.find('meta',attrs={'name':'robots','content':'noindex, nofollow'})
            assert not head.find('link',attrs={'rel':'canonical'})
    assert (root/'index.html').read_text().count('data-nosnippet')==1
    assert 'Poly-cotton' in (root/'index.html').read_text()
    assert 'document.title=APP_NAME;' not in (root/'index.html').read_text()
    assert 'const APP_NAME="Floss Fox";' in (root/'index.html').read_text()
    assert 'flossfox-dev-' in (root/'sw.js').read_text() if site=='dev' else 'flossfox-v4.0-1' in (root/'sw.js').read_text()
    if site=='production':
        sitemap=ET.fromstring((root/'sitemap.xml').read_text())
        locations={x.text for x in sitemap.iter() if x.tag.endswith('loc')}
        assert all(('https://flossfox.com/'+p) in locations for p in GUIDES)

@pytest.mark.parametrize('site',['dev','production'])
def test_fail_closed_on_modified_source(tmp_path,site):
    root=fixture(tmp_path,site)
    path=root/'index.html';path.write_text(path.read_text().replace('<div class="notes">','<div class="notes-rebuilt">'))
    before={p:(root/p).read_bytes() for p in PAGES}
    with pytest.raises(ValueError,match='technical disclosure'):
        build(root,site)
    assert all((root/p).read_bytes()==before[p] for p in PAGES)

@pytest.mark.parametrize('site',['dev','production'])
def test_script_never_reuses_existing_edited_guides(tmp_path,site):
    root=fixture(tmp_path,site)
    (root/'tools.html').write_text('<h1>My edits</h1>')
    with pytest.raises(ValueError,match='already exists'):
        build(root,site)
    assert (root/'tools.html').read_text()=='<h1>My edits</h1>'

@pytest.mark.parametrize('name',GUIDES)
def test_guides_have_unique_titles_links_semantics(name):
    html=render_guide(name,'production')
    doc=BeautifulSoup(html,'html.parser')
    assert len(doc.find_all('h1'))==1
    assert len(doc.title.text)<80
    assert 50<len(doc.find('meta',attrs={'name':'description'})['content'])<180
    assert doc.find('main',id='content')
    assert doc.find('nav',attrs={'aria-label':'Breadcrumb'})
    assert doc.find('a',href='index.html')
    assert doc.find('link',attrs={'rel':'canonical'})['href'].endswith(name)
    scripts=doc.find_all('script',attrs={'type':'application/ld+json'})
    assert len(scripts)==1
    obj=json.loads(scripts[0].string)
    assert obj['@graph'][1]['@type']=='BreadcrumbList'
    assert '<img' in html

def test_robots_policy_and_static_guides():
    assert len(set(p['title'] for p in GUIDES.values()))==len(GUIDES)
    for p in GUIDES.values():
        assert len(p['description'])<180
        assert 'href="index.html' in p['body'] or 'href="fabric.html"' in p['body']

def test_does_not_change_app_logic(tmp_path):
    root=fixture(tmp_path,'production')
    sensitive=['projects.js','threads.js','smart-stash/core.js','threadwood/core.js']
    for p in sensitive:
        (root/p).parent.mkdir(exist_ok=True,parents=True)
        (root/p).write_text('/* unchanged */')
    before={p:(root/p).read_bytes() for p in sensitive}
    install(root,build(root,'production'))
    assert all((root/p).read_bytes()==before[p] for p in sensitive)
