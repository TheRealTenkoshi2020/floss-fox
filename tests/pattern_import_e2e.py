"""Pattern import end to end on SYNTHETIC fixtures (tests/fixtures/patterns). Real-pattern validation is a separate manual protocol.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/pattern_import_e2e.py URL"""
import sys, os, json
from playwright.sync_api import sync_playwright
B = sys.argv[1]; KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY.replace('.v1', '')
FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'patterns')
SHOTS = os.environ.get('SHOTS', '/workspace/ci005-shots/major')
R = []
def ok(n, c, d=''):
    R.append(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(d)[:300]}'))
SEED = "localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s.hints.v1','off')" % (PFX, PFX)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page(init=''):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=2); c.add_init_script(SEED + ';' + init)
        g = c.new_page(); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); g.on('dialog', lambda d: d.accept()); g.goto(B); g.wait_for_timeout(300); return g
    def load(g, name, wait=2500):
        g.click('.pat-launch'); g.set_input_files('#patFile', os.path.join(FX, name)); g.wait_for_function("!/Reading selected file/.test(document.getElementById('patInfo').textContent)", timeout=30000); g.wait_for_timeout(200)
        return g.inner_text('#patInfo'), g.evaluate("[...document.querySelectorAll('#patRows .pat-row b')].map(b=>b.textContent)")
    def projects(g): return g.evaluate(f"(JSON.parse(localStorage.getItem('{KEY}'))||{{projects:[]}}).projects")
    # 1 text PDF + save + land on project strip
    g = page()
    info, codes = load(g, 'native-legend.pdf')
    ok('I1 text PDF: colors found locally, nothing sent online', codes == ['DMC 310', 'DMC 321', 'DMC 666', 'DMC 3865'] and 'Nothing was sent online' in info, (codes, info))
    ok('I1b AI page picker and AI button hidden while AI is off', g.locator('#patPageBox').is_hidden() and g.locator('text=Preview page for AI').count() in (0,) or g.locator('text=Preview page for AI').is_hidden())
    ok('I1c Create stays disabled until every color is verified', g.locator('#patImport').is_disabled())
    for t in g.locator('#patRows input[type=checkbox]').all(): t.check()
    g.fill('#patName', 'Synthetic sampler'); g.click('#patImport'); g.wait_for_timeout(400)
    pr = projects(g)
    ok('I1d save: one project with stated amounts only', len(pr) == 1 and {i['code']: i['qty'] for i in pr[0]['items']} == {'310': 2, '321': 1, '666': None, '3865': None}, pr)
    ok('I1e lands on the project with the step strip; next step focused', g.locator('#projEdit').is_visible() and g.locator('#pFlow [aria-current=step]').count() == 1 and 'Pattern saved with 4 colors' in g.inner_text('#projStatus'), g.inner_text('#projStatus'))
    g.screenshot(path=os.path.join(SHOTS, '11-import-landed.png'))
    # 2 inventory comparison after import
    h = page("localStorage.setItem('%s.threads.v1',JSON.stringify({schema:2,threads:{'310':{n:3,partial:false,restock:false,updated:'2026-10-01T00:00:00Z'},'321':{n:0,partial:true,restock:false,updated:'2026-10-01T00:00:00Z'}}}))" % PFX)
    load(h, 'native-legend.pdf')
    for t in h.locator('#patRows input[type=checkbox]').all(): t.check()
    h.click('#patImport'); h.wait_for_timeout(400)
    ok('I2 after import the next step is "Check my threads" (collection exists)', h.get_attribute('#pFlow [aria-current=step]', 'data-flow') == 'cmp')
    h.click('#pFlow [data-flow=cmp]'); h.wait_for_timeout(200)
    cmp = h.inner_text('#pCmp')
    ok('I2b comparison uses the existing engine: 310 owned, others short/missing', 'Compared with my thread collection' in cmp and '1 owned' in cmp.replace('\n', ' ').replace('✓ ', ''), cmp[:300])
    if h.locator('#pUseColl').count():
        h.click('#pUseColl'); h.wait_for_timeout(200)
        if h.locator('#pApplyColl').count(): h.click('#pApplyColl'); h.wait_for_timeout(200)
    h.screenshot(path=os.path.join(SHOTS, '12-import-compared.png'), full_page=False)
    ok('I2c imported items flow into the shopping list without re-entry', h.locator('#pPlan').count() == 1)
    # 3 column table
    k = page(); info, codes = load(k, 'column-table-legend.pdf')
    ok('I3 column-table legend: codes taken, Blanc as White', codes == ['DMC 310', 'DMC WHITE', 'DMC 3865', 'DMC 321'], codes)
    vals = k.evaluate("[...document.querySelectorAll('#patRows input[type=number]')].map(i=>i.value)")
    ok('I3b unlabeled numbers are not filled in', all(v == '' for v in vals), vals)
    ok('I3c plain-language warning shown', 'no label' in k.inner_text('#patRows'))
    k.screenshot(path=os.path.join(SHOTS, '13-column-table.png'), full_page=True)
    k.click('#ffPatternDialog .pat-header button'); k.wait_for_timeout(200)
    ok('I3d cancel (Close) saves nothing', projects(k) == [] and not k.locator('#ffPatternDialog').count())
    # 4 specialty + misrecognition + ambiguous
    s = page(); info, codes = load(s, 'specialty-legend.pdf')
    ok('I4 specialty: only stranded cotton rows', codes == ['DMC 310', 'DMC 115'], codes)
    ok('I4b specialty lines shown as not imported', s.locator('#patSkipped').count() == 1 and '5 lines not imported' in s.inner_text('#patSkipped summary'), s.inner_text('#patRows')[:300])
    s.click('#patSkipped summary'); s.screenshot(path=os.path.join(SHOTS, '14-specialty.png'), full_page=True); s.click('#ffPatternDialog .pat-header button')
    info, codes = load(s, 'misrecognition-legend.pdf')
    ok('I5 misread codes not imported; listed for checking', codes == ['DMC 321', 'DMC 415', 'DMC 01'] and 'not recognized' in s.text_content('#patSkipped'), (codes, s.inner_text('#patRows')[:200]))
    s.click('#ffPatternDialog .pat-header button')
    info, codes = load(s, 'ambiguous-qty-legend.pdf')
    vals = s.evaluate("[...document.querySelectorAll('#patRows input[type=number]')].map(i=>i.value)")
    ok('I6 ambiguous amounts: none guessed (666 -, 321 range -, 413 approx 1, 3865 1)', vals[0::2] == ['', '', '1', '1'], vals)
    s.click('#ffPatternDialog .pat-header button')
    info, codes = load(s, 'repeated-codes-2pages.pdf')
    ok('I7 repeated code on two pages: one row, amounts cleared', codes.count('DMC 310') == 1 and s.evaluate("document.querySelector('#patRows input[type=number]').value") == '', codes)
    s.click('#ffPatternDialog .pat-header button')
    info, codes = load(s, 'row-numbers-dimensions.pdf')
    vals = s.evaluate("[...document.querySelectorAll('#patRows input[type=number]')].map(i=>i.value)")
    ok('I7b row numbers vs codes vs dimensions: 310, 321, 3865 only; only the labeled amount filled', codes == ['DMC 310', 'DMC 321', 'DMC 3865'] and vals[0::2] == ['', '', '1'] and 'row number or symbol' in s.inner_text('#patRows'), (codes, vals))
    s.click('#ffPatternDialog .pat-header button')
    # 5 scanned / image / bad files
    info, codes = load(s, 'scanned-image-only.pdf')
    ok('I8 scanned PDF: no text, no colors invented, manual paste offered', codes == [] and 'No reliable colors' in s.inner_text('#patRows'), (info, codes))
    s.click('#ffPatternDialog .pat-header button')
    info, codes = load(s, 'legend-scan.png')
    ok('I9 legend image: no OCR without AI, no upload, manual paste offered', codes == [] and ('uploaded' in info and ('No image has been' in info or 'Nothing has been' in info)), info)
    s.click('#ffPatternDialog .pat-header button')
    for bad in ['password-protected.pdf', 'fake.pdf']:
        info, codes = load(s, bad)
        ok(f'I10 {bad}: refused with a message, nothing imported', codes == [] and projects(s) == [], info); s.click('#ffPatternDialog .pat-header button')
    info, codes = load(s, 'large-35pages.pdf', 6000)
    ok('I11 35-page PDF processed locally without hanging', 'Processed' in info or 'pages' in info, info); s.click('#ffPatternDialog .pat-header button')
    # 6 manual paste path
    s.click('.pat-launch'); s.click('#ffPatternDialog details summary'); s.fill('#patPaste', 'X 310 Black 2400 2\nDMC 321 Red 2 skeins'); s.click('#ffPatternDialog button:text-is("Find colors")'); s.wait_for_timeout(200)
    ok('I12 manual legend paste uses the same rules', s.evaluate("[...document.querySelectorAll('#patRows .pat-row b')].map(b=>b.textContent)") == ['DMC 310', 'DMC 321'])
    errs = g.errs + h.errs + k.errs + s.errs
    ok('I13 no page errors', not errs, errs)
print(f'{sum(R)} passed, {len(R)-sum(R)} failed'); sys.exit(0 if all(R) else 1)
