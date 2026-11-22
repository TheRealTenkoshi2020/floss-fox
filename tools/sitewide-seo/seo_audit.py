#!/usr/bin/env python3
"""Floss Fox SEO static audit — stdlib only, no network and no writes.
Usage: python seo_audit.py /path/to/repo --site dev|production
"""
from argparse import ArgumentParser
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse,unquote

PAGES=('index.html','fabric.html','about.html','privacy.html','tools.html','floss-conversion-guide.html','thread-inventory-guide.html','cross-stitch-project-planning.html')
EXCLUDED=('404.html','offline.html')
SITE='https://flossfox.com/'

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.title=[];self.in_title=False;self.meta=[];self.links=[];self.headings=[];self.in_h1=False;self.h1=[];self.local_hrefs=[];self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='title':self.in_title=True
        if tag=='meta':self.meta.append(a)
        if tag=='link':self.links.append(a)
        if tag=='a' and 'href'in a:self.local_hrefs.append(a['href'])
        if tag=='img':self.images.append(a)
        if tag=='h1':self.in_h1=True;self.h1.append('')
    def handle_endtag(self,tag):
        if tag=='title':self.in_title=False
        if tag=='h1':self.in_h1=False
    def handle_data(self,data):
        if self.in_title:self.title.append(data)
        if self.in_h1 and self.h1:self.h1[-1]+=data
    def find_meta(self,k,v):return [a for a in self.meta if a.get(k)==v]


def audit(root,site):
    errors=[];warnings=[];infos=[];seen={}
    def bad(s):errors.append(s)
    for filename in (*PAGES,*EXCLUDED):
        file=root/filename
        if not file.exists():bad(f'Missing page: {filename}');continue
        data=file.read_text(encoding='utf8');p=Page();p.feed(data);title=''.join(p.title).strip()
        if len(title)<10:bad(f'{filename}: missing or short title')
        if filename in PAGES:
            if title in seen:bad(f'{filename}: duplicate title shared with {seen[title]}')
            seen[title]=filename
            desc=p.find_meta('name','description')
            if len(desc)!=1:bad(f'{filename}: expected exactly one meta description')
            elif len(desc[0].get('content',''))<70:warnings.append(f'{filename}: unusually short description')
            for name in ('og:title','og:description','og:image'):
                if len(p.find_meta('property',name))!=1:bad(f'{filename}: missing or duplicate {name}')
            robots=p.find_meta('name','robots');noindex=any('noindex' in x.get('content','') for x in robots)
            if site=='dev' and not noindex:bad(f'{filename}: dev page missing noindex')
            if site=='production' and noindex:bad(f'{filename}: production page incorrectly noindex')
            canonical=[x.get('href') for x in p.links if x.get('rel')=='canonical']
            want=SITE if filename=='index.html' else SITE+filename
            if site=='production' and canonical!=[want]:bad(f'{filename}: canonical mismatch {canonical}, expected {want}')
            if site=='dev' and canonical:bad(f'{filename}: dev page should not have canonical')
            if filename not in ('index.html','about.html','privacy.html','fabric.html') and len(p.h1)!=1:bad(f'{filename}: needs exactly one h1')
        else:
            robots=p.find_meta('name','robots')
            if not any('noindex' in x.get('content','') for x in robots):bad(f'{filename}: utility page must be noindex')
        for ref in p.local_hrefs:
            if ref.startswith(('#','mailto:','tel:','https:','http:','javascript:')):continue
            u=urlparse(ref);path=unquote(u.path)
            if path.startswith('/'):path=path.lstrip('/')
            if path and not (root/path).exists():bad(f'{filename}: broken local link {ref}')
        for im in p.images:
            src=im.get('src','')
            if not src:bad(f'{filename}: image missing src')
            elif src.startswith('assets/') and not (root/src).is_file():bad(f'{filename}: missing image {src}')
            if 'alt' not in im:bad(f'{filename}: image missing alt text')
    if site=='production':
        f=root/'sitemap.xml'
        if not f.is_file():bad('Missing sitemap.xml')
        else:
            try:
                tree=ET.parse(f)
                all_locs=[x.text for x in tree.iter() if x.tag.endswith('loc')]
                for page in PAGES:
                    target=SITE if page=='index.html' else SITE+page
                    if target not in all_locs:bad(f'Sitemap is missing {target}')
                for loc in all_locs:
                    if not loc.startswith(SITE):bad(f'Sitemap contains off-domain URL {loc}')
            except ET.ParseError as e:bad(f'Invalid sitemap XML: {e}')
        robots=root/'robots.txt'
        if not robots.exists() or 'Sitemap: '+SITE+'sitemap.xml' not in robots.read_text():bad('robots.txt missing canonical sitemap')
    infos.append(f'{len(PAGES)} indexable/intended pages, {len(EXCLUDED)} noindex utility pages checked')
    return errors,warnings,infos


def main():
    ap=ArgumentParser(description=__doc__);ap.add_argument('root',type=Path);ap.add_argument('--site',choices=['dev','production'],required=True);a=ap.parse_args()
    errors,warnings,infos=audit(a.root,a.site)
    for line in infos:print('INFO:',line)
    for line in warnings:print('WARN:',line)
    for line in errors:print('FAIL:',line)
    print(f'Checks completed: {len(errors)} errors, {len(warnings)} warnings')
    return 1 if errors else 0
if __name__=='__main__':sys.exit(main())
