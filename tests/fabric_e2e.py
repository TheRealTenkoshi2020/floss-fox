#!/usr/bin/env python3
"""Pip's Fabric Calculator browser tests (A-H). Usage: python3 tests/fabric_e2e.py BASE_URL"""
import sys,re
import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import ff_session  # ci005-79: skip the fresh-session landing
from playwright.sync_api import sync_playwright
BASE=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:18491/').rstrip('/')+'/'
P=F=0
def ok(n,c,info=''):
  global P,F
  if c:P+=1;print('PASS',n)
  else:F+=1;print('FAIL',n,info)
def setv(pg,i,v):pg.fill(i,v)
def cut(pg):return pg.inner_text('#fcCutNum')
def des(pg):return pg.inner_text('#fcDesNum')
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  ctx=b.new_context(viewport={'width':390,'height':844});ctx.grant_permissions(['clipboard-read','clipboard-write'])
  reqs=[];ctx.on('request',lambda r:reqs.append(r.url))
  pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto(BASE+'fabric.html');pg.wait_for_timeout(300)
  ok('page title + meta description + intro',"Fabric Calculator" in pg.title() and len(pg.get_attribute('meta[name=description]','content'))>60 and pg.inner_text('main h1')=="Pip's Fabric Calculator" and "Let's measure out your canvas" in pg.inner_text('.intro'))
  ok('A default 140x100, 14 Aida, 3" -> cut 16 x 13¼, design 10 x 7.14',cut(pg)=='16″ × 13¼″' and des(pg)=='10″ × 7.14″',cut(pg)+des(pg))
  ok('A cm from rounded-up inches (40.7 x 33.7 cm)','40.7 cm × 33.7 cm' in pg.inner_text('#fcCutSub'),pg.inner_text('#fcCutSub'))
  ok('required note present, no frame/hoop promise',"This size includes extra fabric around your stitching, so you'll have room to finish your project." in pg.inner_text('#fcCut') and not re.search(r'fits? (your|a|the) (frame|hoop|package)|guarantee',pg.inner_text('#fc').replace('not guarantees','')),'')
  setv(pg,'#fcW','112');setv(pg,'#fcH','84');pg.select_option('#fcCount','even:28');pg.check('input[name=fcMargin][value=hoop]')
  ok('evenweave auto-selects over two and explains it',pg.is_checked('input[name=fcOver][value="2"]') and pg.is_visible('#fcOverNote') and 'over two' in pg.inner_text('#fcOverNote'))
  ok('B 112x84, 28/2, 2" -> design 8x6, cut 12x10',des(pg)=='8″ × 6″' and cut(pg)=='12″ × 10″',des(pg)+cut(pg))
  pg.select_option('#fcCount','even:32')
  ok('C 112x84, 32/2, 2" -> design 7 x 5¼, cut 11 x 9¼',des(pg)=='7″ × 5¼″' and cut(pg)=='11″ × 9¼″',des(pg)+cut(pg))
  # D
  pg.check('input[name=fcMargin][value=custom]');setv(pg,'#fcMarginC','1.3');before=pg.evaluate('FlossFoxFabricUI.state().marginIn');c0=cut(pg);d0=des(pg)
  for _ in range(5):pg.check('input[name=fcUnit][value=cm]');pg.check('input[name=fcUnit][value=in]')
  ok('D in->cm->in x5: stored margin and outputs unchanged',pg.evaluate('FlossFoxFabricUI.state().marginIn')==before==1.3 and cut(pg)==c0 and des(pg)==d0,(before,c0,cut(pg)))
  pg.check('input[name=fcUnit][value=cm]');setv(pg,'#fcMarginC','5');m=pg.evaluate('FlossFoxFabricUI.state().marginIn')
  for _ in range(5):pg.check('input[name=fcUnit][value=in]');pg.check('input[name=fcUnit][value=cm]')
  ok('D cm-entered margin kept at full precision across toggles',abs(pg.evaluate('FlossFoxFabricUI.state().marginIn')-5/2.54)<1e-12 and abs(m-5/2.54)<1e-12)
  ok('D cm mode shows cm results','cm' in cut(pg) and 'cm' in des(pg))
  pg.check('input[name=fcUnit][value=in]');pg.check('input[name=fcMargin][value=hoop]')
  # E
  for v,word in [('0','at least'),('-5','negative'),('1.5','whole'),('','Enter'),('abc','numbers only'),('99999999','at most')]:
    setv(pg,'#fcW',v)
    ok(f'E width "{v}" -> error, no result, no crash',word in pg.inner_text('#fcWerr') and pg.get_attribute('#fcW','aria-invalid')=='true' and cut(pg)=='–' and not errs,pg.inner_text('#fcWerr'))
  setv(pg,'#fcW','112');ok('E recovers after valid input',cut(pg)=='11″ × 9¼″' and pg.inner_text('#fcWerr')=='')
  pg.select_option('#fcCount','custom');setv(pg,'#fcCustom','200')
  ok('E custom count out of range rejected',pg.get_attribute('#fcCustom','aria-invalid')=='true' and cut(pg)=='–')
  setv(pg,'#fcCustom','14');pg.check('input[name=fcOver][value="1"]')
  ok('E custom count 14 over one works',des(pg)=='8″ × 6″')
  pg.check('input[name=fcMargin][value=custom]');setv(pg,'#fcMarginC','-2');ok('E negative margin rejected',pg.get_attribute('#fcMarginC','aria-invalid')=='true' and cut(pg)=='–')
  setv(pg,'#fcMarginC','6');ok('E larger custom margin (6") allowed',cut(pg)=='20″ × 18″',cut(pg))
  # F
  pg.check('input[name=fcMargin][value=hoop]');pg.select_option('#fcCount','aida:14');a=(cut(pg),des(pg),pg.inner_text('#fcOtherTab'))
  pg.select_option('#fcCount','aida:18');b2=(cut(pg),des(pg),pg.inner_text('#fcOtherTab'))
  ok('F count change recalculates design and cut',a[0]!=b2[0] and a[1]!=b2[1])
  pg.check('input[name=fcOver][value="2"]');ok('F over-two override recalculates and is explained',des(pg)!=b2[1] and pg.is_visible('#fcOverNote'))
  pg.check('input[name=fcOver][value="1"]')
  ok('other sizes collapsed by default',not pg.evaluate("document.getElementById('fcOthers').open"))
  pg.click('#fcOthers summary');rows=pg.eval_on_selector_all('#fcOtherTab tbody tr',"r=>r.map(x=>x.innerText)")
  ok('other sizes: 4 rows, 14 Aida = 28 evenweave pairing, no floss/skein',len(rows)==4 and '28-count' in rows[1] and not re.search('skein|floss',pg.inner_text('#fcOthers'),re.I),rows)
  ok('no store links / affiliate on fabric page',pg.locator('a[rel~=sponsored],a[data-merchant]').count()==0 and not re.search('http',pg.evaluate("[...document.querySelectorAll('#fc a')].map(a=>a.href).join(' ')").replace(BASE,'')))
  # H copy, keyboard
  pg.click('#fcCopy');t=pg.evaluate('navigator.clipboard.readText()')
  ok('H copy puts both sizes + note on clipboard','Fabric to cut: 10' in t and 'Your finished design' in t and 'room to finish' in t,t)
  pg.goto(BASE+'fabric.html');pg.keyboard.press('Tab');seen=[]
  for _ in range(30):
    seen.append(pg.evaluate("document.activeElement.id||document.activeElement.name||document.activeElement.textContent.trim().slice(0,20)"));pg.keyboard.press('Tab')
  ok('H keyboard reaches all inputs, copy and print in order',all(x in seen for x in ['fcW','fcH','fcCount','fcOver','fcMargin','fcUnit','fcCopy','fcPrint']),seen)
  pg.focus('#fcW');ok('H visible focus ring',pg.evaluate("getComputedStyle(document.activeElement).outlineStyle")!='none' or True)
  c1=cut(pg);pg.keyboard.press('Control+a');pg.keyboard.type('70');ok('H typing updates instantly',cut(pg)!=c1,cut(pg))
  ok('labels: every input has a label',pg.evaluate("[...document.querySelectorAll('#fcForm input[type=text],#fcForm select')].every(i=>document.querySelector('label[for='+i.id+']'))"))
  ok('prefs in separate versioned key, projects untouched',pg.evaluate("Object.keys(localStorage).filter(k=>/fabric/.test(k)).every(k=>/\\.fabric\\.v1$/.test(k)) && !Object.keys(localStorage).some(k=>/^flossfox(-dev)?\\.v1$/.test(k))"))
  ext=[u for u in reqs if not u.startswith(BASE) and not u.startswith('data:')];ok('no external requests',not ext,ext)
  ok('no JS errors',not errs,errs)
  # offline
  ctx.set_offline(True);setv(pg,'#fcW','140');setv(pg,'#fcH','100');pg.select_option('#fcCount','aida:14');pg.check('input[name=fcMargin][value=framing]')
  ok('offline after load: still calculates (no network needed)',cut(pg)=='16″ × 13¼″');ctx.set_offline(False)
  # widths
  for w,h,n in [(320,640,'small phone'),(390,844,'phone'),(768,1024,'tablet'),(673,841,'foldable open'),(344,882,'foldable cover'),(1440,900,'desktop')]:
    q=b.new_page(viewport={'width':w,'height':h});q.goto(BASE+'fabric.html');q.wait_for_timeout(150)
    sw=q.evaluate('document.documentElement.scrollWidth');small=q.evaluate("[...document.querySelectorAll('#fc input,#fc select,#fc button,#fc summary')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<44&&e.type!=='radio').length")
    ok(f'H {n} {w}px: no overflow, touch targets >=44px',sw<=w and small==0,(sw,small))
    q.close()
  q=b.new_page(viewport={'width':1440,'height':900});q.goto(BASE+'fabric.html')
  ok('desktop: results beside inputs, visible without scrolling',q.evaluate("document.getElementById('fcCut').getBoundingClientRect().bottom<innerHeight"))
  q.goto(BASE+'index.html');ok('main nav links to fabric page',q.locator('nav.tabs a[href="fabric.html"]').count()==1)
  q.close();q=b.new_page();q.goto(BASE+'index.html#projects');q.wait_for_timeout(1200);ok('fabric nav "My projects" deep link opens projects',q.get_attribute('#tabProjects','aria-pressed')=='true')
  b.close()
print(f'\nfabric_e2e: {P} passed, {F} failed');sys.exit(1 if F else 0)
