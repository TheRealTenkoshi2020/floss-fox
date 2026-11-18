/* Floss Fox 3.9 Atelier: read-only color studio + project chart-match surface (FF39-09).
   Labels come from FlossFoxAtelierCompare + Pixel studio.* copy. No inventory or project writes. */
(function (root) {
  'use strict';
  const PH = {
    'studio.whites.title': 'The whites are not the same',
    'studio.whites.body': 'These are separate DMC colors. On screen they look alike, so check the number.',
    'studio.match.none': 'No chart match',
    'studio.dest.in': '{source} in {brand}',
    'studio.use.radio': 'Use {brand} {code}',
    'studio.recent.chip': 'DMC {code} · {brand}',
    'studio.match.legend': 'Choose a match for DMC {code}',
    'studio.swatch.none': 'No {brand} swatch available'
  };
  const $ = id => document.getElementById(id);
  const t = (k, v, n) => {
    const CP = root.FlossFoxAtelierCopy;
    if (CP && typeof CP.has === 'function' && CP.has(k) && typeof CP.t === 'function') return CP.t(k, v, n);
    const raw = PH[k];
    let out = raw && typeof raw === 'object' ? ((n === 1 ? raw.one : raw.other) || '') : String(raw || '');
    return out.replace(/\{(\w+)\}/g, (m, x) => (v && x in v) ? String(v[x]) : m);
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = () => root.FlossFoxAtelierCompare;
  const hexOf = (DMC, code) => {
    const e = DMC && DMC[code];
    return e && typeof e.hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(e.hex) ? e.hex : null;
  };
  const swatch = (hex, label) => {
    return `<span class="ffa-floss ffa-cmp-floss${hex ? '' : ' is-empty'}" style="${hex ? '--c:' + hex : ''}" role="img" aria-label="${esc(label)}"></span>`;
  };
  const kindBadge = kind => {
    const key = kind === 'exact' ? 'studio.match.exact' : kind === 'close' ? 'studio.match.close' : 'studio.match.est';
    const lab = t(key) || kind;
    return `<span class="ffa-kind ffa-kind-${kind}">${esc(lab)}</span>`;
  };
  const why = kind => {
    const key = kind === 'exact' ? 'studio.why.exact' : kind === 'close' ? 'studio.why.close' : 'studio.why.est';
    return t(key);
  };
  const brandName = d => d === 'sullivans' ? 'Sullivans' : d === 'anchor' ? 'Anchor' : 'DMC';
  const chartsOf = (DMC, SULL, code) => ({
    anchor: (DMC && DMC[code] && Array.isArray(DMC[code].anchor)) ? DMC[code].anchor : [],
    sullivans: SULL || {}
  });

  function paint(ctx) {
    const Cmp = C();
    if (!Cmp || !ctx) return;
    const { items, dest, DMC, SULL, choice } = ctx;
    const results = $('results') || ctx.host;
    if (!results) return;
    let host = $('ffStudio');
    if (!host) {
      host = document.createElement('section');
      host.id = 'ffStudio';
      host.className = 'ffa-studio noprint';
      host.setAttribute('aria-labelledby', 'ffStudioH');
      const tbl = $('tbl') || ctx.table;
      if (tbl && tbl.parentNode === results) results.insertBefore(host, tbl);
      else results.appendChild(host);
    }
    if (!items || !items.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    const srcLab = t('studio.source') || 'Your color';
    const caveat = t('studio.caveat');
    const screen = t('studio.screen');
    const destBrand = brandName(dest);
    const cards = items.map(it => {
      const code = it.code;
      const entry = DMC && DMC[code];
      const name = entry && entry.name ? entry.name : '';
      const srcHex = hexOf(DMC, code);
      const matches = Cmp.matchesFor(code, dest, chartsOf(DMC, SULL, code), choice && choice[code]);
      const title = t('studio.dest.in', { source: 'DMC ' + code, brand: destBrand }) || (`DMC ${code} in ${destBrand}`);
      const cols = [`<div class="ffa-cmpcol is-src">${swatch(srcHex, 'DMC ' + code + ' swatch, approximate')}<span class="ffa-ccode">DMC ${esc(code)}</span><span class="ffa-cname">${esc(name)}${name ? ' · ' : ''}${esc(srcLab)}</span>${dest === 'dmc' ? kindBadge('exact') : ''}</div>`];
      const shown = matches.filter(m => !m.source);
      const canPick = dest !== 'dmc' && shown.length > 1;
      if (dest !== 'dmc' && !shown.length) {
        cols.push(`<div class="ffa-cmpcol is-empty"><span class="ffa-ccode">${esc(t('studio.match.none') || 'No chart match')}</span></div>`);
      } else {
        shown.forEach(m => {
          const noneLab = t('studio.swatch.none', { brand: m.brand }) || ('No ' + m.brand + ' swatch available');
          const radio = canPick ? `<label class="ffa-choose"><input type="radio" name="ffa-m-${esc(code)}" data-code="${esc(code)}" value="${esc(m.code)}"${m.selected ? ' checked' : ''}> ${esc(t('studio.use.radio', { brand: m.brand, code: m.code }) || ('Use ' + m.brand + ' ' + m.code))}</label>` : '';
          cols.push(`<div class="ffa-cmpcol${m.selected ? ' is-sel' : ''}">${swatch(null, noneLab)}<span class="ffa-ccode">${esc(m.brand)} ${esc(m.code)}</span>${kindBadge(m.kind)}<span class="ffa-cname">${esc(why(m.kind))}</span>${radio}</div>`);
        });
      }
      const legend = canPick ? `<legend class="sr">${esc(t('studio.match.legend', { code }) || ('Choose a match for DMC ' + code))}</legend>` : '';
      const wrapOpen = canPick ? `<fieldset class="ffa-cmp-fs">${legend}` : '';
      const wrapClose = canPick ? `</fieldset>` : '';
      return `<article class="ffa-cmp" data-code="${esc(code)}" aria-label="${esc(title)}"><div class="ffa-cmp-head"><h3 class="ffa-cmp-h">${esc(title)}</h3></div>${wrapOpen}<div class="ffa-cmp-grid">${cols.join('')}</div>${wrapClose}${actionRow(code)}</article>`;
    }).join('');
    const seenWhite = items.some(it => Cmp.isWhite(it.code));
    const whites = Cmp.WHITES.map(code => {
      const entry = DMC && DMC[code];
      return `<div class="ffa-wcard">${swatch(hexOf(DMC, code), 'DMC ' + code + ' swatch, approximate')}<span class="ffa-ccode">DMC ${esc(code)}</span><span class="ffa-cname">${esc(entry && entry.name ? entry.name : '')}</span></div>`;
    }).join('');
    const whiteBlock = seenWhite ? `<section class="ffa-whites" aria-labelledby="ffWhitesH"><h3 id="ffWhitesH">${esc(t('studio.whites.title'))}</h3><p class="mut small">${esc(t('studio.whites.body'))}</p><div class="ffa-wgrid">${whites}</div></section>` : '';
    const recent = recentBlock(DMC, dest);
    host.innerHTML = `<div class="ffa-studio-head"><h2 id="ffStudioH">${esc(t('studio.title') || t('studio.btn.compare') || 'Compare chart matches')}</h2><p class="mut small">${esc(t('studio.sub'))}</p><p class="mut small" id="ffStudioCaveat">${esc(caveat)}</p><p class="mut small">${esc(screen)}</p></div>${cards}${whiteBlock}${recent}`;
    host.querySelectorAll('.ffa-choose input').forEach(r => {
      r.addEventListener('change', () => {
        if (choice) choice[r.dataset.code] = r.value || undefined;
        const sel = document.querySelector('.pick[data-code="' + CSS.escape(r.dataset.code) + '"]');
        if (sel) { sel.value = r.value; sel.dispatchEvent(new Event('change')); }
        paint(ctx);
      });
    });
    bindActions(host);
  }
  function recentBlock(DMC, dest) {
    const prefs = root.FlossFoxAtelier && typeof root.FlossFoxAtelier.prefs === 'function' ? root.FlossFoxAtelier.prefs() : null;
    const rows = prefs && Array.isArray(prefs.recentConversions) ? prefs.recentConversions : [];
    const brandN = b => b === 'sullivans' ? 'Sullivans' : b === 'anchor' ? 'Anchor' : 'DMC';
    const items = rows.slice(0, 12).map(row => {
      const hex = hexOf(DMC, row.code);
      const chip = t('studio.recent.chip', { code: row.code, brand: brandN(row.to) }) || ('DMC ' + row.code + ' · ' + brandN(row.to));
      const aria = t('studio.recent.item', { brand: 'DMC', code: row.code, brand2: brandN(row.to) }) || ('Convert DMC ' + row.code + ' to ' + brandN(row.to) + ' again');
      return `<li><a href="#ffStudio" aria-label="${esc(aria)}">${swatch(hex, 'DMC ' + row.code + ' swatch, approximate')}${esc(chip)}</a></li>`;
    }).join('');
    const body = items ? `<ul class="ffa-recent">${items}</ul>` : `<p class="mut small">${esc(t('studio.recent.empty'))}</p>`;
    return `<section class="ffa-recent-wrap" aria-labelledby="ffRecentH"><h3 id="ffRecentH">${esc(t('studio.recent.title'))}</h3><p class="mut small">${esc(t('studio.recent.hint'))}</p>${body}</section>`;
  }

  function paintProject(el, p, DMC, SULL) {
    const Cmp = C();
    if (!el || !p || !Cmp) return;
    if (!p.items || !p.items.length) { el.innerHTML = ''; return; }
    const dest = (p.buyBrand || 'dmc');
    const rows = p.items.map(it => {
      const matches = Cmp.matchesFor(it.code, dest, chartsOf(DMC, SULL, it.code), null).filter(m => dest === 'dmc' ? m.source : !m.source);
      const bits = matches.length ? matches.map(m => `${esc(m.brand)} ${esc(m.code)} ${kindBadge(m.kind)}`).join(' ') : esc(t('studio.match.none') || 'No chart match');
      return `<li class="ffa-pcc-row"><span class="ffa-ccode">DMC ${esc(it.code)}</span><span class="ffa-pcc-m">${bits}</span></li>`;
    }).join('');
    el.innerHTML = `<div class="ffa-pcc"><h3>${esc(t('studio.btn.compare') || 'Compare chart matches')}</h3><p class="hint">${esc(t('studio.caveat'))}</p><ul class="ffa-pcc-list">${rows}</ul></div>`;
  }

  let lastUndo = null;
  let pickedProjectId = '';

  function liveProjects() {
    const P = root.FlossFoxProjects;
    if (!P || !P._store) return [];
    return (P._store().projects || []).filter(x => x && x.id && !x.demo);
  }
  function cap() {
    return (root.FlossFoxParse && FlossFoxParse.SKEIN_CAP) || 20;
  }
  function closeDlg() {
    const d = $('ffaAddDlg');
    if (!d) return;
    if (typeof d.close === 'function' && d.open) d.close();
    else d.removeAttribute('open');
  }
  function sayOn(art, text, undoable) {
    if (!art) return;
    const msg = art.querySelector('[data-add-msg]');
    const undo = art.querySelector('[data-add-undo]');
    if (msg) msg.textContent = text || '';
    if (undo) undo.hidden = !undoable;
  }
  function artFor(code) {
    return document.querySelector('#ffStudio .ffa-cmp[data-code="' + CSS.escape(code) + '"]');
  }
  function notSaved() { return t('studio.notAdded') || 'Not saved: your browser blocked the save. Nothing was added.'; }
  function addedThreads(code, n) {
    return t('studio.added.threads', { brand: 'DMC', code, n }, n) || (n === 1 ? ('✓ Added 1 full skein of DMC ' + code + ' to My threads.') : ('✓ Added ' + n + ' full skeins of DMC ' + code + ' to My threads.'));
  }
  function addedProject(code, name) {
    return t('studio.added.project', { brand: 'DMC', code, name }) || ('✓ Added DMC ' + code + ' to ' + name + '.');
  }

  function addToThreads(code, qty) {
    const T = root.FlossFoxThreadsUI;
    const c = String(code || '');
    const cat = (typeof DMC === 'object' && DMC) || root.DMC || {};
    if (!cat[c]) return { ok: false, reason: 'invalid' };
    if (!T || typeof T.addItems !== 'function' || (T.canSave && !T.canSave())) return { ok: false, reason: 'not-saved' };
    const q = Number.isInteger(qty) && qty > 0 ? Math.min(qty, cap()) : 1;
    const data = T.data();
    const prev = data.threads[c] ? JSON.parse(JSON.stringify(data.threads[c])) : null;
    const snap = JSON.stringify(data);
    const revert = () => {
      if (prev) data.threads[c] = JSON.parse(JSON.stringify(prev));
      else delete data.threads[c];
      try { if (typeof T.render === 'function') T.render(); } catch (e) {}
    };
    const expect = Math.min(999, (prev ? prev.n : 0) + q);
    let r = null;
    try { r = T.addItems([{ code: c, qty: q, stated: true }]); }
    catch (e) { r = null; }
    const storedOk = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(T.KEY));
        const e = stored && stored.threads && stored.threads[c];
        return !!(e && e.n === expect);
      } catch (e) { return false; }
    };
    if (storedOk()) {
      lastUndo = { type: 'threads', code: c, qty: q, prev, snap };
      return { ok: true, code: c, qty: q };
    }
    if (!r || r.saved === false) { revert(); return { ok: false, reason: 'not-saved' }; }
    revert();
    try { localStorage.setItem(T.KEY, snap); if (typeof T.render === 'function') T.render(); } catch (e2) {}
    return { ok: false, reason: 'not-saved' };
  }
  function addToProject(projectId, code, qty) {
    const P = root.FlossFoxProjects;
    if (!P || typeof P.addColor !== 'function') return { ok: false, reason: 'missing' };
    const r = P.addColor(projectId, code, qty);
    if (!r || !r.ok) return r || { ok: false, reason: 'not-saved' };
    if (!r.duplicate) lastUndo = { type: 'project', id: projectId, code: r.code, qty: r.qty };
    return r;
  }
  function undoLast() {
    const u = lastUndo;
    lastUndo = null;
    if (!u) return { ok: false, reason: 'none' };
    if (u.type === 'project') {
      const P = root.FlossFoxProjects;
      if (!P || typeof P.undoAddColor !== 'function') return { ok: false, reason: 'missing' };
      return P.undoAddColor(u.id, u.code, u.qty);
    }
    if (u.type === 'threads') {
      const T = root.FlossFoxThreadsUI;
      if (!T || !T.data || (T.canSave && !T.canSave())) return { ok: false, reason: 'not-saved' };
      const data = T.data();
      const cur = data.threads[u.code];
      const expect = Math.min(999, (u.prev ? u.prev.n : 0) + u.qty);
      if (!cur || cur.n !== expect) return { ok: false, reason: 'changed' };
      if (u.prev) data.threads[u.code] = JSON.parse(JSON.stringify(u.prev));
      else delete data.threads[u.code];
      try {
        localStorage.setItem(T.KEY, JSON.stringify(data));
        const stored = JSON.parse(localStorage.getItem(T.KEY));
        const e = stored && stored.threads && stored.threads[u.code];
        const ok = u.prev ? !!(e && e.n === u.prev.n) : !e;
        if (!ok) throw new Error('verify');
        window.dispatchEvent(new CustomEvent('ff:data-saved', { detail: { area: 'threads' } }));
        if (typeof T.render === 'function') T.render();
        return { ok: true, code: u.code };
      } catch (e) {
        if (cur) data.threads[u.code] = cur; else delete data.threads[u.code];
        try { if (typeof T.render === 'function') T.render(); } catch (e2) {}
        return { ok: false, reason: 'not-saved' };
      }
    }
    return { ok: false, reason: 'none' };
  }

  function bindActions(host) {
    host.querySelectorAll('[data-add-threads]').forEach(btn => {
      btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); openThreadsDlg(btn.getAttribute('data-add-threads')); });
    });
    host.querySelectorAll('[data-add-project]').forEach(btn => {
      btn.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); openProjectDlg(btn.getAttribute('data-add-project')); });
    });
    host.querySelectorAll('[data-add-undo]').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const art = btn.closest('.ffa-cmp');
        const code = art && art.getAttribute('data-code');
        const r = undoLast();
        if (!r.ok) { sayOn(art, r.reason === 'changed' ? (t('studio.notAdded') || notSaved()) : notSaved(), false); return; }
        sayOn(art, '✓ Undid adding DMC ' + (r.code || code) + '.', false);
      });
    });
  }
  function openThreadsDlg(code) {
    const c = String(code || '');
    const title = t('studio.dlg.threads.title', { brand: 'DMC', code: c }) || ('Add DMC ' + c + ' to My threads');
    const qtyLab = t('studio.dlg.qty') || 'How many full skeins?';
    const addLab = t('studio.dlg.btn.add', { n: 1 }, 1) || 'Add 1 skein';
    const cancel = t('studio.dlg.cancel') || 'Cancel';
    showDlg(`<form class="ffa-add-form"><h2 id="ffaAddH">${esc(title)}</h2><label for="ffaAddQty">${esc(qtyLab)}</label><input type="number" id="ffaAddQty" min="1" max="${cap()}" value="1" required><p class="hint" id="ffaAddDlgMsg" role="status" aria-live="polite"></p><div class="row"><button type="button" class="pri" id="ffaAddGo">${esc(addLab)}</button><button type="button" class="sec" data-cancel>${esc(cancel)}</button></div></form>`, d => {
      const qty = d.querySelector('#ffaAddQty');
      const go = d.querySelector('#ffaAddGo');
      const sync = () => {
        const n = Math.max(1, Math.min(cap(), parseInt(qty.value, 10) || 1));
        go.textContent = t('studio.dlg.btn.add', { n }, n) || (n === 1 ? 'Add 1 skein' : ('Add ' + n + ' skeins'));
      };
      qty.addEventListener('input', sync);
      const commit = ev => {
        if (ev) ev.preventDefault();
        const n = Math.max(1, Math.min(cap(), parseInt(qty.value, 10) || 1));
        let r;
        try { r = addToThreads(c, n); }
        catch (e) { d.querySelector('#ffaAddDlgMsg').textContent = notSaved(); return; }
        const art = artFor(c);
        if (!r || !r.ok) { d.querySelector('#ffaAddDlgMsg').textContent = notSaved(); return; }
        closeDlg();
        sayOn(art, addedThreads(c, n), true);
      };
      go.addEventListener('click', commit);
      qty.focus();
    });
  }
  function openProjectDlg(code) {
    const c = String(code || '');
    const list = liveProjects();
    const title = t('studio.dlg.project.title', { brand: 'DMC', code: c }) || ('Add DMC ' + c + ' to a project');
    const cancel = t('studio.dlg.cancel') || 'Cancel';
    if (!list.length) {
      showDlg(`<form method="dialog" class="ffa-add-form"><h2 id="ffaAddH">${esc(title)}</h2><p role="status" aria-live="polite">Start a project first to add this color.</p><div class="row"><button type="button" class="sec" data-cancel>${esc(cancel)}</button></div></form>`, () => {});
      return;
    }
    if (!pickedProjectId || !list.some(x => x.id === pickedProjectId)) pickedProjectId = list[0].id;
    const opts = list.map(x => `<option value="${esc(x.id)}"${x.id === pickedProjectId ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    const pickLab = t('studio.dlg.project.pick') || 'Choose a project';
    const addLab = t('studio.dlg.btn.addProject') || 'Add to this project';
    showDlg(`<form class="ffa-add-form"><h2 id="ffaAddH">${esc(title)}</h2><label for="ffaAddProj">${esc(pickLab)}</label><select id="ffaAddProj">${opts}</select><p class="hint" id="ffaAddDlgMsg" role="status" aria-live="polite"></p><div class="row"><button type="button" class="pri" id="ffaAddGo">${esc(addLab)}</button><button type="button" class="sec" data-cancel>${esc(cancel)}</button></div></form>`, d => {
      const commit = ev => {
        if (ev) ev.preventDefault();
        const id = d.querySelector('#ffaAddProj').value;
        pickedProjectId = id;
        const name = (list.find(x => x.id === id) || {}).name || 'project';
        let r;
        try { r = addToProject(id, c, 1); }
        catch (e) { d.querySelector('#ffaAddDlgMsg').textContent = notSaved(); return; }
        const art = artFor(c);
        if (!r || !r.ok) { d.querySelector('#ffaAddDlgMsg').textContent = notSaved(); return; }
        closeDlg();
        if (r.duplicate) { sayOn(art, 'DMC ' + c + ' is already in ' + name + '. Nothing changed.', false); return; }
        sayOn(art, addedProject(c, name), true);
      };
      d.querySelector('#ffaAddGo').addEventListener('click', commit);
      d.querySelector('#ffaAddProj').focus();
    });
  }
  function showDlg(html, onReady) {
    let d = $('ffaAddDlg');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'ffaAddDlg';
      d.className = 'ffa-add-dlg';
      d.setAttribute('aria-labelledby', 'ffaAddH');
      document.body.appendChild(d);
    }
    d.innerHTML = html;
    const cancel = d.querySelector('[data-cancel]');
    if (cancel) cancel.addEventListener('click', ev => { ev.preventDefault(); closeDlg(); });
    d.addEventListener('cancel', ev => { ev.preventDefault(); closeDlg(); }, { once: true });
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); }
    else d.setAttribute('open', '');
    onReady(d);
  }
  function actionRow(code) {
    return `<div class="ffa-cmp-actions"><button type="button" class="sec" data-add-threads="${esc(code)}">${esc(t('studio.btn.addThreads') || 'Add to My threads')}</button><button type="button" class="sec" data-add-project="${esc(code)}">${esc(t('studio.btn.addProject') || 'Add to project')}</button><p class="hint" data-add-msg role="status" aria-live="polite"></p><button type="button" class="ghost small" data-add-undo hidden>${esc(t('common.undo') || 'Undo')}</button></div>`;
  }

  root.FlossFoxAtelierStudio = Object.freeze({ paint, paintProject, PH, addToThreads, addToProject, undoLast });
})(typeof window !== 'undefined' ? window : globalThis);
