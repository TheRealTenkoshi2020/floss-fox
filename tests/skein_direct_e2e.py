import json,re
from playwright.sync_api import sync_playwright
import sys
B=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/').rstrip('/')+'/';import os;KEY=os.environ.get('FF_KEY','flossfox-dev.v1');PFX=KEY[:-3];TKEY=PFX+'.threads.v1'
it=lambda c,q:{'code':c,'qty':q,'assumed':0,'stated':True,'src':[c]}
items=[it('310',2),it('321',1),it('666',1),it('3865',1),it('415',1),it('48',1)]
dec={'310':{'status':'buy'},'321':{'status':'buy'},'666':{'status':'buy'},'3865':{'status':'check'},'415':{'status':'have','owned':2},'48':{'status':'buy'}}
PROJ={'schema':2,'projects':[{'id':'t20a','name':'Inline test','notes':'','buyBrand':'dmc','status':'planning','items':items,'decisions':dec,'purchased':{},'created':'2026-10-01T00:00:00Z','updated':'2026-10-01T00:00:00Z'}]}
TH={'schema':1,'threads':{'415':{'n':2,'partial':False,'restock':False,'confirmed':True,'updated':'2026-10-14T00:00:00Z'},'3865':{'n':2,'partial':False,'restock':False,'updated':'2026-10-14T00:00:00Z'}}}
EXP={'310':['https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/310-black--dmc-mouline-grays-embroidery-floss/p/106215','https://www.everythingcrossstitch.com/dmc-cotton-cross-stitch-floss-mrl-c274.aspx'],
 '321':['https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/c/5-127-1109','https://www.everythingcrossstitch.com/floss-embroidery-dmc-xmas-red-mrp-p559.aspx'],
 '666':['https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/c/5-127-1109','https://www.everythingcrossstitch.com/dmc-cotton-cross-stitch-floss-mrl-c274.aspx']}
R=[0,0]
def ok(n,c,i=''):R[0 if c else 1]+=1;print(('PASS ' if c else 'FAIL ')+n+('' if c else ' -> '+str(i)[:300]))
INIT="if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('%s.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('%s',%s);localStorage.setItem('%s',%s)}"%(PFX,KEY,json.dumps(json.dumps(PROJ)),TKEY,json.dumps(json.dumps(TH)))
def ctx_for(b,w,mob,sw='block'):
 c=b.new_context(viewport={'width':w,'height':844 if mob else 900},is_mobile=mob,device_scale_factor=2 if mob else 1,service_workers=sw);c.add_init_script(INIT)
 c.route(re.compile(r'https://(www\.hobbylobby|www\.everythingcrossstitch)\.com/.*'),lambda r:r.fulfill(status=200,body='<title>stub</title>',content_type='text/html'));return c
