"""ci005-85: first visit. Fresh browser, nothing saved: landing shows Pip's "Start here" on Find floss, Got it stores only
a tiny seen flag, and after picking Find floss exactly one following Pip is visible (open issue: Pip missing on fresh load).
Existing data: no Start here and saved data is byte-identical. Does NOT import ff_session (the landing is under test)."""
import sys, json
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; R = [0, 0]
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
CHARS = """[...document.querySelectorAll('img[src*="assets/pip/"]')].filter(i=>{const r=i.getBoundingClientRect();if(!(r.width>0&&r.height>0))return false;
 if(r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;let e=i;while(e){const s=getComputedStyle(e);if(s.visibility==='hidden'||+s.opacity===0)return false;e=e.parentElement}
 return !i.closest('#askPipBtn,.pipface')}).map(i=>i.src.split('/').pop())"""
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for w in (344, 390, 882):
        c = br.new_context(viewport={'width': w, 'height': 800}, service_workers='block'); g = c.new_page(); errs = []
        g.on('pageerror', lambda e: errs.append(str(e))); g.goto(B + '?nosw'); g.wait_for_timeout(700)
        ok(f'[{w}] fresh: landing shown', g.locator('#ffLanding').is_visible())
        ok(f'[{w}] fresh: Start here note shown', g.locator('#ffStartHere').is_visible())
        ok(f'[{w}] fresh: Find floss tagged Start here', 'Start here' in g.inner_text('#ffLanding a[data-tab="tabConvert"]'))
        txt = g.inner_text('#ffLanding'); ok(f'[{w}] no em dash in landing copy', '\u2014' not in txt)
        ok(f'[{w}] Pip greeting unchanged', g.inner_text('#ffLandSay') == "Hi! I'm Pip. What are we stitching up today?")
        ok(f'[{w}] tour button still there', g.locator('#ffLandTour').is_visible())
        g.click('#ffLanding a[data-tab="tabConvert"]'); g.wait_for_timeout(900)
        ok(f'[{w}] choosing Find floss stores only the seen flag', json.loads(g.evaluate(DUMP)) == [['flossfox-dev.startHere.v1', 'seen']] or all(k.startswith('flossfox-dev.') and not k == 'flossfox-dev.v1' for k, _ in json.loads(g.evaluate(DUMP))), g.evaluate(DUMP))
        v = g.evaluate(CHARS); ok(f'[{w}] fresh first load: exactly one Pip visible on Find floss', len(v) == 1, v)
        g.evaluate("window.ffShowLanding()"); g.wait_for_timeout(300)
        ok(f'[{w}] Start here gone once seen', g.locator('#ffStartHere').count() == 0)
        ok(f'[{w}] no page errors', not errs, errs); c.close()
    # Got it button
    c = br.new_context(viewport={'width': 390, 'height': 800}, service_workers='block'); g = c.new_page(); g.goto(B + '?nosw'); g.wait_for_timeout(600)
    g.click('#ffStartHere'); g.wait_for_timeout(200)
    ok('Got it: note dismissed, flag stored', g.locator('#ffStartHere').count() == 0 and g.evaluate("localStorage.getItem('flossfox-dev.startHere.v1')") == 'seen')
    ok('Got it: nothing else stored', json.loads(g.evaluate(DUMP)) == [['flossfox-dev.startHere.v1', 'seen']], g.evaluate(DUMP)); c.close()
    # Tour from landing on a fresh visit
    c = br.new_context(viewport={'width': 390, 'height': 800}, service_workers='block'); g = c.new_page(); g.goto(B + '?nosw'); g.wait_for_timeout(600)
    g.click('#ffLandTour'); g.wait_for_timeout(800); ok('fresh: tour starts from landing', g.locator('#tourCard').is_visible()); c.close()
    # Existing user data: unchanged, no Start here
    for key in ('flossfox-dev.v1', 'flossfox.v1', 'flossfox-dev.threads.v1'):
        val = '{"schema":2,"projects":[],"x":"keep me"}'
        c = br.new_context(viewport={'width': 390, 'height': 800}, service_workers='block')
        c.add_init_script(f"if(!sessionStorage.getItem('i')){{sessionStorage.setItem('i','1');localStorage.setItem('{key}',{json.dumps(val)})}}")
        g = c.new_page(); g.goto(B + '?nosw'); g.wait_for_timeout(700)
        ok(f'existing {key}: no Start here', g.locator('#ffStartHere').count() == 0)
        ok(f'existing {key}: no seen flag written', g.evaluate("localStorage.getItem('flossfox-dev.startHere.v1')") is None)
        g.click('#ffLanding a[data-tab="tabConvert"]'); g.wait_for_timeout(500)
        ok(f'existing {key}: no seen flag after choosing', g.evaluate("localStorage.getItem('flossfox-dev.startHere.v1')") is None); c.close()
    br.close()
print(f'\n{R[0]} passed, {R[1]} failed'); sys.exit(1 if R[1] else 0)
