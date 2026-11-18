# Optional support links (3.9 monetization) - design

Owner request (Myke, Nov 11 2026): add an optional support interface for 3.9, built independently of the 25 Atelier items,
using only payment URLs he verifies. No third-party payment scripts, mandatory accounts, paywalls, pop-ups or tracking of
private project data. All core features stay free. Nothing deploys without his explicit approval.
Source: Samira's Monetization Launch Kit (`support-links.js/.css/.test.cjs`), adapted with fixes below.

## What ships on this branch
- `support/links.js` with ONE config block: `SUPPORT_URL` and `PACK_URL` (both empty on purpose) and `PACK_PRICE = '$7'`.
  While both are empty or fail the checks, nothing renders anywhere: no section, no footer link, no empty mount.
- `support/links.css`: theme tokens only (light, dark, later 3.9 themes), outline buttons, 44px targets, focus ring,
  reduced motion, forced colors, hidden in print.
- Placement: end of the Settings card (mount created by the script, so the big Settings markup line is untouched),
  a section on About (`about.html#support`, which also lists the three privacy points), and one small footer link on the
  app page that opens Settings and scrolls to the section (falls back to `about.html#support`). Never straight to checkout,
  so the external-checkout notice is always seen first.
  Never on the landing / Start here, no modal, no nag, no badge.
- Privacy page: new "Tips and the printable companion" section (Pixel's three points). About page: mount only.
- Copy: Pixel's `support.*` / `privacy.support.*` strings from /workspace/pip-art/atelier39/copy/SUPPORT.md, verbatim,
  all in the `COPY` object, marked DEV DRAFT PENDING MYKE. No provider is named in the copy.
- `sw.js`: both files precached; dev cache `ci005-94` (PR 17 = ci005-92, Atelier = ci005-93). Final value is reconciled at integration.

## Fixes over the kit reference
1. Host allowlist narrowed to exact hosts `ko-fi.com` and `buy.stripe.com` (no subdomain wildcard). Dropped broad
   `stripe.com`, `paypal.com`, `buymeacoffee.com`: Myke's chosen path is Ko-fi; Stripe Payment Links stay as the documented
   fallback. Adding a provider is a code change plus review.
2. Any query string or `#fragment` is rejected (blocks utm_/ref/fbclid/gclid and Stripe prefill or client_reference_id).
   Bare provider homepages are rejected (not a checkout). The URL is used exactly as configured.
3. Link style is by kind (tip / pack), not position, so a pack-only setup is not styled as the tip (kit `i === 0` bug).
4. Unique ids per mount (`ffSupportTitle-settings`, `ffSupportTitle-about`); remounting never duplicates.
5. Copy: Pixel's strings (no em dashes, no spaced hyphens, no provider named), visible external-checkout + internet line
   (singular/plural by number of links), what-you-get line beside the $7 button, provider and tax points on Privacy and About.
6. Offline: the offline note replaces the external line and the links are aria-disabled; a tap while offline opens no dead
   tab. Floss Fox never shows a payment success; only the provider confirms purchases.
7. `referrerpolicy="no-referrer"` added alongside `rel="noopener noreferrer"`.

## Not done here
- No real URLs. Myke pastes two verified URLs after a successful checkout test.
- No merge to dev main, no test-site deploy, no production change.
- Final copy and styling go to Pixel for review.
