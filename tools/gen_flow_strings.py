"""Builds flow-strings.js from Pixel's flow-p12.csv (source of truth). Re-run when Pixel updates the CSV:
   python3 tools/gen_flow_strings.py /workspace/pip-art/voice-overhaul/flow-p12.csv"""
import csv, json, sys, re
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/pip-art/voice-overhaul/flow-p12.csv'
# Held (not applied): photo "view while you type" wording (6c option A, not chosen).
HOLD = {'p12.left.modal_desc_keep'}  # Myke chose 6c option B (PDF only); modal_desc_pdf is live
# Myke's rule (d): one import label everywhere.
FIX = [('Import a full pattern (PDF)', 'Import a pattern (PDF)')]
rows = [r for r in csv.DictReader(open(SRC, encoding='utf-8')) if r['key'] not in HOLD]
out = []
for r in rows:
    t = r['text']
    for a, b in FIX: t = t.replace(a, b)
    if '${' in t:
        js = 'v=>{const {name,have,total,u,b,n,i,time}=v||{};return `' + t.replace('\\', '\\\\').replace("\\\\'", "\\'").replace('`', '\\`') + '`}'
        out.append(f'  {json.dumps(r["key"])}:{js}')
    else:
        out.append(f'  {json.dumps(r["key"])}:{json.dumps(t, ensure_ascii=False)}')
meta = {r['key']: {'max': int(r['max_length'] or 0), 'pose': r['pose']} for r in rows}
js = ('/* GENERATED from Pixel\'s flow-p12.csv by tools/gen_flow_strings.py. Do not hand-edit the P12 block; edit the CSV and re-run. */\n'
      '(function(){const plural=(n,w)=>`${n} ${w}${n===1?\'\':\'s\'}`,s2=n=>plural(n,\'color\');\n'
      'window.FF_P12={\n' + ',\n'.join(out) + '\n};\nwindow.FF_P12_META=' + json.dumps(meta) + ';\n})();\n')
open('flow-strings.js', 'w', encoding='utf-8').write(js + open('flow-strings-placeholders.js', encoding='utf-8').read())
print(len(rows), 'strings;', 'held:', sorted(HOLD))
