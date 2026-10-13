#!/usr/bin/env python3
"""Custom-domain check: CNAME, canonical, og:url/og:image, sitemap and robots all use https://flossfox.com/
(non-www canonical). Works on local files, or with a BASE URL (e.g. https://flossfox.com/ or http://localhost:8765/).
Production/dev detection elsewhere stays 'floss-fox-dev' in BASE, so flossfox.com and localhost count as production.
Usage: python tests/domain_check.py [BASE_URL]"""
import sys, os, re, urllib.request
ORIGIN = 'https://flossfox.com/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
B = sys.argv[1] if len(sys.argv) > 1 else None
def get(p):
    if B: return urllib.request.urlopen((B if B.endswith('/') else B + '/') + p).read().decode()
    return open(os.path.join(ROOT, p), encoding='utf8').read()
R = {'pass': 0, 'fail': 0}
def ok(n, c): R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n)
ok('CNAME is flossfox.com', get('CNAME').strip() == 'flossfox.com')
for f, path in [('index.html', ''), ('fabric.html', 'fabric.html'), ('about.html', 'about.html'), ('privacy.html', 'privacy.html')]:
    s = get(f); m = re.search(r'rel="canonical" href="([^"]+)"', s)
    ok(f + ' canonical', m and m.group(1) == ORIGIN + path)
s = get('index.html')
ok('og:url', 'property="og:url" content="%s"' % ORIGIN in s); ok('og:image', 'content="%sog-image.png"' % ORIGIN in s)
ok('robots Sitemap', 'Sitemap: %ssitemap.xml' % ORIGIN in get('robots.txt'))
locs = re.findall(r'<loc>([^<]+)</loc>', get('sitemap.xml')); ok('sitemap locs all on origin', locs and all(l.startswith(ORIGIN) for l in locs))
for f in ['index.html', 'fabric.html', 'about.html', 'privacy.html', 'robots.txt', 'sitemap.xml']:
    ok(f + ' has no github.io / www / /floss-fox/ refs', not re.search(r'github\.io|www\.flossfox|(?<!TheRealTenkoshi2020)/floss-fox/', get(f)))
print('RESULT', R); sys.exit(1 if R['fail'] else 0)
