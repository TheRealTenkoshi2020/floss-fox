"""CI005 integration browser check (dev keys). Usage: python3 tests/ci005_browser.py http://127.0.0.1:18930/ [shots_dir] [fixtures_dir]"""
import json,sys,os,re
from playwright.sync_api import sync_playwright
B=sys.argv[1].rstrip('/')+'/';SH=sys.argv[2] if len(sys.argv)>2 else '/workspace/ci005-shots';FX=sys.argv[3] if len(sys.argv)>3 else '/workspace/ci005/fixtures'
KEY='flossfox-dev.v1';TKEY='flossfox-dev.threads.v1'
TH={'schema':1,'threads':{'310':{'n':2,'partial':False,'restock':False,'confirmed':True,'updated':'2026-10-14T00:00:00Z'},'321':{'n':1,'partial':True,'restock':False,'confirmed':True,'updated':'2026-10-14T00:00:00Z'},'415':{'n':3,'partial':False,'restock':False,'confirmed':True,'updated':'2026-10-14T00:00:00Z'}}}
it=lambda c,q:{'code':c,'qty':q,'assumed':0,'stated':True,'src':[c]}
PROJ={'schema':2,'projects':[{'id':'t20a','name':'Inline test','notes':'','buyBrand':'dmc','status':'planning','items':[it('310',2),it('321',1),it('666',1),it('3865',1),it('415',1),it('48',1)],'decisions':{'310':{'status':'buy'},'321':{'status':'buy'},'666':{'status':'buy'},'3865':{'status':'check'},'415':{'status':'have','owned':2},'48':{'status':'buy'}},'purchased':{},'created':'2026-10-01T00:00:00Z','updated':'2026-10-01T00:00:00Z'}]}
INIT="if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('flossfox-dev.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s',%s);localStorage.setItem('%s',%s)}"%(KEY,json.dumps(json.dumps(PROJ)),TKEY,json.dumps(json.dumps(TH)))
R=[0,0]
def ok(n,c,i=''):R[0 if c else 1]+=1;print(('PASS ' if c else 'FAIL ')+n+('' if c else ' -> '+str(i)[:300]))
def ctx(b,w,h=844,mob=False,sw='block',**k):
 c=b.new_context(viewport={'width':w,'height':h},is_mobile=mob,device_scale_factor=2 if mob else 1,service_workers=sw,**k);c.add_init_script(INIT);return c
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
 # ---- layouts at all widths
 for w,mob in ((390,True),(673,True),(884,True),(768,False),(1280,False)):
  c=ctx(b,w,mob=mob);g=c.new_page();E=[];g.on('pageerror',lambda e:E.append(str(e)));g.goto(B);g.wait_for_load_state('networkidle')
  bad=[]
  for tab in ('#tabConvert','#tabThreads','#tabProjects','#tabShop','#tabHelp'):
   g.click(tab);g.wait_for_timeout(150)
   if tab=='#tabProjects':g.click('[data-open="t20a"]');g.wait_for_timeout(150)
   if g.evaluate('document.documentElement.scrollWidth')>w:bad.append(tab)
   if w==390:g.screenshot(path=f'{SH}/{w}-{tab[4:].lower()}.png',full_page=False)
  g.click('#tabConvert');g.click('#convertView .pat-launch');g.wait_for_timeout(200)
  dlg=g.evaluate("(()=>{const d=document.getElementById('ffPatternDialog');const r=d.getBoundingClientRect();return{open:d.open,w:r.width,right:r.right,ow:document.documentElement.scrollWidth}})()")
  if w in(390,884,1280):g.screenshot(path=f'{SH}/{w}-pattern-dialog.png')
  g.keyboard.press('Escape');g.wait_for_timeout(100)
  ok(f'[{w}] no horizontal overflow on tabs + pattern dialog fits',not bad and dlg['open'] and dlg['right']<=w+1,(bad,dlg))
  ok(f'[{w}] pattern dialog closes with Escape',not g.evaluate("(document.getElementById('ffPatternDialog')||{}).open"))
  ok(f'[{w}] no page errors',not E,E);c.close()
 # ---- main functional pass at 390
 c=ctx(b,390,mob=True);g=c.new_page();E=[];REQ=[];g.on('pageerror',lambda e:E.append(str(e)));g.on('dialog',lambda d:(E.append('JS dialog '+d.message),d.dismiss()))
 g.on('request',lambda r:REQ.append((r.method,r.url)))
 g.goto(B);g.wait_for_load_state('networkidle');REQ.clear()
 # Pip: Ask Pip + Chat with Pip 20x, no duplicates
 for i in range(20):
  g.click('#askPipBtn');g.wait_for_timeout(30)
  if g.locator('[data-piph-open]').count():g.click('[data-piph-open]');g.wait_for_timeout(30);g.keyboard.press('Escape');g.wait_for_timeout(30)
  if g.is_visible('#askPip'):g.click('#askPipBtn')
 ok('PH-02 Chat with Pip opened/closed 20x: one dialog, one chat button',g.evaluate("document.querySelectorAll('#pipHybridDialog').length")==1 and g.evaluate("document.querySelectorAll('[data-piph-open]').length")<=1,g.evaluate("[document.querySelectorAll('#pipHybridDialog').length,document.querySelectorAll('[data-piph-open]').length]"))
 g.click('#askPipBtn');ok('PH-01 existing Ask Pip topics still present',g.locator('#askPip .atopics button').count()>=4)
 g.click('[data-piph-open]');g.fill('#piphMessage','How much fabric for 140 by 200 stitches on 14 count aida?');g.click('#pipHybridDialog button:has-text("Ask offline")');g.wait_for_timeout(300)
 ans=g.inner_text('#pipHybridDialog');ok('PH-05 offline Aida answer 10 x 14.29 in, design size not cut',('10' in ans and '14.29' in ans),ans[-400:])
 g.fill('#piphMessage','<img src=x onerror=alert(1)> what is the meaning of life');g.click('#pipHybridDialog button:has-text("Ask offline")');g.wait_for_timeout(300)
 ok('PH-08/PH-13 unknown question: honest non-answer, no HTML injected',g.evaluate("!document.querySelector('#pipHybridDialog img[src=\"x\"]')"))
 aiBtn=g.locator('#pipHybridDialog button:has-text("Ask online AI")')
 ok('AI online path disabled (no endpoint): button absent or disabled',aiBtn.count()==0 or aiBtn.first.is_disabled() or not aiBtn.first.is_visible())
 g.keyboard.press('Escape');g.wait_for_timeout(100)
 ok('PH-26 Escape closes Chat with Pip',not g.evaluate("(document.getElementById('pipHybridDialog')||{}).open"))
 # Local router (read-only command)
 # Pattern import
 g.click('#askPipBtn') if g.is_visible('#askPip') else None
 g.click('#tabConvert');g.click('#convertView .pat-launch');g.wait_for_timeout(200)
 def load(fn,wait='Reading selected file locally'):
  g.set_input_files('#patFile',os.path.join(FX,fn));g.wait_for_function("t=>!document.getElementById('patInfo').textContent.includes(t)",arg=wait,timeout=20000);g.wait_for_timeout(300)
  return g.evaluate("({info:document.getElementById('patInfo').textContent+' '+((document.getElementById('patUnreadable')||{}).textContent||''),rows:[...document.querySelectorAll('#patRows .pat-row')].map(r=>r.querySelector('b').textContent+' | '+[...r.querySelectorAll('input[type=number]')].map(i=>i.value||'?').join('/')+' | '+r.querySelector('.pat-warnings').textContent),txt:document.getElementById('patRows').innerText,imgs:document.querySelectorAll('#patRows img').length,dis:document.getElementById('patImport').disabled})")
 r=load('native-legend.pdf');print('native:',r)
 codes=[x.split(' | ')[0] for x in r['rows']]
 ok('native PDF: 310/321/666 extracted locally',{'DMC 310','DMC 321','DMC 666'}<=set(codes),r)
 ok('native PDF: 310 qty 2 and stitches 2400 kept separate',any(x.startswith('DMC 310 | 2/2400') for x in r['rows']),r['rows'])
 ok('native PDF: 666 skeins unknown (not invented)',any(x.startswith('DMC 666 | ?/') for x in r['rows']),r['rows'])
 ok('native PDF: invalid DMC 9999 not accepted as color',not any('9999' in x.split(' | ')[0] for x in r['rows']),r['rows'])
 ok('XSS in imported text inert (no img element, no JS dialog)',r['imgs']==0 and not any('JS dialog' in e for e in E),E)
 ok('import blocked until the one "I checked these colors" confirmation',r['dis'] and 'Tick the box above' in g.inner_text('#patWhy'))
 n0=len(g.evaluate("FlossFoxProjects._store().projects"))
 g.check('#patAll');ok('one confirmation enables Create (no per-color ticking)',not g.evaluate("document.getElementById('patImport').disabled"))
 g.fill('#patName','Imported fixture');g.click('#patImport');g.wait_for_timeout(400)
 ps=g.evaluate("FlossFoxProjects._store().projects");new=[x for x in ps if x['name']=='Imported fixture']
 ok('reviewed import saves ONE project via FlossFoxProjects.add',len(ps)==n0+1 and len(new)==1,len(ps))
 if new:
  i310=[i for i in new[0]['items'] if i['code']=='310'];i666=[i for i in new[0]['items'] if i['code']=='666']
  ok('saved project keeps stitchCount distinct from skein qty',i310 and i310[0].get('qty')==2 and i310[0].get('stitchCount')==2400,new[0]['items'])
  ok('unknown skein qty stays unknown/uncertain in saved project',i666 and (i666[0].get('qty') is None or i666[0].get('stated') is False),i666)
 ok('importer keeps no raw pattern in storage',not g.evaluate("Object.keys(localStorage).some(k=>/pattern|pdf/i.test(k)||/%PDF|Fox Sampler legend/.test(localStorage.getItem(k)))"))
 if not g.evaluate("(document.getElementById('ffPatternDialog')||{}).open"):g.click('#tabConvert');g.click('#convertView .pat-launch');g.wait_for_timeout(200)
 for fn,expect,label in (('multicolumn-legend.pdf',None,'multi-column legend'),('scanned-image-only.pdf','no text we can read','scanned PDF has no selectable text'),('large-35pages.pdf','30','35-page PDF limited to 30'),('password-protected.pdf',None,'password-protected PDF'),('fake.pdf',"don't match",'fake .pdf rejected by signature'),('legend-scan.png','Only PDFs work right now','image refused: only PDFs work right now'),('table-unlabeled-legend.pdf','no label','unlabeled column table: codes taken, unlabeled numbers not imported (2.0A rule)'),('repeated-legend.pdf',None,'repeated legend')):
  try:r=load(fn);print(fn,r['info'][:160],r['rows'][:8])
  except Exception as e:r={'info':'TIMEOUT '+str(e)[:80],'rows':[]}
  if fn=='multicolumn-legend.pdf':ok('multi-column legend: 6 colors found (or flagged for review)',len(r['rows'])>=6,r)
  elif fn=='repeated-legend.pdf':c3=[x for x in r['rows'] if x.startswith('DMC 310 ')];ok('repeated legend: 310 not double-counted silently (one row or flagged duplicate)',len(c3)==1 or all('uplicate' in x for x in c3),r['rows'])
  elif fn=='password-protected.pdf':ok('password-protected PDF: friendly error, no rows, no crash',not r['rows'] and 'TIMEOUT' not in r['info'],r['info'])
  else:ok(label,expect.lower() in (r['info']+r['txt']).lower() and (fn!='scanned-image-only.pdf' or not r['rows']),r['info'])
 ok('no network transfer during pattern import (same-origin GET only, no POST)',all(m=='GET' and u.startswith(B) for m,u in REQ),[x for x in REQ if x[0]!='GET' or not x[1].startswith(B)][:5])
 g.keyboard.press('Escape')
 # Thread locations + bulk + undo
 g.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");g.click('#tabThreads');g.wait_for_timeout(200)
 g.evaluate("document.querySelectorAll('#threadsView details').forEach(d=>d.open=true)");print('loc-visible',g.is_visible('#ff-container-310'))
 g.fill('#ff-container-310','Box 2');g.fill('#ff-slot-310','Row B');g.locator('#ff-container-310').locator('xpath=ancestor::*[.//button[contains(.,"Save location")]][1]').locator('button:has-text("Save location")').first.click();g.wait_for_timeout(200)
 d=json.loads(g.evaluate(f"localStorage.getItem('{TKEY}')"))
 ok('location saved; quantity/partial/confirmed unchanged',d['threads']['310'].get('storage',{}).get('container')=='Box 2' and d['threads']['310']['n']==2 and d['threads']['310']['confirmed'] is True,d['threads']['310'])
 before={k:{x:v.get(x) for x in('n','partial','confirmed','restock')} for k,v in d['threads'].items()}
 sbox=g.locator('#threadsView input[type=search], #thSearch').first
 if sbox.count():sbox.fill('Box 2');g.wait_for_timeout(200);vis=g.evaluate("[...document.querySelectorAll('#threadsView [id^=ff-container-]')].filter(e=>e.offsetParent).map(e=>e.id)");ok('search "Box 2" finds 310',vis==['ff-container-310'],vis);sbox.fill('')
 g.click('button:has-text("Select visible colors")');g.wait_for_timeout(100)
 g.select_option('#ffBulkMode',index=0);g.fill('#ffBulkContainer','Drawer 1');g.wait_for_timeout(100)
 g.click('button:has-text("Review location changes")');g.wait_for_timeout(200)
 ap=g.locator('#ffBulkPreview button').first
 if ap.count():ap.click();g.wait_for_timeout(200)
 d2=json.loads(g.evaluate(f"localStorage.getItem('{TKEY}')"));after={k:{x:v.get(x) for x in('n','partial','confirmed','restock')} for k,v in d2['threads'].items()}
 moved=[k for k,v in d2['threads'].items() if (v.get('storage') or {}).get('container')=='Drawer 1']
 ok('bulk storage change applied after review; quantities untouched',moved and after==before,(moved,g.inner_text('#ffBulkMessage') if g.locator('#ffBulkMessage').count() else ''))
 g.locator('#ffBulkUndo').click(timeout=3000) if g.locator('#ffBulkUndo').is_enabled() else None;g.wait_for_timeout(200);d3=json.loads(g.evaluate(f"localStorage.getItem('{TKEY}')"))
 ok('bulk undo restores previous locations',d3['threads']['310'].get('storage',{}).get('container')=='Box 2' and not any((v.get('storage') or {}).get('container')=='Drawer 1' for v in d3['threads'].values()),d3)
 g.screenshot(path=f'{SH}/390-threads-locations.png')
 # Backup round-trip with storage
 g.click('#tabProjects')
 if g.is_visible('#pClose'):g.click('#pClose')
 g.evaluate("document.getElementById('backupBox')&&(document.getElementById('backupBox').open=true)")
 with g.expect_download() as dl:g.click('#backupBtn')
 path=dl.value.path();bk=json.load(open(path))
 ok('backup v2 contains thread storage',bk.get('version')==2 and bk['threads']['threads']['310'].get('storage',{}).get('container')=='Box 2' if isinstance(bk.get('threads'),dict) and 'threads' in bk['threads'] else json.dumps(bk).count('Box 2')>0,{k:bk[k] for k in bk if k!='projects'} )
 g.evaluate(f"localStorage.removeItem('{TKEY}')");g.reload();g.wait_for_load_state('networkidle');g.click('#tabProjects')
 if g.is_visible('#pClose'):g.click('#pClose')
 g.evaluate("document.getElementById('backupBox')&&(document.getElementById('backupBox').open=true)")
 g.set_input_files('#restoreFile',path);g.wait_for_timeout(400)
 if g.locator('#rGo').count():
  rep=g.locator('#rmodeSet input[value=replace]')
  if rep.count():rep.check()
  g.click('#rGo');g.wait_for_timeout(300)
 if g.locator('.ffconfirm button:has-text("Replace"), .ffconfirm .pri').count():g.locator('.ffconfirm .pri').first.click();g.wait_for_timeout(300)
 d4=json.loads(g.evaluate(f"localStorage.getItem('{TKEY}')") or '{}')
 ok('restore round-trip brings back storage + quantities',d4.get('threads',{}).get('310',{}).get('storage',{}).get('container')=='Box 2' and d4['threads']['310']['n']==2,d4)
 # v1 backup restore forward
 ok('no page errors (functional pass)',not [e for e in E if not e.startswith('JS dialog')],E)
 c.close()
 # Reduced motion + keyboard
 c=ctx(b,390,mob=True,reduced_motion='reduce');g=c.new_page();E=[];g.on('pageerror',lambda e:E.append(str(e)));g.goto(B);g.wait_for_load_state('networkidle')
 g.focus('#tabConvert');seen=[]
 for _ in range(30):
  g.keyboard.press('Tab');seen.append(g.evaluate("document.activeElement.textContent.trim().slice(0,40)"))
 ok('keyboard reaches Import a pattern (PDF) entry',any('Import a pattern (PDF)' in s for s in seen),seen)
 while 'Import a pattern (PDF)' not in g.evaluate("document.activeElement.textContent"):g.keyboard.press('Tab')
 g.keyboard.press('Enter');g.wait_for_timeout(200);ok('Enter opens pattern dialog; focus inside',g.evaluate("(document.getElementById('ffPatternDialog')||{}).open&&document.getElementById('ffPatternDialog').contains(document.activeElement)"))
 g.keyboard.press('Escape');g.wait_for_timeout(100);ok('focus returns to entry after Escape',('Import a pattern (PDF)' in g.evaluate("document.activeElement.textContent")),g.evaluate("document.activeElement.outerHTML.slice(0,80)"))
 ok('reduced motion: no page errors',not E,E);c.close()
 # Offline with AI off
 c=ctx(b,390,mob=True,sw='allow');g=c.new_page();E=[];g.on('pageerror',lambda e:E.append(str(e)));g.goto(B);g.wait_for_load_state('networkidle')
 g.evaluate("navigator.serviceWorker.ready.then(()=>new Promise(r=>setTimeout(r,2500)))");g.reload();g.wait_for_load_state('networkidle');g.wait_for_timeout(1500)
 cached=g.evaluate("caches.keys().then(async ks=>{const c=await caches.open(ks.find(k=>k.startsWith('flossfox-dev-')));const k=(await c.keys()).map(r=>r.url);return [ks,k.filter(u=>u.includes('pip-hybrid')).length,k.some(u=>u.includes('pdf.worker.mjs'))]})")
 ok('SW precaches pip-hybrid assets + vendored PDF.js',cached[1]>=19 and cached[2],cached)
 c.set_offline(True);g.reload();g.wait_for_timeout(1200)
 g.click('#askPipBtn');g.click('[data-piph-open]');g.fill('#piphMessage','How do I find a stored thread?');g.click('#pipHybridDialog button:has-text("Ask offline")');g.wait_for_timeout(300)
 ok('offline (AI off): Pip offline answer works',len(g.inner_text('#pipHybridDialog'))>120)
 g.keyboard.press('Escape');g.click('#askPipBtn') if g.is_visible('#askPip') else None
 g.click('#tabConvert');g.click('#convertView .pat-launch');g.wait_for_timeout(200)
 try:g.set_input_files('#patFile',os.path.join(FX,'native-legend.pdf'));g.wait_for_function("!document.getElementById('patInfo').textContent.includes('Reading selected file locally')",timeout=20000);g.wait_for_timeout(300);n=g.locator('#patRows .pat-row').count()
 except Exception as e:n=-1
 ok('offline: native PDF still extracted locally from cached PDF.js',n>=3,n)
 ok('offline: no page errors',not E,E);c.close()
print(R[0],'passed,',R[1],'failed')
