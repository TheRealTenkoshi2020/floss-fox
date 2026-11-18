#!/usr/bin/env python3
"""3.9 Atelier Stage E polish (Pixel REVIEW-39-stageE.md, no blockers).
Print slip, pressed-state contrast on dark, Delete preset, timer badge, gallery cards.
SIMULATED: headless Chrome with synthetic data, not real phones.
Phone shots use full_page=False so mobile emulation holds.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_stagee_polish_e2e.py http://localhost:PORT/
"""
import sys, os, json, re
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': 40}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321'], leftOff='Finished page 2'),
    proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z'),
    proj('p3', 'Single Color Motif', ['310'], leftOff='One more leaf')]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 2, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}

def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET}
    if extra: s.update(extra)
    return s

def ctx(br, seed, w=1280, h=900, landing_seen=True, touch=False, color_scheme=None):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block')
    if touch:
        kw['has_touch'] = True; kw['is_mobile'] = True
    if color_scheme:
        kw['color_scheme'] = color_scheme
    c = br.new_context(**kw)
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}%s"
        % (json.dumps(seed), "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" if landing_seen else ''))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects')
    g.wait_for_timeout(200)

def parse_rgb(s):
    m = re.search(r'rgba?\((\d+),\s*(\d+),\s*(\d+)', s or '')
    if not m: return None
    return tuple(int(m.group(i)) for i in (1, 2, 3))

