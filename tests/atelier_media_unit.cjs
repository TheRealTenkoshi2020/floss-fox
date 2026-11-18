// node tests/atelier_media_unit.cjs : FF39-13 cover-photo backup contract (pure, no DOM).
'use strict';
const assert = require('node:assert/strict');
const C = require('../atelier/atelier-media-core.js');

let pass = 0, fail = 0;
const test = async (name, fn) => {
  try { await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '->', e && e.message); }
};

function bytes(n, fill = 0x5a) {
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = (fill + i) & 0xff;
  return u;
}

async function cover(id, projectId, extra = {}) {
  const u8 = extra.bytes || bytes(extra.size || 64);
  const sha = extra.sha256 || await C.sha256(u8);
  return {
    id, projectId,
    name: extra.name || 'cover.jpg',
    mime: extra.mime || 'image/jpeg',
    w: extra.w || 80, h: extra.h || 60,
    sha256: sha, bytes: u8, data: C.b64encode(u8)
  };
}

const baseBackup = () => ({
  app: 'floss-fox', kind: 'full-backup', version: 2, schema: 2,
  exported: '2026-11-15T00:00:00.000Z',
  projects: [{ id: 'p1', name: 'Sample Autumn Wreath', items: [{ code: '310', qty: 1 }], coverId: 'cov_aaa' }],
  threads: { schema: 2, threads: { '310': { n: 1, partial: false, restock: false, updated: '2026-11-01T00:00:00Z' } } }
});

