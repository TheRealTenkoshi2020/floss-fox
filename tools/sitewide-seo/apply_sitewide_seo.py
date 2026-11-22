#!/usr/bin/env python3
"""Reproducible sitewide SEO update for the Floss Fox V5 development candidate.

Usage (initial dry-run):
 python3 apply_sitewide_seo.py /path/to/floss-fox-dev --site dev
 python3 apply_sitewide_seo.py /path/to/floss-fox-dev --site dev --apply

Production is a separate, deliberate release and must not be applied until approved:
 python3 apply_sitewide_seo.py /path/to/floss-fox --site production --apply

No network calls, no third-party dependencies, no changes to business logic or private data.
Preflights all inputs before any write. Repeat runs are idempotent.
"""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile
import stat
from html import escape
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent / 'seo'))
from guide_pages import GUIDES,render_guide

BASE='https://flossfox.com/'
PAGES={
 'index.html': ('Floss Fox | Cross-Stitch Organizer & Floss Converter',
    'Meet Pip, your friendly cross-stitch companion. Organize threads, find DMC, Anchor and Sullivans floss matches, plan projects and make shopping lists.'),
 'fabric.html': ('Cross-Stitch Fabric Calculator | Aida & Evenweave | Floss Fox',
    'Free cross-stitch fabric calculator. Enter pattern stitch counts, Aida or evenweave fabric count and margins to find your finished size and fabric to cut.'),
 'about.html': ('About Floss Fox | Cross-Stitch Tools & Color Charts',
    'Meet the maker of Floss Fox, explore our cross-stitch tools and learn how DMC to Anchor and Sullivans conversion data is sourced.'),
 'privacy.html': ('Privacy & Local Storage | Floss Fox',
    'Learn how Floss Fox keeps project and thread data on your device, how browser backups work and what to know before using optional online features.'),
}
INTRO='Meet Pip, your cross-stitch companion. Find floss matches, organize your thread collection, plan projects, and gather what you need for your next stitch.'
GUIDE_LINKS='<p class="ff-seo-guide-links" id="ffSeoGuides"><a href="tools.html">Cross-stitch tools &amp; guides</a> · <a href="floss-conversion-guide.html">Floss conversion guide</a> · <a href="thread-inventory-guide.html">Thread inventory tips</a> · <a href="cross-stitch-project-planning.html">Project planning</a></p>'
STYLE='<style id="ffSeoStyle">.ff-seo-intro{max-width:42rem;margin:.45rem auto 1rem;text-align:center;line-height:1.5;color:var(--mut,#645d51)}.ff-seo-guide-links{font-size:.9rem;line-height:1.7;overflow-wrap:anywhere}</style>'

def once(s, old, new, label):
    count=s.count(old)
    if count!=1:raise ValueError(f'{label}: expected one anchor; found {count}. Existing files unchanged.')
    return s.replace(old,new,1)

def title(s,value):
    match=list(re.finditer(r'<title>[^<]+</title>',s,re.I))
    if len(match)!=1:raise ValueError('Title element missing or duplicated')
    new='<title>'+escape(value)+'</title>'
    return s[:match[0].start()]+new+s[match[0].end():]

def upsert(s, attr, key, val):
    pattern=rf'<meta\s+{re.escape(attr)}="{re.escape(key)}"\s+content="[^"]*"\s*/?>'
    matches=list(re.finditer(pattern,s,re.I));new=f'<meta {attr}="{key}" content="{escape(val,quote=True)}">'
    if len(matches)>1:raise ValueError(f'{key}: duplicated existing meta')
    if len(matches)==1:
        m=matches[0];return s[:m.start()]+new+s[m.end():]
    return once(s,'</title>','</title>\n'+new,f'upsert {key}')

def insert_head(s, content, marker):
    return s if marker in s else once(s,'</head>',content+'\n</head>',marker)

def schema_site():
    return {"@context":"https://schema.org","@graph":[
      {"@type":"WebSite","@id":BASE+'#website',"url":BASE,"name":"Floss Fox","alternateName":"FlossFox","description":PAGES['index.html'][1]},
      {"@type":"WebPage","@id":BASE+'#page',"url":BASE,"name":PAGES['index.html'][0],"description":PAGES['index.html'][1],"isPartOf":{"@id":BASE+'#website'}}
    ]}

def schema_subpage(path):
    url=BASE+path
    return {"@context":"https://schema.org","@graph":[
       {"@type":"WebPage","@id":url+'#page',"url":url,"name":PAGES[path][0],"description":PAGES[path][1],"isPartOf":{"@id":BASE+'#website'}},
       {"@type":"BreadcrumbList","itemListElement":[
          {"@type":"ListItem","position":1,"name":"Floss Fox","item":BASE},
          {"@type":"ListItem","position":2,"name":PAGES[path][0],"item":url}
       ]}
    ]}

