/* Floss Fox 3.9 Atelier: cover-photo backup contract (FF39-13). Pure, no DOM, no storage, no network.
   Cover bytes are NEVER written into flossfox*.v1 / project JSON. They travel in an optional `media`
   section on the existing kind:'full-backup' file, which stays at version 2 so older importers
   (that reject version > 2 and ignore unknown fields) still restore projects and threads unchanged.
   Automatic copies on this device do not use this module and must not be given media. */
(function (root) {
  'use strict';
  const MEDIA_SCHEMA = 1;
  const MEDIA_KIND = 'cover-photos';
  const BACKUP_VERSION = 2; // do not bump: older checkBackup treats version > 2 as "newer"
  const MAX_EDGE = 1280;
  const MAX_ITEM_BYTES = 200 * 1024;
  const MAX_FILE_JSON = 5 * 1024 * 1024;
  const MAX_FILE = 50 * 1024 * 1024;
  const MAX_ID = 80;
  const ACCEPTED = { 'image/jpeg': true, 'image/png': true };
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);

  function utf8(s) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(String(s));
    const buf = Buffer.from(String(s), 'utf8');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  function subtle() {
    if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto.subtle;
    try { return require('crypto').webcrypto.subtle; } catch (e) { return null; }
  }
  async function sha256(u8) {
    const c = subtle();
    if (!c) throw new Error('sha256 unavailable');
    const buf = await c.digest('SHA-256', u8);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function b64encode(u8) {
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    let s = '';
    const step = 0x8000;
    for (let i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
    return btoa(s);
  }
  function b64decode(s) {
    if (typeof s !== 'string' || !s.length || s.length > Math.ceil(MAX_ITEM_BYTES * 2) || /[^A-Za-z0-9+/=]/.test(s)) return null;
    try {
      if (typeof Buffer !== 'undefined') {
        const b = Buffer.from(s, 'base64');
        if (!b.length || b.length > MAX_ITEM_BYTES) return null;
        return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
      }
      const bin = atob(s);
      if (!bin.length || bin.length > MAX_ITEM_BYTES) return null;
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    } catch (e) { return null; }
  }
  function validId(s) { return typeof s === 'string' && s.length > 0 && s.length <= MAX_ID && /^[A-Za-z0-9_-]+$/.test(s); }
  function validMime(m) { return !!ACCEPTED[m]; }
  function newId() {
    const c = globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function' ? globalThis.crypto : null;
    if (c) {
      const a = new Uint8Array(12);
      c.getRandomValues(a);
      return 'cov_' + Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return 'cov_' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
  }
  function isQuota(err) {
    if (!err) return false;
    const n = err.name || '';
    const code = err.code;
    return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
  }
  function fileCap(file, parsed) {
    const size = file && typeof file.size === 'number' ? file.size : 0;
    if (size > MAX_FILE) return { ok: false, reason: 'too-large' };
    const hasMedia = !!(parsed && ((parsed.media && object(parsed.media)) || (parsed.threadwood && object(parsed.threadwood))));
    if (!hasMedia && size > MAX_FILE_JSON) return { ok: false, reason: 'too-large' };
    return { ok: true };
  }
  // Simulated contract of a pre-Stage-G importer: accept version <= 2, ignore unknown fields (media).
  function legacyAccepts(d) {
    if (!d || typeof d !== 'object' || d.app !== 'floss-fox') return { ok: false, reason: 'bad' };
    const full = d.kind === 'full-backup';
    if (d.kind !== undefined && !full) return { ok: false, reason: 'bad' };
    if (full && (typeof d.version !== 'number' || d.version > BACKUP_VERSION)) return { ok: false, reason: 'new' };
    if (!Array.isArray(d.projects)) return { ok: false, reason: 'bad' };
    return { ok: true, ignoredMedia: d.media !== undefined };
  }
  function itemShape(it) {
    if (!object(it) || !validId(it.id) || !validId(it.projectId) || !validMime(it.mime)) return null;
    if (typeof it.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(it.sha256)) return null;
    if (!Number.isInteger(it.w) || !Number.isInteger(it.h) || it.w < 1 || it.h < 1 || it.w > MAX_EDGE || it.h > MAX_EDGE) return null;
    if (typeof it.data !== 'string') return null;
    const bytes = b64decode(it.data);
    if (!bytes || bytes.length < 32 || bytes.length > MAX_ITEM_BYTES) return null;
    const name = typeof it.name === 'string' ? it.name.slice(0, 100) : '';
    return { id: it.id, projectId: it.projectId, name, mime: it.mime, w: it.w, h: it.h, sha256: it.sha256, data: it.data, bytes };
  }
  async function verifyItem(it) {
    const rec = itemShape(it);
    if (!rec) return { ok: false, reason: 'shape', name: it && it.name, id: it && it.id, projectId: it && it.projectId };
    const hash = await sha256(rec.bytes);
    if (hash !== rec.sha256) return { ok: false, reason: 'checksum', name: rec.name, id: rec.id, projectId: rec.projectId };
    return { ok: true, item: rec };
  }
  async function manifestHash(items) {
    const s = (items || []).map(it => String(it.id) + ':' + String(it.sha256)).sort().join('|');
    return sha256(utf8(s));
  }
  async function check(backup) {
    if (!object(backup) || backup.media === undefined) return { ok: true, present: false, items: [] };
    const m = backup.media;
    if (!object(m) || m.kind !== MEDIA_KIND) return { ok: false, present: true, items: [], reason: 'kind' };
    if (m.schema !== MEDIA_SCHEMA) return { ok: false, present: true, items: [], reason: m.schema > MEDIA_SCHEMA ? 'new' : 'schema' };
    if (!Array.isArray(m.items)) return { ok: false, present: true, items: [], reason: 'items' };
    if (typeof m.sha256 === 'string' && !/^[a-f0-9]{64}$/.test(m.sha256)) return { ok: false, present: true, items: [], reason: 'manifest' };
    const seen = new Set();
    const items = [];
    for (const raw of m.items) {
      const rec = itemShape(raw);
      if (!rec) return { ok: false, present: true, items: [], reason: 'shape' };
      if (seen.has(rec.id)) return { ok: false, present: true, items: [], reason: 'duplicate' };
      seen.add(rec.id);
      items.push(rec);
    }
    if (typeof m.sha256 === 'string') {
      const h = await manifestHash(items);
      if (h !== m.sha256) return { ok: false, present: true, items: [], reason: 'manifest' };
    }
    return { ok: true, present: true, items };
  }
  async function attach(backup, covers) {
    const base = JSON.parse(JSON.stringify(backup));
    // Never bump version. Never put photo bytes on the project records.
    base.version = BACKUP_VERSION;
    if (base.projects) {
      base.projects.forEach(p => {
        if (p && typeof p === 'object') {
          if ('cover' in p) delete p.cover;
          if ('data' in p && typeof p.data === 'string' && p.data.length > 200) delete p.data;
        }
      });
    }
    const list = Array.isArray(covers) ? covers : [];
    if (!list.length) {
      if (base.media) delete base.media;
      return { backup: base, count: 0 };
    }
    const items = [];
    for (const c of list) {
      if (!c || !validId(c.id) || !validId(c.projectId) || !validMime(c.mime)) continue;
      const bytes = c.bytes instanceof Uint8Array ? c.bytes : (c.bytes ? new Uint8Array(c.bytes) : b64decode(c.data || ''));
      if (!bytes || bytes.length < 32 || bytes.length > MAX_ITEM_BYTES) continue;
      if (!Number.isInteger(c.w) || !Number.isInteger(c.h) || c.w < 1 || c.h < 1 || c.w > MAX_EDGE || c.h > MAX_EDGE) continue;
      const hash = c.sha256 && /^[a-f0-9]{64}$/.test(c.sha256) ? c.sha256 : await sha256(bytes);
      items.push({
        id: c.id,
        projectId: c.projectId,
        name: typeof c.name === 'string' ? c.name.slice(0, 100) : '',
        mime: c.mime,
        w: c.w,
        h: c.h,
        sha256: hash,
        data: b64encode(bytes)
      });
    }
    if (!items.length) {
      if (base.media) delete base.media;
      return { backup: base, count: 0 };
    }
    const sha = await manifestHash(items);
    base.media = {
      schema: MEDIA_SCHEMA,
      kind: MEDIA_KIND,
      version: MEDIA_SCHEMA,
      maxItemBytes: MAX_ITEM_BYTES,
      maxEdge: MAX_EDGE,
      sha256: sha,
      count: items.length,
      items
    };
    return { backup: base, count: items.length };
  }
  function strip(backup) {
    const base = JSON.parse(JSON.stringify(backup || {}));
    if (base.media) delete base.media;
    return base;
  }
  function missingCovers(projects, covers) {
    const have = new Set((covers || []).map(c => c && c.projectId).filter(Boolean));
    return (projects || []).filter(p => p && p.coverId && !p.demo && !have.has(p.id)).map(p => ({
      projectId: p.id,
      name: typeof p.name === 'string' ? p.name : '',
      coverId: p.coverId
    }));
  }

  const api = Object.freeze({
    MEDIA_SCHEMA, MEDIA_KIND, BACKUP_VERSION, MAX_EDGE, MAX_ITEM_BYTES, MAX_FILE, MAX_FILE_JSON, ACCEPTED,
    sha256, b64encode, b64decode, validId, validMime, newId, isQuota, fileCap, legacyAccepts,
    itemShape, verifyItem, manifestHash, check, attach, strip, missingCovers
  });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.FlossFoxAtelierMediaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
