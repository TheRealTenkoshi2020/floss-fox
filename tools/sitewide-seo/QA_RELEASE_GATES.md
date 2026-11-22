# V5 SEO acceptance and release gates

This is the original production-release checklist. The integrated V5 development candidate and exact executed checks are documented in `docs/V5_INTEGRATION.md` and the engineering report accompanying the full source ZIP. Production-only, Search Console and physical-device gates remain unverified; unchecked boxes here must not be read as a claim of deployment.

## Technical (must pass)

- [ ] Current repository baseline confirmed, no overwrite of other merged PRs.
- [ ] All 8 intended indexable content pages have distinct, accurate, descriptive titles and meta descriptions.
- [ ] Exactly one `rel="canonical"` on each production content page, mapped to its own real URL; zero production canonicals on preview.
- [ ] Development pages including new guides have `noindex` and no accidental production indexing. Production content pages have no `noindex`.
- [ ] `404.html` and `offline.html` retain noindex and do not enter sitemap.
- [ ] Official sitemap lists homepage, fabric, about, privacy and four new guides exactly once each, no dev URLs; robots.txt references sitemap.
- [ ] WebSite JSON-LD on production home; WebPage and BreadcrumbList only for pages where visible navigation/content supports them. Rich Results and schema validator checked without assumptions of Google eligibility.
- [ ] Accurate social cards: image exists and dimensions are appropriate, titles and descriptions match the page; no fake rating/review claims.
- [ ] Google-unwanted technical paragraph remains readable to visitors and is excluded using a narrow `data-nosnippet` wrapper.
- [ ] Homepage welcome remains readable and functions at 320/360/390/768/1280 px; no sideways scroll.
- [ ] Every guide has useful unique content, descriptive headings and actual working internal links. No broken links, empty image alt or fabricated claims.
- [ ] Existing main app can still open saved projects/threads, export/import backups, interact with Pip/Threadwood, operate offline, and use Premium controls without regressions.
- [ ] Service worker cache namespace remains distinct between dev and prod. New guide pages can be served offline after a visit/pre-cache; no cache update loop.
- [ ] No new cookies, analytics endpoints, user accounts or payment claims.

## Tests (do not substitute unit tests for live acceptance)

- [x] Local Python patch and page tests: **12 passed** in this package environment.
- [x] Isolated Chromium rendering: **100 checks** passed over 4 guide pages and 5 widths.
- [ ] Patch applied against actual current dev repository and `seo_audit.py --site dev` passed.
- [ ] Existing FlossFox unit and regression test suites run against patched dev source.
- [ ] Actual dev preview evaluated with browser automation and manual phone check.
- [ ] Production-mode patch and audit run on later release candidate, after owner approval.
- [ ] Real deployment and Search Console inspection verified.

## Nontechnical / editorial

- [ ] Pip has approved personality and original appearance; no seasonal replacements.
- [ ] Each page answers a real stitching need and invites action without pressure.
- [ ] Conversion claims preserve uncertainty; no false 1:1 matching promise.
- [ ] Inventory copy distinguishes stitch counts, skein counts, and unconfirmed quantities.
- [ ] No claims of currently working paid OCR/barcode subscriptions unless verified on production.
- [ ] Privacy copy is reviewed by the owner and matches actual usage, including any optional online AI requests, analytics, photo handling and future Premium infrastructure.

If any gate fails, leave production unchanged. Report exact failure and corrective plan.
