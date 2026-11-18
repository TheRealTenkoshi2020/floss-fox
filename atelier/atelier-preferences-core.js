/* Floss Fox 3.9 Atelier: versioned, local-only convenience preferences (adapted from Samira's reference).
   Pure UMD module. Browser: window.FlossFoxAtelierPreferences; Node: require().
   - Key is derived from the projects key, like every other Floss Fox key: 'flossfox-dev.v1' -> 'flossfox-dev.atelier.v1',
     'flossfox.v1' -> 'flossfox.atelier.v1'. Preview and production never share a key.
   - Never touches project, thread, journal, snapshot or backup keys. Writes only when a caller explicitly saves.
   - Saves are read back and compared; a blocked or unverified write is reported, never shown as saved.
   - A stored value from a newer schema, or unreadable JSON, fails closed: it is not overwritten by save() (reset() is explicit).
   - "Resume where I was" is OFF by default (opt-in, FF39-06).
   - Seasonal Pip is ON by default (Myke decided, relayed by Pixel): Northern hemisphere; standard Pip until seasonal art exists. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxAtelierPreferences = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 1;
  const THEMES = Object.freeze(['system', 'morning', 'forest', 'moon']);
  const TABS = Object.freeze(['workbasket', 'convert', 'threads', 'projects', 'shop', 'help', 'settings']); // matches projects.js showView(); Fabric is its own page
  const VIEWS = Object.freeze(['list', 'grid', 'shelf']);
  const PROJECT_VIEWS = Object.freeze(['list', 'gallery']); // journal list/gallery (FF39-13 Stage D)
  const SORTS = Object.freeze(['code', 'amount', 'family', 'location', 'recent']); // My threads sort (lib.sort.*)
  const BRANDS = Object.freeze(['dmc', 'anchor', 'sullivans']); // BRAND keys in index.html
  const MAX_RECENT = 12;
  const DEFAULT = Object.freeze({ v: SCHEMA, theme: 'system', rememberPlace: false, lastTab: 'convert', lastProjectId: null, collectionView: 'list', collectionSort: 'code', lowStockThreshold: 1, seasonalPip: true, projectsView: 'list', sessionTimer: false, recentConversions: Object.freeze([]) });
  const code = v => typeof v === 'string' && /^[A-Za-z0-9-]{1,35}$/.test(v.trim()) ? v.trim().toUpperCase() : null;
  const brand = v => typeof v === 'string' && BRANDS.includes(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null;
  const projectId = v => typeof v === 'string' && v.length >= 1 && v.length <= 80 && /^[\w.-]+$/.test(v) ? v : null;
  function conversion(v) {
    if (!v || typeof v !== 'object') return null;
    const from = brand(v.from), to = brand(v.to), c = code(v.code);
    if (!from || !to || !c) return null;
    const at = typeof v.at === 'string' && v.at.length <= 40 && !Number.isNaN(Date.parse(v.at)) ? v.at : '';
    return { from, to, code: c, at };
  }
  const ck = x => `${x.from}|${x.to}|${x.code}`;
  function normalize(raw) {
    const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    if (d.v !== undefined && !(Number(d.v) <= SCHEMA)) return { ok: false, reason: 'future-schema', data: null };
    const o = { ...DEFAULT, recentConversions: [] };
    if (THEMES.includes(d.theme)) o.theme = d.theme;
    if (typeof d.rememberPlace === 'boolean') o.rememberPlace = d.rememberPlace;
    if (TABS.includes(d.lastTab)) o.lastTab = d.lastTab;
    o.lastProjectId = projectId(d.lastProjectId);
    if (VIEWS.includes(d.collectionView)) o.collectionView = d.collectionView;
    if (SORTS.includes(d.collectionSort)) o.collectionSort = d.collectionSort;
    if (Number.isInteger(d.lowStockThreshold) && d.lowStockThreshold >= 0 && d.lowStockThreshold <= 20) o.lowStockThreshold = d.lowStockThreshold;
    if (typeof d.seasonalPip === 'boolean') o.seasonalPip = d.seasonalPip;
    if (PROJECT_VIEWS.includes(d.projectsView)) o.projectsView = d.projectsView;
    if (typeof d.sessionTimer === 'boolean') o.sessionTimer = d.sessionTimer;
    const seen = new Set();
    o.recentConversions = (Array.isArray(d.recentConversions) ? d.recentConversions.slice(0, 200) : []).map(conversion).filter(x => {
      if (!x || seen.has(ck(x))) return false;
      seen.add(ck(x)); return true;
    }).slice(0, MAX_RECENT);
    return { ok: true, data: o };
  }
  function rememberConversion(current, row) {
    const p = normalize(current);
    if (!p.ok) return p;
    const c = conversion({ ...(row || {}), at: (row && row.at) || new Date().toISOString() });
    if (!c) return { ok: false, reason: 'invalid-conversion', data: p.data };
    return normalize({ ...p.data, recentConversions: [c, ...p.data.recentConversions.filter(x => ck(x) !== ck(c))] });
  }
  // Same derivation as threads.js / snapshots.js / journal.js: PFX = projectsKey minus '.v1'.
  function keyFor(projectsKey) {
    if (projectsKey !== 'flossfox.v1' && projectsKey !== 'flossfox-dev.v1') throw new TypeError('Unknown Floss Fox projects key');
    return projectsKey.replace(/\.v1$/, '') + '.atelier.v1';
  }
  const isPrefKey = k => k === 'flossfox.atelier.v1' || k === 'flossfox-dev.atelier.v1';
  function load(storage, storageKey) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw === null) return { ...normalize(null), stored: false };
      return { ...normalize(JSON.parse(raw)), stored: true };
    } catch (error) { return { ok: false, reason: 'unreadable', data: null }; }
  }
  function save(storage, storageKey, input) {
    if (!isPrefKey(storageKey)) return { ok: false, reason: 'wrong-key', data: null };
    const p = normalize(input);
    if (!p.ok) return p;
    let cur;
    try { cur = storage.getItem(storageKey); } catch (e) { return { ok: false, reason: 'storage-unavailable', data: p.data }; }
    if (cur !== null) { // fail closed: never overwrite something we cannot read or that a newer version wrote
      let parsed; try { parsed = JSON.parse(cur); } catch (e) { return { ok: false, reason: 'unreadable-existing', data: p.data }; }
      if (!normalize(parsed).ok) return { ok: false, reason: 'future-schema-existing', data: p.data };
    }
    try {
      const str = JSON.stringify(p.data);
      storage.setItem(storageKey, str);
      if (storage.getItem(storageKey) !== str) return { ok: false, reason: 'unverified-save', data: p.data };
      return p;
    } catch (error) { return { ok: false, reason: 'storage-unavailable', data: p.data }; }
  }
  // Explicit "Reset appearance and experience settings": removes ONLY the preference key, verified.
  function reset(storage, storageKey) {
    if (!isPrefKey(storageKey)) return { ok: false, reason: 'wrong-key' };
    try { storage.removeItem(storageKey); return storage.getItem(storageKey) === null ? { ok: true } : { ok: false, reason: 'unverified-reset' }; }
    catch (e) { return { ok: false, reason: 'storage-unavailable' }; }
  }
  return Object.freeze({ SCHEMA, DEFAULT, THEMES, PROJECT_VIEWS, TABS, VIEWS, SORTS, BRANDS, MAX_RECENT, normalize, rememberConversion, keyFor, isPrefKey, load, save, reset });
});
