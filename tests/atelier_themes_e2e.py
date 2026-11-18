#!/usr/bin/env python3
"""3.9 Atelier Stage D: appearance (System / Morning Linen / Forest Twilight / Moonlit Threads).
Theme is stored only in the Atelier preference key, the same way Resume and Seasonal Pip are
(the backup file's prefs object does not include the atelier key; Myke would have to ask for that).
Reset display settings restores System. Pip art and the lantern halo follow the chosen scheme;
Moonlit uses starlight art. Boot script sets attributes before stylesheets (no flash). Contrast
on text stays WCAG AA. BLANC/WHITE swatches keep a visible edge in every theme. Projects and
threads stay byte-identical after switching themes and visiting every tab.
SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_themes_e2e.py http://localhost:8981/
"""
import sys, os, json, re
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
CJS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contrast.js'), encoding='utf-8').read()
# Pixel tokens (atelier/themes.css / TOKENS.md)
PBG = {'morning': 'rgb(250, 246, 238)', 'forest': 'rgb(16, 32, 27)', 'moon': 'rgb(20, 26, 46)'}
SCHEME = {'morning': 'light', 'forest': 'dark', 'moon': 'dark'}
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:400]))

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': None}
def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p
PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321', '3865', '797', '725', '433'], leftOff='Finished page 2'),
    proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z')]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 2, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z', 'storage': {'container': 'Box 2', 'slot': 'Row B'}},
    'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
BOOT_PROBE = """
(()=>{try{window.__themeBoot=window.__themeBoot||[];
const orig=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(n,v){
  const r=orig.call(this,n,v);
  if((n==='data-atelier-theme'||n==='data-atelier-scheme')&&this===document.documentElement){
    window.__themeBoot.push({t:performance.now(),theme:document.documentElement.getAttribute('data-atelier-theme'),scheme:document.documentElement.getAttribute('data-atelier-scheme')});
  }
  return r;
};
}catch(e){window.__themeBoot.push('probe-error:'+String(e));}})();
"""

def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET}
    if extra: s.update(extra)
    return s

def ctx(br, seed, w=1200, h=900, landing_seen=True, color_scheme='light', touch=False, reduced_motion=None):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block', color_scheme=color_scheme)
    if touch:
        kw['has_touch'] = True; kw['is_mobile'] = True
    if reduced_motion:
        kw['reduced_motion'] = reduced_motion
    c = br.new_context(**kw)
    c.add_init_script(BOOT_PROBE)
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}%s"
        % (json.dumps(seed), "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" if landing_seen else ''))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxThreadsUI&&window.FlossFoxAtelierTheme')
    g.wait_for_timeout(200)

def html_theme(g):
    return g.evaluate("({theme:document.documentElement.getAttribute('data-atelier-theme'),scheme:document.documentElement.getAttribute('data-atelier-scheme'),pbg:getComputedStyle(document.documentElement).getPropertyValue('--pbg').trim(),color:document.documentElement.getAttribute('data-atelier-scheme')})")

def pbg_of(g):
    return g.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--pbg').trim()")

def rgb(s):
    s = (s or '').strip()
    if s.startswith('#'):
        h = s[1:]
        if len(h) == 3: h = ''.join(ch * 2 for ch in h)
        return 'rgb(%d, %d, %d)' % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return s

def atelier(g):
    raw = g.evaluate(f"localStorage.getItem('{AK}')")
    return None if raw is None else json.loads(raw)

def data_keys(g):
    return g.evaluate(f"[localStorage.getItem('{KEY}'), localStorage.getItem('{TK}')]")

def pick_theme(g, name):
    g.click('#tabSettings'); g.wait_for_timeout(150)
    g.locator('#ffAtelierPrefs').scroll_into_view_if_needed()
    g.check(f'#ffTheme-{name}')
    g.wait_for_timeout(200)

def visit_tabs(g):
    for tab in ('Workbasket', 'Convert', 'Threads', 'Projects', 'Shop', 'Help', 'Settings'):
        if g.locator('#tab' + tab).count() and g.locator('#tab' + tab).is_visible():
            g.click('#tab' + tab); g.wait_for_timeout(80)

