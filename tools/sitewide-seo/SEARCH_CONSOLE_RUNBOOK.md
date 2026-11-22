# Google Search Console + search measurement runbook

**Google controls the final title, snippet and crawling schedule.** Do not promise ranking, rich results, a specific snippet or fast indexing.

## Before deployment

1. Obtain access to Search Console for `https://flossfox.com/` (Domain property if DNS verification is practical; otherwise URL-prefix property). Do not ask Mouse to invent authorization or create new login credentials.
2. Export or record a baseline (last 28 days where available): Web search clicks, impressions, CTR, average position; queries and pages; number of indexed URLs; coverage/URL Inspection for homepage and fabric page. Record dates and geography/device dimensions when available.
3. Note existing Google result screenshots and actual `site:flossfox.com` discoverability, but treat `site:` results as incomplete and non-authoritative for exact indexing totals.
4. Confirm no staging subpath is inadvertently indexed. The dev site stays `noindex`.

## After approval and production deployment

1. Verify `https://flossfox.com/robots.txt` permits crawling and points to `https://flossfox.com/sitemap.xml`.
2. Confirm the sitemap returns HTTP 200 with parseable XML and exactly the eight current canonical content URLs. Do not list utility/error pages.
3. Open all eight pages. Confirm HTTP 200, no `noindex`, self-canonical, visible content and working tool links; use the URL Inspection tool for canonical/indexability as Google sees it.
4. Submit `sitemap.xml` in Search Console. URL-inspect home, fabric and the new guide pages; request indexing when helpful, without repetitive submissions.
5. Validate structured data and social cards, with the understanding that WebSite and breadcrumb markup does not guarantee enhanced search-result appearance.
6. Confirm the server returns correct `Content-Type` and does not issue redirect loops or canonical mismatches; inspect security HTTPS redirect to the primary `flossfox.com` hostname.

## Measurement milestones

- **Day 0**: Capture deployment SHA/date, sitemap submission status, baseline query/page export and search-result screenshot.
- **Day 7**: Check crawl/indexing errors and canonical selection. Do not judge ranking from 7 days of data.
- **Day 28**: Compare impressions, clicks and CTR against previous equivalent time ranges and segment by search query, landing page, geography and device.
- **Day 56**: Review whether newly indexed guides attract useful queries and qualified clicks into the actual app, whether homepage snippet is improved, and whether content needs factual corrections.

## Suggested keyword themes (hypotheses, not measured volumes)

| Search intent | Best intended destination |
|---|---|
| `cross stitch floss organizer`, `track embroidery floss` | `thread-inventory-guide.html` then `index.html#threads` |
| `DMC to Anchor conversion`, `Sullivans DMC chart` | `floss-conversion-guide.html` then `index.html#convert` |
| `cross stitch fabric calculator`, `Aida fabric size` | `fabric.html` |
| `cross stitch project planner`, `pattern shopping list` | `cross-stitch-project-planning.html` then `index.html#projects` |
| `free cross stitch tools` | `tools.html` |
| `Floss Fox`, `FlossFox Pip` | homepage |

Do not claim any keyword has high search volume without verifying through actual Search Console or trustworthy keyword data. Publishing new pages does not guarantee ranking.

## Organic engagement measurements (privacy-respecting)

Use Google Search Console for query-level search performance. If aggregate on-site metrics are already configured, compare tool-entry and return usage without identifying individuals or adding tracking beyond the site's disclosed policy. Do not modify GoatCounter or add trackers as part of the SEO patch.
