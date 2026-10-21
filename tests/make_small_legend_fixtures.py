"""Builds the SYNTHETIC small-legend PDFs (8/10/12 colors, sorted/unsorted, single/two-column). Run from a scratch dir:
   python3 make_small_legend_fixtures.py (bare rows) and python3 make_small_legend_fixtures.py n (named rows); writes ./pdfs.
   tests/fixtures/patterns/small holds a representative 16-file subset plus expected.json."""
import os,random,json
from playwright.sync_api import sync_playwright
NAMES={'310':'Black','321':'Red','415':'Pearl Gray','666':'Bright Red','699':'Green','725':'Topaz','3865':'Winter White','797':'Royal Blue','938':'Ultra Dark Coffee Brown','3341':'Apricot','B5200':'Snow White','543':'Ultra Very Light Beige Brown','150':'Ultra Very Dark Dusty Rose','151':'Very Light Dusty Rose','152':'Medium Light Shell Pink','153':'Very Light Violet','154':'Very Dark Grape','3685':'Very Dark Mauve','3687':'Mauve','3688':'Medium Mauve','3345':'Dark Hunter Green','3346':'Hunter Green','3347':'Medium Yellow Green','3348':'Light Yellow Green','469':'Avocado Green','470':'Light Avocado Green','471':'Very Light Avocado Green','472':'Ultra Light Avocado Green','BLANC':'White','311':'Medium Navy Blue','312':'Very Dark Baby Blue','322':'Dark Baby Blue','334':'Medium Baby Blue','336':'Navy Blue','3325':'Light Baby Blue','3750':'Very Dark Antique Blue','3752':'Very Light Antique Blue','3753':'Ultra Very Light Antique Blue','413':'Dark Pewter Gray'}
import sys;WN=len(sys.argv)>1
PAL={
'mixed8':['310','321','415','666','699','725','3865','797'],
'mixed10':['310','321','415','666','699','725','3865','797','938','3341'],
'mixed12':['310','321','415','666','699','725','3865','797','938','3341','B5200','543'],
'shade8':['150','151','152','153','154','3685','3687','3688'],
'shade10':['3345','3346','3347','3348','469','470','471','472','310','BLANC'],
'shade12':['311','312','322','334','336','3325','3750','3752','3753','310','413','B5200'],
}
def key(c):
    import re;m=re.match(r'\d+',c);return (0,int(m.group())) if m else (1,c)
SYM='X O # + * @ % & = ~ ^ ?'.split()
os.makedirs('pdfs',exist_ok=True);random.seed(7);made=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);g=b.new_page()
 for pn,codes in PAL.items():
  for order in ('sorted','unsorted'):
   cs=sorted(codes,key=key) if order=='sorted' else random.sample(codes,len(codes))
   rows=[(SYM[i],c,random.randint(120,3200)) for i,c in enumerate(cs)]
   for lay in ('single','columns'):
    head='<h3>Little Fox Sampler (SYNTHETIC TEST)</h3><p>Design size 98 x 120 stitches. 14 count Aida. 2 strands cross stitch.</p>'
    if lay=='single':
     body='<table style="font:13px Arial"><tr><th>Symbol</th><th>DMC</th>'+('<th>Name</th>' if WN else '')+'<th>Stitches</th><th>Skeins</th></tr>'+''.join(f'<tr><td>{s}</td><td>{c}</td>'+(f'<td>{NAMES[c]}</td>' if WN else '')+f'<td>{n}</td><td>{1 if n<1800 else 2}</td></tr>' for s,c,n in rows)+'</table>'
    else:
     h=(len(rows)+1)//2;cols=[rows[:h],rows[h:]]
     body='<div style="display:flex;gap:60px;font:13px Arial">'+''.join('<table><tr><th>Sym</th><th>DMC</th>'+('<th>Name</th>' if WN else '')+'<th>Stitches</th></tr>'+''.join(f'<tr><td>{s}</td><td>{c}</td>'+(f'<td>{NAMES[c]}</td>' if WN else '')+f'<td>{n}</td></tr>' for s,c,n in col)+'</table>' for col in cols)+'</div>'
    fn=('named-' if WN else 'bare-')+f'{pn}-{order}-{lay}.pdf';g.set_content(f'<html><body>{head}{body}</body></html>');g.pdf(path='pdfs/'+fn,format='Letter');made.append((fn,cs))
 json.dump(made,open(('named' if WN else 'bare')+'-expected.json','w'))
print(len(made))