def pip_dark_media(g):
    return g.evaluate("(()=>{const s=document.getElementById('pipSrcDark');return s?s.media:null})()")

def swatch_ok(g, code):
    return g.evaluate("""(code)=>{
      const nodes=[...document.querySelectorAll('.ffa-floss,[class*=\"floss\"]')].filter(el=>{
        const a=(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.dataset.code||'');
        return a.includes('DMC '+code) || a.split(/\\s+/).includes(code);
      });
      if(!nodes.length){
        // palette items use aria-label from copy: "DMC BLANC" etc.
        const all=[...document.querySelectorAll('#workbasketView .ffa-floss, #thList .ffa-floss, .ffa-strip .ffa-floss')];
        return {found:false, n:all.length, labels:all.map(e=>e.getAttribute('aria-label')||e.title||'')};
      }
      return nodes.map(el=>{
        const cs=getComputedStyle(el), parent=el.parentElement&&getComputedStyle(el.parentElement);
        const bw=parseFloat(cs.borderTopWidth)||0;
        const bc=cs.borderTopColor;
        return {found:true, label:el.getAttribute('aria-label')||el.title, borderW:bw, border:bc, bg:cs.backgroundColor, display:cs.display, w:el.getBoundingClientRect().width, h:el.getBoundingClientRect().height};
      })[0];
    }""", code)

def contrast(g, where):
    r = g.evaluate(CJS)
    fails = r.get('fails') or []
    ok(f'contrast AA on text ({where})', len(fails) == 0, {'min': r.get('min'), 'checked': r.get('checked'), 'fails': fails[:8]})
    return r

