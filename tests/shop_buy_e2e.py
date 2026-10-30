#!/usr/bin/env python3
"""Shop tab Check first rows (ci005-65, simulated browser run) with Myke's PDF: Buy-only rows (no Have enough /
Need to buy buttons), Buy + store chooser (same verified links as Store Mode), Buy never changes status or marks bought,
Pixel's section line with a working My threads link, Store Mode shows the same Buy-only rows.
Usage: FF_KEY=flossfox-dev.v1 python tests/shop_buy_e2e.py http://localhost:8812/floss-fox-dev/ [shot_dir] [pdf]"""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/floss-fox-dev/'; B = B if B.endswith('/') else B + '/'
SHOT = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
PDF = sys.argv[3] if len(sys.argv) > 3 else '/workspace/flow-pass/myke-example.pdf'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1')
R = {'pass': 0, 'fail': 0}; errs = []
def ok(n, c, i=''):
    R['pass' if c else 'fail'] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {i}'))
def mk(g, name, text):
    g.click('#tabConvert')
    if g.locator('#exitExample').is_visible(): g.click('#exitExample')
    g.fill('#inp', text); g.click('#go'); g.wait_for_selector('#saveProj:not([disabled])', state='visible'); g.wait_for_timeout(120)
    g.fill('#newProjName', name); g.evaluate("document.getElementById('saveProj').click()"); g.wait_for_timeout(200)
    return g.evaluate("FlossFoxProjects.lastProject().id")
NOTE = "These colors still need a look. Check them in My threads, or buy any you already know you need."
NOTE1 = "This color still needs a look. Check it in My threads, or buy it if you already know you need it."
def imp(g):
    g.click('#tabConvert'); g.click('#convertView .pat-launch'); g.set_input_files('#patFile', PDF); g.wait_for_timeout(3000)
    g.check('#patAll'); g.click('#patImport'); g.wait_for_timeout(500); return g.evaluate("FlossFoxProjects.lastProject().id")
def setst(g, pid, code, v):
    g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(250); g.locator(f'label:has(#st-{code}-{v})').click(); g.wait_for_timeout(250)
