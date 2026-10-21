"""Dump pdf.js pages (text + positioned items) for tests/fixtures/chart-check/*.pdf into pages.json via the app's own inspector. Needs: python3 -m http.server 18977 at the repo root."""
import json,glob,os,sys
from playwright.sync_api import sync_playwright
D='tests/fixtures/chart-check';out={}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);g=b.new_page();g.goto('http://127.0.0.1:18977/?nosw');g.wait_for_timeout(800)
 for f in sorted(glob.glob(D+'/*.pdf')):
  n=os.path.basename(f)[:-4];g.set_input_files('#dumpIn',f) if False else None
  data=open(f,'rb').read().hex()
  r=g.evaluate("""async h=>{const u=new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));const f=new File([u],'a.pdf',{type:'application/pdf'});
   const lib=await import('/pip-hybrid/vendor/pdfjs/pdf.mjs');lib.GlobalWorkerOptions.workerSrc='/pip-hybrid/vendor/pdfjs/pdf.worker.mjs';
   const o=await FlossFoxPatternPDF.inspect(f,lib);return o.pages}""",data)
  out[n]=r
 json.dump(out,open(D+'/pages.json','w'))
print({k:[len(p['items']) for p in v] for k,v in out.items()})