def patch_page(path, s, site):
    if path not in PAGES:raise ValueError('Unexpected page')
    if '<html lang="en">' not in s or '</head>' not in s or '</footer>' not in s:
        raise ValueError(f'{path}: cannot identify expected Floss Fox page structure')
    h=s[:s.index('</head>')]
    noindex=bool(re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex',h,re.I))
    if site=='dev':
        if not noindex:raise ValueError(f'{path}: dev page must stay noindex')
        if '<link rel="canonical"' in h:raise ValueError(f'{path}: dev must not carry public canonical')
    else:
        if noindex:raise ValueError(f'{path}: production unexpectedly noindex')
        if f'<link rel="canonical" href="{BASE+(path if path!="index.html" else "")}">' not in h:
            raise ValueError(f'{path}: expected production canonical absent')
    name,desc=PAGES[path]
    s=title(s,name)
    for attr,key,value in [('name','description',desc),('property','og:site_name','Floss Fox'),
                           ('property','og:type','website'),('property','og:title',name),('property','og:description',desc),
                           ('property','og:image',BASE+'og-image.png'),('property','og:image:alt','Floss Fox, your cross-stitch companion'),
                           ('name','twitter:card','summary_large_image'),('name','twitter:title',name),('name','twitter:description',desc),
                           ('name','twitter:image',BASE+'og-image.png')]:
        s=upsert(s,attr,key,value)
    if site=='production':
        s=upsert(s,'property','og:url',BASE+(path if path!='index.html' else ''))
        if 'id="ffSeoSchema"' not in s:
            ld=json.dumps(schema_site() if path=='index.html' else schema_subpage(path),separators=(',',':'))
            s=insert_head(s,f'<script id="ffSeoSchema" type="application/ld+json">{ld}</script>','ffSeoSchema')
    else:
        # Dev previews are non-indexed. Never promote structured-data site identity to the preview.
        if 'id="ffSeoSchema"' in s:raise ValueError('Dev unexpectedly has production schema')
        if '<meta property="og:url" content="https://flossfox.com/' in s:
            raise ValueError('Dev has production og:url; review before continuing')
    if path=='index.html':
        # The original app's brand initializer otherwise discards the SEO title
        # as soon as JavaScript runs. Keep its visible branding initialization.
        if 'document.title=APP_NAME;' in s:
            s=once(s,'document.title=APP_NAME;','/* Preserve the descriptive page title set in <head>. */','runtime page title')
        if '<div class="notes" data-nosnippet>' not in s:
            s=once(s,'<div class="notes"><b>About the brands</b>',
                   '<div class="notes" data-nosnippet><b>About the brands</b>','technical disclosure data-nosnippet')
        if 'id="ffSeoIntro"' not in s:
            marker='<h1 class="say" id="ffLandSay">Hi! I\'m Pip. What are we stitching up today?</h1>'
            s=once(s,marker,marker+'\n<p id="ffSeoIntro" class="ff-seo-intro">'+escape(INTRO)+'</p>','landing introduction')
            s=insert_head(s,STYLE,'ffSeoStyle')
    if 'id="ffSeoGuides"' not in s:
        s=once(s,'</footer>',GUIDE_LINKS+'\n</footer>','guide links footer')
    return s

def patch_sw(s,site):
    pat=r"const CACHE = '([^']+)'"
    m=re.search(pat,s)
    if not m:raise ValueError('Service worker cache name not recognized')
    old=m.group(1)
    if site=='dev' and not old.startswith('flossfox-dev-'):raise ValueError('Dev cache isolation must be retained')
    if site=='production' and (old.startswith('flossfox-dev-') or not old.startswith('flossfox-')):
        raise ValueError('Production service worker cache namespace mismatch')
    if not re.search(r'-seo\d+$', old):
        s=s[:m.start(1)]+old+'-seo5'+s[m.end(1):]
    for filename in GUIDES:
        if f'"{filename}"' not in s:
            s=once(s,'  "about.html",','  "'+filename+'",\n  "about.html",','service worker guide cache')
    return s

def patch_manifest(s):
    data=json.loads(s)
    if data.get('name')!='Floss Fox':raise ValueError('Unexpected manifest name')
    data['description']='A friendly cross-stitch companion for floss conversion, thread collection, project planning, shopping lists and fabric calculations.'
    return json.dumps(data,indent=2,ensure_ascii=False)+'\n'

def patch_sitemap(s):
    if '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' not in s or '</urlset>' not in s:
        raise ValueError('Unexpected sitemap format')
    for filename in GUIDES:
        location=BASE+filename
        if location not in s:s=once(s,'</urlset>',f'  <url><loc>{location}</loc></url>\n</urlset>','sitemap')
    return s

def validate_output(changes,site):
    # All pages must be unique, the dev noindex preserved, and no existing functional data changed.
    for path in PAGES:
        s=changes[path];h=s[:s.index('</head>')]
        if s.count('<title>')!=1 or s.count('name="description"')!=1:
            raise ValueError(f'{path}: duplicate title or description')
        if 'id="ffSeoGuides"' not in s:raise ValueError(f'{path}: missing internal links')
        if site=='dev' and 'noindex' not in h:raise ValueError(f'{path}: dev noindex lost')
        if site=='production' and 'noindex' in h:raise ValueError(f'{path}: accidental production noindex')
    if 'data-nosnippet' not in changes['index.html']:raise ValueError('Search snippet exclusion missing')
    for path in GUIDES:
        s=changes[path]
        if site=='dev' and '<meta name="robots" content="noindex, nofollow">' not in s:raise ValueError('Dev guide not noindex')
        if site=='production' and f'<link rel="canonical" href="{BASE}{path}">' not in s:
            raise ValueError('Guide missing canonical')
        if s.count('<h1>')!=1:raise ValueError(f'{path}: missing unique heading')


def build(root,site):
    if not root.is_dir():raise ValueError('Repository root does not exist')
    needed=[*PAGES,'sw.js','manifest.webmanifest','robots.txt']
    if site=='production':needed.append('sitemap.xml')
    current={}
    for path in needed:
        if not (root/path).is_file():raise ValueError(f'Expected repository file missing: {path}')
        current[path]=(root/path).read_text(encoding='utf-8')
    if site=='production':
        if 'Sitemap: https://flossfox.com/sitemap.xml' not in current['robots.txt']:
            raise ValueError('Production robots.txt sitemap declaration needs review')
    # All metadata changes are prepared and validated before any disk write.
    changes={p:patch_page(p,current[p],site) for p in PAGES}
    changes['sw.js']=patch_sw(current['sw.js'],site)
    changes['manifest.webmanifest']=patch_manifest(current['manifest.webmanifest'])
    for path in GUIDES:
        generated=render_guide(path,site)
        if (root/path).exists():
            existing=(root/path).read_text(encoding='utf-8')
            # Never erase someone's edits to a generated guide without their approval.
            if existing!=generated:
                raise ValueError(f'{path} already exists with different content; manual merge required')
        changes[path]=generated
    if site=='production':changes['sitemap.xml']=patch_sitemap(current['sitemap.xml'])
    validate_output(changes,site)
    return {p:s for p,s in changes.items() if not (root/p).exists() or (root/p).read_text(encoding='utf-8')!=s}

def install(root,changes):
    # Pre-stage all files; attempt rollback on failure. Git is the canonical recovery mechanism.
    original={p:(root/p).read_bytes() if (root/p).exists() else None for p in changes}
    staged={}
    try:
        for path,body in changes.items():
            fd,tmp=tempfile.mkstemp(prefix='.flossfox-seo-',dir=root)
            with os.fdopen(fd,'w',encoding='utf-8',newline='') as f:f.write(body)
            target=root/path
            os.chmod(tmp, stat.S_IMODE(target.stat().st_mode) if target.exists() else 0o644)
            staged[path]=tmp
        done=[]
        try:
            for path,tmp in staged.items():
                os.replace(tmp,root/path);done.append(path)
        except Exception:
            for path in reversed(done):
                old=original[path]
                if old is None:(root/path).unlink(missing_ok=True)
                else:(root/path).write_bytes(old)
            raise
    finally:
        for tmp in staged.values():
            if os.path.exists(tmp):os.unlink(tmp)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('repo_root',type=Path)
    ap.add_argument('--site',choices=['dev','production'],required=True)
    ap.add_argument('--apply',action='store_true',help='Actually write files (default is dry-run)')
    args=ap.parse_args()
    root=args.repo_root.resolve()
    changes=build(root,args.site)
    if args.apply and changes:install(root,changes)
    action='Applied' if args.apply else 'DRY-RUN would apply'
    print(f'{action} {len(changes)} changed/new paths to {args.site} repository:')
    for path in sorted(changes):print(' - '+path)
    if not changes:print('No changes needed: already installed.')
    if args.site=='production':print('This only updates source files; publishing and Google recrawling are separate actions.')

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError) as e:
        print('SEO patch REFUSED:',e,file=sys.stderr);sys.exit(1)
