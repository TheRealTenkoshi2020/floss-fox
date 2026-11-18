"""3.9 Atelier Stage A (FF39-24): a visitor whose ONLY saved key is the Atelier preference key still gets the landing
"Start here"; real saved data still hides it; the preference value and other data are left byte-identical.
Simulated browser test (Playwright Chromium), not a real phone."""
import sys, json, os
from playwright.sync_api import sync_playwright
B = sys.argv[1].rstrip('/') + '/'; R = [0, 0]
PFX = os.environ.get('FF_KEY', 'flossfox-dev.v1')[:-3]; AK = PFX + '.atelier.v1'
def ok(n, c, d=''): R[0 if c else 1] += 1; print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:300]))
DUMP = "JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))"
PREF = '{"v":1,"theme":"moon","rememberPlace":false}'
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    cases = [('pref only', {AK: PREF}, True), ('pref + projects', {AK: PREF, PFX + '.v1': '{"schema":2,"projects":[]}'}, False),
             ('pref + threads', {AK: PREF, PFX + '.threads.v1': '{"schema":2,"threads":{}}'}, False), ('nothing', {}, True)]
    for name, seed, want in cases:
        for w in (390, 1280):
            c = br.new_context(viewport={'width': w, 'height': 800}, service_workers='block')
            c.add_init_script("if(!sessionStorage.getItem('__seeded')){sessionStorage.setItem('__seeded','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}" % json.dumps(seed))
            g = c.new_page(); errs = []; g.on('pageerror', lambda e: errs.append(str(e)))
            g.goto(B + '?nosw'); g.wait_for_timeout(700)
            ok(f'[{w}] {name}: landing shown', g.locator('#ffLanding').is_visible())
            ok(f'[{w}] {name}: Start here {"shown" if want else "hidden"}', g.locator('#ffStartHere').count() == (1 if want else 0))
            after = dict(json.loads(g.evaluate(DUMP)))
            ok(f'[{w}] {name}: seeded keys byte-identical, nothing else written', after == seed, after)
            ok(f'[{w}] {name}: no page errors', not errs, errs); c.close()
    br.close()
print(f'atelier_first_visit_e2e: {R[0]} passed, {R[1]} failed (simulated)'); sys.exit(1 if R[1] else 0)
