# Floss Fox
Static DMC → Anchor floss converter. No build step: open `index.html`.

- Rename: change `APP_NAME` in index.html.
- Affiliate disclosure: set `SHOW_AFFILIATE_DISCLOSURE = true` in index.html once links exist.
- Live at https://therealtenkoshi2020.github.io/floss-fox/ . Contact via GitHub Issues.
- `?sample` auto-fills an example list (handy for testing).
- Data: Cyberstitchers conversion charts (see footer/About).

## Tests
Headless regression suite: `python3 -m http.server 8765` in this folder, then
`python tests/regression.py http://localhost:8765/` (needs `pip install playwright` and Chrome at /usr/bin/google-chrome, or pass `--chrome PATH`).
Parser unit tests: `node tests/parse_unit.js`. Paste checks (24-color list at 360/390/1280): `python tests/parse_e2e.py http://localhost:8765/`.
Run against the live site with `python tests/regression.py https://therealtenkoshi2020.github.io/floss-fox/`. Add `--shots DIR` to save screenshots.

## Projects storage
Projects are stored in `localStorage` under `flossfox.v1` (schema 1, see `projects.js`). Unreadable or newer-schema data is never overwritten. Backups are JSON (`app: "floss-fox"`).

## Milestone 1.2 notes

- Tabs: **Add colors**, **My projects**, **Help**. *Try an example* stores your draft and gives it back (*Back to my list*); it never saves anything unless you press *Save project*.
- Project view: per-color choices **Have enough / Need to buy / Not sure**, search and filters, a summary with next steps, and **Shop my list** (in-store check-in or *Waiting for delivery*, then *I received it*; *Undo received* in Done).
- Stored data is unchanged from 1.1 (schema 2, same keys and CSV columns); only on-screen words changed.
- `tests/contrast.js` measures text contrast in the browser; `tests/regression.py` runs it in four views.
