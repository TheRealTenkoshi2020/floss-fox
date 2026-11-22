# V5 independent QA follow-up — November 18, 2026

Reference build: development PR #27, `f61ebf761ac00f17c040f8473ebaca1b32acffd8`.

## Findings and disposition

| Report ID | Verified result | Action |
| --- | --- | --- |
| FFV5-001 | Reproduced stale displayed results after selecting different projects. The combined calculator itself reads current projects and collection on every call; no calculation cache exists in `planner.js`. In the controlled fixture, deselecting B left the previous four-skein list visible instead of the A-only one-skein list until Show was pressed. | Recalculate the combined trip immediately on project checkbox changes. Once the existing planner has displayed a plan, update it immediately on subsequent selection changes too. Empty selection removes stale results and their copy/share/print actions. Preserve the deliberately empty trip selection across reloads. |
| FFV5-002 | Manual progress and session totals are intentionally independent. A complete lifetime stitch count or total design size is not required. Session totals can describe only the work recorded in this browser and cannot establish a reliable completion percentage. The journal already labels the value “user-entered.” | Preserve manual percentage, lifecycle state, session history and physical inventory semantics. Do not add an “override” badge implying an automatic percentage that does not exist. Cover the exact 450 logged stitches / manual 37% scenario in the browser regression. |
| FFV5-003 | The report describes discoverability friction but supplies no exact obscured control, screenshot or reproducible blocked path. Scrolling alone is not evidence of a broken control. Advanced color comparison intentionally requires an opt-in in Settings. | Keep the guided home and More tools structure. Check narrow layouts, keyboard focus and tool reachability; retain physical-device and first-time usability testing as outstanding. No global navigation pill was added. |
| FFV5-004 | Existing sharing validates at most 250 total rows and 6,000 encoded characters, rejects oversized inputs, and directs the user to copy as text. The trip already offers Copy as text. Browser/share-target compatibility below these limits is not universal. | Keep the bounded format and text fallback. Compression and chunking are not required to prevent unbounded link generation. Actual device/message-app round trips remain unverified. |
| FFV5-005 | The report's own coverage table says all eight development pages passed noindex checks. Local source audit and browser checks verify the same policy. `data-nosnippet` excludes only the brand disclosure. | Retain development noindex, robots disallow and no production canonical. No production indexing changes. Noindex is a crawler instruction, not access control or a guarantee about existing search listings. |

## Changed behavior

Only result rendering and trip-selection persistence change. Confirmed inventory is still subtracted once, unconfirmed/partial stock stays under Check first, and selecting projects does not write project requirements, purchases or thread counts. Found checkmarks reset when their calculation signature changes. The change listeners are attached to project-selection controls, so Found checkboxes do not trigger a list redraw. Repainting results leaves selection controls and their keyboard focus in place.

The service-worker cache advances to `flossfox-dev-v5-gemini-audit-2-seo5` so existing installations receive the updated JavaScript. Cache activation retains the existing namespace and storage rules.

## Verification

`tests/shopping_selection_e2e.py` first failed against the reference build at the stale A-only result (expected one skein, displayed four). With the fix, it passes 343 checks across 320, 390 and 1280 pixels. Each width runs twelve A/both/B/both cycles in each planner, checks Check first, empty/reloaded selections, obsolete Found reset, focus retention, horizontal overflow, unchanged project/inventory bytes, and three saved sessions totaling 450 stitches alongside manual 37% progress.

Run it against the complete application with isolated synthetic data:

```bash
FF_CHROME=/usr/bin/chromium python3 tests/shopping_selection_e2e.py http://127.0.0.1:8775/
```

The accompanying engineering report and raw logs record the exact additional regression suites run against this patch. Earlier V5's 1,628 browser assertions remain historical baseline evidence; they are not claimed as a full rerun on this patch.

## Evidence limits

The supplied report contains no attached Playwright script, trace, screenshots, actual erroneous numeric output or named accessibility-scanner output. Its independent claims therefore remain reported observations unless reproduced here. Several module references are imprecise: the new stitching-session store is `audit/ff-stitch-sessions.js`, the combined trip/share UI is `audit/ff-audit-ui.js`, and the existing `journal.js` serves change history. These distinctions matter when assigning fixes.

Emulated Chromium widths do not certify a physical Fold, iPhone, camera, TalkBack or VoiceOver. Real camera accuracy, cross-browser/device share delivery and independent first-time-user discoverability remain unverified. Production release still requires Myke's separate approval.
