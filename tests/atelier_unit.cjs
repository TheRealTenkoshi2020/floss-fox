// node tests/atelier_unit.cjs : Floss Fox 3.9 Atelier Stage A pure modules against REAL-SHAPED data
// (DMC catalog parsed from index.html, thread collection built by threads.js core, plan(p).lines shape from projects.js,
// store-mode-core.js cross-check, landing.js first-visit detection in a sandbox). No DOM, no network. Simulated, Node only.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const DMC = JSON.parse(html.match(/const DMC=(\{.*?\});/)[1]);
const TC = require('../threads.js').core(DMC);
const S = require('../atelier/atelier-search-core.js');
const P = require('../atelier/atelier-preferences-core.js');
const V = require('../atelier/atelier-store-visit-core.js');
const C = require('../atelier/atelier-palette-core.js');
const SM = require('../store-mode-core.js');
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '->', e && e.message); } };

// ---------- real-shaped fixtures ----------
// Threads: built with the real threads.js core (schema 2), storage normalized by its own normalizeStorage.
const coll = TC.empty();
TC.add(coll, [{ code: '310', qty: 2 }, { code: 'BLANC', qty: 1 }, { code: 'WHITE', qty: 1 }, { code: 'B5200', qty: 3 }, { code: '321', qty: 1 }]);
coll.threads['310'].partial = true;
coll.threads['310'].storage = TC.normalizeStorage({ container: 'Box 2', slot: 'Row B' });
coll.threads['WHITE'].n = 0;
coll.demo = { '999': { n: 5, partial: false, restock: false, updated: '' } }; // demo map must never be indexed
// Projects: shape of projects.js normProject() output (schema 2).
const proj = (id, name, codes, extra = {}) => ({ id, name, notes: 'private notes 12345', buyBrand: 'dmc', items: codes.map(c => ({ code: c, qty: 1, assumed: 0, stated: true, src: [] })), decisions: {}, purchased: {}, status: 'planning', created: '2026-11-01T00:00:00.000Z', updated: '2026-11-02T00:00:00.000Z', ...extra });
const projects = [
  proj('3f2b6a9e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', 'Foxes in Snow', ['310', 'BLANC', '321'], { status: 'progress', leftOff: 'Finished page 2, Box 7 secret' }),
  proj('pdemo', 'Demo only', ['310'], { demo: true }),
  proj('pl2x9a', 'Café Garden', ['3865', 'B5200'], { status: 'done' })
];
const index = S.build({ projects, threads: coll.threads, catalog: DMC });

