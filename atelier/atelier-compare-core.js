/* Floss Fox 3.9 Atelier: read-only chart-match classification (FF39-09).
   Maps existing resolve() provenance onto exact / close / estimated labels.
   BLANC, WHITE and B5200 are never treated as substitutes for each other.
   Pure UMD: no DOM, no storage, no writes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxAtelierCompare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WHITES = Object.freeze(['BLANC', 'WHITE', 'B5200']);
  const WHITE = new Set(WHITES);
  const KINDS = Object.freeze(['exact', 'close', 'estimated']);
  const isWhite = code => WHITE.has(String(code || '').toUpperCase());
  const norm = code => typeof code === 'string' ? code.trim().toUpperCase() : '';
  // A published official 1:1 listing (Sullivans official chart, or the DMC source itself) is an exact chart match.
  // A single Anchor chart pairing is the nearest listed match, not exact. Multiple options or a manual pick are estimates.
  function classify(prov) {
    const p = String(prov || '');
    if (p === 'original' || p === 'official chart') return 'exact';
    if (p === 'chart' || /^chart option 1 of /.test(p)) return 'close';
    return 'estimated';
  }
  function allowedMatch(fromCode, toCode, toBrand) {
    const a = norm(fromCode), b = norm(toCode);
    if (!a || !b) return false;
    // Cross-white aliases are never allowed, even if a chart or a typo would say so.
    if (isWhite(a) && isWhite(b) && a !== b) return false;
    if ((toBrand || 'dmc').toLowerCase() === 'dmc' && isWhite(a) && isWhite(b) && a !== b) return false;
    return true;
  }
  function labelKey(kind) {
    return kind === 'exact' ? 'studio.match.exact' : kind === 'close' ? 'studio.match.near' : 'studio.match.est';
  }
  function whyKey(kind) {
    return kind === 'exact' ? 'studio.why.exact' : kind === 'close' ? 'studio.why.close' : 'studio.why.est';
  }
  // dest is the brand being converted to. source is always DMC in this app.
  function matchesFor(code, dest, charts, pick) {
    const c = norm(code);
    const d = String(dest || 'dmc').toLowerCase();
    const out = [];
    if (!c) return out;
    if (d === 'dmc') {
      out.push({ brand: 'DMC', code: c, prov: 'original', kind: 'exact', allowed: true, source: true });
      return out;
    }
    if (d === 'sullivans') {
      const to = charts && charts.sullivans && charts.sullivans[c];
      if (to) {
        const ok = allowedMatch(c, String(to), 'sullivans');
        // The official Sullivans chart maps both BLANC and WHITE to 45001. Those three whites stay separate colors, so a shared listing is an estimate, never an exact match.
        const disputed = isWhite(c);
        if (ok) out.push({ brand: 'Sullivans', code: String(to), prov: disputed ? 'your choice (sources disagree)' : 'official chart', kind: disputed ? 'estimated' : 'exact', allowed: true });
      }
      return out;
    }
    // Anchor. Disputed whites (BLANC / WHITE / B5200) are always estimates: charts disagree, and we never treat those three as each other.
    const opts = (charts && Array.isArray(charts.anchor) ? charts.anchor : []).map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean);
    const disputed = isWhite(c);
    const chosen = pick != null && pick !== '' ? String(pick).trim() : (disputed ? '' : (opts[0] || ''));
    opts.forEach((to, i) => {
      if (!allowedMatch(c, to, 'anchor')) return;
      let prov, kind;
      if (disputed) { prov = 'your choice (sources disagree)'; kind = 'estimated'; }
      else if (opts.length === 1) { prov = 'chart'; kind = 'close'; }
      else if (!pick && i === 0) { prov = 'chart option 1 of ' + opts.length; kind = 'close'; }
      else { prov = 'your choice of chart options'; kind = 'estimated'; }
      out.push({ brand: 'Anchor', code: to, prov, kind, allowed: true, selected: !!chosen && norm(to) === norm(chosen) });
    });
    // If the only listed pairings were illegal white aliases, we emit nothing (caller shows "no chart match").
    return out;
  }
  return Object.freeze({ WHITES, KINDS, isWhite, classify, allowedMatch, labelKey, whyKey, matchesFor });
});