if not os.path.exists(PDF): print('SKIP no PDF fixture'); sys.exit(0)
BUYNOTE = "This color isn't in your cost estimate yet. Opening a store won't mark it as Need to buy or Bought."
TXT = '310\nBLANC\n321 x1\n498 x1\n666 x1\n700 x2\n725 x1\n796 x1\n820 x1\n898 x1\n3799 x2\n3865 x1\nB5200 x1\n415 x1\n762 x1'
def proj(g, pid): return [x for x in json.loads(g.evaluate(f"localStorage.getItem({json.dumps(KEY)})"))['projects'] if x['id'] == pid][0]
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (390, 344):
        t = f'[{w}] '
        ctx = br.new_context(viewport={'width': w, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        g = ctx.new_page(); g.on('pageerror', lambda e: errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B + '?nosw'); g.wait_for_load_state('networkidle'); g.evaluate("localStorage.clear()"); g.reload(); g.wait_for_load_state('networkidle')
        pid = imp(g)
        g.evaluate(f"FlossFoxProjects.open({json.dumps(pid)})"); g.wait_for_timeout(200)
        g.click('#tabShop'); g.wait_for_timeout(400)
        n = g.locator('#pCheck > li').count()
        ok(t + 'Need to buy empty, all 15 colors under Check first', n == 15 and g.inner_text('#pCheckH') == 'Check first (15)', n)
        ok(t + 'explainer is one short line', g.inner_text('#pCfNote').strip() == NOTE, g.inner_text('#pCfNote'))
        rows = g.evaluate("[...document.querySelectorAll('#pCheck > li')].map(li=>({t:li.textContent,buy:li.querySelectorAll('[data-cfbuy]').length,have:li.querySelectorAll('[data-cfst][data-v=have]').length,need:li.querySelectorAll('[data-cfst][data-v=buy]').length}))")
        ok(t + 'no Have enough / Need to buy buttons on Check first rows', all(r['have'] == 0 and r['need'] == 0 for r in rows), rows)
        ok(t + 'every Check first row has a Buy button (DMC destination)', all(r['buy'] == 1 for r in rows), rows)
        ok(t + 'rows show only the color + "amount not set yet"', all(r['t'].startswith('DMC ') and r['t'].split('Buy')[0].endswith(' · amount not set yet') and 'needs' not in r['t'] and 'stitch count' not in r['t'] for r in rows), rows[:2])
        sty = g.evaluate("""(()=>{const li=[...document.querySelectorAll('#pCheck > li')].find(l=>l.textContent.includes('DMC 434'));const b=li.querySelector('[data-cfbuy]'),s=document.querySelector('#pStoreBtn');const cb=getComputedStyle(b),cs=getComputedStyle(s);return {cls:b.className,bw:cb.borderTopWidth,bs:cb.borderTopStyle,bg:cb.backgroundColor,sbg:cs.backgroundColor}})()""")
        ok(t + 'Buy uses secondary outline style (sec, not pri; outlined, same fill as other sec buttons)', 'sec' in sty['cls'].split() and 'pri' not in sty['cls'].split() and sty['bs'] == 'solid' and sty['bw'] != '0px' and sty['bg'] == sty['sbg'], sty)
        ok(t + 'chooser hidden until tapped', g.locator('#pCheck .ffcf-buy:visible').count() == 0)
        before = json.dumps(proj(g, pid), sort_keys=True)
        g.click('#pCheck li:has-text("DMC 434") [data-cfbuy]'); g.wait_for_timeout(120)
        ok(t + 'Buy opens the chooser (aria-expanded true)', g.get_attribute('#pCheck li:has-text("DMC 434") [data-cfbuy]', 'aria-expanded') == 'true')
        hrefs = g.eval_on_selector_all('#pCheck .ffcf-buy:visible a', 'els=>els.map(a=>[a.href,a.target,a.rel,a.dataset.store,a.dataset.match])')
        sm = g.evaluate("FlossFoxSkeinPreview.linksFor({brand:'dmc',code:'434',family:'six-strand-cotton',pack:'single-skein',qty:1},'preview').map(l=>l.url)")
        ok(t + 'store links are the same verified source as Store Mode', [h[0] for h in hrefs] == sm and len(sm) > 0, [hrefs, sm])
        ok(t + 'links open in a new tab, noopener', all(h[1] == '_blank' and 'noopener' in h[2] for h in hrefs), hrefs)
        ok(t + 'chooser says not in cost estimate yet', g.inner_text('#pCheck .ffcf-buy:visible .ffcf-buynote').strip() == BUYNOTE)
        if SHOT: g.evaluate("document.getElementById('pCheckH').scrollIntoView({block:'start'});window.scrollBy(0,-90)"); g.screenshot(path=f'{SHOT}/shop-{w}.png'); g.screenshot(path=f'{SHOT}/shop-{w}-full.png', full_page=True)
        ok(t + 'Buy changed no data (no status, nothing bought)', json.dumps(proj(g, pid), sort_keys=True) == before)
        g.click('#pCheck li:has-text("DMC 434") [data-cfbuy]'); g.wait_for_timeout(80)
        ok(t + 'Buy toggles the chooser closed', g.locator('#pCheck .ffcf-buy:visible').count() == 0)
        tot = g.inner_text('#pPlan .totals')
        ok(t + 'estimate still excludes Check first colors', 'Not included: 15 colors in Check first' in tot, tot)
        ok(t + 'never marks bought', not proj(g, pid).get('purchased'))
        # My threads link, real tap
        a = g.locator('#pCfNote a', has_text='My threads'); a.scroll_into_view_if_needed(); a.tap(); g.wait_for_timeout(400)
        ok(t + 'My threads link (tap) opens My threads', g.locator('#threadsView').is_visible() and not g.locator('#shopView').is_visible())
        g.click('#tabShop'); g.wait_for_timeout(400)
        # keyboard
        g.focus('#pCheck li:has-text("DMC 797") [data-cfbuy]'); g.keyboard.press('Enter'); g.wait_for_timeout(100)
        ok(t + 'Buy works with keyboard, focus moves to first store link', g.evaluate("document.activeElement.classList.contains('ff-skein-pill')"))
        g.click('#pStoreBtn'); g.wait_for_timeout(200)
        ok(t + 'Store Mode: Need to buy empty but Check first colors listed', g.locator('#smLeft').count() == 0 and g.locator('#smCheck > li').count() == 15)
        ok(t + 'Store Mode: Check first colors have Buy', g.locator('#smCheck [data-cfbuy]').count() == 15)
        ok(t + 'Store Mode: no Bought button on Check first colors', g.locator('#smCheck [data-smb]').count() == 0)
        ok(t + 'Store Mode: no Have enough / Need to buy buttons', g.locator('#smCheck [data-cfst]').count() == 0)
        ok(t + 'Store Mode: rows show only color + amount not set yet', all(x.endswith(' · amount not set yet') for x in g.eval_on_selector_all('#smCheck .ffsm-txt', 'e=>e.map(x=>x.textContent.trim())')))
        ok(t + 'Store Mode: summary does not claim everything is bought', g.inner_text('#smSum') == '15 colors still need checking before this list is complete.', g.inner_text('#smSum'))
        ok(t + 'Store Mode n>1 line uses plural wording', g.evaluate("document.getElementById('smCheckH').nextElementSibling.textContent") == NOTE)
        ok(t + 'Store Mode: plain-links note shown', g.locator('#smBuyNote').count() == 1)
        b2 = json.dumps(proj(g, pid), sort_keys=True)
        g.click('#smCheck li:has-text("DMC 310") [data-cfbuy]'); g.wait_for_timeout(100)
        ok(t + 'Store Mode: chooser opens with links + estimate note', g.locator('#smCheck .ffcf-buy:visible a').count() > 0 and g.locator('#smCheck .ffcf-buy:visible .ffcf-buynote').count() == 1)
        if SHOT: g.evaluate("document.getElementById('smCheckH').scrollIntoView({block:'start'});window.scrollBy(0,-90)"); g.screenshot(path=f'{SHOT}/store-{w}.png')
        ok(t + 'Store Mode Buy changed no data', json.dumps(proj(g, pid), sort_keys=True) == b2)
        g.fill('#smFind', '310'); g.wait_for_timeout(150)
        ok(t + 'Store Mode search filters Check first too', g.locator('#smCheck > li').count() == 1)
        ok(t + 'Store Mode n=1 line uses singular wording', g.inner_text('#smCheck').strip() != '' and g.evaluate("document.getElementById('smCheckH').nextElementSibling.textContent") == NOTE1)
        g.fill('#smFind', ''); g.wait_for_timeout(150)
        a = g.locator('#smCheckH + p a', has_text='My threads'); a.scroll_into_view_if_needed(); a.tap(); g.wait_for_timeout(400)
        ok(t + 'Store Mode: My threads link (tap) opens My threads', g.locator('#threadsView').is_visible())
        g.click('#tabShop'); g.wait_for_timeout(300)
        if g.locator('#pStoreBtn[aria-pressed=true]').count(): g.click('#pStoreBtn'); g.wait_for_timeout(100)
        # non-DMC destination: no Buy (same as Store Mode), no status buttons
        g.evaluate("FlossFoxProjects.showView('projects')"); g.wait_for_timeout(150)
        if not g.evaluate("document.getElementById('pDetails').open"): g.click('#pDetails > summary')
        g.select_option('#pDest', 'anchor'); g.wait_for_timeout(200)
        ok(t + 'non-DMC brand: no Buy links, no status buttons, rows still listed', g.locator('#pCheck [data-cfbuy]').count() == 0 and g.locator('#pCheck [data-cfst]').count() == 0 and g.locator('#pCheck > li').count() == 15)
        # n=1 / n>1 in Shop tab list and project shop view
        p1 = mk(g, 'One left', '310 x1\n321 x1'); g.evaluate(f"FlossFoxProjects.open({json.dumps(p1)})"); g.wait_for_timeout(200)
        g.evaluate("FlossFoxProjects.showView('shop')"); g.wait_for_timeout(250)
        ok(t + 'Shop list n=2 uses plural wording', g.inner_text('#pCheckH') == 'Check first (2)' and g.inner_text('#pCfNote').strip() == NOTE, g.inner_text('#pCfNote'))
        r2 = g.eval_on_selector_all('#pCheck > li', 'e=>e.map(x=>x.firstChild.textContent.trim())')
        ok(t + 'rows with an amount show only the color', r2 == ['DMC 310', 'DMC 321'], r2)
        setst(g, p1, '321', 'have'); g.evaluate("FlossFoxProjects.showView('shop')"); g.wait_for_timeout(250)
        ok(t + 'Shop list n=1 uses singular wording', g.inner_text('#pCheckH') == 'Check first (1)' and g.inner_text('#pCfNote').strip() == NOTE1, g.inner_text('#pCfNote'))
        ctx.close()
    br.close()
ok('no page errors', not errs, errs[:3])
print(f"{R['pass']} passed, {R['fail']} failed (simulated)"); sys.exit(1 if R['fail'] else 0)
