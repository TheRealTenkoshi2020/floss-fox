# V5 development integration

This is the complete Floss Fox development application, based on `TheRealTenkoshi2020/floss-fox-dev` main commit `ea6a2046a3ff661c9fae4ed9528d8cb025e7f6ed`. It includes the completed Gemini audit implementation (`34411f3`) and the November 18, 2026 sitewide V5 SEO delta. The earlier cumulative V5 archive contains the Smart Stash/Threadwood V4 implementation already merged in this baseline. Its older runtime files were not reapplied over the newer application.

## Available in the application

| Area | Where to find it and behavior |
| --- | --- |
| Smart Stash | My threads → Import a thread list opens the existing file mapping and review flow. Free paste, CSV/TSV/TXT/JSON/XLSX, catalog, audit and exports remain available. Photo/barcode scanners retain the existing dev-only free-testing gate. |
| Combined shopping | Shopping → Take a combined shopping list selects projects, sums requirements, subtracts confirmed stock once, and keeps uncertain amounts under Check first. Changing project selections immediately updates the list. Found is a persistent checklist mark, separate from purchases or received inventory. |
| Stitching journal | Open a project and expand Stitching journal. Record dates, stitches, minutes, notes and optional thread usage; view recap and chart. Logged usage never automatically subtracts stock. |
| Progress | Update a project's percentage manually. Logging a session does not silently infer percentage or change its lifecycle status. |
| Shareable lists | Share codes and quantities as a bounded URL. Reading a link changes no project or collection. Explicit import creates an independent project; uncertain amounts stay uncertain. Links are forwardable and not encrypted. |
| Color comparison | Settings → Advanced color comparison enables a separate HEX-to-DMC CIEDE2000 swatch tool. Results are estimates. Existing manufacturer mappings remain the default and BLANC, WHITE and B5200 remain distinct. |
| Conversion feedback | Help → Suggest a better thread match copies a structured report locally. It does not send feedback or alter the catalog. |
| Pip and Threadwood | Existing approved art, guided home, Den, timer, Journey, keepsakes and postcards remain integrated. |
| Guides | Tools directory, conversion guide, thread inventory guide and project planning guide link into the actual app. They explain the integrated features and work offline through the service worker. |
| Search presentation | Eight pages have unique titles/descriptions and social metadata. Homepage intro and guide links improve discovery. Only the brand disclosure has `data-nosnippet`; it remains readable. |

## Data and offline behavior

The existing project schema and storage keys remain compatible. Full backups, snapshots and restore/Undo include stitching sessions and preserve older backups. Journal history whose project is absent after a legacy restore is retained as archived JSON, rather than attached to another project. There is no archive browser in this version. See [audit integration](GEMINI_AUDIT_INTEGRATION.md) for the precise contracts.

The development cache is `flossfox-dev-v5-gemini-audit-2-seo5`. It includes all four guides and audit assets. Activation removes superseded development caches without changing localStorage or clearing other cache namespaces. Large OCR vendor binaries remain lazy loaded.

## Verification

Serve the complete repository on localhost, then run tests against that origin. Use isolated browser profiles; no tester data is needed.

```bash
python3 -m pip install playwright pytest beautifulsoup4
python3 -m http.server 8775 --bind 127.0.0.1
```

In another terminal, choose your installed Chromium executable:

```bash
export FF_CHROME=/usr/bin/chromium
export FF_KEY=flossfox-dev.v1
node tests/audit_unit.cjs
python3 -m pytest -q tools/sitewide-seo/tests/test_sitewide_seo.py
python3 tools/sitewide-seo/seo_audit.py . --site dev
python3 tools/sitewide-seo/apply_sitewide_seo.py . --site dev
python3 tests/v5_integration_e2e.py http://127.0.0.1:8775/
python3 tests/audit_real_e2e.py http://127.0.0.1:8775/
python3 tests/audit_integrity_e2e.py http://127.0.0.1:8775/
python3 tests/shopping_selection_e2e.py http://127.0.0.1:8775/
FF_COMPAT_ALL=1 PYTHONPATH=tests/compat python3 tests/regression.py http://127.0.0.1:8775/
```

The SEO installer dry-run should report no changes for this already integrated candidate. The V5 browser test checks eight real pages across five widths, fresh guide-to-app navigation, and an actual previous development service worker upgrading to V5 on the same origin, followed by offline use with saved synthetic projects, inventory and sessions.

The final engineering report and raw logs accompanying the full source archive record the exact suites actually run, results, publishing status and limitations. Emulated mobile widths are not physical-device certification.

The November 18 independent QA follow-up fixes stale displayed shopping results after project selections change in both shopping planners. The calculation engine is unchanged. A deliberately empty combined-trip selection persists and removes old share/copy actions; changing the list resets obsolete Found checkmarks. See [QA follow-up](V5_QA_FOLLOWUP.md) for the evidence and disposition of the other reported findings.

## Release boundaries

This development repository intentionally keeps `noindex`, robots disallow, development storage keys and the dev-only scanner testing gate. The production-mode SEO installer and schema/sitemap generation are included for a later separately approved release; their unit tests use temporary fixtures only. Never copy the dev build configuration into production.

Paid subscriptions require approved pricing, a payment provider, server identity/entitlements and billing lifecycle tests. No paid launch, server feedback inbox, physical-camera accuracy claim, cloud sync or search-ranking improvement is claimed by this candidate. Real DMC packaging/photos, physical phones, independent usability testers, assistive technology and production Search Console validation remain separate verification work.
