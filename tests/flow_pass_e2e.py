"""Flow pass (dev): short paths to the main action on every tab.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/flow_pass_e2e.py URL
The real-pattern check uses a PRIVATE local PDF (not in the repo). Set FLOW_PDF to its path; it is skipped when missing."""
import sys, os, json
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
B = sys.argv[1]; KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY.replace('.v1', '')
PDF = os.environ.get('FLOW_PDF', '/workspace/flow-pass/myke-example.pdf')
R = []
def ok(n, c, d=''):
    R.append(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else f'  -> {str(d)[:300]}'))
SEED = "if(!sessionStorage.getItem('seeded')){localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s.hints.v1','off');sessionStorage.setItem('seeded','1')}" % (PFX, PFX)
KEY15 = ['310', 'BLANC', '415', '01', '797', '762', '3799', '225', '434', '3862', '648', '433', '647', '948', '03']
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    def page(w=390, h=844, init=''):
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=1); c.add_init_script(SEED + ';' + init)
        g = c.new_page(); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e))); g.on('dialog', lambda d: d.accept()); g.goto(B); g.wait_for_timeout(400); return g
    def store(g): return g.evaluate(f"JSON.parse(localStorage.getItem('{KEY}'))||{{projects:[]}}")
    def threads(g): return g.evaluate(f"JSON.parse(localStorage.getItem('{PFX}.threads.v1'))||{{}}")
    # ---- Item 2: real pattern PDF import
    if os.path.exists(PDF):
        g = page()
        g.evaluate("FFImportOpen()"); g.set_input_files('#patFile', PDF)
        g.wait_for_function("!/Reading selected file/.test(document.getElementById('patInfo').textContent)", timeout=60000); g.wait_for_timeout(300)
        codes = g.evaluate("[...document.querySelectorAll('#patRows .pat-row b')].map(b=>b.firstChild.textContent.replace('DMC ',''))")
        ok('F2a the real pattern imports exactly its 15 key colors', sorted(codes) == sorted(KEY15), codes)
        ok('F2b no chart row or column numbers became colors', not any(c in codes for c in ['48', '51', '52', '53', '57', '69']), codes)
        src01 = g.evaluate("(document.querySelector('#patRow-01 small')||{}).textContent||''")
        ok('F2c DMC 01 comes from the key line, not "108 x 59 Stitches"', 'White Tin' in src01 and 'Stitch' not in src01, src01)
        txt = g.inner_text('#patCheck') if g.locator('#patCheck').count() else ''
        ok('F2d no false "listed more than once" flags for a key printed on several pages', 'more than once' not in txt, txt)
        ok('F2e no "never show up in the chart" flag for colors not in the key', 'never show up' not in txt and 'DMC 06' not in txt and 'DMC 05' not in txt, txt)
        vis = g.evaluate("(()=>{const e=document.getElementById('patAll'),b=document.getElementById('patImport'),v=innerHeight;const r1=e.getBoundingClientRect(),r2=b.getBoundingClientRect();return r1.top>=0&&r1.bottom<=v&&r2.top>=0&&r2.bottom<=v})()")
        ok('F2f the confirm tick and Create project are on screen without scrolling', vis)
        h = g.evaluate("document.getElementById('patRows').scrollHeight")
        ok('F2g the review list is short (under 1700px for 15 colors on a phone)', h < 1700, h)
        ok('F2h "no amounts" is said once, not on every row', g.locator('.pat-noamt').count() == 1 and g.locator('#patRows .pat-warnings').count() == 0)
        g.check('#patAll'); g.fill('#patName', 'Scout'); g.click('#patImport'); g.wait_for_timeout(600)
        pr = store(g)['projects']
        ok('F2i Create project saves all 15 colors', len(pr) == 1 and len(pr[0].get('items', [])) == 15, json.dumps(pr)[:300])
        ok('F2j no page errors during import', not g.errs, g.errs)
        g.context.close()
    else:
        print('SKIP F2 real pattern PDF (set FLOW_PDF)')

    # ---- Item 3: quick add at the top of My threads
    g = page()
    g.click('#tabThreads'); g.wait_for_timeout(200)
    top = g.evaluate("document.getElementById('thAdd').getBoundingClientRect().bottom")
    ok('F3a the add box is on the first phone screen', top < 844 - 60, top)
    ok('F3b Add sits right beside the box (phones: full-width box, Add just below)', g.evaluate("(()=>{const a=document.getElementById('thAdd').getBoundingClientRect(),b=document.getElementById('thAddBtn').getBoundingClientRect();return innerWidth<=560?(b.top>=a.bottom-1&&b.top-a.bottom<30):Math.abs(a.top-b.top)<30})()"))
    g.fill('#thAdd', '310'); g.press('#thAdd', 'Enter'); g.wait_for_timeout(200)
    ok('F3c typing 310 and Enter adds it', '310' in threads(g).get('threads', {}), threads(g))
    g.fill('#thAdd', '321, 3865 x2'); g.click('#thAddBtn'); g.wait_for_timeout(200)
    th = threads(g).get('threads', {})
    ok('F3d several at once with the same rules (3865 x2 is 2 skeins)', '321' in th and th.get('3865', {}).get('n') == 2, th)
    ok('F3e the privacy note is folded, not in the way', g.locator('.thkept').count() == 1 and not g.evaluate("document.querySelector('.thkept').open"))
    g.context.close()
    # ---- Item 4: add owned colors from a project, with a count and an Undo
    g = page()
    g.evaluate("""FlossFoxThreadsUI.addItems([{code:'310',n:5}]);FlossFoxProjects.add({id:'p-autumn',name:'Autumn fox',items:[{code:'310',qty:1},{code:'321',qty:1},{code:'666',qty:2},{code:'797',qty:1}],
      decisions:{'310':{status:'have',owned:1},'321':{status:'have',owned:2},'666':{status:'have',owned:null},'797':{status:'buy',owned:0}}})""")
    g.click('#tabThreads'); g.wait_for_timeout(300)
    btn = g.locator('#thFromProj [data-from]')
    ok('F4a My threads offers the project with a clear count (2 new, 310 already owned)', btn.count() == 1 and 'Add 2 colors you have from Autumn fox' in (btn.get_attribute('aria-label') or ''), btn.all_inner_texts())
    before = threads(g)['threads']['310']
    btn.click(); g.wait_for_timeout(200); th = threads(g)['threads']
    ok('F4b it adds exactly the 2 new colors and leaves 310 alone', set(th) == {'310', '321', '666'} and th['310'] == before and th['321']['n'] == 2, th)
    ok('F4c an Undo is offered right there', g.locator('[data-ffundo]').is_visible())
    g.click('[data-ffundo]'); g.wait_for_timeout(200); th = threads(g)['threads']
    ok('F4d Undo takes back exactly what was added', set(th) == {'310'} and th['310'] == before, th)
    g.click('#tabProjects'); g.wait_for_timeout(200); g.evaluate("FlossFoxProjects.open('p-autumn')"); g.wait_for_timeout(400)
    pb = g.locator('#pToThreadsBtn')
    ok('F4e an open project offers "Put my 2 colors marked Have enough in My threads"', pb.count() == 1 and '2 colors' in pb.inner_text(), pb.all_inner_texts())
    pb.click(); g.wait_for_timeout(200); th = threads(g)['threads']
    ok('F4f the project button adds them and offers Undo', set(th) == {'310', '321', '666'} and g.locator('#projEdit [data-ffundo]').count() == 1, th)
    ok('F4g project choices were not changed', g.evaluate("FlossFoxProjects._store().projects.find(x=>x.id==='p-autumn').decisions['797'].status") == 'buy')
    ok('F4h no page errors', not g.errs, g.errs)
    g.context.close()

    # ---- Item 5: correct "to buy" count, one tap fills missing amounts (Estimated), Undo
    g = page()
    codes = ['310','321','666','797','820','905','208','413','3865','444']
    g.evaluate("codes=>FlossFoxProjects.add({id:'p-ten',name:'Ten to buy',items:codes.map(c=>({code:c,qty:null})),decisions:Object.fromEntries(codes.map(c=>[c,{status:'buy',owned:null}]))})", codes)
    g.evaluate("FlossFoxProjects.open('p-ten')"); g.wait_for_timeout(400)
    ok('F5a 10 marked Need to buy shows 10 to buy, not 0', g.inner_text('#sBuy') == '10', g.inner_text('#sBuy'))
    fb = g.locator('#pFillBtn')
    ok('F5b one button offers to fill the 10 missing amounts, marked Estimated', fb.count() == 1 and 'Estimated' in fb.inner_text() and '10 colors' in g.inner_text('#pFill'), g.locator('#pFill').all_inner_texts())
    fb.click(); g.wait_for_timeout(300)
    its = g.evaluate("FlossFoxProjects._store().projects.find(x=>x.id==='p-ten').items.map(i=>[i.qty,i.assumed])")
    ok('F5c every missing amount is now 1 skein, kept as assumed', all(q == 1 and a == 1 for q, a in its), its)
    ok('F5d the shopping list marks them Estimated', g.locator('#pPlan .ffest').count() >= 1 and g.inner_text('#sBuy') == '10')
    g.click('[data-fillundo]'); g.wait_for_timeout(300)
    its = g.evaluate("FlossFoxProjects._store().projects.find(x=>x.id==='p-ten').items.map(i=>i.qty)")
    ok('F5e Undo puts the amounts back to unknown', all(q is None for q in its) and g.locator('#pFillBtn').count() == 1, its)
    ok('F5f no page errors', not g.errs, g.errs)
    g.context.close()

    # ---- Item 1: one row of phone tabs that scrolls, Settings included, smaller Ask Pip
    for w in (390, 440):
        g = page(w)
        r = g.evaluate("""(()=>{const n=document.querySelector('nav.tabs'),k=[...n.children].filter(e=>e.offsetParent);return {tops:[...new Set(k.map(e=>Math.round(e.getBoundingClientRect().top)))].length,h:n.getBoundingClientRect().height,set:!!document.getElementById('tabSettings').offsetParent,small:k.every(e=>e.getBoundingClientRect().height>=44),sw:document.documentElement.scrollWidth,ask:document.getElementById('askPipBtn').getBoundingClientRect().height}})()""")
        ok(f'F1a {w}: all tabs sit in one row, Settings included', r['tops'] == 1 and r['set'] and r['h'] < 70, r)
        ok(f'F1b {w}: tabs stay easy to tap (44px) and the page does not scroll sideways', r['small'] and r['sw'] <= w, r)
        ok(f'F1c {w}: Ask Pip is smaller (under 50px tall)', r['ask'] < 50, r)
        g.click('#tabSettings'); g.wait_for_timeout(200)
        ok(f'F1d {w}: Settings opens from the tab row and stays in view', g.locator('#tabSettings[aria-pressed=true]').count() == 1 and g.evaluate("(()=>{const a=document.getElementById('tabSettings').getBoundingClientRect(),n=document.querySelector('nav.tabs').getBoundingClientRect();return a.left>=n.left-1&&a.right<=n.right+1})()"))
        g.context.close()
    g = page(1280)
    ok('F1e desktop tabs unchanged (wrap allowed, Settings shown)', g.evaluate("getComputedStyle(document.querySelector('nav.tabs')).flexWrap") == 'wrap' and g.locator('#tabSettings').is_visible())
    g.context.close()

    # ---- Item 6: Shopping opens the last-used project, store note is a fold, store chips side by side
    g = page()
    g.evaluate("FlossFoxProjects.add({id:'p-old',name:'Older',updated:'2020-01-01T00:00:00.000Z',items:[{code:'333',qty:1}],decisions:{'333':{status:'buy',owned:null}}})")
    g.evaluate("FlossFoxProjects.add({id:'p-s',name:'Shop test',items:[{code:'310',qty:2},{code:'321',qty:1}],decisions:{'310':{status:'buy',owned:null},'321':{status:'buy',owned:null}}})")
    g.reload(); g.wait_for_timeout(500); g.click('#tabShop'); g.wait_for_timeout(600)
    ok('F6a Shopping opens the last-used project by itself', g.locator('#shopPick').input_value() == 'p-s' and g.locator('#shopBody #pPlan').count() == 1, g.locator('#shopPick').input_value())
    ok('F6b the store note is a one-line fold, closed', g.locator('#shopView details.ffstore').count() == 1 and not g.evaluate("document.querySelector('#shopView details.ffstore').open") and g.locator('#shopView details.ffstore summary').bounding_box()['height'] < 50)
    tops = g.evaluate("[...document.querySelector('#shopView .ff-skein-inline').querySelectorAll('.ff-skein-pill')].map(a=>Math.round(a.getBoundingClientRect().top))")
    ok('F6c store links are small chips side by side', len(tops) >= 2 and len(set(tops)) == 1 and g.evaluate("document.querySelector('#shopView .ff-skein-pill').getBoundingClientRect().height") < 44, tops)
    g.click('#tabProjects'); g.wait_for_timeout(300)
    ok('F6a2 the auto-pick does not leave Projects stuck inside that project (list shows)', g.locator('[data-open]').first.is_visible(), g.evaluate("!!document.getElementById('projEdit').offsetParent"))
    g.click('#tabShop'); g.wait_for_timeout(300)
    g.select_option('#shopPick', 'p-old'); g.wait_for_timeout(300); g.click('#tabThreads'); g.click('#tabShop'); g.wait_for_timeout(300)
    ok('F6d switching shows that project\'s list, and a picked project stays picked', g.locator('#shopPick').input_value() == 'p-old' and 'Older' in g.text_content('#shopProj') and '333' in g.inner_text('#shopBody'))
    ok('F6e no page errors', not g.errs, g.errs)
    g.context.close()

    # ---- Item 7: shorter project page; steps and Pip both point to the next step; F.done fix
    g = page()
    codes = ['310','321','666','797','820','905','208','413','3865','444']
    g.evaluate("codes=>FlossFoxProjects.add({id:'p-7',name:'Autumn fox',items:codes.map((c,i)=>({code:c,qty:i<6?1:null})),decisions:Object.fromEntries(codes.map((c,i)=>[c,{status:i<3?'buy':i<5?'have':'check',owned:null}]))})", codes)
    g.evaluate("FlossFoxProjects.open('p-7')"); g.wait_for_timeout(500)
    ok('F7a the long readiness list starts folded', g.locator('#pReady details').count() == 1 and not g.evaluate("document.querySelector('#pReady details').open"))
    ok('F7b the summary is compact on a phone (under 650px)', g.evaluate("document.getElementById('pSum').getBoundingClientRect().height") < 650, g.evaluate("document.getElementById('pSum').getBoundingClientRect().height"))
    cur = g.get_attribute('#pFlow [aria-current=step]', 'data-flow'); tip = g.inner_text('#pFlow .pftip')
    ok('F7c with colors still to check, Next points to Readiness, not Shopping', cur == 'ready' and '5 colors still to check' in tip and 'then shop' in tip, (cur, tip))
    ok('F7d done steps read "(done)" to screen readers, not code', '${' not in g.inner_html('#pFlow') and g.locator('#pFlow .sr').count() >= 1 and g.text_content('#pFlow .sr').strip() == '(done)', g.inner_html('#pFlow')[:300])
    g.click('#pFlow [data-flow=ready]'); g.wait_for_timeout(200)
    ok('F7e tapping Readiness opens the list right there', g.evaluate("document.querySelector('#pReady details').open"))
    g.evaluate("document.querySelector('#pReady details').open=true"); g.click('#pFlow [data-flow=review]'); g.wait_for_timeout(200)
    ok('F7f the readiness list stays open once you opened it', g.evaluate("document.querySelector('#pReady details').open"))
    ok('F7g no page errors', not g.errs, g.errs)
    g.context.close()
    b.close()
print(f'flow_pass: {sum(R)} passed, {len(R)-sum(R)} failed'); sys.exit(0 if all(R) else 1)
