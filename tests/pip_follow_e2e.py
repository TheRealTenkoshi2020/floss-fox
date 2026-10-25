"""One Pip per page: the single companion follows the reader (dev only).
Checks at 344, 390 and 882 for every tab plus fabric.html: exactly one visible Pip character image
(the Ask Pip button's small face icon is a button glyph, counted separately), no overlap with the tab bar,
focused inputs, or the last button, reduced motion stops all companion animation, levels, minimize/restore, no page errors."""
import sys
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; R = [0, 0]
PFX = 'flossfox-dev'
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
INIT = f"if(!sessionStorage.getItem('i')){{sessionStorage.setItem('i','1');localStorage.setItem('{PFX}.tour.v1','{{\"status\":\"dismissed\"}}');localStorage.setItem('{PFX}.hints.v1','off');%s}}"
CHARS = """[...document.querySelectorAll('img[src*="assets/pip/"]')].filter(i=>{const r=i.getBoundingClientRect();if(!(r.width>0&&r.height>0))return false;
 if(r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;let e=i;while(e){const s=getComputedStyle(e);if(s.visibility==='hidden'||+s.opacity===0)return false;e=e.parentElement}
 return !i.closest('#askPipBtn,.pipface')}).map(i=>i.src.split('/').pop())"""
OVER = """(sel=>{const c=document.querySelector('.pipc');if(!c)return 'nocomp';const a=c.getBoundingClientRect();const out=[];
 for(const e of document.querySelectorAll(sel)){const b=e.getBoundingClientRect();if(!b.width||!b.height)continue;
  if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)out.push(e.id||e.className||e.tagName)}return out})"""
