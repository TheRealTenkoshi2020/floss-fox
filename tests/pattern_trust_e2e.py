"""Pattern trust e2e (simulated, 390px): verdicts, fix sheet, Type a number, Changed tag, undo/undo all, project-page fix.
Usage: python3 tests/pattern_trust_e2e.py URL [shotdir]"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; SD = sys.argv[2] if len(sys.argv) > 2 else None
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
INIT = f"localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');localStorage.setItem('{PFX}.hints.v1','off')"
RED = "Color key\nX DMC 310 Black 2400 stitches 2 skeins\n* DMC 3999 Deep Forest Green 1 skein\n# 4000 2 skeins\nO DMC 3865 Sky Blue 500 stitches 1 skein\n% DMC 8120 Dusty Rose 1 skein\n"
AMBER = "Color key\nX DMC 310 Black 1 skein\n* DMC 321 Christmas Red 1 skein\n% DMC 310 Black 1 skein\n"
CLEAN = "Color key\nX DMC 310 Black 2400 stitches 2 skeins\n* DMC 321 Christmas Red 1200 stitches 1 skein\n"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2); c.add_init_script(INIT); g = c.new_page(); g.set_default_timeout(4000)
    ERR, NET = [], []; g.on('pageerror', lambda e: ERR.append(str(e)))
    g.on('request', lambda r: NET.append(r.url) if not r.url.startswith(B) and not r.url.startswith('data:') and not r.url.startswith('blob:') else None)
    def shot(name, sel=None):
        if not SD: return
        if sel: g.locator(sel).scroll_into_view_if_needed()
        g.wait_for_timeout(150); g.screenshot(path=os.path.join(SD, name))
    def paste(t):
        g.goto(B + '?nosw'); g.wait_for_timeout(500)
        g.click('#convertView .pat-launch'); g.wait_for_timeout(150)
        g.evaluate("document.querySelector('#ffPatternDialog .pat-manual').open=true"); g.fill('#patPaste', t)
        g.click('#ffPatternDialog .pat-manual button:has-text("Find colors")'); g.wait_for_timeout(250)
    lvl = lambda: g.get_attribute('#patCheckVerdict', 'data-level')
    rowsTxt = lambda: g.inner_text('#patRows .pat-row') if False else g.evaluate("[...document.querySelectorAll('#patRows .pat-row,#patSkipped li')].map(x=>x.textContent).join('|')")
    paste(CLEAN); ok('clean key: green verdict, nothing to fix', lvl() in ('green', 'green-key') and g.locator('#patCheck .pt-fixbtn').count() == 0, lvl()); shot('01-green.png', '#patCheck')
    paste(AMBER); ok('duplicate only: amber "Check this 1 thing"', lvl() == 'amber' and 'Check this 1 thing' in g.inner_text('#patCheckVerdict'), g.inner_text('#patCheck'))
    ok('amber has Show me, no Fix it', g.locator('#patCheck button:has-text("Show me")').count() == 1 and g.locator('#patCheck .pt-fixbtn').count() == 0); shot('02-amber.png', '#patCheck')
    paste(RED); box = g.inner_text('#patCheck')
    ok('fake codes: red verdict', lvl() == 'red' and 'Check before you stitch' in box, box)
    ok('existing sentences kept', "We couldn't find 3999, 4000, 8120 in the DMC catalog." in box and 'DMC 3865 is listed as "Sky Blue"' in box, box)
    ok('one Fix button per fake code plus one for the name', g.locator('#patCheck .pt-fixbtn').count() == 4, g.locator('#patCheck .pt-fixbtn').count()); shot('03-red.png', '#patCheck')
    before = rowsTxt()
    g.click('#patCheck .pt-fixbtn[data-code="3999"]'); g.wait_for_timeout(150)
    sh = g.inner_text('#ptSheet'); ok('sheet suggests DMC 987 for "Deep Forest Green"', 'Use DMC 987' in sh and 'Very close' in sh, sh)
    ok('sheet shows two alternates and Type a number', g.locator('#ptSheet .pt-altbtn').count() == 3 and g.locator('#ptType').count() == 1)
    ok('nothing changed before the confirming tap', rowsTxt() == before)
    shot('04-sheet.png', '#ptSheet')
    g.click('#ptKeep'); ok('Keep closes the sheet and changes nothing', g.locator('#ptSheet').count() == 0 and rowsTxt() == before)
    g.click('#patCheck .pt-fixbtn[data-code="3999"]'); g.click('#ptUse'); g.wait_for_timeout(200)
    ok('Use adds DMC 987 with a Changed tag', g.locator('#patRow-987 .pt-tag').count() == 1 and 'Changed from DMC 3999' in g.inner_text('#patRow-987'))
    ok('Changed list with Undo', 'Changed DMC 3999 to DMC 987.' in g.inner_text('#patCheckChanged') and g.locator('#patCheckChanged .pt-undo').count() == 1)
    ok('amount read from the original line', g.evaluate("(document.querySelector('#patRow-987 input[type=number]')||{}).value") == '1', g.inner_text('#patRow-987') if g.locator('#patRow-987').count() else 'no row')
    ok('the confirm box is unticked again after a fix', not g.is_checked('#patAll'))
    shot('06-changed.png', '#patRow-987')
    g.click('#patCheckChanged .pt-undo'); g.wait_for_timeout(200); ok('Undo restores the exact original', rowsTxt() == before and g.locator('#patRow-987').count() == 0, rowsTxt())
    g.click('#patCheck .pt-fixbtn[data-code="4000"]'); g.wait_for_timeout(150); sh = g.inner_text('#ptSheet')
    ok('no name: no guess, only Type a number', g.locator('#ptUse').count() == 0 and "won't guess" in sh, sh); shot('05-type.png', '#ptSheet')
    g.fill('#ptType', '99999'); g.click('#ptTypeUse'); ok('typed unknown code is refused', "We don't know that DMC number" in g.inner_text('#ptErr'))
    g.fill('#ptType', '310'); g.click('#ptTypeUse'); ok('typed code already in the list is refused', 'already in your list' in g.inner_text('#ptErr'))
    g.fill('#ptType', '550'); g.click('#ptTypeUse'); g.wait_for_timeout(200); ok('typed 550 is used', g.locator('#patRow-550').count() == 1)
    g.click('#patCheck .pt-fixbtn[data-code="3865"]'); g.wait_for_timeout(150); g.click('#ptUse'); g.wait_for_timeout(200)
    ok('name fix replaces 3865', g.locator('#patRow-3865').count() == 0 and g.locator('#patCheckChanged .pt-undo').count() == 2)
    g.click('#patCheck .pt-undoall'); g.wait_for_timeout(200); ok('Undo all restores the exact original', rowsTxt() == before, rowsTxt())
    def fix(sel, code, typed=None):
        g.click(f'{sel} .pt-fixbtn[data-code="{code}"]'); g.wait_for_timeout(150)
        if typed: g.fill('#ptType', typed); g.click('#ptTypeUse')
        else: g.click('#ptUse')
        g.wait_for_timeout(250)
    fix('#patCheck', '3999'); fix('#patCheck', '4000', '550'); fix('#patCheck', '8120')
    ok('import: all red fixed, name mismatch left -> amber', lvl() == 'amber' and 'Check this 1 thing' in g.inner_text('#patCheckVerdict'), g.inner_text('#patCheck'))
    fix('#patCheck', '3865'); ok('import: everything fixed -> green', lvl() == 'green-key' and 'Nothing stood out in the color key' in g.inner_text('#patCheckVerdict'), g.inner_text('#patCheck'))
    g.click('#patCheck .pt-undoall'); g.wait_for_timeout(200); ok('import: Undo all -> red again', lvl() == 'red' and rowsTxt() == before, lvl())
    paste("Color key\nX DMC 310 Black 1 skein\n* DMC 3999 Deep Forest Green 1 skein\n"); fix('#patCheck', '3999')
    ok('import: only red item fixed -> green', lvl() == 'green-key', g.inner_text('#patCheck'))
    paste(RED)
    g.click('#patCheck .pt-fixbtn[data-code="3999"]'); g.click('#ptUse'); g.wait_for_timeout(200)
    g.check('#patAll'); ok('saving not blocked with open warnings', g.is_enabled('#patImport')); g.click('#patImport'); g.wait_for_timeout(600)
    st = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')||'{{}}')"); pr = st['projects'][-1]; pc = pr.get('pcheck') or {}
    ok('saved: 987 in items, fakes left open, fix logged', '987' in [i['code'] for i in pr['items']] and [o['code'] for o in pc.get('open', [])] == ['4000', '8120'] and [f['to'] for f in pc.get('fixes', [])] == ['987'], pc)
    g.wait_for_timeout(300); vis = g.is_visible('#pTrust') and g.locator('#pTrust .pt-fixbtn').count() >= 2
    ok('project page shows Pattern check fixes', vis, g.inner_text('#pTrust') if g.locator('#pTrust').count() else 'none')
    before_p = json.dumps(g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects.at(-1)"), sort_keys=True)
    g.click('#pTrust .pt-fixbtn[data-code="8120"]'); g.wait_for_timeout(150); sh = g.inner_text('#ptSheet'); ok('project sheet suggests DMC 3733 for "Dusty Rose"', 'Use DMC 3733' in sh, sh)
    g.click('#ptUse'); g.wait_for_timeout(300)
    pr2 = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects.at(-1)"); ok('project fix saved', '3733' in [i['code'] for i in pr2['items']] and '3733' in pr2['decisions'])
    shot('07-project-fix.png', '#pTrust')
    u = g.locator('#pTrust .pt-undo').last; u.click(); g.wait_for_timeout(300)
    after = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects.at(-1)"); bp = json.loads(before_p); after.pop('updated'); bp.pop('updated')
    ok('project Undo restores the exact original', json.dumps(after, sort_keys=True) == json.dumps(bp, sort_keys=True))
    g.locator('#pTrust .pt-undoall').count() == 0 and None
    g.locator('#pTrust .pt-undo').last.click(); g.wait_for_timeout(300); pr3 = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects.at(-1)")
    ok('undoing the import fix on the project page puts 3999 back as open', '987' not in [i['code'] for i in pr3['items']] and [o['code'] for o in pr3['pcheck']['open']] == ['4000', '8120', '3999'], pr3.get('pcheck'))
    plvl = lambda: g.get_attribute('#pTrustBoxVerdict', 'data-level') if g.locator('#pTrustBoxVerdict').count() else None
    def reopen():
        g.reload(); g.wait_for_timeout(500); g.click('#tabProjects'); g.wait_for_timeout(200); g.locator('#projList [data-open]').last.click(); g.wait_for_timeout(400)
    ok('project page: red while fake codes are open', plvl() == 'red', plvl())
    for code, t in [('3999', None), ('4000', '554'), ('8120', None)]: fix('#pTrust', code, t)
    ok('project page: all red fixed, name left -> amber', plvl() == 'amber', g.inner_text('#pTrust'))
    reopen(); ok('project page: amber survives reload, fixes still listed', plvl() == 'amber' and g.locator('#pTrust .pt-undo').count() == 3, g.inner_text('#pTrust') if g.locator('#pTrust').count() else '')
    fix('#pTrust', '3865'); ok('project page: everything fixed -> green', plvl() == 'green-key' and 'Nothing stood out in the color key' in g.inner_text('#pTrustBoxVerdict'))
    reopen(); ok('project page: green survives reload', plvl() == 'green-key' and g.locator('#pTrust .pt-undo').count() == 4, plvl())
    shot('08-project-all-fixed.png', '#pTrust')
    g.click('#pTrust .pt-undoall'); g.wait_for_timeout(300); ok('project page: Undo all -> red again', plvl() == 'red', plvl())
    reopen(); pr4 = g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).projects.at(-1)")
    ok('project page: red survives reload after Undo all, no fixes left', plvl() == 'red' and not pr4['pcheck']['fixes'] and '3865' in [i['code'] for i in pr4['items']], pr4.get('pcheck'))
    txt = g.evaluate("document.body.innerText"); ok('no em dashes on screen', '\u2014' not in txt)
    ok('no network outside the app', not NET, NET[:5]); ok('no page errors', not ERR, ERR[:3])
    print(f'{R[0]} passed, {R[1]} failed')
