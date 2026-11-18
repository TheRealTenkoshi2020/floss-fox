/* Floss Fox optional support links (DEV PREVIEW, 3.9 monetization).
   Adapted from the Monetization Launch Kit reference (support-links.js), with fixes.

   THE ONE PLACE TO CONFIGURE: SUPPORT_URL and PACK_URL below.
   Both are EMPTY on purpose. While a URL is empty or fails the checks, its link is not shown,
   and if both are empty nothing at all appears (no section, no footer link, no dead button).
   Paste ONLY the exact URLs Myke has verified with a real checkout:
     SUPPORT_URL: his Ko-fi page, e.g. https://ko-fi.com/<his-page>
     PACK_URL:    the Ko-fi shop item for the $7 printable, e.g. https://ko-fi.com/s/<item-id>
   (A Stripe Payment Link https://buy.stripe.com/<id> is also accepted.)

   Safety rules this file keeps:
   - Plain links only. No payment-provider scripts, iframes, widgets, cookies or pop-ups.
   - Exact host allowlist (ko-fi.com, buy.stripe.com). https only, no port, no user:password,
     a real path, and NO query string or #fragment (so no tracking or prefill parameters can ride along).
   - The URL is used exactly as configured. Nothing from projects, threads, notes or storage is added.
   - Never reads or writes localStorage/sessionStorage. No analytics events.
   - Never shows a payment success. The provider confirms purchases, not Floss Fox.
   - Offline: says the links need internet; a tap while offline shows that message instead of opening a dead tab. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxSupport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // ===== Configuration (owner-verified URLs only; leave empty to hide) =====
  var SUPPORT_URL = '';
  var PACK_URL = '';
  var PACK_PRICE = '$7';
  // ==========================================================================

  // Exact hostnames only. No subdomain wildcards. Adding a provider is a code change plus review.
  var PROVIDERS = { 'ko-fi.com': 'Ko-fi', 'buy.stripe.com': 'Stripe' };

  // ALL user-facing strings live here and nowhere else.
  // STATUS: DEV DRAFT PENDING MYKE. Verbatim from Pixel's /workspace/pip-art/atelier39/copy/SUPPORT.md
  // (copy.json keys support.*). No provider is named on purpose (support.external, not support.external.kofi).
  var COPY = {
    title: "Keep Pip's lantern glowing",                                   // support.title
    intro: 'Floss Fox is free, and your projects and threads stay on this device. If it has helped your stitching, you can leave a tip or get our printable companion for your craft table.', // support.intro
    tip: 'Support Floss Fox',                                              // support.btn.tip
    pack: function (price) { return 'Buy the printable \u00b7 ' + price; },  // support.btn.pack
    packDetail: function (price) { return 'The Stitching Atelier Printable Companion: a 16-page US Letter PDF to print at home. ' + price + ', one time.'; }, // support.pack.detail
    external: function (n) {                                               // support.external.text.one / .other
      return n === 1 ? 'This link opens an external checkout in a new tab and needs an internet connection.'
        : 'These links open an external checkout in a new tab and need an internet connection.';
    },
    offline: "You're offline. Tips and the printable need an internet connection. Everything else in Floss Fox works as usual.", // support.offline
    noteFree: "Floss Fox stays free. Supporting is optional and doesn't change your projects or thread collection.", // support.note.free
    notePayment: 'Payment and the PDF download are handled by the checkout provider. We never see your card details.', // support.note.payment
    footer: 'Support Floss Fox',                                           // support.footer
    privacyTitle: 'Tips and the printable companion',                     // privacy.support.title (About mount only)
    privacy: [
      'Your projects and thread collection stay in this browser on this device. Opening a support link sends none of them.', // privacy.support.local
      'If you leave a tip or buy the printable, you pay on an external checkout site. That provider may collect information about you as a buyer and share some of it with us, under its own privacy policy. We never receive your card details.', // privacy.support.provider
      "Tips support a creative software project. They aren't charitable donations and aren't tax deductible." // privacy.support.tax
    ],
    ariaTip: 'Support Floss Fox (opens external checkout)',
    ariaPack: function (price) { return 'Buy the Stitching Atelier Printable Companion, ' + price + ' (opens external checkout)'; }
  };

  function safeCheckoutUrl(raw) {
    if (typeof raw !== 'string') return null;
    var t = raw.trim();
    if (!t || t.length > 2048 || /\s/.test(t)) return null;
    var u;
    try { u = new URL(t); } catch (_) { return null; }
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    var host = u.hostname.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PROVIDERS, host)) return null;
    if (u.search || u.hash || t.indexOf('?') >= 0 || t.indexOf('#') >= 0) return null; // no tracking/prefill params
    if (!u.pathname || u.pathname === '/' || u.pathname.length < 2) return null; // bare homepage is not a checkout
    return u.href;
  }

  function providerName(href) {
    try { return PROVIDERS[new URL(href).hostname.toLowerCase()] || ''; } catch (_) { return ''; }
  }

  function safePrice(p) {
    return typeof p === 'string' && /^\$\d{1,3}(?:\.\d{2})?$/.test(p) ? p : '$7';
  }

  function joinNames(list) {
    var u = list.filter(function (n, i) { return n && list.indexOf(n) === i; });
    return u.length > 1 ? u.slice(0, -1).join(', ') + ' or ' + u[u.length - 1] : (u[0] || 'the provider');
  }

  function viewModel(config) {
    config = config && typeof config === 'object' ? config : {};
    var support = safeCheckoutUrl(config.supportUrl);
    var pack = safeCheckoutUrl(config.packUrl);
    var price = safePrice(config.packPrice);
    var items = [];
    if (support) items.push({ kind: 'tip', href: support, label: COPY.tip, aria: COPY.ariaTip, provider: providerName(support) });
    if (pack) items.push({ kind: 'pack', href: pack, label: COPY.pack(price), aria: COPY.ariaPack(price), detail: COPY.packDetail(price), provider: providerName(pack) });
    var names = joinNames(items.map(function (i) { return i.provider; }));
    return {
      show: items.length > 0,
      support: items.filter(function (i) { return i.kind === 'tip'; })[0] || null,
      pack: items.filter(function (i) { return i.kind === 'pack'; })[0] || null,
      items: items,
      providers: names,
      note: COPY.noteFree
    };
  }

  // Config in use: the constants above. Tests may set window.__FF_SUPPORT_TEST before load
  // (same pattern as review.js); it still goes through every check above.
  function currentConfig() {
    var o = root && root.__FF_SUPPORT_TEST;
    if (o && typeof o === 'object') return { supportUrl: o.supportUrl, packUrl: o.packUrl, packPrice: PACK_PRICE };
    return { supportUrl: SUPPORT_URL, packUrl: PACK_URL, packPrice: PACK_PRICE };
  }

  function isOffline(win) {
    try { return !!(win && win.navigator && win.navigator.onLine === false); } catch (_) { return false; }
  }

  // Renders one support section into host. `name` makes ids unique per mount (e.g. "settings", "about").
  function render(host, config, doc, name) {
    if (!host || !doc || typeof doc.createElement !== 'function') return false;
    var v = viewModel(config);
    if (!v.show) { if (host.replaceChildren) host.replaceChildren(); return false; }
    var slug = String(name || 'main').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'main';
    var win = doc.defaultView || null;
    var section = doc.createElement('section');
    section.className = 'ff-support';
    section.id = 'ffSupport-' + slug;
    section.setAttribute('aria-labelledby', 'ffSupportTitle-' + slug);
    var h = doc.createElement('h3'); h.id = 'ffSupportTitle-' + slug; h.textContent = COPY.title;
    var intro = doc.createElement('p'); intro.textContent = COPY.intro;
    var links = doc.createElement('div'); links.className = 'ff-support-links';
    var status = doc.createElement('p'); status.className = 'ff-support-offline'; status.id = 'ffSupportOffline-' + slug;
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    var ext = doc.createElement('p'); ext.className = 'ff-support-external'; ext.textContent = COPY.external(v.items.length);
    var anchors = [];
    v.items.forEach(function (it) {
      var wrap = doc.createElement('div'); wrap.className = 'ff-support-item';
      var a = doc.createElement('a');
      a.href = it.href; a.textContent = it.label;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.referrerPolicy = 'no-referrer';
      a.className = 'ff-support-link ff-support-' + it.kind;
      a.setAttribute('data-kind', it.kind);
      a.setAttribute('aria-label', it.aria);
      a.addEventListener('click', function (e) { if (isOffline(win)) { e.preventDefault(); sync(); } });
      wrap.appendChild(a);
      if (it.detail) {
        var d = doc.createElement('p'); d.className = 'ff-support-detail'; d.id = 'ffSupportPackDetail-' + slug; d.textContent = it.detail;
        a.setAttribute('aria-describedby', d.id); wrap.appendChild(d);
      }
      anchors.push(a); links.appendChild(wrap);
    });
    var free = doc.createElement('p'); free.className = 'ff-support-note'; free.textContent = COPY.noteFree;
    var pay = doc.createElement('p'); pay.className = 'ff-support-note'; pay.textContent = COPY.notePayment;
    // Offline: show support.offline instead of support.external and disable the links (no dead tab, no fake success).
    function sync() {
      var off = isOffline(win);
      status.textContent = off ? COPY.offline : '';
      ext.hidden = off;
      anchors.forEach(function (a) {
        if (off) { a.setAttribute('aria-disabled', 'true'); a.classList.add('is-offline'); }
        else { a.removeAttribute('aria-disabled'); a.classList.remove('is-offline'); }
      });
    }
    sync();
    if (win && win.addEventListener) {
      if (host.__ffSupportSync) { win.removeEventListener('online', host.__ffSupportSync); win.removeEventListener('offline', host.__ffSupportSync); }
      host.__ffSupportSync = sync;
      win.addEventListener('online', sync); win.addEventListener('offline', sync);
    }
    section.append(h, intro, links, ext, status, free, pay);
    if (slug === 'about') { // About also carries the three Privacy points (same text as privacy.html#support)
      var ph = doc.createElement('h4'); ph.className = 'ff-support-ptitle'; ph.textContent = COPY.privacyTitle;
      var ul = doc.createElement('ul'); ul.className = 'ff-support-privacy';
      COPY.privacy.forEach(function (t) { var li = doc.createElement('li'); li.textContent = t; ul.appendChild(li); });
      section.append(ph, ul);
    }
    host.replaceChildren(section);
    return true;
  }

  // Footer: one small in-app link that scrolls to the support section (Settings on the app page,
  // About#support otherwise). Never straight to checkout, so the external-checkout notice is always seen first.
  function renderFooter(doc, config, href) {
    var old = doc.getElementById('ffSupportFooter'); if (old) old.remove();
    if (!viewModel(config).show) return false;
    var foot = doc.querySelector('footer .footlinks');
    if (!foot) return false;
    var span = doc.createElement('span'); span.id = 'ffSupportFooter';
    span.appendChild(doc.createTextNode(' \u00b7 '));
    var a = doc.createElement('a'); a.href = href || 'about.html#support'; a.textContent = COPY.footer;
    a.addEventListener('click', function (e) {
      var tab = doc.getElementById('tabSettings');
      if (!tab || !doc.querySelector('[data-ff-support-mount="settings"]')) return; // no in-page section: go to About#support
      e.preventDefault(); tab.click();
      // The tab switch scrolls to the top (smoothly); jump after it, instantly, so the two scrolls don't fight.
      var go = function () {
        var sec = doc.getElementById('ffSupport-settings'), h = doc.getElementById('ffSupportTitle-settings');
        if (sec) { try { sec.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (_) { sec.scrollIntoView(); } }
        if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (_) {} }
      };
      var w = doc.defaultView;
      if (w && w.requestAnimationFrame) w.requestAnimationFrame(function () { w.requestAnimationFrame(go); }); else go();
    });
    span.appendChild(a);
    // Sit right after "Backup and settings" (before the closing privacy sentence) when present.
    var after = foot.querySelector('.ffsettingslink');
    if (after && after.parentNode === foot) foot.insertBefore(span, after.nextSibling);
    else foot.appendChild(span);
    return true;
  }

  function mountAll() {
    if (typeof document === 'undefined') return;
    var cfg = currentConfig();
    // Settings: create the mount at the end of the Settings card (no edit to the big Settings markup line,
    // which keeps merges with other 3.9 branches clean). Removed again if nothing is configured.
    var sc = document.querySelector('#settingsView .card');
    var sm = document.querySelector('[data-ff-support-mount="settings"]');
    if (sc && !sm && viewModel(cfg).show) {
      sm = document.createElement('div'); sm.setAttribute('data-ff-support-mount', 'settings'); sc.appendChild(sm);
    }
    var nodes = document.querySelectorAll('[data-ff-support-mount]');
    for (var i = 0; i < nodes.length; i++) {
      var shown = render(nodes[i], cfg, document, nodes[i].getAttribute('data-ff-support-mount'));
      if (!shown && nodes[i].getAttribute('data-ff-support-mount') === 'settings') nodes[i].remove();
    }
    renderFooter(document, cfg);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
    else mountAll();
  }

  return Object.freeze({
    safeCheckoutUrl: safeCheckoutUrl, viewModel: viewModel, render: render, renderFooter: renderFooter,
    mount: mountAll, config: currentConfig, PROVIDERS: Object.freeze(Object.assign({}, PROVIDERS)), COPY: COPY
  });
});
