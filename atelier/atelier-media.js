/* Floss Fox 3.9 Atelier: cover photos in IndexedDB (FF39-13). Downscale, strip EXIF/GPS via canvas,
   cap size, quota rollback, gallery fallback to the color strip. Backup attach/restore lives here;
   automatic copies are not given these bytes. */
(function (root) {
  'use strict';
  const C = () => root.FlossFoxAtelierMediaCore;
  const P = () => root.FlossFoxProjects;
  const t = (k, v, n) => {
    const X = root.FlossFoxAtelierCopy;
    return X && X.has && X.has(k) ? X.t(k, v, n) : '';
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STORE = 'covers';
  const urls = new Map();
  let dbp = null, hooks = { quota: false }, backupPromise = true; // set after atelier_media_e2e verified backup+readback (48/0)

  function dbName() {
    const key = (P() && P().KEY) || 'flossfox.v1';
    return key.replace(/\.v1$/, '') + '.covers.v1';
  }
  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((ok, err) => {
      let req;
      try { req = indexedDB.open(dbName(), 1); } catch (e) { err(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => err(req.error || new Error('idb'));
      req.onblocked = () => err(new Error('idb-blocked'));
    });
    return dbp;
  }
  function txDone(tx) {
    return new Promise((ok, err) => {
      tx.oncomplete = () => ok();
      tx.onabort = () => err(tx.error || new Error('aborted'));
      tx.onerror = () => err(tx.error || new Error('tx'));
    });
  }
  function reqOf(req) {
    return new Promise((ok, err) => {
      req.onsuccess = () => ok(req.result);
      req.onerror = () => err(req.error || new Error('req'));
    });
  }
  async function putRecord(rec) {
    if (hooks.quota) {
      const e = new Error('quota');
      e.name = 'QuotaExceededError';
      e.code = 22;
      throw e;
    }
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(rec);
    await txDone(tx);
  }
  async function getRecord(id) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const rec = await reqOf(tx.objectStore(STORE).get(id));
    await txDone(tx);
    return rec || null;
  }
  async function delRecord(id) {
    if (!id) return;
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    try { await txDone(tx); } catch (e) { /* orphan is safer than touching the project */ }
  }
  async function getAll() {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const rows = await reqOf(tx.objectStore(STORE).getAll());
    await txDone(tx);
    return Array.isArray(rows) ? rows : [];
  }
  async function delByProject(projectId) {
    const rows = await getAll();
    for (const r of rows) if (r && r.projectId === projectId) await delRecord(r.id);
  }
  function revoke(id) {
    const u = urls.get(id);
    if (u) { try { URL.revokeObjectURL(u); } catch (e) {} urls.delete(id); }
  }
  async function objectUrl(id) {
    if (!id) return null;
    if (urls.has(id)) return urls.get(id);
    const rec = await getRecord(id);
    if (!rec || !rec.blob) return null;
    const u = URL.createObjectURL(rec.blob);
    urls.set(id, u);
    return u;
  }
  async function processFile(file) {
    const Core = C();
    if (!Core) return { ok: false, reason: 'type' };
    if (!file || typeof file !== 'object') return { ok: false, reason: 'type' };
    const mime = file.type || '';
    if (mime && !Core.validMime(mime) && mime !== 'image/webp') return { ok: false, reason: 'type' };
    let bmp = null;
    try {
      if (typeof createImageBitmap === 'function') {
        bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } else {
        bmp = await new Promise((ok, err) => {
          const img = new Image();
          const u = URL.createObjectURL(file);
          img.onload = () => { URL.revokeObjectURL(u); ok(img); };
          img.onerror = () => { URL.revokeObjectURL(u); err(new Error('img')); };
          img.src = u;
        });
      }
    } catch (e) { return { ok: false, reason: 'type' }; }
    const srcW = bmp.width, srcH = bmp.height;
    if (!srcW || !srcH) { if (bmp.close) try { bmp.close(); } catch (e) {} return { ok: false, reason: 'type' }; }
    async function encode(edge, quality) {
      const scale = Math.min(1, edge / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return null;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
      return blob && blob.size ? { blob, w, h } : null;
    }
    let out = null, q = 0.86, edge = Math.min(Core.MAX_EDGE, Math.max(srcW, srcH));
    for (let i = 0; i < 8; i++) {
      out = await encode(edge, q);
      if (!out) break;
      if (out.blob.size <= Core.MAX_ITEM_BYTES) break;
      if (q > 0.5) { q -= 0.08; continue; }
      edge = Math.max(320, Math.round(edge * 0.75));
      q = 0.82;
    }
    if (bmp.close) try { bmp.close(); } catch (e) {}
    if (!out || out.blob.size > Core.MAX_ITEM_BYTES) return { ok: false, reason: 'too-big' };
    const bytes = new Uint8Array(await out.blob.arrayBuffer());
    const hash = await Core.sha256(bytes);
    return { ok: true, mime: 'image/jpeg', w: out.w, h: out.h, bytes, sha256: hash, blob: out.blob };
  }
  function projOf(id) {
    const Pr = P();
    if (!Pr || !Pr._store) return null;
    return (Pr._store().projects || []).find(x => x.id === id) || null;
  }
  async function setCover(projectId, file) {
    const Core = C();
    const p = projOf(projectId);
    if (!p || p.demo) return { ok: false, reason: 'missing' };
    const prevId = p.coverId || null;
    const img = await processFile(file);
    if (!img.ok) return img;
    const id = Core.newId();
    const rec = { id, projectId, mime: img.mime, w: img.w, h: img.h, sha256: img.sha256, blob: img.blob, updated: new Date().toISOString() };
    try {
      await putRecord(rec);
      const back = await getRecord(id);
      if (!back || !back.blob) { await delRecord(id); return { ok: false, reason: 'not-saved' }; }
      const backBytes = new Uint8Array(await back.blob.arrayBuffer());
      const backHash = await Core.sha256(backBytes);
      if (backHash !== img.sha256 || backBytes.length !== img.bytes.length) { await delRecord(id); return { ok: false, reason: 'not-saved' }; }
    } catch (e) {
      try { await delRecord(id); } catch (e2) {}
      return { ok: false, reason: Core.isQuota(e) ? 'quota' : 'not-saved' };
    }
    const wr = P().setCoverId ? P().setCoverId(projectId, id) : { ok: false, reason: 'not-saved' };
    if (!wr || !wr.ok) {
      try { await delRecord(id); } catch (e) {}
      return { ok: false, reason: wr && wr.reason === 'missing' ? 'missing' : 'not-saved' };
    }
    if (prevId && prevId !== id) { revoke(prevId); try { await delRecord(prevId); } catch (e) {} }
    revoke(id);
    const kind = prevId ? 'change' : 'add';
    try { if (root.FlossFoxAtelierPip && FlossFoxAtelierPip.coverPhoto) FlossFoxAtelierPip.coverPhoto(p, kind); } catch (e) {}
    try { if (P().refreshList) P().refreshList(); } catch (e) {}
    return { ok: true, id, kind };
  }
  async function removeCover(projectId) {
    const p = projOf(projectId);
    if (!p || !p.coverId) return { ok: true, unchanged: true };
    const prevId = p.coverId;
    const wr = P().setCoverId ? P().setCoverId(projectId, null) : { ok: false, reason: 'not-saved' };
    if (!wr || !wr.ok) return { ok: false, reason: wr && wr.reason === 'missing' ? 'missing' : 'not-saved' };
    revoke(prevId);
    try { await delRecord(prevId); } catch (e) {}
    try { if (root.FlossFoxAtelierPip && FlossFoxAtelierPip.coverPhoto) FlossFoxAtelierPip.coverPhoto(p, 'remove'); } catch (e) {}
    try { if (P().refreshList) P().refreshList(); } catch (e) {}
    return { ok: true };
  }
  async function exportCovers(projects) {
    const rows = await getAll();
    const byId = new Map(rows.map(r => [r.id, r]));
    const out = [];
    const missing = [];
    const Core = C();
    for (const p of projects || []) {
      if (!p || p.demo || !p.coverId) continue;
      const rec = byId.get(p.coverId);
      if (!rec || !rec.blob) { missing.push({ projectId: p.id, name: p.name || '', coverId: p.coverId }); continue; }
      try {
        const bytes = new Uint8Array(await rec.blob.arrayBuffer());
        if (bytes.length < 32 || bytes.length > Core.MAX_ITEM_BYTES) { missing.push({ projectId: p.id, name: p.name || '', coverId: p.coverId }); continue; }
        const hash = rec.sha256 && /^[a-f0-9]{64}$/.test(rec.sha256) ? rec.sha256 : await Core.sha256(bytes);
        out.push({ id: rec.id, projectId: p.id, name: p.name || '', mime: rec.mime || 'image/jpeg', w: rec.w, h: rec.h, sha256: hash, bytes });
      } catch (e) { missing.push({ projectId: p.id, name: p.name || '', coverId: p.coverId }); }
    }
    return { covers: out, missing };
  }
  async function importForRestore(items, opts) {
    opts = opts || {};
    const Core = C();
    const failed = [];
    const ok = [];
    const copyMap = opts.copyMap || {};
    const skipIds = new Set(opts.skipIds || []);
    const list = Array.isArray(items) ? items : [];
    for (const raw of list) {
      const name = (raw && raw.name) || '';
      const mapped = raw && copyMap[raw.projectId] ? copyMap[raw.projectId] : (raw && raw.projectId);
      if (!raw || skipIds.has(raw.projectId)) continue; // user kept their project; not a failed photo
      let ver;
      try { ver = await Core.verifyItem(raw); } catch (e) { ver = { ok: false, reason: 'checksum', name, id: raw && raw.id, projectId: mapped }; }
      if (!ver.ok) { failed.push({ name: ver.name || name, reason: ver.reason || 'checksum', projectId: mapped, id: raw && raw.id }); continue; }
      const rec = ver.item;
      const newId = (mapped && mapped !== rec.projectId) ? Core.newId() : rec.id;
      const blob = new Blob([rec.bytes], { type: rec.mime });
      const row = { id: newId, projectId: mapped, mime: rec.mime, w: rec.w, h: rec.h, sha256: rec.sha256, blob, updated: new Date().toISOString() };
      try {
        await putRecord(row);
        const back = await getRecord(newId);
        if (!back || !back.blob) throw new Error('missing');
        const bb = new Uint8Array(await back.blob.arrayBuffer());
        const bh = await Core.sha256(bb);
        if (bh !== rec.sha256) throw new Error('checksum');
        ok.push({ id: newId, projectId: mapped, name: rec.name || name });
      } catch (e) {
        try { await delRecord(newId); } catch (e2) {}
        failed.push({ name: rec.name || name, reason: Core.isQuota(e) ? 'quota' : 'write', projectId: mapped, id: newId });
      }
    }
    if (opts.mode === 'replace') {
      try {
        const keep = new Set(ok.map(x => x.id));
        const demo = new Set((opts.demoIds || []));
        const rows = await getAll();
        for (const r of rows) {
          if (!r) continue;
          if (demo.has(r.projectId)) continue;
          if (!keep.has(r.id)) { revoke(r.id); try { await delRecord(r.id); } catch (e) {} }
        }
      } catch (e) { /* projects already verified; leftover orphans are preferable to a rollback of user data */ }
    }
    return { ok, failed };
  }
  function stripEl(cover, p) {
    cover.replaceChildren();
    cover.removeAttribute('data-cover-id');
    cover.setAttribute('role', 'img');
    cover.setAttribute('aria-label', t('journal.cover.fallback.aria', { name: p.name }) || ('Color strip for ' + p.name));
    const Pal = root.FlossFoxAtelierPalette;
    const src = (typeof DMC === 'object' && DMC) || {};
    const pack = Pal && Pal.strip ? Pal.strip(p.items || [], src, 6) : { swatches: [], more: 0 };
    const ul = document.createElement('ul');
    ul.className = 'ffa-strip';
    (pack.swatches || []).forEach(s => {
      const liS = document.createElement('li');
      const sp = document.createElement('span');
      sp.className = 'ffa-floss ffa-chip';
      sp.setAttribute('role', 'img');
      sp.setAttribute('aria-label', s.label || ('DMC ' + s.code));
      if (s.rgb) sp.style.setProperty('--c', s.rgb); else sp.style.background = '#ccc';
      liS.appendChild(sp); ul.appendChild(liS);
    });
    cover.appendChild(ul);
    if (pack.more) {
      const more = document.createElement('span');
      more.className = 'ffa-more';
      more.textContent = '+' + pack.more;
      cover.appendChild(more);
    }
  }
  function fillCover(cover, p) {
    if (!cover || !p) return;
    if (!p.coverId) { stripEl(cover, p); return; }
    if (cover.getAttribute('data-cover-id') === p.coverId && cover.querySelector('img')) return;
    cover.replaceChildren();
    cover.setAttribute('data-cover-id', p.coverId);
    cover.removeAttribute('role');
    cover.removeAttribute('aria-label');
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => { stripEl(cover, p); });
    cover.appendChild(img);
    objectUrl(p.coverId).then(u => {
      if (!u) { stripEl(cover, p); return; }
      if (cover.getAttribute('data-cover-id') !== p.coverId) return;
      img.src = u;
    }).catch(() => stripEl(cover, p));
  }
  function msgFor(reason) {
    if (reason === 'quota') return t('journal.cover.full') || "Not saved: there isn't enough room in this browser for that photo. Your project wasn't changed. Try a smaller photo.";
    if (reason === 'type') return t('journal.cover.type') || "We can't use that file as a cover. Choose a photo file.";
    if (reason === 'too-big') return t('journal.cover.type') || "We can't use that file as a cover. Choose a photo file.";
    return t('common.notSaved') || 'Not saved: your browser blocked the save. Download a backup to keep your work.';
  }
  function mountEditor(p) {
    const host = document.getElementById('pCover');
    if (!host || !p) return;
    const has = !!p.coverId;
    const addLab = t(has ? 'journal.cover.change' : 'journal.cover.add') || (has ? 'Change cover photo' : 'Add a cover photo');
    const hint = t('journal.cover.hint') || 'Optional. The photo stays in this browser and is made smaller to save space.';
    const backupC = backupPromise ? (t('journal.cover.backupC') || '') : '';
    const rm = has ? `<button type="button" class="sec small" id="ffaCoverRemove">${esc(t('journal.cover.remove') || 'Remove cover photo')}</button>` : '';
    host.innerHTML = `<div class="ffa-cover-edit"><p class="hint" id="ffaCoverHint">${esc(hint)}</p>${backupC ? `<p class="hint" id="ffaCoverBackup">${esc(backupC)}</p>` : ''}<div class="ffa-cover-preview" id="ffaCoverPrev"></div><div class="row"><label class="sec filebtn" for="ffaCoverFile">${esc(addLab)}</label><input type="file" id="ffaCoverFile" class="sr" accept="image/jpeg,image/png,image/webp,image/*">${rm}</div><p class="hint" id="ffaCoverMsg" role="status" aria-live="polite"></p></div>`;
    const prev = document.getElementById('ffaCoverPrev');
    if (prev) {
      const box = document.createElement('div');
      box.className = 'ffa-cover';
      prev.appendChild(box);
      fillCover(box, p);
    }
    const input = document.getElementById('ffaCoverFile');
    const say = m => { const el = document.getElementById('ffaCoverMsg'); if (el) el.textContent = m || ''; };
    if (input) input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      say(t('common.saving') || 'Saving…');
      const r = await setCover(p.id, f);
      if (!r.ok) { say(msgFor(r.reason)); return; }
      say(t('common.saved') || '✓ Saved in this browser.');
      const cur = projOf(p.id);
      if (cur && P().openId && P().openId() === p.id) mountEditor(cur);
    });
    const rem = document.getElementById('ffaCoverRemove');
    if (rem) rem.addEventListener('click', async () => {
      const r = await removeCover(p.id);
      if (!r.ok) { say(msgFor(r.reason)); return; }
      say(t('common.saved') || '✓ Saved in this browser.');
      const cur = projOf(p.id);
      if (cur) mountEditor(cur);
    });
  }
  function restoreLines(result) {
    const okN = (result && result.ok && result.ok.length) || 0;
    const fail = (result && result.failed) || [];
    const parts = [];
    if (okN) parts.push(t('backup.photos.restore', { n: okN }, okN) || (okN === 1 ? 'Restored 1 cover photo.' : 'Restored ' + okN + ' cover photos.'));
    if (fail.length) {
      const failLine = t('backup.photos.restoreFail', { n: fail.length }, fail.length) || (fail.length === 1 ? "1 cover photo couldn't be restored. Your projects were restored without it." : fail.length + " cover photos couldn't be restored. Your projects were restored without them.");
      const names = fail.map(f => f.name || f.id || 'cover').filter(Boolean);
      const named = names.length ? ' (' + names.slice(0, 8).join(', ') + (names.length > 8 ? '…' : '') + ')' : '';
      parts.push(failLine + named);
    }
    return parts.join(' ');
  }
  function paintBackupHints() {
    const hasCover = !!(P() && P()._store && (P()._store().projects || []).some(x => x && x.coverId && !x.demo));
    const size = hasCover ? (t('backup.photos.size') || 'Cover photos make backup files larger.') : '';
    const promise = backupPromise ? (t('journal.cover.backupC') || '') : '';
    const text = [promise, size].filter(Boolean).join(' ');
    ['bkPhotoHint', 'bkPhotoHintSettings'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.hidden = !text;
    });
  }
  function setBackupPromise(on) { backupPromise = !!on; try { paintBackupHints(); } catch (e) {} }
  function setTestHooks(h) { hooks = Object.assign({ quota: false }, h || {}); }

  root.FlossFoxAtelierMedia = {
    processFile, setCover, removeCover, exportCovers, importForRestore, fillCover, mountEditor,
    objectUrl, getRecord, delByProject, restoreLines, msgFor, setTestHooks, setBackupPromise, paintBackupHints, backupPromise: function () { return backupPromise; }, dbName
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('ff:data-saved', function () { try { paintBackupHints(); } catch (e) {} });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { paintBackupHints(); } catch (e) {} });
    else setTimeout(function () { try { paintBackupHints(); } catch (e) {} }, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);

