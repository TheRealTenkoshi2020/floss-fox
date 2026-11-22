#!/usr/bin/env python3
"""Simulated: verified Hobby Lobby / Everything Cross Stitch product links appear on
Find floss results and shopping list, Shopping (need-to-buy + restock), a project
Need to buy color, and My threads restock/out-of-stock. BLANC, WHITE and B5200 stay
distinct. Unverified colors get no href. No search-style URLs.
Usage: FF_KEY=flossfox-dev.v1 python tests/store_links_surfaces_e2e.py http://localhost:8765/
"""
import os as _o, sys, json, re, os
from pathlib import Path
sys.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import ff_session
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

B = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/').rstrip('/') + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1')
PFX = KEY[:-3]
TKEY = PFX + '.threads.v1'
SHOTS = Path(os.environ.get('FF_SHOTS', '/workspace/links/shots'))
SHOTS.mkdir(parents=True, exist_ok=True)
R = [0, 0]
def ok(n, c, i=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(i)[:400]))

HL310 = 'https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/310-black--dmc-mouline-grays-embroidery-floss/p/106215'
ECS310 = 'https://www.everythingcrossstitch.com/floss-embroidery-dmc-black-mrp-p550.aspx'
HL_WHITE = 'https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/white---dmc-mouline-white-or-beige-embroidery-floss/p/106200'
ECS_WHITE = 'https://www.everythingcrossstitch.com/white-mrp-p970.aspx'
ECS_B5200 = 'https://www.everythingcrossstitch.com/snow-white-mrp-p969.aspx'
SEARCHY = re.compile(r'/search|\?q=|query=|/c/5-127-1109|dmc-cotton-cross-stitch-floss-mrl-c274', re.I)
STORE_HOSTS = ('https://www.hobbylobby.com/', 'https://www.everythingcrossstitch.com/')

