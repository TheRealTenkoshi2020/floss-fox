/* Floss Fox 3.9 Atelier: canonical shopping lines with non-duplicated store grouping (adapted from Samira's reference).
   Read-only: never marks bought, never changes inventory, never opens a merchant link.
   Accepts the real FlossFoxProjects.plan(p).lines shape ({key:'dmc:310', from:['310'], to:'310', q, bought}) via linesFromPlan(),
   or the store-mode-core.js input shape ({key, to, q, bought, brand, name}). Same validation rules as store-mode-core.js:
   unique non-empty key, code <= 35 chars, whole quantity 1..9999.
   merchantLinks must already have passed shop/offers.js gatekeeping; only entries with verified:true are used, and URLs are
   never read here. One line = one checkbox, however many stores link to it. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxAtelierStoreVisit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BRAND = Object.freeze({ dmc: 'DMC', anchor: 'Anchor', sullivans: 'Sullivans' });
  // Strings: Pixel's DRAFT copy (copy.json keys in brackets), not yet approved by Myke. Do not ship to production as final.
  const COPY = Object.freeze({
    other: 'No store link: find it in any store', // [shop.group.other]
    boughtNote: "Marking a color bought doesn't change My threads. Check it in when you have it.", // [shop.boughtNote]
    header: 'Floss Fox shopping list', // [share.header]
    none: 'Nothing to buy.', // [share.none]
    footer: 'Check amounts and chart matches before you buy.', // [share.footer]
    ready: 'Ready to buy', // [share.sec.ready]
    review: 'Check first', // [share.sec.review]
    est: 'Estimated amounts' // [share.sec.est]
  });
  const WARNING = COPY.boughtNote;
  const shareLine = x => `${x.brand} ${x.code}: ${x.quantity} skein${x.quantity === 1 ? '' : 's'}`; // [share.line] one/other
  const clean = v => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  const code = v => clean(v).toUpperCase();
  const cmpCode = (a, b) => { const na = /^\d+$/.test(a), nb = /^\d+$/.test(b); if (na !== nb) return na ? -1 : 1; return na ? Number(a) - Number(b) || a.localeCompare(b) : a.localeCompare(b, 'en', { numeric: true }); };
  const cmp = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
  // plan(p) result -> input lines. dest is the project's buy brand key; codes are kept exactly (BLANC stays BLANC).
  function linesFromPlan(P, names) {
    if (!P || !Array.isArray(P.lines)) throw new TypeError('Expected a plan with lines');
    const brand = BRAND[P.dest] || 'DMC';
    return P.lines.map(l => ({ key: l && l.key, to: l && l.to, q: l && l.q, bought: !!(l && l.bought), brand, estimated: !!(l && Array.isArray(l.ts) && l.ts.some(t => t && t.estimated)), from: Array.isArray(l && l.from) ? l.from.slice(0, 50) : [], name: names && l && typeof names[l.key] === 'string' ? names[l.key] : '' }));
  }
  function build(lines, merchantLinks = [], options = {}) {
    if (!Array.isArray(lines) || !Array.isArray(merchantLinks)) throw new TypeError('Invalid shopping data');
    const filter = ['all', 'remaining', 'purchased'].includes(options.filter) ? options.filter : 'all';
    const view = options.view === 'by-store' ? 'by-store' : 'checklist';
    const query = clean(options.query).toLowerCase().slice(0, 120);
    const selected = clean(options.selectedMerchant);
    const seen = new Set(), normalized = [];
    for (const line of lines) {
      if (!line || typeof line !== 'object' || typeof line.key !== 'string' || !clean(line.key) || seen.has(line.key)) throw new TypeError('Shopping line needs unique key');
      const c = code(line.code || line.to), b = clean(line.brand || 'DMC');
      const q = line.quantity === undefined ? line.q : line.quantity;
      if (!c || c.length > 35 || !b || b.length > 35 || !Number.isInteger(q) || q < 1 || q > 9999) throw new TypeError('Invalid line');
      seen.add(line.key);
      normalized.push({ key: line.key, brand: b, code: c, quantity: q, bought: line.bought === true, name: clean(line.name).slice(0, 120) });
    }
    const byColor = new Map();
    for (const link of merchantLinks) {
      if (!link || link.verified !== true || !clean(link.merchantId) || !clean(link.code)) continue; // upstream gate is authoritative
      const k = `${code(link.brand || 'DMC')}|${code(link.code)}`;
      const x = byColor.get(k) || new Map();
      if (!x.has(link.merchantId)) x.set(link.merchantId, { id: link.merchantId, name: clean(link.merchantName || link.merchantId).slice(0, 60) });
      byColor.set(k, x);
    }
    const withStores = normalized.map(line => ({ ...line, stores: [...(byColor.get(`${line.brand.toUpperCase()}|${line.code}`) || new Map()).values()].sort((a, b) => cmp(a.name, b.name)) }));
    const filtered = withStores.filter(x => (filter === 'all' || (filter === 'purchased') === x.bought) && (!query || `${x.brand} ${x.code} ${x.name}`.toLowerCase().includes(query)));
    const groups = new Map();
    const put = (key, label, line) => { if (!groups.has(key)) groups.set(key, { key, label, items: [] }); groups.get(key).items.push(line); };
    if (view === 'by-store') {
      for (const line of filtered) {
        const possible = selected ? line.stores.find(x => x.id === selected) : line.stores[0];
        if (possible) put('m:' + possible.id, possible.name, line);
        else put('unassigned', COPY.other, line);
      }
    } else for (const line of filtered) put('checklist', 'Shopping checklist', line);
    const sorted = [...groups.values()].sort((a, b) => a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : cmp(a.label, b.label));
    for (const g of sorted) g.items.sort((a, b) => cmp(a.brand, b.brand) || cmpCode(a.code, b.code) || cmp(a.key, b.key));
    return {
      groups: sorted,
      counts: { total: normalized.length, remaining: normalized.filter(x => !x.bought).length, bought: normalized.filter(x => x.bought).length, visible: filtered.length },
      warning: WARNING, selectedMerchant: selected || null
    };
  }
  // Plain text for Share / Copy. Only brand, code and quantity: never project notes, names, storage or links.
  function shareText(lines, options = {}) {
    const v = build(lines, [], { filter: options.filter || 'remaining' });
    const all = v.groups.flatMap(g => g.items);
    const est = new Set((Array.isArray(lines) ? lines : []).filter(l => l && l.estimated === true).map(l => l.key));
    const check = (Array.isArray(options.checkFirst) ? options.checkFirst : []).map(x => clean(x).slice(0, 40)).filter(Boolean).slice(0, 200);
    const ready = all.filter(x => !est.has(x.key)), guess = all.filter(x => est.has(x.key));
    if (!guess.length && !check.length) return [COPY.header, ...all.map(shareLine), ...(all.length ? [] : [COPY.none]), COPY.footer].join('\n');
    const out = [COPY.header];
    if (ready.length) out.push('', COPY.ready, ...ready.map(shareLine));
    if (guess.length) out.push('', COPY.est, ...guess.map(shareLine));
    if (check.length) out.push('', COPY.review, ...check);
    if (!all.length) out.push('', COPY.none);
    out.push('', COPY.footer);
    return out.join('\n');
  }
  return Object.freeze({ BRAND, COPY, WARNING, linesFromPlan, build, shareText });
});