def rel(c):
    def lin(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def contrast_ratio(a, b):
    L1, L2 = sorted((rel(a), rel(b)))
    return (L2 + 0.05) / (L1 + 0.05)

def is_near_white(c):
    return c and min(c) >= 240

def is_near_black(c):
    return c and max(c) <= 30

def is_navy(c):
    # Moonlit page fill #141a2e and Forest #10201b
    return c and c[2] >= c[0] and max(c) <= 55 and c[2] - c[0] >= 5 or (c and max(c) <= 40 and min(c) <= 25)

def styles(g, sel):
    return g.evaluate("""(sel) => {
      const el=document.querySelector(sel); if(!el) return null;
      const cs=getComputedStyle(el);
      return {fill:cs.fill, stroke:cs.stroke, color:cs.color, bg:cs.backgroundColor, bgImg:cs.backgroundImage};
    }""", sel)

def btn_colors(g, sel, hover=False):
    return g.evaluate("""([sel, hover]) => {
      const el=document.querySelector(sel); if(!el) return null;
      if(hover){
        el.scrollIntoView({block:'center'});
        el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
        el.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
      }
      const cs=getComputedStyle(el);
      return {bg:cs.backgroundColor, fg:cs.color, border:cs.borderTopColor, pressed:el.getAttribute('aria-pressed')};
    }""", [sel, hover])

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    moon = {AK: json.dumps({'v':1,'theme':'moon','projectsView':'gallery','sessionTimer':True,'collectionView':'shelf'})}

    # ---- 1. Cutting slip prints light on Moonlit and Forest ----
    for theme, label in (('moon','Moonlit'),('forest','Forest')):
        seed = seed_all({AK: json.dumps({'v':1,'theme':theme})})
        c, g = ctx(br, seed)
        g.goto(B + 'fabric.html?nosw')
        g.wait_for_function('window.FlossFoxFabric&&window.FlossFoxFabricUI')
        g.wait_for_timeout(200)
        ok(f'print prep: {label} is the active atelier theme', g.evaluate("()=>document.documentElement.getAttribute('data-atelier-theme')")==theme)
        # screen may be dark; print must not be
        g.emulate_media(media='print')
        g.wait_for_timeout(100)
        body = styles(g, 'body')
        cut = styles(g, '#fcDiagram .fc-cut')
        stitched = styles(g, '#fcDiagram .fc-stitched')
        h1 = styles(g, 'h1')
        body_bg, body_fg = parse_rgb(body and body['bg']), parse_rgb(body and body['color'])
        cut_fill, cut_stroke = parse_rgb(cut and cut['fill']), parse_rgb(cut and cut['stroke'])
        st_fill, st_stroke = parse_rgb(stitched and stitched['fill']), parse_rgb(stitched and stitched['stroke'])
        head = parse_rgb(h1 and h1['color'])
        ok(f'print {label}: body is a white (or linen) sheet, not navy', body_bg and not is_navy(body_bg) and (is_near_white(body_bg) or min(body_bg)>=230), body)
        ok(f'print {label}: body text is dark', body_fg and is_near_black(body_fg) or (body_fg and max(body_fg)<=50), body)
        ok(f'print {label}: .fc-cut fill is white, not navy', cut_fill and is_near_white(cut_fill) and not is_navy(cut_fill), cut)
        ok(f'print {label}: .fc-cut stroke is black', cut_stroke and is_near_black(cut_stroke), cut)
        ok(f'print {label}: .fc-stitched is a light fill with a black line', st_fill and not is_navy(st_fill) and st_stroke and is_near_black(st_stroke), stitched)
        ok(f'print {label}: heading text is dark, not pale on white', head and max(head)<=50, h1)
        # Stage F polish #5: result numbers must not sit on a theme-colored bar
        if g.locator('#fcCutNum').count():
            num = styles(g, '#fcCutNum')
            nbg = parse_rgb(num and num['bg'])
            ok(f'print {label}: .fcres .num has no theme-colored bar', nbg is None or (nbg[3] if len(nbg)>3 else 1)==0 or is_near_white(nbg[:3]) or (num and ('rgba(0, 0, 0, 0)' in str(num['bg']) or num['bg'] in ('transparent','rgba(0,0,0,0)'))), num)
        g.screenshot(path=os.path.join(SHOTS, f'stageE-polish-print-{theme}-1280.png'), full_page=False)
        g.emulate_media(media='screen')
        if g.locator('#fcCutNum').count():
            num = styles(g, '#fcCutNum')
            nbg = parse_rgb(num and num['bg'])
            ok(f'screen {label}: .fcres .num has no theme-colored bar', nbg is None or (num and ('rgba(0, 0, 0, 0)' in str(num['bg']) or 'transparent' in str(num['bg']))) or (nbg and is_near_white(nbg[:3])), num)
        ok(f'print {label}: no page errors', not g.errs, g.errs)
        c.close()

    # ---- 2+4. Pressed view buttons stay readable on dark, including hover ----
    c, g = ctx(br, seed_all(moon))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabThreads'); g.wait_for_timeout(250)
    # Shelf should already be pressed from collectionView
    if g.locator('.ffa-seg button[data-view=shelf]').count():
        g.click('.ffa-seg button[data-view=shelf]'); g.wait_for_timeout(150)
    sel = '.ffa-seg button[aria-pressed="true"]'
    ok('pressed: a Shelf/List/Grid button is pressed', g.locator(sel).count()==1, g.locator('.ffa-seg button').count())
    rest = btn_colors(g, sel, False)
    g.locator(sel).hover()
    hov = btn_colors(g, sel, True)
    def check_pressed(name, cols):
        bg, fg = parse_rgb(cols and cols['bg']), parse_rgb(cols and cols['fg'])
        ratio = contrast_ratio(bg, fg) if bg and fg else 0
        ok(f'{name}: pressed colors are tab-on and AA (>=4.5:1)', bg and fg and ratio>=4.5 and not (max(bg)<=60 and max(fg)<=60), (cols, round(ratio,2) if ratio else None))
        return ratio
    check_pressed('threads pressed (Moonlit)', rest)
    check_pressed('threads pressed+hover (Moonlit)', hov)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-pressed-threads-1280.png'), full_page=False)

    g.click('#tabProjects'); g.wait_for_timeout(250)
    if g.locator('#ffaViewBar [data-view=gallery]').count():
        g.click('#ffaViewBar [data-view=gallery]'); g.wait_for_timeout(200)
    gsel = '#ffaViewBar .ffa-viewbtn[aria-pressed="true"]'
    ok('gallery: a List/Gallery button is pressed', g.locator(gsel).count()==1)
    grest = btn_colors(g, gsel, False)
    g.locator(gsel).hover()
    ghov = btn_colors(g, gsel, True)
    check_pressed('gallery toggle pressed (Moonlit)', grest)
    check_pressed('gallery toggle pressed+hover (Moonlit)', ghov)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-pressed-gallery-1280.png'), full_page=False)

    # ---- 6. Gallery cards ----
    ok('gallery: cards are left-aligned', g.evaluate("() => getComputedStyle(document.querySelector('#projList.ffa-gallery>li.ffa-gcard')).textAlign")=='left')
    grid = g.evaluate("""() => {
      const ul=document.querySelector('#projList.ffa-gallery');
      const cs=getComputedStyle(ul);
      const cards=[...ul.querySelectorAll('li.ffa-gcard')].map(el=>Math.round(el.getBoundingClientRect().width));
      return {tpl:cs.gridTemplateColumns, n:cards.length, widths:cards};
    }""")
    ok('gallery: 1280 grid uses auto-fill minmax 220px (not a fixed 4-column track that leaves 2-card gaps)',
       '220px' in (grid['tpl'] or '') or all(w>=210 for w in (grid['widths'] or [])), grid)
    # two/three cards should be wider than a 4-column 175px slot
    if grid and grid['widths']:
        ok('gallery: card width is at least 220px at 1280', min(grid['widths'])>=210, grid)
    # single-color project: swatch must not fill the whole cover
    dims = g.evaluate("""() => {
      const card=[...document.querySelectorAll('#projList li.ffa-gcard')].find(li => (li.innerText||'').includes('Single Color Motif'));
      if(!card) return null;
      const cover=card.querySelector('.ffa-cover');
      const sw=card.querySelector('.ffa-cover .ffa-strip .ffa-floss, .ffa-cover .ffa-strip span');
      if(!cover||!sw) return {missing:true};
      const cr=cover.getBoundingClientRect(), sr=sw.getBoundingClientRect();
      const note=card.querySelector('.ffa-gnote'), codes=card.querySelector('.ffa-gcodes'), title=card.querySelector('.pname');
      const lefts={note:note&&Math.round(note.getBoundingClientRect().left), codes:codes&&Math.round(codes.getBoundingClientRect().left), title:title&&Math.round(title.getBoundingClientRect().left), card:Math.round(card.getBoundingClientRect().left)};
      return {cw:Math.round(cr.width), sw:Math.round(sr.width), ratio: sr.width/cr.width, lefts, ta:getComputedStyle(card).textAlign};
    }""")
    ok('gallery: single-color project uses a swatch strip, not a full-bleed black slab',
       dims and not dims.get('missing') and dims['ratio'] < 0.4 and dims['sw'] < dims['cw']*0.4, dims)
    if dims and dims.get('lefts'):
        L = dims['lefts']
        ok('gallery: color list and left-off note share the title\'s left edge',
           L['title'] and L['codes'] and L['note'] and abs(L['codes']-L['title'])<=8 and abs(L['note']-L['title'])<=8, L)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-gallery-1280.png'), full_page=False)
    ok('gallery: no page errors', not g.errs, g.errs)
    c.close()

    # ---- 5. Timer running badge does not stretch to the clock height ----
    c, g = ctx(br, seed_all({AK: json.dumps({'v':1,'theme':'moon','sessionTimer':True})}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(150)
    g.evaluate("() => FlossFoxProjects.openProject('p1')")
    g.wait_for_timeout(250)
    if g.locator('#ffaSessionStart').count():
        g.click('#ffaSessionStart'); g.wait_for_timeout(200)
    if g.locator('#ffaTimerStart').count():
        g.click('#ffaTimerStart'); g.wait_for_timeout(300)
        box = g.evaluate("""() => {
          const b=document.querySelector('.ffa-session .ffa-badge, #ffaTimerRun');
          const c=document.querySelector('.ffa-session .ffa-clock');
          if(!b||!c) return null;
          const br=b.getBoundingClientRect(), cr=c.getBoundingClientRect();
          return {bh:Math.round(br.height), ch:Math.round(cr.height), align:getComputedStyle(b).alignSelf};
        }""")
        ok('timer badge: align-self is center and height is well under the clock',
           box and box['align']=='center' and box['bh'] < box['ch'] * 0.7, box)
        g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-timer-badge-1280.png'), full_page=False)
    else:
        ok('timer badge: Start timer is present when the pref is on', False)
    ok('timer badge: no page errors', not g.errs, g.errs)
    c.close()

    # ---- 3. Delete preset is a .sec button ----
    c, g = ctx(br, seed_all(moon))
    g.goto(B + 'fabric.html?nosw')
    g.wait_for_function('window.FlossFoxFabric&&window.FlossFoxFabricUI')
    g.wait_for_timeout(200)
    # save a named preset so Delete appears
    if g.locator('#fcPresetName').count():
        g.fill('#fcPresetName', 'Tea towel')
        if g.locator('#fcPresetSave, #fcSavePreset, button:has-text("Save preset")').count():
            # try common ids
            if g.locator('#fcPresetSave').count(): g.click('#fcPresetSave')
            elif g.locator('#fcSavePreset').count(): g.click('#fcSavePreset')
            else: g.click('button:has-text("Save preset")')
            g.wait_for_timeout(200)
    cls = g.evaluate("() => { const b=document.querySelector('[data-del]'); return b?b.className:null }")
    ok('delete preset: uses class sec, not ghost or the unstyled UA button', cls and 'sec' in cls.split() and 'ghost' not in cls.split(), cls)
    if g.locator('[data-del]').count():
        box = g.locator('[data-del]').first.bounding_box()
        ok('delete preset: meets 44px', box and box['height']>=44, box)
        # contrast of the sec button on Moonlit
        cols = btn_colors(g, '[data-del]', False)
        bg, fg = parse_rgb(cols and cols['bg']), parse_rgb(cols and cols['fg'])
        # transparent bg: compare against surface behind
        if bg and fg and bg==(0,0,0) or (cols and '0, 0, 0, 0' in (cols['bg'] or '')):
            # sample the computed color only; sec text should be the sec-text token, not UA grey #6b6b6b
            ok('delete preset: text is a theme token, not UA grey #6b6b6b', fg and fg!=(107,107,107) and max(fg)>80, cols)
        else:
            ratio = contrast_ratio(bg, fg) if bg and fg else 0
            ok('delete preset: contrast is at least 4.5:1 on Moonlit', ratio>=4.5, (cols, round(ratio,2) if ratio else None))
        g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-delete-preset-1280.png'), full_page=False)
    ok('delete preset: no page errors', not g.errs, g.errs)
    c.close()

    # ---- D2: live theme switch changes Pip art (Morning after Moonlit) ----
    c, g = ctx(br, seed_all({AK: json.dumps({'v':1,'theme':'moon','seasonalPip':False})}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabConvert'); g.wait_for_timeout(200)
    before = g.evaluate("() => ({src:pipImg&&pipImg.src, show:pipImg&&pipImg.dataset.show, media:pipSrcDark&&pipSrcDark.media, theme:document.documentElement.getAttribute('data-atelier-theme')})")
    g.click('#tabSettings'); g.wait_for_timeout(150)
    g.check('#ffTheme-morning'); g.wait_for_timeout(300)
    g.click('#tabConvert'); g.wait_for_timeout(200)
    after = g.evaluate("() => ({src:pipImg&&pipImg.src, show:pipImg&&pipImg.dataset.show, media:pipSrcDark&&pipSrcDark.media, theme:document.documentElement.getAttribute('data-atelier-theme'), scheme:document.documentElement.getAttribute('data-atelier-scheme')})")
    ok('D2: switching to Morning updates the theme and uses gardener with dark sources off',
       after['theme']=='morning' and after['scheme']=='light' and 'gardener' in (after['src'] or '') and after['media']=='not all', (before, after))
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-D2-live-theme-1280.png'), full_page=False)
    ok('D2: no page errors', not g.errs, g.errs)
    c.close()

    # ---- D5: Morning on a dark OS keeps the hero flourish ----
    c, g = ctx(br, seed_all({AK: json.dumps({'v':1,'theme':'morning'})}), color_scheme='dark')
    g.goto(B + '?nosw'); ready(g)
    fl = g.evaluate("() => ({fl:getComputedStyle(document.documentElement).getPropertyValue('--flourish-l').trim(), theme:document.documentElement.getAttribute('data-atelier-theme'), scheme:document.documentElement.getAttribute('data-atelier-scheme'), pbg:getComputedStyle(document.documentElement).getPropertyValue('--pbg').trim()})")
    ok('D5: Morning on a dark OS keeps its flourish (not Forest none)', fl['fl'] and fl['fl'] not in ('none','') and 'url(' in fl['fl'] and fl['theme']=='morning' and fl['scheme']=='light', fl)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-D5-morning-dark-os-1280.png'), full_page=False)
    ok('D5: no page errors', not g.errs, g.errs)
    c.close()

    # ---- D8: kit plural "0 of 1 skein" ----
    one = {'schema': 2, 'projects': [proj('p1', 'Tiny Bookmark', ['321'], leftOff='Start the stem')]}
    c, g = ctx(br, seed_all({KEY: json.dumps(one)}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(150)
    g.evaluate("() => FlossFoxProjects.openProject('p1')")
    g.wait_for_timeout(300)
    # The kit heading is in the summary even when the details element is closed or off-screen.
    # Shop is the usual home of #pKit; open it if the project page does not expose the text yet.
    text = g.evaluate("() => (document.getElementById('pKitH')||{}).textContent||''") or ''
    if '0 of 1' not in text:
        if g.locator('#pKitGo').count() and g.locator('#pKitGo').is_visible():
            g.click('#pKitGo'); g.wait_for_timeout(400)
        else:
            g.click('#tabShop'); g.wait_for_timeout(400)
        text = g.evaluate("() => (document.getElementById('pKitH')||{}).textContent||''") or g.evaluate("() => (document.getElementById('pKit')||{}).innerText||''")
    ok('D8: kit heading uses the singular "0 of 1 skein set aside"',
       '0 of 1 skein set aside' in text and '0 of 1 skeins' not in text, text[:300])
    g.evaluate("""() => { const k=document.getElementById('pKit'); if(k){ k.hidden=false; k.open=true; k.scrollIntoView({block:'center'}); } }""")
    g.wait_for_timeout(150)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-D8-kit-plural-1280.png'), full_page=False)
    ok('D8: no page errors', not g.errs, g.errs)
    c.close()

    # ---- 390 phone shots (full_page=False so hover:none / mobile emulation holds) ----
    c, g = ctx(br, seed_all(moon), w=390, h=860, touch=True)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabThreads'); g.wait_for_timeout(200)
    if g.locator('.ffa-seg button[data-view=shelf]').count():
        g.click('.ffa-seg button[data-view=shelf]'); g.wait_for_timeout(150)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-threads-390.png'), full_page=False)
    g.click('#tabProjects'); g.wait_for_timeout(200)
    if g.locator('#ffaViewBar [data-view=gallery]').count():
        g.click('#ffaViewBar [data-view=gallery]'); g.wait_for_timeout(200)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-gallery-390.png'), full_page=False)
    g.evaluate("() => FlossFoxProjects.openProject('p1')")
    g.wait_for_timeout(250)
    if g.locator('#ffaSessionStart').count():
        g.click('#ffaSessionStart'); g.wait_for_timeout(200)
    if g.locator('#ffaTimerStart').count():
        g.click('#ffaTimerStart'); g.wait_for_timeout(200)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-timer-390.png'), full_page=False)
    ok('390: no page errors', not g.errs, g.errs)
    c.close()

    c, g = ctx(br, seed_all(moon), w=390, h=860, touch=True)
    g.goto(B + 'fabric.html?nosw')
    g.wait_for_function('window.FlossFoxFabric&&window.FlossFoxFabricUI')
    g.wait_for_timeout(200)
    g.screenshot(path=os.path.join(SHOTS, 'stageE-polish-fabric-390.png'), full_page=False)
    ok('390 fabric: no page errors', not g.errs, g.errs)
    c.close()

    br.close()

print(f"\natelier_stagee_polish_e2e (simulated): {R[0]} passed, {R[1]} failed")
sys.exit(1 if R[1] else 0)
