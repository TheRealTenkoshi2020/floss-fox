/* Floss Fox 3.9 Atelier Stage D: apply the chosen appearance.
   Sets <html data-atelier-theme> and data-atelier-scheme, theme-color, and Pip art.
   Never writes storage: the Settings UI saves the preference key through FlossFoxAtelierPreferences. */
(function (root) {
  'use strict';
  const THEMES = ['system', 'morning', 'forest', 'moon'];
  const COLOR = { morning: '#faf6ee', forest: '#10201b', moon: '#141a2e' }; // Pixel TOKENS.md
  function schemeOf(theme) {
    if (theme === 'morning') return 'light';
    if (theme === 'forest' || theme === 'moon') return 'dark';
    return (root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function syncPipArt(scheme) {
    const dark = scheme === 'dark';
    const docs = typeof document !== 'undefined' ? document : null;
    if (!docs) return;
    docs.querySelectorAll('[data-atelier-darksrc]:not(#pipSrcDark)').forEach(el => { el.media = dark ? 'all' : 'not all'; });
    if (root.FlossFoxPip && typeof root.FlossFoxPip.retheme === 'function') root.FlossFoxPip.retheme();
  }
  function apply(theme) {
    if (THEMES.indexOf(theme) < 0) theme = 'system';
    const scheme = schemeOf(theme);
    const h = document.documentElement;
    h.setAttribute('data-atelier-theme', theme);
    h.setAttribute('data-atelier-scheme', scheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = COLOR[theme] || (scheme === 'dark' ? COLOR.forest : COLOR.morning);
    syncPipArt(scheme);
    try { document.dispatchEvent(new CustomEvent('ff:atelier-theme', { detail: { theme, scheme } })); } catch (e) {}
    return { theme, scheme };
  }
  function current() {
    const h = document.documentElement;
    const theme = h.getAttribute('data-atelier-theme') || 'system';
    return { theme: THEMES.indexOf(theme) < 0 ? 'system' : theme, scheme: h.getAttribute('data-atelier-scheme') || schemeOf(theme) };
  }
  if (typeof document !== 'undefined') {
    // Re-apply from the boot attributes (already set) so Pip sources match, then watch the OS when System is on.
    syncPipArt(current().scheme);
    if (root.matchMedia) {
      const mq = root.matchMedia('(prefers-color-scheme: dark)');
      const on = () => { if (current().theme === 'system') apply('system'); };
      if (mq.addEventListener) mq.addEventListener('change', on);
      else if (mq.addListener) mq.addListener(on);
    }
  }
  root.FlossFoxAtelierTheme = Object.freeze({ THEMES, COLOR, schemeOf, apply, current, syncPipArt });
})(typeof window !== 'undefined' ? window : globalThis);