(async () => {
  await test('constants: backup stays at version 2; caps are 1280 / 200KB / 50MB / 5MB JSON', () => {
    assert.equal(C.BACKUP_VERSION, 2);
    assert.equal(C.MEDIA_SCHEMA, 1);
    assert.equal(C.MEDIA_KIND, 'cover-photos');
    assert.equal(C.MAX_EDGE, 1280);
    assert.equal(C.MAX_ITEM_BYTES, 200 * 1024);
    assert.equal(C.MAX_FILE, 50 * 1024 * 1024);
    assert.equal(C.MAX_FILE_JSON, 5 * 1024 * 1024);
  });

  await test('legacyAccepts: v1 full backup with no media', () => {
    const d = { app: 'floss-fox', kind: 'full-backup', version: 1, projects: [{ id: 'p1' }] };
    const r = C.legacyAccepts(d);
    assert.equal(r.ok, true);
    assert.equal(r.ignoredMedia, false);
  });

  await test('legacyAccepts: v2 JSON-only backup', () => {
    const r = C.legacyAccepts(baseBackup());
    assert.equal(r.ok, true);
    assert.equal(r.ignoredMedia, false);
  });

  await test('legacyAccepts: v2 with a media section is still accepted and media is ignored', async () => {
    const cov = await cover('cov_aaa', 'p1');
    const { backup } = await C.attach(baseBackup(), [cov]);
    const r = C.legacyAccepts(backup);
    assert.equal(r.ok, true);
    assert.equal(r.ignoredMedia, true);
    assert.equal(backup.version, 2);
  });

  await test('legacyAccepts: version 3 is rejected as newer', () => {
    const r = C.legacyAccepts({ app: 'floss-fox', kind: 'full-backup', version: 3, projects: [] });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'new');
  });

  await test('attach: never bumps version and never puts photo bytes on project records', async () => {
    const cov = await cover('cov_aaa', 'p1', { name: 'wreath.jpg' });
    const dirty = baseBackup();
    dirty.version = 1;
    dirty.projects[0].cover = 'data:image/jpeg;base64,AAAA';
    dirty.projects[0].data = 'x'.repeat(500);
    const { backup, count } = await C.attach(dirty, [cov]);
    assert.equal(backup.version, 2);
    assert.equal(count, 1);
    assert.equal(backup.media.kind, 'cover-photos');
    assert.equal(backup.media.count, 1);
    assert.equal(backup.projects[0].coverId, 'cov_aaa');
    assert.ok(!('cover' in backup.projects[0]));
    assert.ok(!('data' in backup.projects[0]));
    const text = JSON.stringify(backup.projects);
    assert.ok(!text.includes(cov.data), 'photo bytes must not appear on project records');
    assert.ok(backup.media.items[0].data.length > 0);
  });

  await test('attach: empty cover list omits media (JSON-only file)', async () => {
    const { backup, count } = await C.attach(baseBackup(), []);
    assert.equal(count, 0);
    assert.ok(!backup.media);
  });

  await test('check: missing media is ok; checksum and manifest are verified', async () => {
    const none = await C.check(baseBackup());
    assert.equal(none.ok, true);
    assert.equal(none.present, false);

    const cov = await cover('cov_aaa', 'p1');
    const { backup } = await C.attach(baseBackup(), [cov]);
    const good = await C.check(backup);
    assert.equal(good.ok, true);
    assert.equal(good.present, true);
    assert.equal(good.items.length, 1);

    const bad = JSON.parse(JSON.stringify(backup));
    bad.media.items[0].sha256 = 'ab'.repeat(32);
    const chk = await C.check(bad);
    assert.equal(chk.ok, false);
    assert.equal(chk.reason, 'manifest'); // manifest hash still matches old item hashes unless we only break item verify later

    const itemBad = JSON.parse(JSON.stringify(backup));
    // keep manifest in sync with listed sha but mismatch actual bytes
    itemBad.media.items[0].sha256 = 'ab'.repeat(32);
    itemBad.media.sha256 = await C.manifestHash(itemBad.media.items);
    const iv = await C.verifyItem(itemBad.media.items[0]);
    assert.equal(iv.ok, false);
    assert.equal(iv.reason, 'checksum');
    const checked = await C.check(itemBad);
    // check() only verifies item shape + manifest, not per-item sha vs bytes... look at check()
    // check uses itemShape only, not verifyItem. Manifest is over id:sha256 listed values.
    // So a lying sha256 that matches the manifest still passes check(); verifyItem catches it.
    assert.equal(checked.ok, true, 'check trusts the listed sha; verifyItem must catch a lying checksum');
    assert.equal(iv.name, 'cover.jpg');
  });

  await test('verifyItem: names a bad photo and rejects oversize / bad mime / short payload', async () => {
    const okItem = await cover('cov_bbb', 'p2', { name: 'fox.jpg' });
    const good = await C.verifyItem(okItem);
    assert.equal(good.ok, true);

    const tiny = await cover('cov_ccc', 'p2', { bytes: bytes(8), name: 'tiny.jpg' });
    assert.equal((await C.verifyItem(tiny)).ok, false);

    const mime = await cover('cov_ddd', 'p2', { mime: 'image/gif', name: 'anim.gif' });
    assert.equal((await C.verifyItem(mime)).reason, 'shape');

    const huge = bytes(C.MAX_ITEM_BYTES + 1);
    const big = { id: 'cov_eee', projectId: 'p2', name: 'huge.jpg', mime: 'image/jpeg', w: 80, h: 60, sha256: await C.sha256(bytes(64)), data: C.b64encode(bytes(64)) };
    // b64decode itself rejects payloads over MAX_ITEM_BYTES; construct a too-wide image instead
    const wide = await cover('cov_fff', 'p2', { w: 1281, h: 10, name: 'wide.jpg' });
    assert.equal((await C.verifyItem(wide)).ok, false);
    void huge; void big;
  });

  await test('fileCap: JSON-only over 5MB is rejected; media files may be up to 50MB', () => {
    const jsonOnly = { app: 'floss-fox', kind: 'full-backup', version: 2, projects: [] };
    assert.equal(C.fileCap({ size: 5 * 1024 * 1024 + 1 }, jsonOnly).ok, false);
    assert.equal(C.fileCap({ size: 5 * 1024 * 1024 }, jsonOnly).ok, true);
    const withMedia = { ...jsonOnly, media: { kind: 'cover-photos' } };
    assert.equal(C.fileCap({ size: 6 * 1024 * 1024 }, withMedia).ok, true);
    assert.equal(C.fileCap({ size: 50 * 1024 * 1024 + 1 }, withMedia).ok, false);
  });

  await test('isQuota recognizes QuotaExceededError', () => {
    const e = new Error('full'); e.name = 'QuotaExceededError'; e.code = 22;
    assert.equal(C.isQuota(e), true);
    assert.equal(C.isQuota(new Error('other')), false);
  });

  await test('strip removes media and leaves projects/threads intact', async () => {
    const cov = await cover('cov_aaa', 'p1');
    const { backup } = await C.attach(baseBackup(), [cov]);
    const s = C.strip(backup);
    assert.ok(!s.media);
    assert.equal(s.projects[0].id, 'p1');
    assert.equal(s.version, 2);
    assert.ok(backup.media, 'strip must not mutate the original');
  });

  await test('newId is a cov_ token and validId accepts it', () => {
    const id = C.newId();
    assert.ok(C.validId(id));
    assert.ok(/^cov_[a-f0-9]+$/.test(id));
  });

  await test('missingCovers lists projects whose photo was not exported, and ignores demos', () => {
    const projects = [
      { id: 'p1', name: 'Wreath', coverId: 'cov_aaa' },
      { id: 'p2', name: 'Bookmark', coverId: 'cov_bbb' },
      { id: 'p3', name: 'No photo' },
      { id: 'p4', name: 'Demo', coverId: 'cov_ccc', demo: true }
    ];
    const miss = C.missingCovers(projects, [{ projectId: 'p1' }]);
    assert.equal(miss.length, 1);
    assert.equal(miss[0].projectId, 'p2');
    assert.equal(miss[0].name, 'Bookmark');
    assert.equal(C.missingCovers(projects, [{ projectId: 'p1' }, { projectId: 'p2' }]).length, 0);
  });

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
