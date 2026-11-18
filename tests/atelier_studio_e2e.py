#!/usr/bin/env python3
"""3.9 Atelier Stage D: gallery cards + FF39-09 read-only color comparison.
Gallery uses a color-strip fallback in the cover slot (photos come in Stage G; no writer here).
Compare surface (Find floss + project chart-match list) shows exact / close / estimated labels
from published charts. BLANC, WHITE and B5200 are never relabeled as each other. The surface
does not write inventory or projects (no-mutation dumps). Micro-interactions honor reduced motion.
SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_studio_e2e.py http://localhost:PORT/
"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
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
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}%s"
        % (json.dumps(seed), "try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}" if landing_seen else ''))
    g = c.new_page(); g.set_default_timeout(8000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxAtelierStudio&&window.FlossFoxAtelierCompare')
    g.wait_for_timeout(200)

def dump_inv(g):
    return g.evaluate(f"()=>JSON.stringify([localStorage.getItem({KEY!r}), localStorage.getItem({TK!r})])")

def keys_of(d):
    return {k: v for k, v in json.loads(d) if k in (KEY, TK)}

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- Gallery ----
    c, g = ctx(br, seed_all(), 1280, 900)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(300)
    ok('projects: list is the default view', g.locator('#projList.ffa-gallery').count() == 0)
    ok('projects: List/Gallery toggle is present', g.locator('#ffaViewBar [data-view=gallery]').count() == 1 and g.locator('#ffaViewBar [data-view=list]').count() == 1)
    before = dump_inv(g)
    g.click('#ffaViewBar [data-view=gallery]'); g.wait_for_timeout(250)
    ok('gallery: #projList gets the gallery class', g.locator('#projList.ffa-gallery').count() == 1, g.get_attribute('#projList', 'class'))
    ok('gallery: a cover slot is on each project card', g.locator('#projList li.ffa-gcard .ffa-cover').count() >= 2)
    ok('gallery: cover uses a color-strip fallback (no photo yet)', g.locator('#projList li.ffa-gcard .ffa-cover .ffa-strip').count() >= 1)
    aria = g.locator('#projList li.ffa-gcard .ffa-cover').first.get_attribute('aria-label') or ''
    ok('gallery: fallback aria uses the project name', 'Sample Autumn Wreath' in aria or 'Color strip' in aria, aria)
    # Whites stay separate swatches even when the hex is the same
    labels = g.evaluate("""() => [...document.querySelectorAll('#projList li.ffa-gcard .ffa-cover [aria-label]')].map(e=>e.getAttribute('aria-label')).join('|')""")
    ok('gallery: BLANC and WHITE stay separate in the strip', 'BLANC' in labels and 'WHITE' in labels, labels)
    ok('gallery: no cover-photo file input in Stage D', g.locator('#projListCard input[type=file]:not(#restoreFile)').count() == 0 and g.locator('#ffaViewBar, #projList').locator('input[type=file]').count() == 0)
    after = dump_inv(g)
    ok('gallery: toggling the view does not write projects or threads', before == after, (before, after))
    # Prefs may record projectsView; that is the atelier key, not inventory
    ak = g.evaluate(f"()=>localStorage.getItem({AK!r})")
    ok('gallery: projectsView is stored only in the atelier prefs key', ak is not None and 'gallery' in ak, ak)
    ok('gallery: no page errors', not g.errs, g.errs)
    c.close()

    # ---- Reduced motion: no transform on hover ----
    c, g = ctx(br, seed_all({AK: json.dumps({'v': 1, 'theme': 'system', 'projectsView': 'gallery'})}), 1280, 900, reduced_motion='reduce')
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(250)
    trans = g.evaluate("""() => {
      const el = document.querySelector('#projList li.ffa-gcard');
      if (!el) return 'missing';
      return getComputedStyle(el).transitionDuration;
    }""")
    ok('motion: gallery cards have no transition when reduced motion is on', trans in ('0s', '0s, 0s', '0s, 0s, 0s, 0s') or (trans and all(x.strip()=='0s' for x in trans.split(','))), trans)
    ok('motion: no page errors', not g.errs, g.errs)
    c.close()

    # ---- Color studio / compare (Find floss) ----
    c, g = ctx(br, seed_all(), 1280, 900)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabConvert'); g.wait_for_timeout(200)
    g.fill('#inp', '321, BLANC, WHITE, B5200, 310')
    g.click('#go'); g.wait_for_timeout(400)
    ok('studio: compare surface appears after Add my colors', g.locator('#ffStudio').is_visible(), g.locator('#ffStudio').count())
    txt = g.inner_text('#ffStudio')
    ok('studio: caveat copy is present', 'published conversion charts' in txt or 'Compare real thread' in txt, txt[:240])
    ok('studio: Add to My threads and Add to project are on each comparison card',
       'Add to My threads' in txt and 'Add to project' in txt and g.locator('#ffStudio [data-add-threads]').count() >= 1, txt[0:300])
    before = dump_inv(g)
    # DMC dest: exact on the source
    ok('studio: DMC source is an exact chart match', g.locator('#ffStudio .ffa-kind-exact').count() >= 1)
    # Switch to Sullivans (official chart = exact) and Anchor (close / estimated)
    g.select_option('#dest', 'sullivans'); g.wait_for_timeout(250)
    stxt = g.inner_text('#ffStudio')
    ok('studio: Sullivans official listings are labeled Exact chart match', 'Exact chart match' in stxt, stxt[:400])
    blanc_s = g.evaluate("""() => { const art=[...document.querySelectorAll('#ffStudio .ffa-cmp')].find(a=>a.getAttribute('data-code')==='BLANC'); return art?art.innerText:''; }""")
    white_s = g.evaluate("""() => { const art=[...document.querySelectorAll('#ffStudio .ffa-cmp')].find(a=>a.getAttribute('data-code')==='WHITE'); return art?art.innerText:''; }""")
    b5200_s = g.evaluate("""() => { const art=[...document.querySelectorAll('#ffStudio .ffa-cmp')].find(a=>a.getAttribute('data-code')==='B5200'); return art?art.innerText:''; }""")
    ten = g.evaluate("""() => { const art=[...document.querySelectorAll('#ffStudio .ffa-cmp')].find(a=>a.getAttribute('data-code')==='310'); return art?art.innerText:''; }""")
    ok('studio: Sullivans never labels BLANC/WHITE/B5200 as Exact chart match',
       'Exact chart match' not in blanc_s and 'Exact chart match' not in white_s and 'Exact chart match' not in b5200_s and 'Estimated match' in blanc_s and 'Estimated match' in white_s, (blanc_s, white_s, b5200_s))
    ok('studio: a solid Sullivans listing (310) stays Exact chart match', 'Exact chart match' in ten, ten)
    # both BLANC and WHITE may list 45001; neither is Exact, so they stay two colors
    ok('studio: BLANC and WHITE are not Exact to the same Sullivans code',
       not ('45001' in blanc_s and '45001' in white_s and 'Exact chart match' in blanc_s))

    g.select_option('#dest', 'anchor'); g.wait_for_timeout(250)
    atxt = g.inner_text('#ffStudio')
    ok('studio: Anchor has Close chart match and/or Estimated match labels',
       ('Close chart match' in atxt or 'Estimated match' in atxt), atxt[:400])
    # Whites callout + no cross-relabel
    ok('studio: whites are introduced as not the same', 'The whites are not the same' in atxt or '3 different colors' in atxt, atxt)
    # For a BLANC card, the match columns must not say DMC WHITE or DMC B5200
    blanc = g.evaluate("""() => {
      const art = [...document.querySelectorAll('#ffStudio .ffa-cmp')].find(a => a.getAttribute('data-code')==='BLANC');
      return art ? art.innerText : '';
    }""")
    ok('studio: BLANC is not relabeled as WHITE or B5200',
       'DMC WHITE' not in blanc and 'DMC B5200' not in blanc and 'DMC BLANC' in blanc, blanc)
    white = g.evaluate("""() => {
      const art = [...document.querySelectorAll('#ffStudio .ffa-cmp')].find(a => a.getAttribute('data-code')==='WHITE');
      return art ? art.innerText : '';
    }""")
    ok('studio: WHITE is not relabeled as BLANC or B5200',
       'DMC BLANC' not in white and 'DMC B5200' not in white and 'DMC WHITE' in white, white)
    after = dump_inv(g)
    ok('studio: comparing does not write projects or threads', before == after)
    # still the same after clicking around the studio
    if g.locator('#ffStudio .ffa-cmp').count():
        g.locator('#ffStudio .ffa-cmp').first.click()
        g.wait_for_timeout(100)
    ok('studio: click on a compare card still writes nothing', dump_inv(g) == before)
    ok('studio: no page errors', not g.errs, g.errs)
    c.close()

    # ---- Project chart-match list is read-only too ----
    c, g = ctx(br, seed_all(), 1280, 900)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(200)
    before = dump_inv(g)
    g.click('#projList [data-open="p1"]'); g.wait_for_timeout(300)
    ok('project: chart-match panel is present next to collection compare', g.locator('#pChartCmp .ffa-pcc').count() == 1)
    ptxt = g.inner_text('#pChartCmp')
    ok('project: chart-match panel lists exact/close/estimated language or DMC codes',
       'DMC 310' in ptxt and 'DMC BLANC' in ptxt, ptxt[:300])
    ok('project: panel has no add-to-threads or add-to-project button',
       g.locator('#pChartCmp button, #pChartCmp input, #pChartCmp select').count() == 0)
    after = dump_inv(g)
    ok('project: opening compare does not write projects or threads', before == after)
    ok('project: no page errors', not g.errs, g.errs)
    c.close()

    # 390 touch: gallery still usable
    c, g = ctx(br, seed_all(), 390, 860, touch=True)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(250)
    g.click('#ffaViewBar [data-view=gallery]'); g.wait_for_timeout(200)
    btn = g.locator('#ffaViewBar [data-view=gallery]')
    box = btn.bounding_box()
    ok('touch: gallery toggle meets 44px', box and box['height'] >= 44 and box['width'] >= 44, box)
    ok('touch: gallery cards render at 390', g.locator('#projList li.ffa-gcard .ffa-cover').count() >= 1)
    ok('touch: no page errors', not g.errs, g.errs)
    c.close()

    br.close()

print(f"\natelier_studio_e2e (simulated): {R[0]} passed, {R[1]} failed")
sys.exit(1 if R[1] else 0)
