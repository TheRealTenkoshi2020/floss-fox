// Support links unit tests (Node: node --test tests/support_links_unit.cjs). Results are simulated (no browser, fake URLs).
// Part 1: the Monetization Launch Kit's 13 tests, ported to support/links.js. One is inverted on purpose
// (PayPal is no longer on the exact-host allowlist) and one is adapted to the new view model shape.
// Part 2: tests for the fixes made during integration.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../support/links.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'support', 'links.js'), 'utf8');

// ---- Part 1: kit tests (ported) ----
test('KIT-1 valid Ko-fi creator link', () => assert.equal(M.safeCheckoutUrl('https://ko-fi.com/example'), 'https://ko-fi.com/example'));
test('KIT-2 valid Stripe checkout link', () => assert.equal(M.safeCheckoutUrl('https://buy.stripe.com/test_abc'), 'https://buy.stripe.com/test_abc'));
test('KIT-3 (inverted) PayPal link now rejected: not on the exact-host allowlist', () => assert.equal(M.safeCheckoutUrl('https://www.paypal.com/donate/?hosted_button_id=123'), null));
test('KIT-4 reject protocol downgrade', () => assert.equal(M.safeCheckoutUrl('http://ko-fi.com/example'), null));
test('KIT-5 reject spoofed hostname', () => assert.equal(M.safeCheckoutUrl('https://ko-fi.com.evil.example/x'), null));
test('KIT-6 reject deceptive substring domain', () => assert.equal(M.safeCheckoutUrl('https://this-is-ko-fi.com/x'), null));
test('KIT-7 reject credentials', () => assert.equal(M.safeCheckoutUrl('https://someone@ko-fi.com/u'), null));
test('KIT-8 reject relative url', () => assert.equal(M.safeCheckoutUrl('/tip'), null));
test('KIT-9 reject empty url', () => assert.equal(M.safeCheckoutUrl(''), null));
test('KIT-10 (adapted) no support CTA until real URL entered', () => {
  const v = M.viewModel({});
  assert.equal(v.support, null); assert.equal(v.pack, null); assert.equal(v.show, false); assert.deepEqual(v.items, []);
  assert.equal(v.note, "Floss Fox stays free. Supporting is optional and doesn't change your projects or thread collection."); // Pixel's support.note.free
});
test('KIT-11 pack CTA only when URL exists', () => assert.equal(M.viewModel({ packUrl: 'https://ko-fi.com/s/foo' }).support, null));
test('KIT-12 pack price validated, not HTML', () => assert.match(M.viewModel({ packUrl: 'https://ko-fi.com/s/foo', packPrice: '<img src=x>' }).pack.label, /\$7/));
test('KIT-13 preserve official checkout URL without added project metadata', () => assert.equal(M.viewModel({ supportUrl: 'https://ko-fi.com/fox' }).support.href, 'https://ko-fi.com/fox'));

