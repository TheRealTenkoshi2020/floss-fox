/* Floss Fox 3.9 Atelier: stable project color-strip data, read-only (adapted from Samira's reference).
   Project item codes are DMC codes (projects.js). RGB comes from the DMC catalog hex in index.html when given, and is
   only an approximate screen picture: the brand + code text is always what identifies the thread.
   BLANC, WHITE and B5200 stay separate entries even though their catalog hex values are identical. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlossFoxAtelierPalette = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COLOR = /^#[0-9a-fA-F]{6}$/;
  const NOTE = 'Thread colors shown on screen are approximate.';
  // Relative luminance (WCAG); very light or very dark swatches get an outline so they stay visible on any theme.
  function lum(hex) {
    const ch = i => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
  }
  function rgbFrom(source, c) {
    if (!source || typeof source !== 'object') return null;
    const v = Object.prototype.hasOwnProperty.call(source, c) ? source[c] : undefined;
    const hex = typeof v === 'string' ? v : v && typeof v === 'object' ? v.hex : null; // accepts {CODE:'#hex'} or the DMC catalog {CODE:{hex}}
    return typeof hex === 'string' && COLOR.test(hex) ? hex.toLowerCase() : null;
  }
  function strip(projectItems, rgbSource = {}, limit = 6) {
    if (!Array.isArray(projectItems)) throw new TypeError('Expected project items');
    const max = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 12) : 6;
    const seen = new Set(), codes = [];
    for (const item of projectItems) {
      const code = typeof (item && item.code) === 'string' ? item.code.trim().toUpperCase() : '';
      if (!code || !/^[A-Z0-9-]{1,35}$/.test(code) || seen.has(code)) continue;
      seen.add(code); codes.push(code);
    }
    const picks = codes.length <= max ? codes : Array.from({ length: max }, (_, i) => codes[Math.floor(i * (codes.length - 1) / (max - 1 || 1))]);
    return {
      swatches: picks.map(code => { const rgb = rgbFrom(rgbSource, code), L = rgb ? lum(rgb) : null; return { brand: 'DMC', code, label: `DMC ${code}`, rgb, approximate: true, outline: rgb === null || L > 0.8 || L < 0.02 }; }),
      total: codes.length, remaining: Math.max(0, codes.length - picks.length), note: NOTE
    };
  }
  return Object.freeze({ strip, NOTE });
});
