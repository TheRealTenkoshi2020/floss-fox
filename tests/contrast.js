// Returns text elements whose contrast is below WCAG AA (4.5:1, or 3:1 for large text). Used by regression.py.
(() => {
  const P = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const L = c => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = P(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) b = blend(stack[i], b); return b; };
  const out = []; let min = 99, n = 0;
  document.querySelectorAll('body *').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const own = [...el.childNodes].some(t => t.nodeType === 3 && t.textContent.trim()); if (!own) return;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) return;
    if (el.closest('.sr') || el.disabled || el.closest('[aria-hidden=true]')) return;
    const fg = P(cs.color); if (!fg) return; const bg = bgOf(el); const f = blend(fg, bg);
    const a = L(f), b = L(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (bold && size >= 18.66);
    n++; min = Math.min(min, ratio);
    if (ratio < (large ? 3 : 4.5)) out.push({ text: el.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2), color: cs.color, size });
  });
  return { checked: n, min: +min.toFixed(2), fails: out.slice(0, 20) };
})()