TABS = ['Convert', 'Threads', 'Projects', 'Shop', 'Settings', 'Help']
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page(w, path='', lv=None, rm=False):
        extra = (f"localStorage.setItem('{PFX}.pipLevel.v1','{lv}');" + (f"localStorage.setItem('{PFX}.pip.v1','hidden');" if lv == 'off' else '')) if lv else ''  # Off as the Settings control stores it (same as pip_b2_e2e)
        c = br.new_context(viewport={'width': w, 'height': 800 if w > 400 else 740}, service_workers='block', reduced_motion='reduce' if rm else 'no-preference')
        c.add_init_script(INIT % extra); g = c.new_page(); g.set_default_timeout(6000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
        g.goto(B + path + ('&' if '?' in path else '?') + 'nosw'); g.wait_for_timeout(700); return g
    for w in (344, 390, 882):
        g = page(w)
        for t in TABS:
            if not g.locator('#tab' + t).is_visible(): continue
            g.click('#tab' + t); g.wait_for_timeout(500)
            v = g.evaluate(CHARS); ok(f'[{w}] {t}: exactly one Pip', len(v) == 1, v)
            ok(f'[{w}] {t}: companion clear of tab bar', g.evaluate(OVER + "('.tabs')") == [], g.evaluate(OVER + "('.tabs')"))
            # last button reachable: scroll to bottom, last visible button in the view not under the bar
            g.evaluate("scrollTo(0,document.documentElement.scrollHeight)"); g.wait_for_timeout(300)
            last = g.evaluate("""(()=>{const v=[...document.querySelectorAll('main button, .view button, main a.btn, footer a, footer button, .wrap a')].filter(b=>b.offsetParent&&!b.closest('.pipc'));const b=v[v.length-1];if(!b)return null;const r=b.getBoundingClientRect(),c=document.querySelector('.pipc').getBoundingClientRect();return r.bottom<=c.top+1||r.right<=c.left+1||!c.height})()""")
            ok(f'[{w}] {t}: last button / footer link not under Pip', last in (True, None), last)
            g.evaluate("scrollTo(0,0)")
        if w < 880:
            g.click('#tabConvert'); g.wait_for_timeout(300)
            inp = g.locator('#convertView input:visible, #convertView textarea:visible').first
            if inp.count():
                inp.focus(); g.wait_for_timeout(400)
                ok(f'[{w}] typing: bar steps away', g.evaluate("document.body.classList.contains('pipc-away')||getComputedStyle(document.querySelector('.pipc')).visibility==='hidden'||document.querySelector('.pipc').getBoundingClientRect().top>=innerHeight"))
                g.evaluate("document.activeElement.blur()"); g.wait_for_timeout(900)
                ok(f'[{w}] after typing: bar returns', len(g.evaluate(CHARS)) == 1)
        g.click('#pipMinBtn'); g.wait_for_timeout(300)
        ok(f'[{w}] minimize: no full Pip, face button shown', g.evaluate(CHARS) == [] and g.locator('#pipFaceBtn').is_visible())
        g.click('#pipFaceBtn'); g.wait_for_timeout(300)
        ok(f'[{w}] restore: one Pip again, focus on minimize', len(g.evaluate(CHARS)) == 1 and g.evaluate("document.activeElement.id") == 'pipMinBtn')
        ok(f'[{w}] no page errors', not g.errs, g.errs); g.context.close()
        f = page(w, 'fabric.html')
        v = f.evaluate(CHARS); ok(f'[{w}] fabric.html: exactly one Pip', len(v) == 1, v)
        f.evaluate("scrollTo(0,document.documentElement.scrollHeight)"); f.wait_for_timeout(500)
        ok(f'[{w}] fabric.html scrolled: still one Pip', len(f.evaluate(CHARS)) == 1, f.evaluate(CHARS))
        ok(f'[{w}] fabric no page errors', not f.errs, f.errs); f.context.close()
    g = page(390)
    inf = g.evaluate("[...document.querySelectorAll('.pipc, .pipc *')].filter(e=>getComputedStyle(e).animationIterationCount==='infinite'&&getComputedStyle(e).animationName!=='none').map(e=>e.className||e.tagName)")
    ok('[390] calm: no looping bob or breath on Pip', inf == [], inf)
    css = open(__file__.replace('tests/pip_follow_e2e.py', 'pip-follow.css')).read()
    ok('safe-area inset padding on the phone bar', 'safe-area-inset-bottom' in css); g.context.close()
    g = page(390, rm=True)
    anims = g.evaluate("[...document.querySelectorAll('.pipc, .pipc *')].filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&parseFloat(s.animationDuration)>0.02||parseFloat(s.transitionDuration)>0.02}).map(e=>e.className||e.tagName)")
    ok('[390] reduced motion: no companion animation or transition', anims == [], anims); g.context.close()
    g = page(882, rm=True)
    anims = g.evaluate("[...document.querySelectorAll('.pipc, .pipc *')].filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&parseFloat(s.animationDuration)>0.02||parseFloat(s.transitionDuration)>0.02}).map(e=>e.className||e.tagName)")
    ok('[882] reduced motion: no companion animation or transition', anims == [], anims); g.context.close()
    for lv in ('off', 'quiet', 'important', 'chatty'):
        g = page(390, lv=lv); g.click('#tabThreads'); g.wait_for_timeout(400)
        v = g.evaluate(CHARS)
        ok(f'[390] level {lv}: Pip count', len(v) == (0 if lv == 'off' else 1), v)
        hb = g.evaluate("(()=>{const c=document.querySelector('.pipc');return c?c.getBoundingClientRect().height:0})()")
        if lv == 'off': ok('[390] Off (Settings level): bar gone completely', hb == 0, hb)
        line = g.evaluate("(()=>{const m=document.getElementById('pipMsg');return m&&m.offsetParent?m.textContent.trim():''})()")
        if lv == 'quiet': ok('[390] Quiet: pose with no line', line == '' and len(v) == 1, line)
        if lv in ('important', 'chatty'): ok(f'[390] {lv}: line shown', line != '', line); ok(f'[390] level {lv}: no errors', not g.errs, g.errs); g.context.close()
    g = page(390, 'fabric.html', lv='off'); ok('[390] fabric.html at Off: no Pip', g.evaluate(CHARS) == [], g.evaluate(CHARS)); g.context.close()
    br.close()
print(f'\n{R[0]} passed, {R[1]} failed'); sys.exit(1 if R[1] else 0)
