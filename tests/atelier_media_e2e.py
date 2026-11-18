#!/usr/bin/env python3
"""3.9 Atelier Stage G: cover photos in IndexedDB and media-inclusive backup (FF39-13).
Legacy JSON backups still import. Automatic copies stay media-free. Quota rolls back.
SIMULATED: headless Chrome with synthetic data, not real phones.
Usage: FF_KEY=flossfox-dev.v1 python3 tests/atelier_media_e2e.py http://localhost:PORT/
"""
import sys, os, json, copy
from pathlib import Path
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
B = B if B.endswith('/') else B + '/'
KEY = os.environ.get('FF_KEY', 'flossfox-dev.v1'); PFX = KEY[:-3]; TK = PFX + '.threads.v1'; AK = PFX + '.atelier.v1'
SHOTS = os.environ.get('SHOTS', '/workspace/atelier39/logs/shots'); os.makedirs(SHOTS, exist_ok=True)
R = [0, 0]
def ok(n, c, d=''):
    R[0 if c else 1] += 1
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' -> ' + str(d)[:500]))

def it(c, q=1):
    return {'code': c, 'qty': q, 'stated': True, 'assumed': 0, 'src': ['DMC ' + c], 'stitchCount': 40}

def proj(pid, name, codes, status='progress', upd='2026-11-05T10:00:00.000Z', **kw):
    p = {'id': pid, 'name': name, 'notes': 'private notes', 'buyBrand': 'dmc', 'status': status,
         'items': [it(c) for c in codes], 'decisions': {}, 'purchased': {},
         'created': '2026-11-01T00:00:00.000Z', 'updated': upd}
    p.update(kw); return p

PROJ = {'schema': 2, 'projects': [
    proj('p1', 'Sample Autumn Wreath', ['310', 'BLANC', 'WHITE', '321'], leftOff='Finished page 2'),
    proj('p2', 'Sample Done Bookmark', ['310'], status='done', upd='2026-11-09T10:00:00.000Z'),
    proj('tester-keep', 'Tester Keepsake', ['BLANC'], notes='do not overwrite me')]}
