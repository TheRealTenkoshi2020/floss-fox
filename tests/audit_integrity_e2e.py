#!/usr/bin/env python3
"""Actual-app adversarial transactions, archive compatibility and cache upgrades."""
import os,sys,json,base64,copy
from playwright.sync_api import sync_playwright
B=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765/').rstrip('/')+'/'
K='flossfox-dev.v1';T='flossfox-dev.threads.v1';S='flossfox-dev.stitch-sessions.v1';N=0;errs=[]
P={'id':'pa','name':'Journal integrity fixture','items':[{'code':'310','qty':2,'stated':True,'assumed':0,'src':['DMC 310 x2'],'stitchCount':None}],'notes':'','buyBrand':'dmc','status':'progress','decisions':{'310':{'status':'buy'}},'purchased':{},'created':'2026-11-01T00:00:00Z','updated':'2026-11-01T00:00:00Z'}
LOG={'schema':1,'sessions':[{'id':'original','projectId':'pa','date':'2026-11-17','stitches':100,'minutes':20,'notes':'Keep me','usage':[{'code':'310','skeins':0.25}]}]}

def ok(n,c,d=''):
 global N
 assert c,n+': '+str(d)
 N+=1;print('PASS '+n,flush=True)
def raw(g,k):return g.evaluate('(k)=>localStorage.getItem(k)',k)
def start(br,seed=True,sw=False):
 c=br.new_context(viewport={'width':390,'height':844},service_workers='allow' if sw else 'block',accept_downloads=True)
 c.add_init_script("sessionStorage.setItem('ff.landing.seen','1');localStorage.setItem('flossfox-dev.tour.v1','{\"status\":\"dismissed\"}');localStorage.setItem('flossfox-dev.hints.v1','off')")
 if seed:c.add_init_script('(()=>{if(!sessionStorage.getItem("integrity.seeded")){for(const [k,v] of '+json.dumps([[K,json.dumps({'schema':2,'projects':[P]})],[T,json.dumps({'schema':2,'threads':{'310':{'n':1,'partial':False,'confirmed':True,'restock':False}}})],[S,json.dumps(LOG)]])+')localStorage.setItem(k,v);sessionStorage.setItem("integrity.seeded","1")}})()')
 g=c.new_page();g.set_default_timeout(12000);g.on('pageerror',lambda e:errs.append(str(e)));g.on('dialog',lambda d:d.accept());g.goto(B+'?nosw');g.wait_for_function('window.FlossFoxAuditUI');return c,g
def prepare(g,d,mode='merge'):
 g.evaluate("FlossFoxProjects.showView('projects');document.getElementById('backupBox').open=true")
 g.set_input_files('#restoreFile',{'name':'integrity.json','mimeType':'application/json','buffer':json.dumps(d).encode()});g.wait_for_selector('#rGo');g.check('input[name=imode][value='+mode+']')
def apply(g):g.click('#rGo');g.wait_for_selector('#restoreDone')

