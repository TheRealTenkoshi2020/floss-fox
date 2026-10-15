/* Floss Fox 2.0A: static, untracked, test-site-only DMC skein destinations.
 * DO NOT import into production. This is NOT an affiliate integration.
 * Every "exact" URL comes from the curated product manifest; never generate IDs/slugs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FlossFoxSkeinPreview = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const LAST_CHECKED = '2026-10-14';
  const PRODUCTS = Object.freeze({
    hobbylobby: Object.freeze({
      '310': 'https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/310-black--dmc-mouline-grays-embroidery-floss/p/106215'
    }),
    everythingcrossstitch: Object.freeze({
      '301':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-mahogany--mrp-p546.aspx',
      '3012':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-khaki-gr--mrp-p820.aspx',
      '321':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-xmas-red-mrp-p559.aspx',
      '3854':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-md-aut-gl-mrp-p955.aspx',
      '3863':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-md-moch-b-mrp-p964.aspx',
      '3865':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-wintr-whi-mrp-p966.aspx',
      '517':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-wedgewd-m-mrp-p612.aspx',
      '746':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-off-white-mrp-p686.aspx',
      '831':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-olv-grn-m-mrp-p734.aspx',
      '839':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-bge-brn-d-mrp-p739.aspx',
      '951':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-flesh-mrp-p790.aspx',
      '989':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-forest-gr-mrp-p813.aspx',
      '995':'https://www.everythingcrossstitch.com/floss-embroidery-dmc-elctrc-b--mrp-p817.aspx'
    })
  });
  const STORES = Object.freeze([
    Object.freeze({ id:'hobbylobby', name:'Hobby Lobby', host:'www.hobbylobby.com',
      fallback:'https://www.hobbylobby.com/yarn-needle-art/cross-stitch/floss-thread/c/5-127-1109',
      help:'Browse cotton embroidery floss and locate the stated DMC color.' }),
    Object.freeze({ id:'everythingcrossstitch', name:'Everything Cross Stitch', host:'www.everythingcrossstitch.com',
      fallback:'https://www.everythingcrossstitch.com/dmc-cotton-cross-stitch-floss-mrl-c274.aspx',
      help:'Use the DMC cotton color catalog or Quick Order quantities to find your number.' })
  ]);
  function validUrl(url, host) {
    try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === host && !u.username && !u.password; }
    catch (_) { return false; }
  }
  function normalize(code) {
    if (typeof code !== 'string' && typeof code !== 'number') return null;
    const c = String(code).trim().toUpperCase();
    // Preserve 01-09 as 2-digit codes. Do not turn 0310 into 310 silently.
    if (!/^(?:0[1-9]|[1-9][0-9]{0,3})$/.test(c)) return null;
    return Number(c) <= 3866 ? c : null;
  }
  function eligible(n, env) {
    if ((env !== 'preview' && env !== 'direct') || !n || n.brand !== 'dmc' || n.family !== 'six-strand-cotton') return false;
    if (n.pack && n.pack !== 'single-skein') return false;
    if (n.disputed || n.assumed || n.substitutionUnapproved) return false;
    if (!Number.isSafeInteger(n.qty) || n.qty < 1 || n.qty > 9999) return false;
    return !!normalize(n.code);
  }
  function linksFor(n, env) {
    if (!eligible(n,env)) return [];
    const code=normalize(n.code);
    return STORES.map(s => {
      const exact = PRODUCTS[s.id][code];
      const direct = !!exact && validUrl(exact, s.host);
      const url = direct ? exact : s.fallback;
      if (!validUrl(url,s.host)) return null;
      return Object.freeze({storeId:s.id, storeName:s.name, code, url,
        type:direct?'exact-product':'catalog', exact:direct, untracked:true, tracked:false, kind:'direct',
        label:(direct?'View DMC '+code+' skein':'Find DMC '+code+' in catalog')+' at '+s.name,
        hint:direct?'Individual DMC 6-strand cotton listing; confirm options and availability at store.':s.help,
        identityChecked:direct?LAST_CHECKED:null});
    }).filter(Boolean);
  }
  function rowsFor(needs, env) {
    if (!Array.isArray(needs)) return [];
    const candidates=needs.filter(n=>eligible(n,env));
    const counts=new Map();
    for(const n of candidates){const c=normalize(n.code);counts.set(c,(counts.get(c)||0)+1)}
    // Duplicate colors are a planner-data error: WITHHOLD the code instead of
    // silently taking the first quantity or subtracting inventory twice.
    return candidates.filter(n=>counts.get(normalize(n.code))===1)
      .map(n=>Object.freeze({code:normalize(n.code),qty:n.qty,links:linksFor(n,env)}));
  }
  return Object.freeze({linksFor,rowsFor,eligible,normalize,validUrl,LAST_CHECKED});
});
