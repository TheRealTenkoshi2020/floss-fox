/* Floss Fox 3.9 Atelier: seasonal Greeting Pip choice (FF39-22). Pure, no DOM, no network, no storage.
   Mapping approved by Myke (relayed via Pixel, dev only). Seasonal art replaces ONLY the resting Greeting art; event poses,
   errors, restore, onboarding, icons never change. Uses the DEVICE'S LOCAL date. Moments (New Year, World Embroidery Day)
   win over the season. Art is not made yet: callers must fall back to standard Pip when an image is missing or fails.
   Hemisphere: 'north' default; 'south' shifts the four seasons by six months (pending Myke, Pixel plan question 2). */
(function (root) {
  'use strict';
  const KEYS = ['spring', 'summer', 'autumn', 'winter', 'newyear', 'embroidery-day'];
  const BASE = 'pip-greeting-';
  const NORTH = { 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'autumn', 10: 'autumn', 11: 'autumn', 12: 'winter', 1: 'winter', 2: 'winter' };
  const FLIP = { spring: 'autumn', autumn: 'spring', summer: 'winter', winter: 'summer' };
  function md(d) { if (!(d instanceof Date) || isNaN(d.getTime())) return null; return { m: d.getMonth() + 1, day: d.getDate() }; }
  // Returns one of KEYS for a local Date, or null for an invalid date.
  function pick(date, opts) {
    const x = md(date); if (!x) return null;
    const { m, day } = x;
    if ((m === 12 && day === 31) || (m === 1 && day <= 2)) return 'newyear';
    if (m === 7 && day >= 29 && day <= 31) return 'embroidery-day';
    const s = NORTH[m];
    return opts && opts.hemisphere === 'south' ? FLIP[s] : s;
  }
  // Only when the user turned seasonal on AND Pip is visible. Returns { key, base } or null (= standard Pip).
  function choose(date, opts) {
    opts = opts || {};
    if (opts.seasonalPip !== true) return null;
    if (opts.pipLevel === 'off' || opts.pipLevel === 'quiet') return null;
    const key = pick(date, opts); if (!key) return null;
    if (Array.isArray(opts.available) && !opts.available.includes(key)) return null; // art not shipped yet
    return { key, base: BASE + key };
  }
  // Resting poses that may be swapped (per Pixel's plan: REST in pip.js and the landing/bar greeting).
  const RESTING = ['greeting', 'greeting-alt', 'neutral'];
  const swappable = pose => RESTING.includes(String(pose));
  const api = Object.freeze({ KEYS, RESTING, pick, choose, swappable });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.FlossFoxSeasonal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