def openshop(g,q=''):
 g.goto(B+q);g.wait_for_load_state('networkidle');g.click('#tabProjects');g.click('[data-open="t20a"]');g.wait_for_timeout(250);g.click('#tabShop');g.wait_for_timeout(250)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
 for w,mob in ((390,True),(1280,False)):
  t='[%d] '%w;c=ctx_for(b,w,mob);g=c.new_page();errs=[];g.on('pageerror',lambda e:errs.append(str(e)))
  openshop(g)
  pills=g.evaluate("[...document.querySelectorAll('#shopView .ff-skein-pill')].map(a=>({c:a.closest('.ff-skein-inline').dataset.dmc,h:a.href,t:a.target,r:a.rel,k:a.dataset.kind,tr:a.dataset.tracked}))")
  got={}
  for x in pills:got.setdefault(x['c'],[]).append(x['h'])
  ok(t+'pill URLs exactly as expected',got==EXP,got)
  ok(t+'target _blank, rel noopener noreferrer, no sponsored, kind direct',all(x['t']=='_blank' and x['r']=='noopener noreferrer' and x['k']=='direct' and x['tr']=='false' for x in pills),pills)
  ok(t+'no pills for 3865 check-first/unconfirmed, 415 owned, 48 specialty',not({'3865','415','48'}&set(got)))
  note=g.evaluate("[...document.querySelectorAll('#shopView .ff-skein-direct')].map(e=>e.textContent)")
  ok(t+'one direct-link note',note==["These are plain store links, and Floss Fox doesn't earn anything from them. Before you order, double-check the color, thread type, amount and availability on the store's site."],note)
  dm=g.evaluate("(()=>{const h=document.body.innerHTML.replace(/<script[\\s\\S]*?<\\/script>/g,'');return [h.match(/.{60}(\\(demo\\)|\\.example).{40}/g),!!document.querySelector('.wtb'),(FLOSS_FOX_SHOP.mockMerchants||[]).length]})()")
  ok(t+'no demo stores without flag',dm==[None,False,0],dm)
  ok(t+'no h-overflow',g.evaluate('document.documentElement.scrollWidth')<=w)
  # click each pill -> popup at the right URL
  allok=True
  for i,x in enumerate(pills):
   with c.expect_page() as pi:g.locator('#shopView .ff-skein-pill').nth(i).click()
   pg=pi.value;pg.wait_for_load_state();allok&=pg.url==x['h'];pg.close()
  ok(t+'each pill opens its URL in a new tab',allok)
  # keyboard
  g.evaluate("window.scrollTo(0,0);document.activeElement&&document.activeElement.blur()");g.focus('#tabConvert')
  order=[];ring=True
  for _ in range(80):
   g.keyboard.press('Tab');a=g.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return{id:e.id,pill:e.classList.contains('ff-skein-pill'),h:e.href||'',ring:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none'}})()")
   order.append(a)
   if a['pill'] or a['id']=='tabShop':ring&=a['ring']
   if a['pill'] and len([o for o in order if o['pill']])==6:break
  ids=[o['id'] for o in order];ph=[o['h'] for o in order if o['pill']]
  ok(t+'Tab reaches Shopping tab',ids.index('tabShop')>=0 if 'tabShop' in ids else False,ids[:10])
  ok(t+'Tab reaches each pill in order',ph==EXP['310']+EXP['321']+EXP['666'],ph)
  ok(t+'visible focus ring on Shopping tab and pills',ring,order)
  with c.expect_page() as pi:g.keyboard.press('Enter')
  ok(t+'Enter activates focused pill',pi.value.url==EXP['666'][1],pi.value.url);pi.value.close()
  # duplicate guard (app merges dup codes, so check the UI guard directly)
  d=g.evaluate("(()=>{const u=document.createElement('ul');document.body.appendChild(u);const a=document.createElement('li'),b2=document.createElement('li');u.append(a,b2);const n={brand:'dmc',code:'310',family:'six-strand-cotton',pack:'single-skein',qty:1};const r=FlossFoxSkeinPreviewUI.inline([{li:a,need:n},{li:b2,need:{...n,qty:2}}]);u.remove();return r})()")
  ok(t+'duplicate color gets no pills',d==0,d)
  if w==390:
   g.evaluate("window.scrollTo(0,document.querySelector('#pPlan').getBoundingClientRect().top+scrollY-document.querySelector('nav.tabs').offsetHeight-8)");g.wait_for_timeout(200)
   g.screenshot(path='/workspace/pkg-20a-shots/cleanup-390.png')
  ok(t+'no page errors',not errs,errs);c.close()
 # fixture flag
 c=ctx_for(b,1280,False);g=c.new_page();g.goto(B+'?fixtures=1');g.wait_for_load_state('networkidle')
 PREV=g.evaluate('window.FLOSS_FOX_ENV')=='preview'
 ok('fixtures=1 loads demo merchants',g.evaluate("(FLOSS_FOX_SHOP.mockMerchants||[]).length")>=2)
 g.fill('#inp','310 x2\n321');g.click('#go');g.wait_for_timeout(300)
 ok('fixtures=1 shows demo store cards (preview) / still none in production',(not PREV and g.locator('.wtbstore').count()==0 and '(demo)' not in g.inner_text('body')) or g.locator('.wtbstore').count()>0 and '(demo)' in g.inner_text('body'))
 g.goto(B);g.wait_for_load_state('networkidle');g.fill('#inp','310 x2\n321');g.click('#go');g.wait_for_timeout(300)
 ok('no flag: no demo merchants/cards',g.evaluate("(FLOSS_FOX_SHOP.mockMerchants||[]).length")==0 and g.locator('.wtbstore').count()==0 and '(demo)' not in g.inner_text('body'))
 c.close()
 # offline after SW install
 c=ctx_for(b,390,True,sw='allow');g=c.new_page();g.goto(B);g.wait_for_load_state('networkidle')
 g.evaluate("navigator.serviceWorker.ready.then(()=>new Promise(r=>setTimeout(r,1500)))");g.reload();g.wait_for_load_state('networkidle')
 ctl=g.evaluate("!!navigator.serviceWorker.controller");c.set_offline(True)
 try:
  g.reload();g.wait_for_timeout(800);g.click('#tabProjects');g.click('[data-open="t20a"]');g.wait_for_timeout(250);g.click('#tabShop');g.wait_for_timeout(300)
  o=g.evaluate("({vis:!document.getElementById('shopView').hidden,list:!!document.querySelector('#shopView #pPlan #pShopH'),pills:document.querySelectorAll('#shopView .ff-skein-inline').length,a:document.querySelectorAll('#shopView .ff-skein-pill').length,off:[...document.querySelectorAll('#shopView .ff-skein-off')].map(e=>e.textContent)})")
  ok('offline: SW controlled, Shopping tab + list + pills render',ctl and o['vis'] and o['list'] and o['a']==6,o);print('offline detail:',o)
 except Exception as e: ok('offline reload',False,e)
 c.close()
print(R[0],'passed,',R[1],'failed')