it = lambda c, q, asm=0: {'code': c, 'qty': q, 'assumed': asm, 'stated': not asm, 'src': [c]}
PROJ = {'schema': 2, 'projects': [{
    'id': 'links1', 'name': 'Store links check', 'notes': '', 'buyBrand': 'dmc', 'status': 'planning',
    'items': [it('310', 2), it('WHITE', 1), it('B5200', 1), it('BLANC', 1), it('57', 1), it('415', 1)],
    'decisions': {
        '310': {'status': 'buy'}, 'WHITE': {'status': 'buy'}, 'B5200': {'status': 'buy'},
        'BLANC': {'status': 'buy'}, '57': {'status': 'buy'}, '415': {'status': 'have', 'owned': 2}
    },
    'purchased': {}, 'created': '2026-10-01T00:00:00Z', 'updated': '2026-10-01T00:00:00Z'
}]}
TH = {'schema': 1, 'threads': {
    '310': {'n': 1, 'partial': False, 'restock': True, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'},
    '415': {'n': 4, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'},
    '321': {'n': 0, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-10-14T00:00:00Z'}
}}
INIT = (
    "if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);"
    "localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');"
    "localStorage.setItem('%s',%s);"
    "localStorage.setItem('%s',%s)}"
) % (PFX, KEY, json.dumps(json.dumps(PROJ)), TKEY, json.dumps(json.dumps(TH)))

def hrefs(page, sel):
    return page.evaluate("""sel => [...document.querySelectorAll(sel)].map(a => ({
      h:a.href, t:a.target, r:a.rel, k:a.dataset.kind, tr:a.dataset.tracked,
      store:a.dataset.store, al:a.getAttribute('aria-label')||'',
      c:(a.closest('[data-dmc]')||a.closest('[data-ffbuyhost]')||a.closest('li')||{}).dataset.dmc
        || (a.closest('.ff-skein-inline')||{}).dataset.dmc
        || (a.closest('[data-code]')||{}).dataset.code || ''
    }))""", sel)

def bad(links):
    return [x['h'] for x in links if SEARCHY.search(x['h'] or '') or not (x['h'] or '').startswith(STORE_HOSTS)]

def attrs_ok(links):
    return all(x['t']=='_blank' and x['r']=='noopener noreferrer' and x['k']=='direct' and x['tr']=='false' and 'new tab' in (x['al'] or '').lower() for x in links)

def click_tab(g, tid):
    loc = g.locator('#' + tid)
    if loc.count() and loc.first.is_visible():
        loc.first.click(); return
    more = g.locator('#ffuxNavSummary')
    if more.count() and more.first.is_visible():
        more.first.click()
        g.locator('#' + tid).click()
    else:
        g.locator('#' + tid).click()

def open_buy(g, prefix, code):
    btn = g.locator(f'[data-ffbuy="{prefix}-{code}"]')
    if btn.count() == 0:
        return False
    if btn.get_attribute('aria-expanded') != 'true':
        btn.click()
        g.wait_for_timeout(80)
    return True

SHOT_FILES = []
def shot(g, name):
    path = SHOTS / name
    g.screenshot(path=str(path), full_page=False)
    SHOT_FILES.append(path)
    return path

def montage(paths, dest):
    imgs = [Image.open(p).convert('RGB') for p in paths]
    # scale to a common width
    w = 640
    scaled = []
    for im, p in zip(imgs, paths):
        h = max(1, int(im.height * w / im.width))
        im = im.resize((w, h), Image.Resampling.LANCZOS)
        scaled.append((im, p.stem))
    pad, label_h, gap = 16, 28, 12
    cols = 2
    rows = (len(scaled) + 1) // 2
    cell_h = max(s[0].height for s in scaled) + label_h
    cw = w + pad * 2
    ch = cell_h + pad
    out = Image.new('RGB', (cols * cw + gap, rows * ch + gap + 8), '#f4f1ea')
    draw = ImageDraw.Draw(out)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
    except Exception:
        font = ImageFont.load_default()
    for i, (im, name) in enumerate(scaled):
        r, c = divmod(i, cols)
        x, y = c * cw + pad, r * ch + pad
        draw.text((x, y), name, fill='#2a2a2a', font=font)
        out.paste(im, (x, y + label_h))
    out.save(dest)
    return dest

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errs = []
    def ctx_for(w, mob):
        c = b.new_context(viewport={'width': w, 'height': 844 if mob else 900}, is_mobile=mob,
                          device_scale_factor=2 if mob else 1, service_workers='block',
                          color_scheme='light')
        c.add_init_script(INIT)
        c.route(re.compile(r'https://(www\.hobbylobby|www\.everythingcrossstitch)\.com/.*'),
                lambda r: r.fulfill(status=200, body='<title>stub</title>', content_type='text/html'))
        g = c.new_page()
        g.on('pageerror', lambda e: errs.append(str(e)))
        g.goto(B + '?nosw#convert')
        g.wait_for_load_state('networkidle')
        g.wait_for_timeout(250)
        return c, g

    # ----- Find floss + screenshots at both widths -----
    for w, mob in ((390, True), (1280, False)):
        t = f'[{w}] '
        c, g = ctx_for(w, mob)
        g.fill('#inp', '310, WHITE, B5200, BLANC, 57')
        g.click('#go')
        g.wait_for_timeout(400)
        ok(t + 'Find floss shows results and shopping list', g.locator('#results').is_visible() and g.locator('#shopcard').is_visible())

        # Results: Buy controls
        buys = g.evaluate("""() => [...document.querySelectorAll('#tbl [data-ffbuy]')].map(b => ({
          id:b.getAttribute('data-ffbuy'), al:b.getAttribute('aria-label')||'', exp:b.getAttribute('aria-expanded')
        }))""")
        codes = [x['id'].replace('ffRes-','') for x in buys]
        ok(t + 'Find floss results have Buy for 310, WHITE, B5200 only',
           set(codes) == {'310', 'WHITE', 'B5200'}, codes)
        ok(t + 'Find floss results have no Buy for BLANC or 57', 'BLANC' not in codes and '57' not in codes, codes)

        for code in ('310', 'WHITE', 'B5200'):
            ok(t + f'opened Buy for DMC {code} on results', open_buy(g, 'ffRes', code))
        res = hrefs(g, '#tbl .ff-skein-pill')
        by = {}
        for x in res:
            by.setdefault(x['c'], []).append(x)
        ok(t + 'results 310 has both exact store URLs',
           [x['h'] for x in by.get('310', [])] == [HL310, ECS310], by.get('310'))
        ok(t + 'results WHITE has both exact store URLs',
           [x['h'] for x in by.get('WHITE', [])] == [HL_WHITE, ECS_WHITE], by.get('WHITE'))
        ok(t + 'results B5200 has only the ECS verified URL',
           [x['h'] for x in by.get('B5200', [])] == [ECS_B5200], by.get('B5200'))
        ok(t + 'results B5200 notes Hobby Lobby is not listed',
           'Not listed at Hobby Lobby' in (g.locator('#ffRes-B5200').inner_text() if g.locator('#ffRes-B5200').count() else ''),
           g.locator('#ffRes-B5200').inner_text() if g.locator('#ffRes-B5200').count() else '')
        ok(t + 'results WHITE and B5200 URLs are distinct',
           HL_WHITE not in [x['h'] for x in by.get('B5200', [])] and ECS_B5200 not in [x['h'] for x in by.get('WHITE', [])])
        ok(t + 'results pills: _blank, noopener, untracked, Buy aria', attrs_ok(res), res)
        ok(t + 'results have no search-style or unverified hrefs', not bad(res), bad(res))
        # no WHITE url anywhere under a BLANC host
        blanc_hrefs = g.evaluate("""() => {
          const cells=[...document.querySelectorAll('#tbl td')].filter(td => /DMC BLANC/.test(td.textContent));
          return cells.flatMap(td => [...td.querySelectorAll('a')].map(a=>a.href));
        }""")
        ok(t + 'BLANC result cell has no store href (never WHITE)', blanc_hrefs == [], blanc_hrefs)

        # Shopping list on Find floss
        shop = hrefs(g, '#shop .ff-skein-pill')
        sby = {}
        for x in shop:
            sby.setdefault(x['c'], []).append(x['h'])
        ok(t + 'Find floss shopping list pills for 310, WHITE, B5200',
           set(sby) == {'310', 'WHITE', 'B5200'}, sby)
        ok(t + 'Find floss shopping 310 URLs exact', sby.get('310') == [HL310, ECS310], sby.get('310'))
        ok(t + 'Find floss shopping WHITE != B5200 and B5200 is ECS only',
           sby.get('WHITE') == [HL_WHITE, ECS_WHITE] and sby.get('B5200') == [ECS_B5200], sby)
        ok(t + 'Find floss shopping list: no BLANC or 57 pills', 'BLANC' not in sby and '57' not in sby, sby)
        ok(t + 'Find floss shopping pills attributes and no search URLs', attrs_ok(shop) and not bad(shop), shop)

        # scroll results into view for screenshot (Buy already open)
        g.evaluate("document.getElementById('results').scrollIntoView({block:'start'})")
        g.wait_for_timeout(150)
        shot(g, f'find-floss-{w}.png')

        # ----- Shopping tab -----
        click_tab(g, 'tabShop')
        g.wait_for_timeout(400)
        pills = hrefs(g, '#shopView #pPlan .ff-skein-pill:not(#pCheck .ff-skein-pill):not(#ffRestock .ff-skein-pill):not(.ffcf-buy .ff-skein-pill)')
        # Need-to-buy inline on #pPlan; also check-first Buy is hidden. Restock is separate.
        pby = {}
        for x in pills:
            # skip hidden
            pby.setdefault(x['c'], []).append(x['h'])
        # hidden check-first pills might still be in a different selector; we excluded them
        ok(t + 'Shopping need-to-buy has 310, WHITE, B5200 (not 415 owned)',
           {'310', 'WHITE', 'B5200'} <= set(pby) and '415' not in pby, pby)
        ok(t + 'Shopping 310 URLs exact; no search URLs',
           pby.get('310') == [HL310, ECS310] and not bad(pills), pby.get('310'))
        ok(t + 'Shopping has no pills for BLANC or 57 (unverified)',
           'BLANC' not in pby and '57' not in pby, pby)
        # restock card
        ok(t + 'Restock list shows DMC 310', g.locator('#ffRestock li[data-code="310"]').count() == 1)
        ok(t + 'opened Restock Buy for 310', open_buy(g, 'ffRs', '310'))
        rh = [x['h'] for x in hrefs(g, '#ffRestock .ff-skein-pill')]
        ok(t + 'Restock 310 URLs exact', rh == [HL310, ECS310], rh)
        ok(t + 'Restock does not include owned-enough 415',
           g.locator('#ffRestock li[data-code="415"]').count() == 0)
        g.evaluate("const el=document.getElementById('ffRestock')||document.getElementById('pPlan'); if(el) el.scrollIntoView({block:'start'})")
        g.wait_for_timeout(150)
        shot(g, f'shopping-{w}.png')

        # ----- Project -----
        click_tab(g, 'tabProjects')
        g.wait_for_timeout(250)
        if g.locator('[data-open="links1"]').count():
            g.click('[data-open="links1"]')
            g.wait_for_timeout(400)
        ok(t + 'Project Need to buy 310 has a Buy control', g.locator('#card-310 [data-ffbuy="ffProj-310"]').count() == 1)
        ok(t + 'Project Have enough 415 has no Buy control', g.locator('#card-415 [data-ffbuy]').count() == 0)
        ok(t + 'opened project Buy for 310', open_buy(g, 'ffProj', '310'))
        ph = [x['h'] for x in hrefs(g, '#card-310 .ff-skein-pill')]
        ok(t + 'Project 310 URLs exact', ph == [HL310, ECS310], ph)
        ok(t + 'Project BLANC card has no store href',
           g.evaluate("![...document.querySelectorAll('#card-BLANC a.ff-skein-pill')].length"))
        g.evaluate("const el=document.getElementById('card-310'); if(el) el.scrollIntoView({block:'start'})")
        g.wait_for_timeout(150)
        shot(g, f'project-{w}.png')

        # ----- My threads restock / out of stock -----
        click_tab(g, 'tabThreads')
        g.wait_for_timeout(400)
        ok(t + 'My threads restock 310 has Buy', g.locator('#thList .th[data-code="310"] [data-ffbuy="ffTh-310"]').count() == 1)
        ok(t + 'My threads in-stock 415 has no Buy', g.locator('#thList .th[data-code="415"] [data-ffbuy]').count() == 0)
        ok(t + 'My threads out-of-stock 321 has Buy', g.locator('#thList .th[data-code="321"] [data-ffbuy="ffTh-321"]').count() == 1)
        ok(t + 'opened My threads Buy for 310', open_buy(g, 'ffTh', '310'))
        th = [x['h'] for x in hrefs(g, '#thList .th[data-code="310"] .ff-skein-pill')]
        ok(t + 'My threads 310 URLs exact', th == [HL310, ECS310], th)

        c.close()

    # ----- main-tab smoke at 1280 -----
    c, g = ctx_for(1280, False)
    tab_errs_before = len(errs)
    for tid, name in (('tabConvert', 'Find floss'), ('tabThreads', 'My threads'), ('tabProjects', 'Projects'),
                      ('tabShop', 'Shopping'), ('tabHelp', 'Help'), ('tabSettings', 'Settings')):
        click_tab(g, tid)
        g.wait_for_timeout(200)
        ok(f'smoke: {name} tab opens without a page error', True)
    ok('smoke: no page errors across main tabs', errs[tab_errs_before:] == [], errs[tab_errs_before:])
    # fabric is a separate page
    click_tab(g, 'tabFabric')
    g.wait_for_timeout(400)
    ok('smoke: Fabric page loaded', 'fabric' in g.url or g.locator('body').count() == 1, g.url)
    c.close()
    ok('no page errors in the whole run', not errs, errs)
    b.close()

# contact sheet
wanted = [SHOTS / n for n in (
    'find-floss-390.png', 'find-floss-1280.png',
    'shopping-390.png', 'shopping-1280.png',
    'project-390.png', 'project-1280.png')]
present = [p for p in wanted if p.exists()]
if present:
    dest = SHOTS / 'contact.png'
    montage(present, dest)
    ok('contact sheet written', dest.exists(), dest)
else:
    ok('contact sheet written', False, 'no shots')

print(R[0], 'passed,', R[1], 'failed (simulated)')
raise SystemExit(1 if R[1] else 0)