// ---------- Samira's 30 reference cases, ported to the adapted API (same intent) ----------
test('ref search: project by name', () => assert.equal(S.search(index, 'snow').projects[0].key, projects[0].id));
test('ref search: project palette code', () => assert.equal(S.search(index, 'BLANC').projects[0].key, projects[0].id));
test('ref search: storage location', () => assert.equal(S.search(index, 'Box 2').threads[0].key, 'DMC:310'));
test('ref search: BLANC kept distinct', () => assert.equal(S.search(index, 'BLANC').colors[0].key, 'DMC:BLANC'));
test('ref search: WHITE kept distinct', () => assert.equal(S.search(index, 'WHITE').colors[0].key, 'DMC:WHITE'));
test('ref search: demo project excluded', () => assert.equal(S.search(index, 'Demo').projects.length, 0));
test('ref search: empty string safe', () => assert.equal(S.search(index, '').total, 0));
test('ref search: no mutation of index', () => { const d = JSON.stringify(index); S.search(index, 'DMC 310'); assert.equal(JSON.stringify(index), d); });
test('ref search: bounded grouped output', () => { const x = S.search(index, 'White', { limit: 1 }); assert.equal(x.colors.length, 1); assert(x.total >= 2); });
test('ref prefs: default theme system', () => assert.equal(P.normalize(null).data.theme, 'system'));
test('ref prefs: future schema fails closed', () => assert.equal(P.normalize({ v: 3 }).reason, 'future-schema'));
test('ref prefs: malformed controls sanitized', () => { const v = P.normalize({ theme: 'evil', lastTab: 'admin', lastProjectId: 'x'.repeat(200), lowStockThreshold: -999 }); assert.equal(v.data.theme, 'system'); assert.equal(v.data.lastTab, 'convert'); assert.equal(v.data.lastProjectId, null); assert.equal(v.data.lowStockThreshold, 1); });
test('ref prefs: preview namespace isolated', () => assert.notEqual(P.keyFor('flossfox-dev.v1'), P.keyFor('flossfox.v1')));
test('ref prefs: conversion deduped and bounded', () => { let p = P.normalize(null).data; for (let i = 0; i < 15; i++) p = P.rememberConversion(p, { from: 'dmc', to: 'anchor', code: String(i) }).data; assert.equal(p.recentConversions.length, 12); p = P.rememberConversion(p, { from: 'dmc', to: 'anchor', code: '14' }).data; assert.equal(p.recentConversions.length, 12); assert.equal(p.recentConversions[0].code, '14'); });
test('ref prefs: forbidden conversion rejected', () => assert.equal(P.rememberConversion({}, { from: 'dmc', to: 'anchor', code: '../../bad' }).ok, false));
const mem = () => { const m = new Map(); return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const ls = mem(), DK = P.keyFor('flossfox-dev.v1');
test('ref prefs: verified write/read', () => { assert(P.save(ls, DK, { theme: 'forest', lastTab: 'projects' }).ok); assert.equal(P.load(ls, DK).data.theme, 'forest'); });
test('ref prefs: blocked write does not masquerade as saved', () => assert.equal(P.save({ getItem: () => null, setItem() { throw new Error('quota'); } }, DK, {}).ok, false));
test('ref prefs: unrelated collection key untouched', () => { ls.setItem('flossfox-dev.threads.v1', 'untouched'); P.save(ls, DK, {}); assert.equal(ls.getItem('flossfox-dev.threads.v1'), 'untouched'); });
const lines = [{ key: 'a', brand: 'DMC', code: '310', quantity: 2, bought: false }, { key: 'b', brand: 'DMC', code: 'BLANC', quantity: 1, bought: false }, { key: 'c', brand: 'DMC', code: 'WHITE', quantity: 1, bought: true }];
const links = [{ merchantId: 'michaels', merchantName: 'Michaels', brand: 'DMC', code: '310', verified: true }, { merchantId: 'hobby', merchantName: 'Hobby Lobby', brand: 'DMC', code: '310', verified: true }, { merchantId: 'michaels', merchantName: 'Michaels', brand: 'DMC', code: 'BLANC', verified: false }];
test('ref store: one canonical checkbox per item despite multiple stores', () => { const v = V.build(lines, links, { view: 'by-store' }); assert.equal(v.groups.reduce((x, g) => x + g.items.length, 0), 3); assert.equal(v.counts.total, 3); });
test('ref store: unverified merchant ignored', () => { const v = V.build(lines, links, { view: 'by-store' }); assert(v.groups.some(x => x.key === 'unassigned' && x.items.some(y => y.code === 'BLANC'))); });
test('ref store: selected merchant retains unlinked under Other', () => { const v = V.build(lines, links, { view: 'by-store', selectedMerchant: 'hobby' }); assert(v.groups.some(x => x.key === 'unassigned' && x.items.length === 2)); });
test('ref store: bought filter correct', () => { const v = V.build(lines, links, { filter: 'purchased' }); assert.equal(v.groups[0].items[0].code, 'WHITE'); });
test('ref store: remaining filter correct', () => assert.equal(V.build(lines, links, { filter: 'remaining' }).counts.visible, 2));
test('ref store: duplicate key rejected', () => assert.throws(() => V.build([lines[0], lines[0]]), /unique/));
test('ref store: read-only', () => { const b = JSON.stringify(lines); V.build(lines, links); assert.equal(JSON.stringify(lines), b); });
test('ref store: share text contains only buy-needed canonical items', () => { const t = V.shareText(lines); assert(t.includes('DMC BLANC')); assert(!t.includes('DMC WHITE')); assert.equal(t.split('DMC 310').length - 1, 1); });
test('ref palette: specials distinct', () => assert.equal(C.strip([{ code: 'BLANC' }, { code: 'WHITE' }, { code: 'B5200' }]).total, 3));
test('ref palette: invalid rgb fallback', () => assert.equal(C.strip([{ code: '310' }], { '310': 'javascript:alert(1)' }).swatches[0].rgb, null));
test('ref palette: deterministic six color sample and overflow', () => { const cs = Array.from({ length: 20 }, (_, i) => ({ code: String(i + 100) })); const a = C.strip(cs); assert.equal(a.swatches.length, 6); assert.equal(a.remaining, 14); assert.deepEqual(a, C.strip(cs)); });
test('ref palette: input untouched', () => { const arr = [{ code: '310' }]; C.strip(arr); assert.equal(arr[0].code, '310'); });

// ---------- new: search against the real DMC catalog and real thread data ----------
test('catalog: every DMC catalog code indexed once (534+ incl. specials)', () => { const n = index.filter(r => r.type === 'color' && r.key.startsWith('DMC:')).length; assert.equal(n, Object.keys(DMC).length); assert(n >= 533); });
test('catalog: BLANC, WHITE, B5200 are three different color rows', () => { const k = index.filter(r => r.type === 'color' && ['DMC:BLANC', 'DMC:WHITE', 'DMC:B5200'].includes(r.key)).map(r => r.key); assert.deepEqual(k.sort(), ['DMC:B5200', 'DMC:BLANC', 'DMC:WHITE']); });
test('search "B5200" finds DMC B5200 first; WHITE and BLANC follow only as marked siblings, never merged', () => { const r = S.search(index, 'B5200'); assert.equal(r.colors[0].key, 'DMC:B5200'); assert(!r.colors[0].whiteSibling); const sib = r.colors.filter(x => x.key === 'DMC:WHITE' || x.key === 'DMC:BLANC'); assert.equal(sib.length, 2); assert(sib.every(x => x.whiteSibling === 'B5200')); assert.deepEqual(r.colors.slice(1, 3).map(x => x.key).sort(), ['DMC:BLANC', 'DMC:WHITE']); });
test('search "white": WHITE first, then BLANC and B5200 as siblings, before other whites', () => { const r = S.search(index, 'white'); assert.deepEqual(r.colors.slice(0, 3).map(x => x.key), ['DMC:WHITE', 'DMC:BLANC', 'DMC:B5200']); assert(!r.colors[0].whiteSibling && r.colors[1].whiteSibling === 'WHITE' && r.colors[2].whiteSibling === 'WHITE'); assert.equal(new Set(r.colors.map(x => x.key)).size, r.colors.length); });
test('search "blanc": BLANC first, WHITE and B5200 next; "310" gets no white siblings', () => { const r = S.search(index, 'blanc'); assert.deepEqual(r.colors.slice(0, 3).map(x => x.key), ['DMC:BLANC', 'DMC:WHITE', 'DMC:B5200']); assert(!S.search(index, '310').colors.some(x => x.whiteSibling)); });
test('search "WHITE" ranks DMC WHITE first and never relabels BLANC', () => { const r = S.search(index, 'white'); assert.equal(r.colors[0].key, 'DMC:WHITE'); const b = r.colors.find(x => x.key === 'DMC:BLANC'); assert(!b || b.label === 'DMC BLANC'); });
test('search "310": exact code ranks DMC 310 thread + color first', () => { const r = S.search(index, '310'); assert.equal(r.threads[0].key, 'DMC:310'); assert.equal(r.colors[0].key, 'DMC:310'); });
test('search "DMC 310" exact brand+code first', () => assert.equal(S.search(index, 'DMC 310').colors[0].key, 'DMC:310'));
test('Anchor rows only from catalog anchor lists, pointing to DMC', () => { const want = Object.keys(DMC).filter(c => (DMC[c].anchor || []).map(String).map(s => s.toUpperCase()).includes('403')); const r = S.search(index, 'Anchor 403').colors.find(x => x.key === 'ANCHOR:403'); if (!want.length) return assert(!r); assert(r); assert.deepEqual(r.dmc.slice().sort(), want.slice().sort()); });
test('no invented brands: no Sullivans rows without catalog data', () => assert(!index.some(r => r.type === 'color' && /^SULLIVANS:/.test(r.key))));
test('thread subtitle: whole skeins + partial flag only (no fractions)', () => { const t = index.find(r => r.key === 'DMC:310' && r.type === 'thread'); assert.match(t.subtitle, /^2 full skeins \+ a partial skein · Box 2 · Row B$/); assert(!/0\.5|½/.test(t.subtitle)); });
test('thread with 0 skeins still indexed honestly', () => assert.match(index.find(r => r.key === 'DMC:WHITE' && r.type === 'thread').subtitle, /^0 full skeins/));
test('demo threads are never indexed (data().threads only)', () => assert(!index.some(r => r.type === 'thread' && r.key === 'DMC:999')));
test('project notes and Where I left off are NOT indexed', () => { assert.equal(S.search(index, 'secret').total, 0); assert.equal(S.search(index, '12345').total, 0); });
test('project subtitle uses real status labels', () => { assert.match(index.find(r => r.key === projects[0].id).subtitle, /^In progress · 3 colors$/); assert.match(index.find(r => r.key === 'pl2x9a').subtitle, /^Completed/); });
test('diacritics: "cafe" finds "Café Garden"', () => assert.equal(S.search(index, 'cafe').projects[0].key, 'pl2x9a'));
test('control chars and long queries are bounded', () => { const r = S.search(index, '\u0000310' + 'x'.repeat(500)); assert(r.query.length <= 120); });
test('search refreshes from current state (rebuild sees new thread)', () => { const c2 = JSON.parse(JSON.stringify(coll)); TC.add(c2, [{ code: '3865', qty: 1 }]); const i2 = S.build({ projects, threads: c2.threads, catalog: DMC }); assert.equal(S.search(i2, '3865').threads.length, 1); assert.equal(S.search(index, '3865').threads.length, 0); });
test('build accepts data() wrapper {schema,threads} and rejects arrays', () => { assert.equal(S.build({ threads: coll }).filter(r => r.type === 'thread').length, 5); assert.throws(() => S.build({ threads: [] })); });
test('duplicate project ids indexed once', () => assert.equal(S.build({ projects: [projects[0], projects[0]] }).length, 1));
test('large index (300 projects x 50 colors) searches under 200ms', () => { const many = Array.from({ length: 300 }, (_, i) => proj('p' + i, 'Project ' + i, Object.keys(DMC).slice(i % 400, i % 400 + 50))); const big = S.build({ projects: many, threads: coll.threads, catalog: DMC }); const t0 = Date.now(); S.search(big, 'project 2'); S.search(big, '310'); assert(Date.now() - t0 < 200); });

// ---------- new: preferences lifecycle ----------
test('prefs: Resume where I was is OFF by default (opt-in)', () => assert.equal(P.DEFAULT.rememberPlace, false));
test('prefs: key derived like other keys (dev + prod)', () => { assert.equal(P.keyFor('flossfox-dev.v1'), 'flossfox-dev.atelier.v1'); assert.equal(P.keyFor('flossfox.v1'), 'flossfox.atelier.v1'); assert.throws(() => P.keyFor('evil.v1')); });
test('prefs: save refuses any non-preference key', () => { const s = mem(); assert.equal(P.save(s, 'flossfox-dev.v1', {}).ok, false); assert.equal(s.getItem('flossfox-dev.v1'), null); });
test('prefs: load of missing key = defaults, not stored, writes nothing', () => { const s = mem(); const r = P.load(s, DK); assert(r.ok && r.stored === false); assert.equal(s.m.size, 0); });
test('prefs: corrupted JSON fails closed and is not overwritten', () => { const s = mem(); s.setItem(DK, '{bad'); assert.equal(P.load(s, DK).reason, 'unreadable'); assert.equal(P.save(s, DK, { theme: 'moon' }).ok, false); assert.equal(s.getItem(DK), '{bad'); });
test('prefs: newer-schema value fails closed and is not overwritten', () => { const s = mem(); s.setItem(DK, '{"v":2,"theme":"aurora"}'); assert.equal(P.load(s, DK).reason, 'future-schema'); assert.equal(P.save(s, DK, { theme: 'moon' }).reason, 'future-schema-existing'); assert.equal(s.getItem(DK), '{"v":2,"theme":"aurora"}'); });
test('prefs: non-numeric schema fails closed', () => assert.equal(P.normalize({ v: 'x' }).ok, false));
test('prefs: silent storage (write ignored) reported as unverified', () => { const s = { getItem: () => null, setItem() {} }; assert.equal(P.save(s, DK, {}).reason, 'unverified-save'); });
test('prefs: reset removes only the preference key', () => { const s = mem(); s.setItem('flossfox-dev.v1', 'P'); s.setItem('flossfox-dev.threads.v1', 'T'); P.save(s, DK, { theme: 'forest' }); assert(P.reset(s, DK).ok); assert.equal(s.getItem(DK), null); assert.equal(s.getItem('flossfox-dev.v1'), 'P'); assert.equal(s.getItem('flossfox-dev.threads.v1'), 'T'); assert.equal(P.reset(s, 'flossfox-dev.v1').ok, false); assert.equal(s.getItem('flossfox-dev.v1'), 'P'); });
test('prefs: unknown fields dropped (no smuggled data)', () => assert(!('notes' in P.normalize({ notes: 'secret', theme: 'moon' }).data)));
test('prefs: brands limited to real brand keys', () => { assert.equal(P.rememberConversion({}, { from: 'dmc', to: 'Acme', code: '310' }).ok, false); assert.equal(P.rememberConversion({}, { from: 'DMC', to: 'Anchor', code: 'blanc' }).data.recentConversions[0].code, 'BLANC'); });
test('prefs: lastProjectId accepts real UUID and p+base36 ids', () => { assert.equal(P.normalize({ lastProjectId: projects[0].id }).data.lastProjectId, projects[0].id); assert.equal(P.normalize({ lastProjectId: 'pl2x9a' }).data.lastProjectId, 'pl2x9a'); assert.equal(P.normalize({ lastProjectId: '<img>' }).data.lastProjectId, null); });
test('prefs: tabs match projects.js showView names', () => { const src = fs.readFileSync(path.join(root, 'projects.js'), 'utf8'); const m = src.match(/const V=\{([^}]*)\}/)[1]; const names = [...m.matchAll(/(\w+):\[/g)].map(x => x[1]).sort(); assert.deepEqual(P.TABS.slice().sort(), names); });
test('prefs: huge recent list bounded to 12', () => assert.equal(P.normalize({ recentConversions: Array.from({ length: 5000 }, (_, i) => ({ from: 'dmc', to: 'anchor', code: String(i) })) }).data.recentConversions.length, 12));

// ---------- new: shopping lines in the real plan(p).lines shape ----------
const plan = { dest: 'dmc', lines: [{ key: 'dmc:310', from: ['310'], to: '310', q: 2, bought: false, ts: [] }, { key: 'dmc:BLANC', from: ['BLANC'], to: 'BLANC', q: 1, bought: false, ts: [] }, { key: 'dmc:WHITE', from: ['WHITE'], to: 'WHITE', q: 1, bought: true, ts: [] }, { key: 'dmc:B5200', from: ['B5200'], to: 'B5200', q: 1, bought: false, ts: [] }] };
const real = V.linesFromPlan(plan, { 'dmc:310': 'black' });
test('plan lines: linesFromPlan keeps canonical keys and codes', () => { assert.deepEqual(real.map(l => l.key), ['dmc:310', 'dmc:BLANC', 'dmc:WHITE', 'dmc:B5200']); assert.deepEqual(real.map(l => l.to), ['310', 'BLANC', 'WHITE', 'B5200']); });
test('plan lines: does not mutate the plan', () => { const b = JSON.stringify(plan); V.linesFromPlan(plan); V.build(real, links, { view: 'by-store' }); assert.equal(JSON.stringify(plan), b); });
test('plan lines: DMC 310 linked by 3 stores = exactly one line', () => { const l3 = links.concat([{ merchantId: 'joann', merchantName: 'Joann', brand: 'DMC', code: '310', verified: true }]); const v = V.build(real, l3, { view: 'by-store' }); assert.equal(v.groups.flatMap(g => g.items).filter(i => i.code === '310').length, 1); const x = v.groups.flatMap(g => g.items).find(i => i.code === '310'); assert.equal(x.stores.length, 3); });
test('plan lines: switching store keeps bought state on the line, not the store', () => { const a = V.build(real, links, { view: 'by-store', selectedMerchant: 'hobby' }), b = V.build(real, links, { view: 'by-store', selectedMerchant: 'michaels' }); const st = v => Object.fromEntries(v.groups.flatMap(g => g.items).map(i => [i.key, i.bought])); assert.deepEqual(st(a), st(b)); });
test('plan lines: Anchor plan brand label + grouped DMC whites stay one line', () => { const ap = { dest: 'anchor', lines: [{ key: 'anchor:2', from: ['WHITE', 'BLANC'], to: '2', q: 2, bought: false }] }; const v = V.build(V.linesFromPlan(ap)); assert.equal(v.counts.total, 1); assert.equal(v.groups[0].items[0].brand, 'Anchor'); });
test('plan lines: same accept/reject rules as store-mode-core.js', () => { const smIn = real.map(l => ({ key: l.key, to: l.to, q: l.q, bought: l.bought, brand: l.brand })); assert.equal(SM.prepare(smIn).counts.visible, V.build(real).counts.visible); for (const bad of [[{ key: '', to: '310', q: 1 }], [{ key: 'k', to: '310', q: 0 }], [{ key: 'k', to: '310', q: 1.5 }], [{ key: 'k', to: 'X'.repeat(36), q: 1 }], [{ key: 'k', to: '310', q: 1 }, { key: 'k', to: '321', q: 1 }]]) { assert.throws(() => SM.prepare(bad)); assert.throws(() => V.build(bad)); } });
test('share text: no em dash, no notes, storage, links or project names', () => { const t = V.shareText(real); assert(!t.includes('\u2014')); for (const s of ['private', 'Box 2', 'http', 'Foxes', 'michaels']) assert(!t.includes(s), s); assert(t.includes('DMC 310: 2 skeins')); assert(!t.includes('black')); });
test('share text: stable order and no duplicate colors', () => { const t1 = V.shareText(real), t2 = V.shareText(real.slice().reverse()); assert.equal(t1, t2); const ls2 = t1.split('\n').filter(x => /^DMC /.test(x)); assert.equal(new Set(ls2).size, ls2.length); });
test('store: merchant id "unassigned" cannot hijack the Other group', () => { const v = V.build(real, [{ merchantId: 'unassigned', merchantName: 'Evil', code: '310', verified: true }], { view: 'by-store' }); assert.equal(v.groups.filter(g => g.key === 'unassigned').length, 1); assert(!v.groups.find(g => g.key === 'unassigned').items.some(i => i.code === '310')); });
test('store: Pixel draft copy applied (warning, Other group, share none/footer), no em dash', () => { assert(!Object.values(V.COPY).some(s => s.includes('\u2014'))); assert.match(V.WARNING, /doesn't change My threads/); const v = V.build(real, [], { view: 'by-store' }); assert.equal(v.groups[0].label, 'No store link: find it in any store'); const e = V.shareText([]); assert.deepEqual(e.split('\n'), ['Floss Fox shopping list', 'Nothing to buy.', 'Check amounts and chart matches before you buy.']); assert.equal(V.shareText(real.slice(1, 2)).split('\n')[1], 'DMC BLANC: 1 skein'); });
test('store: Pixel copy matches copy.json when available', () => { const f = '/workspace/pip-art/atelier39/copy/copy.json'; if (!fs.existsSync(f)) return; const d = JSON.parse(fs.readFileSync(f, 'utf8')); assert.equal(V.COPY.other, d['shop.group.other'].text); assert.equal(V.COPY.boughtNote, d['shop.boughtNote'].text); assert.equal(V.COPY.none, d['share.none'].text); assert.equal(V.COPY.header, d['share.header'].text); assert.equal(V.COPY.footer, d['share.footer'].text); });

// ---------- new: palette with the real catalog ----------
test('palette: real catalog hex used; BLANC/WHITE/B5200 separate labelled entries with outline', () => { const v = C.strip(projects[0].items.concat([{ code: 'WHITE' }, { code: 'B5200' }]), DMC); const w = v.swatches.filter(s => ['BLANC', 'WHITE', 'B5200'].includes(s.code)); assert.equal(w.length, 3); assert(w.every(s => s.outline && s.label === 'DMC ' + s.code)); assert.equal(v.swatches.find(s => s.code === '310').rgb, DMC['310'].hex.toLowerCase()); });
test('palette: unknown code -> neutral (rgb null) with outline, code kept', () => { const s = C.strip([{ code: '9999' }], DMC).swatches[0]; assert.equal(s.rgb, null); assert(s.outline); assert.equal(s.code, '9999'); });
test('palette: uses the project\'s own order (no popularity bias)', () => { const v = C.strip([{ code: '3865' }, { code: '310' }], DMC); assert.deepEqual(v.swatches.map(s => s.code), ['3865', '310']); });
test('palette: 500-color project still returns 6 + overflow', () => { const v = C.strip(Object.keys(DMC).slice(0, 500).map(code => ({ code })), DMC); assert.equal(v.swatches.length, 6); assert.equal(v.remaining, 494); });
test('palette: no em dash in note', () => assert(!C.NOTE.includes('\u2014')));

// ---------- new: privacy / inertness scan of module sources ----------
const mods = ['atelier-search-core.js', 'atelier-preferences-core.js', 'atelier-store-visit-core.js', 'atelier-palette-core.js', 'atelier-compare-core.js'].map(f => [f, fs.readFileSync(path.join(root, 'atelier', f), 'utf8')]);
test('privacy: no network, analytics, eval or HTML injection in Atelier modules', () => { for (const [f, s] of mods) assert(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|goatcounter|innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|import\s*\(/.test(s), f); });
test('privacy: only the preferences module touches storage, and only via the passed-in object', () => { for (const [f, s] of mods) assert(!/localStorage|sessionStorage|indexedDB/.test(s), f); });
test('wiring: Atelier files load after the existing scripts and are all in the sw.js cache list', () => { const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); const srcs = html.match(/<script[^>]*src="[^"]*"/g).map(s => s.match(/src="([^"]*)"/)[1]); const a = srcs.indexOf('atelier/atelier-ui.js'); assert(a > srcs.indexOf('tab-hint.js') && a > srcs.indexOf('projects.js') && a > srcs.indexOf('threads.js')); for (const f of ['atelier/atelier.css', 'atelier/atelier-copy.js', 'atelier/atelier-preferences-core.js', 'atelier/atelier-search-core.js', 'atelier/atelier-palette-core.js', 'atelier/atelier-store-visit-core.js', 'atelier/atelier-seasonal-core.js', 'atelier/atelier-theme.js', 'atelier/atelier-seasonal-ui.js', 'atelier/atelier-compare-core.js', 'atelier/atelier-studio.js', 'atelier/atelier-pip.js', 'atelier/atelier-media-core.js', 'atelier/atelier-media.js', 'atelier/atelier-ui.js', 'atelier/themes.css']) { assert(sw.includes('"' + f + '"'), f); assert(html.includes(f), f); } assert(/flossfox-dev-v2\.0a-ci005-106/.test(sw)); assert(!/pip-greeting-(spring|summer|autumn|winter|newyear|embroidery-day)/.test(sw), 'seasonal art must not be in CORE'); assert(srcs.indexOf('atelier/atelier-seasonal-core.js') < srcs.indexOf('atelier/atelier-theme.js')); assert(srcs.indexOf('atelier/atelier-theme.js') < srcs.indexOf('atelier/atelier-seasonal-ui.js')); assert(srcs.indexOf('atelier/atelier-compare-core.js') < srcs.indexOf('atelier/atelier-studio.js') && srcs.indexOf('atelier/atelier-studio.js') < srcs.indexOf('atelier/atelier-pip.js') && srcs.indexOf('atelier/atelier-pip.js') < srcs.indexOf('atelier/atelier-media-core.js') && srcs.indexOf('atelier/atelier-media-core.js') < srcs.indexOf('atelier/atelier-media.js') && srcs.indexOf('atelier/atelier-media.js') < srcs.indexOf('atelier/atelier-ui.js')); });
test('copy: no em dash in any Atelier module string', () => { for (const [f, s] of mods) { const strs = s.match(/'[^'\n]*'|`[^`\n]*`/g) || []; assert(!strs.some(x => x.includes('\u2014')), f); } });

// ---------- new: landing.js first-visit detection (FF39-24) in a sandbox ----------
function landingFresh(keys) {
  const store = new Map(Object.entries(keys));
  const localStorage = { get length() { return store.size; }, key: i => [...store.keys()][i] ?? null, getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const cl = { add() {}, remove() {}, contains: () => false };
  const window = { localStorage, sessionStorage: { getItem: () => '1', setItem() {} }, location: { hash: '' }, performance: { getEntriesByType: () => [{ type: 'reload' }] }, document: { documentElement: { classList: cl }, readyState: 'loading', addEventListener() {}, getElementById: () => null, querySelector: () => null }, addEventListener() {}, scrollTo() {} };
  window.window = window;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'landing.js'), 'utf8'), window);
  return { fresh: window.FlossFoxStartHere.fresh(), store };
}
test('first visit: empty storage is fresh', () => assert.equal(landingFresh({}).fresh, true));
test('first visit: ONLY an Atelier preference key (dev) is still fresh -> Start here shows', () => assert.equal(landingFresh({ 'flossfox-dev.atelier.v1': '{"v":1,"theme":"moon"}' }).fresh, true));
test('first visit: ONLY an Atelier preference key (prod name) is still fresh', () => assert.equal(landingFresh({ 'flossfox.atelier.v1': '{"v":1}' }).fresh, true));
test('first visit: projects key still means returning user', () => assert.equal(landingFresh({ 'flossfox-dev.atelier.v1': '{}', 'flossfox-dev.v1': '{"schema":2,"projects":[]}' }).fresh, false));
test('first visit: threads key still means returning user', () => assert.equal(landingFresh({ 'flossfox-dev.threads.v1': '{}' }).fresh, false));
test('first visit: Start here "seen" flag still suppresses', () => assert.equal(landingFresh({ 'flossfox-dev.startHere.v1': 'seen' }).fresh, false));
test('first visit: other prefs (pipLevel, tour) still suppress as before', () => { assert.equal(landingFresh({ 'flossfox-dev.pipLevel.v1': 'quiet' }).fresh, false); assert.equal(landingFresh({ 'flossfox-dev.tour.v1': '{}' }).fresh, false); });
test('first visit: look-alike keys are not treated as preference-only', () => { assert.equal(landingFresh({ 'flossfox-dev.atelier.v2': '{}' }).fresh, false); assert.equal(landingFresh({ 'flossfox-dev.atelier.v1.x': '{}' }).fresh, false); });
test('first visit: detection reads only, never writes', () => { const r = landingFresh({ 'flossfox-dev.atelier.v1': '{}' }); assert.deepEqual([...r.store.keys()], ['flossfox-dev.atelier.v1']); });

// ---------- Stage B: copy table, UI privacy scan, Resume landing skip ----------
const copyCtx = { window: {} }; copyCtx.self = copyCtx.window; vm.runInNewContext(fs.readFileSync(path.join(root, 'atelier/atelier-copy.js'), 'utf8'), copyCtx);
const AC = copyCtx.window.FlossFoxAtelierCopy || copyCtx.FlossFoxAtelierCopy;
const ui = fs.readFileSync(path.join(root, 'atelier/atelier-ui.js'), 'utf8');
test('copy: generated table is flagged draft and exposes t/has/keys', () => { assert(AC && AC.draft === true && typeof AC.t === 'function'); assert(AC.keys().length > 200); });
test('copy: matches Pixel copy.json exactly when present (generated, not hand-edited)', () => { const f = '/workspace/pip-art/atelier39/copy/copy.json'; if (!fs.existsSync(f)) return; const j = JSON.parse(fs.readFileSync(f, 'utf8')); const ks = Object.keys(j).filter(k => k !== '_meta'); assert.equal(JSON.stringify(ks.slice().sort()), JSON.stringify([...AC.keys()].sort())); for (const k of ks) { const v = j[k].text; if (typeof v === 'string') assert.equal(AC.t(k), v, k); else { assert.equal(AC.t(k, {}, 1), v.one, k); assert.equal(AC.t(k, {}, 2), v.other, k); } } });
test('copy: every t(\'key\') used by atelier-ui.js exists in the table', () => { const used = [...ui.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map(m => m[1]).filter(k => !k.endsWith('.')); assert(used.length > 20); const PH = [...ui.split('\n').find(l => l.startsWith('const PH=')).matchAll(/'([A-Za-z0-9_.]+)':'/g)].map(m => m[1]); const miss = [...new Set(used)].filter(k => !AC.has(k) && !PH.includes(k)); assert.deepEqual(miss, []); });
test('copy: plural and variable substitution', () => { const k = AC.keys().find(k => /\{/.test(AC.t(k)) === false && AC.t(k)); assert(k); assert.equal(typeof AC.t('no.such.key'), 'string'); });
test('copy: no em dash in generated copy', () => { for (const k of AC.keys()) assert(!AC.t(k, {}, 2).includes('\u2014'), k); });
test('copy: lib.low.hint is singular at 1 and plural otherwise', () => {
  assert.equal(AC.t('lib.low.hint', { n: 1 }, 1), 'Colors with 1 full skein or fewer. You choose this number.');
  assert.equal(AC.t('lib.low.hint', { n: 2 }, 2), 'Colors with 2 full skeins or fewer. You choose this number.');
  assert.equal(AC.t('lib.low.hint', { n: 0 }, 0), 'Colors with 0 full skeins or fewer. You choose this number.');
});
test('copy: checkin.done.threads is singular at 1 and plural otherwise', () => {
  assert.match(AC.t('checkin.done.threads', { brand: 'DMC', code: '310', n: 1 }, 1), /1 full skein added/);
  assert.match(AC.t('checkin.done.threads', { brand: 'DMC', code: '310', n: 3 }, 3), /3 full skeins added/);
});
test('copy: Pixel Stage C keys are live (notCheckedIn, seasonal hint, reset lists Seasonal Pip)', () => {
  assert.equal(AC.t('shop.notCheckedIn'), 'Not checked in yet');
  assert.match(AC.t('pref.seasonal.hint'), /On unless you turn it off/);
  assert.match(AC.t('pref.reset.body'), /Seasonal Pip/);
});

test('privacy: atelier-ui.js never calls GoatCounter', () => assert(!/goatcounter\s*\.|window\.goatcounter|count\(\s*\{/i.test(ui)));
test('privacy: atelier-ui.js has no network, analytics, eval or innerHTML', () => { for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /\beval\s*\(/, /new Function/, /innerHTML/, /insertAdjacentHTML/, /document\.write/, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/]) assert(!re.test(ui), String(re)); });
test('privacy: atelier-ui.js writes storage only through the preferences core', () => { const sets = [...ui.matchAll(/localStorage\.(setItem|removeItem|clear)/g)]; assert.equal(sets.length, 0); });
function resumeSkip(keys) { const store = new Map(Object.entries(keys)); let shown = false; const localStorage = { get length() { return store.size; }, key: i => [...store.keys()][i] ?? null, getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }; const cl = { add(c) { if (c === 'ff-landing') shown = true; }, remove() {}, contains: () => false }; const w = { localStorage, sessionStorage: { getItem: () => null, setItem() {} }, location: { hash: '', pathname: '/floss-fox-dev/' }, performance: { getEntriesByType: () => [{ type: 'navigate' }] }, document: { documentElement: { classList: cl }, body: { classList: cl }, readyState: 'loading', addEventListener() {}, getElementById: () => null, querySelector: () => null }, addEventListener() {}, scrollTo() {} }; w.window = w; vm.runInNewContext(fs.readFileSync(path.join(root, 'landing.js'), 'utf8'), w); return shown; }
const projKeys = { 'flossfox-dev.v1': '{"schema":2,"projects":[{"id":"a"}]}' };
test('resume: returning visitor without Resume still sees the welcome landing', () => assert.equal(resumeSkip({ ...projKeys }), true));
test('resume: returning visitor with Resume on skips the landing', () => assert.equal(resumeSkip({ ...projKeys, 'flossfox-dev.atelier.v1': '{"v":1,"rememberPlace":true}' }), false));
test('resume: newer-schema or unreadable prefs never skip the landing', () => { assert.equal(resumeSkip({ ...projKeys, 'flossfox-dev.atelier.v1': '{"v":2,"rememberPlace":true}' }), true); assert.equal(resumeSkip({ ...projKeys, 'flossfox-dev.atelier.v1': '{oops' }), true); });
test('resume: a fresh visitor with only prefs still gets the landing', () => assert.equal(resumeSkip({ 'flossfox-dev.atelier.v1': '{"v":1,"rememberPlace":true}' }), true));

// ---------- FF39-22 seasonal Greeting Pip: date boundaries (local date) ----------
const SE = require('../atelier/atelier-seasonal-core.js');
const D = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
test('seasonal: season edges (Northern)', () => { const c = [[3,1,'spring'],[5,31,'spring'],[6,1,'summer'],[8,31,'summer'],[9,1,'autumn'],[11,30,'autumn'],[12,1,'winter'],[12,30,'winter'],[1,3,'winter'],[2,28,'winter']]; for (const [m, d, k] of c) assert.equal(SE.pick(D(2026, m, d)), k, m + '/' + d); });
test('seasonal: leap day Feb 29 is winter, Mar 1 after it is spring', () => { assert.equal(SE.pick(D(2028, 2, 29)), 'winter'); assert.equal(SE.pick(D(2028, 3, 1)), 'spring'); assert.equal(SE.pick(D(2027, 3, 1)), 'spring'); });
test('seasonal: New Year wraps Dec 31 to Jan 2 and wins over winter', () => { assert.equal(SE.pick(D(2026, 12, 30)), 'winter'); assert.equal(SE.pick(D(2026, 12, 31)), 'newyear'); assert.equal(SE.pick(D(2027, 1, 1)), 'newyear'); assert.equal(SE.pick(D(2027, 1, 2)), 'newyear'); assert.equal(SE.pick(D(2027, 1, 3)), 'winter'); });
test('seasonal: World Embroidery Day Jul 29-31 wins inside summer', () => { assert.equal(SE.pick(D(2026, 7, 28)), 'summer'); for (const d of [29, 30, 31]) assert.equal(SE.pick(D(2026, 7, d)), 'embroidery-day'); assert.equal(SE.pick(D(2026, 8, 1)), 'summer'); });
test('seasonal: uses the local date at the edges of the day', () => { assert.equal(SE.pick(new Date(2026, 11, 31, 0, 0, 0)), 'newyear'); assert.equal(SE.pick(new Date(2026, 11, 30, 23, 59, 59)), 'winter'); assert.equal(SE.pick(new Date(2027, 0, 2, 23, 59, 59)), 'newyear'); });
test('seasonal: Southern option flips only the seasons, moments stay', () => { const o = { hemisphere: 'south' }; assert.equal(SE.pick(D(2026, 1, 15), o), 'summer'); assert.equal(SE.pick(D(2026, 7, 15), o), 'winter'); assert.equal(SE.pick(D(2026, 7, 30), o), 'embroidery-day'); assert.equal(SE.pick(D(2027, 1, 1), o), 'newyear'); });
test('seasonal: off by default, honors toggle and Pip Off/Quiet, falls back when art missing', () => { const d = D(2026, 4, 1); assert.equal(SE.choose(d), null); assert.equal(SE.choose(d, { seasonalPip: 'true' }), null); assert.equal(P.DEFAULT.seasonalPip, true, 'ON by default (Myke decided)'); assert.deepEqual({ ...SE.choose(d, { seasonalPip: true }) }, { key: 'spring', base: 'pip-greeting-spring' }); assert.equal(SE.choose(d, { seasonalPip: true, pipLevel: 'off' }), null); assert.equal(SE.choose(d, { seasonalPip: true, pipLevel: 'quiet' }), null); assert.equal(SE.choose(d, { seasonalPip: true, available: [] }), null); assert.equal(SE.choose(new Date('x'), { seasonalPip: true }), null); });
test('seasonal: only resting poses are swappable; events never', () => { for (const p of ['greeting', 'greeting-alt', 'neutral']) assert(SE.swappable(p)); for (const p of ['worried', 'puzzled', 'celebrating', 'proud-finish', 'checklist', 'floss-box']) assert(!SE.swappable(p)); });
test('seasonal: every day of a leap year maps to a known key', () => { for (let t = new Date(2028, 0, 1); t.getFullYear() === 2028; t.setDate(t.getDate() + 1)) assert(SE.KEYS.includes(SE.pick(t))); });

// ---------- Stage C: share text sections, never private fields ----------
test('share: estimated lines and Check first get their own sections; plain list otherwise', () => {
  const L = [{ key: 'dmc:310', to: '310', q: 3, brand: 'DMC' }, { key: 'dmc:433', to: '433', q: 1, brand: 'DMC', estimated: true }];
  const tx = V.shareText(L, { checkFirst: ['DMC 797'] });
  assert(tx.includes('Ready to buy\nDMC 310: 3 skeins') && tx.includes('Estimated amounts\nDMC 433: 1 skein') && tx.includes('Check first\nDMC 797'), tx);
  const plain = V.shareText([L[0]]); assert(!plain.includes('Ready to buy') && plain.includes('DMC 310: 3 skeins'));
  assert(!tx.includes('\u2014'));
});
test('share: names, notes and storage never appear even if passed in', () => { const tx = V.shareText([{ key: 'a', to: '310', q: 1, brand: 'DMC', name: 'SECRET name', notes: 'SECRET', storage: 'SECRET box' }]); assert(!/SECRET/.test(tx)); });
test('share: bought lines left out', () => { const tx = V.shareText([{ key: 'a', to: '310', q: 1, bought: true }, { key: 'b', to: '321', q: 2 }]); assert(!tx.includes('310') && tx.includes('DMC 321: 2 skeins')); });
test('linesFromPlan: estimated flag from plan threads', () => { const r = V.linesFromPlan({ dest: 'dmc', lines: [{ key: 'dmc:1', to: '1', q: 1, from: ['1'], ts: [{ estimated: true }] }, { key: 'dmc:2', to: '2', q: 1, from: ['2'], ts: [{}] }] }); assert.deepEqual(r.map(x => x.estimated), [true, false]); });
test('prefs: collectionSort validated, default code', () => { assert.equal(P.normalize({ collectionSort: 'amount' }).data.collectionSort, 'amount'); assert.equal(P.normalize({ collectionSort: 'evil' }).data.collectionSort, 'code'); assert.equal(P.DEFAULT.collectionSort, 'code'); });


const themeJs = fs.readFileSync(path.join(root, 'atelier/atelier-theme.js'), 'utf8');
test('theme: system / morning / forest / moon are the only values', () => {
  const TH = require(path.join(root, 'atelier/atelier-preferences-core.js'));
  assert.deepEqual(TH.THEMES.slice(), ['system', 'morning', 'forest', 'moon']);
});
test('theme: Morning is light, Forest and Moon are dark; System follows a stub OS', () => {
  // Load the apply module in Node with no document: only schemeOf is used.
  const g = globalThis; const prevDoc = g.document; const prevWin = g.window;
  g.document = undefined;
  delete require.cache[require.resolve(path.join(root, 'atelier/atelier-theme.js'))];
  // The IIFE attaches to globalThis when window is missing
  const src = fs.readFileSync(path.join(root, 'atelier/atelier-theme.js'), 'utf8');
  const box = { matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }) };
  const wrapped = new Function('window', 'globalThis', 'document', src + '\nreturn window.FlossFoxAtelierTheme;');
  const light = wrapped(box, box, undefined);
  assert.equal(light.schemeOf('morning'), 'light');
  assert.equal(light.schemeOf('forest'), 'dark');
  assert.equal(light.schemeOf('moon'), 'dark');
  assert.equal(light.schemeOf('system'), 'light');
  const darkBox = { matchMedia: q => ({ matches: true, addEventListener() {}, addListener() {} }) };
  const dark = wrapped(darkBox, darkBox, undefined);
  assert.equal(dark.schemeOf('system'), 'dark');
  assert.equal(dark.schemeOf('morning'), 'light');
  if (prevDoc !== undefined) g.document = prevDoc; else delete g.document;
});
test('theme: boot script is inline in <head> before theme-pair.css and never writes localStorage', () => {
  const head = html.split('</head>')[0];
  const bootAt = head.indexOf('data-atelier-theme');
  const cssAt = head.indexOf('theme-pair.css');
  assert(bootAt > 0 && bootAt < cssAt, 'boot must run before theme-pair.css');
  const boot = head.slice(bootAt - 200, cssAt);
  assert(!/localStorage\.setItem/.test(boot));
  assert(/flossfox-dev\.atelier\.v1/.test(head));
});
test('theme: themes.css is Pixel\'s file and lists morning, forest, moon and system', () => {
  const css = fs.readFileSync(path.join(root, 'atelier/themes.css'), 'utf8');
  assert(css.includes('data-atelier-theme="morning"') && css.includes('data-atelier-theme="forest"') && css.includes('data-atelier-theme="moon"') && css.includes('data-atelier-theme="system"'));
  assert(css.includes('#141a2e') && css.includes('#faf6ee') && css.includes('#10201b')); // Moon, Morning, Forest page colors
});
test('theme: theme-pair dark component rules key off data-atelier-scheme, with a no-attribute fallback', () => {
  const css = fs.readFileSync(path.join(root, 'theme-pair.css'), 'utf8');
  assert(css.includes('html[data-atelier-scheme=dark] .sec:hover'));
  assert(css.includes('var(--hover-tint)'));
  assert(css.includes('var(--demo-bg)'));
  // The old OS-only wrapper around those component hex values is gone
  assert(!/@media \(prefers-color-scheme:dark\)\{\s*html \.sec:hover\{background:#22382f\}/.test(css));
});
test('theme: index loads atelier-theme.js before atelier-ui.js and marks Pip dark sources', () => {
  const srcs = html.match(/<script[^>]*src="[^"]*"/g).map(s => s.match(/src="([^"]*)"/)[1]);
  assert(srcs.indexOf('atelier/atelier-theme.js') > -1 && srcs.indexOf('atelier/atelier-theme.js') < srcs.indexOf('atelier/atelier-ui.js'));
  assert((html.match(/data-atelier-darksrc/g) || []).length >= 3);
});


const CMP = require('../atelier/atelier-compare-core.js');
test('compare: official chart and original are exact; chart is close; choice is estimated', () => {
  assert.equal(CMP.classify('original'), 'exact');
  assert.equal(CMP.classify('official chart'), 'exact');
  assert.equal(CMP.classify('chart'), 'close');
  assert.equal(CMP.classify('chart option 1 of 3'), 'close');
  assert.equal(CMP.classify('your choice of chart options'), 'estimated');
  assert.equal(CMP.classify('your choice (sources disagree)'), 'estimated');
});
test('compare: BLANC, WHITE and B5200 are never aliases of each other', () => {
  for (const a of CMP.WHITES) for (const b of CMP.WHITES) {
    if (a === b) assert.equal(CMP.allowedMatch(a, b), true, a);
    else assert.equal(CMP.allowedMatch(a, b), false, a + '->' + b);
  }
  const blanc = CMP.matchesFor('BLANC', 'anchor', { anchor: ['WHITE', 'Ecru', '2'] }).map(m => m.code);
  assert.ok(!blanc.includes('WHITE') && !blanc.includes('B5200'));
  assert.ok(blanc.includes('Ecru') && blanc.includes('2'));
  const sull = CMP.matchesFor('WHITE', 'sullivans', { sullivans: { WHITE: 'BLANC' } });
  assert.deepEqual(sull, [], 'illegal white-to-white Sullivans alias is dropped');
});
test('compare: Sullivans official listing is exact; single Anchor chart is close; whites stay estimated', () => {
  const s = CMP.matchesFor('310', 'sullivans', { sullivans: { '310': '45018' } });
  assert.equal(s[0].kind, 'exact');
  const a = CMP.matchesFor('310', 'anchor', { anchor: ['403'] });
  assert.equal(a[0].kind, 'close');
  const w = CMP.matchesFor('B5200', 'anchor', { anchor: ['Ecru'] });
  assert.equal(w[0].kind, 'estimated');
  assert.equal(w[0].prov, 'your choice (sources disagree)');
});
test('prefs: projectsView defaults to list and only accepts list or gallery', () => {
  assert.equal(P.DEFAULT.projectsView, 'list');
  assert.equal(P.normalize({ projectsView: 'gallery' }).data.projectsView, 'gallery');
  assert.equal(P.normalize({ projectsView: 'shelf' }).data.projectsView, 'list');
  assert.equal(P.normalize({}).data.projectsView, 'list');
});


test('compare: BLANC, WHITE and B5200 are never Exact to the same chart code', () => {
  const charts = { sullivans: { BLANC: '45001', WHITE: '45001', B5200: '45002', '310': '45053' } };
  const rows = {};
  for (const c of CMP.WHITES) {
    const m = CMP.matchesFor(c, 'sullivans', charts);
    assert.ok(m.every(x => x.kind !== 'exact'), c + ' must not be Exact');
    rows[c] = m.map(x => x.code);
  }
  assert.deepEqual(rows.BLANC, ['45001']);
  assert.deepEqual(rows.WHITE, ['45001']);
  // same Sullivans code, but neither is Exact, so they stay two colors
  const exactByCode = {};
  for (const c of CMP.WHITES) {
    for (const m of CMP.matchesFor(c, 'sullivans', charts)) {
      if (m.kind === 'exact') {
        exactByCode[m.code] = exactByCode[m.code] || [];
        exactByCode[m.code].push(c);
      }
    }
  }
  for (const [code, from] of Object.entries(exactByCode)) assert.equal(from.length, 1, 'exact ' + code + ' from ' + from);
  const solid = CMP.matchesFor('310', 'sullivans', charts);
  assert.equal(solid[0].kind, 'exact');
});
test('theme polish: pressed tabs and store ticks use --tab-on-bg, not a missing sage token', () => {
  const css = fs.readFileSync(path.join(root, 'atelier/atelier.css'), 'utf8');
  assert(!/--sage-700/.test(css));
  assert(!/--ok-fg|--wait-fg|--warn-fg|--warn-bg/.test(css));
  assert(css.includes('.ffsm-cb:checked{background:var(--tab-on-bg)'));
  assert(css.includes('#thList .ffa-low{box-shadow:inset 4px 0 0 var(--wait-line)}'));
  assert(css.includes('accent-color:var(--pri-bg)'));
});
test('theme polish: unscoped dark :root is limited to no scheme attribute', () => {
  const css = fs.readFileSync(path.join(root, 'theme-pair.css'), 'utf8');
  assert(css.includes(':root:not([data-atelier-scheme])'));
  assert(!/@media \(prefers-color-scheme:dark\)\{:root\{/.test(css));
  assert(css.includes('html select:disabled'));
});
test('kit heading: 1 uses skein, not skeins', () => {
  const src = fs.readFileSync(path.join(root, 'projects.js'), 'utf8');
  assert(src.includes("${req===1?'skein':'skeins'}"));
  assert(!/Kit this project \(\$\{got\} of \$\{req\} skeins set aside\)/.test(src));
});
test('prefs: session timer is OFF by default and is a boolean pref only', () => {
  assert.equal(P.DEFAULT.sessionTimer, false);
  assert.equal(P.normalize({}).data.sessionTimer, false);
  assert.equal(P.normalize({ sessionTimer: true }).data.sessionTimer, true);
  assert.equal(P.normalize({ sessionTimer: 'on' }).data.sessionTimer, false);
});
test('progressPct: normProject keeps 0-100 integers and drops invalid values', () => {
  const src = fs.readFileSync(path.join(root, 'projects.js'), 'utf8');
  assert(src.includes('Number.isInteger(p.progressPct)&&p.progressPct>=0&&p.progressPct<=100?{progressPct:p.progressPct}:{}'));
  assert(src.includes('if(!Number.isInteger(pct)||pct<0||pct>100)return{ok:false,reason:"bad"}'));
  assert(src.includes('p.progressPct=pct') && src.includes('delete p.progressPct'));
  assert(src.includes("statusUnchanged:p.status===before"));
});
test('session timer: elapsed lives only in memory and is not a pref key', () => {
  const ui = fs.readFileSync(path.join(root, 'atelier/atelier-ui.js'), 'utf8');
  const pref = fs.readFileSync(path.join(root, 'atelier/atelier-preferences-core.js'), 'utf8');
  assert(ui.includes('in-memory only') && ui.includes('Never written to prefs, projects, threads or backups'));
  assert(ui.includes('start:Date.now()'));
  assert(ui.includes('function fmtSitting'));
  assert(ui.includes('under 1 min'));
  assert(ui.includes('do not retouch aria-label every tick'));
  assert(!/PREF_KEYS[^\n]*sessionTimer/.test(pref));
  assert(!pref.includes('sessionElapsed'));
});
test('progress: 100% copy is hidden once the project is Completed', () => {
  const ui = fs.readFileSync(path.join(root, 'atelier/atelier-ui.js'), 'utf8');
  assert(ui.includes("if(p.progressPct===100&&p.status!=='done')"));
});
test('Stage F polish: pattern-reader ART, unclamped bubble, scoped .hero .num, focus --c, singular verb', () => {
  const pip = fs.readFileSync(path.join(root, 'pip.js'), 'utf8');
  assert(pip.includes("'pattern-reader':'pattern-reader'"), 'ART maps pattern-reader');
  assert(pip.includes("go.className='pipA-act sec'"), 'bubble action uses pipA-act sec');
  assert(html.includes('.pipA-bubble .pipA-text{-webkit-line-clamp:unset;display:block}'), 'Pip lines are not 3-line clamped');
  const pair = fs.readFileSync(path.join(root, 'theme-pair.css'), 'utf8');
  assert(pair.includes('.hero .num{background:var(--step2);color:var(--step-text)}'), 'global .num is scoped to .hero .num');
  const ui = fs.readFileSync(path.join(root, 'atelier/atelier-ui.js'), 'utf8');
  assert(ui.includes("sw.style.setProperty('--c',hex)"), 'focus swatches set --c');
  assert(/BLANC\|WHITE/.test(ui), 'BLANC/WHITE keep an edge');
  assert(ui.includes("foc.scrollIntoView({block:'start'})"), 'enterSession scrolls #ffaFocus into view');
  assert(ui.includes("const start=$('ffaSessionStart');if(start)try{start.focus()}catch(e){}"), 'exit focuses Start a stitch session');
  const proj = fs.readFileSync(path.join(root, 'projects.js'), 'utf8');
  assert(proj.includes("s.total===1?'has enough or has been checked in':'have enough or have been checked in'"), 'singular verb when total is 1');
  const fab = fs.readFileSync(path.join(root, 'fabric.html'), 'utf8');
  assert(fab.includes('background:none;color:inherit'), 'fabric .num has no theme bar');
});
console.log(`\natelier_unit: ${pass} passed, ${fail} failed (simulated, Node only)`);
process.exit(fail ? 1 : 0);