// ---- Part 2: fixes ----
test('FIX-CFG shipped config is empty: nothing shows until Myke pastes verified URLs', () => {
  assert.match(SRC, /var SUPPORT_URL = '';/); assert.match(SRC, /var PACK_URL = '';/);
  const v = M.viewModel(M.config()); assert.equal(v.show, false);
});
test('FIX-HOST exact hosts only: broad stripe.com, subdomains, PayPal and Buy Me a Coffee rejected', () => {
  for (const u of ['https://stripe.com/x', 'https://checkout.stripe.com/x', 'https://www.ko-fi.com/x', 'https://evil.ko-fi.com/x',
    'https://paypal.com/x', 'https://www.paypal.me/x', 'https://buymeacoffee.com/x', 'https://www.buymeacoffee.com/x', 'https://buy.stripe.com.evil.example/x'])
    assert.equal(M.safeCheckoutUrl(u), null, u);
  assert.deepEqual(Object.keys(M.PROVIDERS).sort(), ['buy.stripe.com', 'ko-fi.com']);
});
test('FIX-HOST host match is case-insensitive but still exact', () => assert.equal(M.safeCheckoutUrl('https://KO-FI.com/fox'), 'https://ko-fi.com/fox'));
test('FIX-QUERY any query string or fragment is rejected (tracking, prefill, referral)', () => {
  for (const u of ['https://ko-fi.com/fox?utm_source=app', 'https://ko-fi.com/fox?ref=ff', 'https://buy.stripe.com/abc?prefilled_email=a@b.c',
    'https://buy.stripe.com/abc?client_reference_id=1', 'https://ko-fi.com/fox?', 'https://ko-fi.com/fox#x', 'https://ko-fi.com/fox?fbclid=1', 'https://ko-fi.com/fox?gclid=1'])
    assert.equal(M.safeCheckoutUrl(u), null, u);
});
test('FIX-PATH bare provider homepage is not a checkout (no dead CTA)', () => {
  assert.equal(M.safeCheckoutUrl('https://ko-fi.com'), null); assert.equal(M.safeCheckoutUrl('https://ko-fi.com/'), null);
  assert.equal(M.safeCheckoutUrl('https://buy.stripe.com/'), null);
});
test('FIX-PORT/SCHEME/JUNK ports, other schemes, spaces, long and non-string values rejected', () => {
  for (const u of ['https://ko-fi.com:8443/fox', 'javascript:alert(1)', 'data:text/html,x', 'ftp://ko-fi.com/fox', 'https://ko-fi.com/a b', 'https://ko-fi.com/' + 'a'.repeat(2100), 'ko-fi.com/fox', null, undefined, 5, {}, []])
    assert.equal(M.safeCheckoutUrl(u), null, String(u));
});
test('FIX-EXACT URL is kept exactly as configured (no parameters added)', () => {
  const v = M.viewModel({ supportUrl: 'https://ko-fi.com/fox', packUrl: 'https://ko-fi.com/s/abc123' });
  assert.equal(v.support.href, 'https://ko-fi.com/fox'); assert.equal(v.pack.href, 'https://ko-fi.com/s/abc123');
});
test('FIX-PRIMARY link style is by kind, not by position: pack alone is never styled as the tip', () => {
  const only = M.viewModel({ packUrl: 'https://ko-fi.com/s/abc' });
  assert.equal(only.items.length, 1); assert.equal(only.items[0].kind, 'pack');
  const both = M.viewModel({ supportUrl: 'https://ko-fi.com/fox', packUrl: 'https://ko-fi.com/s/abc' });
  assert.deepEqual(both.items.map(i => i.kind), ['tip', 'pack']);
  assert.doesNotMatch(SRC, /i === 0 \?/); assert.match(SRC, /'ff-support-link ff-support-' \+ it\.kind/);
});
test('FIX-PIXEL copy is Pixel\'s support.* strings verbatim (dev draft pending Myke)', () => {
  const C = M.COPY;
  assert.equal(C.title, "Keep Pip's lantern glowing");
  assert.equal(C.intro, 'Floss Fox is free, and your projects and threads stay on this device. If it has helped your stitching, you can leave a tip or get our printable companion for your craft table.');
  assert.equal(C.tip, 'Support Floss Fox');
  assert.equal(C.pack('$7'), 'Buy the printable \u00b7 $7');
  assert.equal(C.packDetail('$7'), 'The Stitching Atelier Printable Companion: a 16-page US Letter PDF to print at home. $7, one time.');
  assert.equal(C.external(1), 'This link opens an external checkout in a new tab and needs an internet connection.');
  assert.equal(C.external(2), 'These links open an external checkout in a new tab and need an internet connection.');
  assert.equal(C.offline, "You're offline. Tips and the printable need an internet connection. Everything else in Floss Fox works as usual.");
  assert.equal(C.notePayment, 'Payment and the PDF download are handled by the checkout provider. We never see your card details.');
  assert.equal(C.ariaTip, 'Support Floss Fox (opens external checkout)');
  assert.equal(C.ariaPack('$7'), 'Buy the Stitching Atelier Printable Companion, $7 (opens external checkout)');
  assert.equal(C.privacy.length, 3); assert.match(C.privacy[2], /aren't tax deductible/);
  assert.match(SRC, /STATUS: DEV DRAFT PENDING MYKE/);
});
test('FIX-COPY no provider named, no em/en dashes, no spaced hyphens, no curly apostrophes, no gendered pronoun', () => {
  const C = M.COPY;
  const all = [C.title, C.intro, C.tip, C.pack('$7'), C.packDetail('$7'), C.external(1), C.external(2), C.offline, C.noteFree, C.notePayment, C.footer, C.ariaTip, C.ariaPack('$7'), C.privacyTitle].concat(C.privacy).join('\n');
  assert.doesNotMatch(all, /ko-?fi|stripe|paypal|buy ?me ?a ?coffee/i);
  assert.doesNotMatch(all, /[\u2014\u2013\u2019]/);
  assert.doesNotMatch(all, / - /);
  assert.doesNotMatch(all, /\b(he|she|his|her|him)\b/i);
  for (const b of [C.tip, C.pack('$7')]) assert.ok(b.length <= 30, b);
});
test('FIX-ONE-PLACE no user-facing string literals in render code outside COPY', () => {
  const body = SRC.slice(SRC.indexOf('function render('));
  assert.doesNotMatch(body, /textContent = '[A-Z]/); assert.doesNotMatch(body, /setAttribute\('aria-label', '/);
});
test('FIX-PRIVACY module never touches storage, cookies, fetch, beacons or analytics', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const bad of ['localStorage', 'sessionStorage', 'document.cookie', 'fetch(', 'sendBeacon', 'XMLHttpRequest', 'goatcounter', 'indexedDB', 'window.open', '<script', 'iframe'])
    assert.ok(!code.includes(bad), bad);
});
test('FIX-PRICE price format guarded', () => {
  assert.match(M.viewModel({ packUrl: 'https://ko-fi.com/s/a', packPrice: '$7' }).pack.label, / \$7$/);
  assert.match(M.viewModel({ packUrl: 'https://ko-fi.com/s/a', packPrice: '$7.00' }).pack.label, /\$7\.00/);
  assert.match(M.viewModel({ packUrl: 'https://ko-fi.com/s/a', packPrice: '7 dollars' }).pack.label, / \$7$/);
});
test('FIX-RENDER render fails closed without a host or document, and with bad URLs', () => {
  assert.equal(M.render(null, {}, {}), false);
  assert.equal(M.render({ replaceChildren() {} }, { supportUrl: 'http://ko-fi.com/x' }, { createElement() {} }), false);
});
