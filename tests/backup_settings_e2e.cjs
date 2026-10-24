/* Real app, synthetic data, no live-site writes. Node + Playwright.
 * FF_TEST_NODE_MODULES may point at an installed Playwright package tree.
 * CHROME_BIN selects system Chrome; otherwise use Playwright Chromium. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.FF_TEST_NODE_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const root=path.resolve(__dirname,'..'),KEY='flossfox-dev.v1',TK='flossfox-dev.threads.v1',PK='flossfox-dev.backup-prefs.v1',SK='flossfox-dev.backup-state.v1';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf'};
let passed=0;function ok(name,condition){assert.ok(condition,name);passed++;console.log('PASS '+name);}
function serve(req,res){let target;try{const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);target=path.resolve(root,'.'+decoded);if(!target.startsWith(root+path.sep)&&target!==root)throw new Error('path');if(fs.statSync(target).isDirectory())target=path.join(target,'index.html');res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(target).pipe(res);}catch(e){res.writeHead(404);res.end();}}
const seed={schema:2,projects:[{id:'real-stage0',name:'Backup round trip',notes:'Synthetic fixture',buyBrand:'dmc',status:'planning',items:[{code:'310',qty:2,stated:true,assumed:0,src:['DMC 310 x2'],stitchCount:1160}],decisions:{'310':{status:'buy',owned:1,anchor:null,recv:null}},purchased:{},created:'2026-10-01T00:00:00Z',updated:'2026-10-01T00:00:00Z'},{id:'demo-stage0',name:'Demo',notes:'',buyBrand:'dmc',status:'planning',items:[],decisions:{},purchased:{},demo:true,created:'2026-10-01T00:00:00Z',updated:'2026-10-01T00:00:00Z'}]};
const threads={schema:2,threads:{'310':{n:2,partial:false,restock:false,confirmed:true,storage:{container:'Box 3',slot:'A2',medium:'bobbin'},updated:'2026-10-01T00:00:00Z'},'321':{n:0,partial:true,restock:true,confirmed:true,updated:'2026-10-01T00:00:00Z'}},demo:{'666':{n:3,partial:false,restock:false,updated:'2026-10-01T00:00:00Z'}}};
async function main(){
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),args:['--no-sandbox']});
 const contexts=[];
 async function open(width=390,picker='unsupported'){
  const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true,serviceWorkers:'block'});contexts.push(context);const requests=[],errors=[];
  await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(base+'/'))return route.continue();requests.push(u);return route.abort();});
  await context.addInitScript(({seed,threads,KEY,TK,picker})=>{
   if(!localStorage.getItem('ff.stage0.seeded')){localStorage.setItem(KEY,JSON.stringify(seed));localStorage.setItem(TK,JSON.stringify(threads));localStorage.setItem('ff.stage0.seeded','yes');}
   for(const pfx of ['flossfox-dev','flossfox']){localStorage.setItem(pfx+'.tour.v1','{"status":"dismissed"}');localStorage.setItem(pfx+'.hints.v1','off');}
   if(picker==='unsupported')Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true,writable:true});
  },{seed,threads,KEY,TK,picker});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base+'/?nosw');await page.waitForFunction(()=>window.FlossFoxBackupUI&&window.FlossFoxProjects);return{page,context,requests,errors};
 }
 const raw=page=>page.evaluate(({KEY,TK})=>({projects:localStorage.getItem(KEY),threads:localStorage.getItem(TK)}),{KEY,TK});
 const meta=page=>page.evaluate(SK=>JSON.parse(localStorage.getItem(SK)||'null'),SK);
 async function download(page,selector){const [d]=await Promise.all([page.waitForEvent('download'),page.click(selector)]);return JSON.parse(fs.readFileSync(await d.path(),'utf8'));}
 try{
  for(const width of [360,690,1280]){
   const {page,requests,errors}=await open(width);const before=await raw(page);await page.click('#tabSettings');
   ok('Settings and export/import controls visible at '+width,await page.isVisible('#settingsExport')&&await page.isVisible('#settingsImport'));
   ok('one active navigation destination at '+width,await page.locator('nav.tabs button[aria-pressed=true]').count()===1);
   ok('no horizontal overflow at '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   ok('reminders opt in and empty history truthful at '+width,!await page.isChecked('#bkEnabled')&&(await page.textContent('#bkLastSaved')).includes('No saved backup'));
   await page.check('#bkEnabled');await page.selectOption('#bkWeeks','1');ok('enabling reminders does not alter projects or stash at '+width,JSON.stringify(before)===JSON.stringify(await raw(page)));
   ok('no immediate interval reminder at '+width,!await page.isVisible('#bkReminder'));
   const data=await download(page,'#settingsExport');ok('v2 backup excludes demo and keeps partial/location at '+width,data.version===2&&data.projects.length===1&&data.projects[0].items[0].stitchCount===1160&&data.threads.threads['310'].storage.slot==='A2'&&data.threads.threads['321'].partial===true&&!data.threads.demo);
   ok('download awaits save confirmation at '+width,(await meta(page)).lastConfirmedAt===null&&await page.isVisible('#bkConfirmSave'));
   await page.evaluate(()=>FlossFoxThreadsUI.addItems([{code:'321',qty:20,stated:true,assumed:0}]));await page.waitForSelector('#bkReminder:not([hidden])');
   await page.click('#bkConfirmSave');ok('confirming an older downloaded copy keeps newer major edits due at '+width,!!(await meta(page)).majorToken&&await page.isVisible('#bkReminder'));
   await download(page,'#bkReminderExport');await page.click('#bkConfirmSave');ok('fresh confirmed copy clears major reminder at '+width,(await meta(page)).lastConfirmedAt!==null&&(await meta(page)).majorToken===null&&!await page.isVisible('#bkReminder'));
   ok('device save history absent from exported prefs at '+width,!Object.hasOwn(data.prefs,'backupState')&&Object.keys(data.prefs).every(k=>!k.includes('Confirmed')));
   ok('no page errors at '+width,errors.length===0);
  }
  const {page,errors}=await open();await page.click('#tabSettings');
  await page.evaluate(()=>{window.showSaveFilePicker=async()=>{throw new DOMException('Canceled','AbortError');};});
  await page.click('#settingsExport');await page.waitForFunction(()=>document.getElementById('bkFeedbackMsg').textContent.includes('not saved'));
  ok('canceled picker never confirms save',!(await meta(page))?.lastConfirmedAt&&!await page.isVisible('#bkConfirmSave'));
  await page.evaluate(()=>{window.__aborted=false;window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{throw new Error('disk full');},abort:async()=>{window.__aborted=true;}})});});
  await page.click('#settingsExport');await page.waitForSelector('#bkDownloadInstead:not([hidden])');ok('failed file write aborts without confirming',await page.evaluate(()=>window.__aborted)&&!(await meta(page))?.lastConfirmedAt);
  await page.evaluate(()=>{window.__savedText='';window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async t=>{window.__savedText=t;},close:()=>new Promise(resolve=>{window.__closeFile=resolve;})})});});
  await page.click('#settingsExport');await page.waitForFunction(()=>typeof window.__closeFile==='function');ok('history is unchanged until close completes',!(await meta(page))?.lastConfirmedAt);
  await page.evaluate(()=>window.__closeFile());await page.waitForFunction(()=>JSON.parse(localStorage.getItem('flossfox-dev.backup-state.v1')).lastConfirmedAt>0);ok('file close confirms save and JSON retains v2',await page.evaluate(()=>JSON.parse(window.__savedText).version===2));
  // Existing import/review/undo flow, reached from Settings.
  const before=await raw(page),saved=await page.evaluate(()=>JSON.parse(window.__savedText));saved.projects[0].name='Restored fixture';saved.threads.threads['310'].n=4;saved.prefs.backup=JSON.stringify({schema:1,enabled:true,weeks:3,majorEdits:true});
  await page.setInputFiles('#restoreFile',{name:'backup-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.waitForSelector('#rGo');ok('Settings import opens existing project review without changing data',JSON.stringify(before)===JSON.stringify(await raw(page))&&await page.isVisible('#projectsView'));
  await page.check('input[name=imode][value=replace]');await page.click('#rGo');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('flossfox-dev.threads.v1')).threads['310'].n===4);
  ok('replace restores location, partial and custom reminder interval',await page.evaluate(()=>{const t=JSON.parse(localStorage.getItem('flossfox-dev.threads.v1'));return t.threads['310'].storage.slot==='A2'&&t.threads['321'].partial===true&&JSON.parse(localStorage.getItem('flossfox-dev.backup-prefs.v1')).weeks===3;}));
  await page.click('#tabSettings');ok('valid imported custom week count displays',await page.inputValue('#bkWeeks')==='3');await page.click('#tabProjects');if(!await page.evaluate(()=>document.getElementById('backupBox').open))await page.click('#backupBox summary');await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('#undoImportBtn')]);await page.waitForFunction(()=>window.FlossFoxBackupUI);ok('undo restores original project and stash bytes',JSON.stringify(before)===JSON.stringify(await raw(page)));
  await page.click('#tabSettings');const current=await raw(page);await page.setInputFiles('#restoreFile',{name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,version:99}))});await page.waitForFunction(()=>document.getElementById('restorePanel').textContent.includes('newer version'));ok('future backup rejected with project/stash untouched',JSON.stringify(current)===JSON.stringify(await raw(page)));
  ok('import and undo caused no page errors',errors.length===0);
  // Future reminder settings must not be silently downgraded.
  const future=await open();await future.page.evaluate(PK=>localStorage.setItem(PK,'{"schema":99,"enabled":true}'),PK);await future.page.reload();await future.page.waitForFunction(()=>window.FlossFoxBackupUI);await future.page.click('#tabSettings');ok('future reminder preferences left intact with changes paused',await future.page.isDisabled('#bkEnabled')&&await future.page.evaluate(PK=>JSON.parse(localStorage.getItem(PK)).schema===99,PK));
  // Due interval, snooze persistence, revisit after interval.
  const due=await open();await due.page.evaluate(({PK,SK})=>{localStorage.setItem(PK,JSON.stringify({schema:1,enabled:true,weeks:1,majorEdits:true}));localStorage.setItem(SK,JSON.stringify({schema:1,enabledSince:Date.now()-8*86400000,lastConfirmedAt:null,snoozedUntil:null,majorToken:null}));FlossFoxBackupUI.refresh();},{PK,SK});
  await due.page.waitForSelector('#bkReminder:not([hidden])');await due.page.click('#bkReminderLater');ok('due reminder snoozes for tomorrow',!await due.page.isVisible('#bkReminder')&&(await meta(due.page)).snoozedUntil>Date.now());await due.page.reload();await due.page.waitForFunction(()=>window.FlossFoxBackupUI);ok('snooze survives reopening',!await due.page.isVisible('#bkReminder'));
  // Simulate production hosts entirely from this checkout. No request is sent
  // to the live website, the analytics provider or any other third party.
  for(const host of ['flossfox.com','www.flossfox.com']){
   const c=await browser.newContext({serviceWorkers:'block'});contexts.push(c);const outbound=[];
   await c.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!==host){outbound.push(u.href);return route.abort();}const f=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:''});return route.fulfill({status:200,body:fs.readFileSync(f),headers:{'content-type':mime[path.extname(f)]||'application/octet-stream'}});});
   const g=await c.newPage();for(const name of ['','fabric.html','about.html','privacy.html']){await g.goto('https://'+host+'/'+name);ok('analytics.js still included on simulated '+host+'/'+name,await g.locator('script[src="analytics.js"]').count()===1);}
   /* GoatCounter visit counter is kept (Myke); covered by tests/analytics_e2e.py. */
  }
  console.log(`backup_settings_e2e: ${passed} checks passed`);
 }finally{for(const c of contexts)await c.close();await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