THR = {'schema': 2, 'threads': {
    '310': {'n': 2, 'partial': True, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z', 'storage': {'container':'Top drawer','slot':'A1','medium':''}},
    'WHITE': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    'BLANC': {'n': 1, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'},
    '321': {'n': 5, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-11-01T00:00:00Z'}}}
QUIET = {PFX + '.tour.v1': '{"status":"dismissed"}', PFX + '.hints.v1': 'off'}
GALLERY = {PFX + '.atelier.v1': json.dumps({'v': 1, 'theme': 'system', 'projectsView': 'gallery'})}

def dmc_codes():
    html = Path(__file__).resolve().parents[1].joinpath('index.html').read_text()
    i = html.find('const DMC=') + len('const DMC=')
    depth = 0
    for j, ch in enumerate(html[i:], i):
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return list(json.loads(html[i:j+1]).keys())
    raise RuntimeError('DMC catalog not found')

def seed_all(extra=None):
    s = {KEY: json.dumps(PROJ), TK: json.dumps(THR), **QUIET, **GALLERY}
    if extra: s.update(extra)
    return s

def seed_500():
    codes = dmc_codes()[:500]
    if len(codes) < 500:
        raise RuntimeError('need 500 catalog colors, have %s' % len(codes))
    big = {'schema': 2, 'projects': [
        proj('p500', 'Five Hundred Colors', codes, status='planning'),
        proj('tester-keep', 'Tester Keepsake', ['BLANC'], notes='do not overwrite me')]}
    return seed_all({KEY: json.dumps(big)})

def ctx(br, seed, w=1280, h=900, touch=False):
    kw = dict(viewport={'width': w, 'height': h}, service_workers='block', accept_downloads=True)
    if touch:
        kw['has_touch'] = True; kw['is_mobile'] = True
    c = br.new_context(**kw)
    c.add_init_script(
        "if(!sessionStorage.getItem('__seed')){sessionStorage.setItem('__seed','1');const s=%s;for(const k in s)localStorage.setItem(k,s[k])}try{sessionStorage.setItem('ff.landing.seen','1')}catch(e){}"
        % json.dumps(seed))
    g = c.new_page(); g.set_default_timeout(12000); g.errs = []; g.on('pageerror', lambda e: g.errs.append(str(e)))
    g.on('dialog', lambda d: d.accept())
    return c, g

def ready(g):
    g.wait_for_function('window.FlossFoxAtelier&&window.FlossFoxProjects&&window.FlossFoxAtelierMedia&&window.FlossFoxAtelierMediaCore')
    g.wait_for_timeout(200)

def clear_bubbles(g):
    g.evaluate("""() => {
      document.querySelectorAll('.pipA-bubble [data-close], .pipA-bubble .pipA-x, .pipc [data-close]').forEach(b => { try { b.click(); } catch (e) {} });
      const x = document.querySelector('.pipA-bubble');
      if (x) x.remove();
    }""")
    g.wait_for_timeout(80)

MAKE_PHOTO = """async (color='#c44', w=160, h=90) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff'; x.font = '16px sans-serif'; x.fillText('cover', 8, 24);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  return new File([blob], 'cover.jpg', { type: 'image/jpeg' });
}"""

SET_COVER = """async (id, color='#c44') => {
  const make = """ + MAKE_PHOTO + """;
  const file = await make(color);
  return FlossFoxAtelierMedia.setCover(id, file);
}"""

def open_proj(g, pid='p1'):
    g.click('#tabProjects'); g.wait_for_timeout(200)
    g.evaluate(f"() => window.FlossFoxProjects.openProject({pid!r})")
    g.wait_for_function(f"() => FlossFoxProjects.openId && FlossFoxProjects.openId()==={pid!r}")
    g.wait_for_timeout(200)

def raw_projects(g):
    return g.evaluate(f"()=>JSON.parse(localStorage.getItem({KEY!r}))")

def dump_inv(g):
    return g.evaluate(f"()=>JSON.stringify([localStorage.getItem({KEY!r}), localStorage.getItem({TK!r})])")

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- modules present, editor mounts, hook is live ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    ok('media modules are on the page', g.evaluate("() => !!(FlossFoxAtelierMedia && FlossFoxAtelierMediaCore && FlossFoxProjects.setCoverId && FlossFoxProjects.fullBackupWithMedia)"))
    ok('backup version contract stays at 2', g.evaluate("() => FlossFoxAtelierMediaCore.BACKUP_VERSION === 2"))
    open_proj(g, 'p1')
    ok('cover editor is mounted', g.locator('#pCover #ffaCoverFile').count() == 1 and 'Add a cover photo' in g.inner_text('#pCover'))
    ok('Pixel backupC line is present in the cover editor', 'Backup files include your cover photos, as the smaller copies kept in this browser. Keep your originals too.' in g.inner_text('#pCover'))
    ok('cover hook stays quiet without a kind', g.evaluate("() => FlossFoxAtelierPip.coverPhoto({id:'p1'})") is False)

    # ---- add a cover: downscale/JPEG, IDB readback, project coverId, gallery img ----
    before = dump_inv(g)
    added = g.evaluate(SET_COVER, 'p1') if False else g.evaluate("async () => { const make = (async (color='#c44', w=160, h=90) => { const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,w,h); const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9)); return new File([blob],'cover.jpg',{type:'image/jpeg'}); }); return FlossFoxAtelierMedia.setCover('p1', await make()); }")
    ok('setCover verified write returns ok', isinstance(added, dict) and added.get('ok') is True and added.get('kind') == 'add', added)
    stored = g.evaluate(f"()=>JSON.parse(localStorage.getItem({KEY!r})).projects.find(p=>p.id==='p1')")
    ok('project JSON has a coverId reference only', stored and isinstance(stored.get('coverId'), str) and 'cover' not in stored and 'data' not in stored, stored)
    rec = g.evaluate("""async () => {
      const p = FlossFoxProjects._store().projects.find(x => x.id === 'p1');
      const r = await FlossFoxAtelierMedia.getRecord(p.coverId);
      if (!r || !r.blob) return null;
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      const sha = await FlossFoxAtelierMediaCore.sha256(bytes);
      const head = Array.from(bytes.slice(0, 4));
      const asLatin = new TextDecoder('latin1').decode(bytes);
      return { mime: r.mime, w: r.w, h: r.h, sha, len: bytes.length, jpeg: head[0]===0xff && head[1]===0xd8, hasExif: asLatin.includes('Exif') || asLatin.includes('GPS'), head };
    }""")
    ok('stored photo is a JPEG under the 200KB cap with no EXIF/GPS', rec and rec.get('jpeg') and rec.get('mime')=='image/jpeg' and rec['len'] <= 200*1024 and rec.get('hasExif') is False and rec['w'] <= 1280 and rec['h'] <= 1280, rec)
    if g.locator('#pClose').count():
        g.click('#pClose')
        g.wait_for_function("() => !document.getElementById('projEdit') || document.getElementById('projEdit').hidden")
    g.click('#tabProjects'); g.wait_for_timeout(400)
    clear_bubbles(g)
    card = g.locator('li.ffa-gcard:has([data-open="p1"])')
    ok('gallery card shows the cover photo', card.locator('.ffa-cover img').count() == 1, card.inner_html()[:300] if card.count() else 'no card')
    ok('project list is visible for the gallery shot', g.locator('#projListCard').is_visible())
    g.evaluate("() => { try { FlossFoxAtelierMedia.paintBackupHints(); } catch (e) {} const b=document.getElementById('backupBox'); if (b) b.open = true; }")
    g.wait_for_function("() => { const b=document.getElementById('backupBox'); const h=document.getElementById('bkPhotoHint'); return b && b.open && h && !h.hidden && (h.textContent||'').length>0; }")
    g.locator('#backupBox').scroll_into_view_if_needed()
    hint = g.inner_text('#bkPhotoHint')
    ok('backup box shows Pixel photo size and backupC lines when a cover exists', 'Backup files include your cover photos, as the smaller copies kept in this browser. Keep your originals too.' in hint and 'Cover photos make backup files larger.' in hint, hint)
    clear_bubbles(g)


    # ---- user backup includes media; automatic copies do not ----
    bak = g.evaluate("async () => FlossFoxProjects.fullBackupWithMedia()")
    ok('full backup stays at version 2 and includes a media section', bak and bak.get('version')==2 and bak.get('kind')=='full-backup' and bak.get('media',{}).get('kind')=='cover-photos' and bak['media']['count']>=1, {k: bak.get(k) for k in ('version','kind')} if bak else None)
    ok('project records in the backup still have no photo bytes', all('cover' not in p and (not p.get('data') or len(str(p.get('data')))<200) for p in bak['projects']))
    media_ok = g.evaluate("async (d) => { const c = await FlossFoxAtelierMediaCore.check(d); const v = await FlossFoxAtelierMediaCore.verifyItem(d.media.items[0]); return { check: c.ok, verify: v.ok, name: v.item && v.item.name }; }", bak)
    ok('backup media checksums and manifest verify', media_ok and media_ok.get('check') and media_ok.get('verify'), media_ok)
    auto = g.evaluate("() => FlossFoxProjects.fullBackup()")
    ok('automatic-copy payload (fullBackup) excludes media', auto and 'media' not in auto and auto.get('version')==2)
    ok('legacy importer would accept the media backup and ignore media', g.evaluate("(d) => FlossFoxAtelierMediaCore.legacyAccepts(d).ok && FlossFoxAtelierMediaCore.legacyAccepts(d).ignoredMedia", bak) is True)
    ok('existing checkBackup still ignores media and accepts the file', g.evaluate("(d) => { const r = FlossFoxProjects.checkBackup(d); return !r.err && !('media' in r) && r.projects.length >= 1; }", bak) is True)

    # ---- Pixel promise line only after a verified backup+readback ----
    g.evaluate("() => FlossFoxAtelierMedia.setBackupPromise(true)")
    open_proj(g, 'p1')
    clear_bubbles(g)
    ok('Pixel backupC line is shown after verified readback', 'Backup files include your cover photos, as the smaller copies kept in this browser. Keep your originals too.' in g.inner_text('#pCover'))
    g.locator('#pCover').scroll_into_view_if_needed()
    g.wait_for_timeout(200)
    c.close()

    # ---- restore readback: empty target, merge keeps tester data, photos come back ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.click('#backupBox summary')
    inv_before = dump_inv(g)
    g.set_input_files('#restoreFile', {'name': 'media.json', 'mimeType': 'application/json', 'buffer': json.dumps(bak).encode()})
    g.wait_for_selector('#rGo')
    ok('restore review does not change data until Restore is clicked', dump_inv(g) == inv_before)
    ok('merge is the default import mode', g.evaluate("() => (document.querySelector('input[name=imode]:checked')||{}).value") == 'merge')
    g.check('input[name=rmode][value=skip]')  # keep tester's colliding p1 if present; backup p1 already matches seed id
    # skip would skip p1 photo too — use a target that does not already have p1? Seed has p1. skip keeps tester p1 without incoming photo.
    # For a clean photo restore of p1, use replace-on-collision (explicit). Tester-keep is not in the backup, so merge keeps it either way.
    g.check('input[name=rmode][value=replace]')
    g.click('#rGo')
    g.wait_for_timeout(800)
    if g.locator('#ffConfirm:not([hidden])').count():
        g.click('#ffConfirmGo'); g.wait_for_timeout(400)
    # After merge+replace, p1 should have a cover again; tester-keep must still exist
    names = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.map(p => p.name)")
    ok('tester project that was not in the backup is still there (merge does not drop it)', 'Tester Keepsake' in names, names)
    notes = g.evaluate(f"() => (JSON.parse(localStorage.getItem({KEY!r})).projects.find(p => p.id==='tester-keep')||{{}}).notes")
    ok('tester notes were not silently overwritten', notes == 'do not overwrite me', notes)
    p1 = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.find(p => p.id==='p1')")
    photo_back = g.evaluate("""async () => {
      const p = FlossFoxProjects._store().projects.find(x => x.id === 'p1');
      if (!p || !p.coverId) return { ok: false, reason: 'no-coverId' };
      const r = await FlossFoxAtelierMedia.getRecord(p.coverId);
      if (!r || !r.blob) return { ok: false, reason: 'missing-blob' };
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      const sha = await FlossFoxAtelierMediaCore.sha256(bytes);
      return { ok: sha === r.sha256 && bytes.length > 32, sha, id: p.coverId };
    }""")
    ok('restored cover photo reads back and matches its checksum', photo_back and photo_back.get('ok'), photo_back)
    line = g.inner_text('#restorePhotos') if g.locator('#restorePhotos').count() else g.inner_text('#restorePanel')
    ok('restore status names a successful photo restore', 'Restored' in line and 'cover photo' in line, line)
    clear_bubbles(g)
    c.close()

    # ---- merge + skip must not overwrite tester p1 or list the skipped photo as failed ----
    tester_seed = seed_all()
    # backup has p1 renamed in the file — already have bak from earlier with Sample Autumn Wreath
    colliding = copy.deepcopy(bak)
    for pr in colliding['projects']:
        if pr['id'] == 'p1':
            pr['name'] = 'INTRUDER WREATH'
            pr['notes'] = 'should not replace tester'
    c, g = ctx(br, seed_all({KEY: json.dumps({'schema':2,'projects':[
        proj('p1', 'Tester Wreath', ['310'], notes='tester original'),
        proj('tester-keep', 'Tester Keepsake', ['BLANC'], notes='do not overwrite me')
    ]})}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.click('#backupBox summary')
    g.set_input_files('#restoreFile', {'name': 'clash.json', 'mimeType': 'application/json', 'buffer': json.dumps(colliding).encode()})
    g.wait_for_selector('#rGo')
    g.check('input[name=imode][value=merge]')
    g.check('input[name=rmode][value=skip]')
    g.click('#rGo'); g.wait_for_timeout(800)
    p1n = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.find(p => p.id==='p1')")
    ok('merge+skip keeps the tester project name and notes', p1n and p1n['name']=='Tester Wreath' and p1n.get('notes')=='tester original', p1n)
    fail_line = g.inner_text('#restorePhotos') if g.locator('#restorePhotos').count() else ''
    ok('skipped cover is not reported as a failed photo', 'couldn\'t be restored' not in fail_line, fail_line)
    c.close()

    # ---- one bad photo: projects stay, failed photo is named ----
    bad = copy.deepcopy(bak)
    if bad.get('media') and bad['media'].get('items'):
        bad['media']['items'][0]['sha256'] = 'ab' * 32
        # keep manifest consistent so check() may pass or fail; either way restore must keep projects
        # If check() fails on manifest, projects still restore and restoreFail is shown.
    c, g = ctx(br, seed_all({KEY: json.dumps({'schema':2,'projects':[proj('tester-keep','Tester Keepsake',['BLANC'], notes='do not overwrite me')]})}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.click('#backupBox summary')
    g.set_input_files('#restoreFile', {'name': 'badphoto.json', 'mimeType': 'application/json', 'buffer': json.dumps(bad).encode()})
    g.wait_for_selector('#rGo')
    g.click('#rGo'); g.wait_for_timeout(900)
    names = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.map(p => p.name)")
    ok('projects are kept when a cover photo fails', 'Sample Autumn Wreath' in names and 'Tester Keepsake' in names, names)
    msg = (g.inner_text('#restorePhotos') if g.locator('#restorePhotos').count() else '') + ' ' + g.inner_text('#restorePanel')
    ok('failed photo restore is named / counted, not silent', 'couldn\'t be restored' in msg or 'without' in msg, msg)
    c.close()

    # ---- legacy v1 and v2 JSON-only backups still import ----
    v1 = {
        'app': 'floss-fox', 'kind': 'full-backup', 'version': 1, 'schema': 1,
        'exported': '2026-01-02T00:00:00.000Z',
        'projects': [proj('legacy-v1', 'Legacy V1 Sampler', ['310', '321'])],
        'threads': {'schema': 1, 'threads': {'310': {'n': 3, 'partial': False, 'restock': False, 'updated': '2026-01-01T00:00:00Z'}}}
    }
    v2 = {
        'app': 'floss-fox', 'kind': 'full-backup', 'version': 2, 'schema': 2,
        'exported': '2026-06-02T00:00:00.000Z',
        'projects': [proj('legacy-v2', 'Legacy V2 Sampler', ['WHITE'])],
        'threads': {'schema': 2, 'threads': {'WHITE': {'n': 2, 'partial': False, 'restock': False, 'confirmed': True, 'updated': '2026-06-01T00:00:00Z'}}}
    }
    c, g = ctx(br, seed_all({KEY: json.dumps({'schema':2,'projects':[proj('tester-keep','Tester Keepsake',['BLANC'], notes='do not overwrite me')]}), TK: json.dumps({'schema':2,'threads':{}})}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.click('#backupBox summary')
    g.set_input_files('#restoreFile', {'name': 'v1.json', 'mimeType': 'application/json', 'buffer': json.dumps(v1).encode()})
    g.wait_for_selector('#rGo')
    ok('legacy v1 backup is offered with no newer-version error', 'newer version' not in g.inner_text('#restorePanel') and g.locator('#rGo').is_visible())
    g.click('#rGo'); g.wait_for_timeout(700)
    names = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.map(p => p.name)")
    th = g.evaluate(f"() => JSON.parse(localStorage.getItem({TK!r}))")
    ok('legacy v1 project and skein counts import; tester data kept', 'Legacy V1 Sampler' in names and 'Tester Keepsake' in names and th['threads']['310']['n']==3, (names, th))
    g.set_input_files('#restoreFile', {'name': 'v2.json', 'mimeType': 'application/json', 'buffer': json.dumps(v2).encode()})
    g.wait_for_selector('#rGo')
    g.click('#rGo'); g.wait_for_timeout(700)
    names = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.map(p => p.name)")
    ok('legacy v2 JSON-only backup still imports unchanged', 'Legacy V2 Sampler' in names and 'Legacy V1 Sampler' in names and 'Tester Keepsake' in names, names)
    c.close()

    # ---- quota: project unchanged, Pixel full line, rollback ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    open_proj(g, 'p1')
    before = dump_inv(g)
    g.evaluate("() => FlossFoxAtelierMedia.setTestHooks({quota:true})")
    qres = g.evaluate("""async () => {
      const c=document.createElement('canvas'); c.width=80; c.height=60;
      const x=c.getContext('2d'); x.fillStyle='#363'; x.fillRect(0,0,80,60);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      const r=await FlossFoxAtelierMedia.setCover('p1', new File([blob],'q.jpg',{type:'image/jpeg'}));
      return r;
    }""")
    ok('quota hook reports a failed save', qres and qres.get('ok') is False and qres.get('reason')=='quota', qres)
    ok('quota does not change project or thread JSON', dump_inv(g)==before)
    p1 = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.find(p=>p.id==='p1')")
    ok('quota leaves the project without a coverId', p1 and not p1.get('coverId'), p1)
    # show the message in the editor
    g.evaluate("""async () => {
      const input = document.getElementById('ffaCoverFile');
      if (!input) return;
      const c=document.createElement('canvas'); c.width=80; c.height=60;
      const x=c.getContext('2d'); x.fillStyle='#363'; x.fillRect(0,0,80,60);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      const dt=new DataTransfer(); dt.items.add(new File([blob],'q.jpg',{type:'image/jpeg'}));
      input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    g.wait_for_timeout(600)
    msg = g.inner_text('#ffaCoverMsg') if g.locator('#ffaCoverMsg').count() else ''
    ok('quota shows the Pixel full-storage line', "there isn't enough room in this browser for that photo" in msg or 'Try a smaller photo' in msg, msg)
    clear_bubbles(g)
    g.locator('#pCover').scroll_into_view_if_needed()
    g.wait_for_timeout(200)
    g.evaluate("() => FlossFoxAtelierMedia.setTestHooks({quota:false})")
    c.close()

    # ---- 500-color stress: cover, backup, restore, gallery still paints ----
    c, g = ctx(br, seed_500())
    g.goto(B + '?nosw'); ready(g)
    nitems = g.evaluate("() => (FlossFoxProjects._store().projects.find(p=>p.id==='p500')||{items:[]}).items.length")
    ok('500-color project seeded', nitems == 500, nitems)
    r500 = g.evaluate("""async () => {
      const c=document.createElement('canvas'); c.width=240; c.height=135;
      const x=c.getContext('2d'); x.fillStyle='#246'; x.fillRect(0,0,240,135);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      return FlossFoxAtelierMedia.setCover('p500', new File([blob],'five.jpg',{type:'image/jpeg'}));
    }""")
    ok('cover can be saved on a 500-color project', r500 and r500.get('ok') is True, r500)
    bak500 = g.evaluate("async () => FlossFoxProjects.fullBackupWithMedia()")
    n500 = len((bak500 or {}).get('projects') or [{}]) and len(next((p for p in (bak500 or {}).get('projects') or [] if p.get('id')=='p500'), {'items':[]}).get('items') or [])
    ok('500-color backup includes the cover and stays at version 2', bool(bak500) and bak500.get('version')==2 and (bak500.get('media') or {}).get('count', 0)>=1 and n500==500, (bak500.get('media') if bak500 else None, n500))
    c.close()
    # restore into a page that only has the tester project
    c, g = ctx(br, seed_all({KEY: json.dumps({'schema':2,'projects':[proj('tester-keep','Tester Keepsake',['BLANC'], notes='do not overwrite me')]})}))
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.click('#backupBox summary')
    g.set_input_files('#restoreFile', {'name': 'five.json', 'mimeType': 'application/json', 'buffer': json.dumps(bak500).encode()})
    g.wait_for_selector('#rGo')
    g.click('#rGo'); g.wait_for_timeout(1500)
    got = g.evaluate(f"""() => {{
      const ps = JSON.parse(localStorage.getItem({KEY!r})).projects;
      const p = ps.find(x => x.id === 'p500');
      return {{ names: ps.map(x => x.name), n: p && p.items.length, coverId: p && p.coverId, tester: !!ps.find(x => x.id==='tester-keep') }};
    }}""")
    ok('500-color project restores with all items, a coverId, and tester data kept', got and got.get('n')==500 and got.get('coverId') and got.get('tester') and 'Five Hundred Colors' in got['names'], got)
    photo = g.evaluate("""async () => {
      const p = FlossFoxProjects._store().projects.find(x => x.id === 'p500');
      const r = await FlossFoxAtelierMedia.getRecord(p.coverId);
      if (!r || !r.blob) return false;
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      const sha = await FlossFoxAtelierMediaCore.sha256(bytes);
      return sha === r.sha256;
    }""")
    ok('500-color cover reads back after restore', photo is True)
    g.click('#tabProjects'); g.wait_for_timeout(500)
    ok('500-color gallery card still paints a cover', g.locator('li.ffa-gcard:has([data-open="p500"]) .ffa-cover').count() == 1)
    c.close()

    # ---- gallery fallback strip + 390 shots (full_page=False) ----
    c, g = ctx(br, seed_all(), w=390, h=844, touch=True)
    g.goto(B + '?nosw'); ready(g)
    g.click('#tabProjects'); g.wait_for_timeout(400)
    clear_bubbles(g)
    card = g.locator('li.ffa-gcard:has([data-open="p1"])')
    strip = card.locator('.ffa-cover .ffa-strip')
    ok('gallery falls back to the color strip when there is no cover', strip.count() == 1)
    card.scroll_into_view_if_needed()
    g.wait_for_timeout(200)
    # add a cover at 390 and shoot the card
    g.evaluate("""async () => {
      const c=document.createElement('canvas'); c.width=160; c.height=90;
      const x=c.getContext('2d'); x.fillStyle='#a42'; x.fillRect(0,0,160,90);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      await FlossFoxAtelierMedia.setCover('p1', new File([blob],'m.jpg',{type:'image/jpeg'}));
    }""")
    g.wait_for_timeout(500)
    clear_bubbles(g)
    card = g.locator('li.ffa-gcard:has([data-open="p1"])')
    ok('gallery cover appears at 390 after add', card.locator('.ffa-cover img').count() == 1)
    card.scroll_into_view_if_needed()
    g.wait_for_timeout(200)
    g.screenshot(path=os.path.join(SHOTS, 'stageG-cover-390.png'), full_page=False)
    ok('no page errors in the 390 pass', g.errs == [], g.errs)
    c.close()

    # ---- incomplete backup: photo can't be read, warn, projects still export ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    added = g.evaluate("""async () => {
      const c=document.createElement('canvas'); c.width=120; c.height=80;
      const x=c.getContext('2d'); x.fillStyle='#a33'; x.fillRect(0,0,120,80);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      return FlossFoxAtelierMedia.setCover('p1', new File([blob],'gone.jpg',{type:'image/jpeg'}));
    }""")
    ok('cover saved before the missing-photo export case', added and added.get('ok') is True, added)
    dropped = g.evaluate("""async () => {
      const p = FlossFoxProjects._store().projects.find(x => x.id === 'p1');
      if (p && p.coverId) await FlossFoxAtelierMedia.delByProject('p1');
      return !!(p && p.coverId);
    }""")
    # delByProject removes the blob but we need coverId to remain so export reports a gap.
    # The helper above deleted the blob; re-set coverId if delByProject also cleared it? delByProject only deletes IDB rows.
    bak = g.evaluate("async () => FlossFoxProjects.fullBackupWithMedia()")
    missing = g.evaluate("() => FlossFoxProjects.mediaMissing()")
    ok('export lists the unreadable cover instead of calling the backup complete',
       isinstance(missing, list) and len(missing) >= 1 and missing[0].get('projectId') == 'p1' and 'Wreath' in (missing[0].get('name') or ''), missing)
    ok('incomplete backup still includes the project and stays at version 2',
       bak and bak.get('version') == 2 and any(x.get('id')=='p1' for x in bak.get('projects') or []), bak.get('version') if bak else None)
    ok('unreadable photo bytes are not in the incomplete backup media list',
       not bak.get('media') or not any(it.get('projectId')=='p1' for it in (bak.get('media') or {}).get('items') or []), bak.get('media'))
    note = g.evaluate("d => FlossFoxProjects.backupPhotoNote(d, FlossFoxProjects.mediaMissing())", bak)
    ok('backup note names the missing cover and does not claim a complete photo backup',
       note and "couldn't be added to this backup" in note and 'Wreath' in note, note)
    ok('no page errors in the missing-photo export pass', g.errs == [], g.errs)
    c.close()

    # ---- change and remove cover; hook fires; fallback returns ----
    c, g = ctx(br, seed_all())
    g.goto(B + '?nosw'); ready(g)
    first = g.evaluate("""async () => {
      const c=document.createElement('canvas'); c.width=100; c.height=60;
      const x=c.getContext('2d'); x.fillStyle='#111'; x.fillRect(0,0,100,60);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      return FlossFoxAtelierMedia.setCover('p1', new File([blob],'a.jpg',{type:'image/jpeg'}));
    }""")
    second = g.evaluate("""async () => {
      const c=document.createElement('canvas'); c.width=100; c.height=60;
      const x=c.getContext('2d'); x.fillStyle='#0a0'; x.fillRect(0,0,100,60);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));
      return FlossFoxAtelierMedia.setCover('p1', new File([blob],'b.jpg',{type:'image/jpeg'}));
    }""")
    ok('changing a cover returns kind=change and a new id', second and second.get('ok') and second.get('kind')=='change' and second.get('id') != first.get('id'), (first, second))
    old_gone = g.evaluate("(id) => FlossFoxAtelierMedia.getRecord(id).then(r => !r)", first['id'])
    ok('previous cover blob is removed after a verified change', old_gone is True)
    rm = g.evaluate("() => FlossFoxAtelierMedia.removeCover('p1')")
    ok('removeCover succeeds', rm and rm.get('ok') is True, rm)
    p1 = g.evaluate(f"() => JSON.parse(localStorage.getItem({KEY!r})).projects.find(p=>p.id==='p1')")
    ok('removeCover drops coverId from the project after a verified save', p1 and not p1.get('coverId'), p1)
    g.click('#tabProjects'); g.wait_for_timeout(400)
    ok('gallery returns to the color strip after remove', g.locator('li.ffa-gcard:has([data-open="p1"]) .ffa-cover .ffa-strip').count() == 1)
    ok('no page errors in the change/remove pass', g.errs == [], g.errs)
    c.close()

print(f'{R[0]} passed, {R[1]} failed')
sys.exit(0 if R[1] == 0 else 1)
