#!/usr/bin/env python3
"""Pip estimator browser check. Run on an isolated LOCAL or floss-fox-dev preview.
Requires the repo's existing Playwright/Chrome setup. Uses a fresh browser context
and synthetic data, not Amanda's pattern. No screenshots, retail clicks or publishing.
python tests/skeins_e2e.py http://localhost:8765/ [--chrome PATH]
Set FF_KEY=flossfox-dev.v1 for a preview that uses the dev storage key.
"""
import argparse, json, os, tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('base',nargs='?',default='http://localhost:8765/')
ap.add_argument('--chrome',default='/usr/bin/google-chrome')
A=ap.parse_args()
url=urlparse(A.base)
if url.hostname not in ('localhost','127.0.0.1','::1') and 'floss-fox-dev' not in url.path:
    raise SystemExit('Use a local or floss-fox-dev preview for this synthetic-data test.')
KEY=os.environ.get('FF_KEY','flossfox.v1'); PREFIX=KEY.removesuffix('.v1')
project={'id':'pip-test','name':'Pip estimator browser test','buyBrand':'dmc','notes':'','items':[
    {'code':code,'qty':1,'assumed':1,'stated':False,'stitchCount':n,'src':[]}
    for code,n in [('310',2400),('321',900),('3865',150)]],
    'decisions':{code:{'status':'buy','owned':None} for code in ['310','321','3865']},'purchased':{}}
threads={'schema':1,'threads':{'310':{'n':1,'partial':True,'confirmed':True},'321':{'n':3,'partial':False}}}
seed={KEY:json.dumps({'schema':2,'projects':[project]}),PREFIX+'.threads.v1':json.dumps(threads),PREFIX+'.tour.v1':json.dumps({'status':'dismissed'})}
checks=0
def check(name,condition):
    global checks
    assert condition,name
    checks+=1
    print('PASS '+name)

with sync_playwright() as playwright, tempfile.TemporaryDirectory() as temp:
    browser=playwright.chromium.launch(headless=True,executable_path=A.chrome)
    context=browser.new_context(viewport={'width':360,'height':800},accept_downloads=True)
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('dialog',lambda dialog:dialog.accept())
    page.add_init_script("if(!sessionStorage.getItem('pip-test-seeded')){sessionStorage.setItem('pip-test-seeded','1');const entries="+json.dumps(seed)+";for(const k in entries)localStorage.setItem(k,entries[k]);}")
    page.goto(A.base,wait_until='load')
    page.evaluate("FlossFoxProjects.open('pip-test')")
    page.locator('#pSkein').evaluate('(el)=>el.open=true')
    check('legacy estimator starts off',not page.locator('#seEnabled').is_checked())
    page.locator('#seFull').check();page.locator('#seEnabled').check();page.locator('#seSave').click()
    check('estimates save through actual controls',page.evaluate("FlossFoxProjects._store().projects[0].skeinEstimator.enabled") is True)
    check('whole-skein purchasing totals 4',page.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).lines.reduce((n,l)=>n+l.q,0)")==4)
    check('320px/360px layout has no document overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.set_viewport_size({'width':320,'height':800})
    check('320px controls reflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.set_viewport_size({'width':360,'height':800})
    page.reload(wait_until='load');page.evaluate("FlossFoxProjects.open('pip-test')")
    check('settings survive reload',page.locator('#seEnabled').is_checked() and page.locator('#seFull').is_checked())
    page.locator('#x-310').click();page.locator('#o-310').fill('1');page.locator('#o-310').press('Tab')
    check('confirmed stock deducted before rounding',page.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).lines.find(l=>l.to==='310').q")==1)
    page.locator('#st-310-have').check()
    check('manual Have enough survives higher estimated requirement',page.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).have.some(t=>t.it.code==='310')"))
    page.locator('#seCount').fill('18');page.locator('#seSave').click()
    check('changed estimate keeps manual choice and shows a recheck note',page.locator('#st-310-have').is_checked() and page.locator('#card-310 .skein-note').is_visible())
    page.locator('#pUseColl').click();page.locator('#pApplyColl').click()
    check('partial stock remains Check first',page.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).checkFirst.some(t=>t.it.code==='310')"))
    check('legacy collection count remains unverified',page.locator('#st-321-check').is_checked())
    page.locator('#pUndoColl').click()
    check('comparison undo restores manual choice',page.locator('#st-310-have').is_checked())
    check('copy text keeps estimate labels', 'PIP’S SKEIN ESTIMATES' in page.evaluate("FlossFoxProjects.planText(FlossFoxProjects._store().projects[0])"))
    check('CSV keeps quantity provenance', 'quantity_source' in page.evaluate("FlossFoxProjects.csv(FlossFoxProjects._store().projects[0])"))
    page.emulate_media(media='print')
    check('print exposes assumptions and hides controls',not page.locator('#pSkein').is_visible() and page.locator('.skein-print').is_visible())
    page.emulate_media(media='screen');page.locator('#pClose').click();page.locator('#backupBox').evaluate('(el)=>el.open=true')
    with page.expect_download() as d: page.locator('#backupBtn').click()
    backup_path=Path(temp)/'backup.json';d.value.save_as(backup_path)
    backup=json.loads(backup_path.read_text())
    check('full backup includes settings and checked stock provenance',backup['projects'][0]['skeinEstimator']['count']==18 and backup['threads']['threads']['310']['confirmed'] is True)
    page.evaluate("FlossFoxProjects.open('pip-test')");page.locator('#seCount').fill('16');page.locator('#seSave').click();page.locator('#pClose').click()
    page.locator('#restoreFile').set_input_files(str(backup_path));page.locator('#rGo').click()
    check('merge restore preserves estimator settings',page.evaluate("FlossFoxProjects._store().projects[0].skeinEstimator.count")==18)
    page.locator('#undoImportBtn').click();page.wait_for_load_state('load')
    check('import undo restores previous estimator settings',page.evaluate("FlossFoxProjects._store().projects[0].skeinEstimator.count")==16)
    page.evaluate("FlossFoxProjects.open('pip-test')");page.locator('#st-310-buy').check();page.locator('#x-310').click();page.locator('#sc-310').fill('');page.locator('#sc-310').press('Tab')
    check('cleared count becomes unknown rather than one assumed skein',page.evaluate("FlossFoxProjects.plan(FlossFoxProjects._store().projects[0]).checkFirst.some(t=>t.it.code==='310')"))
    check('no browser script errors',not errors)
    context.close();browser.close()
print(f'skeins_e2e: {checks} passed, 0 failed')