def shot(g, theme, view, w):
    path = f'{SHOTS}/stageD-{theme}-{view}-{w}.png'
    g.screenshot(path=path, full_page=True)
    return path

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # 1. Default System, no pref key, follows a light OS as Morning Linen
    c, g = ctx(br, seed_all(), 1280, 900, color_scheme='light')
    g.goto(B + '?nosw'); ready(g)
    t = html_theme(g)
    ok('default: data-atelier-theme is system', t['theme'] == 'system', t)
    ok('default: light OS maps to scheme=light (Morning Linen tokens)', t['scheme'] == 'light' and rgb(pbg_of(g)) == PBG['morning'], (t, pbg_of(g)))
    ok('default: visiting did not create the preference key', g.evaluate(f"localStorage.getItem('{AK}')") is None)
    ok('default: no page errors', not g.errs, g.errs)
    c.close()

    # 2. System + dark OS maps to Forest Twilight
    c, g = ctx(br, seed_all(), 1280, 900, color_scheme='dark')
    g.goto(B + '?nosw'); ready(g)
    t = html_theme(g)
    ok('system+dark OS: theme stays system, scheme is dark', t['theme'] == 'system' and t['scheme'] == 'dark', t)
    ok('system+dark OS: page uses Forest Twilight --pbg', rgb(pbg_of(g)) == PBG['forest'], pbg_of(g))
    ok('system+dark OS: still no preference key', g.evaluate(f"localStorage.getItem('{AK}')") is None)
    c.close()

    # 3. Live OS change while System is on
    c, g = ctx(br, seed_all(), 1200, 900, color_scheme='light')
    g.goto(B + '?nosw'); ready(g)
    g.emulate_media(color_scheme='dark'); g.wait_for_timeout(300)
    t = html_theme(g)
    ok('system live: OS flip to dark becomes Forest tokens', t['theme'] == 'system' and t['scheme'] == 'dark' and rgb(pbg_of(g)) == PBG['forest'], (t, pbg_of(g)))
    g.emulate_media(color_scheme='light'); g.wait_for_timeout(300)
    t = html_theme(g)
    ok('system live: OS flip back to light becomes Morning tokens', t['theme'] == 'system' and t['scheme'] == 'light' and rgb(pbg_of(g)) == PBG['morning'], (t, pbg_of(g)))
    c.close()

    # 4. Manual themes win over the OS, persist in the pref key only, survive reload
    for name, os_scheme in (('morning', 'dark'), ('forest', 'light'), ('moon', 'light')):
        c, g = ctx(br, seed_all(), 1200, 900, color_scheme=os_scheme)
        g.goto(B + '?nosw'); ready(g)
        before = data_keys(g)
        pick_theme(g, name)
        t = html_theme(g)
        pref = atelier(g)
        ok(f'{name}: chosen theme applied (scheme {SCHEME[name]}) even against a {os_scheme} OS',
           t['theme'] == name and t['scheme'] == SCHEME[name] and rgb(pbg_of(g)) == PBG[name], (t, pbg_of(g)))
        ok(f'{name}: saved only in the atelier preference key', pref and pref.get('theme') == name, pref)
        ok(f'{name}: projects and threads byte-identical after the choice', data_keys(g) == before)
        # reload persistence + no flash of the wrong theme
        g.reload(wait_until='domcontentloaded'); ready(g)
        t2 = html_theme(g)
        boot = g.evaluate("window.__themeBoot||[]")
        recs=[x for x in boot if isinstance(x,dict)]
        first = next((x for x in recs if x.get('theme') and x.get('scheme')), None)
        wrong = [x for x in recs if x.get('theme') and x['theme'] != name]
        ok(f'{name}: survives reload (boot already set {name}/{SCHEME[name]})',
           t2['theme'] == name and t2['scheme'] == SCHEME[name] and rgb(pbg_of(g)) == PBG[name], (t2, pbg_of(g), first))
        ok(f'{name}: no flash of a different theme on load',
           first and first.get('theme') == name and first.get('scheme') == SCHEME[name] and not wrong, recs[:6])
        ok(f'{name}: after reload, projects/threads still unchanged', data_keys(g) == before)
        c.close()

    # 5. Backups include atelier prefs the same way as Resume/Seasonal: they are not in the backup file
    c, g = ctx(br, seed_all(), 1200, 900)
    g.goto(B + '?nosw'); ready(g)
    pick_theme(g, 'moon')
    fb = g.evaluate("FlossFoxProjects.fullBackup()")
    snap = g.evaluate("FlossFoxProjects.rawSnapshot()")
    prefs_keys = list((fb.get('prefs') or {}).keys())
    snap_keys = list((snap.get('keys') or {}).keys())
    ok('backup file has the usual pref keys (pip/hints/tips/fabric/backup) only',
       set(prefs_keys) <= {'pip', 'hints', 'tips', 'fabric', 'backup'} and 'atelier' not in prefs_keys, prefs_keys)
    ok('in-browser snapshot does not include the atelier preference key (same as other atelier prefs)',
       AK not in snap_keys and not any('atelier' in k for k in snap_keys), snap_keys)
    ok('theme is still in the atelier preference key after a backup is built', atelier(g).get('theme') == 'moon')
    c.close()

    # 6. Visiting every tab after a theme change leaves projects/threads byte-identical
    c, g = ctx(br, seed_all(), 1280, 900)
    g.goto(B + '?nosw'); ready(g)
    pick_theme(g, 'forest')
    before = data_keys(g); pref = atelier(g)
    visit_tabs(g)
    ok('tab tour: projects and threads byte-identical', data_keys(g) == before)
    ok('tab tour: atelier pref unchanged (still forest)', atelier(g) == pref, atelier(g))
    ok('tab tour: no page errors', not g.errs, g.errs)
    c.close()

    # 7. Reset display settings restores System and removes the pref key; data untouched
    c, g = ctx(br, seed_all(), 1200, 900, color_scheme='light')
    g.goto(B + '?nosw'); ready(g)
    pick_theme(g, 'moon')
    before = data_keys(g)
    g.click('#tabSettings'); g.wait_for_timeout(150)
    g.click('#ffPrefReset'); g.wait_for_timeout(250)
    if g.locator('#ffConfirmGo').count() and g.locator('#ffConfirmGo').is_visible():
        g.click('#ffConfirmGo'); g.wait_for_timeout(250)
    t = html_theme(g)
    ok('reset: theme attribute is system', t['theme'] == 'system', t)
    ok('reset: System radio is selected', g.is_checked('#ffTheme-system'))
    ok('reset: light OS again shows Morning Linen tokens', t['scheme'] == 'light' and rgb(pbg_of(g)) == PBG['morning'], (t, pbg_of(g)))
    ok('reset: preference key removed', g.evaluate(f"localStorage.getItem('{AK}')") is None)
    ok('reset: projects and threads byte-identical', data_keys(g) == before)
    c.close()

    # 8. Pip art follows the chosen theme; Moonlit uses starlight; Morning uses gardener
    c, g = ctx(br, seed_all(), 1280, 900, color_scheme='light')
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabConvert'); g.wait_for_timeout(200)  # hero Pip
    ok('pip default (system light): dark source is off (gardener)', pip_dark_media(g) == 'not all', pip_dark_media(g))
    pick_theme(g, 'moon')
    g.click('#tabConvert'); g.wait_for_timeout(200)
    ok('pip Moonlit: dark source media=all (starlight)', pip_dark_media(g) == 'all', pip_dark_media(g))
    # landing (first-visit still shows even with only the atelier key) — seed moon, no projects? Use returning + evaluate landing sources
    land = g.evaluate("""(()=>{const ss=[...document.querySelectorAll('#ffLanding [data-atelier-darksrc]')];
      return {n:ss.length, media:ss.map(s=>s.media), scheme:document.documentElement.getAttribute('data-atelier-scheme')};})()""")
    ok('landing dark sources follow Moonlit (starlight)', land['n'] >= 1 and all(m == 'all' for m in land['media']), land)
    pick_theme(g, 'morning')
    g.click('#tabConvert'); g.wait_for_timeout(200)
    ok('pip Morning: dark source media=not all (gardener)', pip_dark_media(g) == 'not all', pip_dark_media(g))
    pick_theme(g, 'forest')
    g.click('#tabConvert'); g.wait_for_timeout(200)
    ok('pip Forest: dark source media=all (starlight)', pip_dark_media(g) == 'all', pip_dark_media(g))
    c.close()

    # 9. Lantern halo follows the chosen dark scheme; reduced motion keeps it still
    # Landing is the .lhalo element; a returning visitor still has it in the DOM.
    c, g = ctx(br, seed_all(), 1280, 900, landing_seen=False, color_scheme='light')
    # Put moon in the pref key so a fresh visitor (landing shown) loads Moonlit
    # Re-open with moon pref + no landing_seen and no projects? landing_seen False + projects still skips?
    # fresh() is false when projects exist. Use pref-only storage for a true landing.
    c.close()
    moon_pref = {AK: json.dumps({'v': 1, 'theme': 'moon'})}
    c, g = ctx(br, moon_pref, 1280, 900, landing_seen=False, color_scheme='light')
    g.goto(B + '?nosw'); g.wait_for_function("document.documentElement.getAttribute('data-atelier-theme')==='moon'")
    g.wait_for_timeout(200)
    halo = g.evaluate("""(()=>{const el=document.querySelector('#ffLanding .lhalo');if(!el)return{found:false};
      const cs=getComputedStyle(el);return{found:true,anim:cs.animationName,duration:cs.animationDuration,visible:el.offsetParent!==null||cs.display!=='none'};})()""")
    ok('halo Moonlit: lantern pulse is running (no reduced motion)',
       halo.get('found') and halo.get('anim') and halo['anim'] != 'none' and 'halo-pulse' in (halo['anim'] or ''), halo)
    land_src = g.evaluate("[...document.querySelectorAll('#ffLanding [data-atelier-darksrc]')].map(s=>s.media)")
    ok('halo Moonlit: landing Pip uses starlight sources', land_src and all(m == 'all' for m in land_src), land_src)
    c.close()
    c, g = ctx(br, moon_pref, 1280, 900, landing_seen=False, color_scheme='light', reduced_motion='reduce')
    g.goto(B + '?nosw'); g.wait_for_function("document.documentElement.getAttribute('data-atelier-theme')==='moon'")
    g.wait_for_timeout(200)
    halo_rm = g.evaluate("""(()=>{const el=document.querySelector('#ffLanding .lhalo');if(!el)return{found:false};
      const cs=getComputedStyle(el);return{found:true,anim:cs.animationName,duration:cs.animationDuration};})()""")
    still = (not halo_rm.get('anim') or halo_rm['anim'] in ('none', '') or
             all(d.strip() in ('0s', '0s') for d in (halo_rm.get('duration') or '0s').split(',')))
    ok('halo Moonlit + reduced motion: pulse is still', halo_rm.get('found') and still, halo_rm)
    c.close()
    # Hero lantern (::before on .pipfig) under Forest, returning visitor
    c, g = ctx(br, seed_all(), 1280, 900)
    g.goto(B + '?nosw'); ready(g)
    pick_theme(g, 'forest')
    g.click('#tabConvert'); g.wait_for_timeout(250)
    hero = g.evaluate("""(()=>{const b=document.body;const fig=document.querySelector('.pipc .pipfig, #pipFig');
      const before=fig&&getComputedStyle(fig,'::before');
      return{hero:b.classList.contains('pipc-hero'),anim:before&&before.animationName,bg:before&&before.backgroundImage};})()""")
    ok('halo Forest on the hero: lantern token is present (dark scheme)',
       hero.get('bg') and hero['bg'] != 'none', hero)
    c.close()

    # 10. 44px Appearance radios
    c, g = ctx(br, seed_all(), 390, 860, touch=True)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabSettings'); g.wait_for_timeout(200)
    sizes = g.evaluate("""[...document.querySelectorAll('.ffa-theme-opt')].map(el=>{const r=el.getBoundingClientRect();return{id:el.htmlFor,h:Math.round(r.height),w:Math.round(r.width)}})""")
    ok('Appearance radios: each label is at least 44px tall', sizes and all(s['h'] >= 44 for s in sizes), sizes)
    c.close()

    # 11. Contrast AA and BLANC/WHITE swatches on every theme (and System light/dark)
    views = [
        ('workbasket', '#tabWorkbasket', '#workbasketView'),
        ('threads', '#tabThreads', '#threadsView'),
        ('shop', '#tabShop', '#shopView'),
        ('settings', '#tabSettings', '#ffAtelierPrefs'),
    ]
    cases = [
        ('morning', 'light', 'morning'),
        ('forest', 'light', 'forest'),
        ('moon', 'light', 'moon'),
        ('system-light', 'light', 'system'),
        ('system-dark', 'dark', 'system'),
    ]
    for label, os_scheme, theme_val in cases:
        extra = {AK: json.dumps({'v': 1, 'theme': theme_val})} if theme_val != 'system' else {}
        # system cases: no key (or key with system)
        if theme_val == 'system':
            extra = {AK: json.dumps({'v': 1, 'theme': 'system'})}
        c, g = ctx(br, seed_all(extra), 1280, 900, color_scheme=os_scheme)
        g.goto(B + '?nosw'); ready(g)
        expect_pbg = PBG['morning'] if (theme_val == 'morning' or (theme_val == 'system' and os_scheme == 'light')) else (
            PBG['moon'] if theme_val == 'moon' else PBG['forest'])
        ok(f'{label}: --pbg matches Pixel tokens', rgb(pbg_of(g)) == expect_pbg, pbg_of(g))
        g.click('#tabWorkbasket'); g.wait_for_timeout(200)
        for code in ('BLANC', 'WHITE'):
            s = swatch_ok(g, code)
            ok(f'{label}: DMC {code} swatch is visible with an edge',
               s.get('found') and s.get('borderW', 0) >= 1 and s.get('w', 0) >= 8 and s.get('h', 0) >= 8, s)
        # contrast on the four surfaces
        for view, tab, sel in views:
            g.click(tab); g.wait_for_timeout(200)
            if sel == '#ffAtelierPrefs' and g.locator(sel).count():
                g.locator(sel).scroll_into_view_if_needed()
            contrast(g, f'{label} {view} 1280')
        ok(f'{label}: no page errors', not g.errs, g.errs)
        c.close()


    # live theme pick must not swap Pip's pose to starlight; stay on Threads so a tab change is not the cause
    c, g = ctx(br, seed_all({AK: json.dumps({'v': 1, 'theme': 'system'})}), 1280, 900, color_scheme='light')
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabThreads'); g.wait_for_timeout(300)
    before = g.evaluate("""() => { const el=document.getElementById('pip'), img=document.getElementById('pipImg');
      return {pose:el&&el.dataset.pose, art:img&&img.dataset.art, src:img&&(img.currentSrc||img.src||'')}; }""")
    g.evaluate("""() => {
      const inp=document.getElementById('ffTheme-moon');
      if(!inp) return;
      inp.checked=true;
      inp.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    g.wait_for_timeout(400)
    after = g.evaluate("""() => { const el=document.getElementById('pip'), img=document.getElementById('pipImg');
      return {pose:el&&el.dataset.pose, art:img&&img.dataset.art, src:img&&(img.currentSrc||img.src||''),
              theme:document.documentElement.getAttribute('data-atelier-theme'), scheme:document.documentElement.getAttribute('data-atelier-scheme')}; }""")
    ok('live theme: Moonlit applied', after.get('theme')=='moon' and after.get('scheme')=='dark', after)
    ok('live theme: Pip pose unchanged', after.get('pose')==before.get('pose') and after.get('art')==before.get('art'), (before, after))
    ok('live theme: companion did not swap to starlight', 'starlight' not in (after.get('src') or ''), after.get('src'))
    g.click('#tabConvert'); g.wait_for_timeout(300)
    hero = g.evaluate("""() => {
      const dk=[...document.querySelectorAll('.herogrid [data-atelier-darksrc], #pipSrcDark')];
      return {media: dk.map(e=>e.media), n: dk.length, scheme: document.documentElement.getAttribute('data-atelier-scheme')};
    }""")
    ok('live theme: Find floss hero dark sources follow Moonlit (starlight)', hero['scheme']=='dark' and hero['n']>=1 and all(m=='all' for m in hero['media']), hero)
    g.click('#tabSettings'); g.wait_for_timeout(150)
    g.check('#ffTheme-morning'); g.wait_for_timeout(350)
    g.click('#tabConvert'); g.wait_for_timeout(250)
    hero2 = g.evaluate("""() => {
      const dk=[...document.querySelectorAll('.herogrid [data-atelier-darksrc], #pipSrcDark')];
      return {media: dk.map(e=>e.media), theme: document.documentElement.getAttribute('data-atelier-theme'), scheme: document.documentElement.getAttribute('data-atelier-scheme')};
    }""")
    ok('live theme: Find floss hero follows Morning (gardener, dark sources off)', hero2['theme']=='morning' and hero2['scheme']=='light' and all(m=='not all' for m in hero2['media']), hero2)
    ok('live theme: no page errors', not g.errs, g.errs)
    c.close()

    # Morning on a dark OS keeps its hero flourish (theme-pair dark :root is scoped)
    c, g = ctx(br, seed_all({AK: json.dumps({'v': 1, 'theme': 'morning'})}), 1280, 900, color_scheme='dark')
    g.goto(B + '?nosw'); ready(g)
    fl = g.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--flourish-l').trim()")
    ok('morning on dark OS: flourish is kept (not Forest none)', fl and fl not in ('none', '') and 'url(' in fl, fl)
    ok('morning on dark OS: page is Morning linen', rgb(pbg_of(g)) == PBG['morning'], pbg_of(g))
    c.close()

    # 12. Screenshots: every theme (plus System light/dark) at 1280 and 390
    for label, os_scheme, theme_val in cases:
        extra = {AK: json.dumps({'v': 1, 'theme': theme_val})}
        for w, touch in ((1280, False), (390, True)):
            c, g = ctx(br, seed_all(extra), w, 900 if w == 1280 else 860, color_scheme=os_scheme, touch=touch)
            g.goto(B + '?nosw'); ready(g)
            for view, tab, sel in views:
                g.click(tab); g.wait_for_timeout(250)
                if sel == '#ffAtelierPrefs' and g.locator(sel).count():
                    g.locator(sel).scroll_into_view_if_needed()
                shot(g, label, view, w)
            c.close()
    ok('screenshots written for every theme at 1280 and 390', True)

    br.close()

print(f'atelier_themes_e2e: {R[0]} passed, {R[1]} failed (simulated)')
sys.exit(1 if R[1] else 0)