with sync_playwright() as p:
 br=p.chromium.launch(executable_path=os.getenv('FF_CHROME','/usr/bin/chromium'),args=['--no-sandbox'])
 c,g=start(br);before=[raw(g,k) for k in (K,T,S)];data=g.evaluate('FlossFoxProjects.fullBackup()');incoming=copy.deepcopy(data);incoming['projects'][0]['name']='Incoming replacement';incoming['stitchSessions']['sessions'][0]['notes']='Incoming log'
 prepare(g,incoming);g.evaluate("()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='flossfox-dev.stitch-sessions.v1')throw new DOMException('full','QuotaExceededError');return set.call(this,k,v)}}")
 g.click('#rGo');g.wait_for_timeout(400)
 ok('Session write failure rolls back projects, stash and sessions together',[raw(g,k) for k in (K,T,S)]==before)
 ok('Failed restore reports rollback instead of success','put back' in g.inner_text('#projStatus'))
 c.close();c,g=start(br);before=[raw(g,k) for k in (K,T,S)];prepare(g,incoming);apply(g)
 ok('Successful replacement changes the actual session record',json.loads(raw(g,S))['sessions'][0]['notes']=='Incoming log')
 savedBeforeUndo=[raw(g,k) for k in (K,T,S)]
 g.evaluate("()=>{window.integritySet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='flossfox-dev.stitch-sessions.v1')throw new DOMException('full','QuotaExceededError');return window.integritySet.call(this,k,v)}}")
 g.click('#undoImportBtn');g.wait_for_timeout(100)
 ok('A failed Undo preserves the current project, stash and journal',[raw(g,k) for k in (K,T,S)]==savedBeforeUndo)
 ok('A failed Undo does not report success','could not' in g.inner_text('#projStatus'))
 g.evaluate('()=>{Storage.prototype.setItem=window.integritySet}');g.reload();g.wait_for_function('window.FlossFoxAuditSessions');g.evaluate("FlossFoxProjects.showView('projects');document.getElementById('backupBox').open=true")
 with g.expect_navigation():g.click('#undoImportBtn')
 g.wait_for_function('window.FlossFoxAuditSessions');ok('Undo last import restores exact projects, stash and sessions',[raw(g,k) for k in (K,T,S)]==before)
 # A legacy project-only replacement retains unmatched journal history in backups as archived.
 legacy={'app':'floss-fox','schema':2,'projects':[{**P,'id':'different','name':'Different legacy project'}]};prepare(g,legacy,'replace');apply(g)
 ok('Legacy projects-only replacement preserves the existing journal',raw(g,S)==before[2])
 archived=g.evaluate('FlossFoxProjects.fullBackup()');ok('Full backup marks unmatched historical logs archived',archived['stitchSessions']['sessions'][0].get('archived') is True)
 ca,a=start(br,seed=False);prepare(a,archived,'replace');apply(a)
 ok('Archived logs roundtrip without being attached to another project',a.evaluate("FlossFoxAuditSessions.exportForBackup().sessions.length===1&&FlossFoxAuditSessions.list('pa').sessions.length===0"))
 ca.close();c.close();c,g=start(br)
 g.evaluate("FlossFoxProjects.showView('projects')");g.click('[data-del=pa]');g.wait_for_selector('#ffConfirmGo')
 ok('Project deletion explicitly includes its stitching sessions','stitching session' in g.inner_text('#ffConfirm'))
 g.click('#ffConfirmGo');g.wait_for_timeout(150)
 ok('Confirmed deletion removes only that project and its sessions',not json.loads(raw(g,K))['projects'] and not json.loads(raw(g,S))['sessions'])
 ok('Project deletion does not consume inventory',json.loads(raw(g,T))['threads']['310']['n']==1)
 # Unknown code and deliberately malformed duplicate payloads are rejected before import.
 prior=[raw(g,k) for k in (K,T,S)]
 for name,payload in [('unknown',{'v':1,'t':'shopping','items':[['9999',1]],'review':[]}),('duplicates',{'v':1,'t':'shopping','items':[['310',1],['310',2]],'review':[]})]:
  h=base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=');g.goto(B+'?nosw#share='+h);g.wait_for_selector('#ffauShared')
  ok(name+' share is read-only and has no import action',g.locator('#ffauShared button',has_text='Import as a new project').count()==0 and [raw(g,k) for k in (K,T,S)]==prior)
 h=base64.urlsafe_b64encode(json.dumps({'v':1,'t':'shopping','items':[['310',1]],'review':[]}).encode()).decode().rstrip('=');g.goto(B+'?nosw#share='+h);g.wait_for_selector('#ffauShared')
 g.keyboard.press('Shift+Tab');ok('Shared dialog traps reverse keyboard focus',g.evaluate("document.activeElement.textContent==='Import as a new project'"));g.keyboard.press('Tab');ok('Shared dialog traps forward keyboard focus',g.evaluate("document.activeElement.textContent==='Close shared list'"));g.keyboard.press('Escape');ok('Escape closes sharing without changing any user data',g.locator('#ffauShared').count()==0 and [raw(g,k) for k in (K,T,S)]==prior)
 c.close()
 # Old dev caches are removed, while another site's cache stays intact.
 c,g=start(br,sw=True);g.evaluate("Promise.all([caches.open('flossfox-dev-v2.0a-ci005-old'),caches.open('flossfox-production-sentinel')])")
 g.goto(B);g.wait_for_function('navigator.serviceWorker.controller',timeout=30000)
 ks=g.evaluate('caches.keys()');ok('Cache upgrade removes old development assets',not any('ci005-old' in k for k in ks),ks);ok('Cache upgrade preserves production caches','flossfox-production-sentinel' in ks,ks)
 c.set_offline(True);g.reload();g.wait_for_function('window.FlossFoxAuditUI');ok('Upgraded cache reloads full application offline',g.evaluate('!!FlossFoxAuditSessions'))
 c.close();br.close();ok('No runtime errors in integrity scenarios',not errs,errs)
 print(f'\n{N} real-app integrity checks passed',flush=True)
