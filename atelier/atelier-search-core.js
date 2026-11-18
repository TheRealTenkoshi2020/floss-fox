/* Floss Fox 3.9 Atelier: pure, read-only local search (adapted from Samira's reference).
   UMD: browser window.FlossFoxAtelierSearch / Node require(). No storage, no network, no analytics, no DOM.
   Callers pass CURRENT state each time they (re)build: FlossFoxProjects._store().projects, FlossFoxThreadsUI.data().threads
   (never the demo map), and the DMC catalog object from index.html ({CODE:{hex,name,anchor:[...]}}).
   - DMC BLANC, WHITE and B5200 are separate rows with separate keys (DMC:BLANC, DMC:WHITE, DMC:B5200).
   - Anchor rows come only from the catalog's own anchor lists (no invented brand lookups); they point back to the DMC codes.
   - Projects are indexed by title and palette codes only (not notes or Where I left off). Demo projects are skipped.
   - Thread rows show whole skeins and "partial" as a yes/no flag only (partial is a boolean in threads.js). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxAtelierSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STATUS = Object.freeze({ planning: 'Planning', ready: 'Ready to stitch', progress: 'In progress', done: 'Completed' }); // projects.js PSTAT
  const canon = s => String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
  const code = s => String(s == null ? '' : s).trim().toUpperCase();
  const okCode = s => /^[A-Z0-9-]{1,35}$/.test(s);
  const valid = s => typeof s === 'string' && s.trim().length > 0;
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const displayLocation = s => s && typeof s === 'object' && !Array.isArray(s) ? [s.container, s.slot, s.medium].filter(valid).map(x => x.trim()).join(' · ').slice(0, 160) : '';
  // DMC catalog object -> color rows. Anchor rows only from the catalog's own anchor lists.
  function catalogRows(catalog) {
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return [];
    const rows = [], anchor = new Map();
    for (const raw of Object.keys(catalog)) {
      const c = code(raw), e = catalog[raw];
      if (!okCode(c) || !e || typeof e !== 'object') continue;
      rows.push({ brand: 'DMC', code: c, name: valid(e.name) ? e.name : '', dmc: [c] });
      for (const a of Array.isArray(e.anchor) ? e.anchor : []) {
        const ac = code(a); if (!okCode(ac)) continue;
        if (!anchor.has(ac)) anchor.set(ac, []);
        if (!anchor.get(ac).includes(c)) anchor.get(ac).push(c);
      }
    }
    for (const [ac, dmc] of anchor) rows.push({ brand: 'Anchor', code: ac, name: '', dmc });
    return rows;
  }
  function build({ projects = [], threads = {}, colors = [], catalog = null } = {}) {
    if (!Array.isArray(projects) || !Array.isArray(colors)) throw new TypeError('Invalid search source');
    if (!threads || typeof threads !== 'object' || Array.isArray(threads)) throw new TypeError('Invalid thread collection');
    const t = own(threads, 'threads') && threads.threads && typeof threads.threads === 'object' ? threads.threads : threads;
    const out = [], seenColor = new Set(), seenProject = new Set();
    for (const p of projects) {
      if (!p || p.demo === true || !valid(p.id) || !valid(p.name) || seenProject.has(p.id)) continue;
      seenProject.add(p.id);
      const codes = [...new Set((Array.isArray(p.items) ? p.items : []).map(i => code(i && i.code)).filter(okCode))];
      const subtitle = `${STATUS[p.status] || STATUS.planning} · ${codes.length} color${codes.length === 1 ? '' : 's'}`;
      out.push({ type: 'project', key: p.id, label: p.name.trim().slice(0, 100), subtitle, terms: canon(`${p.name} ${codes.join(' ')}`), exactCode: '' });
    }
    for (const raw of Object.keys(t)) {
      const c = code(raw), entry = t[raw];
      if (!okCode(c) || !entry || typeof entry !== 'object') continue;
      const loc = displayLocation(entry.storage);
      const n = Number.isInteger(entry.n) && entry.n >= 0 ? entry.n : 0;
      out.push({ type: 'thread', key: `DMC:${c}`, label: `DMC ${c}`, subtitle: `${n} full skein${n === 1 ? '' : 's'}${entry.partial === true ? ' + a partial skein' : ''}${loc ? ` · ${loc}` : ''}`, terms: canon(`DMC ${c} ${loc}`), exactCode: c, location: loc });
    }
    for (const row of colors.concat(catalogRows(catalog))) {
      if (!row) continue;
      const c = code(row.code); if (!okCode(c)) continue;
      const brand = valid(row.brand) ? row.brand.trim() : 'DMC';
      const k = `${brand.toUpperCase()}:${c}`;
      if (seenColor.has(k)) continue;
      seenColor.add(k);
      const name = valid(row.name) ? row.name.trim().slice(0, 120) : '';
      const dmc = Array.isArray(row.dmc) ? row.dmc.filter(x => okCode(code(x))).map(code).slice(0, 12) : [];
      const sub = brand.toUpperCase() === 'DMC' ? name : (dmc.length ? `Listed for DMC ${dmc.slice(0, 3).join(', ')}${dmc.length > 3 ? ` +${dmc.length - 3}` : ''}` : name);
      out.push({ type: 'color', key: k, label: `${brand} ${c}`, subtitle: sub, terms: canon(`${brand} ${c} ${name}`), exactCode: c, brand, dmc });
    }
    return out;
  }
  function search(index, rawQuery, options = {}) {
    if (!Array.isArray(index)) throw new TypeError('Index must be an array');
    const q = canon(String(rawQuery == null ? '' : rawQuery).slice(0, 120));
    const empty = { projects: [], threads: [], colors: [], total: 0, query: q };
    if (!q) return empty;
    const tokens = q.split(' ').filter(Boolean), limit = Number.isInteger(options.limit) && options.limit >= 1 ? Math.min(30, options.limit) : 8;
    const ranked = [];
    for (const row of index) {
      if (!row || !['project', 'thread', 'color'].includes(row.type)) continue;
      const name = canon(row.label), ec = canon(row.exactCode), hay = `${name} ${row.terms || ''} ${canon(row.subtitle)}`;
      if (!tokens.every(x => hay.includes(x))) continue;
      const exact = (ec && ec === q) || name === q;
      const prefix = name.startsWith(q) || (ec && ec.startsWith(q)) || (tokens.length > 1 && name.startsWith(tokens[0]) && ec && ec.startsWith(tokens[tokens.length - 1]));
      ranked.push({ row, rank: exact ? 0 : prefix ? 1 : 2 });
    }
    const dmcFirst = r => r.type === 'color' && String(r.brand || 'DMC').toUpperCase() !== 'DMC' ? 1 : 0; // bare codes are DMC codes in Floss Fox
    ranked.sort((a, b) => a.rank - b.rank || dmcFirst(a.row) - dmcFirst(b.row) || a.row.label.localeCompare(b.row.label, undefined, { numeric: true }) || a.row.key.localeCompare(b.row.key));
    // DMC BLANC, WHITE and B5200 are three different colors. When any one of them matches, show all three together right after
    // the first match, the others marked as siblings so the "3 different colors" note is visible, never merged or hidden.
    const WHITES = ['DMC:WHITE', 'DMC:BLANC', 'DMC:B5200'];
    const wi = ranked.findIndex(r => r.row.type === 'color' && WHITES.includes(r.row.key));
    if (wi >= 0) {
      const first = ranked[wi].row;
      const sib = WHITES.filter(k => k !== first.key).map(k => { const hit = ranked.find(r => r.row.key === k && r.row.type === 'color'); const base = hit ? hit.row : index.find(r => r && r.type === 'color' && r.key === k); return base ? { row: { ...base, whiteSibling: first.exactCode } } : null; }).filter(Boolean);
      const rest = ranked.filter(r => !(r.row.type === 'color' && WHITES.includes(r.row.key)));
      const at = rest.findIndex(r => r.row.type === 'color'), ins = at < 0 ? rest.length : at;
      rest.splice(ins, 0, { row: first }, ...sib);
      ranked.length = 0; ranked.push(...rest);
    }
    const out = { ...empty, total: ranked.length };
    for (const { row } of ranked) {
      const bucket = row.type === 'project' ? out.projects : row.type === 'thread' ? out.threads : out.colors;
      if (bucket.length < limit) bucket.push({ ...row });
    }
    return out;
  }
  return Object.freeze({ STATUS, build, search, displayLocation, catalogRows, canon });
});
