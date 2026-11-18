# Leave a review (private Google Form) - design

Approved by Myke: reviews go to a private Google Form only he reads. Built on a separate branch; nothing merges to the test site or flossfox.com without his say-so.

## Scope
- `review.js` with one config constant `REVIEW_FORM_URL`. While empty (or not https), Help, Settings and footer entry points stay hidden.
- Friendly "Leave a review" link/button in Help and Settings, plus a small footer link when configured.
- Opens in a new tab (`target=_blank` `rel=noopener noreferrer`). Sends nothing from the app: no collection, projects, notes, journal or any localStorage data in the URL.
- Short privacy hint under the button. No em dashes. Pip not required in this copy.
- Cache bump to `flossfox-dev-v2.0a-ci005-92`. Draft PR only.

## Out of scope
- Creating the Google Form itself (draft text lives in `/workspace/review-form/FORM.md` for Myke).
- Prefilling the app version (needs a form entry id once the form exists; skipped for now).
- Merge to test site or production.
