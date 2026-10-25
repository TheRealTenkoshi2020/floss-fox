"""Pip art batch 2 (simulated, synthetic data): trigger rules for the 8 placements.
Usage: python3 tests/pip_b2_e2e.py URL [SHOTDIR]
Checks: Pip level (chatty/important/quiet/off), once per file, once per session, Chatty only, never on Shopping."""
import sys, os, re, json, glob
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; R = [0, 0]
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; LVK = PFX + '.pipLevel.v1'; PIPK = PFX + '.pip.v1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
RED = "Color key\nX DMC 310 Black 2400 stitches 2 skeins\n* DMC 3999 Deep Forest Green 1 skein\n# 4000 2 skeins\nO DMC 3865 Sky Blue 500 stitches 1 skein\n"
CLEAN = "Color key\nX DMC 310 Black 2400 stitches 2 skeins\n* DMC 321 Christmas Red 1200 stitches 1 skein\n"
CLEAN2 = "Color key\nX DMC 310 Black 2400 stitches 2 skeins\n* DMC 666 Bright Red 1200 stitches 1 skein\n"
NEW = ['pattern-reader', 'checklist', 'encouraging-coach', 'measuring-fabric', 'whispering-tip', 'cozy-companion', 'rainy-day', 'postmaster']
# ---- static checks
src = {f: open(f, encoding='utf-8').read() for f in glob.glob(os.path.join(ROOT, '*.js')) + glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'pip-hybrid', '*.js')) + glob.glob(os.path.join(ROOT, 'shop', '*.js'))}
alltxt = '\n'.join(src.values())
ok('held poses (mosaic-master, rescue-mission) are not used anywhere', 'mosaic-master' not in alltxt and 'rescue-mission' not in alltxt)
ok('no new batch 2 pose in shop/*.js', not any(n in t for f, t in src.items() if os.sep + 'shop' + os.sep in f for n in NEW))
other = [p for p in re.findall(r'pip-([a-z-]+)-(?:160|320|480)\.', open(os.path.join(ROOT, 'pip-b2.js')).read() + open(os.path.join(ROOT, 'offline.html')).read())]
sw = open(os.path.join(ROOT, 'sw.js')).read()
ok('sw cache bumped to ci005-50', "'flossfox-dev-v2.0a-ci005-50'" in sw)
ok('sw lists the 8 new poses (160 png+webp) and pip-b2.js, and the files exist', all(f'"assets/pip/pip-{n}-160.{e}"' in sw for n in NEW for e in ('png', 'webp')) and '"pip-b2.js"' in sw)
ok('160/320/480 png+webp exist for each new pose', all(os.path.exists(os.path.join(ROOT, f'assets/pip/pip-{n}-{w}.{e}')) for n in NEW for w in (160, 320, 480) for e in ('png', 'webp')))
ok('404.html keeps explorer, offline.html uses rainy-day', 'pip-explorer-160' in src[os.path.join(ROOT, '404.html')] and 'pip-rainy-day-160' in src[os.path.join(ROOT, 'offline.html')] and 'pip-explorer' not in src[os.path.join(ROOT, 'offline.html')])
pu = src[os.path.join(ROOT, 'pip-hybrid', 'pattern-ui.js')]
ok('reading art is tied to the real file read (I.inspect), started before and stopped in finally', re.search(r"B2\.reading\(true,\$\('patInfo'\)\);let out;try\{out=await I\.inspect\(file,await lib\(\)\)\}finally\{if\(B2\)B2\.reading\(false\)\}", pu) is not None)
INIT = f"if(!sessionStorage.getItem('i')){{sessionStorage.setItem('i','1');localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');localStorage.setItem('{PFX}.hints.v1','off');localStorage.setItem('{PFX}.pipFirstProject.v1','shown');%s}}"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page(lv=None, path='', w=390, h=844):
        extra = f"localStorage.setItem('{LVK}','{lv}');" if lv else ''
        if lv == 'off': extra += f"localStorage.setItem('{PIPK}','hidden');"
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True, service_workers='block', accept_downloads=True); c.add_init_script(INIT % extra)
        g = c.new_page(); g.set_default_timeout(5000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); g.on('dialog', lambda d: d.accept())
        g.goto(B + path + ('&' if '?' in path else '?') + 'nosw'); g.wait_for_timeout(500); return g
    n = lambda g, sel: g.locator(sel).count()
    def paste(g, t, reopen=True):
        if reopen: g.click('#convertView .pat-launch'); g.wait_for_timeout(150)
        g.evaluate("document.querySelector('#ffPatternDialog .pat-manual').open=true"); g.fill('#patPaste', t)
        g.click('#ffPatternDialog .pat-manual button:has-text("Find colors")'); g.wait_for_timeout(300)
    # ---- strings lint
    g = page(); S = g.evaluate("FlossFoxPipB2.STR")
    ok('placeholder lines: <=90 chars, no em dash, max one "!", no he/she', all(len(t) <= 90 and '\u2014' not in t and t.count('!') <= 1 and not re.search(r'\b(he|she|his|her)\b', t, re.I) for t in S.values()), S)
    ok('no page errors on load', not g.errs, g.errs); g.context.close()
    # ---- 03 checklist: green verdict, once per file, level rules
    for lv, want in (('chatty', 1), (None, 1), ('quiet', 0), ('off', 0)):
        g = page(lv); paste(g, CLEAN)
        ok(f'03 checklist on green verdict at level {lv or "default(important)"}: {want}', n(g, '#patCheck .pipb2-checkOk') == want and (not want or g.get_attribute('#patCheck .pipb2-checkOk', 'data-pose') == 'checklist'), n(g, '#patCheck .pipb2-checkOk'))
        if lv == 'chatty':
            paste(g, CLEAN, reopen=False); ok('03 checklist: same file checked again -> not shown again (once per file)', n(g, '.pipb2-checkOk') == 0)
            paste(g, CLEAN2, reopen=False); ok('03 checklist: a different file -> shown again', n(g, '#patCheck .pipb2-checkOk') == 1)
            paste(g, RED, reopen=False); ok('03 checklist: never on a red verdict', n(g, '.pipb2-checkOk') == 0 and g.get_attribute('#patCheckVerdict', 'data-level') == 'red')
        g.context.close()
    # ---- 10 encouraging-coach: Fix it sheet header, once per file
    for lv, want in (('chatty', 1), (None, 1), ('quiet', 0), ('off', 0)):
        g = page(lv); paste(g, RED); g.click('#patCheck .pt-fixbtn[data-code="3999"]'); g.wait_for_timeout(200)
        ok(f'10 encouraging-coach in Fix it sheet header at level {lv or "default"}: {want}', n(g, '#ptSheet .pipb2-fixSheet') == want and (not want or g.evaluate("document.querySelector('#ptSheet .pt-title').nextElementSibling.classList.contains('pipb2-fixSheet')")))
        if lv == 'chatty':
            g.click('#ptKeep'); g.wait_for_timeout(100); g.click('#patCheck .pt-fixbtn[data-code="4000"]'); g.wait_for_timeout(200)
            ok('10 encouraging-coach: second Fix it open for the same file -> not shown (once per file)', n(g, '#ptSheet') == 1 and n(g, '.pipb2-fixSheet') == 0)
        g.context.close()
    # ---- 02 pattern-reader: only while the real read runs, and only if it takes over 1 s
    g = page('important'); g.click('#convertView .pat-launch'); g.wait_for_timeout(150)
    g.evaluate("FlossFoxPipB2.reading(true,document.getElementById('patInfo'))"); g.wait_for_timeout(400); a = n(g, '.pipb2-reading'); g.wait_for_timeout(900); b = n(g, '.pipb2-reading')
    g.evaluate("FlossFoxPipB2.reading(false)"); c2 = n(g, '.pipb2-reading')
    ok('02 pattern-reader: hidden for a fast read (<1 s), shown after 1 s, removed when the read ends', (a, b, c2) == (0, 1, 0), (a, b, c2))
    g.evaluate("FlossFoxPipB2.reading(true,document.getElementById('patInfo'))"); g.evaluate("FlossFoxPipB2.reading(false)"); g.wait_for_timeout(1200)
    ok('02 pattern-reader: a read that ended before 1 s never shows art', n(g, '.pipb2-reading') == 0); g.context.close()
    for lv in ('quiet', 'off'):
        g = page(lv); g.click('#convertView .pat-launch') if lv != 'off' else None; g.wait_for_timeout(150)
        g.evaluate("FlossFoxPipB2.reading(true,document.getElementById('patInfo')||document.body)"); g.wait_for_timeout(1300)
        ok(f'02 pattern-reader: not shown at level {lv}', n(g, '.pipb2-reading') == 0); g.context.close()
    # ---- 06 whispering-tip: Help, Chatty only, once per session
    g = page('chatty'); g.click('#tabHelp'); g.wait_for_timeout(300)
    ok('06 whispering-tip: shown on Help at Chatty', n(g, '#helpView .pipb2-helpTip') == 1)
    g.click('#tabThreads'); g.wait_for_timeout(200); ok('06 whispering-tip: removed when leaving Help', n(g, '.pipb2-helpTip') == 0)
    g.click('#tabHelp'); g.wait_for_timeout(300); ok('06 whispering-tip: not shown again in the same session', n(g, '.pipb2-helpTip') == 0)
    g.reload(); g.wait_for_timeout(400); g.click('#tabHelp'); g.wait_for_timeout(300); ok('06 whispering-tip: not shown again after reload (same session)', n(g, '.pipb2-helpTip') == 0); g.context.close()
    g = page('chatty'); g.click('#tabHelp'); g.wait_for_timeout(300); ok('06 whispering-tip: new session shows it again', n(g, '.pipb2-helpTip') == 1)
    g.check('#pipSettings input[value=important]'); g.wait_for_timeout(200); ok('06 whispering-tip: switching away from Chatty removes it', n(g, '.pipb2-helpTip') == 0); g.context.close()
    for lv in (None, 'quiet', 'off'):
        g = page(lv); g.click('#tabHelp'); g.wait_for_timeout(300); ok(f'06 whispering-tip: not shown at level {lv or "default(important)"}', n(g, '.pipb2-helpTip') == 0)
        ok(f'06 whispering-tip: session flag not spent at level {lv or "default"}', g.evaluate("sessionStorage.getItem(FlossFoxPipB2.TIP_KEY)") is None); g.context.close()
    # ---- 09 cozy-companion: next to the Pip level setting, no bubble, hidden at Off
    g = page(); g.click('#tabHelp'); g.wait_for_timeout(300)
    ok('09 cozy-companion beside the Pip level setting, no text/bubble', n(g, '#pipSettings .pipb2-level') == 1 and n(g, '#pipSettings .pipb2-level .pipb2-text') == 0 and n(g, '.pipA-bubble') == 0)
    g.check('#pipSettings input[value=off]'); g.wait_for_timeout(200); ok('09 cozy-companion hidden when level is Off', n(g, '.pipb2-level') == 0)
    g.check('#pipSettings input[value=quiet]'); g.wait_for_timeout(200); ok('09 cozy-companion back at Quiet', n(g, '#pipSettings .pipb2-level') == 1); g.context.close()
    # ---- 07 measuring-fabric: Fabric Ask Pip card at 160 px
    for lv, want in (('chatty', 1), (None, 1), ('quiet', 1), ('off', 0)):
        g = page(lv, 'fabric.html'); g.wait_for_timeout(300)
        if n(g, '#ffFabricAsk'): g.click('#ffFabricAsk'); g.wait_for_timeout(200)
        # one-Pip build: the card's own 160px art is hidden; the single companion carries the measuring-fabric pose
        wd = g.evaluate("(()=>{const i=document.querySelector('#ffFabricPanel .pipb2-fabric img');return i?i.getBoundingClientRect().width:0})()")
        cp = g.evaluate("(()=>{const i=document.querySelector('#pipFollow img');return i&&i.getBoundingClientRect().width>0?i.src.split('/').pop():''})()")
        ok(f'07 measuring-fabric at level {lv or "default"}: card art hidden, companion pose {"measuring-fabric" if want else "none"}', n(g, '#ffFabricPanel .pipb2-fabric') == want and wd == 0 and (('measuring-fabric' in cp) if want else cp == ''), (wd, cp)); g.context.close()
    # ---- 15 postmaster: Backup export success only, never with Shopping open
    for lv, want in (('chatty', 1), (None, 1), ('quiet', 0), ('off', 0)):
        g = page(lv); g.evaluate("Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true,writable:true})")
        g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(200)
        with g.expect_download(): g.click('#settingsExport')
        g.wait_for_timeout(300); pre = n(g, '.pipb2-backup')
        g.click('#bkConfirmSave'); g.wait_for_timeout(300)
        ok(f'15 postmaster after confirmed backup export at level {lv or "default"}: {want} (none while only "download started")', pre == 0 and n(g, '#bkFeedback .pipb2-backup') == want, (pre, n(g, '.pipb2-backup')))
        if lv == 'chatty':
            g.click('#bkDismissFeedback'); g.wait_for_timeout(100); g.evaluate("document.getElementById('tabSettings').click()"); g.wait_for_timeout(100)
            with g.expect_download(): g.click('#settingsExport')
            g.wait_for_timeout(300); ok('15 postmaster removed when a new non-success message replaces it', n(g, '.pipb2-backup') == 0)
            g.evaluate("document.getElementById('tabShop').click()"); g.wait_for_timeout(300); g.evaluate("FlossFoxPipB2.backup()")
            ok('15 postmaster never shown while Shopping is open', n(g, '.pipb2-backup') == 0)
        g.context.close()
    # ---- never on Shopping screens
    g = page('chatty'); g.evaluate("document.getElementById('tabShop').click()"); g.wait_for_timeout(400)
    r = g.evaluate("[FlossFoxPipB2.checkOk(document.querySelector('#shopView')||document.body,'x'),FlossFoxPipB2.fixSheet(document.querySelector('#shopView')||document.body,'y')]")
    imgs = g.evaluate("[...document.querySelectorAll('#shopView img,#shopView source')].map(i=>i.getAttribute('src')||i.getAttribute('srcset')||'')")
    ok('Shopping: no batch 2 art in the Shopping view, spot calls refused there', r == [False, False] and n(g, '#shopView .pipb2') == 0 and not any(x in s for s in imgs for x in NEW), (r, imgs))
    ok('Shopping: no batch 2 art visible anywhere while Shopping is open', g.evaluate("[...document.querySelectorAll('.pipb2')].filter(e=>e.getClientRects().length).length") == 0)
    ok('no page errors in the Shopping check', not g.errs, g.errs); g.context.close()
    # ---- 14 rainy-day: offline.html, follows Off
    for lv, want in ((None, True), ('chatty', True), ('off', False)):
        g = page(lv, 'offline.html'); vis = g.is_visible('#pipOffArt img')
        ok(f'14 rainy-day on offline.html at level {lv or "default"}: visible={want}', vis == want and 'pip-rainy-day-160' in (g.get_attribute('#pipOffArt img', 'src') or ''), vis); g.context.close()
    g = page(None, '404.html'); ok('404.html keeps explorer', 'pip-explorer-160' in g.content() and 'rainy-day' not in g.content()); g.context.close()
    br.close()
print(f'pip_b2_e2e (simulated): {R[0]} passed, {R[1]} failed'); sys.exit(1 if R[1] else 0)
